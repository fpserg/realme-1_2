begin;

insert into auth.users (id)
values
  ('71111111-1111-4111-8111-111111111111'),
  ('72222222-2222-4222-8222-222222222222');

-- stale final attempt
select set_config(
  'request.jwt.claim.sub',
  '71111111-1111-4111-8111-111111111111',
  true
);
create temporary table step_102_final_capture as
select * from public.capture_text_observation(
  '7aaaaaaa-0000-4000-8000-000000000001',
  'Synthetic abandoned final Step 102 attempt'
);
create temporary table step_102_final_enqueue as
select * from public.enqueue_observation_interpretation(
  (select observation_id from step_102_final_capture)
);

update public.jobs
set status = 'running',
    attempts = max_attempts,
    locked_at = clock_timestamp() - interval '6 minutes',
    lock_token = '73333333-3333-4333-8333-333333333333'
where id = (select job_id from step_102_final_enqueue);

insert into public.interpretation_runs (
  world_id, job_id, observation_id, attempt_number, status,
  provider, model, prompt_version, schema_version, input_hash, started_at
)
select world_id, id, observation_id, attempts, 'running',
       'fixture', 'fixture-model', 'interpret-observation-v1',
       'candidate-set-v1', repeat('7', 64),
       clock_timestamp() - interval '6 minutes'
from public.jobs
where id = (select job_id from step_102_final_enqueue);

create temporary table step_102_final_recovery as
select public.terminalize_stale_final_interpretation_job() as job_id;
create temporary table step_102_final_replay as
select public.terminalize_stale_final_interpretation_job() as job_id;

do $$
begin
  assert (select job_id from step_102_final_recovery) =
    (select job_id from step_102_final_enqueue);
  assert (select job_id from step_102_final_replay) is null;
  assert (
    select status = 'failed'
      and attempts = max_attempts
      and locked_at is null
      and lock_token is null
      and last_failure_code = 'exhausted'
    from public.jobs
    where id = (select job_id from step_102_final_enqueue)
  );
  assert (
    select count(*)
    from public.interpretation_runs
    where job_id = (select job_id from step_102_final_enqueue)
  ) = 1;
  assert (
    select status = 'failed'
      and completed_at is not null
      and failure_code = 'timeout'
    from public.interpretation_runs
    where job_id = (select job_id from step_102_final_enqueue)
  );
end;
$$;

-- reconciliation beyond newest 50
create temporary table step_102_reconciliation_observations (
  ordinal integer primary key,
  observation_id uuid not null unique
);

do $$
declare
  item integer;
begin
  for item in 1..61 loop
    insert into step_102_reconciliation_observations
      (ordinal, observation_id)
    select item, observation_id
    from public.capture_text_observation(
      (
        '7bbbbbbb-1000-4000-8000-' ||
        lpad(item::text, 12, '0')
      )::uuid,
      format('Synthetic reconciliation observation %s', item)
    );
  end loop;
end;
$$;

do $$
declare
  item record;
begin
  for item in
    select observation_id
    from step_102_reconciliation_observations
    where ordinal > 1
    order by ordinal
  loop
    perform *
    from public.enqueue_observation_interpretation(item.observation_id);
  end loop;
end;
$$;

create temporary table step_102_reconciliation_first as
select public.reconcile_observation_interpretations() as processed;
create temporary table step_102_reconciliation_replay as
select public.reconcile_observation_interpretations() as processed;

do $$
begin
  assert (select processed from step_102_reconciliation_first) = 1;
  assert (select processed from step_102_reconciliation_replay) = 0;
  assert (
    select count(*)
    from public.jobs
    where observation_id = (
      select observation_id
      from step_102_reconciliation_observations
      where ordinal = 1
    )
  ) = 1;
  assert (
    select count(*)
    from public.jobs
    where observation_id in (
      select observation_id from step_102_reconciliation_observations
    )
  ) = 61;
end;
$$;

-- more than 50 missing jobs make progress
select set_config(
  'request.jwt.claim.sub',
  '72222222-2222-4222-8222-222222222222',
  true
);
create temporary table step_102_missing_observations (
  ordinal integer primary key,
  observation_id uuid not null unique
);

do $$
declare
  item integer;
begin
  for item in 1..61 loop
    insert into step_102_missing_observations (ordinal, observation_id)
    select item, observation_id
    from public.capture_text_observation(
      (
        '7ccccccc-2000-4000-8000-' ||
        lpad(item::text, 12, '0')
      )::uuid,
      format('Synthetic missing interpretation job %s', item)
    );
  end loop;
end;
$$;

create temporary table step_102_missing_first as
select public.reconcile_observation_interpretations() as processed;
create temporary table step_102_missing_second as
select public.reconcile_observation_interpretations() as processed;
create temporary table step_102_missing_replay as
select public.reconcile_observation_interpretations() as processed;

do $$
begin
  assert (select processed from step_102_missing_first) = 50;
  assert (select processed from step_102_missing_second) = 11;
  assert (select processed from step_102_missing_replay) = 0;
  assert (
    select count(*)
    from public.jobs
    where observation_id in (
      select observation_id from step_102_missing_observations
    )
  ) = 61;
  assert not exists (
    select 1
    from public.jobs
    where attempts > max_attempts
  );
end;
$$;

rollback;
