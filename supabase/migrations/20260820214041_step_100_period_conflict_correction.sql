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

  v_starts_at := (p_local_date + v_boundary) AT TIME ZONE v_timezone;
  v_ends_at := ((p_local_date + 1) + v_boundary) AT TIME ZONE v_timezone;

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
  'Internal deterministic period constructor. Step 100 forward correction removes PL/pgSQL conflict-target ambiguity.';
