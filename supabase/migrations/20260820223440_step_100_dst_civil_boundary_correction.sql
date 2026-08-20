CREATE OR REPLACE FUNCTION private.resolve_civil_boundary(
  p_local_date date,
  p_timezone text,
  p_boundary time
)
RETURNS timestamptz
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_local timestamp := p_local_date + p_boundary;
  v_probe timestamptz;
  v_before_probe timestamptz;
  v_after_probe timestamptz;
  v_before_offset interval;
  v_after_offset interval;
  v_before_candidate timestamptz;
  v_after_candidate timestamptz;
  v_before_matches boolean;
  v_after_matches boolean;
  v_gap interval;
  v_resolved_local timestamp;
  v_resolved_candidate timestamptz;
BEGIN
  IF p_timezone IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_timezone_names
      WHERE name = p_timezone
    )
  THEN
    RAISE EXCEPTION 'Timezone must be a valid IANA timezone.'
      USING ERRCODE = '22023';
  END IF;

  IF p_local_date IS NULL OR p_boundary IS NULL THEN
    RAISE EXCEPTION 'A local date and civil boundary are required.'
      USING ERRCODE = '22023';
  END IF;

  -- PostgreSQL's implicit conversion is used only as a nearby physical probe.
  -- Candidate selection and gap/fold policy are validated explicitly below.
  v_probe := v_local AT TIME ZONE p_timezone;
  v_before_probe := v_probe - interval '3 days';
  v_after_probe := v_probe + interval '3 days';
  v_before_offset :=
    (v_before_probe AT TIME ZONE p_timezone)
    - (v_before_probe AT TIME ZONE 'UTC');
  v_after_offset :=
    (v_after_probe AT TIME ZONE p_timezone)
    - (v_after_probe AT TIME ZONE 'UTC');

  v_before_candidate :=
    (v_local - v_before_offset) AT TIME ZONE 'UTC';
  v_after_candidate :=
    (v_local - v_after_offset) AT TIME ZONE 'UTC';
  v_before_matches :=
    (v_before_candidate AT TIME ZONE p_timezone) = v_local;
  v_after_matches :=
    (v_after_candidate AT TIME ZONE p_timezone) = v_local;

  IF v_before_matches AND v_after_matches THEN
    -- A fold has two physical candidates. Choose the earlier instant.
    RETURN least(v_before_candidate, v_after_candidate);
  ELSIF v_before_matches THEN
    RETURN v_before_candidate;
  ELSIF v_after_matches THEN
    RETURN v_after_candidate;
  END IF;

  -- A gap has no exact candidate. Move the local value forward by the gap,
  -- preserving the wall-clock position within it, and use the post-gap offset.
  v_gap := v_after_offset - v_before_offset;
  IF v_gap <= interval '0 seconds' THEN
    RAISE EXCEPTION 'The local civil boundary cannot be resolved.'
      USING ERRCODE = '22023';
  END IF;

  v_resolved_local := v_local + v_gap;
  v_resolved_candidate :=
    (v_resolved_local - v_after_offset) AT TIME ZONE 'UTC';

  IF (v_resolved_candidate AT TIME ZONE p_timezone) <> v_resolved_local THEN
    RAISE EXCEPTION 'The local civil boundary cannot be normalized through its gap.'
      USING ERRCODE = '22023';
  END IF;

  RETURN v_resolved_candidate;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.resolve_civil_boundary(date, text, time)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
COMMENT ON FUNCTION private.resolve_civil_boundary(date, text, time) IS
  'Resolves a local operational boundary explicitly: gaps move forward by the gap and folds choose the earlier physical occurrence.';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.ensure_operational_period(
  p_world_id uuid,
  p_time_setting_id uuid,
  p_local_date date
)
RETURNS TABLE (
  operational_period_id uuid,
  local_date date,
  starts_at timestamptz,
  ends_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_timezone text;
  v_boundary time;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
BEGIN
  SELECT setting.timezone_name, setting.operational_day_boundary
  INTO v_timezone, v_boundary
  FROM public.time_settings AS setting
  WHERE setting.world_id = p_world_id
    AND setting.id = p_time_setting_id;

  IF v_timezone IS NULL THEN
    RAISE EXCEPTION 'Time-setting version is unavailable.'
      USING ERRCODE = '22023';
  END IF;

  v_starts_at := private.resolve_civil_boundary(
    p_local_date,
    v_timezone,
    v_boundary
  );
  v_ends_at := private.resolve_civil_boundary(
    p_local_date + 1,
    v_timezone,
    v_boundary
  );

  IF v_ends_at <= v_starts_at THEN
    RAISE EXCEPTION 'Resolved operational period must have positive duration.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.operational_periods AS period
    WHERE period.world_id = p_world_id
      AND period.time_setting_id = p_time_setting_id
      AND period.local_date = p_local_date
      AND (
        period.starts_at IS DISTINCT FROM v_starts_at
        OR period.ends_at IS DISTINCT FROM v_ends_at
      )
  ) THEN
    RAISE EXCEPTION 'Existing operational period conflicts with resolved civil boundaries.'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.operational_periods (
    world_id,
    time_setting_id,
    local_date,
    starts_at,
    ends_at
  )
  VALUES (
    p_world_id,
    p_time_setting_id,
    p_local_date,
    v_starts_at,
    v_ends_at
  )
  ON CONFLICT DO NOTHING;

  RETURN QUERY
  SELECT period.id, period.local_date, period.starts_at, period.ends_at
  FROM public.operational_periods AS period
  WHERE period.world_id = p_world_id
    AND period.time_setting_id = p_time_setting_id
    AND period.local_date = p_local_date;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.ensure_operational_period(uuid, uuid, date)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
COMMENT ON FUNCTION private.ensure_operational_period(uuid, uuid, date) IS
  'Internal deterministic constructor using explicit resolved civil boundaries for both endpoints.';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.resolve_operational_period_for_anchor(
  p_world_id uuid,
  p_time_setting_id uuid,
  p_anchor_at timestamptz
)
RETURNS TABLE (
  operational_period_id uuid,
  local_date date,
  starts_at timestamptz,
  ends_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_timezone text;
  v_anchor_local_date date;
  v_match_count integer;
BEGIN
  SELECT setting.timezone_name
  INTO v_timezone
  FROM public.time_settings AS setting
  WHERE setting.world_id = p_world_id
    AND setting.id = p_time_setting_id;

  IF v_timezone IS NULL OR p_anchor_at IS NULL THEN
    RAISE EXCEPTION 'A valid setting and temporal anchor are required.'
      USING ERRCODE = '22023';
  END IF;

  v_anchor_local_date := (p_anchor_at AT TIME ZONE v_timezone)::date;

  PERFORM 1
  FROM private.ensure_operational_period(
    p_world_id,
    p_time_setting_id,
    v_anchor_local_date - 1
  );
  PERFORM 1
  FROM private.ensure_operational_period(
    p_world_id,
    p_time_setting_id,
    v_anchor_local_date
  );

  SELECT count(*)::integer
  INTO v_match_count
  FROM public.operational_periods AS period
  WHERE period.world_id = p_world_id
    AND period.time_setting_id = p_time_setting_id
    AND period.local_date IN (
      v_anchor_local_date - 1,
      v_anchor_local_date
    )
    AND period.starts_at <= p_anchor_at
    AND p_anchor_at < period.ends_at;

  IF v_match_count <> 1 THEN
    RAISE EXCEPTION 'Temporal anchor must belong to exactly one resolved operational period.'
      USING ERRCODE = '23514';
  END IF;

  RETURN QUERY
  SELECT period.id, period.local_date, period.starts_at, period.ends_at
  FROM public.operational_periods AS period
  WHERE period.world_id = p_world_id
    AND period.time_setting_id = p_time_setting_id
    AND period.local_date IN (
      v_anchor_local_date - 1,
      v_anchor_local_date
    )
    AND period.starts_at <= p_anchor_at
    AND p_anchor_at < period.ends_at;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.resolve_operational_period_for_anchor(uuid, uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
COMMENT ON FUNCTION private.resolve_operational_period_for_anchor(uuid, uuid, timestamptz) IS
  'Selects the unique resolved operational period that physically contains the temporal anchor.';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.resolve_observation_operational_target(
  p_world_id uuid,
  p_observation_id uuid
)
RETURNS TABLE (
  time_setting_id uuid,
  operational_period_id uuid,
  local_date date,
  anchor_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_anchor_at timestamptz;
  v_setting_id uuid;
  v_correction_count integer;
  v_leaf_count integer;
BEGIN
  SELECT count(*)::integer
  INTO v_correction_count
  FROM public.observation_corrections AS correction
  WHERE correction.world_id = p_world_id
    AND correction.observation_id = p_observation_id;

  SELECT count(*)::integer
  INTO v_leaf_count
  FROM public.observation_corrections AS correction
  WHERE correction.world_id = p_world_id
    AND correction.observation_id = p_observation_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.observation_corrections AS successor
      WHERE successor.world_id = correction.world_id
        AND successor.observation_id = correction.observation_id
        AND successor.supersedes_correction_id = correction.id
    );

  IF v_correction_count > 0 AND v_leaf_count <> 1 THEN
    RAISE EXCEPTION 'Observation correction chain is malformed.'
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(
    (
      SELECT correction.corrected_occurred_at
      FROM public.observation_corrections AS correction
      WHERE correction.world_id = observation.world_id
        AND correction.observation_id = observation.id
        AND NOT EXISTS (
          SELECT 1
          FROM public.observation_corrections AS successor
          WHERE successor.world_id = correction.world_id
            AND successor.observation_id = correction.observation_id
            AND successor.supersedes_correction_id = correction.id
        )
    ),
    observation.occurred_at,
    observation.recorded_at
  )
  INTO v_anchor_at
  FROM public.observations AS observation
  WHERE observation.world_id = p_world_id
    AND observation.id = p_observation_id;

  IF v_anchor_at IS NULL THEN
    RAISE EXCEPTION 'Observation is unavailable in this World.'
      USING ERRCODE = '42501';
  END IF;

  SELECT setting.id
  INTO v_setting_id
  FROM public.time_settings AS setting
  WHERE setting.world_id = p_world_id
    AND setting.effective_from <= v_anchor_at
    AND (setting.effective_to IS NULL OR v_anchor_at < setting.effective_to)
  ORDER BY setting.effective_from DESC
  LIMIT 1;

  IF v_setting_id IS NULL THEN
    RAISE EXCEPTION 'A durable time setting is required before temporal assignment.'
      USING ERRCODE = '55000';
  END IF;

  RETURN QUERY
  SELECT
    v_setting_id,
    period.operational_period_id,
    period.local_date,
    v_anchor_at
  FROM private.resolve_operational_period_for_anchor(
    p_world_id,
    v_setting_id,
    v_anchor_at
  ) AS period
  WHERE period.starts_at <= v_anchor_at
    AND v_anchor_at < period.ends_at;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.resolve_observation_operational_target(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
COMMENT ON FUNCTION private.resolve_observation_operational_target(uuid, uuid) IS
  'Resolves the effective event anchor into the unique physically containing period under its historical setting.';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.get_current_operational_period()
RETURNS TABLE (
  time_setting_id uuid,
  timezone_name text,
  operational_day_boundary time,
  setting_effective_from timestamptz,
  operational_period_id uuid,
  local_date date,
  starts_at timestamptz,
  ends_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_world_id uuid;
  v_now timestamptz := statement_timestamp();
  v_setting_id uuid;
  v_timezone text;
  v_boundary time;
  v_setting_effective_from timestamptz;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
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

  SELECT
    setting.id,
    setting.timezone_name,
    setting.operational_day_boundary,
    setting.effective_from
  INTO v_setting_id, v_timezone, v_boundary, v_setting_effective_from
  FROM public.time_settings AS setting
  WHERE setting.world_id = v_world_id
    AND setting.effective_from <= v_now
    AND (setting.effective_to IS NULL OR v_now < setting.effective_to)
  ORDER BY setting.effective_from DESC
  LIMIT 1;

  IF v_setting_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_setting_id,
    v_timezone,
    v_boundary,
    v_setting_effective_from,
    period.operational_period_id,
    period.local_date,
    period.starts_at,
    period.ends_at
  FROM private.resolve_operational_period_for_anchor(
    v_world_id,
    v_setting_id,
    v_now
  ) AS period;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.get_current_operational_period()
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.get_current_operational_period()
  TO authenticated;
--> statement-breakpoint
COMMENT ON FUNCTION public.get_current_operational_period() IS
  'Authenticated server-time resolution through explicit civil boundaries and physical containment; no manual rollover is required.';
