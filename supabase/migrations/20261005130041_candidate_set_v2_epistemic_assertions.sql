-- Phase 4P: versioned candidates and isolated epistemic canonical truth.
CREATE FUNCTION private.valid_candidate_meaning_v2(p jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT coalesce(jsonb_typeof(p) = 'object'
   AND p ?& ARRAY['kind','subject','predicate','object']
   AND jsonb_typeof(p->'subject') = 'string' AND length(btrim(p->>'subject')) BETWEEN 1 AND 160
   AND jsonb_typeof(p->'predicate') = 'string' AND p->>'predicate' ~ '^[a-z][a-z0-9_]{0,63}$'
   AND jsonb_typeof(p->'object') IN ('string','number','boolean')
   AND (jsonb_typeof(p->'object') <> 'string' OR length(p->>'object') <= 500)
   AND ((p->>'kind' = 'proposition' AND (p - ARRAY['kind','subject','predicate','object']) = '{}'::jsonb)
     OR (p->>'kind' = 'epistemic_proposition'
       AND p ? 'epistemic' AND (p - ARRAY['kind','subject','predicate','object','epistemic']) = '{}'::jsonb
       AND jsonb_typeof(p->'epistemic') = 'object'
       AND p->'epistemic' ?& ARRAY['actor','mode']
       AND ((p->'epistemic') - ARRAY['actor','mode']) = '{}'::jsonb
       AND jsonb_typeof(p->'epistemic'->'actor') = 'string'
       AND length(btrim(p->'epistemic'->>'actor')) BETWEEN 1 AND 160
       AND p->'epistemic'->>'mode' IN ('estimate','belief','assessment','report','feeling'))), false);
$$;
REVOKE ALL ON FUNCTION private.valid_candidate_meaning_v2(jsonb) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.jobs DROP CONSTRAINT jobs_interpret_observation_input_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_interpret_observation_input_check CHECK (
  coalesce(observation_id IS NOT NULL AND jsonb_typeof(payload) = 'object'
  AND payload ?& ARRAY['prompt_version','schema_version']
  AND (payload - ARRAY['prompt_version','schema_version']) = '{}'::jsonb
  AND ((payload->>'prompt_version' IN ('interpret-observation-v1','interpret-observation-v2','interpret-observation-v3')
        AND payload->>'schema_version' = 'candidate-set-v1')
    OR (payload->>'prompt_version' = 'interpret-observation-v4' AND payload->>'schema_version' = 'candidate-set-v2')), false));

-- Preserve historical v1 payload semantics in the closed versioned disjunction.
ALTER TABLE public.candidate_claims DROP CONSTRAINT candidate_claims_step_102_kind_check;
ALTER TABLE public.candidate_claims DROP CONSTRAINT candidate_claims_step_102_payload_check;
ALTER TABLE public.candidate_claims ADD CONSTRAINT candidate_claims_step_102_kind_check
  CHECK (claim_kind IN ('proposition','epistemic_proposition'));
ALTER TABLE public.candidate_claims ADD CONSTRAINT candidate_claims_step_102_payload_check CHECK (
  coalesce((payload->>'schema_version' = 'candidate-set-v1' AND claim_kind = 'proposition'
   AND payload ?& array['subject', 'predicate', 'object', 'explanation', 'confidence', 'schema_version']
   AND (payload - array['subject', 'predicate', 'object', 'explanation', 'confidence', 'schema_version']) = '{}'::jsonb
   AND jsonb_typeof(payload->'subject') = 'string' AND length(payload->>'subject') between 1 and 160
   AND jsonb_typeof(payload->'predicate') = 'string' AND payload->>'predicate' ~ '^[a-z][a-z0-9_]*$' AND length(payload->>'predicate') <= 64
   AND jsonb_typeof(payload->'object') in ('string', 'number', 'boolean') AND (jsonb_typeof(payload->'object') <> 'string' or length(payload->>'object') <= 500)
   AND jsonb_typeof(payload->'explanation') = 'string' AND length(payload->>'explanation') between 1 and 500
   AND jsonb_typeof(payload->'confidence') = 'number' AND (payload->>'confidence')::numeric between 0 and 1)
  OR (payload ?& ARRAY['schema_version','explanation','confidence','kind']
   AND payload->>'schema_version' = 'candidate-set-v2' AND claim_kind = payload->>'kind'
   AND private.valid_candidate_meaning_v2(payload - ARRAY['schema_version','explanation','confidence'])
   AND jsonb_typeof(payload->'explanation') = 'string' AND length(payload->>'explanation') BETWEEN 1 AND 500
   AND jsonb_typeof(payload->'confidence') = 'number' AND (payload->>'confidence')::numeric BETWEEN 0 AND 1), false)
);

CREATE TABLE public.epistemic_assertions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 world_id uuid NOT NULL REFERENCES public.worlds(id) ON DELETE RESTRICT,
 subject_node_id uuid NOT NULL,
 predicate text NOT NULL CHECK (predicate ~ '^[a-z][a-z0-9_]{0,63}$'),
 value jsonb NOT NULL CHECK (jsonb_typeof(value) IN ('string','number','boolean')),
 epistemic_actor_node_id uuid NOT NULL,
 epistemic_mode text NOT NULL CHECK (epistemic_mode IN ('estimate','belief','assessment','report','feeling')),
 admitted_by_decision_id uuid NOT NULL UNIQUE,
 supersedes_epistemic_assertion_id uuid UNIQUE,
 valid_from timestamptz NOT NULL DEFAULT now(),
 valid_to timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (world_id,id),
 FOREIGN KEY (world_id,subject_node_id) REFERENCES public.ontology_nodes(world_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (world_id,epistemic_actor_node_id) REFERENCES public.ontology_nodes(world_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (world_id,admitted_by_decision_id) REFERENCES public.admission_decisions(world_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (world_id,supersedes_epistemic_assertion_id) REFERENCES public.epistemic_assertions(world_id,id) ON DELETE RESTRICT,
 CHECK (supersedes_epistemic_assertion_id IS DISTINCT FROM id),
 CHECK (valid_to IS NULL OR valid_to > valid_from)
);
COMMENT ON TABLE public.epistemic_assertions IS 'Actor MODE [core content], never the core as ordinary truth. UUID identity; coexistence by default. Validity describes admission/correction history, not an inferred belief interval.';
CREATE TABLE public.epistemic_assertion_evidence (
 world_id uuid NOT NULL REFERENCES public.worlds(id) ON DELETE RESTRICT,
 epistemic_assertion_id uuid NOT NULL,
 source_fragment_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (epistemic_assertion_id,source_fragment_id),
 FOREIGN KEY (world_id,epistemic_assertion_id) REFERENCES public.epistemic_assertions(world_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (world_id,source_fragment_id) REFERENCES public.source_fragments(world_id,id) ON DELETE RESTRICT
);
ALTER TABLE public.epistemic_assertions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epistemic_assertion_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.epistemic_assertions, public.epistemic_assertion_evidence FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.epistemic_assertions, public.epistemic_assertion_evidence TO authenticated;
CREATE POLICY epistemic_assertions_member_read ON public.epistemic_assertions FOR SELECT TO authenticated USING (private.is_world_member(world_id));
CREATE POLICY epistemic_evidence_member_read ON public.epistemic_assertion_evidence FOR SELECT TO authenticated USING (private.is_world_member(world_id));

CREATE FUNCTION private.resolve_epistemic_identity(w uuid, label text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE n integer; result uuid;
BEGIN
 SELECT count(DISTINCT a.node_id), min(a.node_id::text)::uuid INTO n,result
 FROM public.ontology_aliases a JOIN public.ontology_nodes o ON o.world_id=a.world_id AND o.id=a.node_id
 WHERE a.world_id=w AND a.valid_to IS NULL
 AND lower(regexp_replace(btrim(a.alias),'\s+',' ','g'))=lower(regexp_replace(btrim(label),'\s+',' ','g'));
 IF n <> 1 THEN RAISE EXCEPTION 'Epistemic identity unresolved or ambiguous.' USING ERRCODE='22023'; END IF;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION private.resolve_epistemic_identity(uuid,text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.guard_epistemic_history()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE d public.admission_decisions%ROWTYPE; meaning jsonb; predecessor public.epistemic_assertions%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Epistemic history is append-only.'; END IF;
 IF TG_OP='UPDATE' THEN
   IF (to_jsonb(NEW)-'valid_to') IS DISTINCT FROM (to_jsonb(OLD)-'valid_to') OR OLD.valid_to IS NOT NULL OR NEW.valid_to IS NULL THEN
     RAISE EXCEPTION 'Only explicit correction may close an epistemic version.';
   END IF;
   IF NOT EXISTS (SELECT 1 FROM public.epistemic_assertions successor WHERE successor.world_id=OLD.world_id AND successor.supersedes_epistemic_assertion_id=OLD.id AND successor.valid_from=NEW.valid_to) THEN
     RAISE EXCEPTION 'Explicit successor required.';
   END IF;
   RETURN NEW;
 END IF;
 SELECT * INTO d FROM public.admission_decisions WHERE world_id=NEW.world_id AND id=NEW.admitted_by_decision_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Epistemic canonical meaning requires an admitting decision.'; END IF;
 SELECT CASE WHEN d.decision_kind='correct' THEN d.correction_payload ELSE c.payload END INTO meaning
 FROM public.candidate_claims c WHERE c.world_id=d.world_id AND c.id=d.candidate_claim_id;
 IF NOT FOUND OR meaning IS NULL OR d.decision_kind NOT IN ('accept','correct') OR meaning->>'kind' IS DISTINCT FROM 'epistemic_proposition'
    OR NEW.predicate IS DISTINCT FROM meaning->>'predicate' OR NEW.value IS DISTINCT FROM meaning->'object'
    OR NEW.epistemic_mode IS DISTINCT FROM meaning->'epistemic'->>'mode'
    OR NEW.subject_node_id IS DISTINCT FROM private.resolve_epistemic_identity(NEW.world_id,meaning->>'subject')
    OR NEW.epistemic_actor_node_id IS DISTINCT FROM private.resolve_epistemic_identity(NEW.world_id,meaning->'epistemic'->>'actor') THEN
   RAISE EXCEPTION 'Epistemic canonical meaning requires its exact admitting decision.';
 END IF;
 IF NEW.supersedes_epistemic_assertion_id IS NOT NULL THEN
   IF d.decision_kind <> 'correct' OR (meaning->>'supersedes_epistemic_assertion_id')::uuid IS DISTINCT FROM NEW.supersedes_epistemic_assertion_id THEN
     RAISE EXCEPTION 'Explicit correction predecessor required.';
   END IF;
   SELECT * INTO predecessor FROM public.epistemic_assertions WHERE world_id=NEW.world_id AND id=NEW.supersedes_epistemic_assertion_id FOR UPDATE;
   IF NOT FOUND OR predecessor.valid_to IS NOT NULL OR NEW.valid_from <= predecessor.valid_from THEN RAISE EXCEPTION 'Invalid epistemic correction predecessor.'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_epistemic_history() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER epistemic_history_guard BEFORE INSERT OR UPDATE OR DELETE ON public.epistemic_assertions FOR EACH ROW EXECUTE FUNCTION private.guard_epistemic_history();

-- A qualified admission can never be used to materialize its core as ordinary truth.
CREATE FUNCTION private.deny_embedded_ordinary_assertion()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.admission_decisions d JOIN public.candidate_claims c ON c.world_id=d.world_id AND c.id=d.candidate_claim_id
   WHERE d.world_id=NEW.world_id AND d.id=NEW.admitted_by_decision_id
   AND (CASE WHEN d.decision_kind='correct' THEN d.correction_payload ELSE c.payload END)->>'kind'='epistemic_proposition') THEN
   RAISE EXCEPTION 'Embedded epistemic content is not ordinary truth.';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.deny_embedded_ordinary_assertion() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER no_embedded_ordinary_assertion BEFORE INSERT OR UPDATE ON public.assertions FOR EACH ROW EXECUTE FUNCTION private.deny_embedded_ordinary_assertion();

CREATE FUNCTION private.guard_epistemic_evidence()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Epistemic evidence is append-only.'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.epistemic_assertions a JOIN public.admission_decisions d ON d.world_id=a.world_id AND d.id=a.admitted_by_decision_id
 JOIN public.candidate_claim_evidence e ON e.world_id=d.world_id AND e.candidate_claim_id=d.candidate_claim_id
 WHERE a.world_id=NEW.world_id AND a.id=NEW.epistemic_assertion_id AND e.source_fragment_id=NEW.source_fragment_id) THEN
   RAISE EXCEPTION 'Evidence must support the admitted semantic unit.';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_epistemic_evidence() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER epistemic_evidence_guard BEFORE INSERT OR UPDATE OR DELETE ON public.epistemic_assertion_evidence FOR EACH ROW EXECUTE FUNCTION private.guard_epistemic_evidence();

DROP FUNCTION public.decide_candidate(uuid,text,jsonb);
CREATE FUNCTION public.decide_candidate(
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
  was_replay boolean,
  canonical_epistemic_assertion_id uuid
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
  v_normalized_subject text;
  v_subject_node_id uuid;
  v_resolved_alias_node_id uuid;
  v_alias_match_count integer;
  v_node_id uuid;
  v_assertion_id uuid;
  v_prior_assertion_id uuid;
  v_prior_valid_from timestamptz;
  v_is_v2 boolean;
  v_epistemic_id uuid;
  v_epistemic_actor_id uuid;
  v_prior_epistemic_id uuid;
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
  v_is_v2 := v_candidate.payload->>'schema_version' = 'candidate-set-v2';

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

  IF p_action <> 'correct' AND p_correction_payload IS NOT NULL THEN
    RAISE EXCEPTION 'Only correction accepts corrected durable meaning.' USING ERRCODE='22023';
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
      true,
      epistemic.id
    FROM (SELECT 1) AS one
    LEFT JOIN public.assertions AS assertion
      ON assertion.world_id = v_world_id
     AND assertion.admitted_by_decision_id = v_existing.id
    LEFT JOIN public.epistemic_assertions AS epistemic
      ON epistemic.world_id = v_world_id AND epistemic.admitted_by_decision_id = v_existing.id
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
        NULL::uuid, NULL::uuid, NULL::uuid, true, NULL::uuid;
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
      NULL::uuid, NULL::uuid, NULL::uuid, false, NULL::uuid;
    RETURN;
  END IF;

  IF v_is_v2 THEN
    IF p_action = 'correct' THEN
      IF p_correction_payload IS NULL
        OR p_correction_payload->>'schema_version' IS DISTINCT FROM 'candidate-set-v2'
        OR NOT private.valid_candidate_meaning_v2(p_correction_payload - ARRAY['schema_version','supersedes_epistemic_assertion_id'])
        OR (p_correction_payload ? 'supersedes_epistemic_assertion_id'
          AND (p_correction_payload->>'kind' <> 'epistemic_proposition'
            OR jsonb_typeof(p_correction_payload->'supersedes_epistemic_assertion_id') <> 'string'))
      THEN RAISE EXCEPTION 'Complete candidate-set-v2 correction required.' USING ERRCODE='22023'; END IF;
      v_payload := p_correction_payload;
    ELSE
      v_payload := v_candidate.payload - ARRAY['confidence','explanation'];
    END IF;
  ELSIF p_action = 'correct' THEN
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
      NULL::uuid, NULL::uuid, NULL::uuid, false, NULL::uuid;
    RETURN;
  END IF;

  IF v_is_v2 AND NOT EXISTS (SELECT 1 FROM public.candidate_claim_evidence e WHERE e.world_id=v_world_id AND e.candidate_claim_id=p_candidate_claim_id) THEN
    RAISE EXCEPTION 'Exact candidate evidence required.' USING ERRCODE='22023';
  END IF;

  IF v_is_v2 AND v_payload->>'kind' = 'epistemic_proposition' THEN
    -- No identity creation here: both identities must independently resolve.
    v_subject_node_id := private.resolve_epistemic_identity(v_world_id,v_payload->>'subject');
    v_epistemic_actor_id := private.resolve_epistemic_identity(v_world_id,v_payload->'epistemic'->>'actor');
    IF v_candidate.proposed_subject_node_id IS NOT NULL AND v_candidate.proposed_subject_node_id <> v_subject_node_id THEN
      RAISE EXCEPTION 'Proposed core subject is incompatible.' USING ERRCODE='22023';
    END IF;
    v_prior_epistemic_id := (v_payload->>'supersedes_epistemic_assertion_id')::uuid;
    IF v_prior_epistemic_id IS NOT NULL THEN
      IF p_action <> 'correct' THEN RAISE EXCEPTION 'Only explicit correction may supersede.'; END IF;
      SELECT valid_from INTO v_prior_valid_from FROM public.epistemic_assertions
      WHERE world_id=v_world_id AND id=v_prior_epistemic_id AND valid_to IS NULL FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Epistemic predecessor unavailable.'; END IF;
      v_now := greatest(clock_timestamp(),v_prior_valid_from+interval '1 microsecond');
    END IF;
    INSERT INTO public.epistemic_assertions
      (world_id,subject_node_id,predicate,value,epistemic_actor_node_id,epistemic_mode,admitted_by_decision_id,supersedes_epistemic_assertion_id,valid_from)
    VALUES (v_world_id,v_subject_node_id,v_payload->>'predicate',v_payload->'object',v_epistemic_actor_id,v_payload->'epistemic'->>'mode',v_decision_id,v_prior_epistemic_id,v_now)
    RETURNING id INTO v_epistemic_id;
    IF v_prior_epistemic_id IS NOT NULL THEN
      UPDATE public.epistemic_assertions SET valid_to=v_now WHERE world_id=v_world_id AND id=v_prior_epistemic_id;
    END IF;
    INSERT INTO public.epistemic_assertion_evidence (world_id,epistemic_assertion_id,source_fragment_id)
    SELECT e.world_id,v_epistemic_id,e.source_fragment_id FROM public.candidate_claim_evidence e
    WHERE e.world_id=v_world_id AND e.candidate_claim_id=p_candidate_claim_id;
    INSERT INTO public.audit_events (world_id,actor_kind,actor_account_id,action,entity_type,entity_id,metadata)
    VALUES (v_world_id,'user',v_actor_id,'candidate_admitted','epistemic_assertion',v_epistemic_id,
      jsonb_build_object('candidate_claim_id',p_candidate_claim_id,'decision_id',v_decision_id,'supersedes_epistemic_assertion_id',v_prior_epistemic_id));
    RETURN QUERY SELECT p_candidate_claim_id,v_decision_id,p_action,NULL::uuid,NULL::uuid,NULL::uuid,false,v_epistemic_id;
    RETURN;
  END IF;

  v_subject := v_payload->>'subject';
  v_predicate := v_payload->>'predicate';
  v_object := v_payload->'object';
  v_normalized_subject := lower(regexp_replace(btrim(v_subject), '\s+', ' ', 'g'));

  -- Serialize canonical identity resolution/creation for this World + normalized subject.
  -- The transaction-scoped advisory lock is derived entirely inside PostgreSQL and
  -- releases automatically on commit/rollback. Resolution is intentionally performed
  -- only after this lock so different candidate rows cannot race first discovery.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_world_id::text || E'\x1f' || v_normalized_subject,
      0
    )
  );

  IF v_candidate.proposed_subject_node_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.ontology_nodes AS node
      WHERE node.world_id = v_world_id
        AND node.id = v_candidate.proposed_subject_node_id
    ) THEN
      RAISE EXCEPTION 'Proposed subject identity is outside this World or does not exist.'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.ontology_aliases AS alias
      WHERE alias.world_id = v_world_id
        AND alias.node_id = v_candidate.proposed_subject_node_id
        AND alias.valid_to IS NULL
        AND lower(regexp_replace(btrim(alias.alias), '\s+', ' ', 'g')) =
            lower(regexp_replace(btrim(v_subject), '\s+', ' ', 'g'))
    ) THEN
      RAISE EXCEPTION 'Proposed subject identity is incompatible with the admitted subject.'
        USING ERRCODE = '22023';
    END IF;

    v_subject_node_id := v_candidate.proposed_subject_node_id;
  ELSE
    SELECT
      count(DISTINCT alias.node_id)::integer,
      min(alias.node_id::text)::uuid
    INTO v_alias_match_count, v_resolved_alias_node_id
    FROM public.ontology_aliases AS alias
    WHERE alias.world_id = v_world_id
      AND alias.valid_to IS NULL
      AND lower(regexp_replace(btrim(alias.alias), '\s+', ' ', 'g')) =
          lower(regexp_replace(btrim(v_subject), '\s+', ' ', 'g'));

    IF v_alias_match_count = 1 THEN
      v_subject_node_id := v_resolved_alias_node_id;
    ELSIF v_alias_match_count > 1 THEN
      RAISE EXCEPTION 'Subject identity is ambiguous; correction or disambiguation is required.'
        USING ERRCODE = '22023';
    ELSIF v_predicate = 'classification' THEN
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
      RAISE EXCEPTION 'Subject identity is unresolved; correction is required before admission.'
        USING ERRCODE = '22023';
    END IF;
  END IF;

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
      'resolved_subject_node_id', v_subject_node_id,
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
    false,
    NULL::uuid;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.decide_candidate(uuid, text, jsonb)
FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.decide_candidate(uuid, text, jsonb)
TO authenticated;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.enqueue_observation_interpretation(
  p_observation_id uuid
)
RETURNS TABLE (
  job_id uuid,
  job_status text,
  was_created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_world_id uuid;
  v_job_id uuid;
  v_status text;
  v_was_created boolean := false;
  v_idempotency_key text;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT observation.world_id
  INTO v_world_id
  FROM public.observations AS observation
  JOIN public.world_memberships AS membership
    ON membership.world_id = observation.world_id
   AND membership.user_id = v_actor_id
  WHERE observation.id = p_observation_id
    AND observation.recorded_by_account_id = v_actor_id;

  IF v_world_id IS NULL THEN
    RAISE EXCEPTION 'observation unavailable' USING ERRCODE = '42501';
  END IF;

  v_idempotency_key := format(
    'observation:%s:prompt:%s:schema:%s',
    p_observation_id,
    'interpret-observation-v4',
    'candidate-set-v2'
  );

  INSERT INTO public.jobs (
    world_id,
    observation_id,
    job_kind,
    idempotency_key,
    status,
    payload
  ) VALUES (
    v_world_id,
    p_observation_id,
    'interpret_observation',
    v_idempotency_key,
    'queued',
    jsonb_build_object(
      'prompt_version', 'interpret-observation-v4',
      'schema_version', 'candidate-set-v2'
    )
  )
  ON CONFLICT (world_id, job_kind, idempotency_key) DO NOTHING
  RETURNING id, status INTO v_job_id, v_status;

  IF v_job_id IS NOT NULL THEN
    v_was_created := true;
  ELSE
    SELECT job.id, job.status
    INTO v_job_id, v_status
    FROM public.jobs AS job
    WHERE job.world_id = v_world_id
      AND job.job_kind = 'interpret_observation'
      AND job.idempotency_key = v_idempotency_key
      AND job.observation_id = p_observation_id;
  END IF;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'interpretation job unavailable';
  END IF;

  RETURN QUERY SELECT v_job_id, v_status, v_was_created;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_observation_interpretation(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_observation_interpretation(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.reconcile_observation_interpretations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := (SELECT auth.uid());
  v_observation_id uuid;
  v_processed integer := 0;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  FOR v_observation_id IN
    SELECT observation.id
    FROM public.observations AS observation
    WHERE observation.recorded_by_account_id = v_actor_id
      AND EXISTS (
        SELECT 1
        FROM public.world_memberships AS membership
        WHERE membership.world_id = observation.world_id
          AND membership.user_id = v_actor_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.jobs AS successful_job
        WHERE successful_job.world_id = observation.world_id
          AND successful_job.observation_id = observation.id
          AND successful_job.job_kind = 'interpret_observation'
          AND successful_job.status = 'succeeded'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.jobs AS active_job
        WHERE active_job.world_id = observation.world_id
          AND active_job.observation_id = observation.id
          AND active_job.job_kind = 'interpret_observation'
          AND active_job.payload->>'prompt_version' = 'interpret-observation-v4'
          AND active_job.payload->>'schema_version' = 'candidate-set-v2'
      )
    ORDER BY observation.recorded_at, observation.id
    FOR UPDATE OF observation SKIP LOCKED
    LIMIT 50
  LOOP
    PERFORM *
    FROM public.enqueue_observation_interpretation(v_observation_id);
    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_observation_interpretations()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_observation_interpretations()
  TO authenticated;

COMMENT ON FUNCTION public.reconcile_observation_interpretations() IS
  'Authenticated bounded oldest-missing repair: enqueue the active interpretation version only when no successful interpretation exists and no active-version job of any status already exists.';
