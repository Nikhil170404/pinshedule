-- Run this in your Supabase SQL editor to create all tables

-- User profiles (extends Supabase auth.users)
create table if not exists public.user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  plan text not null default 'free_trial',
  billing_cycle text default 'monthly',
  timezone text default 'Asia/Kolkata',
  notifications_enabled boolean default true,
  razorpay_payment_id text,
  razorpay_order_id text,
  plan_started_at timestamptz,
  trial_ends_at timestamptz default (now() + interval '14 days'),
  created_at timestamptz default now()
);

alter table public.user_profiles enable row level security;
create policy "Users can read own profile" on public.user_profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.user_profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.user_profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Pinterest connections
create table if not exists public.pinterest_connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  pinterest_user_id text not null,
  pinterest_username text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  board_cache_updated_at timestamptz,
  created_at timestamptz default now()
);

alter table public.pinterest_connections enable row level security;
create policy "Users can manage own Pinterest connection" on public.pinterest_connections
  for all using (auth.uid() = user_id);

-- Scheduled pins
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
  status text not null default 'pending' check (status in ('pending', 'published', 'failed')),
  pinterest_pin_id text,
  error_message text,
  created_at timestamptz default now()
);

create index on public.scheduled_pins (user_id, status, scheduled_at);

alter table public.scheduled_pins enable row level security;
create policy "Users can manage own pins" on public.scheduled_pins
  for all using (auth.uid() = user_id);

-- Analytics snapshots
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

create index on public.analytics_snapshots (user_id, snapshot_date);

alter table public.analytics_snapshots enable row level security;
create policy "Users can read own analytics" on public.analytics_snapshots
  for select using (auth.uid() = user_id);
create policy "Service can insert analytics" on public.analytics_snapshots
  for insert with check (true);

-- Storage bucket for pin images
insert into storage.buckets (id, name, public)
values ('pin-images', 'pin-images', true)
on conflict (id) do nothing;

create policy "Anyone can read pin images" on storage.objects
  for select using (bucket_id = 'pin-images');

create policy "Users can upload own pin images" on storage.objects
  for insert with check (bucket_id = 'pin-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own pin images" on storage.objects
  for delete using (bucket_id = 'pin-images' and auth.uid()::text = (storage.foldername(name))[1]);
