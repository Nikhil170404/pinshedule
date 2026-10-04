-- ===== 20260901000000_baseline.sql =====
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
  user_id uuid references auth.users(id) on delete cascade not null unique,
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
grant select (id, user_id, pinterest_user_id, pinterest_username, status, last_error, expires_at, created_at)
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
  engagements integer not null default 0,
  primary key (user_id, day)
);
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
  insert into scheduled_pins (id, user_id, image_url, title, description, alt_text, board_id, board_name,
                              destination_url, scheduled_at, batch_id, status)
  select coalesce(nullif(r->>'id', '')::uuid, gen_random_uuid()), p_user, r->>'image_url', r->>'title', r->>'description', nullif(r->>'alt_text', ''),
         r->>'board_id', nullif(r->>'board_name', ''), nullif(r->>'destination_url', ''),
         (r->>'scheduled_at')::timestamptz, nullif(r->>'batch_id', '')::uuid, 'pending'
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

create or replace function public.match_pins(p_user uuid, p_embedding vector(1536), p_threshold float, p_limit int default 3)
returns table (pin_id uuid, title text, status text, scheduled_at timestamptz, similarity float)
language sql stable security definer set search_path = public, extensions as $$
  select sp.id, sp.title, sp.status, sp.scheduled_at, 1 - (pe.embedding <=> p_embedding) as similarity
    from pin_embeddings pe
    join scheduled_pins sp on sp.id = pe.pin_id
   where pe.user_id = p_user
     and sp.scheduled_at > now() - interval '120 days'
     and 1 - (pe.embedding <=> p_embedding) >= p_threshold
   order by pe.embedding <=> p_embedding
   limit p_limit;
$$;
revoke execute on function public.match_pins(uuid, vector, float, int) from public, anon, authenticated;

-- ===== 20261004000000_growth_features.sql =====
-- Growth features: multiple Pinterest accounts, automations (sitemap autopilot, evergreen recycling),
-- verified notification email, plan switching state, and database-side analytics retention.
-- Idempotent: safe to run on an existing database and on a fresh one after the baseline.

-- ───────────────────────── multiple Pinterest accounts per login ─────────────────────────
alter table public.pinterest_connections drop constraint if exists pinterest_connections_user_id_key;
alter table public.pinterest_connections add column if not exists is_primary boolean not null default false;

-- Every existing connection was the login account, so it is the primary one.
update public.pinterest_connections c set is_primary = true
 where not exists (select 1 from public.pinterest_connections o where o.user_id = c.user_id and o.is_primary);

create unique index if not exists pinterest_connections_user_account_idx
  on public.pinterest_connections (user_id, pinterest_user_id);
create unique index if not exists pinterest_connections_primary_idx
  on public.pinterest_connections (user_id) where is_primary;

grant select (id, user_id, pinterest_user_id, pinterest_username, status, last_error, expires_at, created_at, is_primary)
  on public.pinterest_connections to authenticated;

-- Which account a pin publishes to (existing pins are backfilled to the primary account below).
alter table public.scheduled_pins add column if not exists connection_id uuid references public.pinterest_connections(id) on delete set null;
alter table public.scheduled_pins add column if not exists automation_id uuid;
alter table public.scheduled_pins add column if not exists recycled_from uuid references public.scheduled_pins(id) on delete set null;
update public.scheduled_pins sp set connection_id = c.id
  from public.pinterest_connections c
 where sp.connection_id is null and c.user_id = sp.user_id and c.is_primary;
create index if not exists scheduled_pins_connection_idx on public.scheduled_pins (connection_id) where connection_id is not null;
create index if not exists scheduled_pins_recycled_idx on public.scheduled_pins (recycled_from) where recycled_from is not null;

-- Analytics are kept per connected account. The all-zero id marks rows from before accounts existed.
alter table public.account_analytics add column if not exists connection_id uuid not null default '00000000-0000-0000-0000-000000000000';
update public.account_analytics a
   set connection_id = c.id
  from public.pinterest_connections c
 where a.connection_id = '00000000-0000-0000-0000-000000000000' and c.user_id = a.user_id and c.is_primary;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'account_analytics_pkey' and pg_get_constraintdef(oid) like '%connection_id%') then
    alter table public.account_analytics drop constraint if exists account_analytics_pkey;
    alter table public.account_analytics add primary key (user_id, connection_id, day);
  end if;
end $$;

-- Atomic scheduling now records the target account, automation and recycled-from pin.
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
  insert into scheduled_pins (id, user_id, image_url, title, description, alt_text, board_id, board_name,
                              destination_url, scheduled_at, batch_id, status, connection_id, automation_id, recycled_from)
  select coalesce(nullif(r->>'id', '')::uuid, gen_random_uuid()), p_user, r->>'image_url', r->>'title', r->>'description', nullif(r->>'alt_text', ''),
         r->>'board_id', nullif(r->>'board_name', ''), nullif(r->>'destination_url', ''),
         (r->>'scheduled_at')::timestamptz, nullif(r->>'batch_id', '')::uuid, 'pending',
         nullif(r->>'connection_id', '')::uuid, nullif(r->>'automation_id', '')::uuid, nullif(r->>'recycled_from', '')::uuid
    from jsonb_array_elements(p_rows) r
  returning scheduled_pins.id, scheduled_pins.scheduled_at;
end;
$$;
revoke execute on function public.schedule_pins(uuid, jsonb, integer) from public, anon, authenticated;

-- ───────────────────────── automations ─────────────────────────
-- kind 'sitemap'  : pin new pages from a sitemap on a steady schedule
-- kind 'evergreen': re-pin older published pins that are still worth showing
create table if not exists public.automations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  connection_id uuid references public.pinterest_connections(id) on delete cascade,
  kind text not null check (kind in ('sitemap', 'evergreen')),
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  next_run_at timestamptz not null default now(),
  last_run_at timestamptz,
  last_result text,
  total_created integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists automations_due_idx on public.automations (next_run_at) where enabled;
create index if not exists automations_user_idx on public.automations (user_id);

-- URLs an automation already handled (including pages it skipped), so nothing is processed twice.
create table if not exists public.automation_urls (
  automation_id uuid references public.automations(id) on delete cascade not null,
  url text not null,
  outcome text not null default 'scheduled',
  created_at timestamptz not null default now(),
  primary key (automation_id, url)
);

alter table public.automations enable row level security;
alter table public.automation_urls enable row level security;
drop policy if exists "Users can read own automations" on public.automations;
create policy "Users can read own automations" on public.automations for select using (auth.uid() = user_id);
revoke all on public.automations from anon, authenticated;
grant select on public.automations to authenticated;
revoke all on public.automation_urls from anon, authenticated;

-- ───────────────────────── notification email (verified) ─────────────────────────
-- Login is Pinterest only, so we have no email until the user adds one.
alter table public.user_profiles add column if not exists notification_email text;
alter table public.user_profiles add column if not exists notification_email_verified boolean not null default false;
revoke select on public.user_profiles from anon, authenticated;
grant select (id, plan, billing_cycle, timezone, notifications_enabled, created_at, plan_started_at, plan_expires_at, plan_status)
  on public.user_profiles to authenticated;

-- ───────────────────────── plan switching ─────────────────────────
-- A downgrade (or "switch at renewal") is bought now but starts when the current period ends.
alter table public.user_profiles add column if not exists next_plan text;
alter table public.user_profiles add column if not exists next_billing_cycle text;
alter table public.user_profiles add column if not exists next_plan_at timestamptz;
alter table public.user_profiles add column if not exists next_subscription_id text;

-- ───────────────────────── analytics retention ─────────────────────────
-- Each plan keeps a fixed number of days of analytics (see shared/plans.ts); the worker calls this once a day
-- for every plan with that plan's window, so the limit holds in the database as well as in the UI.
create or replace function public.prune_analytics(p_plan text, p_days integer)
returns integer language plpgsql security definer set search_path = public as $$
declare
  a integer;
  b integer;
begin
  delete from account_analytics x using user_profiles u
   where x.user_id = u.id and u.plan = p_plan and x.day < (now() at time zone 'utc')::date - p_days;
  get diagnostics a = row_count;
  delete from analytics_snapshots x using user_profiles u
   where x.user_id = u.id and u.plan = p_plan and x.snapshot_date < (now() at time zone 'utc')::date - p_days;
  get diagnostics b = row_count;
  return a + b;
end;
$$;
revoke execute on function public.prune_analytics(text, integer) from public, anon, authenticated;

