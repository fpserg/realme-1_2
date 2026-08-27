CREATE OR REPLACE FUNCTION public.terminalize_stale_final_interpretation_job()
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_job_id uuid;
  v_attempts integer;
BEGIN
  SELECT job.id, job.attempts
  INTO v_job_id, v_attempts
  FROM public.jobs AS job
  WHERE job.job_kind = 'interpret_observation'
    AND job.status = 'running'
    AND job.attempts >= job.max_attempts
    AND job.locked_at < clock_timestamp() - interval '5 minutes'
  ORDER BY job.locked_at, job.created_at, job.id
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_job_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.interpretation_runs
  SET status = 'failed',
      completed_at = clock_timestamp(),
      failure_code = 'timeout'
  WHERE job_id = v_job_id
    AND attempt_number = v_attempts
    AND status = 'running';

  UPDATE public.jobs
  SET status = 'failed',
      locked_at = NULL,
      lock_token = NULL,
      last_failure_code = 'exhausted',
      updated_at = clock_timestamp()
  WHERE id = v_job_id
    AND status = 'running'
    AND attempts >= max_attempts;

  RETURN v_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.terminalize_stale_final_interpretation_job()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.terminalize_stale_final_interpretation_job() IS
  'Server-only atomic recovery for an abandoned final Step 102 worker attempt.';

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
        FROM public.jobs AS job
        WHERE job.world_id = observation.world_id
          AND job.observation_id = observation.id
          AND job.job_kind = 'interpret_observation'
          AND job.idempotency_key = format(
            'observation:%s:prompt:%s:schema:%s',
            observation.id,
            'interpret-observation-v1',
            'candidate-set-v1'
          )
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
  'Authenticated bounded oldest-missing repair for Step 102 interpretation jobs.';
