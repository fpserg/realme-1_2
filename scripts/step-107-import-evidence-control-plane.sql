-- Step 107 Sergey pilot control-plane evidence executor.
-- One PostgreSQL statement only. The runner replaces the payload placeholder
-- with canonical UTF-8 JSON encoded as base64. No source text is interpolated.
DO $step107$
DECLARE
  v_payload jsonb;
  v_account_id uuid;
  v_world_id uuid;
  v_before_observations integer;
  v_after_observations integer;
  v_before_fragments integer;
  v_after_fragments integer;
  v_before_admission integer;
  v_before_nodes integer;
  v_before_assertions integer;
  v_after_admission integer;
  v_after_nodes integer;
  v_after_assertions integer;
  v_fingerprint text;
  v_result jsonb;
BEGIN
  v_payload := convert_from(
    decode('__STEP107_PAYLOAD_BASE64__', 'base64'),
    'UTF8'
  )::jsonb;

  IF (v_payload ->> 'version')::integer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Step 107 control-plane payload version mismatch.';
  END IF;

  IF v_payload #>> '{source,repository}' IS DISTINCT FROM 'fpserg/RealMe'
     OR v_payload #>> '{source,commit}' IS DISTINCT FROM 'b701e303e0e716dd54099938fab092d419d30e61'
     OR v_payload #>> '{source,tree}' IS DISTINCT FROM 'b5b3edd5d31cc1a4955a493ad0d9dd8948550d88'
  THEN
    RAISE EXCEPTION 'Step 107 control-plane source pin mismatch.';
  END IF;

  IF jsonb_typeof(v_payload -> 'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_payload -> 'items') <> 5
  THEN
    RAISE EXCEPTION 'Step 107 control-plane payload must contain exactly five source items.';
  END IF;

  IF COALESCE((v_payload ->> 'excludedClassECount')::integer, -1) <> 1 THEN
    RAISE EXCEPTION 'Step 107 control-plane Class E exclusion proof mismatch.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_payload -> 'items') AS item
    WHERE item ->> 'authorityClass' = 'E'
  ) THEN
    RAISE EXCEPTION 'Step 107 control-plane payload contains forbidden Class E material.';
  END IF;

  v_account_id := (v_payload #>> '{expected,accountId}')::uuid;
  v_world_id := (v_payload #>> '{expected,worldId}')::uuid;

  IF (SELECT count(*) FROM auth.users WHERE id = v_account_id AND deleted_at IS NULL) <> 1
     OR (SELECT count(*) FROM public.accounts WHERE id = v_account_id) <> 1
     OR (SELECT count(*) FROM public.worlds WHERE id = v_world_id AND initial_owner_id = v_account_id) <> 1
     OR (SELECT count(*) FROM public.worlds WHERE initial_owner_id = v_account_id) <> 1
     OR (
       SELECT count(*)
       FROM public.world_memberships
       WHERE world_id = v_world_id
         AND user_id = v_account_id
         AND role = 'owner'
     ) <> 1
     OR (
       SELECT count(*)
       FROM public.world_memberships
       WHERE world_id = v_world_id
         AND role = 'owner'
     ) <> 1
     OR (
       SELECT count(*)
       FROM public.world_memberships
       WHERE user_id = v_account_id
         AND role = 'owner'
     ) <> 1
  THEN
    RAISE EXCEPTION 'Step 107 control-plane bootstrap ownership binding mismatch.';
  END IF;

  CREATE TEMP TABLE step107_source_items (
    source_item_id text PRIMARY KEY,
    authority_class text NOT NULL,
    source_repository text NOT NULL,
    source_commit text NOT NULL,
    source_tree text NOT NULL,
    source_path text NOT NULL,
    source_blob_sha text NOT NULL,
    observation_id uuid NOT NULL,
    fragment_id uuid NOT NULL,
    capture_idempotency_key uuid NOT NULL,
    source_kind text NOT NULL,
    source_locator text NOT NULL,
    occurred_at timestamptz,
    occurred_precision text NOT NULL,
    local_calendar_date date,
    exact_text text NOT NULL,
    content_hash text NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO step107_source_items (
    source_item_id, authority_class,
    source_repository, source_commit, source_tree, source_path, source_blob_sha,
    observation_id, fragment_id, capture_idempotency_key,
    source_kind, source_locator, occurred_at, occurred_precision,
    local_calendar_date, exact_text, content_hash
  )
  SELECT
    item ->> 'id',
    item ->> 'authorityClass',
    item ->> 'sourceRepository',
    item ->> 'sourceCommit',
    item ->> 'sourceTree',
    item ->> 'sourcePath',
    item ->> 'sourceBlobSha',
    (item ->> 'observationId')::uuid,
    (item ->> 'sourceFragmentId')::uuid,
    (item ->> 'captureIdempotencyKey')::uuid,
    'sergey_pilot:' || (item ->> 'authorityClass') || ':' || (item ->> 'sourceKind'),
    item ->> 'sourceLocator',
    CASE
      WHEN item -> 'occurredAt' = 'null'::jsonb THEN NULL
      ELSE (item ->> 'occurredAt')::timestamptz
    END,
    CASE
      WHEN item -> 'occurredAt' = 'null'::jsonb THEN 'unknown'
      ELSE 'exact'
    END,
    NULLIF(item ->> 'operationalDay', '')::date,
    convert_from(decode(item ->> 'exactTextBase64', 'base64'), 'UTF8'),
    item ->> 'contentHash'
  FROM jsonb_array_elements(v_payload -> 'items') AS item;

  IF (SELECT count(*) FROM step107_source_items) <> 5 THEN
    RAISE EXCEPTION 'Step 107 control-plane source materialization count mismatch.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM step107_source_items AS source
    LEFT JOIN (
      VALUES
        (
          'li-2026-08-29', 'A', 'living_input',
          'docs/PRODUCT/DAILY/2026/08/2026-08-29/LI.md',
          'dd29129aed0c80365c59e8f1c206c35051283ec7',
          'fpserg/RealMe@b701e303e0e716dd54099938fab092d419d30e61:docs/PRODUCT/DAILY/2026/08/2026-08-29/LI.md#whole_file'
        ),
        (
          'li-2026-08-30', 'A', 'living_input',
          'docs/PRODUCT/DAILY/2026/08/2026-08-30/LI.md',
          '92171a19ded89d4dedce3ba83752a31e18fc2818',
          'fpserg/RealMe@b701e303e0e716dd54099938fab092d419d30e61:docs/PRODUCT/DAILY/2026/08/2026-08-30/LI.md#whole_file'
        ),
        (
          'or-2026-08-30-realme', 'B', 'operational_record',
          'docs/PRODUCT/DAILY/2026/08/2026-08-30/OR.md',
          '114a7d89a2492bcc1cb0c25a4213d2cc5577d1a1',
          'fpserg/RealMe@b701e303e0e716dd54099938fab092d419d30e61:docs/PRODUCT/DAILY/2026/08/2026-08-30/OR.md#exact_text:7ac8175d400fa524d1402ed2bcf6b312e0346d95723da6dd204b2025b0042d98'
        ),
        (
          'world-household-realm', 'C', 'accepted_product_decision',
          'docs/PRODUCT/VISUAL/REALME_WORLD_V1_CANONICAL_FREEZE.md',
          'c5400b3eb060b78bdfb9c5dd8d6cb94cd65645df',
          'fpserg/RealMe@b701e303e0e716dd54099938fab092d419d30e61:docs/PRODUCT/VISUAL/REALME_WORLD_V1_CANONICAL_FREEZE.md#exact_text:2e95c12b61a36ecee550ae26d918b840207e3d75570ee089522df27a6afbfa49'
        ),
        (
          'wbtd-2026-08-30-realme-roadmap', 'D', 'wbtd_interpretation',
          'docs/PRODUCT/DAILY/2026/08/2026-08-30/WBTD.md',
          'f803e54685925b0db2dd3bf29beb44f1792cd6df',
          'fpserg/RealMe@b701e303e0e716dd54099938fab092d419d30e61:docs/PRODUCT/DAILY/2026/08/2026-08-30/WBTD.md#exact_text:cf3dfaf9b36527fbfa91757b2b335fe1a3df31d75ba5bc059a7e84a97739805b'
        )
    ) AS expected(id, authority_class, source_kind, source_path, source_blob_sha, source_locator)
      ON expected.id = source.source_item_id
    WHERE expected.id IS NULL
       OR source.authority_class IS DISTINCT FROM expected.authority_class
       OR source.source_kind IS DISTINCT FROM 'sergey_pilot:' || expected.authority_class || ':' || expected.source_kind
       OR source.source_repository IS DISTINCT FROM 'fpserg/RealMe'
       OR source.source_commit IS DISTINCT FROM 'b701e303e0e716dd54099938fab092d419d30e61'
       OR source.source_tree IS DISTINCT FROM 'b5b3edd5d31cc1a4955a493ad0d9dd8948550d88'
       OR source.source_path IS DISTINCT FROM expected.source_path
       OR source.source_blob_sha IS DISTINCT FROM expected.source_blob_sha
       OR source.source_locator IS DISTINCT FROM expected.source_locator
       OR source.occurred_at IS NOT NULL
       OR source.occurred_precision IS DISTINCT FROM 'unknown'
       OR source.content_hash IS DISTINCT FROM encode(
            extensions.digest(convert_to(source.exact_text, 'UTF8'), 'sha256'),
            'hex'
          )
  ) THEN
    RAISE EXCEPTION 'Step 107 control-plane source-plan provenance mismatch.';
  END IF;

  IF (
    SELECT count(*)
    FROM (
      VALUES
        ('li-2026-08-29'),
        ('li-2026-08-30'),
        ('or-2026-08-30-realme'),
        ('world-household-realm'),
        ('wbtd-2026-08-30-realme-roadmap')
    ) AS expected(id)
    JOIN step107_source_items AS source ON source.source_item_id = expected.id
  ) <> 5 THEN
    RAISE EXCEPTION 'Step 107 control-plane approved item-set mismatch.';
  END IF;

  PERFORM set_config('realme.step107_executor_guard', 'transactional-v1', true);
  PERFORM set_config('realme.step107_world_id', v_world_id::text, true);
  PERFORM set_config('realme.step107_account_id', v_account_id::text, true);

  IF current_setting('realme.step107_executor_guard', true) IS DISTINCT FROM 'transactional-v1'
     OR current_setting('realme.step107_world_id', true)::uuid IS DISTINCT FROM v_world_id
     OR current_setting('realme.step107_account_id', true)::uuid IS DISTINCT FROM v_account_id
  THEN
    RAISE EXCEPTION 'Step 107 control-plane transaction-local execution context mismatch.';
  END IF;

  SELECT count(*) INTO v_before_observations
  FROM public.observations AS observation
  JOIN step107_source_items AS source ON source.observation_id = observation.id
  WHERE observation.world_id = v_world_id;

  SELECT count(*) INTO v_before_fragments
  FROM public.source_fragments AS fragment
  JOIN step107_source_items AS source ON source.fragment_id = fragment.id
  WHERE fragment.world_id = v_world_id;

  SELECT count(*) INTO v_before_admission FROM public.admission_decisions WHERE world_id = v_world_id;
  SELECT count(*) INTO v_before_nodes FROM public.ontology_nodes WHERE world_id = v_world_id;
  SELECT count(*) INTO v_before_assertions FROM public.assertions WHERE world_id = v_world_id;

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
    v_world_id,
    v_account_id,
    source.source_kind,
    source.source_locator,
    source.occurred_at,
    source.occurred_precision,
    source.local_calendar_date,
    source.capture_idempotency_key
  FROM step107_source_items AS source
  ON CONFLICT (id) DO NOTHING;

  IF COALESCE((v_payload #>> '{test,failAfterObservationInsert}')::boolean, false) THEN
    RAISE EXCEPTION 'Step 107 deliberate rollback test after observation insert.';
  END IF;

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
    v_world_id,
    source.observation_id,
    0,
    source.exact_text,
    source.content_hash
  FROM step107_source_items AS source
  ON CONFLICT (id) DO NOTHING;

  IF EXISTS (
    SELECT 1
    FROM step107_source_items AS source
    LEFT JOIN public.observations AS observation
      ON observation.world_id = v_world_id
     AND observation.id = source.observation_id
    LEFT JOIN public.source_fragments AS fragment
      ON fragment.world_id = v_world_id
     AND fragment.id = source.fragment_id
    WHERE observation.id IS NULL
       OR fragment.id IS NULL
       OR observation.recorded_by_account_id IS DISTINCT FROM v_account_id
       OR observation.source_kind IS DISTINCT FROM source.source_kind
       OR observation.source_locator IS DISTINCT FROM source.source_locator
       OR observation.occurred_at IS DISTINCT FROM source.occurred_at
       OR observation.occurred_precision IS DISTINCT FROM source.occurred_precision
       OR observation.local_calendar_date IS DISTINCT FROM source.local_calendar_date
       OR observation.capture_idempotency_key IS DISTINCT FROM source.capture_idempotency_key
       OR fragment.observation_id IS DISTINCT FROM source.observation_id
       OR fragment.ordinal <> 0
       OR fragment.exact_text IS DISTINCT FROM source.exact_text
       OR fragment.content_hash IS DISTINCT FROM source.content_hash
  ) THEN
    RAISE EXCEPTION 'Step 107 replay mismatch: persisted evidence differs from pinned source plan.';
  END IF;

  SELECT count(*) INTO v_after_observations
  FROM public.observations AS observation
  JOIN step107_source_items AS source ON source.observation_id = observation.id
  WHERE observation.world_id = v_world_id;

  SELECT count(*) INTO v_after_fragments
  FROM public.source_fragments AS fragment
  JOIN step107_source_items AS source ON source.fragment_id = fragment.id
  WHERE fragment.world_id = v_world_id;

  SELECT count(*) INTO v_after_admission FROM public.admission_decisions WHERE world_id = v_world_id;
  SELECT count(*) INTO v_after_nodes FROM public.ontology_nodes WHERE world_id = v_world_id;
  SELECT count(*) INTO v_after_assertions FROM public.assertions WHERE world_id = v_world_id;

  IF v_after_admission IS DISTINCT FROM v_before_admission
     OR v_after_nodes IS DISTINCT FROM v_before_nodes
     OR v_after_assertions IS DISTINCT FROM v_before_assertions
  THEN
    RAISE EXCEPTION 'Step 107 control-plane canonical/admission state changed.';
  END IF;

  IF v_after_observations <> 5 OR v_after_fragments <> 5 THEN
    RAISE EXCEPTION 'Step 107 control-plane durable evidence cardinality mismatch.';
  END IF;

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
  )
  INTO v_fingerprint
  FROM step107_source_items AS source
  JOIN public.observations AS observation
    ON observation.world_id = v_world_id
   AND observation.id = source.observation_id
  JOIN public.source_fragments AS fragment
    ON fragment.world_id = v_world_id
   AND fragment.id = source.fragment_id;

  v_result := jsonb_build_object(
    'sourcePlanItemCount', 5,
    'beforeObservationCount', v_before_observations,
    'afterObservationCount', v_after_observations,
    'observationsInserted', v_after_observations - v_before_observations,
    'beforeFragmentCount', v_before_fragments,
    'afterFragmentCount', v_after_fragments,
    'fragmentsInserted', v_after_fragments - v_before_fragments,
    'reconciliationFingerprint', v_fingerprint,
    'admissionDecisionsBefore', v_before_admission,
    'admissionDecisionsAfter', v_after_admission,
    'ontologyNodesBefore', v_before_nodes,
    'ontologyNodesAfter', v_after_nodes,
    'assertionsBefore', v_before_assertions,
    'assertionsAfter', v_after_assertions
  );

  RAISE NOTICE 'STEP107_CONTROL_PLANE_RESULT %', v_result::text;
END;
$step107$;
