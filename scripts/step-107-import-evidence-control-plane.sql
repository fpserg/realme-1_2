-- Step 107 Sergey pilot control-plane evidence executor.
-- Exactly one PostgreSQL statement. The runner replaces the payload placeholder
-- with canonical UTF-8 JSON encoded as base64. Source text is nested base64.
-- Any failed guard raises an uncaught PostgreSQL ERROR from a volatile invalid
-- cast, aborting this statement and therefore rolling back every write it made.
WITH
payload AS MATERIALIZED (
  SELECT convert_from(
    decode('__STEP107_PAYLOAD_BASE64__', 'base64'),
    'UTF8'
  )::jsonb AS body
),
payload_shape_guard AS MATERIALIZED (
  SELECT
    body,
    (body #>> '{expected,accountId}')::uuid AS account_id,
    (body #>> '{expected,worldId}')::uuid AS world_id,
    CASE
      WHEN (body ->> 'version')::integer = 1
       AND body #>> '{source,repository}' = 'fpserg/RealMe'
       AND body #>> '{source,commit}' = 'b701e303e0e716dd54099938fab092d419d30e61'
       AND body #>> '{source,tree}' = 'b5b3edd5d31cc1a4955a493ad0d9dd8948550d88'
       AND jsonb_typeof(body -> 'items') = 'array'
       AND COALESCE((body ->> 'excludedClassECount')::integer, -1) = 1
      THEN 1
      ELSE ('STEP107_PAYLOAD_SHAPE_MISMATCH_' || pg_backend_pid()::text)::integer
    END AS ok
  FROM payload
),
items AS MATERIALIZED (
  SELECT
    item ->> 'id' AS source_item_id,
    item ->> 'authorityClass' AS authority_class,
    item ->> 'sourceKind' AS source_kind,
    item ->> 'sourceRepository' AS source_repository,
    item ->> 'sourceCommit' AS source_commit,
    item ->> 'sourceTree' AS source_tree,
    item ->> 'sourcePath' AS source_path,
    item ->> 'sourceBlobSha' AS source_blob_sha,
    item ->> 'sourceLocator' AS source_locator,
    item ->> 'contentHash' AS content_hash,
    NULLIF(item ->> 'operationalDay', '')::date AS operational_day,
    item -> 'occurredAt' AS occurred_json,
    (item ->> 'observationId')::uuid AS observation_id,
    (item ->> 'sourceFragmentId')::uuid AS fragment_id,
    (item ->> 'captureIdempotencyKey')::uuid AS capture_idempotency_key,
    convert_from(decode(item ->> 'exactTextBase64', 'base64'), 'UTF8') AS exact_text
  FROM payload_shape_guard AS guard
  CROSS JOIN LATERAL jsonb_array_elements(guard.body -> 'items') AS item
  WHERE guard.ok = 1
),
approved AS MATERIALIZED (
  SELECT *
  FROM (
    VALUES
      (
        'li-2026-08-29', 'A', 'living_input', 'fpserg/RealMe',
        'b701e303e0e716dd54099938fab092d419d30e61',
        'b5b3edd5d31cc1a4955a493ad0d9dd8948550d88',
        'docs/PRODUCT/DAILY/2026/08/2026-08-29/LI.md',
        'dd29129aed0c80365c59e8f1c206c35051283ec7',
        'fpserg/RealMe@b701e303e0e716dd54099938fab092d419d30e61:docs/PRODUCT/DAILY/2026/08/2026-08-29/LI.md#whole_file',
        '443aa583c8663e02af2c383f0182771303bf6e85e425e36e04abcc0ed4f62e58',
        '2026-08-29'::date,
        '7f1e82b6-e776-5133-9d5a-b68bedd0fb3c'::uuid,
        'b55c5605-fc12-501a-a7f7-51a0eccb4a90'::uuid,
        'ec0f6acb-46c2-5291-b38f-f5a4064dbc6e'::uuid
      ),
      (
        'li-2026-08-30', 'A', 'living_input', 'fpserg/RealMe',
        'b701e303e0e716dd54099938fab092d419d30e61',
        'b5b3edd5d31cc1a4955a493ad0d9dd8948550d88',
        'docs/PRODUCT/DAILY/2026/08/2026-08-30/LI.md',
        '92171a19ded89d4dedce3ba83752a31e18fc2818',
        'fpserg/RealMe@b701e303e0e716dd54099938fab092d419d30e61:docs/PRODUCT/DAILY/2026/08/2026-08-30/LI.md#whole_file',
        '22e03cffc37bb51425c76cebc223b4388ae1968e7f82ee986006bf79a9d6b669',
        '2026-08-30'::date,
        '59573e7f-d6d8-5e33-96ad-f65d54ec63f4'::uuid,
        'e709d94f-19f3-5e90-9a94-e61e9da5f727'::uuid,
        'f34cdcd5-9609-5307-b6bb-5aca1c4ca0ea'::uuid
      ),
      (
        'or-2026-08-30-realme', 'B', 'operational_record', 'fpserg/RealMe',
        'b701e303e0e716dd54099938fab092d419d30e61',
        'b5b3edd5d31cc1a4955a493ad0d9dd8948550d88',
        'docs/PRODUCT/DAILY/2026/08/2026-08-30/OR.md',
        '114a7d89a2492bcc1cb0c25a4213d2cc5577d1a1',
        'fpserg/RealMe@b701e303e0e716dd54099938fab092d419d30e61:docs/PRODUCT/DAILY/2026/08/2026-08-30/OR.md#exact_text:7ac8175d400fa524d1402ed2bcf6b312e0346d95723da6dd204b2025b0042d98',
        '7ac8175d400fa524d1402ed2bcf6b312e0346d95723da6dd204b2025b0042d98',
        '2026-08-30'::date,
        'd3f14170-647b-556d-847b-df5e19b4b67b'::uuid,
        'e526e9dd-209d-5935-a960-45b7d052a721'::uuid,
        '1660041d-7c0b-5e62-9be7-4c8329c9134b'::uuid
      ),
      (
        'world-household-realm', 'C', 'accepted_product_decision', 'fpserg/RealMe',
        'b701e303e0e716dd54099938fab092d419d30e61',
        'b5b3edd5d31cc1a4955a493ad0d9dd8948550d88',
        'docs/PRODUCT/VISUAL/REALME_WORLD_V1_CANONICAL_FREEZE.md',
        'c5400b3eb060b78bdfb9c5dd8d6cb94cd65645df',
        'fpserg/RealMe@b701e303e0e716dd54099938fab092d419d30e61:docs/PRODUCT/VISUAL/REALME_WORLD_V1_CANONICAL_FREEZE.md#exact_text:2e95c12b61a36ecee550ae26d918b840207e3d75570ee089522df27a6afbfa49',
        '2e95c12b61a36ecee550ae26d918b840207e3d75570ee089522df27a6afbfa49',
        NULL::date,
        'bb161234-1a85-5140-b8f3-f9edd4828415'::uuid,
        'c9291425-e57b-5843-88f5-4c70bcc45e51'::uuid,
        'c3cefd02-8c25-5a08-8428-f7d39bbd1812'::uuid
      ),
      (
        'wbtd-2026-08-30-realme-roadmap', 'D', 'wbtd_interpretation', 'fpserg/RealMe',
        'b701e303e0e716dd54099938fab092d419d30e61',
        'b5b3edd5d31cc1a4955a493ad0d9dd8948550d88',
        'docs/PRODUCT/DAILY/2026/08/2026-08-30/WBTD.md',
        'f803e54685925b0db2dd3bf29beb44f1792cd6df',
        'fpserg/RealMe@b701e303e0e716dd54099938fab092d419d30e61:docs/PRODUCT/DAILY/2026/08/2026-08-30/WBTD.md#exact_text:cf3dfaf9b36527fbfa91757b2b335fe1a3df31d75ba5bc059a7e84a97739805b',
        'cf3dfaf9b36527fbfa91757b2b335fe1a3df31d75ba5bc059a7e84a97739805b',
        '2026-08-30'::date,
        '086f4d72-c5f0-5193-9713-aeea36ae0173'::uuid,
        'e45a3bcc-d04f-5d72-8b54-9129aac3d6da'::uuid,
        '53f4e3bd-f53e-5fd7-a0f3-a6c90597adbd'::uuid
      )
  ) AS approved(
    source_item_id, authority_class, source_kind, source_repository,
    source_commit, source_tree, source_path, source_blob_sha, source_locator,
    content_hash, operational_day, observation_id, fragment_id,
    capture_idempotency_key
  )
),
item_set_guard AS MATERIALIZED (
  SELECT
    shape.body,
    shape.account_id,
    shape.world_id,
    CASE
      WHEN (SELECT count(*) FROM items) = 5
       AND (SELECT count(*) FROM approved) = 5
       AND NOT EXISTS (
         SELECT 1 FROM items WHERE authority_class = 'E'
       )
       AND NOT EXISTS (
         SELECT 1
         FROM items
         WHERE occurred_json IS DISTINCT FROM 'null'::jsonb
       )
       AND NOT EXISTS (
         SELECT 1
         FROM items
         WHERE content_hash IS DISTINCT FROM encode(
           extensions.digest(convert_to(exact_text, 'UTF8'), 'sha256'),
           'hex'
         )
       )
       AND NOT EXISTS (
         (
           SELECT
             source_item_id, authority_class, source_kind, source_repository,
             source_commit, source_tree, source_path, source_blob_sha,
             source_locator, content_hash, operational_day, observation_id,
             fragment_id, capture_idempotency_key
           FROM items
           EXCEPT
           SELECT
             source_item_id, authority_class, source_kind, source_repository,
             source_commit, source_tree, source_path, source_blob_sha,
             source_locator, content_hash, operational_day, observation_id,
             fragment_id, capture_idempotency_key
           FROM approved
         )
         UNION ALL
         (
           SELECT
             source_item_id, authority_class, source_kind, source_repository,
             source_commit, source_tree, source_path, source_blob_sha,
             source_locator, content_hash, operational_day, observation_id,
             fragment_id, capture_idempotency_key
           FROM approved
           EXCEPT
           SELECT
             source_item_id, authority_class, source_kind, source_repository,
             source_commit, source_tree, source_path, source_blob_sha,
             source_locator, content_hash, operational_day, observation_id,
             fragment_id, capture_idempotency_key
           FROM items
         )
       )
      THEN 1
      ELSE ('STEP107_SOURCE_PLAN_MISMATCH_' || pg_backend_pid()::text)::integer
    END AS ok
  FROM payload_shape_guard AS shape
  WHERE shape.ok = 1
),
bootstrap_guard AS MATERIALIZED (
  SELECT
    item_guard.body,
    item_guard.account_id,
    item_guard.world_id,
    CASE
      WHEN (SELECT count(*) FROM auth.users WHERE id = item_guard.account_id AND deleted_at IS NULL) = 1
       AND (SELECT count(*) FROM public.accounts WHERE id = item_guard.account_id) = 1
       AND (SELECT count(*) FROM public.worlds WHERE id = item_guard.world_id AND initial_owner_id = item_guard.account_id) = 1
       AND (SELECT count(*) FROM public.worlds WHERE initial_owner_id = item_guard.account_id) = 1
       AND (SELECT count(*) FROM public.world_memberships WHERE world_id = item_guard.world_id) = 1
       AND (SELECT count(*) FROM public.world_memberships WHERE world_id = item_guard.world_id AND user_id = item_guard.account_id AND role = 'owner') = 1
       AND (SELECT count(*) FROM public.world_memberships WHERE user_id = item_guard.account_id AND role = 'owner') = 1
       AND (SELECT count(*) FROM public.companions WHERE world_id = item_guard.world_id) = 1
      THEN 1
      ELSE ('STEP107_BOOTSTRAP_BINDING_MISMATCH_' || pg_backend_pid()::text)::integer
    END AS ok
  FROM item_set_guard AS item_guard
  WHERE item_guard.ok = 1
),
execution_context AS MATERIALIZED (
  SELECT
    bootstrap.body,
    bootstrap.account_id,
    bootstrap.world_id,
    set_config('realme.step107_executor_guard', 'transactional-v1', true) AS executor_guard,
    set_config('realme.step107_world_id', bootstrap.world_id::text, true) AS world_guard,
    set_config('realme.step107_account_id', bootstrap.account_id::text, true) AS account_guard
  FROM bootstrap_guard AS bootstrap
  WHERE bootstrap.ok = 1
),
context_guard AS MATERIALIZED (
  SELECT
    context.*,
    CASE
      WHEN current_setting('realme.step107_executor_guard', true) = 'transactional-v1'
       AND current_setting('realme.step107_world_id', true)::uuid = context.world_id
       AND current_setting('realme.step107_account_id', true)::uuid = context.account_id
      THEN 1
      ELSE ('STEP107_EXECUTION_CONTEXT_MISMATCH_' || pg_backend_pid()::text)::integer
    END AS ok
  FROM execution_context AS context
),
before_counts AS MATERIALIZED (
  SELECT
    context.world_id,
    context.account_id,
    (SELECT count(*) FROM public.observations WHERE world_id = context.world_id) AS observation_count,
    (SELECT count(*) FROM public.source_fragments WHERE world_id = context.world_id) AS fragment_count,
    (SELECT count(*) FROM public.admission_decisions WHERE world_id = context.world_id) AS admission_count,
    (SELECT count(*) FROM public.ontology_nodes WHERE world_id = context.world_id) AS node_count,
    (SELECT count(*) FROM public.assertions WHERE world_id = context.world_id) AS assertion_count
  FROM context_guard AS context
  WHERE context.ok = 1
),
observation_insert AS (
  INSERT INTO public.observations (
    id, world_id, recorded_by_account_id, source_kind, source_locator,
    occurred_at, occurred_precision, local_calendar_date,
    capture_idempotency_key
  )
  SELECT
    source.observation_id,
    context.world_id,
    context.account_id,
    'sergey_pilot:' || source.authority_class || ':' || source.source_kind,
    source.source_locator,
    NULL::timestamptz,
    'unknown',
    source.operational_day,
    source.capture_idempotency_key
  FROM items AS source
  CROSS JOIN context_guard AS context
  WHERE context.ok = 1
  ON CONFLICT (id) DO NOTHING
  RETURNING
    id, world_id, recorded_by_account_id, source_kind, source_locator,
    source_timezone, occurred_at, occurred_precision, local_calendar_date,
    capture_idempotency_key
),
observation_phase_guard AS MATERIALIZED (
  SELECT
    context.body,
    context.account_id,
    context.world_id,
    (SELECT count(*) FROM observation_insert) AS observations_inserted,
    CASE
      WHEN COALESCE((context.body #>> '{test,failAfterObservationInsert}')::boolean, false)
      THEN ('STEP107_DELIBERATE_POST_OBSERVATION_FAILURE_' || pg_backend_pid()::text)::integer
      ELSE 1
    END AS ok
  FROM context_guard AS context
  WHERE context.ok = 1
),
fragment_insert AS (
  INSERT INTO public.source_fragments (
    id, world_id, observation_id, ordinal, exact_text, content_hash
  )
  SELECT
    source.fragment_id,
    phase.world_id,
    source.observation_id,
    0,
    source.exact_text,
    source.content_hash
  FROM items AS source
  CROSS JOIN observation_phase_guard AS phase
  WHERE phase.ok = 1
  ON CONFLICT (id) DO NOTHING
  RETURNING id, world_id, observation_id, ordinal, exact_text, content_hash
),
effective_observations AS MATERIALIZED (
  SELECT
    observation.id, observation.world_id, observation.recorded_by_account_id,
    observation.source_kind, observation.source_locator,
    observation.source_timezone, observation.occurred_at,
    observation.occurred_precision, observation.local_calendar_date,
    observation.capture_idempotency_key
  FROM public.observations AS observation
  JOIN items AS source ON source.observation_id = observation.id
  UNION ALL
  SELECT
    inserted.id, inserted.world_id, inserted.recorded_by_account_id,
    inserted.source_kind, inserted.source_locator,
    inserted.source_timezone, inserted.occurred_at,
    inserted.occurred_precision, inserted.local_calendar_date,
    inserted.capture_idempotency_key
  FROM observation_insert AS inserted
),
effective_fragments AS MATERIALIZED (
  SELECT
    fragment.id, fragment.world_id, fragment.observation_id,
    fragment.ordinal, fragment.exact_text, fragment.content_hash
  FROM public.source_fragments AS fragment
  JOIN items AS source ON source.fragment_id = fragment.id
  UNION ALL
  SELECT
    inserted.id, inserted.world_id, inserted.observation_id,
    inserted.ordinal, inserted.exact_text, inserted.content_hash
  FROM fragment_insert AS inserted
),
reconciliation_guard AS MATERIALIZED (
  SELECT
    phase.account_id,
    phase.world_id,
    phase.observations_inserted,
    (SELECT count(*) FROM fragment_insert) AS fragments_inserted,
    CASE
      WHEN (SELECT count(*) FROM effective_observations) = 5
       AND (SELECT count(*) FROM effective_fragments) = 5
       AND NOT EXISTS (
         SELECT 1
         FROM items AS source
         LEFT JOIN effective_observations AS observation
           ON observation.id = source.observation_id
         LEFT JOIN effective_fragments AS fragment
           ON fragment.id = source.fragment_id
         WHERE observation.id IS NULL
            OR fragment.id IS NULL
            OR observation.world_id IS DISTINCT FROM phase.world_id
            OR observation.recorded_by_account_id IS DISTINCT FROM phase.account_id
            OR observation.source_kind IS DISTINCT FROM 'sergey_pilot:' || source.authority_class || ':' || source.source_kind
            OR observation.source_locator IS DISTINCT FROM source.source_locator
            OR observation.source_timezone IS NOT NULL
            OR observation.occurred_at IS NOT NULL
            OR observation.occurred_precision IS DISTINCT FROM 'unknown'
            OR observation.local_calendar_date IS DISTINCT FROM source.operational_day
            OR observation.capture_idempotency_key IS DISTINCT FROM source.capture_idempotency_key
            OR fragment.world_id IS DISTINCT FROM phase.world_id
            OR fragment.observation_id IS DISTINCT FROM source.observation_id
            OR fragment.ordinal IS DISTINCT FROM 0
            OR fragment.exact_text IS DISTINCT FROM source.exact_text
            OR fragment.content_hash IS DISTINCT FROM source.content_hash
       )
      THEN 1
      ELSE ('STEP107_REPLAY_RECONCILIATION_MISMATCH_' || pg_backend_pid()::text)::integer
    END AS ok
  FROM observation_phase_guard AS phase
  WHERE phase.ok = 1
),
fingerprint AS MATERIALIZED (
  SELECT encode(
    extensions.digest(
      convert_to(
        jsonb_agg(
          jsonb_build_object(
            'observationId', observation.id,
            'worldId', observation.world_id,
            'accountId', observation.recorded_by_account_id,
            'sourceKind', observation.source_kind,
            'sourceLocator', observation.source_locator,
            'sourceTimezone', observation.source_timezone,
            'occurredAt', observation.occurred_at,
            'occurredPrecision', observation.occurred_precision,
            'localCalendarDate', observation.local_calendar_date,
            'captureIdempotencyKey', observation.capture_idempotency_key,
            'fragmentId', fragment.id,
            'fragmentOrdinal', fragment.ordinal,
            'fragmentText', fragment.exact_text,
            'fragmentHash', fragment.content_hash
          ) ORDER BY observation.id
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) AS value
  FROM items AS source
  JOIN effective_observations AS observation
    ON observation.id = source.observation_id
  JOIN effective_fragments AS fragment
    ON fragment.id = source.fragment_id
  CROSS JOIN reconciliation_guard AS guard
  WHERE guard.ok = 1
),
postcondition_guard AS MATERIALIZED (
  SELECT
    before.*,
    reconcile.observations_inserted,
    reconcile.fragments_inserted,
    fingerprint.value AS reconciliation_fingerprint,
    CASE
      WHEN reconcile.observations_inserted BETWEEN 0 AND 5
       AND reconcile.fragments_inserted BETWEEN 0 AND 5
       AND (before.observation_count + reconcile.observations_inserted) >= before.observation_count
       AND (before.fragment_count + reconcile.fragments_inserted) >= before.fragment_count
      THEN 1
      ELSE ('STEP107_POSTCONDITION_MISMATCH_' || pg_backend_pid()::text)::integer
    END AS ok
  FROM before_counts AS before
  CROSS JOIN reconciliation_guard AS reconcile
  CROSS JOIN fingerprint
  WHERE reconcile.ok = 1
)
SELECT jsonb_build_object(
  'sourcePlanItemCount', 5,
  'beforeObservationCount', observation_count,
  'afterObservationCount', observation_count + observations_inserted,
  'observationsInserted', observations_inserted,
  'beforeFragmentCount', fragment_count,
  'afterFragmentCount', fragment_count + fragments_inserted,
  'fragmentsInserted', fragments_inserted,
  'reconciliationFingerprint', reconciliation_fingerprint,
  'canonicalStateUnchanged', true,
  'admissionDecisionsBefore', admission_count,
  'admissionDecisionsAfter', admission_count,
  'ontologyNodesBefore', node_count,
  'ontologyNodesAfter', node_count,
  'assertionsBefore', assertion_count,
  'assertionsAfter', assertion_count
) AS step107_control_plane_result
FROM postcondition_guard
WHERE ok = 1;
