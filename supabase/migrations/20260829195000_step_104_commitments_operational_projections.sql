CREATE OR REPLACE VIEW public.commitment_projection_source
WITH (security_invoker = true)
AS
WITH active AS (
  SELECT
    assertion.world_id,
    assertion.subject_node_id AS commitment_id,
    assertion.id AS assertion_id,
    assertion.predicate,
    assertion.value
  FROM public.assertions AS assertion
  WHERE assertion.valid_to IS NULL
    AND assertion.subject_node_id IS NOT NULL
    AND assertion.object_node_id IS NULL
    AND assertion.predicate IN (
      'classification',
      'commitment_title',
      'commitment_due_local_date',
      'commitment_status'
    )
),
pivoted AS (
  SELECT
    active.world_id,
    active.commitment_id,
    min(active.value #>> '{}') FILTER (WHERE active.predicate = 'classification') AS classification,
    min(active.value #>> '{}') FILTER (WHERE active.predicate = 'commitment_title') AS admitted_title,
    min(active.value #>> '{}') FILTER (WHERE active.predicate = 'commitment_status') AS status,
    min(active.value #>> '{}') FILTER (WHERE active.predicate = 'commitment_due_local_date') AS due_text,
    min(active.assertion_id::text) FILTER (WHERE active.predicate = 'classification')::uuid AS classification_assertion_id,
    min(active.assertion_id::text) FILTER (WHERE active.predicate = 'commitment_title')::uuid AS title_assertion_id,
    min(active.assertion_id::text) FILTER (WHERE active.predicate = 'commitment_status')::uuid AS status_assertion_id,
    min(active.assertion_id::text) FILTER (WHERE active.predicate = 'commitment_due_local_date')::uuid AS due_assertion_id,
    count(*) FILTER (WHERE active.predicate = 'classification') AS classification_count,
    count(*) FILTER (WHERE active.predicate = 'commitment_title') AS title_count,
    count(*) FILTER (WHERE active.predicate = 'commitment_status') AS status_count,
    count(*) FILTER (WHERE active.predicate = 'commitment_due_local_date') AS due_count
  FROM active
  GROUP BY active.world_id, active.commitment_id
),
active_alias AS (
  SELECT
    alias.world_id,
    alias.node_id AS commitment_id,
    min(alias.alias) FILTER (WHERE length(btrim(alias.alias)) > 0) AS alias_title,
    count(*) FILTER (WHERE length(btrim(alias.alias)) > 0) AS alias_count
  FROM public.ontology_aliases AS alias
  WHERE alias.valid_to IS NULL
  GROUP BY alias.world_id, alias.node_id
)
SELECT
  pivoted.world_id,
  pivoted.commitment_id,
  CASE
    WHEN pivoted.admitted_title IS NOT NULL
      AND length(btrim(pivoted.admitted_title)) > 0
    THEN pivoted.admitted_title
    WHEN active_alias.alias_title IS NOT NULL
    THEN active_alias.alias_title
    ELSE 'Untitled commitment'
  END AS title,
  CASE
    WHEN pivoted.due_text ~ '^\d{4}-\d{2}-\d{2}$'
      AND to_char(to_date(pivoted.due_text, 'YYYY-MM-DD'), 'YYYY-MM-DD') = pivoted.due_text
    THEN to_date(pivoted.due_text, 'YYYY-MM-DD')
    ELSE NULL
  END AS due_local_date,
  pivoted.status,
  pivoted.classification_assertion_id,
  CASE
    WHEN pivoted.admitted_title IS NOT NULL
      AND length(btrim(pivoted.admitted_title)) > 0
    THEN pivoted.title_assertion_id
    ELSE NULL
  END AS title_assertion_id,
  pivoted.due_assertion_id,
  pivoted.status_assertion_id
FROM pivoted
LEFT JOIN active_alias
  ON active_alias.world_id = pivoted.world_id
 AND active_alias.commitment_id = pivoted.commitment_id
WHERE pivoted.classification_count = 1
  AND pivoted.title_count <= 1
  AND pivoted.status_count = 1
  AND pivoted.due_count <= 1
  AND lower(pivoted.classification) = 'commitment'
  AND pivoted.status IN ('open', 'completed', 'cancelled');

REVOKE ALL ON public.commitment_projection_source FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.resolve_operational_date_for_anchor(
  p_world_id uuid,
  p_anchor_at timestamptz
)
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_setting_id uuid;
  v_operational_date date;
BEGIN
  IF p_world_id IS NULL OR p_anchor_at IS NULL THEN
    RAISE EXCEPTION 'world and temporal anchor are required' USING ERRCODE = '22023';
  END IF;

  SELECT setting.id
  INTO v_setting_id
  FROM public.time_settings AS setting
  WHERE setting.world_id = p_world_id
    AND setting.effective_from <= p_anchor_at
    AND (setting.effective_to IS NULL OR p_anchor_at < setting.effective_to)
  ORDER BY setting.effective_from DESC
  LIMIT 1;

  IF v_setting_id IS NULL THEN
    RAISE EXCEPTION 'active time setting required' USING ERRCODE = '23514';
  END IF;

  SELECT period.local_date
  INTO v_operational_date
  FROM private.resolve_operational_period_for_anchor(
    p_world_id,
    v_setting_id,
    p_anchor_at
  ) AS period;

  IF v_operational_date IS NULL THEN
    RAISE EXCEPTION 'operational period resolution failed' USING ERRCODE = '23514';
  END IF;

  RETURN v_operational_date;
END;
$$;

REVOKE ALL ON FUNCTION private.resolve_operational_date_for_anchor(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_operational_commitments(
  p_surface text,
  p_horizon_days integer DEFAULT 30
)
RETURNS TABLE (
  commitment_id uuid,
  title text,
  due_local_date date,
  status text,
  surface text,
  is_stale boolean,
  classification_assertion_id uuid,
  title_assertion_id uuid,
  due_assertion_id uuid,
  status_assertion_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_world_id uuid;
  v_world_count integer;
  v_operational_date date;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_surface NOT IN ('today', 'horizon') THEN
    RAISE EXCEPTION 'invalid projection surface' USING ERRCODE = '22023';
  END IF;

  IF p_horizon_days < 1 OR p_horizon_days > 90 THEN
    RAISE EXCEPTION 'horizon must be between 1 and 90 days' USING ERRCODE = '22023';
  END IF;

  SELECT count(*), min(membership.world_id::text)::uuid
  INTO v_world_count, v_world_id
  FROM public.world_memberships AS membership
  WHERE membership.user_id = v_actor_id;

  IF v_world_count <> 1 OR v_world_id IS NULL THEN
    RAISE EXCEPTION 'exactly one world membership required' USING ERRCODE = '42501';
  END IF;

  v_operational_date := private.resolve_operational_date_for_anchor(
    v_world_id,
    statement_timestamp()
  );

  RETURN QUERY
  SELECT
    projection.commitment_id,
    projection.title,
    projection.due_local_date,
    projection.status,
    p_surface,
    projection.status = 'open'
      AND projection.due_local_date IS NOT NULL
      AND projection.due_local_date < v_operational_date AS is_stale,
    projection.classification_assertion_id,
    projection.title_assertion_id,
    projection.due_assertion_id,
    projection.status_assertion_id
  FROM public.commitment_projection_source AS projection
  WHERE projection.world_id = v_world_id
    AND projection.status = 'open'
    AND projection.due_local_date IS NOT NULL
    AND (
      (p_surface = 'today' AND projection.due_local_date <= v_operational_date)
      OR
      (
        p_surface = 'horizon'
        AND projection.due_local_date > v_operational_date
        AND projection.due_local_date <= v_operational_date + p_horizon_days
      )
    )
  ORDER BY projection.due_local_date, projection.commitment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_operational_commitments(text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_operational_commitments(text, integer)
  TO authenticated;
