CREATE OR REPLACE FUNCTION private.require_admitting_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.admission_decisions decision
    WHERE decision.world_id = new.world_id
      AND decision.id = new.admitted_by_decision_id
      AND decision.decision_kind IN ('accept', 'correct')
  ) THEN
    RAISE EXCEPTION
      USING
        ERRCODE = '23514',
        MESSAGE = 'Canonical state requires an accepting or correcting admission decision.';
  END IF;

  RETURN new;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.require_admitting_decision()
FROM public, anon, authenticated;
--> statement-breakpoint
CREATE TRIGGER ontology_nodes_require_admission
  BEFORE INSERT OR UPDATE OF world_id, admitted_by_decision_id
  ON public.ontology_nodes
  FOR EACH ROW EXECUTE FUNCTION private.require_admitting_decision();
--> statement-breakpoint
CREATE TRIGGER ontology_aliases_require_admission
  BEFORE INSERT OR UPDATE OF world_id, admitted_by_decision_id
  ON public.ontology_aliases
  FOR EACH ROW EXECUTE FUNCTION private.require_admitting_decision();
--> statement-breakpoint
CREATE TRIGGER ontology_relationships_require_admission
  BEFORE INSERT OR UPDATE OF world_id, admitted_by_decision_id
  ON public.ontology_relationships
  FOR EACH ROW EXECUTE FUNCTION private.require_admitting_decision();
--> statement-breakpoint
CREATE TRIGGER assertions_require_admission
  BEFORE INSERT OR UPDATE OF world_id, admitted_by_decision_id
  ON public.assertions
  FOR EACH ROW EXECUTE FUNCTION private.require_admitting_decision();
