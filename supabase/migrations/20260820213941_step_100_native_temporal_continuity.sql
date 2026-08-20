CREATE UNIQUE INDEX "operational_periods_setting_local_date_unique" ON "operational_periods" USING btree ("time_setting_id","local_date");--> statement-breakpoint
CREATE INDEX "operational_periods_world_interval_index" ON "operational_periods" USING btree ("world_id","starts_at","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "time_settings_one_open_version_unique" ON "time_settings" USING btree ("world_id") WHERE "time_settings"."effective_to" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "time_settings_one_successor_unique" ON "time_settings" USING btree ("supersedes_time_setting_id") WHERE "time_settings"."supersedes_time_setting_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "time_settings_one_root_unique" ON "time_settings" USING btree ("world_id") WHERE "time_settings"."supersedes_time_setting_id" is null;--> statement-breakpoint
CREATE INDEX "time_settings_world_effective_interval_index" ON "time_settings" USING btree ("world_id","effective_from","effective_to");--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_temporal_correction_metadata_check" CHECK ("audit_events"."action" <> 'observation_operational_period_corrected' or ("audit_events"."entity_type" = 'observation' and "audit_events"."entity_id" is not null and "audit_events"."metadata" ?& array['prior_membership_id', 'prior_operational_period_id', 'successor_membership_id', 'successor_operational_period_id', 'reason_category'] and ("audit_events"."metadata" - array['prior_membership_id', 'prior_operational_period_id', 'successor_membership_id', 'successor_operational_period_id', 'reason_category']) = '{}'::jsonb and jsonb_typeof("audit_events"."metadata"->'prior_membership_id') = 'string' and jsonb_typeof("audit_events"."metadata"->'prior_operational_period_id') = 'string' and jsonb_typeof("audit_events"."metadata"->'successor_membership_id') = 'string' and jsonb_typeof("audit_events"."metadata"->'successor_operational_period_id') = 'string' and jsonb_typeof("audit_events"."metadata"->'reason_category') = 'string'));
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
--> statement-breakpoint
ALTER TABLE public.time_settings
  ADD CONSTRAINT time_settings_world_effective_interval_exclusion
  EXCLUDE USING gist (
    world_id WITH =,
    tstzrange(effective_from, COALESCE(effective_to, 'infinity'::timestamptz), '[)') WITH &&
  );
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.validate_time_setting_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_timezone_names
    WHERE name = new.timezone_name
  ) THEN
    RAISE EXCEPTION 'Timezone must be a valid IANA timezone.'
      USING ERRCODE = '22023';
  END IF;

  IF tg_op = 'UPDATE' THEN
    IF old.id IS DISTINCT FROM new.id
      OR old.world_id IS DISTINCT FROM new.world_id
      OR old.timezone_name IS DISTINCT FROM new.timezone_name
      OR old.operational_day_boundary IS DISTINCT FROM new.operational_day_boundary
      OR old.effective_from IS DISTINCT FROM new.effective_from
      OR old.recorded_by_account_id IS DISTINCT FROM new.recorded_by_account_id
      OR old.supersedes_time_setting_id IS DISTINCT FROM new.supersedes_time_setting_id
      OR old.created_at IS DISTINCT FROM new.created_at
      OR old.effective_to IS NOT NULL
      OR new.effective_to IS NULL
    THEN
      RAISE EXCEPTION 'Time-setting versions are append-only; only an open interval may be closed.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN new;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.validate_time_setting_version()
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
CREATE TRIGGER time_settings_validate_version
  BEFORE INSERT OR UPDATE ON public.time_settings
  FOR EACH ROW EXECUTE FUNCTION private.validate_time_setting_version();
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
  ON CONFLICT (time_setting_id, local_date) DO NOTHING;

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
  v_timezone text;
  v_boundary time;
  v_local_date date;
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

  SELECT setting.id, setting.timezone_name, setting.operational_day_boundary
  INTO v_setting_id, v_timezone, v_boundary
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

  v_local_date := ((v_anchor_at AT TIME ZONE v_timezone) - v_boundary)::date;

  RETURN QUERY
  SELECT
    v_setting_id,
    period.operational_period_id,
    period.local_date,
    v_anchor_at
  FROM private.ensure_operational_period(
    p_world_id,
    v_setting_id,
    v_local_date
  ) AS period;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.resolve_observation_operational_target(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
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
  v_now timestamptz := statement_timestamp();
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
  v_local_date date;
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

  v_local_date := ((v_now AT TIME ZONE v_timezone) - v_boundary)::date;

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
  FROM private.ensure_operational_period(
    v_world_id,
    v_setting_id,
    v_local_date
  ) AS period;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.assign_observation_operational_period(
  p_observation_id uuid
)
RETURNS TABLE (
  assignment_state text,
  membership_id uuid,
  operational_period_id uuid,
  local_date date,
  suggested_operational_period_id uuid,
  suggested_local_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_world_id uuid;
  v_target record;
  v_membership record;
  v_leaf_count integer;
  v_new_membership_id uuid;
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

  PERFORM 1
  FROM public.observations AS observation
  WHERE observation.world_id = v_world_id
    AND observation.id = p_observation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Observation is not available in this World.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_target
  FROM private.resolve_observation_operational_target(
    v_world_id,
    p_observation_id
  );

  SELECT count(*)::integer
  INTO v_leaf_count
  FROM public.observation_operational_period_memberships AS membership
  WHERE membership.world_id = v_world_id
    AND membership.observation_id = p_observation_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.observation_operational_period_memberships AS successor
      WHERE successor.world_id = membership.world_id
        AND successor.observation_id = membership.observation_id
        AND successor.supersedes_membership_id = membership.id
    );

  IF v_leaf_count > 1 THEN
    RAISE EXCEPTION 'Operational membership chain is malformed.'
      USING ERRCODE = '23514';
  END IF;

  SELECT membership.id, membership.operational_period_id, period.local_date
  INTO v_membership
  FROM public.observation_operational_period_memberships AS membership
  JOIN public.operational_periods AS period
    ON period.world_id = membership.world_id
   AND period.id = membership.operational_period_id
  WHERE membership.world_id = v_world_id
    AND membership.observation_id = p_observation_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.observation_operational_period_memberships AS successor
      WHERE successor.world_id = membership.world_id
        AND successor.observation_id = membership.observation_id
        AND successor.supersedes_membership_id = membership.id
    );

  IF v_membership.id IS NULL THEN
    INSERT INTO public.observation_operational_period_memberships (
      world_id,
      observation_id,
      operational_period_id,
      assignment_kind,
      assigned_by_account_id
    )
    VALUES (
      v_world_id,
      p_observation_id,
      v_target.operational_period_id,
      'initial',
      v_actor_id
    )
    RETURNING id INTO v_new_membership_id;

    RETURN QUERY SELECT
      'assigned'::text,
      v_new_membership_id,
      v_target.operational_period_id,
      v_target.local_date,
      NULL::uuid,
      NULL::date;
    RETURN;
  END IF;

  IF v_membership.operational_period_id = v_target.operational_period_id THEN
    RETURN QUERY SELECT
      'assigned'::text,
      v_membership.id::uuid,
      v_membership.operational_period_id::uuid,
      v_membership.local_date::date,
      NULL::uuid,
      NULL::date;
  ELSE
    RETURN QUERY SELECT
      'correction_required'::text,
      v_membership.id::uuid,
      v_membership.operational_period_id::uuid,
      v_membership.local_date::date,
      v_target.operational_period_id,
      v_target.local_date;
  END IF;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.correct_observation_operational_period(
  p_observation_id uuid,
  p_reason_category text
)
RETURNS TABLE (
  membership_id uuid,
  operational_period_id uuid,
  local_date date,
  audit_event_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_world_id uuid;
  v_target record;
  v_prior record;
  v_leaf_count integer;
  v_membership_id uuid;
  v_audit_event_id uuid;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_reason_category NOT IN ('occurred_time_correction', 'user_review') THEN
    RAISE EXCEPTION 'Historical correction reason is invalid.'
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

  PERFORM 1
  FROM public.observations AS observation
  WHERE observation.world_id = v_world_id
    AND observation.id = p_observation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Observation is not available in this World.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_target
  FROM private.resolve_observation_operational_target(
    v_world_id,
    p_observation_id
  );

  SELECT count(*)::integer
  INTO v_leaf_count
  FROM public.observation_operational_period_memberships AS membership
  WHERE membership.world_id = v_world_id
    AND membership.observation_id = p_observation_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.observation_operational_period_memberships AS successor
      WHERE successor.world_id = membership.world_id
        AND successor.observation_id = membership.observation_id
        AND successor.supersedes_membership_id = membership.id
    );

  IF v_leaf_count <> 1 THEN
    RAISE EXCEPTION 'Exactly one prior operational membership is required.'
      USING ERRCODE = '23514';
  END IF;

  SELECT membership.id, membership.operational_period_id
  INTO v_prior
  FROM public.observation_operational_period_memberships AS membership
  WHERE membership.world_id = v_world_id
    AND membership.observation_id = p_observation_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.observation_operational_period_memberships AS successor
      WHERE successor.world_id = membership.world_id
        AND successor.observation_id = membership.observation_id
        AND successor.supersedes_membership_id = membership.id
    )
  FOR UPDATE;

  IF v_prior.operational_period_id = v_target.operational_period_id THEN
    RAISE EXCEPTION 'Observation already has the effective operational membership.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.observation_operational_period_memberships (
    world_id,
    observation_id,
    operational_period_id,
    assignment_kind,
    assigned_by_account_id,
    supersedes_membership_id
  )
  VALUES (
    v_world_id,
    p_observation_id,
    v_target.operational_period_id,
    'correction',
    v_actor_id,
    v_prior.id
  )
  RETURNING id INTO v_membership_id;

  INSERT INTO public.audit_events (
    world_id,
    actor_kind,
    actor_account_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    v_world_id,
    'user',
    v_actor_id,
    'observation_operational_period_corrected',
    'observation',
    p_observation_id,
    jsonb_build_object(
      'prior_membership_id', v_prior.id::text,
      'prior_operational_period_id', v_prior.operational_period_id::text,
      'successor_membership_id', v_membership_id::text,
      'successor_operational_period_id', v_target.operational_period_id::text,
      'reason_category', p_reason_category
    )
  )
  RETURNING id INTO v_audit_event_id;

  RETURN QUERY SELECT
    v_membership_id,
    v_target.operational_period_id,
    v_target.local_date,
    v_audit_event_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.save_time_setting(text, time)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.save_time_setting(text, time)
  TO authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.get_current_operational_period()
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.get_current_operational_period()
  TO authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.assign_observation_operational_period(uuid)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.assign_observation_operational_period(uuid)
  TO authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.correct_observation_operational_period(uuid, text)
  FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.correct_observation_operational_period(uuid, text)
  TO authenticated;
--> statement-breakpoint
COMMENT ON FUNCTION public.save_time_setting(text, time) IS
  'Authenticated append-version command for an IANA timezone and prospective local operational boundary.';
--> statement-breakpoint
COMMENT ON FUNCTION public.get_current_operational_period() IS
  'Authenticated server-time resolution of the current operational period; no manual rollover is required.';
--> statement-breakpoint
COMMENT ON FUNCTION public.assign_observation_operational_period(uuid) IS
  'Retry-safe initial temporal assignment. Existing historical membership is never silently rewritten.';
--> statement-breakpoint
COMMENT ON FUNCTION public.correct_observation_operational_period(uuid, text) IS
  'Explicit authenticated append-only historical membership correction with strict audit metadata.';
