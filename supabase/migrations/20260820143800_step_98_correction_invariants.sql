ALTER TABLE "admission_decisions" DROP CONSTRAINT "admission_decisions_user_authority_actor_check";--> statement-breakpoint
ALTER TABLE "admission_decisions" DROP CONSTRAINT "admission_decisions_correction_payload_check";--> statement-breakpoint
ALTER TABLE "admission_decisions" DROP CONSTRAINT "admission_decisions_authority_check";--> statement-breakpoint
ALTER TABLE "admission_decisions" ALTER COLUMN "decided_by_account_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "admission_decisions_supersedes_candidate_index" ON "admission_decisions" USING btree ("world_id","candidate_claim_id","supersedes_decision_id") WHERE "admission_decisions"."supersedes_decision_id" is not null;--> statement-breakpoint
CREATE INDEX "candidate_claims_proposed_subject_node_index" ON "candidate_claims" USING btree ("world_id","proposed_subject_node_id") WHERE "candidate_claims"."proposed_subject_node_id" is not null;--> statement-breakpoint
CREATE INDEX "observation_operational_membership_supersedes_path_index" ON "observation_operational_period_memberships" USING btree ("world_id","observation_id","supersedes_membership_id") WHERE "observation_operational_period_memberships"."supersedes_membership_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "observation_operational_membership_successor_unique" ON "observation_operational_period_memberships" USING btree ("supersedes_membership_id") WHERE "observation_operational_period_memberships"."supersedes_membership_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "observation_operational_membership_initial_unique" ON "observation_operational_period_memberships" USING btree ("world_id","observation_id") WHERE "observation_operational_period_memberships"."assignment_kind" = 'initial';--> statement-breakpoint
ALTER TABLE "admission_decisions" ADD CONSTRAINT "admission_decisions_world_candidate_id_unique" UNIQUE("world_id","candidate_claim_id","id");--> statement-breakpoint
ALTER TABLE "observation_operational_period_memberships" ADD CONSTRAINT "observation_operational_memberships_world_observation_id_unique" UNIQUE("world_id","observation_id","id");--> statement-breakpoint
ALTER TABLE "admission_decisions" ADD CONSTRAINT "admission_decisions_payload_coherence_check" CHECK (("admission_decisions"."decision_kind" = 'correct' and "admission_decisions"."correction_payload" is not null and jsonb_typeof("admission_decisions"."correction_payload") = 'object') or ("admission_decisions"."decision_kind" in ('accept', 'reject', 'defer') and "admission_decisions"."correction_payload" is null));--> statement-breakpoint
ALTER TABLE "admission_decisions" ADD CONSTRAINT "admission_decisions_authority_check" CHECK ("admission_decisions"."authority_kind" = 'user');--> statement-breakpoint
ALTER TABLE "assertions" ADD CONSTRAINT "assertions_scalar_value_check" CHECK ("assertions"."value" is null or jsonb_typeof("assertions"."value") in ('string', 'number', 'boolean'));--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_attempts_within_max_check" CHECK ("jobs"."attempts" <= "jobs"."max_attempts");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_queued_state_check" CHECK ("jobs"."status" <> 'queued' or ("jobs"."attempts" < "jobs"."max_attempts" and "jobs"."locked_at" is null));--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_running_state_check" CHECK ("jobs"."status" <> 'running' or ("jobs"."locked_at" is not null and "jobs"."attempts" >= 1));--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_non_running_unlocked_check" CHECK ("jobs"."status" = 'running' or "jobs"."locked_at" is null);--> statement-breakpoint
ALTER TABLE "observation_operational_period_memberships" ADD CONSTRAINT "observation_operational_memberships_correction_chain_check" CHECK (("observation_operational_period_memberships"."assignment_kind" = 'initial' and "observation_operational_period_memberships"."supersedes_membership_id" is null) or ("observation_operational_period_memberships"."assignment_kind" = 'correction' and "observation_operational_period_memberships"."supersedes_membership_id" is not null));
--> statement-breakpoint
ALTER TABLE public.candidate_claims
  ADD CONSTRAINT candidate_claims_proposed_subject_node_world_fk
  FOREIGN KEY (world_id, proposed_subject_node_id)
  REFERENCES public.ontology_nodes (world_id, id)
  ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE public.admission_decisions
  ADD CONSTRAINT admission_decisions_supersedes_candidate_world_fk
  FOREIGN KEY (world_id, candidate_claim_id, supersedes_decision_id)
  REFERENCES public.admission_decisions (world_id, candidate_claim_id, id)
  ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE public.observation_operational_period_memberships
  ADD CONSTRAINT observation_operational_membership_supersedes_observation_world_fk
  FOREIGN KEY (world_id, observation_id, supersedes_membership_id)
  REFERENCES public.observation_operational_period_memberships
    (world_id, observation_id, id)
  ON DELETE RESTRICT;
