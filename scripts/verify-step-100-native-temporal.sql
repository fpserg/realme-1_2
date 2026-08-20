begin;

insert into auth.users (id)
values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333');

create or replace function pg_temp.expect_rejection(
  case_name text,
  command text
)
returns void
language plpgsql
as $$
begin
  begin
    execute command;
  exception
    when others then
      return;
  end;
  raise exception '%: malformed action unexpectedly succeeded', case_name;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);

-- invalid timezone
select pg_temp.expect_rejection(
  'invalid timezone',
  $$select * from public.save_time_setting('UTC+02', '04:00')$$
);

create temporary table initial_setting as
select * from public.save_time_setting('Europe/Amsterdam', '04:00');

do $$
declare
  setting record;
begin
  select * into setting from initial_setting;
  assert setting.timezone_name = 'Europe/Amsterdam';
  assert setting.operational_day_boundary = time '04:00';
  assert setting.effective_from = '-infinity'::timestamptz;
  assert setting.was_created;
end;
$$;

create temporary table same_setting as
select * from public.save_time_setting('Europe/Amsterdam', '04:00');

do $$
begin
  assert (select time_setting_id from same_setting) =
    (select time_setting_id from initial_setting);
  assert not (select was_created from same_setting);
end;
$$;

create temporary table before_boundary_capture as
select * from public.capture_text_observation(
  'aaaaaaaa-0000-4000-8000-000000000100',
  'Before four local',
  timestamptz '2026-08-21 00:30:00+00',
  'Europe/Amsterdam'
);
create temporary table before_boundary_assignment as
select * from public.assign_observation_operational_period(
  (select observation_id from before_boundary_capture)
);

create temporary table after_boundary_capture as
select * from public.capture_text_observation(
  'aaaaaaaa-0000-4000-8000-000000000101',
  'After four local',
  timestamptz '2026-08-21 03:00:00+00',
  'Europe/Amsterdam'
);
create temporary table after_boundary_assignment as
select * from public.assign_observation_operational_period(
  (select observation_id from after_boundary_capture)
);

do $$
begin
  assert (select local_date from before_boundary_assignment) = date '2026-08-20';
  assert (select local_date from after_boundary_assignment) = date '2026-08-21';
end;
$$;

-- spring-forward
create temporary table spring_capture as
select * from public.capture_text_observation(
  'aaaaaaaa-0000-4000-8000-000000000102',
  'Spring event',
  timestamptz '2026-03-28 12:00:00+00',
  'Europe/Amsterdam'
);
create temporary table spring_assignment as
select * from public.assign_observation_operational_period(
  (select observation_id from spring_capture)
);

-- fall-back
create temporary table fall_capture as
select * from public.capture_text_observation(
  'aaaaaaaa-0000-4000-8000-000000000103',
  'Fall event',
  timestamptz '2026-10-24 12:00:00+00',
  'Europe/Amsterdam'
);
create temporary table fall_assignment as
select * from public.assign_observation_operational_period(
  (select observation_id from fall_capture)
);

do $$
begin
  assert (
    select extract(epoch from (ends_at - starts_at)) / 3600
    from public.operational_periods
    where id = (select operational_period_id from spring_assignment)
  ) = 23;
  assert (
    select extract(epoch from (ends_at - starts_at)) / 3600
    from public.operational_periods
    where id = (select operational_period_id from fall_assignment)
  ) = 25;
end;
$$;

-- spring-gap civil boundary: 02:30 normalizes to 03:30 local / 01:30Z
select set_config(
  'request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',
  true
);
create temporary table dst_boundary_setting as
select * from public.save_time_setting('Europe/Amsterdam', '02:30');

do $$
begin
  assert private.resolve_civil_boundary(
    date '2026-03-29',
    'Europe/Amsterdam',
    time '02:30'
  ) = timestamptz '2026-03-29 01:30:00+00';
  assert private.resolve_civil_boundary(
    date '2026-03-29',
    'Europe/Amsterdam',
    time '02:30'
  ) at time zone 'Europe/Amsterdam' = timestamp '2026-03-29 03:30:00';
end;
$$;

create temporary table gap_before_capture as
select * from public.capture_text_observation(
  'cccccccc-0000-4000-8000-000000000100',
  'Gap anchor before resolved boundary',
  timestamptz '2026-03-29 01:15:00+00',
  'Europe/Amsterdam'
);
create temporary table gap_before_assignment as
select * from public.assign_observation_operational_period(
  (select observation_id from gap_before_capture)
);
create temporary table gap_at_capture as
select * from public.capture_text_observation(
  'cccccccc-0000-4000-8000-000000000101',
  'Gap anchor at resolved boundary',
  timestamptz '2026-03-29 01:30:00+00',
  'Europe/Amsterdam'
);
create temporary table gap_at_assignment as
select * from public.assign_observation_operational_period(
  (select observation_id from gap_at_capture)
);
create temporary table gap_after_capture as
select * from public.capture_text_observation(
  'cccccccc-0000-4000-8000-000000000102',
  'Gap anchor after resolved boundary',
  timestamptz '2026-03-29 01:45:00+00',
  'Europe/Amsterdam'
);
create temporary table gap_after_assignment as
select * from public.assign_observation_operational_period(
  (select observation_id from gap_after_capture)
);

do $$
begin
  assert (select local_date from gap_before_assignment) = date '2026-03-28';
  assert (select local_date from gap_at_assignment) = date '2026-03-29';
  assert (select local_date from gap_after_assignment) = date '2026-03-29';
  assert (
    select starts_at
    from public.operational_periods
    where id = (select operational_period_id from gap_at_assignment)
  ) = timestamptz '2026-03-29 01:30:00+00';
end;
$$;

-- fall-fold civil boundary: two candidates exist and the earlier one wins
do $$
begin
  assert timestamptz '2026-10-25 00:30:00+00'
    at time zone 'Europe/Amsterdam' = timestamp '2026-10-25 02:30:00';
  assert timestamptz '2026-10-25 01:30:00+00'
    at time zone 'Europe/Amsterdam' = timestamp '2026-10-25 02:30:00';
  assert private.resolve_civil_boundary(
    date '2026-10-25',
    'Europe/Amsterdam',
    time '02:30'
  ) = timestamptz '2026-10-25 00:30:00+00';
end;
$$;

create temporary table fold_before_capture as
select * from public.capture_text_observation(
  'cccccccc-0000-4000-8000-000000000103',
  'Fold anchor before earlier boundary',
  timestamptz '2026-10-25 00:15:00+00',
  'Europe/Amsterdam'
);
create temporary table fold_before_assignment as
select * from public.assign_observation_operational_period(
  (select observation_id from fold_before_capture)
);
create temporary table fold_at_capture as
select * from public.capture_text_observation(
  'cccccccc-0000-4000-8000-000000000104',
  'Fold anchor at earlier boundary',
  timestamptz '2026-10-25 00:30:00+00',
  'Europe/Amsterdam'
);
create temporary table fold_at_assignment as
select * from public.assign_observation_operational_period(
  (select observation_id from fold_at_capture)
);
create temporary table fold_after_capture as
select * from public.capture_text_observation(
  'cccccccc-0000-4000-8000-000000000105',
  'Fold anchor after earlier boundary',
  timestamptz '2026-10-25 01:30:00+00',
  'Europe/Amsterdam'
);
create temporary table fold_after_assignment as
select * from public.assign_observation_operational_period(
  (select observation_id from fold_after_capture)
);

do $$
begin
  assert (select local_date from fold_before_assignment) = date '2026-10-24';
  assert (select local_date from fold_at_assignment) = date '2026-10-25';
  assert (select local_date from fold_after_assignment) = date '2026-10-25';
  assert (
    select starts_at
    from public.operational_periods
    where id = (select operational_period_id from fold_at_assignment)
  ) = timestamptz '2026-10-25 00:30:00+00';
end;
$$;

-- membership containment and retry remain authoritative and idempotent
create temporary table repeated_gap_assignment as
select * from public.assign_observation_operational_period(
  (select observation_id from gap_at_capture)
);
do $$
begin
  assert (select operational_period_id from repeated_gap_assignment) =
    (select operational_period_id from gap_at_assignment);
  assert not exists (
    select 1
    from public.observations as observation
    join public.observation_operational_period_memberships as membership
      on membership.world_id = observation.world_id
     and membership.observation_id = observation.id
    join public.operational_periods as period
      on period.world_id = membership.world_id
     and period.id = membership.operational_period_id
    where observation.world_id = (
      select id from public.worlds
      where initial_owner_id = '33333333-3333-4333-8333-333333333333'
    )
      and not (
        period.starts_at <= coalesce(observation.occurred_at, observation.recorded_at)
        and coalesce(observation.occurred_at, observation.recorded_at) < period.ends_at
      )
  );
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);

-- period creation is deterministic and idempotent
create temporary table repeated_assignment as
select * from public.assign_observation_operational_period(
  (select observation_id from before_boundary_capture)
);
do $$
begin
  assert (select operational_period_id from repeated_assignment) =
    (select operational_period_id from before_boundary_assignment);
  assert (
    select count(*)
    from public.observation_operational_period_memberships
    where observation_id = (select observation_id from before_boundary_capture)
  ) = 1;
end;
$$;

-- prospective boundary change
create temporary table changed_boundary as
select * from public.save_time_setting('Europe/Amsterdam', '05:00');
do $$
begin
  assert (select time_setting_id from changed_boundary) <>
    (select time_setting_id from initial_setting);
  assert (
    select operational_period_id from repeated_assignment
  ) = (
    select operational_period_id
    from public.observation_operational_period_memberships
    where observation_id = (select observation_id from before_boundary_capture)
  );
  assert not exists (
    select 1
    from public.time_settings first
    join public.time_settings second
      on first.world_id = second.world_id and first.id < second.id
    where tstzrange(first.effective_from, coalesce(first.effective_to, 'infinity'), '[)')
      && tstzrange(second.effective_from, coalesce(second.effective_to, 'infinity'), '[)')
  );
end;
$$;

-- prospective timezone change
create temporary table changed_timezone as
select * from public.save_time_setting('Europe/Helsinki', '05:00');
do $$
begin
  assert (select timezone_name from changed_timezone) = 'Europe/Helsinki';
  assert (
    select operational_period_id from repeated_assignment
  ) = (
    select operational_period_id
    from public.observation_operational_period_memberships
    where observation_id = (select observation_id from before_boundary_capture)
  );
end;
$$;

-- late observation uses the setting effective at event time
create temporary table late_capture as
select * from public.capture_text_observation(
  'aaaaaaaa-0000-4000-8000-000000000104',
  'Late historical evidence',
  timestamptz '2026-03-28 12:00:00+00',
  'Europe/Amsterdam'
);
create temporary table late_assignment as
select * from public.assign_observation_operational_period(
  (select observation_id from late_capture)
);
do $$
begin
  assert (
    select time_setting_id
    from public.operational_periods
    where id = (select operational_period_id from late_assignment)
  ) = (select time_setting_id from initial_setting);
end;
$$;

-- recorded time fallback and automatic current placement without Freeze
create temporary table fallback_capture as
select * from public.capture_text_observation(
  'aaaaaaaa-0000-4000-8000-000000000105',
  'Recorded time fallback'
);
create temporary table fallback_assignment as
select * from public.assign_observation_operational_period(
  (select observation_id from fallback_capture)
);
create temporary table current_period as
select * from public.get_current_operational_period();
do $$
begin
  assert (select assignment_state from fallback_assignment) = 'assigned';
  assert (select operational_period_id from fallback_assignment) =
    (select operational_period_id from current_period);
end;
$$;

-- explicit historical correction
select * from public.correct_observation_occurred_time(
  (select observation_id from before_boundary_capture),
  timestamptz '2026-08-22 03:30:00+00',
  'Europe/Amsterdam'
);
create temporary table correction_required as
select * from public.assign_observation_operational_period(
  (select observation_id from before_boundary_capture)
);
do $$
begin
  assert (select assignment_state from correction_required) = 'correction_required';
  assert (
    select count(*)
    from public.observation_operational_period_memberships
    where observation_id = (select observation_id from before_boundary_capture)
  ) = 1;
end;
$$;

create temporary table historical_correction as
select * from public.correct_observation_operational_period(
  (select observation_id from before_boundary_capture),
  'occurred_time_correction'
);
do $$
declare
  audit_metadata jsonb;
begin
  assert (
    select count(*)
    from public.observation_operational_period_memberships
    where observation_id = (select observation_id from before_boundary_capture)
  ) = 2;
  assert (
    select supersedes_membership_id
    from public.observation_operational_period_memberships
    where id = (select membership_id from historical_correction)
  ) = (select membership_id from before_boundary_assignment);
  select metadata into audit_metadata
  from public.audit_events
  where id = (select audit_event_id from historical_correction);
  assert audit_metadata ?& array[
    'prior_membership_id',
    'prior_operational_period_id',
    'successor_membership_id',
    'successor_operational_period_id',
    'reason_category'
  ];
  assert (
    audit_metadata - array[
      'prior_membership_id',
      'prior_operational_period_id',
      'successor_membership_id',
      'successor_operational_period_id',
      'reason_category'
    ]
  ) = '{}'::jsonb;
  assert audit_metadata::text not like '%Before four local%';
end;
$$;

-- strict audit allow-list
select pg_temp.expect_rejection(
  'strict audit allow-list',
  $$insert into public.audit_events (
      world_id, actor_kind, actor_account_id, action, entity_type, entity_id, metadata
    ) values (
      (select world_id from public.observations where id =
        (select observation_id from before_boundary_capture)),
      'user',
      '11111111-1111-4111-8111-111111111111',
      'observation_operational_period_corrected',
      'observation',
      (select observation_id from before_boundary_capture),
      '{"unexpected":"personal text"}'::jsonb
    )$$
);

-- assignment failure preserves evidence
select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);
create temporary table unconfigured_capture as
select * from public.capture_text_observation(
  'bbbbbbbb-0000-4000-8000-000000000100',
  'Evidence survives missing temporal setup'
);
select pg_temp.expect_rejection(
  'assignment failure preserves evidence',
  $$select * from public.assign_observation_operational_period(
    (select observation_id from unconfigured_capture)
  )$$
);
do $$
begin
  assert exists (
    select 1 from public.observations
    where id = (select observation_id from unconfigured_capture)
  );
end;
$$;

-- cross-world temporal isolation
select pg_temp.expect_rejection(
  'cross-world temporal isolation',
  $$select * from public.assign_observation_operational_period(
    (select observation_id from before_boundary_capture)
  )$$
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);
do $$
begin
  assert not exists (select 1 from public.time_settings);
  assert not exists (select 1 from public.operational_periods);
  assert not exists (
    select 1 from public.observation_operational_period_memberships
  );
end;
$$;
reset role;

-- generic temporal write denial
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
select pg_temp.expect_rejection(
  'generic temporal write denial',
  $$insert into public.time_settings (
    world_id, timezone_name, recorded_by_account_id
  ) values (
    (select id from public.worlds where initial_owner_id =
      '11111111-1111-4111-8111-111111111111'),
    'UTC',
    '11111111-1111-4111-8111-111111111111'
  )$$
);
reset role;

rollback;
