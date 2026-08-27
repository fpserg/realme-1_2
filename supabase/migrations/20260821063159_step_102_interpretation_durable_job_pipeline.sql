ALTER TABLE public.jobs
  ADD COLUMN observation_id uuid,
  ADD COLUMN lock_token uuid;

ALTER TABLE public.interpretation_runs
  ADD COLUMN job_id uuid,
  ADD COLUMN attempt_number integer;

ALTER TABLE public.candidate_claims
  ADD COLUMN job_id uuid,
  ADD COLUMN logical_key text;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.jobs)
     OR EXISTS (SELECT 1 FROM public.interpretation_runs)
     OR EXISTS (SELECT 1 FROM public.candidate_claims) THEN
    RAISE EXCEPTION 'Step 102 activation requires the previously dormant job and interpretation tables to be empty';
  END IF;
END;
$$;

ALTER TABLE public.jobs
  ALTER COLUMN observation_id SET NOT NULL,
  ADD CONSTRAINT jobs_world_id_id_unique UNIQUE (world_id, id),
  ADD CONSTRAINT jobs_world_id_observation_id_unique
    UNIQUE (world_id, id, observation_id),
  ADD CONSTRAINT jobs_observation_world_fk
    FOREIGN KEY (world_id, observation_id)
    REFERENCES public.observations (world_id, id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT jobs_step_102_kind_check
    CHECK (job_kind = 'interpret_observation'),
  ADD CONSTRAINT jobs_interpret_observation_input_check
    CHECK (
      observation_id IS NOT NULL
      AND payload ?& ARRAY['prompt_version', 'schema_version']
      AND (payload - ARRAY['prompt_version', 'schema_version']) = '{}'::jsonb
      AND jsonb_typeof(payload->'prompt_version') = 'string'
      AND jsonb_typeof(payload->'schema_version') = 'string'
      AND payload->>'prompt_version' = 'interpret-observation-v1'
      AND payload->>'schema_version' = 'candidate-set-v1'
    ),
  ADD CONSTRAINT jobs_last_failure_code_check
    CHECK (
      last_failure_code IS NULL OR last_failure_code IN (
        'provider_unavailable', 'timeout', 'malformed_output',
        'validation_failed', 'persistence_failed', 'configuration_error',
        'cancelled', 'exhausted'
      )
    ),
  ADD CONSTRAINT jobs_success_has_no_failure_check
    CHECK (status <> 'succeeded' OR last_failure_code IS NULL);

ALTER TABLE public.jobs DROP CONSTRAINT jobs_queued_state_check;
ALTER TABLE public.jobs DROP CONSTRAINT jobs_running_state_check;
ALTER TABLE public.jobs DROP CONSTRAINT jobs_non_running_unlocked_check;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_queued_state_check
    CHECK (
      status <> 'queued'
      OR (
        attempts < max_attempts
        AND locked_at IS NULL
        AND lock_token IS NULL
      )
    ),
  ADD CONSTRAINT jobs_running_state_check
    CHECK (
      status <> 'running'
      OR (
        locked_at IS NOT NULL
        AND lock_token IS NOT NULL
        AND attempts >= 1
      )
    ),
  ADD CONSTRAINT jobs_non_running_unlocked_check
    CHECK (
      status = 'running'
      OR (locked_at IS NULL AND lock_token IS NULL)
    );

CREATE INDEX jobs_observation_id_index
  ON public.jobs (observation_id);

ALTER TABLE public.interpretation_runs
  ALTER COLUMN job_id SET NOT NULL,
  ALTER COLUMN attempt_number SET NOT NULL,
  ALTER COLUMN provider SET NOT NULL,
  ALTER COLUMN model SET NOT NULL,
  ADD CONSTRAINT interpretation_runs_world_id_job_id_unique
    UNIQUE (world_id, id, job_id),
  ADD CONSTRAINT interpretation_runs_job_observation_world_fk
    FOREIGN KEY (world_id, job_id, observation_id)
    REFERENCES public.jobs (world_id, id, observation_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT interpretation_runs_job_attempt_unique
    UNIQUE (job_id, attempt_number),
  ADD CONSTRAINT interpretation_runs_attempt_number_check
    CHECK (attempt_number > 0),
  ADD CONSTRAINT interpretation_runs_provider_model_check
    CHECK (length(btrim(provider)) > 0 AND length(btrim(model)) > 0),
  ADD CONSTRAINT interpretation_runs_failure_code_check
    CHECK (
      failure_code IS NULL OR failure_code IN (
        'provider_unavailable', 'timeout', 'malformed_output',
        'validation_failed', 'persistence_failed', 'configuration_error',
        'cancelled', 'exhausted'
      )
    ),
  ADD CONSTRAINT interpretation_runs_state_coherence_check
    CHECK (
      (
        status = 'running' AND started_at IS NOT NULL
        AND completed_at IS NULL AND failure_code IS NULL
      ) OR (
        status = 'succeeded' AND started_at IS NOT NULL
        AND completed_at IS NOT NULL AND failure_code IS NULL
      ) OR (
        status = 'failed' AND started_at IS NOT NULL
        AND completed_at IS NOT NULL AND failure_code IS NOT NULL
      ) OR status IN ('pending', 'cancelled')
    );

CREATE UNIQUE INDEX interpretation_runs_one_success_per_job_unique
  ON public.interpretation_runs (job_id)
  WHERE status = 'succeeded';

ALTER TABLE public.candidate_claims
  ALTER COLUMN job_id SET NOT NULL,
  ALTER COLUMN logical_key SET NOT NULL,
  ADD CONSTRAINT candidate_claims_job_world_fk
    FOREIGN KEY (world_id, job_id)
    REFERENCES public.jobs (world_id, id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT candidate_claims_interpretation_run_job_world_fk
    FOREIGN KEY (world_id, interpretation_run_id, job_id)
    REFERENCES public.interpretation_runs (world_id, id, job_id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT candidate_claims_job_logical_key_unique
    UNIQUE (job_id, logical_key),
  ADD CONSTRAINT candidate_claims_step_102_kind_check
    CHECK (claim_kind = 'proposition'),
  ADD CONSTRAINT candidate_claims_logical_key_not_blank
    CHECK (length(btrim(logical_key)) > 0),
  ADD CONSTRAINT candidate_claims_step_102_payload_check
    CHECK (
      payload ?& ARRAY[
        'subject', 'predicate', 'object', 'explanation',
        'confidence', 'schema_version'
      ]
      AND (
        payload - ARRAY[
          'subject', 'predicate', 'object', 'explanation',
          'confidence', 'schema_version'
        ]
      ) = '{}'::jsonb
      AND jsonb_typeof(payload->'subject') = 'string'
      AND length(payload->>'subject') BETWEEN 1 AND 160
      AND jsonb_typeof(payload->'predicate') = 'string'
      AND payload->>'predicate' ~ '^[a-z][a-z0-9_]*$'
      AND length(payload->>'predicate') <= 64
      AND jsonb_typeof(payload->'object') IN ('string', 'number', 'boolean')
      AND (jsonb_typeof(payload->'object') <> 'string' OR length(payload->>'object') <= 500)
      AND jsonb_typeof(payload->'explanation') = 'string'
      AND length(payload->>'explanation') BETWEEN 1 AND 500
      AND jsonb_typeof(payload->'confidence') = 'number'
      AND (payload->>'confidence')::numeric BETWEEN 0 AND 1
      AND payload->>'schema_version' = 'candidate-set-v1'
    );

CREATE INDEX candidate_claims_job_id_index
  ON public.candidate_claims (job_id);

CREATE OR REPLACE FUNCTION public.enqueue_observation_interpretation(
  p_observation_id uuid
)
RETURNS TABLE (
  job_id uuid,
  job_status text,
  was_created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_world_id uuid;
  v_job_id uuid;
  v_status text;
  v_was_created boolean := false;
  v_idempotency_key text;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT observation.world_id
  INTO v_world_id
  FROM public.observations AS observation
  JOIN public.world_memberships AS membership
    ON membership.world_id = observation.world_id
   AND membership.user_id = v_actor_id
  WHERE observation.id = p_observation_id
    AND observation.recorded_by_account_id = v_actor_id;

  IF v_world_id IS NULL THEN
    RAISE EXCEPTION 'observation unavailable' USING ERRCODE = '42501';
  END IF;

  v_idempotency_key := format(
    'observation:%s:prompt:%s:schema:%s',
    p_observation_id,
    'interpret-observation-v1',
    'candidate-set-v1'
  );

  INSERT INTO public.jobs (
    world_id,
    observation_id,
    job_kind,
    idempotency_key,
    status,
    payload
  ) VALUES (
    v_world_id,
    p_observation_id,
    'interpret_observation',
    v_idempotency_key,
    'queued',
    jsonb_build_object(
      'prompt_version', 'interpret-observation-v1',
      'schema_version', 'candidate-set-v1'
    )
  )
  ON CONFLICT (world_id, job_kind, idempotency_key) DO NOTHING
  RETURNING id, status INTO v_job_id, v_status;

  IF v_job_id IS NOT NULL THEN
    v_was_created := true;
  ELSE
    SELECT job.id, job.status
    INTO v_job_id, v_status
    FROM public.jobs AS job
    WHERE job.world_id = v_world_id
      AND job.job_kind = 'interpret_observation'
      AND job.idempotency_key = v_idempotency_key
      AND job.observation_id = p_observation_id;
  END IF;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'interpretation job unavailable';
  END IF;

  RETURN QUERY SELECT v_job_id, v_status, v_was_created;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_observation_interpretation(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_observation_interpretation(uuid)
  TO authenticated;

COMMENT ON TABLE public.jobs IS
  'Durable hidden Step 102 interpretation jobs with atomic claims and bounded retry.';
COMMENT ON TABLE public.interpretation_runs IS
  'Non-canonical model execution attempts with immutable provider, model, prompt, schema and input-hash provenance.';
COMMENT ON TABLE public.candidate_claims IS
  'Hidden non-canonical validated interpretation candidates; creation is not admission.';
