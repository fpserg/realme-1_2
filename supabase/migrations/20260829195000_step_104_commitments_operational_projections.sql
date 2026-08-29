CREATE OR REPLACE VIEW public.commitment_projection_source
WITH (security_invoker = true)
AS
WITH active AS (
  SELECT
    assertion.world_id,
    assertion.subject_node_id AS commitment_id,
    assertion.id AS assertion_id,
    assertion.predicate,
    assertion.value,
    assertion.admitted_by_decision_id
  FROM public.assertions AS assertion
  WHERE assertion.valid_to IS NULL
    AND assertion.subject_node_id IS NOT NULL
    AND assertion.object_node_id IS NULL
    AND assertion.predicate IN (
      'commitment.title',
      'commitment.due_local_date',
      'commitment.status'
    )
),
pivoted AS (
  SELECT
    active.world_id,
    active.commitment_id,
    max(CASE WHEN active.predicate = 'commitment.title' THEN active.value #>> '{}' END) AS title,
    max(CASE WHEN active.predicate = 'commitment.status' THEN active.value #>> '{}' END) AS status,
    max(CASE WHEN active.predicate = 'commitment.due_local_date' THEN active.value #>> '{}' END) AS due_text,
    max(CASE WHEN active.predicate = 'commitment.title' THEN active.assertion_id END) AS title_assertion_id,
    max(CASE WHEN active.predicate = 'commitment.status' THEN active.assertion_id END) AS status_assertion_id,
    max(CASE WHEN active.predicate = 'commitment.due_local_date' THEN active.assertion_id END) AS due_assertion_id
  FROM active
  GROUP BY active.world_id, active.commitment_id
)
SELECT
  pivoted.world_id,
  pivoted.commitment_id,
  pivoted.title,
  CASE
    WHEN pivoted.due_text ~ '^\d{4}-\d{2}-\d{2}$'
      AND to_char(to_date(pivoted.due_text, 'YYYY-MM-DD'), 'YYYY-MM-DD') = pivoted.due_text
    THEN to_date(pivoted.due_text, 'YYYY-MM-DD')
    ELSE NULL
  END AS due_local_date,
  pivoted.status,
  pivoted.title_assertion_id,
  pivoted.due_assertion_id,
  pivoted.status_assertion_id
FROM pivoted
WHERE pivoted.title IS NOT NULL
  AND length(btrim(pivoted.title)) > 0
  AND pivoted.status IN ('open', 'completed', 'cancelled');

REVOKE ALL ON public.commitment_projection_source FROM PUBLIC, anon, authenticated;

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
  v_timezone_name text;
  v_boundary time;
  v_local_now timestamp;
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

  SELECT membership.world_id
  INTO v_world_id
  FROM public.world_memberships AS membership
  WHERE membership.user_id = v_actor_id
  ORDER BY membership.created_at
  LIMIT 1;

  IF v_world_id IS NULL THEN
    RAISE EXCEPTION 'world membership required' USING ERRCODE = '42501';
  END IF;

  SELECT setting.timezone_name, setting.operational_day_boundary
  INTO v_timezone_name, v_boundary
  FROM public.time_settings AS setting
  WHERE setting.world_id = v_world_id
    AND setting.effective_from <= statement_timestamp()
    AND (setting.effective_to IS NULL OR setting.effective_to > statement_timestamp())
  ORDER BY setting.effective_from DESC
  LIMIT 1;

  IF v_timezone_name IS NULL THEN
    RAISE EXCEPTION 'active time setting required' USING ERRCODE = '23514';
  END IF;

  v_local_now := statement_timestamp() AT TIME ZONE v_timezone_name;
  v_operational_date := v_local_now::date
    - CASE WHEN v_local_now::time < v_boundary THEN 1 ELSE 0 END;

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
