CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"observation_id" uuid NOT NULL,
	"storage_bucket" text NOT NULL,
	"storage_object_key" text NOT NULL,
	"media_type" text NOT NULL,
	"byte_count" bigint NOT NULL,
	"content_hash" text NOT NULL,
	"original_filename" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachments_world_id_id_unique" UNIQUE("world_id","id"),
	CONSTRAINT "attachments_byte_count_check" CHECK ("attachments"."byte_count" >= 0),
	CONSTRAINT "attachments_storage_bucket_not_blank" CHECK (length(btrim("attachments"."storage_bucket")) > 0),
	CONSTRAINT "attachments_storage_object_key_not_blank" CHECK (length(btrim("attachments"."storage_object_key")) > 0),
	CONSTRAINT "attachments_media_type_not_blank" CHECK (length(btrim("attachments"."media_type")) > 0),
	CONSTRAINT "attachments_content_hash_not_blank" CHECK (length(btrim("attachments"."content_hash")) > 0)
);
--> statement-breakpoint
CREATE TABLE "observation_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"observation_id" uuid NOT NULL,
	"corrected_occurred_at" timestamp with time zone,
	"corrected_occurred_precision" text,
	"corrected_source_timezone" text,
	"corrected_local_calendar_date" date,
	"rationale" text,
	"recorded_by_account_id" uuid,
	"supersedes_correction_id" uuid,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "observation_corrections_world_id_id_unique" UNIQUE("world_id","id"),
	CONSTRAINT "observation_corrections_precision_check" CHECK ("observation_corrections"."corrected_occurred_precision" is null or "observation_corrections"."corrected_occurred_precision" in ('exact', 'approximate', 'date', 'unknown')),
	CONSTRAINT "observation_corrections_has_change_check" CHECK ("observation_corrections"."corrected_occurred_at" is not null or "observation_corrections"."corrected_occurred_precision" is not null or "observation_corrections"."corrected_source_timezone" is not null or "observation_corrections"."corrected_local_calendar_date" is not null)
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"recorded_by_account_id" uuid,
	"source_kind" text NOT NULL,
	"source_locator" text,
	"source_timezone" text,
	"occurred_at" timestamp with time zone,
	"occurred_precision" text DEFAULT 'unknown' NOT NULL,
	"local_calendar_date" date,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "observations_world_id_id_unique" UNIQUE("world_id","id"),
	CONSTRAINT "observations_source_kind_not_blank" CHECK (length(btrim("observations"."source_kind")) > 0),
	CONSTRAINT "observations_occurred_precision_check" CHECK ("observations"."occurred_precision" in ('exact', 'approximate', 'date', 'unknown')),
	CONSTRAINT "observations_exact_occurrence_requires_instant" CHECK ("observations"."occurred_precision" <> 'exact' or "observations"."occurred_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "source_fragments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"observation_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"exact_text" text NOT NULL,
	"content_hash" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_fragments_world_id_id_unique" UNIQUE("world_id","id"),
	CONSTRAINT "source_fragments_ordinal_check" CHECK ("source_fragments"."ordinal" >= 0),
	CONSTRAINT "source_fragments_exact_text_not_blank" CHECK (length("source_fragments"."exact_text") > 0),
	CONSTRAINT "source_fragments_content_hash_not_blank" CHECK (length(btrim("source_fragments"."content_hash")) > 0)
);
--> statement-breakpoint
CREATE TABLE "admission_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"candidate_claim_id" uuid NOT NULL,
	"decision_kind" text NOT NULL,
	"authority_kind" text NOT NULL,
	"decided_by_account_id" uuid,
	"rationale" text,
	"correction_payload" jsonb,
	"supersedes_decision_id" uuid,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admission_decisions_world_id_id_unique" UNIQUE("world_id","id"),
	CONSTRAINT "admission_decisions_kind_check" CHECK ("admission_decisions"."decision_kind" in ('accept', 'reject', 'correct', 'defer')),
	CONSTRAINT "admission_decisions_authority_check" CHECK ("admission_decisions"."authority_kind" in ('user', 'policy')),
	CONSTRAINT "admission_decisions_user_authority_actor_check" CHECK ("admission_decisions"."authority_kind" <> 'user' or "admission_decisions"."decided_by_account_id" is not null),
	CONSTRAINT "admission_decisions_correction_payload_check" CHECK ("admission_decisions"."correction_payload" is null or jsonb_typeof("admission_decisions"."correction_payload") = 'object')
);
--> statement-breakpoint
CREATE TABLE "candidate_claim_evidence" (
	"world_id" uuid NOT NULL,
	"candidate_claim_id" uuid NOT NULL,
	"source_fragment_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_claim_evidence_primary_key" PRIMARY KEY("candidate_claim_id","source_fragment_id")
);
--> statement-breakpoint
CREATE TABLE "candidate_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"interpretation_run_id" uuid NOT NULL,
	"proposed_subject_node_id" uuid,
	"claim_kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_claims_world_id_id_unique" UNIQUE("world_id","id"),
	CONSTRAINT "candidate_claims_kind_not_blank" CHECK (length(btrim("candidate_claims"."claim_kind")) > 0),
	CONSTRAINT "candidate_claims_payload_object_check" CHECK (jsonb_typeof("candidate_claims"."payload") = 'object')
);
--> statement-breakpoint
CREATE TABLE "interpretation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"observation_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text,
	"model" text,
	"prompt_version" text NOT NULL,
	"schema_version" text NOT NULL,
	"input_hash" text NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interpretation_runs_world_id_id_unique" UNIQUE("world_id","id"),
	CONSTRAINT "interpretation_runs_status_check" CHECK ("interpretation_runs"."status" in ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
	CONSTRAINT "interpretation_runs_versions_not_blank" CHECK (length(btrim("interpretation_runs"."prompt_version")) > 0 and length(btrim("interpretation_runs"."schema_version")) > 0),
	CONSTRAINT "interpretation_runs_input_hash_not_blank" CHECK (length(btrim("interpretation_runs"."input_hash")) > 0),
	CONSTRAINT "interpretation_runs_completed_after_started_check" CHECK ("interpretation_runs"."completed_at" is null or "interpretation_runs"."started_at" is null or "interpretation_runs"."completed_at" >= "interpretation_runs"."started_at")
);
--> statement-breakpoint
CREATE TABLE "assertion_evidence" (
	"world_id" uuid NOT NULL,
	"assertion_id" uuid NOT NULL,
	"source_fragment_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assertion_evidence_primary_key" PRIMARY KEY("assertion_id","source_fragment_id")
);
--> statement-breakpoint
CREATE TABLE "assertions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"subject_node_id" uuid,
	"predicate" text NOT NULL,
	"object_node_id" uuid,
	"value" jsonb,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"admitted_by_decision_id" uuid NOT NULL,
	"supersedes_assertion_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assertions_world_id_id_unique" UNIQUE("world_id","id"),
	CONSTRAINT "assertions_predicate_not_blank" CHECK (length(btrim("assertions"."predicate")) > 0),
	CONSTRAINT "assertions_exactly_one_object_check" CHECK (num_nonnulls("assertions"."object_node_id", "assertions"."value") = 1),
	CONSTRAINT "assertions_valid_interval_check" CHECK ("assertions"."valid_to" is null or "assertions"."valid_to" > "assertions"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "ontology_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"locale" text,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"admitted_by_decision_id" uuid NOT NULL,
	"supersedes_alias_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ontology_aliases_world_id_id_unique" UNIQUE("world_id","id"),
	CONSTRAINT "ontology_aliases_alias_not_blank" CHECK (length(btrim("ontology_aliases"."alias")) > 0),
	CONSTRAINT "ontology_aliases_valid_interval_check" CHECK ("ontology_aliases"."valid_to" is null or "ontology_aliases"."valid_to" > "ontology_aliases"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "ontology_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"admitted_by_decision_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ontology_nodes_world_id_id_unique" UNIQUE("world_id","id")
);
--> statement-breakpoint
CREATE TABLE "ontology_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"subject_node_id" uuid NOT NULL,
	"object_node_id" uuid NOT NULL,
	"predicate" text NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"admitted_by_decision_id" uuid NOT NULL,
	"supersedes_relationship_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ontology_relationships_world_id_id_unique" UNIQUE("world_id","id"),
	CONSTRAINT "ontology_relationships_predicate_not_blank" CHECK (length(btrim("ontology_relationships"."predicate")) > 0),
	CONSTRAINT "ontology_relationships_distinct_nodes_check" CHECK ("ontology_relationships"."subject_node_id" <> "ontology_relationships"."object_node_id"),
	CONSTRAINT "ontology_relationships_valid_interval_check" CHECK ("ontology_relationships"."valid_to" is null or "ontology_relationships"."valid_to" > "ontology_relationships"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"actor_kind" text NOT NULL,
	"actor_account_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_actor_kind_check" CHECK ("audit_events"."actor_kind" in ('user', 'system', 'policy')),
	CONSTRAINT "audit_events_user_actor_check" CHECK ("audit_events"."actor_kind" <> 'user' or "audit_events"."actor_account_id" is not null),
	CONSTRAINT "audit_events_action_not_blank" CHECK (length(btrim("audit_events"."action")) > 0),
	CONSTRAINT "audit_events_entity_type_not_blank" CHECK (length(btrim("audit_events"."entity_type")) > 0),
	CONSTRAINT "audit_events_metadata_object_check" CHECK (jsonb_typeof("audit_events"."metadata") = 'object')
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"job_kind" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"last_failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_kind_not_blank" CHECK (length(btrim("jobs"."job_kind")) > 0),
	CONSTRAINT "jobs_idempotency_key_not_blank" CHECK (length(btrim("jobs"."idempotency_key")) > 0),
	CONSTRAINT "jobs_status_check" CHECK ("jobs"."status" in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
	CONSTRAINT "jobs_attempts_check" CHECK ("jobs"."attempts" >= 0),
	CONSTRAINT "jobs_max_attempts_check" CHECK ("jobs"."max_attempts" > 0),
	CONSTRAINT "jobs_payload_object_check" CHECK (jsonb_typeof("jobs"."payload") = 'object')
);
--> statement-breakpoint
CREATE TABLE "observation_operational_period_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"observation_id" uuid NOT NULL,
	"operational_period_id" uuid NOT NULL,
	"assignment_kind" text NOT NULL,
	"assigned_by_account_id" uuid,
	"supersedes_membership_id" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "observation_operational_period_memberships_world_id_id_unique" UNIQUE("world_id","id"),
	CONSTRAINT "observation_operational_memberships_assignment_kind_check" CHECK ("observation_operational_period_memberships"."assignment_kind" in ('initial', 'correction'))
);
--> statement-breakpoint
CREATE TABLE "observation_reflection_period_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"observation_id" uuid NOT NULL,
	"reflection_period_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "observation_reflection_period_memberships_world_id_id_unique" UNIQUE("world_id","id")
);
--> statement-breakpoint
CREATE TABLE "operational_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"time_setting_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"supersedes_period_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_periods_world_id_id_unique" UNIQUE("world_id","id"),
	CONSTRAINT "operational_periods_interval_check" CHECK ("operational_periods"."ends_at" > "operational_periods"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "reflection_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"period_kind" text NOT NULL,
	"label" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reflection_periods_world_id_id_unique" UNIQUE("world_id","id"),
	CONSTRAINT "reflection_periods_kind_not_blank" CHECK (length(btrim("reflection_periods"."period_kind")) > 0),
	CONSTRAINT "reflection_periods_interval_check" CHECK ("reflection_periods"."ends_at" > "reflection_periods"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "time_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"timezone_name" text NOT NULL,
	"operational_day_boundary" time DEFAULT '04:00:00'::time NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"recorded_by_account_id" uuid,
	"supersedes_time_setting_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_settings_world_id_id_unique" UNIQUE("world_id","id"),
	CONSTRAINT "time_settings_timezone_not_blank" CHECK (length(btrim("time_settings"."timezone_name")) > 0),
	CONSTRAINT "time_settings_effective_interval_check" CHECK ("time_settings"."effective_to" is null or "time_settings"."effective_to" > "time_settings"."effective_from")
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_observation_world_fk" FOREIGN KEY ("world_id","observation_id") REFERENCES "public"."observations"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_corrections" ADD CONSTRAINT "observation_corrections_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_corrections" ADD CONSTRAINT "observation_corrections_recorded_by_account_id_accounts_id_fk" FOREIGN KEY ("recorded_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_corrections" ADD CONSTRAINT "observation_corrections_supersedes_correction_id_observation_corrections_id_fk" FOREIGN KEY ("supersedes_correction_id") REFERENCES "public"."observation_corrections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_corrections" ADD CONSTRAINT "observation_corrections_observation_world_fk" FOREIGN KEY ("world_id","observation_id") REFERENCES "public"."observations"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_corrections" ADD CONSTRAINT "observation_corrections_recorded_by_world_membership_fk" FOREIGN KEY ("world_id","recorded_by_account_id") REFERENCES "public"."world_memberships"("world_id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_recorded_by_account_id_accounts_id_fk" FOREIGN KEY ("recorded_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_recorded_by_world_membership_fk" FOREIGN KEY ("world_id","recorded_by_account_id") REFERENCES "public"."world_memberships"("world_id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_fragments" ADD CONSTRAINT "source_fragments_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_fragments" ADD CONSTRAINT "source_fragments_observation_world_fk" FOREIGN KEY ("world_id","observation_id") REFERENCES "public"."observations"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_decisions" ADD CONSTRAINT "admission_decisions_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_decisions" ADD CONSTRAINT "admission_decisions_decided_by_account_id_accounts_id_fk" FOREIGN KEY ("decided_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_decisions" ADD CONSTRAINT "admission_decisions_supersedes_decision_id_admission_decisions_id_fk" FOREIGN KEY ("supersedes_decision_id") REFERENCES "public"."admission_decisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_decisions" ADD CONSTRAINT "admission_decisions_candidate_claim_world_fk" FOREIGN KEY ("world_id","candidate_claim_id") REFERENCES "public"."candidate_claims"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admission_decisions" ADD CONSTRAINT "admission_decisions_actor_world_membership_fk" FOREIGN KEY ("world_id","decided_by_account_id") REFERENCES "public"."world_memberships"("world_id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_claim_evidence" ADD CONSTRAINT "candidate_claim_evidence_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_claim_evidence" ADD CONSTRAINT "candidate_claim_evidence_claim_world_fk" FOREIGN KEY ("world_id","candidate_claim_id") REFERENCES "public"."candidate_claims"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_claim_evidence" ADD CONSTRAINT "candidate_claim_evidence_fragment_world_fk" FOREIGN KEY ("world_id","source_fragment_id") REFERENCES "public"."source_fragments"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_claims" ADD CONSTRAINT "candidate_claims_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_claims" ADD CONSTRAINT "candidate_claims_interpretation_run_world_fk" FOREIGN KEY ("world_id","interpretation_run_id") REFERENCES "public"."interpretation_runs"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interpretation_runs" ADD CONSTRAINT "interpretation_runs_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interpretation_runs" ADD CONSTRAINT "interpretation_runs_observation_world_fk" FOREIGN KEY ("world_id","observation_id") REFERENCES "public"."observations"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertion_evidence" ADD CONSTRAINT "assertion_evidence_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertion_evidence" ADD CONSTRAINT "assertion_evidence_assertion_world_fk" FOREIGN KEY ("world_id","assertion_id") REFERENCES "public"."assertions"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertion_evidence" ADD CONSTRAINT "assertion_evidence_fragment_world_fk" FOREIGN KEY ("world_id","source_fragment_id") REFERENCES "public"."source_fragments"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertions" ADD CONSTRAINT "assertions_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertions" ADD CONSTRAINT "assertions_supersedes_assertion_id_assertions_id_fk" FOREIGN KEY ("supersedes_assertion_id") REFERENCES "public"."assertions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertions" ADD CONSTRAINT "assertions_subject_node_world_fk" FOREIGN KEY ("world_id","subject_node_id") REFERENCES "public"."ontology_nodes"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertions" ADD CONSTRAINT "assertions_object_node_world_fk" FOREIGN KEY ("world_id","object_node_id") REFERENCES "public"."ontology_nodes"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assertions" ADD CONSTRAINT "assertions_admission_decision_world_fk" FOREIGN KEY ("world_id","admitted_by_decision_id") REFERENCES "public"."admission_decisions"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ontology_aliases" ADD CONSTRAINT "ontology_aliases_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ontology_aliases" ADD CONSTRAINT "ontology_aliases_supersedes_alias_id_ontology_aliases_id_fk" FOREIGN KEY ("supersedes_alias_id") REFERENCES "public"."ontology_aliases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ontology_aliases" ADD CONSTRAINT "ontology_aliases_node_world_fk" FOREIGN KEY ("world_id","node_id") REFERENCES "public"."ontology_nodes"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ontology_aliases" ADD CONSTRAINT "ontology_aliases_admission_decision_world_fk" FOREIGN KEY ("world_id","admitted_by_decision_id") REFERENCES "public"."admission_decisions"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ontology_nodes" ADD CONSTRAINT "ontology_nodes_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ontology_nodes" ADD CONSTRAINT "ontology_nodes_admission_decision_world_fk" FOREIGN KEY ("world_id","admitted_by_decision_id") REFERENCES "public"."admission_decisions"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ontology_relationships" ADD CONSTRAINT "ontology_relationships_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ontology_relationships" ADD CONSTRAINT "ontology_relationships_supersedes_relationship_id_ontology_relationships_id_fk" FOREIGN KEY ("supersedes_relationship_id") REFERENCES "public"."ontology_relationships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ontology_relationships" ADD CONSTRAINT "ontology_relationships_subject_node_world_fk" FOREIGN KEY ("world_id","subject_node_id") REFERENCES "public"."ontology_nodes"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ontology_relationships" ADD CONSTRAINT "ontology_relationships_object_node_world_fk" FOREIGN KEY ("world_id","object_node_id") REFERENCES "public"."ontology_nodes"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ontology_relationships" ADD CONSTRAINT "ontology_relationships_admission_decision_world_fk" FOREIGN KEY ("world_id","admitted_by_decision_id") REFERENCES "public"."admission_decisions"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_world_membership_fk" FOREIGN KEY ("world_id","actor_account_id") REFERENCES "public"."world_memberships"("world_id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_operational_period_memberships" ADD CONSTRAINT "observation_operational_period_memberships_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_operational_period_memberships" ADD CONSTRAINT "observation_operational_period_memberships_assigned_by_account_id_accounts_id_fk" FOREIGN KEY ("assigned_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_operational_period_memberships" ADD CONSTRAINT "observation_operational_period_memberships_supersedes_membership_id_observation_operational_period_memberships_id_fk" FOREIGN KEY ("supersedes_membership_id") REFERENCES "public"."observation_operational_period_memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_operational_period_memberships" ADD CONSTRAINT "observation_operational_membership_observation_world_fk" FOREIGN KEY ("world_id","observation_id") REFERENCES "public"."observations"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_operational_period_memberships" ADD CONSTRAINT "observation_operational_membership_period_world_fk" FOREIGN KEY ("world_id","operational_period_id") REFERENCES "public"."operational_periods"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_operational_period_memberships" ADD CONSTRAINT "observation_operational_membership_actor_world_fk" FOREIGN KEY ("world_id","assigned_by_account_id") REFERENCES "public"."world_memberships"("world_id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_reflection_period_memberships" ADD CONSTRAINT "observation_reflection_period_memberships_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_reflection_period_memberships" ADD CONSTRAINT "observation_reflection_membership_observation_world_fk" FOREIGN KEY ("world_id","observation_id") REFERENCES "public"."observations"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_reflection_period_memberships" ADD CONSTRAINT "observation_reflection_membership_period_world_fk" FOREIGN KEY ("world_id","reflection_period_id") REFERENCES "public"."reflection_periods"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_periods" ADD CONSTRAINT "operational_periods_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_periods" ADD CONSTRAINT "operational_periods_supersedes_period_id_operational_periods_id_fk" FOREIGN KEY ("supersedes_period_id") REFERENCES "public"."operational_periods"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_periods" ADD CONSTRAINT "operational_periods_time_setting_world_fk" FOREIGN KEY ("world_id","time_setting_id") REFERENCES "public"."time_settings"("world_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reflection_periods" ADD CONSTRAINT "reflection_periods_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_settings" ADD CONSTRAINT "time_settings_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_settings" ADD CONSTRAINT "time_settings_recorded_by_account_id_accounts_id_fk" FOREIGN KEY ("recorded_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_settings" ADD CONSTRAINT "time_settings_supersedes_time_setting_id_time_settings_id_fk" FOREIGN KEY ("supersedes_time_setting_id") REFERENCES "public"."time_settings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_settings" ADD CONSTRAINT "time_settings_recorded_by_world_membership_fk" FOREIGN KEY ("world_id","recorded_by_account_id") REFERENCES "public"."world_memberships"("world_id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_world_storage_object_unique" ON "attachments" USING btree ("world_id","storage_bucket","storage_object_key");--> statement-breakpoint
CREATE INDEX "observation_corrections_observation_id_index" ON "observation_corrections" USING btree ("observation_id");--> statement-breakpoint
CREATE INDEX "observations_world_id_recorded_at_index" ON "observations" USING btree ("world_id","recorded_at");--> statement-breakpoint
CREATE INDEX "observations_recorded_by_account_id_index" ON "observations" USING btree ("recorded_by_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_fragments_observation_ordinal_unique" ON "source_fragments" USING btree ("observation_id","ordinal");--> statement-breakpoint
CREATE INDEX "admission_decisions_candidate_claim_id_index" ON "admission_decisions" USING btree ("candidate_claim_id");--> statement-breakpoint
CREATE INDEX "candidate_claim_evidence_world_id_index" ON "candidate_claim_evidence" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "candidate_claims_interpretation_run_id_index" ON "candidate_claims" USING btree ("interpretation_run_id");--> statement-breakpoint
CREATE INDEX "interpretation_runs_observation_id_created_at_index" ON "interpretation_runs" USING btree ("observation_id","created_at");--> statement-breakpoint
CREATE INDEX "assertion_evidence_world_id_index" ON "assertion_evidence" USING btree ("world_id");--> statement-breakpoint
CREATE INDEX "assertions_world_id_predicate_index" ON "assertions" USING btree ("world_id","predicate");--> statement-breakpoint
CREATE INDEX "ontology_aliases_node_id_index" ON "ontology_aliases" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "ontology_relationships_subject_node_id_index" ON "ontology_relationships" USING btree ("subject_node_id");--> statement-breakpoint
CREATE INDEX "ontology_relationships_object_node_id_index" ON "ontology_relationships" USING btree ("object_node_id");--> statement-breakpoint
CREATE INDEX "audit_events_world_occurred_at_index" ON "audit_events" USING btree ("world_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_world_kind_idempotency_unique" ON "jobs" USING btree ("world_id","job_kind","idempotency_key");--> statement-breakpoint
CREATE INDEX "jobs_status_available_at_index" ON "jobs" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "observation_operational_period_memberships_observation_index" ON "observation_operational_period_memberships" USING btree ("observation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "observation_reflection_period_membership_unique" ON "observation_reflection_period_memberships" USING btree ("observation_id","reflection_period_id");--> statement-breakpoint
CREATE INDEX "operational_periods_world_local_date_index" ON "operational_periods" USING btree ("world_id","local_date");--> statement-breakpoint
CREATE INDEX "reflection_periods_world_starts_at_index" ON "reflection_periods" USING btree ("world_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "time_settings_world_effective_from_unique" ON "time_settings" USING btree ("world_id","effective_from");--> statement-breakpoint
CREATE INDEX "world_memberships_user_id_index" ON "world_memberships" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE public.observation_corrections ADD CONSTRAINT observation_corrections_supersedes_world_fk FOREIGN KEY (world_id, supersedes_correction_id) REFERENCES public.observation_corrections (world_id, id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE public.admission_decisions ADD CONSTRAINT admission_decisions_supersedes_world_fk FOREIGN KEY (world_id, supersedes_decision_id) REFERENCES public.admission_decisions (world_id, id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE public.ontology_aliases ADD CONSTRAINT ontology_aliases_supersedes_world_fk FOREIGN KEY (world_id, supersedes_alias_id) REFERENCES public.ontology_aliases (world_id, id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE public.ontology_relationships ADD CONSTRAINT ontology_relationships_supersedes_world_fk FOREIGN KEY (world_id, supersedes_relationship_id) REFERENCES public.ontology_relationships (world_id, id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE public.assertions ADD CONSTRAINT assertions_supersedes_world_fk FOREIGN KEY (world_id, supersedes_assertion_id) REFERENCES public.assertions (world_id, id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE public.time_settings ADD CONSTRAINT time_settings_supersedes_world_fk FOREIGN KEY (world_id, supersedes_time_setting_id) REFERENCES public.time_settings (world_id, id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE public.operational_periods ADD CONSTRAINT operational_periods_supersedes_world_fk FOREIGN KEY (world_id, supersedes_period_id) REFERENCES public.operational_periods (world_id, id) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE public.observation_operational_period_memberships ADD CONSTRAINT observation_operational_membership_supersedes_world_fk FOREIGN KEY (world_id, supersedes_membership_id) REFERENCES public.observation_operational_period_memberships (world_id, id) ON DELETE RESTRICT;
--> statement-breakpoint
COMMENT ON TABLE public.observations IS 'Immutable observation envelopes preserved before interpretation.';
--> statement-breakpoint
COMMENT ON TABLE public.source_fragments IS 'Ordered exact source fragments and integrity hashes; never canonical interpretation.';
--> statement-breakpoint
COMMENT ON TABLE public.observation_corrections IS 'Append-only corrections to observation metadata; original evidence remains unchanged.';
--> statement-breakpoint
COMMENT ON TABLE public.attachments IS 'Attachment provenance and private storage metadata only; no binary content.';
--> statement-breakpoint
COMMENT ON TABLE public.interpretation_runs IS 'Non-canonical interpretation execution provenance.';
--> statement-breakpoint
COMMENT ON TABLE public.candidate_claims IS 'Non-canonical candidate interpretations; existence does not imply visibility or admission.';
--> statement-breakpoint
COMMENT ON TABLE public.candidate_claim_evidence IS 'Exact evidence links supporting non-canonical candidate claims.';
--> statement-breakpoint
COMMENT ON TABLE public.admission_decisions IS 'Append-only accept, reject, correct or defer decisions at the canonical boundary.';
--> statement-breakpoint
COMMENT ON TABLE public.ontology_nodes IS 'Stable ontology identity only; no mandatory name, rank, parent, role or visual form.';
--> statement-breakpoint
COMMENT ON TABLE public.ontology_aliases IS 'Versioned admitted aliases for stable ontology nodes.';
--> statement-breakpoint
COMMENT ON TABLE public.ontology_relationships IS 'Versioned admitted arbitrary-depth relationships without fixed Domain or Locus ranks.';
--> statement-breakpoint
COMMENT ON TABLE public.assertions IS 'Versioned admitted World Model assertions with explicit supersession and validity.';
--> statement-breakpoint
COMMENT ON TABLE public.assertion_evidence IS 'Exact source-fragment evidence supporting admitted assertions.';
--> statement-breakpoint
COMMENT ON TABLE public.time_settings IS 'Versioned timezone and operational-day boundary settings; default boundary is 04:00.';
--> statement-breakpoint
COMMENT ON TABLE public.operational_periods IS 'Stable operational periods derived from a specific time-setting version.';
--> statement-breakpoint
COMMENT ON TABLE public.observation_operational_period_memberships IS 'Append-only operational-period assignments; corrections supersede without silent reassignment.';
--> statement-breakpoint
COMMENT ON TABLE public.reflection_periods IS 'Reflection windows distinct from physical chronology and operational periods.';
--> statement-breakpoint
COMMENT ON TABLE public.observation_reflection_period_memberships IS 'Explicit observation membership in a reflection period.';
--> statement-breakpoint
COMMENT ON TABLE public.jobs IS 'Durable job state definition only; no Step 98 worker or AI provider is authorized.';
--> statement-breakpoint
COMMENT ON TABLE public.audit_events IS 'Append-only security and canonical-command audit metadata.';
--> statement-breakpoint
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.source_fragments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.observation_corrections ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.interpretation_runs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.candidate_claims ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.candidate_claim_evidence ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.admission_decisions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.ontology_nodes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.ontology_aliases ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.ontology_relationships ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.assertions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.assertion_evidence ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.time_settings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.operational_periods ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.observation_operational_period_memberships ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.reflection_periods ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.observation_reflection_period_memberships ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE public.observations, public.source_fragments, public.observation_corrections, public.attachments, public.interpretation_runs, public.candidate_claims, public.candidate_claim_evidence, public.admission_decisions, public.ontology_nodes, public.ontology_aliases, public.ontology_relationships, public.assertions, public.assertion_evidence, public.time_settings, public.operational_periods, public.observation_operational_period_memberships, public.reflection_periods, public.observation_reflection_period_memberships, public.jobs, public.audit_events FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON TABLE public.observations, public.source_fragments, public.observation_corrections, public.attachments, public.admission_decisions, public.ontology_nodes, public.ontology_aliases, public.ontology_relationships, public.assertions, public.assertion_evidence, public.time_settings, public.operational_periods, public.observation_operational_period_memberships, public.reflection_periods, public.observation_reflection_period_memberships TO authenticated;
--> statement-breakpoint
CREATE POLICY observations_select_member ON public.observations FOR SELECT TO authenticated USING (private.is_world_member(world_id));
--> statement-breakpoint
CREATE POLICY source_fragments_select_member ON public.source_fragments FOR SELECT TO authenticated USING (private.is_world_member(world_id));
--> statement-breakpoint
CREATE POLICY observation_corrections_select_member ON public.observation_corrections FOR SELECT TO authenticated USING (private.is_world_member(world_id));
--> statement-breakpoint
CREATE POLICY attachments_select_member ON public.attachments FOR SELECT TO authenticated USING (private.is_world_member(world_id));
--> statement-breakpoint
CREATE POLICY admission_decisions_select_member ON public.admission_decisions FOR SELECT TO authenticated USING (private.is_world_member(world_id));
--> statement-breakpoint
CREATE POLICY ontology_nodes_select_member ON public.ontology_nodes FOR SELECT TO authenticated USING (private.is_world_member(world_id));
--> statement-breakpoint
CREATE POLICY ontology_aliases_select_member ON public.ontology_aliases FOR SELECT TO authenticated USING (private.is_world_member(world_id));
--> statement-breakpoint
CREATE POLICY ontology_relationships_select_member ON public.ontology_relationships FOR SELECT TO authenticated USING (private.is_world_member(world_id));
--> statement-breakpoint
CREATE POLICY assertions_select_member ON public.assertions FOR SELECT TO authenticated USING (private.is_world_member(world_id));
--> statement-breakpoint
CREATE POLICY assertion_evidence_select_member ON public.assertion_evidence FOR SELECT TO authenticated USING (private.is_world_member(world_id));
--> statement-breakpoint
CREATE POLICY time_settings_select_member ON public.time_settings FOR SELECT TO authenticated USING (private.is_world_member(world_id));
--> statement-breakpoint
CREATE POLICY operational_periods_select_member ON public.operational_periods FOR SELECT TO authenticated USING (private.is_world_member(world_id));
--> statement-breakpoint
CREATE POLICY observation_operational_period_memberships_select_member ON public.observation_operational_period_memberships FOR SELECT TO authenticated USING (private.is_world_member(world_id));
--> statement-breakpoint
CREATE POLICY reflection_periods_select_member ON public.reflection_periods FOR SELECT TO authenticated USING (private.is_world_member(world_id));
--> statement-breakpoint
CREATE POLICY observation_reflection_period_memberships_select_member ON public.observation_reflection_period_memberships FOR SELECT TO authenticated USING (private.is_world_member(world_id));
