import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { observations, sourceFragments } from "./evidence";
import { jobs } from "./operations";
import { accounts, worldMemberships, worlds } from "./ownership";

export const interpretationRuns = pgTable(
  "interpretation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").notNull(),
    observationId: uuid("observation_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    status: text("status").default("pending").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    schemaVersion: text("schema_version").notNull(),
    inputHash: text("input_hash").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failureCode: text("failure_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("interpretation_runs_world_id_id_unique").on(
      table.worldId,
      table.id,
    ),
    unique("interpretation_runs_world_id_job_id_unique").on(
      table.worldId,
      table.id,
      table.jobId,
    ),
    index("interpretation_runs_observation_id_created_at_index").on(
      table.observationId,
      table.createdAt,
    ),
    unique("interpretation_runs_job_attempt_unique").on(
      table.jobId,
      table.attemptNumber,
    ),
    uniqueIndex("interpretation_runs_one_success_per_job_unique")
      .on(table.jobId)
      .where(sql`${table.status} = 'succeeded'`),
    foreignKey({
      name: "interpretation_runs_job_observation_world_fk",
      columns: [table.worldId, table.jobId, table.observationId],
      foreignColumns: [jobs.worldId, jobs.id, jobs.observationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "interpretation_runs_observation_world_fk",
      columns: [table.worldId, table.observationId],
      foreignColumns: [observations.worldId, observations.id],
    }).onDelete("restrict"),
    check(
      "interpretation_runs_status_check",
      sql`${table.status} in ('pending', 'running', 'succeeded', 'failed', 'cancelled')`,
    ),
    check(
      "interpretation_runs_versions_not_blank",
      sql`length(btrim(${table.promptVersion})) > 0 and length(btrim(${table.schemaVersion})) > 0`,
    ),
    check(
      "interpretation_runs_input_hash_not_blank",
      sql`length(btrim(${table.inputHash})) > 0`,
    ),
    check(
      "interpretation_runs_attempt_number_check",
      sql`${table.attemptNumber} > 0`,
    ),
    check(
      "interpretation_runs_provider_model_check",
      sql`length(btrim(${table.provider})) > 0 and length(btrim(${table.model})) > 0`,
    ),
    check(
      "interpretation_runs_failure_code_check",
      sql`${table.failureCode} is null or ${table.failureCode} in ('provider_unavailable', 'timeout', 'malformed_output', 'validation_failed', 'persistence_failed', 'configuration_error', 'cancelled', 'exhausted')`,
    ),
    check(
      "interpretation_runs_state_coherence_check",
      sql`(${table.status} = 'running' and ${table.startedAt} is not null and ${table.completedAt} is null and ${table.failureCode} is null) or (${table.status} = 'succeeded' and ${table.startedAt} is not null and ${table.completedAt} is not null and ${table.failureCode} is null) or (${table.status} = 'failed' and ${table.startedAt} is not null and ${table.completedAt} is not null and ${table.failureCode} is not null) or ${table.status} in ('pending', 'cancelled')`,
    ),
    check(
      "interpretation_runs_completed_after_started_check",
      sql`${table.completedAt} is null or ${table.startedAt} is null or ${table.completedAt} >= ${table.startedAt}`,
    ),
  ],
);

export const candidateClaims = pgTable(
  "candidate_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    interpretationRunId: uuid("interpretation_run_id").notNull(),
    jobId: uuid("job_id").notNull(),
    logicalKey: text("logical_key").notNull(),
    proposedSubjectNodeId: uuid("proposed_subject_node_id"),
    claimKind: text("claim_kind").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("candidate_claims_world_id_id_unique").on(table.worldId, table.id),
    index("candidate_claims_interpretation_run_id_index").on(
      table.interpretationRunId,
    ),
    unique("candidate_claims_job_logical_key_unique").on(
      table.jobId,
      table.logicalKey,
    ),
    foreignKey({
      name: "candidate_claims_job_world_fk",
      columns: [table.worldId, table.jobId],
      foreignColumns: [jobs.worldId, jobs.id],
    }).onDelete("restrict"),
    index("candidate_claims_proposed_subject_node_index")
      .on(table.worldId, table.proposedSubjectNodeId)
      .where(sql`${table.proposedSubjectNodeId} is not null`),
    foreignKey({
      name: "candidate_claims_interpretation_run_world_fk",
      columns: [table.worldId, table.interpretationRunId],
      foreignColumns: [interpretationRuns.worldId, interpretationRuns.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "candidate_claims_interpretation_run_job_world_fk",
      columns: [table.worldId, table.interpretationRunId, table.jobId],
      foreignColumns: [
        interpretationRuns.worldId,
        interpretationRuns.id,
        interpretationRuns.jobId,
      ],
    }).onDelete("restrict"),
    check(
      "candidate_claims_kind_not_blank",
      sql`length(btrim(${table.claimKind})) > 0`,
    ),
    check(
      "candidate_claims_step_102_kind_check",
      sql`${table.claimKind} = 'proposition'`,
    ),
    check(
      "candidate_claims_logical_key_not_blank",
      sql`length(btrim(${table.logicalKey})) > 0`,
    ),
    check(
      "candidate_claims_payload_object_check",
      sql`jsonb_typeof(${table.payload}) = 'object'`,
    ),
    check(
      "candidate_claims_step_102_payload_check",
      sql`${table.payload} ?& array['subject', 'predicate', 'object', 'explanation', 'confidence', 'schema_version'] and (${table.payload} - array['subject', 'predicate', 'object', 'explanation', 'confidence', 'schema_version']) = '{}'::jsonb and jsonb_typeof(${table.payload}->'subject') = 'string' and length(${table.payload}->>'subject') between 1 and 160 and jsonb_typeof(${table.payload}->'predicate') = 'string' and ${table.payload}->>'predicate' ~ '^[a-z][a-z0-9_]*$' and length(${table.payload}->>'predicate') <= 64 and jsonb_typeof(${table.payload}->'object') in ('string', 'number', 'boolean') and (jsonb_typeof(${table.payload}->'object') <> 'string' or length(${table.payload}->>'object') <= 500) and jsonb_typeof(${table.payload}->'explanation') = 'string' and length(${table.payload}->>'explanation') between 1 and 500 and jsonb_typeof(${table.payload}->'confidence') = 'number' and (${table.payload}->>'confidence')::numeric between 0 and 1 and ${table.payload}->>'schema_version' = 'candidate-set-v1'`,
    ),
  ],
);

export const candidateClaimEvidence = pgTable(
  "candidate_claim_evidence",
  {
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    candidateClaimId: uuid("candidate_claim_id").notNull(),
    sourceFragmentId: uuid("source_fragment_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: "candidate_claim_evidence_primary_key",
      columns: [table.candidateClaimId, table.sourceFragmentId],
    }),
    index("candidate_claim_evidence_world_id_index").on(table.worldId),
    foreignKey({
      name: "candidate_claim_evidence_claim_world_fk",
      columns: [table.worldId, table.candidateClaimId],
      foreignColumns: [candidateClaims.worldId, candidateClaims.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "candidate_claim_evidence_fragment_world_fk",
      columns: [table.worldId, table.sourceFragmentId],
      foreignColumns: [sourceFragments.worldId, sourceFragments.id],
    }).onDelete("restrict"),
  ],
);

export const admissionDecisions = pgTable(
  "admission_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    candidateClaimId: uuid("candidate_claim_id").notNull(),
    decisionKind: text("decision_kind").notNull(),
    authorityKind: text("authority_kind").notNull(),
    decidedByAccountId: uuid("decided_by_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    rationale: text("rationale"),
    correctionPayload: jsonb("correction_payload"),
    supersedesDecisionId: uuid("supersedes_decision_id").references(
      (): AnyPgColumn => admissionDecisions.id,
      { onDelete: "restrict" },
    ),
    decidedAt: timestamp("decided_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("admission_decisions_world_id_id_unique").on(
      table.worldId,
      table.id,
    ),
    unique("admission_decisions_world_candidate_id_unique").on(
      table.worldId,
      table.candidateClaimId,
      table.id,
    ),
    index("admission_decisions_candidate_claim_id_index").on(
      table.candidateClaimId,
    ),
    index("admission_decisions_supersedes_candidate_index")
      .on(table.worldId, table.candidateClaimId, table.supersedesDecisionId)
      .where(sql`${table.supersedesDecisionId} is not null`),
    foreignKey({
      name: "admission_decisions_candidate_claim_world_fk",
      columns: [table.worldId, table.candidateClaimId],
      foreignColumns: [candidateClaims.worldId, candidateClaims.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "admission_decisions_actor_world_membership_fk",
      columns: [table.worldId, table.decidedByAccountId],
      foreignColumns: [worldMemberships.worldId, worldMemberships.userId],
    }).onDelete("restrict"),
    check(
      "admission_decisions_kind_check",
      sql`${table.decisionKind} in ('accept', 'reject', 'correct', 'defer')`,
    ),
    check(
      "admission_decisions_authority_check",
      sql`${table.authorityKind} = 'user'`,
    ),
    check(
      "admission_decisions_payload_coherence_check",
      sql`(${table.decisionKind} = 'correct' and ${table.correctionPayload} is not null and jsonb_typeof(${table.correctionPayload}) = 'object') or (${table.decisionKind} in ('accept', 'reject', 'defer') and ${table.correctionPayload} is null)`,
    ),
  ],
);
