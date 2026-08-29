begin;

-- Synthetic canonical fixtures are transaction-local and bypass FK triggers only so
-- this proof can isolate projection behavior without recreating the Step 103 admission pipeline.
set local session_replication_role = replica;

insert into public.worlds (id, initial_owner_id)
values ('10400000-0000-4000-8000-000000000001', '10400000-0000-4000-8000-000000000002');
insert into public.accounts (id)
values ('10400000-0000-4000-8000-000000000002');
insert into public.world_memberships (world_id, user_id, role)
values ('10400000-0000-4000-8000-000000000001', '10400000-0000-4000-8000-000000000002', 'owner');
insert into public.time_settings (
  id, world_id, timezone_name, operational_day_boundary, recorded_by_account_id
) values (
  '10400000-0000-4000-8000-000000000003',
  '10400000-0000-4000-8000-000000000001',
  'Europe/Amsterdam', '04:00', '10400000-0000-4000-8000-000000000002'
);
insert into public.ontology_nodes (id, world_id, admitted_by_decision_id)
values
  ('10400000-0000-4000-8000-000000000010', '10400000-0000-4000-8000-000000000001', '10400000-0000-4000-8000-000000000020'),
  ('10400000-0000-4000-8000-000000000011', '10400000-0000-4000-8000-000000000001', '10400000-0000-4000-8000-000000000021');
insert into public.assertions (
  id, world_id, subject_node_id, predicate, value, admitted_by_decision_id
) values
  ('10400000-0000-4000-8000-000000000101', '10400000-0000-4000-8000-000000000001', '10400000-0000-4000-8000-000000000010', 'commitment.title', '"File report"'::jsonb, '10400000-0000-4000-8000-000000000020'),
  ('10400000-0000-4000-8000-000000000102', '10400000-0000-4000-8000-000000000001', '10400000-0000-4000-8000-000000000010', 'commitment.due_local_date', to_jsonb((statement_timestamp() at time zone 'Europe/Amsterdam')::date::text), '10400000-0000-4000-8000-000000000020'),
  ('10400000-0000-4000-8000-000000000103', '10400000-0000-4000-8000-000000000001', '10400000-0000-4000-8000-000000000010', 'commitment.status', '"open"'::jsonb, '10400000-0000-4000-8000-000000000020'),
  ('10400000-0000-4000-8000-000000000111', '10400000-0000-4000-8000-000000000001', '10400000-0000-4000-8000-000000000011', 'commitment.title', '"Cancelled item"'::jsonb, '10400000-0000-4000-8000-000000000021'),
  ('10400000-0000-4000-8000-000000000112', '10400000-0000-4000-8000-000000000001', '10400000-0000-4000-8000-000000000011', 'commitment.due_local_date', to_jsonb(((statement_timestamp() at time zone 'Europe/Amsterdam')::date + 2)::text), '10400000-0000-4000-8000-000000000021'),
  ('10400000-0000-4000-8000-000000000113', '10400000-0000-4000-8000-000000000001', '10400000-0000-4000-8000-000000000011', 'commitment.status', '"cancelled"'::jsonb, '10400000-0000-4000-8000-000000000021');

set local session_replication_role = origin;
select set_config('request.jwt.claim.sub', '10400000-0000-4000-8000-000000000002', true);

-- canonical truth fingerprint
create temporary table step_104_truth_before as
select md5(string_agg(
  concat_ws('|', id::text, world_id::text, subject_node_id::text, predicate, value::text,
    coalesce(valid_to::text, ''), admitted_by_decision_id::text),
  E'\n' order by id
)) as fingerprint
from public.assertions
where world_id = '10400000-0000-4000-8000-000000000001';

create temporary table step_104_projection_before as
select * from public.commitment_projection_source
where world_id = '10400000-0000-4000-8000-000000000001'
order by commitment_id;

-- destroy projection
DROP FUNCTION public.list_operational_commitments(text, integer);
DROP VIEW public.commitment_projection_source;

-- rebuild projection
CREATE VIEW public.commitment_projection_source
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
      'commitment.title',
      'commitment.due_local_date',
      'commitment.status'
    )
),
pivoted AS (
  SELECT
    active.world_id,
    active.commitment_id,
    min(active.value #>> '{}') FILTER (WHERE active.predicate = 'commitment.title') AS title,
    min(active.value #>> '{}') FILTER (WHERE active.predicate = 'commitment.status') AS status,
    min(active.value #>> '{}') FILTER (WHERE active.predicate = 'commitment.due_local_date') AS due_text,
    min(active.assertion_id::text) FILTER (WHERE active.predicate = 'commitment.title')::uuid AS title_assertion_id,
    min(active.assertion_id::text) FILTER (WHERE active.predicate = 'commitment.status')::uuid AS status_assertion_id,
    min(active.assertion_id::text) FILTER (WHERE active.predicate = 'commitment.due_local_date')::uuid AS due_assertion_id,
    count(*) FILTER (WHERE active.predicate = 'commitment.title') AS title_count,
    count(*) FILTER (WHERE active.predicate = 'commitment.status') AS status_count,
    count(*) FILTER (WHERE active.predicate = 'commitment.due_local_date') AS due_count
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
WHERE pivoted.title_count = 1
  AND pivoted.status_count = 1
  AND pivoted.due_count <= 1
  AND pivoted.title IS NOT NULL
  AND length(btrim(pivoted.title)) > 0
  AND pivoted.status IN ('open', 'completed', 'cancelled');
REVOKE ALL ON public.commitment_projection_source FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.list_operational_commitments(
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
  v_world_count integer;
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

  SELECT count(*), min(membership.world_id::text)::uuid
  INTO v_world_count, v_world_id
  FROM public.world_memberships AS membership
  WHERE membership.user_id = v_actor_id;
  IF v_world_count <> 1 OR v_world_id IS NULL THEN
    RAISE EXCEPTION 'exactly one world membership required' USING ERRCODE = '42501';
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

create temporary table step_104_projection_after as
select * from public.commitment_projection_source
where world_id = '10400000-0000-4000-8000-000000000001'
order by commitment_id;

-- projection equivalence
DO $$
BEGIN
  ASSERT NOT EXISTS (
    (SELECT * FROM step_104_projection_before EXCEPT SELECT * FROM step_104_projection_after)
    UNION ALL
    (SELECT * FROM step_104_projection_after EXCEPT SELECT * FROM step_104_projection_before)
  ), 'projection changed after destroy/rebuild';
  ASSERT (SELECT count(*) FROM step_104_projection_after) = 2,
    'expected two derived commitment identities';
END;
$$;

-- canonical truth unchanged
DO $$
DECLARE
  v_after text;
BEGIN
  SELECT md5(string_agg(
    concat_ws('|', id::text, world_id::text, subject_node_id::text, predicate, value::text,
      coalesce(valid_to::text, ''), admitted_by_decision_id::text),
    E'\n' order by id
  )) INTO v_after
  FROM public.assertions
  WHERE world_id = '10400000-0000-4000-8000-000000000001';

  ASSERT v_after = (SELECT fingerprint FROM step_104_truth_before),
    'canonical truth changed while rebuilding projection';
END;
$$;

rollback;
