-- Performance pass, driven by EXPLAIN ANALYZE on a 1.5M pin / 680k analytics row dataset.
-- Idempotent.

-- One account's analytics (the Analytics page) filtered by connection and day: was a full table scan.
create index if not exists account_analytics_conn_day_idx on public.account_analytics (connection_id, day desc);

-- Daily retention deletes work from old dates, so they need to find old rows without scanning the table.
create index if not exists account_analytics_day_idx on public.account_analytics (day);
create index if not exists analytics_snapshots_date_idx on public.analytics_snapshots (snapshot_date);

-- Never queried (batch_id is only written), but it cost a write on every bulk insert.
drop index if exists public.scheduled_pins_batch_idx;

-- Pins change status several times each (pending, processing, published). Vacuum and analyze much earlier than the
-- 20% default so the small partial indexes the dispatcher reads every few seconds do not bloat.
alter table public.scheduled_pins set (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
alter table public.analytics_snapshots set (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.05);

-- Retention in a band: the daily run only looks at rows that expired in the last p_band days (a cheap index range),
-- and a full sweep (p_band null) runs on the 1st of each month to catch anything a missed run left behind.
drop function if exists public.prune_analytics(text, integer);
create or replace function public.prune_analytics(p_plan text, p_days integer, p_band integer default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_cutoff date := (now() at time zone 'utc')::date - p_days;
  v_floor date := case when p_band is null then date '0001-01-01' else v_cutoff - p_band end;
  a integer;
  b integer;
begin
  delete from account_analytics x using user_profiles u
   where x.user_id = u.id and u.plan = p_plan and x.day < v_cutoff and x.day >= v_floor;
  get diagnostics a = row_count;
  delete from analytics_snapshots x using user_profiles u
   where x.user_id = u.id and u.plan = p_plan and x.snapshot_date < v_cutoff and x.snapshot_date >= v_floor;
  get diagnostics b = row_count;
  return a + b;
end;
$$;
revoke execute on function public.prune_analytics(text, integer, integer) from public, anon, authenticated;

-- The Automations page updates live when a run finishes.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'automations') then
    alter publication supabase_realtime add table public.automations;
  end if;
end $$;
