begin;

-- Install the Step 104 candidate transaction-locally so staging remains unchanged.
CREATE OR REPLACE VIEW public.commitment_projection_source
WITH (security_invoker = true)
AS
WITH active AS (
  SELECT assertion.world_id, assertion.subject_node_id AS commitment_id,
    assertion.id AS assertion_id, assertion.predicate, assertion.value
  FROM public.assertions AS assertion
  WHERE assertion.valid_to IS NULL
    AND assertion.subject_node_id IS NOT NULL
    AND assertion.object_node_id IS NULL
    AND assertion.predicate IN (
      'classification', 'commitment_title',
      'commitment_due_local_date', 'commitment_status'
    )
),
pivoted AS (
  SELECT active.world_id, active.commitment_id,
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
  SELECT alias.world_id, alias.node_id AS commitment_id,
    min(alias.alias) FILTER (WHERE length(btrim(alias.alias)) > 0) AS alias_title,
    count(*) FILTER (WHERE length(btrim(alias.alias)) > 0) AS alias_count
  FROM public.ontology_aliases AS alias
  WHERE alias.valid_to IS NULL
  GROUP BY alias.world_id, alias.node_id
)
SELECT pivoted.world_id, pivoted.commitment_id,
  CASE
    WHEN pivoted.admitted_title IS NOT NULL
      AND length(btrim(pivoted.admitted_title)) > 0
    THEN pivoted.admitted_title
    WHEN active_alias.alias_title IS NOT NULL THEN active_alias.alias_title
    ELSE 'Untitled commitment'
  END AS title,
  CASE
    WHEN pivoted.due_text ~ '^\d{4}-\d{2}-\d{2}$'
      AND to_char(to_date(pivoted.due_text, 'YYYY-MM-DD'), 'YYYY-MM-DD') = pivoted.due_text
    THEN to_date(pivoted.due_text, 'YYYY-MM-DD')
    ELSE NULL
  END AS due_local_date,
  pivoted.status, pivoted.classification_assertion_id,
  CASE
    WHEN pivoted.admitted_title IS NOT NULL
      AND length(btrim(pivoted.admitted_title)) > 0
    THEN pivoted.title_assertion_id
    ELSE NULL
  END AS title_assertion_id,
  pivoted.due_assertion_id, pivoted.status_assertion_id
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
  SELECT setting.id INTO v_setting_id
  FROM public.time_settings AS setting
  WHERE setting.world_id = p_world_id
    AND setting.effective_from <= p_anchor_at
    AND (setting.effective_to IS NULL OR p_anchor_at < setting.effective_to)
  ORDER BY setting.effective_from DESC
  LIMIT 1;

  IF v_setting_id IS NULL THEN
    RAISE EXCEPTION 'active time setting required' USING ERRCODE = '23514';
  END IF;

  SELECT period.local_date INTO v_operational_date
  FROM private.resolve_operational_period_for_anchor(
    p_world_id, v_setting_id, p_anchor_at
  ) AS period;

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
  commitment_id uuid, title text, due_local_date date, status text,
  surface text, is_stale boolean, classification_assertion_id uuid,
  title_assertion_id uuid, due_assertion_id uuid, status_assertion_id uuid
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
    v_world_id, statement_timestamp()
  );

  RETURN QUERY
  SELECT projection.commitment_id, projection.title, projection.due_local_date,
    projection.status, p_surface,
    projection.status = 'open'
      AND projection.due_local_date IS NOT NULL
      AND projection.due_local_date < v_operational_date AS is_stale,
    projection.classification_assertion_id, projection.title_assertion_id,
    projection.due_assertion_id, projection.status_assertion_id
  FROM public.commitment_projection_source AS projection
  WHERE projection.world_id = v_world_id
    AND projection.status = 'open'
    AND projection.due_local_date IS NOT NULL
    AND (
      (p_surface = 'today' AND projection.due_local_date <= v_operational_date)
      OR (
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

-- Synthetic canonical fixtures are transaction-local. Trigger/FK bypass is used
-- only to isolate projection semantics from the Step 103 admission workflow.
set local session_replication_role = replica;

insert into public.accounts (id) values
  ('10400000-0000-4000-8000-000000000002'),
  ('10400000-0000-4000-8000-000000000902'),
  ('10400000-0000-4000-8000-000000000912'),
  ('10400000-0000-4000-8000-000000000922');
insert into public.worlds (id, initial_owner_id) values
  ('10400000-0000-4000-8000-000000000001', '10400000-0000-4000-8000-000000000002'),
  ('10400000-0000-4000-8000-000000000901', '10400000-0000-4000-8000-000000000902'),
  ('10400000-0000-4000-8000-000000000911', '10400000-0000-4000-8000-000000000912'),
  ('10400000-0000-4000-8000-000000000921', '10400000-0000-4000-8000-000000000922');
insert into public.world_memberships (world_id, user_id, role)
values ('10400000-0000-4000-8000-000000000001', '10400000-0000-4000-8000-000000000002', 'owner');
insert into public.time_settings (
  id, world_id, timezone_name, operational_day_boundary, recorded_by_account_id
) values
  ('10400000-0000-4000-8000-000000000003', '10400000-0000-4000-8000-000000000001', 'Europe/Amsterdam', '04:00', '10400000-0000-4000-8000-000000000002'),
  ('10400000-0000-4000-8000-000000000903', '10400000-0000-4000-8000-000000000901', 'Europe/Amsterdam', '04:00', '10400000-0000-4000-8000-000000000902'),
  ('10400000-0000-4000-8000-000000000913', '10400000-0000-4000-8000-000000000911', 'Europe/Amsterdam', '02:30', '10400000-0000-4000-8000-000000000912'),
  ('10400000-0000-4000-8000-000000000923', '10400000-0000-4000-8000-000000000921', 'Europe/Amsterdam', '02:30', '10400000-0000-4000-8000-000000000922');

insert into public.ontology_nodes (id, world_id, admitted_by_decision_id)
select id, '10400000-0000-4000-8000-000000000001'::uuid,
  '10400000-0000-4000-8000-000000000020'::uuid
from (values
  ('10400000-0000-4000-8000-000000000010'::uuid),
  ('10400000-0000-4000-8000-000000000011'::uuid),
  ('10400000-0000-4000-8000-000000000012'::uuid),
  ('10400000-0000-4000-8000-000000000013'::uuid),
  ('10400000-0000-4000-8000-000000000014'::uuid)
) AS nodes(id);

-- alias cases: title+one, title+multiple, title+none, no-title+one, no-title+multiple
insert into public.ontology_aliases (
  id, world_id, node_id, alias, admitted_by_decision_id
) values
  ('10400000-0000-4000-8000-000000000030', '10400000-0000-4000-8000-000000000001', '10400000-0000-4000-8000-000000000010', 'Alias A', '10400000-0000-4000-8000-000000000020'),
  ('10400000-0000-4000-8000-000000000031', '10400000-0000-4000-8000-000000000001', '10400000-0000-4000-8000-000000000011', 'Alias B2', '10400000-0000-4000-8000-000000000020'),
  ('10400000-0000-4000-8000-000000000032', '10400000-0000-4000-8000-000000000001', '10400000-0000-4000-8000-000000000011', 'Alias B1', '10400000-0000-4000-8000-000000000020'),
  ('10400000-0000-4000-8000-000000000033', '10400000-0000-4000-8000-000000000001', '10400000-0000-4000-8000-000000000013', 'Alias D', '10400000-0000-4000-8000-000000000020'),
  ('10400000-0000-4000-8000-000000000034', '10400000-0000-4000-8000-000000000001', '10400000-0000-4000-8000-000000000014', 'Alias E2', '10400000-0000-4000-8000-000000000020'),
  ('10400000-0000-4000-8000-000000000035', '10400000-0000-4000-8000-000000000001', '10400000-0000-4000-8000-000000000014', 'Alias E1', '10400000-0000-4000-8000-000000000020');

insert into public.assertions (
  id, world_id, subject_node_id, predicate, value, admitted_by_decision_id
)
select gen_random_uuid(), '10400000-0000-4000-8000-000000000001'::uuid, node_id,
  predicate, value, '10400000-0000-4000-8000-000000000020'::uuid
from (values
  ('10400000-0000-4000-8000-000000000010'::uuid, 'classification', '"commitment"'::jsonb),
  ('10400000-0000-4000-8000-000000000010'::uuid, 'commitment_title', '"Canonical A"'::jsonb),
  ('10400000-0000-4000-8000-000000000010'::uuid, 'commitment_due_local_date', '"2026-08-30"'::jsonb),
  ('10400000-0000-4000-8000-000000000010'::uuid, 'commitment_status', '"open"'::jsonb),
  ('10400000-0000-4000-8000-000000000011'::uuid, 'classification', '"commitment"'::jsonb),
  ('10400000-0000-4000-8000-000000000011'::uuid, 'commitment_title', '"Canonical B"'::jsonb),
  ('10400000-0000-4000-8000-000000000011'::uuid, 'commitment_due_local_date', '"2026-08-30"'::jsonb),
  ('10400000-0000-4000-8000-000000000011'::uuid, 'commitment_status', '"open"'::jsonb),
  ('10400000-0000-4000-8000-000000000012'::uuid, 'classification', '"commitment"'::jsonb),
  ('10400000-0000-4000-8000-000000000012'::uuid, 'commitment_title', '"Canonical C"'::jsonb),
  ('10400000-0000-4000-8000-000000000012'::uuid, 'commitment_due_local_date', '"2026-08-30"'::jsonb),
  ('10400000-0000-4000-8000-000000000012'::uuid, 'commitment_status', '"open"'::jsonb),
  ('10400000-0000-4000-8000-000000000013'::uuid, 'classification', '"commitment"'::jsonb),
  ('10400000-0000-4000-8000-000000000013'::uuid, 'commitment_due_local_date', '"2026-08-30"'::jsonb),
  ('10400000-0000-4000-8000-000000000013'::uuid, 'commitment_status', '"open"'::jsonb),
  ('10400000-0000-4000-8000-000000000014'::uuid, 'classification', '"commitment"'::jsonb),
  ('10400000-0000-4000-8000-000000000014'::uuid, 'commitment_due_local_date', '"2026-08-30"'::jsonb),
  ('10400000-0000-4000-8000-000000000014'::uuid, 'commitment_status', '"open"'::jsonb)
) AS facts(node_id, predicate, value);

set local session_replication_role = origin;

-- normal civil day / immediately before boundary / exact resolved boundary / immediately after boundary
DO $$
BEGIN
  ASSERT private.resolve_operational_date_for_anchor(
    '10400000-0000-4000-8000-000000000901', '2026-02-10 02:59:59+00'
  ) = date '2026-02-09', 'normal civil day immediately before boundary failed';
  ASSERT private.resolve_operational_date_for_anchor(
    '10400000-0000-4000-8000-000000000901', '2026-02-10 03:00:00+00'
  ) = date '2026-02-10', 'normal civil day exact resolved boundary failed';
  ASSERT private.resolve_operational_date_for_anchor(
    '10400000-0000-4000-8000-000000000901', '2026-02-10 03:00:01+00'
  ) = date '2026-02-10', 'normal civil day immediately after boundary failed';
END;
$$;

-- Europe/Amsterdam spring DST gap: civil 02:30 resolves forward to physical 03:30 local / 01:30 UTC.
DO $$
BEGIN
  ASSERT private.resolve_operational_date_for_anchor(
    '10400000-0000-4000-8000-000000000911', '2026-03-29 01:15:00+00'
  ) = date '2026-03-28', 'spring DST gap rolled forward before the resolved boundary';
  ASSERT private.resolve_operational_date_for_anchor(
    '10400000-0000-4000-8000-000000000911', '2026-03-29 01:29:59+00'
  ) = date '2026-03-28', 'spring DST gap immediately before boundary failed';
  ASSERT private.resolve_operational_date_for_anchor(
    '10400000-0000-4000-8000-000000000911', '2026-03-29 01:30:00+00'
  ) = date '2026-03-29', 'spring DST gap exact resolved boundary failed';
  ASSERT private.resolve_operational_date_for_anchor(
    '10400000-0000-4000-8000-000000000911', '2026-03-29 01:30:01+00'
  ) = date '2026-03-29', 'spring DST gap immediately after boundary failed';
END;
$$;

-- Europe/Amsterdam fall DST fold: Step 100 chooses the earlier physical 02:30 occurrence / 00:30 UTC.
DO $$
BEGIN
  ASSERT private.resolve_operational_date_for_anchor(
    '10400000-0000-4000-8000-000000000921', '2026-10-25 00:29:59+00'
  ) = date '2026-10-24', 'fall DST fold immediately before boundary failed';
  ASSERT private.resolve_operational_date_for_anchor(
    '10400000-0000-4000-8000-000000000921', '2026-10-25 00:30:00+00'
  ) = date '2026-10-25', 'fall DST fold exact resolved boundary failed';
  ASSERT private.resolve_operational_date_for_anchor(
    '10400000-0000-4000-8000-000000000921', '2026-10-25 01:15:00+00'
  ) = date '2026-10-25', 'fall DST fold later repeated hour failed';
END;
$$;

-- alias-cardinality regressions
DO $$
BEGIN
  ASSERT (SELECT title = 'Canonical A' AND title_assertion_id IS NOT NULL
    FROM public.commitment_projection_source
    WHERE commitment_id = '10400000-0000-4000-8000-000000000010'),
    'admitted title + one alias must project canonical title';
  ASSERT (SELECT title = 'Canonical B' AND title_assertion_id IS NOT NULL
    FROM public.commitment_projection_source
    WHERE commitment_id = '10400000-0000-4000-8000-000000000011'),
    'admitted title + multiple active aliases must project canonical title';
  ASSERT (SELECT title = 'Canonical C' AND title_assertion_id IS NOT NULL
    FROM public.commitment_projection_source
    WHERE commitment_id = '10400000-0000-4000-8000-000000000012'),
    'admitted title + no alias must remain projected';
  ASSERT (SELECT title = 'Alias D' AND title_assertion_id IS NULL
    FROM public.commitment_projection_source
    WHERE commitment_id = '10400000-0000-4000-8000-000000000013'),
    'no admitted title + one alias must use alias fallback without provenance fabrication';
  ASSERT (SELECT title = 'Alias E1' AND title_assertion_id IS NULL
    FROM public.commitment_projection_source
    WHERE commitment_id = '10400000-0000-4000-8000-000000000014'),
    'no admitted title + multiple aliases must remain projected deterministically';
END;
$$;

-- canonical truth fingerprint
create temporary table step_104_truth_before as
select md5(string_agg(
  concat_ws('|', id::text, world_id::text, subject_node_id::text, predicate,
    value::text, coalesce(valid_to::text, ''), admitted_by_decision_id::text),
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

-- rebuild projection from canonical records
CREATE VIEW public.commitment_projection_source
WITH (security_invoker = true)
AS
WITH active AS (
  SELECT assertion.world_id, assertion.subject_node_id AS commitment_id,
    assertion.id AS assertion_id, assertion.predicate, assertion.value
  FROM public.assertions AS assertion
  WHERE assertion.valid_to IS NULL
    AND assertion.subject_node_id IS NOT NULL
    AND assertion.object_node_id IS NULL
    AND assertion.predicate IN (
      'classification', 'commitment_title',
      'commitment_due_local_date', 'commitment_status'
    )
),
pivoted AS (
  SELECT active.world_id, active.commitment_id,
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
  FROM active GROUP BY active.world_id, active.commitment_id
),
active_alias AS (
  SELECT alias.world_id, alias.node_id AS commitment_id,
    min(alias.alias) FILTER (WHERE length(btrim(alias.alias)) > 0) AS alias_title
  FROM public.ontology_aliases AS alias
  WHERE alias.valid_to IS NULL
  GROUP BY alias.world_id, alias.node_id
)
SELECT pivoted.world_id, pivoted.commitment_id,
  CASE
    WHEN pivoted.admitted_title IS NOT NULL
      AND length(btrim(pivoted.admitted_title)) > 0 THEN pivoted.admitted_title
    WHEN active_alias.alias_title IS NOT NULL THEN active_alias.alias_title
    ELSE 'Untitled commitment'
  END AS title,
  CASE
    WHEN pivoted.due_text ~ '^\d{4}-\d{2}-\d{2}$'
      AND to_char(to_date(pivoted.due_text, 'YYYY-MM-DD'), 'YYYY-MM-DD') = pivoted.due_text
    THEN to_date(pivoted.due_text, 'YYYY-MM-DD') ELSE NULL
  END AS due_local_date,
  pivoted.status, pivoted.classification_assertion_id,
  CASE
    WHEN pivoted.admitted_title IS NOT NULL
      AND length(btrim(pivoted.admitted_title)) > 0 THEN pivoted.title_assertion_id
    ELSE NULL
  END AS title_assertion_id,
  pivoted.due_assertion_id, pivoted.status_assertion_id
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

CREATE FUNCTION public.list_operational_commitments(
  p_surface text, p_horizon_days integer DEFAULT 30
)
RETURNS TABLE (
  commitment_id uuid, title text, due_local_date date, status text,
  surface text, is_stale boolean, classification_assertion_id uuid,
  title_assertion_id uuid, due_assertion_id uuid, status_assertion_id uuid
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_world_id uuid;
  v_world_count integer;
  v_operational_date date;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF p_surface NOT IN ('today', 'horizon') THEN RAISE EXCEPTION 'invalid projection surface' USING ERRCODE = '22023'; END IF;
  IF p_horizon_days < 1 OR p_horizon_days > 90 THEN RAISE EXCEPTION 'horizon must be between 1 and 90 days' USING ERRCODE = '22023'; END IF;
  SELECT count(*), min(membership.world_id::text)::uuid INTO v_world_count, v_world_id
  FROM public.world_memberships AS membership WHERE membership.user_id = v_actor_id;
  IF v_world_count <> 1 OR v_world_id IS NULL THEN RAISE EXCEPTION 'exactly one world membership required' USING ERRCODE = '42501'; END IF;
  v_operational_date := private.resolve_operational_date_for_anchor(v_world_id, statement_timestamp());
  RETURN QUERY
  SELECT projection.commitment_id, projection.title, projection.due_local_date,
    projection.status, p_surface,
    projection.status = 'open' AND projection.due_local_date IS NOT NULL
      AND projection.due_local_date < v_operational_date,
    projection.classification_assertion_id, projection.title_assertion_id,
    projection.due_assertion_id, projection.status_assertion_id
  FROM public.commitment_projection_source AS projection
  WHERE projection.world_id = v_world_id AND projection.status = 'open'
    AND projection.due_local_date IS NOT NULL
    AND ((p_surface = 'today' AND projection.due_local_date <= v_operational_date)
      OR (p_surface = 'horizon' AND projection.due_local_date > v_operational_date
        AND projection.due_local_date <= v_operational_date + p_horizon_days))
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
  ASSERT (SELECT count(*) FROM step_104_projection_after) = 5,
    'expected five derived commitment identities';
END;
$$;

-- canonical truth unchanged
DO $$
DECLARE v_after text;
BEGIN
  SELECT md5(string_agg(
    concat_ws('|', id::text, world_id::text, subject_node_id::text, predicate,
      value::text, coalesce(valid_to::text, ''), admitted_by_decision_id::text),
    E'\n' order by id
  )) INTO v_after
  FROM public.assertions
  WHERE world_id = '10400000-0000-4000-8000-000000000001';
  ASSERT v_after = (SELECT fingerprint FROM step_104_truth_before),
    'canonical truth changed while rebuilding projection';
END;
$$;

select
  (select count(*) from step_104_projection_before) as projection_rows_before,
  (select count(*) from step_104_projection_after) as projection_rows_after,
  (select fingerprint from step_104_truth_before) as canonical_fingerprint;

rollback;
