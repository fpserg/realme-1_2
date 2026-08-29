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
DROP VIEW public.commitment_projection_source;

-- rebuild projection
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
    AND assertion.predicate IN ('commitment.title', 'commitment.due_local_date', 'commitment.status')
), pivoted AS (
  SELECT active.world_id, active.commitment_id,
    max(CASE WHEN active.predicate = 'commitment.title' THEN active.value #>> '{}' END) AS title,
    max(CASE WHEN active.predicate = 'commitment.status' THEN active.value #>> '{}' END) AS status,
    max(CASE WHEN active.predicate = 'commitment.due_local_date' THEN active.value #>> '{}' END) AS due_text,
    max(CASE WHEN active.predicate = 'commitment.title' THEN active.assertion_id END) AS title_assertion_id,
    max(CASE WHEN active.predicate = 'commitment.status' THEN active.assertion_id END) AS status_assertion_id,
    max(CASE WHEN active.predicate = 'commitment.due_local_date' THEN active.assertion_id END) AS due_assertion_id
  FROM active GROUP BY active.world_id, active.commitment_id
)
SELECT pivoted.world_id, pivoted.commitment_id, pivoted.title,
  CASE WHEN pivoted.due_text ~ '^\d{4}-\d{2}-\d{2}$'
    AND to_char(to_date(pivoted.due_text, 'YYYY-MM-DD'), 'YYYY-MM-DD') = pivoted.due_text
    THEN to_date(pivoted.due_text, 'YYYY-MM-DD') ELSE NULL END AS due_local_date,
  pivoted.status, pivoted.title_assertion_id, pivoted.due_assertion_id, pivoted.status_assertion_id
FROM pivoted
WHERE pivoted.title IS NOT NULL
  AND length(btrim(pivoted.title)) > 0
  AND pivoted.status IN ('open', 'completed', 'cancelled');
REVOKE ALL ON public.commitment_projection_source FROM PUBLIC, anon, authenticated;

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
