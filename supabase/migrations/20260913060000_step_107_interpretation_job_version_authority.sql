ALTER TABLE public.jobs
  DROP CONSTRAINT jobs_interpret_observation_input_check;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_interpret_observation_input_check
  CHECK (
    observation_id IS NOT NULL
    AND payload ?& ARRAY['prompt_version', 'schema_version']
    AND (payload - ARRAY['prompt_version', 'schema_version']) = '{}'::jsonb
    AND jsonb_typeof(payload->'prompt_version') = 'string'
    AND jsonb_typeof(payload->'schema_version') = 'string'
    AND payload->>'prompt_version' IN (
      'interpret-observation-v1',
      'interpret-observation-v2'
    )
    AND payload->>'schema_version' = 'candidate-set-v1'
  );

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
    'interpret-observation-v2',
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
      'prompt_version', 'interpret-observation-v2',
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

CREATE OR REPLACE FUNCTION public.reconcile_observation_interpretations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_observation_id uuid;
  v_processed integer := 0;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  FOR v_observation_id IN
    SELECT observation.id
    FROM public.observations AS observation
    WHERE observation.recorded_by_account_id = v_actor_id
      AND EXISTS (
        SELECT 1
        FROM public.world_memberships AS membership
        WHERE membership.world_id = observation.world_id
          AND membership.user_id = v_actor_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.jobs AS successful_job
        WHERE successful_job.world_id = observation.world_id
          AND successful_job.observation_id = observation.id
          AND successful_job.job_kind = 'interpret_observation'
          AND successful_job.status = 'succeeded'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.jobs AS active_job
        WHERE active_job.world_id = observation.world_id
          AND active_job.observation_id = observation.id
          AND active_job.job_kind = 'interpret_observation'
          AND active_job.status IN ('queued', 'running')
          AND active_job.payload->>'prompt_version' = 'interpret-observation-v2'
          AND active_job.payload->>'schema_version' = 'candidate-set-v1'
      )
    ORDER BY observation.recorded_at, observation.id
    FOR UPDATE OF observation SKIP LOCKED
    LIMIT 50
  LOOP
    PERFORM *
    FROM public.enqueue_observation_interpretation(v_observation_id);
    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_observation_interpretations()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_observation_interpretations()
  TO authenticated;

COMMENT ON FUNCTION public.reconcile_observation_interpretations() IS
  'Authenticated bounded oldest-missing repair: enqueue the active interpretation version only when no successful interpretation exists and no queued/running active-version job already exists.';
