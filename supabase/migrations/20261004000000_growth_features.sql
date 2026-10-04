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
