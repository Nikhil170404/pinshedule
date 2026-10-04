-- Fails (raises) when the upgrade did not do what the app relies on.
do $$
declare n integer;
begin
  select count(*) into n from pinterest_connections where is_primary;
  if n <> 2 then raise exception 'every existing connection should become primary, got %', n; end if;

  select count(*) into n from scheduled_pins sp join pinterest_connections c on c.id = sp.connection_id and c.is_primary;
  if n <> 1 then raise exception 'existing pins should be linked to the primary connection, got %', n; end if;

  select count(*) into n from account_analytics where connection_id = '00000000-0000-0000-0000-000000000000';
  if n <> 0 then raise exception 'existing analytics should be linked to a connection, % are not', n; end if;

  -- a second Pinterest account for the same login is allowed, a second primary or a duplicate is not
  insert into pinterest_connections (user_id, pinterest_user_id, pinterest_username, access_token, refresh_token, expires_at)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'p1b', 'second', 'a', 'b', now() + interval '1 day');
  begin
    insert into pinterest_connections (user_id, pinterest_user_id, access_token, refresh_token, expires_at, is_primary)
      values ('aaaaaaaa-0000-4000-8000-000000000001', 'p1c', 'a', 'b', now(), true);
    raise exception 'a second primary connection must be rejected';
  exception when unique_violation then null; end;
  begin
    insert into pinterest_connections (user_id, pinterest_user_id, access_token, refresh_token, expires_at)
      values ('aaaaaaaa-0000-4000-8000-000000000001', 'p1b', 'a', 'b', now());
    raise exception 'the same Pinterest account twice must be rejected';
  exception when unique_violation then null; end;

  -- atomic scheduling stores the new columns and still enforces the quota
  perform * from schedule_pins('aaaaaaaa-0000-4000-8000-000000000001',
    jsonb_build_array(jsonb_build_object('image_url', 'https://i/y.jpg', 'board_id', 'b', 'scheduled_at', (now() + interval '2 days')::text,
      'connection_id', (select id from pinterest_connections where pinterest_user_id = 'p1b'), 'automation_id', gen_random_uuid()::text,
      'recycled_from', (select id::text from scheduled_pins limit 1))), 100);
  select count(*) into n from scheduled_pins where connection_id is not null and automation_id is not null and recycled_from is not null;
  if n <> 1 then raise exception 'schedule_pins should store connection, automation and recycled_from'; end if;
  begin
    perform * from schedule_pins('aaaaaaaa-0000-4000-8000-000000000001',
      '[{"image_url":"h","board_id":"b","scheduled_at":"2026-12-01T00:00:00Z"},{"image_url":"h","board_id":"b","scheduled_at":"2026-12-02T00:00:00Z"}]'::jsonb, 1);
    raise exception 'quota should have been enforced';
  exception when sqlstate 'P0001' then null; end;

  -- analytics retention keeps each plan's window
  perform prune_analytics('free_trial', 7);
  perform prune_analytics('growth', 90);
  select count(*) into n from account_analytics;
  if n <> 1 then raise exception 'retention should leave only the in-window growth row, got %', n; end if;

  insert into automations (user_id, kind, config) values ('aaaaaaaa-0000-4000-8000-000000000001', 'evergreen', '{"per_day":1}');
  begin
    insert into automations (user_id, kind) values ('aaaaaaaa-0000-4000-8000-000000000001', 'bogus');
    raise exception 'unknown automation kinds must be rejected';
  exception when check_violation then null; end;
end $$;

-- the browser role must not read secrets or write plans
set role authenticated;
do $$
begin
  begin perform notification_email from user_profiles; raise exception 'browser must not read notification_email';
  exception when insufficient_privilege then null; end;
  begin perform access_token from pinterest_connections; raise exception 'browser must not read tokens';
  exception when insufficient_privilege then null; end;
  begin update user_profiles set plan = 'growth'; raise exception 'browser must not change plans';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from automation_urls; raise exception 'browser must not read automation_urls';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
