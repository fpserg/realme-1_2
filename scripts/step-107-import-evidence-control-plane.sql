-- Step 107 Sergey pilot control-plane evidence executor.
-- Exactly one PostgreSQL statement. The runner replaces the payload placeholder
-- with canonical UTF-8 JSON encoded as base64. Source text is nested base64.
-- Failed guards use volatile invalid casts so an uncaught PostgreSQL ERROR aborts
-- the statement and rolls back every write made by it.
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
    item ->> 'operationalDay' AS operational_day_text,
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
plan_fingerprint AS MATERIALIZED (
  SELECT encode(
    extensions.digest(
      convert_to(
        string_agg(
          concat_ws(
            chr(31),
            source_item_id,
            authority_class,
            source_kind,
            source_repository,
            source_commit,
            source_tree,
            source_path,
            source_blob_sha,
            source_locator,
            content_hash,
            COALESCE(operational_day_text, ''),
            observation_id::text,
            fragment_id::text,
            capture_idempotency_key::text
          ),
          chr(30) ORDER BY source_item_id
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) AS value
  FROM items
),
item_set_guard AS MATERIALIZED (
  SELECT
    shape.body,
    shape.account_id,
    shape.world_id,
    CASE
      WHEN (SELECT count(*) FROM items) = 5
       AND (SELECT value FROM plan_fingerprint) = 'b1730e1e60bbc22289c4be89862c645c5461b108fb34dff188cc96c85f488f0a'
       AND NOT EXISTS (SELECT 1 FROM items WHERE authority_class = 'E')
       AND NOT EXISTS (
         SELECT 1 FROM items WHERE occurred_json IS DISTINCT FROM 'null'::jsonb
       )
       AND NOT EXISTS (
         SELECT 1
         FROM items
         WHERE content_hash IS DISTINCT FROM encode(
           extensions.digest(convert_to(exact_text, 'UTF8'), 'sha256'),
           'hex'
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
    id,
    world_id,
    recorded_by_account_id,
    source_kind,
    source_locator,
    occurred_at,
    occurred_precision,
    local_calendar_date,
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
    id,
    world_id,
    recorded_by_account_id,
    source_kind,
    source_locator,
    source_timezone,
    occurred_at,
    occurred_precision,
    local_calendar_date,
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
    id,
    world_id,
    observation_id,
    ordinal,
    exact_text,
    content_hash
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
    observation.id,
    observation.world_id,
    observation.recorded_by_account_id,
    observation.source_kind,
    observation.source_locator,
    observation.source_timezone,
    observation.occurred_at,
    observation.occurred_precision,
    observation.local_calendar_date,
    observation.capture_idempotency_key
  FROM public.observations AS observation
  JOIN items AS source ON source.observation_id = observation.id
  UNION ALL
  SELECT
    inserted.id,
    inserted.world_id,
    inserted.recorded_by_account_id,
    inserted.source_kind,
    inserted.source_locator,
    inserted.source_timezone,
    inserted.occurred_at,
    inserted.occurred_precision,
    inserted.local_calendar_date,
    inserted.capture_idempotency_key
  FROM observation_insert AS inserted
),
effective_fragments AS MATERIALIZED (
  SELECT
    fragment.id,
    fragment.world_id,
    fragment.observation_id,
    fragment.ordinal,
    fragment.exact_text,
    fragment.content_hash
  FROM public.source_fragments AS fragment
  JOIN items AS source ON source.fragment_id = fragment.id
  UNION ALL
  SELECT
    inserted.id,
    inserted.world_id,
    inserted.observation_id,
    inserted.ordinal,
    inserted.exact_text,
    inserted.content_hash
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
