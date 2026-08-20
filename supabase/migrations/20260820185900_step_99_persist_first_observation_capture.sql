ALTER TABLE public.observation_corrections
  DROP CONSTRAINT observation_corrections_supersedes_correction_id_observation_corrections_id_fk;
--> statement-breakpoint
ALTER TABLE public.observation_corrections
  DROP CONSTRAINT observation_corrections_supersedes_world_fk;
--> statement-breakpoint
ALTER TABLE public.observations
  ADD COLUMN capture_idempotency_key uuid;
--> statement-breakpoint
ALTER TABLE public.observation_corrections
  ADD CONSTRAINT observation_corrections_world_observation_id_unique
  UNIQUE (world_id, observation_id, id);
--> statement-breakpoint
ALTER TABLE public.observation_corrections
  ADD CONSTRAINT observation_corrections_supersedes_observation_world_fk
  FOREIGN KEY (world_id, observation_id, supersedes_correction_id)
  REFERENCES public.observation_corrections (world_id, observation_id, id)
  ON DELETE RESTRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX observation_corrections_root_unique
  ON public.observation_corrections (world_id, observation_id)
  WHERE supersedes_correction_id IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX observation_corrections_successor_unique
  ON public.observation_corrections (supersedes_correction_id)
  WHERE supersedes_correction_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX observations_world_capture_idempotency_unique
  ON public.observations (world_id, capture_idempotency_key)
  WHERE capture_idempotency_key IS NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.capture_text_observation(
  p_idempotency_key uuid,
  p_exact_text text,
  p_occurred_at timestamptz DEFAULT NULL,
  p_source_timezone text DEFAULT NULL
)
RETURNS TABLE (
  observation_id uuid,
  recorded_at timestamptz,
  occurred_at timestamptz,
  occurred_precision text,
  source_timezone text,
  local_calendar_date date,
  was_created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_world_id uuid;
  v_observation_id uuid;
  v_recorded_at timestamptz;
  v_occurred_precision text;
  v_local_calendar_date date;
  v_existing_text text;
  v_existing_occurred_at timestamptz;
  v_existing_source_timezone text;
  v_created boolean := false;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Idempotency key is required.' USING ERRCODE = '22023';
  END IF;

  IF p_exact_text IS NULL
    OR length(btrim(p_exact_text)) = 0
    OR length(p_exact_text) > 10000
  THEN
    RAISE EXCEPTION 'Observation text must contain 1 to 10000 characters.'
      USING ERRCODE = '22023';
  END IF;

  IF p_occurred_at IS NULL AND p_source_timezone IS NOT NULL THEN
    RAISE EXCEPTION 'A source timezone requires an occurred time.'
      USING ERRCODE = '22023';
  END IF;

  IF p_source_timezone IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_timezone_names
      WHERE name = p_source_timezone
    )
  THEN
    RAISE EXCEPTION 'Source timezone is invalid.' USING ERRCODE = '22023';
  END IF;

  SELECT world.id
  INTO v_world_id
  FROM public.worlds AS world
  JOIN public.world_memberships AS membership
    ON membership.world_id = world.id
   AND membership.user_id = v_actor_id
   AND membership.role = 'owner'
  WHERE world.initial_owner_id = v_actor_id;

  IF v_world_id IS NULL THEN
    RAISE EXCEPTION 'The authenticated account has no writable World.'
      USING ERRCODE = '42501';
  END IF;

  v_occurred_precision := CASE
    WHEN p_occurred_at IS NULL THEN 'unknown'
    ELSE 'exact'
  END;
  v_local_calendar_date := CASE
    WHEN p_occurred_at IS NULL THEN NULL
    ELSE (p_occurred_at AT TIME ZONE COALESCE(p_source_timezone, 'UTC'))::date
  END;

  INSERT INTO public.observations (
    world_id,
    recorded_by_account_id,
    source_kind,
    source_timezone,
    occurred_at,
    occurred_precision,
    local_calendar_date,
    capture_idempotency_key
  )
  VALUES (
    v_world_id,
    v_actor_id,
    'direct_text_capture',
    p_source_timezone,
    p_occurred_at,
    v_occurred_precision,
    v_local_calendar_date,
    p_idempotency_key
  )
  ON CONFLICT (world_id, capture_idempotency_key)
    WHERE capture_idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING id, observations.recorded_at
  INTO v_observation_id, v_recorded_at;

  IF v_observation_id IS NOT NULL THEN
    v_created := true;

    INSERT INTO public.source_fragments (
      world_id,
      observation_id,
      ordinal,
      exact_text,
      content_hash
    )
    VALUES (
      v_world_id,
      v_observation_id,
      0,
      p_exact_text,
      encode(
        extensions.digest(pg_catalog.convert_to(p_exact_text, 'UTF8'), 'sha256'),
        'hex'
      )
    );
  ELSE
    SELECT
      observation.id,
      observation.recorded_at,
      observation.occurred_at,
      observation.source_timezone,
      fragment.exact_text
    INTO
      v_observation_id,
      v_recorded_at,
      v_existing_occurred_at,
      v_existing_source_timezone,
      v_existing_text
    FROM public.observations AS observation
    JOIN public.source_fragments AS fragment
      ON fragment.world_id = observation.world_id
     AND fragment.observation_id = observation.id
     AND fragment.ordinal = 0
    WHERE observation.world_id = v_world_id
      AND observation.capture_idempotency_key = p_idempotency_key;

    IF v_observation_id IS NULL THEN
      RAISE EXCEPTION 'Idempotent capture could not be resolved.';
    END IF;

    IF v_existing_text IS DISTINCT FROM p_exact_text
      OR v_existing_occurred_at IS DISTINCT FROM p_occurred_at
      OR v_existing_source_timezone IS DISTINCT FROM p_source_timezone
    THEN
      RAISE EXCEPTION 'Idempotency key was already used for another capture.'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    v_observation_id,
    v_recorded_at,
    p_occurred_at,
    v_occurred_precision,
    p_source_timezone,
    v_local_calendar_date,
    v_created;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.correct_observation_occurred_time(
  p_observation_id uuid,
  p_occurred_at timestamptz,
  p_source_timezone text DEFAULT NULL
)
RETURNS TABLE (
  correction_id uuid,
  observation_id uuid,
  occurred_at timestamptz,
  occurred_precision text,
  source_timezone text,
  local_calendar_date date,
  recorded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_world_id uuid;
  v_supersedes_correction_id uuid;
  v_correction_id uuid;
  v_recorded_at timestamptz;
  v_local_calendar_date date;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_observation_id IS NULL OR p_occurred_at IS NULL THEN
    RAISE EXCEPTION 'Observation and occurred time are required.'
      USING ERRCODE = '22023';
  END IF;

  IF p_source_timezone IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_timezone_names
      WHERE name = p_source_timezone
    )
  THEN
    RAISE EXCEPTION 'Source timezone is invalid.' USING ERRCODE = '22023';
  END IF;

  SELECT world.id
  INTO v_world_id
  FROM public.worlds AS world
  JOIN public.world_memberships AS membership
    ON membership.world_id = world.id
   AND membership.user_id = v_actor_id
   AND membership.role = 'owner'
  WHERE world.initial_owner_id = v_actor_id;

  IF v_world_id IS NULL THEN
    RAISE EXCEPTION 'The authenticated account has no writable World.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.observations AS observation
  WHERE observation.world_id = v_world_id
    AND observation.id = p_observation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Observation is not available in this World.'
      USING ERRCODE = '42501';
  END IF;

  SELECT correction.id
  INTO v_supersedes_correction_id
  FROM public.observation_corrections AS correction
  WHERE correction.world_id = v_world_id
    AND correction.observation_id = p_observation_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.observation_corrections AS successor
      WHERE successor.supersedes_correction_id = correction.id
    )
  ORDER BY correction.recorded_at DESC, correction.id DESC
  LIMIT 1;

  v_local_calendar_date :=
    (p_occurred_at AT TIME ZONE COALESCE(p_source_timezone, 'UTC'))::date;

  INSERT INTO public.observation_corrections (
    world_id,
    observation_id,
    corrected_occurred_at,
    corrected_occurred_precision,
    corrected_source_timezone,
    corrected_local_calendar_date,
    rationale,
    recorded_by_account_id,
    supersedes_correction_id
  )
  VALUES (
    v_world_id,
    p_observation_id,
    p_occurred_at,
    'exact',
    p_source_timezone,
    v_local_calendar_date,
    'User corrected occurred time.',
    v_actor_id,
    v_supersedes_correction_id
  )
  RETURNING id, observation_corrections.recorded_at
  INTO v_correction_id, v_recorded_at;

  RETURN QUERY
  SELECT
    v_correction_id,
    p_observation_id,
    p_occurred_at,
    'exact'::text,
    p_source_timezone,
    v_local_calendar_date,
    v_recorded_at;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.capture_text_observation(uuid, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.capture_text_observation(uuid, text, timestamptz, text)
  TO authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.correct_observation_occurred_time(uuid, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.correct_observation_occurred_time(uuid, timestamptz, text)
  TO authenticated;
--> statement-breakpoint
COMMENT ON COLUMN public.observations.capture_idempotency_key IS
  'Step 99 retry identity. It is scoped to a World and never substitutes for job idempotency.';
--> statement-breakpoint
COMMENT ON FUNCTION public.capture_text_observation(uuid, text, timestamptz, text) IS
  'Authenticated persist-first text capture. Derives actor and World, then atomically creates exact evidence.';
--> statement-breakpoint
COMMENT ON FUNCTION public.correct_observation_occurred_time(uuid, timestamptz, text) IS
  'Authenticated append-only occurred-time correction. Original evidence and recorded time remain unchanged.';
