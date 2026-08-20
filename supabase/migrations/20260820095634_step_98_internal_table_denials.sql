CREATE POLICY interpretation_runs_no_client_access
  ON public.interpretation_runs
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY candidate_claims_no_client_access
  ON public.candidate_claims
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY candidate_claim_evidence_no_client_access
  ON public.candidate_claim_evidence
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY jobs_no_client_access
  ON public.jobs
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);
--> statement-breakpoint
CREATE POLICY audit_events_no_client_access
  ON public.audit_events
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);
