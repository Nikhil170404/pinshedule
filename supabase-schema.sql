-- Pinshedule database schema. Safe to re-run (idempotent) in the Supabase SQL editor.
--
-- Security model: the browser (anon/authenticated role) may only READ its own rows and
-- change a few harmless profile columns. Every write that matters (scheduling, billing,
-- tokens) goes through the Railway worker using the service-role key, which bypasses RLS.

create extension if not exists pgcrypto;

-- ───────────────────────── user_profiles ─────────────────────────
create table if not exists public.user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  plan text not null default 'free_trial',
  billing_cycle text default 'monthly',
  timezone text default 'UTC',
  notifications_enabled boolean default true,
  created_at timestamptz default now()
);

alter table public.user_profiles add column if not exists plan_started_at timestamptz;
alter table public.user_profiles add column if not exists plan_expires_at timestamptz;
alter table public.user_profiles add column if not exists plan_status text not null default 'active';
alter table public.user_profiles add column if not exists razorpay_subscription_id text;
alter table public.user_profiles add column if not exists razorpay_customer_id text;
alter table public.user_profiles add column if not exists razorpay_payment_id text;
alter table public.user_profiles add column if not exists razorpay_order_id text;
alter table public.user_profiles add column if not exists trial_ends_at timestamptz;

-- Public-facing profile details. Written only through the worker (PATCH /v1/account/profile), which validates them.
alter table public.user_profiles add column if not exists display_name text;
alter table public.user_profiles add column if not exists username text;
alter table public.user_profiles add column if not exists pronouns text;
alter table public.user_profiles add column if not exists bio text;
alter table public.user_profiles add column if not exists links text[] not null default '{}';
create unique index if not exists user_profiles_username_idx on public.user_profiles (lower(username)) where username is not null;

alter table public.user_profiles drop constraint if exists user_profiles_plan_check;
alter table public.user_profiles add constraint user_profiles_plan_check
  check (plan in ('free_trial', 'starter', 'pro', 'growth'));

create unique index if not exists user_profiles_subscription_idx
  on public.user_profiles (razorpay_subscription_id) where razorpay_subscription_id is not null;

alter table public.user_profiles enable row level security;
drop policy if exists "Users can read own profile" on public.user_profiles;
drop policy if exists "Users can update own profile" on public.user_profiles;
drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can read own profile" on public.user_profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.user_profiles for update using (auth.uid() = id);

-- Users must NOT be able to grant themselves a plan: only these columns are writable from the browser.
revoke insert, update, delete on public.user_profiles from anon, authenticated;
grant update (timezone, notifications_enabled) on public.user_profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── pinterest_connections ─────────────────────────
create table if not exists public.pinterest_connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  pinterest_user_id text not null,
  pinterest_username text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

alter table public.pinterest_connections add column if not exists status text not null default 'active';
alter table public.pinterest_connections add column if not exists last_error text;
alter table public.pinterest_connections add column if not exists refresh_expires_at timestamptz;
alter table public.pinterest_connections add column if not exists scope text;
alter table public.pinterest_connections add column if not exists updated_at timestamptz default now();

-- ───────────── multiple Pinterest accounts per login ─────────────
-- A login is a workspace that can own many connections (plan limit: shared/plans.ts `accounts`).
-- Signing in is decided only by the Pinterest account that created the login (see the OAuth callback), never by
-- a connection added later: an agency adding a client's account must not let that client into the agency's workspace.
-- The same Pinterest account may therefore appear in more than one login, but only once within each.
alter table public.pinterest_connections add column if not exists label text;
alter table public.pinterest_connections add column if not exists avatar_url text;
alter table public.pinterest_connections add column if not exists is_primary boolean not null default false;
alter table public.pinterest_connections add column if not exists analytics_synced_at timestamptz;
alter table public.pinterest_connections drop constraint if exists pinterest_connections_user_id_key;
drop index if exists public.pinterest_connections_pinterest_user_idx; -- an earlier draft made this global
create unique index if not exists pinterest_connections_user_pinterest_idx on public.pinterest_connections (user_id, pinterest_user_id);
create index if not exists pinterest_connections_pinterest_user_idx on public.pinterest_connections (pinterest_user_id);
create index if not exists pinterest_connections_user_idx on public.pinterest_connections (user_id, created_at);
-- Logins created before this change have exactly one connection: it becomes the primary one.
update public.pinterest_connections set is_primary = true
 where id in (
   select distinct on (c.user_id) c.id from public.pinterest_connections c
    where not exists (select 1 from public.pinterest_connections o where o.user_id = c.user_id and o.is_primary)
    order by c.user_id, c.created_at
 );

alter table public.pinterest_connections drop constraint if exists pinterest_connections_status_check;
alter table public.pinterest_connections add constraint pinterest_connections_status_check
  check (status in ('active', 'needs_reconnect'));

create index if not exists pinterest_connections_expiry_idx
  on public.pinterest_connections (expires_at) where status = 'active';

alter table public.pinterest_connections enable row level security;
drop policy if exists "Users can manage own Pinterest connection" on public.pinterest_connections;
drop policy if exists "Users can read own Pinterest connection" on public.pinterest_connections;
create policy "Users can read own Pinterest connection" on public.pinterest_connections
  for select using (auth.uid() = user_id);

-- Encrypted tokens are never readable from the browser; only these columns are.
revoke all on public.pinterest_connections from anon, authenticated;
grant select (id, user_id, pinterest_user_id, pinterest_username, status, last_error, expires_at, created_at, label, avatar_url, is_primary)
  on public.pinterest_connections to authenticated;

-- ───────────────────────── scheduled_pins ─────────────────────────
create table if not exists public.scheduled_pins (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  image_url text not null,
  title text,
  description text,
  board_id text not null,
  board_name text,
  destination_url text,
  scheduled_at timestamptz not null,
  status text not null default 'pending',
  pinterest_pin_id text,
  error_message text,
  created_at timestamptz default now()
);

alter table public.scheduled_pins add column if not exists alt_text text;
alter table public.scheduled_pins add column if not exists attempts integer not null default 0;
alter table public.scheduled_pins add column if not exists processing_started_at timestamptz;
alter table public.scheduled_pins add column if not exists published_at timestamptz;
alter table public.scheduled_pins add column if not exists batch_id uuid;

-- Which Pinterest account publishes the pin. Removing an account removes its queue and history.
alter table public.scheduled_pins add column if not exists connection_id uuid references public.pinterest_connections(id) on delete cascade;
update public.scheduled_pins sp set connection_id = c.id
  from public.pinterest_connections c
 where sp.connection_id is null and c.user_id = sp.user_id and c.is_primary;

-- Pin formats. image_url is always the thumbnail: the image itself, the video cover, or the first carousel image.
alter table public.scheduled_pins add column if not exists media_type text not null default 'image';
alter table public.scheduled_pins add column if not exists video_url text;
alter table public.scheduled_pins add column if not exists carousel_items jsonb;
alter table public.scheduled_pins add column if not exists media_id text; -- Pinterest media upload id while a video is processing
alter table public.scheduled_pins drop constraint if exists scheduled_pins_media_type_check;
alter table public.scheduled_pins add constraint scheduled_pins_media_type_check check (media_type in ('image', 'video', 'carousel'));

alter table public.scheduled_pins drop constraint if exists scheduled_pins_status_check;
alter table public.scheduled_pins add constraint scheduled_pins_status_check
  check (status in ('pending', 'processing', 'published', 'failed'));

-- Hot paths:
--   dispatcher/reconciler  -> due pending pins across all users
create index if not exists scheduled_pins_due_idx
  on public.scheduled_pins (scheduled_at) where status = 'pending';
--   stuck-job sweeper
create index if not exists scheduled_pins_processing_idx
  on public.scheduled_pins (processing_started_at) where status = 'processing';
--   queue / calendar / lists, quota counting
create index if not exists scheduled_pins_user_time_idx
  on public.scheduled_pins (user_id, scheduled_at desc);
create index if not exists scheduled_pins_user_status_time_idx
  on public.scheduled_pins (user_id, status, scheduled_at);
--   duplicate-URL detection on import
create index if not exists scheduled_pins_user_dest_idx
  on public.scheduled_pins (user_id, destination_url) where destination_url is not null;
--   analytics sync: recently published pins
create index if not exists scheduled_pins_published_idx
  on public.scheduled_pins (user_id, published_at desc) where status = 'published';
create index if not exists scheduled_pins_batch_idx
  on public.scheduled_pins (batch_id) where batch_id is not null;
--   per-account queue, calendar and counts (100 accounts on one dashboard)
create index if not exists scheduled_pins_conn_status_time_idx
  on public.scheduled_pins (connection_id, status, scheduled_at);
create index if not exists scheduled_pins_conn_time_idx
  on public.scheduled_pins (connection_id, scheduled_at desc);

alter table public.scheduled_pins enable row level security;
drop policy if exists "Users can manage own pins" on public.scheduled_pins;
drop policy if exists "Users can read own pins" on public.scheduled_pins;
create policy "Users can read own pins" on public.scheduled_pins for select using (auth.uid() = user_id);
revoke insert, update, delete on public.scheduled_pins from anon, authenticated;

-- ───────────────────────── analytics ─────────────────────────
create table if not exists public.analytics_snapshots (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  pin_id uuid references public.scheduled_pins(id) on delete cascade,
  pinterest_pin_id text,
  impressions integer default 0,
  saves integer default 0,
  clicks integer default 0,
  snapshot_date date not null,
  created_at timestamptz default now()
);
alter table public.analytics_snapshots add column if not exists outbound_clicks integer default 0;
alter table public.analytics_snapshots add column if not exists connection_id uuid references public.pinterest_connections(id) on delete cascade;
update public.analytics_snapshots a set connection_id = sp.connection_id
  from public.scheduled_pins sp where a.connection_id is null and a.pin_id = sp.id;
create index if not exists analytics_snapshots_conn_day_idx on public.analytics_snapshots (connection_id, snapshot_date desc);

create unique index if not exists analytics_snapshots_pin_day_idx
  on public.analytics_snapshots (pin_id, snapshot_date);
create index if not exists analytics_snapshots_user_day_idx
  on public.analytics_snapshots (user_id, snapshot_date desc);

alter table public.analytics_snapshots enable row level security;
drop policy if exists "Users can read own analytics" on public.analytics_snapshots;
drop policy if exists "Service can insert analytics" on public.analytics_snapshots; -- was open to everyone
create policy "Users can read own analytics" on public.analytics_snapshots for select using (auth.uid() = user_id);
revoke insert, update, delete on public.analytics_snapshots from anon, authenticated;

-- Account-level daily totals straight from Pinterest (one API call per user instead of one per pin).
create table if not exists public.account_analytics (
  user_id uuid references auth.users(id) on delete cascade not null,
  day date not null,
  impressions integer not null default 0,
  saves integer not null default 0,
  pin_clicks integer not null default 0,
  outbound_clicks integer not null default 0,
  engagements integer not null default 0
);
-- One row per account per day (was per login per day).
alter table public.account_analytics add column if not exists connection_id uuid references public.pinterest_connections(id) on delete cascade;
update public.account_analytics a set connection_id = c.id
  from public.pinterest_connections c where a.connection_id is null and c.user_id = a.user_id and c.is_primary;
alter table public.account_analytics drop constraint if exists account_analytics_pkey;
create unique index if not exists account_analytics_conn_day_idx on public.account_analytics (connection_id, day);
create index if not exists account_analytics_user_day_idx on public.account_analytics (user_id, day desc);
alter table public.account_analytics enable row level security;
drop policy if exists "Users can read own account analytics" on public.account_analytics;
create policy "Users can read own account analytics" on public.account_analytics for select using (auth.uid() = user_id);
revoke insert, update, delete on public.account_analytics from anon, authenticated;

-- ───────────────────────── usage counters (AI + imports) ─────────────────────────
create table if not exists public.usage_counters (
  user_id uuid references auth.users(id) on delete cascade not null,
  kind text not null,
  period text not null, -- YYYY-MM (UTC)
  count integer not null default 0,
  primary key (user_id, kind, period)
);
alter table public.usage_counters enable row level security;
drop policy if exists "Users can read own usage" on public.usage_counters;
create policy "Users can read own usage" on public.usage_counters for select using (auth.uid() = user_id);
revoke insert, update, delete on public.usage_counters from anon, authenticated;

-- Atomically consume `p_amount` units; returns false (and consumes nothing) if it would exceed the limit.
create or replace function public.consume_usage(p_user uuid, p_kind text, p_limit integer, p_amount integer default 1)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_period text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_count integer;
begin
  insert into usage_counters (user_id, kind, period, count) values (p_user, p_kind, v_period, 0)
  on conflict do nothing;
  update usage_counters set count = count + p_amount
   where user_id = p_user and kind = p_kind and period = v_period and count + p_amount <= p_limit
  returning count into v_count;
  return v_count is not null;
end;
$$;

create or replace function public.refund_usage(p_user uuid, p_kind text, p_amount integer default 1)
returns void language sql security definer set search_path = public as $$
  update usage_counters set count = greatest(0, count - p_amount)
   where user_id = p_user and kind = p_kind and period = to_char(now() at time zone 'utc', 'YYYY-MM');
$$;

revoke execute on function public.consume_usage(uuid, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.refund_usage(uuid, text, integer) from public, anon, authenticated;

-- ───────────────────────── atomic bulk scheduling with quota ─────────────────────────
-- Inserts all rows or none. Quota is per calendar month (UTC) of scheduled_at, serialised per
-- user with an advisory lock so two concurrent bulk requests cannot both squeeze under the limit.
create or replace function public.schedule_pins(p_user uuid, p_rows jsonb, p_limit integer)
returns table (id uuid, scheduled_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  m record;
  v_existing integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  for m in
    select date_trunc('month', (r->>'scheduled_at')::timestamptz at time zone 'utc') as month_start, count(*)::int as n
      from jsonb_array_elements(p_rows) r group by 1
  loop
    select count(*) into v_existing from scheduled_pins sp
     where sp.user_id = p_user
       and sp.status in ('pending', 'processing', 'published')
       and sp.scheduled_at >= m.month_start at time zone 'utc'
       and sp.scheduled_at <  (m.month_start + interval '1 month') at time zone 'utc';
    if v_existing + m.n > p_limit then
      raise exception 'quota_exceeded:%:%', greatest(0, p_limit - v_existing), p_limit using errcode = 'P0001';
    end if;
  end loop;

  return query
  insert into scheduled_pins (id, user_id, connection_id, image_url, title, description, alt_text, board_id, board_name,
                              destination_url, scheduled_at, batch_id, status, media_type, video_url, carousel_items)
  select coalesce(nullif(r->>'id', '')::uuid, gen_random_uuid()), p_user, nullif(r->>'connection_id', '')::uuid,
         r->>'image_url', r->>'title', r->>'description', nullif(r->>'alt_text', ''),
         r->>'board_id', nullif(r->>'board_name', ''), nullif(r->>'destination_url', ''),
         (r->>'scheduled_at')::timestamptz, nullif(r->>'batch_id', '')::uuid, 'pending',
         coalesce(nullif(r->>'media_type', ''), 'image'), nullif(r->>'video_url', ''),
         case when jsonb_typeof(r->'carousel_items') = 'array' then r->'carousel_items' end
    from jsonb_array_elements(p_rows) r
  returning scheduled_pins.id, scheduled_pins.scheduled_at;
end;
$$;
revoke execute on function public.schedule_pins(uuid, jsonb, integer) from public, anon, authenticated;

-- ───────────────────────── realtime ─────────────────────────
-- The dashboard subscribes to scheduled_pins changes (RLS applies: users only receive their own rows).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scheduled_pins') then
    alter publication supabase_realtime add table public.scheduled_pins;
  end if;
end $$;

-- ───────────────────────── storage ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pin-images', 'pin-images', true, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read pin images" on storage.objects;
drop policy if exists "Users can upload own pin images" on storage.objects;
drop policy if exists "Users can delete own pin images" on storage.objects;
create policy "Anyone can read pin images" on storage.objects
  for select using (bucket_id = 'pin-images');
create policy "Users can upload own pin images" on storage.objects
  for insert with check (bucket_id = 'pin-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can delete own pin images" on storage.objects
  for delete using (bucket_id = 'pin-images' and auth.uid()::text = (storage.foldername(name))[1]);

-- ───────────────────────── worker: atomic claim ─────────────────────────
-- Flips pending -> processing for the given ids and returns the rows. Because it is a single
-- UPDATE ... RETURNING, two workers can never both receive the same pin.
create or replace function public.claim_pins(p_ids uuid[])
returns setof public.scheduled_pins language sql security definer set search_path = public as $$
  update scheduled_pins
     set status = 'processing', processing_started_at = now(), attempts = attempts + 1
   where id = any(p_ids) and status = 'pending' and scheduled_at <= now()
  returning *;
$$;
revoke execute on function public.claim_pins(uuid[]) from public, anon, authenticated;

-- ───────────────────────── vector search (pgvector) ─────────────────────────
-- One embedding per pin (OpenAI text-embedding-3-small, 1536 dims) powers
-- "similar pin" warnings so users do not repost near-duplicates (which Pinterest treats as spam).
create extension if not exists vector with schema extensions;

create table if not exists public.pin_embeddings (
  pin_id uuid primary key references public.scheduled_pins(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);
create index if not exists pin_embeddings_user_idx on public.pin_embeddings (user_id);
create index if not exists pin_embeddings_hnsw_idx on public.pin_embeddings using hnsw (embedding vector_cosine_ops);

alter table public.pin_embeddings enable row level security;
revoke all on public.pin_embeddings from anon, authenticated; -- worker only (service role)

drop function if exists public.match_pins(uuid, vector, float, int);
create or replace function public.match_pins(p_user uuid, p_embedding vector(1536), p_threshold float, p_limit int default 3, p_connection uuid default null)
returns table (pin_id uuid, title text, status text, scheduled_at timestamptz, similarity float)
language sql stable security definer set search_path = public, extensions as $$
  select sp.id, sp.title, sp.status, sp.scheduled_at, 1 - (pe.embedding <=> p_embedding) as similarity
    from pin_embeddings pe
    join scheduled_pins sp on sp.id = pe.pin_id
   where pe.user_id = p_user
     and (p_connection is null or sp.connection_id = p_connection)
     and sp.scheduled_at > now() - interval '120 days'
     and 1 - (pe.embedding <=> p_embedding) >= p_threshold
   order by pe.embedding <=> p_embedding
   limit p_limit;
$$;
revoke execute on function public.match_pins(uuid, vector, float, int, uuid) from public, anon, authenticated;

-- ───────────────────────── accounts dashboard ─────────────────────────
-- Queue and activity numbers for every account of a login in one grouped query.
create or replace function public.account_stats(p_user uuid)
returns table (connection_id uuid, pending bigint, failed bigint, published_30d bigint, last_published_at timestamptz, next_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id,
         count(sp.id) filter (where sp.status in ('pending', 'processing')),
         count(sp.id) filter (where sp.status = 'failed'),
         count(sp.id) filter (where sp.status = 'published' and sp.published_at > now() - interval '30 days'),
         max(sp.published_at) filter (where sp.status = 'published'),
         min(sp.scheduled_at) filter (where sp.status = 'pending')
    from pinterest_connections c
    left join scheduled_pins sp on sp.connection_id = c.id
   where c.user_id = p_user
   group by c.id;
$$;
revoke execute on function public.account_stats(uuid) from public, anon, authenticated;

-- ───────────────────────── video storage ─────────────────────────
-- Videos are fetched by the worker at publish time and uploaded to Pinterest. 50 MB keeps within Supabase's
-- default per-file limit; raise it here and in the project's storage settings for longer videos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pin-videos', 'pin-videos', true, 52428800, array['video/mp4', 'video/quicktime', 'video/x-m4v'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read pin videos" on storage.objects;
drop policy if exists "Users can upload own pin videos" on storage.objects;
drop policy if exists "Users can delete own pin videos" on storage.objects;
create policy "Anyone can read pin videos" on storage.objects
  for select using (bucket_id = 'pin-videos');
create policy "Users can upload own pin videos" on storage.objects
  for insert with check (bucket_id = 'pin-videos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users can delete own pin videos" on storage.objects
  for delete using (bucket_id = 'pin-videos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ───────────────────────── personalised best times ─────────────────────────
-- The latest analytics snapshot of every published pin of one account, with when it went out.
create or replace function public.timing_samples(p_connection uuid, p_limit int default 1500)
returns table (published_at timestamptz, impressions integer, saves integer, clicks integer, outbound_clicks integer)
language sql stable security definer set search_path = public as $$
  select p.published_at, coalesce(s.impressions, 0), coalesce(s.saves, 0), coalesce(s.clicks, 0), coalesce(s.outbound_clicks, 0)
    from (
      select distinct on (pin_id) pin_id, impressions, saves, clicks, outbound_clicks
        from analytics_snapshots
       where connection_id = p_connection and pin_id is not null
       order by pin_id, snapshot_date desc
    ) s
    join scheduled_pins p on p.id = s.pin_id
   where p.status = 'published' and p.published_at is not null
   order by p.published_at desc
   limit p_limit;
$$;
revoke execute on function public.timing_samples(uuid, int) from public, anon, authenticated;

