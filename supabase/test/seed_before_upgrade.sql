-- Data that exists in production before the growth migration runs.
insert into auth.users (id) values ('aaaaaaaa-0000-4000-8000-000000000001'), ('aaaaaaaa-0000-4000-8000-000000000002');
insert into public.user_profiles (id, plan) values ('aaaaaaaa-0000-4000-8000-000000000001', 'growth') on conflict (id) do update set plan = excluded.plan;
insert into public.user_profiles (id, plan) values ('aaaaaaaa-0000-4000-8000-000000000002', 'free_trial') on conflict (id) do nothing;
insert into public.pinterest_connections (user_id, pinterest_user_id, pinterest_username, access_token, refresh_token, expires_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'p1', 'one', 'a', 'b', now() + interval '1 day'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'p2', 'two', 'a', 'b', now() + interval '1 day');
insert into public.scheduled_pins (user_id, image_url, board_id, scheduled_at, status)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'https://i/x.jpg', 'b', now() + interval '1 day', 'pending');
insert into public.account_analytics (user_id, day, impressions) values
  ('aaaaaaaa-0000-4000-8000-000000000001', current_date - 100, 5),
  ('aaaaaaaa-0000-4000-8000-000000000001', current_date - 2, 7),
  ('aaaaaaaa-0000-4000-8000-000000000002', current_date - 20, 9);
