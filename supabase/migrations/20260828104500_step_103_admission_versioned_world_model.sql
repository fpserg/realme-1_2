CREATE UNIQUE INDEX admission_decisions_final_candidate_unique
  ON public.admission_decisions (world_id, candidate_claim_id)
  WHERE decision_kind IN ('accept', 'reject', 'correct');
--> statement-breakpoint
CREATE UNIQUE INDEX admission_decisions_defer_actor_unique
  ON public.admission_decisions (world_id, candidate_claim_id, decided_by_account_id)
  WHERE decision_kind = 'defer';
--> statement-breakpoint
CREATE UNIQUE INDEX assertions_admission_decision_unique
  ON public.assertions (admitted_by_decision_id);
--> statement-breakpoint
CREATE UNIQUE INDEX assertions_successor_unique
  ON public.assertions (supersedes_assertion_id)
  WHERE supersedes_assertion_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX assertions_active_subject_predicate_unique
  ON public.assertions (world_id, subject_node_id, predicate)
  WHERE subject_node_id IS NOT NULL AND valid_to IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX ontology_nodes_admission_decision_unique
  ON public.ontology_nodes (admitted_by_decision_id);
--> statement-breakpoint
CREATE UNIQUE INDEX ontology_aliases_admission_decision_unique
  ON public.ontology_aliases (admitted_by_decision_id)
  WHERE supersedes_alias_id IS NULL;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.list_candidate_reviews()
RETURNS TABLE (
  candidate_claim_id uuid,
  proposed_subject_node_id uuid,
  candidate_payload jsonb,
  evidence jsonb,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT
    candidate.id,
    candidate.proposed_subject_node_id,
    candidate.payload,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'source_fragment_id', fragment.id,
          'exact_text', fragment.exact_text,
          'ordinal', fragment.ordinal
        ) ORDER BY fragment.ordinal, fragment.id
      ) FILTER (WHERE fragment.id IS NOT NULL),
      '[]'::jsonb
    ) AS evidence,
    candidate.created_at
  FROM public.candidate_claims AS candidate
  JOIN public.world_memberships AS membership
    ON membership.world_id = candidate.world_id
   AND membership.user_id = (SELECT auth.uid())
   AND membership.role = 'owner'
  LEFT JOIN public.candidate_claim_evidence AS link
    ON link.world_id = candidate.world_id
   AND link.candidate_claim_id = candidate.id
  LEFT JOIN public.source_fragments AS fragment
    ON fragment.world_id = link.world_id
   AND fragment.id = link.source_fragment_id
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.admission_decisions AS decision
      WHERE decision.world_id = candidate.world_id
        AND decision.candidate_claim_id = candidate.id
        AND decision.decision_kind IN ('accept', 'reject', 'correct')
    )
  GROUP BY candidate.id, candidate.proposed_subject_node_id, candidate.payload, candidate.created_at
  ORDER BY candidate.created_at DESC, candidate.id DESC;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.list_candidate_reviews() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.list_candidate_reviews() TO authenticated;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.decide_candidate(
  p_candidate_claim_id uuid,
  p_action text,
  p_correction_payload jsonb DEFAULT NULL
)
RETURNS TABLE (
  candidate_claim_id uuid,
  decision_id uuid,
  decision_action text,
  canonical_assertion_id uuid,
  canonical_node_id uuid,
  superseded_assertion_id uuid,
  was_replay boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_world_id uuid;
  v_candidate public.candidate_claims%ROWTYPE;
  v_existing public.admission_decisions%ROWTYPE;
  v_decision_id uuid;
  v_payload jsonb;
  v_subject text;
  v_predicate text;
  v_object jsonb;
  v_subject_node_id uuid;
  v_node_id uuid;
  v_assertion_id uuid;
  v_prior_assertion_id uuid;
  v_prior_valid_from timestamptz;
  v_now timestamptz := statement_timestamp();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF p_candidate_claim_id IS NULL
    OR p_action NOT IN ('accept', 'reject', 'correct', 'defer')
  THEN
    RAISE EXCEPTION 'A candidate and allowed admission action are required.'
      USING ERRCODE = '22023';
  END IF;

  SELECT candidate.*
  INTO v_candidate
  FROM public.candidate_claims AS candidate
  WHERE candidate.id = p_candidate_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found.' USING ERRCODE = 'P0002';
  END IF;

  v_world_id := v_candidate.world_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.world_memberships AS membership
    WHERE membership.world_id = v_world_id
      AND membership.user_id = v_actor_id
      AND membership.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Candidate is outside the authenticated World.'
      USING ERRCODE = '42501';
  END IF;

  SELECT decision.*
  INTO v_existing
  FROM public.admission_decisions AS decision
  WHERE decision.world_id = v_world_id
    AND decision.candidate_claim_id = p_candidate_claim_id
    AND decision.decision_kind IN ('accept', 'reject', 'correct')
  ORDER BY decision.decided_at, decision.id
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.decision_kind IS DISTINCT FROM p_action THEN
      RAISE EXCEPTION 'Candidate already has a conflicting final decision.'
        USING ERRCODE = '23505';
    END IF;

    IF p_action = 'correct'
      AND v_existing.correction_payload IS DISTINCT FROM p_correction_payload
    THEN
      RAISE EXCEPTION 'Correction replay payload does not match the admitted correction.'
        USING ERRCODE = '23505';
    END IF;

    RETURN QUERY
    SELECT
      p_candidate_claim_id,
      v_existing.id,
      v_existing.decision_kind,
      assertion.id,
      node.id,
      assertion.supersedes_assertion_id,
      true
    FROM (SELECT 1) AS one
    LEFT JOIN public.assertions AS assertion
      ON assertion.world_id = v_world_id
     AND assertion.admitted_by_decision_id = v_existing.id
    LEFT JOIN public.ontology_nodes AS node
      ON node.world_id = v_world_id
     AND node.admitted_by_decision_id = v_existing.id
    LIMIT 1;
    RETURN;
  END IF;

  IF p_action = 'defer' THEN
    IF p_correction_payload IS NOT NULL THEN
      RAISE EXCEPTION 'Deferral does not accept a correction payload.' USING ERRCODE = '22023';
    END IF;

    SELECT decision.id
    INTO v_decision_id
    FROM public.admission_decisions AS decision
    WHERE decision.world_id = v_world_id
      AND decision.candidate_claim_id = p_candidate_claim_id
      AND decision.decision_kind = 'defer'
      AND decision.decided_by_account_id = v_actor_id
    LIMIT 1;

    IF v_decision_id IS NOT NULL THEN
      RETURN QUERY SELECT p_candidate_claim_id, v_decision_id, 'defer'::text,
        NULL::uuid, NULL::uuid, NULL::uuid, true;
      RETURN;
    END IF;

    INSERT INTO public.admission_decisions (
      world_id,
      candidate_claim_id,
      decision_kind,
      authority_kind,
      decided_by_account_id
    )
    VALUES (v_world_id, p_candidate_claim_id, 'defer', 'user', v_actor_id)
    RETURNING id INTO v_decision_id;

    INSERT INTO public.audit_events (
      world_id, actor_kind, actor_account_id, action, entity_type, entity_id, metadata
    ) VALUES (
      v_world_id, 'user', v_actor_id, 'candidate_deferred', 'candidate_claim',
      p_candidate_claim_id,
      jsonb_build_object('decision_id', v_decision_id)
    );

    RETURN QUERY SELECT p_candidate_claim_id, v_decision_id, 'defer'::text,
      NULL::uuid, NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  IF p_action = 'correct' THEN
    IF p_correction_payload IS NULL
      OR jsonb_typeof(p_correction_payload) <> 'object'
      OR NOT (p_correction_payload ?& ARRAY['subject', 'predicate', 'object'])
      OR (p_correction_payload - ARRAY['subject', 'predicate', 'object']) <> '{}'::jsonb
      OR jsonb_typeof(p_correction_payload->'subject') <> 'string'
      OR length(p_correction_payload->>'subject') NOT BETWEEN 1 AND 160
      OR jsonb_typeof(p_correction_payload->'predicate') <> 'string'
      OR (p_correction_payload->>'predicate') !~ '^[a-z][a-z0-9_]*$'
      OR length(p_correction_payload->>'predicate') > 64
      OR jsonb_typeof(p_correction_payload->'object') NOT IN ('string', 'number', 'boolean')
      OR (jsonb_typeof(p_correction_payload->'object') = 'string'
          AND length(p_correction_payload->>'object') > 500)
    THEN
      RAISE EXCEPTION 'Corrected durable meaning is invalid.' USING ERRCODE = '22023';
    END IF;
    v_payload := p_correction_payload;
  ELSE
    IF p_correction_payload IS NOT NULL THEN
      RAISE EXCEPTION 'Only correction accepts a correction payload.' USING ERRCODE = '22023';
    END IF;
    v_payload := jsonb_build_object(
      'subject', v_candidate.payload->'subject',
      'predicate', v_candidate.payload->'predicate',
      'object', v_candidate.payload->'object'
    );
  END IF;

  INSERT INTO public.admission_decisions (
    world_id,
    candidate_claim_id,
    decision_kind,
    authority_kind,
    decided_by_account_id,
    correction_payload
  ) VALUES (
    v_world_id,
    p_candidate_claim_id,
    p_action,
    'user',
    v_actor_id,
    CASE WHEN p_action = 'correct' THEN v_payload ELSE NULL END
  )
  RETURNING id INTO v_decision_id;

  IF p_action = 'reject' THEN
    INSERT INTO public.audit_events (
      world_id, actor_kind, actor_account_id, action, entity_type, entity_id, metadata
    ) VALUES (
      v_world_id, 'user', v_actor_id, 'candidate_rejected', 'candidate_claim',
      p_candidate_claim_id,
      jsonb_build_object('decision_id', v_decision_id)
    );

    RETURN QUERY SELECT p_candidate_claim_id, v_decision_id, 'reject'::text,
      NULL::uuid, NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;

  v_subject := v_payload->>'subject';
  v_predicate := v_payload->>'predicate';
  v_object := v_payload->'object';
  v_subject_node_id := v_candidate.proposed_subject_node_id;

  IF v_predicate = 'classification' AND v_subject_node_id IS NULL THEN
    INSERT INTO public.ontology_nodes (world_id, admitted_by_decision_id)
    VALUES (v_world_id, v_decision_id)
    RETURNING id INTO v_node_id;

    INSERT INTO public.ontology_aliases (
      world_id, node_id, alias, admitted_by_decision_id
    ) VALUES (
      v_world_id, v_node_id, v_subject, v_decision_id
    );

    v_subject_node_id := v_node_id;
  ELSE
    v_node_id := NULL;
  END IF;

  IF v_subject_node_id IS NOT NULL THEN
    SELECT assertion.id, assertion.valid_from
    INTO v_prior_assertion_id, v_prior_valid_from
    FROM public.assertions AS assertion
    WHERE assertion.world_id = v_world_id
      AND assertion.subject_node_id = v_subject_node_id
      AND assertion.predicate = v_predicate
      AND assertion.valid_to IS NULL
    ORDER BY assertion.created_at DESC, assertion.id DESC
    LIMIT 1
    FOR UPDATE;

    IF v_prior_assertion_id IS NOT NULL THEN
      v_now := greatest(
        clock_timestamp(),
        v_prior_valid_from + interval '1 microsecond'
      );

      UPDATE public.assertions
      SET valid_to = v_now
      WHERE world_id = v_world_id
        AND id = v_prior_assertion_id
        AND valid_to IS NULL;
    END IF;
  END IF;

  INSERT INTO public.assertions (
    world_id,
    subject_node_id,
    predicate,
    value,
    valid_from,
    admitted_by_decision_id,
    supersedes_assertion_id
  ) VALUES (
    v_world_id,
    v_subject_node_id,
    v_predicate,
    v_object,
    v_now,
    v_decision_id,
    v_prior_assertion_id
  )
  RETURNING id INTO v_assertion_id;

  INSERT INTO public.assertion_evidence (world_id, assertion_id, source_fragment_id)
  SELECT link.world_id, v_assertion_id, link.source_fragment_id
  FROM public.candidate_claim_evidence AS link
  WHERE link.world_id = v_world_id
    AND link.candidate_claim_id = p_candidate_claim_id;

  INSERT INTO public.audit_events (
    world_id, actor_kind, actor_account_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_world_id,
    'user',
    v_actor_id,
    'candidate_admitted',
    'assertion',
    v_assertion_id,
    jsonb_build_object(
      'candidate_claim_id', p_candidate_claim_id,
      'interpretation_run_id', v_candidate.interpretation_run_id,
      'decision_id', v_decision_id,
      'corrected', p_action = 'correct',
      'supersedes_assertion_id', v_prior_assertion_id,
      'created_node_id', v_node_id
    )
  );

  RETURN QUERY SELECT
    p_candidate_claim_id,
    v_decision_id,
    p_action,
    v_assertion_id,
    v_node_id,
    v_prior_assertion_id,
    false;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.decide_candidate(uuid, text, jsonb)
FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.decide_candidate(uuid, text, jsonb)
TO authenticated;
--> statement-breakpoint

REVOKE INSERT, UPDATE, DELETE ON public.admission_decisions FROM anon, authenticated;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON public.ontology_nodes FROM anon, authenticated;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON public.ontology_aliases FROM anon, authenticated;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON public.ontology_relationships FROM anon, authenticated;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON public.assertions FROM anon, authenticated;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON public.assertion_evidence FROM anon, authenticated;
