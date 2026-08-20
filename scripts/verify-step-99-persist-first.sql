begin;

insert into auth.users (id)
values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

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

create or replace function pg_temp.fail_selected_fragment()
returns trigger
language plpgsql
as $$
begin
  if new.exact_text = 'FORCE_FRAGMENT_FAILURE' then
    raise exception 'synthetic source-fragment failure';
  end if;
  return new;
end;
$$;

-- unauthenticated capture
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect_rejection(
  'unauthenticated capture',
  $$select * from public.capture_text_observation(
    '00000000-0000-4000-8000-000000000001', 'must not persist'
  )$$
);

select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);

create temporary table captured_without_occurrence as
select *
from public.capture_text_observation(
  'aaaaaaaa-0000-4000-8000-000000000001',
  E'  Exact text survives.\n'
);

do $$
declare
  captured record;
  fragment_text text;
begin
  select * into captured from captured_without_occurrence;
  select exact_text into fragment_text
  from public.source_fragments
  where observation_id = captured.observation_id and ordinal = 0;

  assert captured.occurred_at is null;
  assert captured.occurred_precision = 'unknown';
  assert captured.recorded_at <= clock_timestamp();
  assert fragment_text = E'  Exact text survives.\n';
end;
$$;

create temporary table captured_with_occurrence as
select *
from public.capture_text_observation(
  'aaaaaaaa-0000-4000-8000-000000000002',
  'Occurred-time evidence',
  timestamptz '2026-08-20 08:15:00+00',
  'Europe/Helsinki'
);

do $$
declare
  captured record;
begin
  select * into captured from captured_with_occurrence;
  assert captured.occurred_at = timestamptz '2026-08-20 08:15:00+00';
  assert captured.occurred_precision = 'exact';
  assert captured.local_calendar_date = date '2026-08-20';
end;
$$;

-- duplicate delivery
create temporary table captured_retry as
select *
from public.capture_text_observation(
  'aaaaaaaa-0000-4000-8000-000000000001',
  E'  Exact text survives.\n'
);

do $$
declare
  original record;
  retry record;
begin
  select * into original from captured_without_occurrence;
  select * into retry from captured_retry;
  assert retry.observation_id = original.observation_id;
  assert retry.recorded_at = original.recorded_at;
  assert retry.was_created = false;
  assert (
    select count(*) from public.observations
    where capture_idempotency_key =
      'aaaaaaaa-0000-4000-8000-000000000001'
  ) = 1;
end;
$$;

select pg_temp.expect_rejection(
  'idempotency payload mismatch',
  $$select * from public.capture_text_observation(
    'aaaaaaaa-0000-4000-8000-000000000001', 'different text'
  )$$
);

-- transaction rollback
create trigger step_99_force_fragment_failure
before insert on public.source_fragments
for each row execute function pg_temp.fail_selected_fragment();

select pg_temp.expect_rejection(
  'transaction rollback',
  $$select * from public.capture_text_observation(
    'aaaaaaaa-0000-4000-8000-000000000003', 'FORCE_FRAGMENT_FAILURE'
  )$$
);

drop trigger step_99_force_fragment_failure on public.source_fragments;

do $$
begin
  assert not exists (
    select 1 from public.observations
    where capture_idempotency_key =
      'aaaaaaaa-0000-4000-8000-000000000003'
  );
end;
$$;

-- downstream failure
do $$
declare
  saved_id uuid;
begin
  select observation_id into saved_id
  from public.capture_text_observation(
    'aaaaaaaa-0000-4000-8000-000000000004',
    'Saved before downstream work'
  );

  begin
    insert into public.interpretation_runs (
      world_id, observation_id, prompt_version, schema_version, input_hash
    ) values (
      (select world_id from public.observations where id = saved_id),
      saved_id,
      '',
      '',
      ''
    );
  exception
    when check_violation then
      null;
  end;

  assert exists (select 1 from public.observations where id = saved_id);
  assert exists (
    select 1 from public.source_fragments where observation_id = saved_id
  );
end;
$$;

-- append-only correction
create temporary table first_correction as
select *
from public.correct_observation_occurred_time(
  (select observation_id from captured_with_occurrence),
  timestamptz '2026-08-20 09:30:00+00',
  'Europe/Helsinki'
);

create temporary table second_correction as
select *
from public.correct_observation_occurred_time(
  (select observation_id from captured_with_occurrence),
  timestamptz '2026-08-20 10:45:00+00',
  'Europe/Helsinki'
);

do $$
declare
  observation_id_value uuid;
  first_id uuid;
  second_id uuid;
begin
  select observation_id into observation_id_value from captured_with_occurrence;
  select correction_id into first_id from first_correction;
  select correction_id into second_id from second_correction;

  assert (
    select occurred_at from public.observations where id = observation_id_value
  ) = timestamptz '2026-08-20 08:15:00+00';
  assert (
    select count(*) from public.observation_corrections
    where observation_id = observation_id_value
  ) = 2;
  assert (
    select supersedes_correction_id
    from public.observation_corrections where id = second_id
  ) = first_id;
end;
$$;

-- direct observation write
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
select pg_temp.expect_rejection(
  'direct observation write',
  $$insert into public.observations
    (world_id, recorded_by_account_id, source_kind)
    values (
      (select id from public.worlds limit 1),
      '11111111-1111-4111-8111-111111111111',
      'forbidden'
    )$$
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);
create temporary table other_world_capture as
select *
from public.capture_text_observation(
  'bbbbbbbb-0000-4000-8000-000000000001',
  'Other World evidence'
);

-- cross-world read isolation
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
do $$
begin
  assert not exists (
    select 1
    from public.observations
    where capture_idempotency_key =
      'bbbbbbbb-0000-4000-8000-000000000001'
  );
end;
$$;
reset role;

rollback;
