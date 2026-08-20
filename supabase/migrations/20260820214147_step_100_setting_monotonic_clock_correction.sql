CREATE OR REPLACE FUNCTION public.save_time_setting(
  p_timezone_name text,
  p_operational_day_boundary time DEFAULT '04:00:00'::time
)
RETURNS TABLE (
  time_setting_id uuid,
  timezone_name text,
  operational_day_boundary time,
  effective_from timestamptz,
  was_created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_world_id uuid;
  v_current public.time_settings%rowtype;
  v_now timestamptz := clock_timestamp();
  v_new_id uuid;
  v_new_effective_from timestamptz;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_timezone_name IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_timezone_names
      WHERE name = p_timezone_name
    )
  THEN
    RAISE EXCEPTION 'Timezone must be a valid IANA timezone.'
      USING ERRCODE = '22023';
  END IF;

  IF p_operational_day_boundary IS NULL THEN
    RAISE EXCEPTION 'Operational boundary is required.'
      USING ERRCODE = '22023';
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

  PERFORM 1 FROM public.worlds WHERE id = v_world_id FOR UPDATE;

  SELECT setting.*
  INTO v_current
  FROM public.time_settings AS setting
  WHERE setting.world_id = v_world_id
    AND setting.effective_to IS NULL
  FOR UPDATE;

  IF v_current.id IS NOT NULL
    AND v_current.timezone_name = p_timezone_name
    AND v_current.operational_day_boundary = p_operational_day_boundary
  THEN
    RETURN QUERY SELECT
      v_current.id,
      v_current.timezone_name,
      v_current.operational_day_boundary,
      v_current.effective_from,
      false;
    RETURN;
  END IF;

  IF v_current.id IS NULL
    AND EXISTS (SELECT 1 FROM public.time_settings WHERE world_id = v_world_id)
  THEN
    RAISE EXCEPTION 'Time-setting history has no open version.'
      USING ERRCODE = '23514';
  END IF;

  IF v_current.id IS NOT NULL THEN
    v_now := greatest(
      v_now,
      v_current.effective_from + interval '1 microsecond'
    );
    UPDATE public.time_settings
    SET effective_to = v_now
    WHERE id = v_current.id;
    v_new_effective_from := v_now;
  ELSE
    v_new_effective_from := '-infinity'::timestamptz;
  END IF;

  INSERT INTO public.time_settings (
    world_id,
    timezone_name,
    operational_day_boundary,
    effective_from,
    recorded_by_account_id,
    supersedes_time_setting_id
  )
  VALUES (
    v_world_id,
    p_timezone_name,
    p_operational_day_boundary,
    v_new_effective_from,
    v_actor_id,
    v_current.id
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT
    v_new_id,
    p_timezone_name,
    p_operational_day_boundary,
    v_new_effective_from,
    true;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.save_time_setting(text, time)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.save_time_setting(text, time)
  TO authenticated;
--> statement-breakpoint
COMMENT ON FUNCTION public.save_time_setting(text, time) IS
  'Authenticated append-version command with database-clock monotonicity for successive prospective changes.';
