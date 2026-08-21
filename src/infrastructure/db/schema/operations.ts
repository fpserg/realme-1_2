import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { observations } from "./evidence";
import { accounts, worldMemberships, worlds } from "./ownership";

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    jobKind: text("job_kind").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").default("queued").notNull(),
    payload: jsonb("payload")
      .default(sql`'{}'::jsonb`)
      .notNull(),
    availableAt: timestamp("available_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockToken: uuid("lock_token"),
    observationId: uuid("observation_id").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    lastFailureCode: text("last_failure_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("jobs_world_kind_idempotency_unique").on(
      table.worldId,
      table.jobKind,
      table.idempotencyKey,
    ),
    unique("jobs_world_id_id_unique").on(table.worldId, table.id),
    unique("jobs_world_id_observation_id_unique").on(
      table.worldId,
      table.id,
      table.observationId,
    ),
    index("jobs_status_available_at_index").on(table.status, table.availableAt),
    index("jobs_observation_id_index").on(table.observationId),
    foreignKey({
      name: "jobs_observation_world_fk",
      columns: [table.worldId, table.observationId],
      foreignColumns: [observations.worldId, observations.id],
    }).onDelete("restrict"),
    check("jobs_kind_not_blank", sql`length(btrim(${table.jobKind})) > 0`),
    check(
      "jobs_idempotency_key_not_blank",
      sql`length(btrim(${table.idempotencyKey})) > 0`,
    ),
    check(
      "jobs_status_check",
      sql`${table.status} in ('queued', 'running', 'succeeded', 'failed', 'cancelled')`,
    ),
    check(
      "jobs_step_102_kind_check",
      sql`${table.jobKind} = 'interpret_observation'`,
    ),
    check("jobs_attempts_check", sql`${table.attempts} >= 0`),
    check("jobs_max_attempts_check", sql`${table.maxAttempts} > 0`),
    check(
      "jobs_attempts_within_max_check",
      sql`${table.attempts} <= ${table.maxAttempts}`,
    ),
    check(
      "jobs_queued_state_check",
      sql`${table.status} <> 'queued' or (${table.attempts} < ${table.maxAttempts} and ${table.lockedAt} is null and ${table.lockToken} is null)`,
    ),
    check(
      "jobs_running_state_check",
      sql`${table.status} <> 'running' or (${table.lockedAt} is not null and ${table.lockToken} is not null and ${table.attempts} >= 1)`,
    ),
    check(
      "jobs_non_running_unlocked_check",
      sql`${table.status} = 'running' or (${table.lockedAt} is null and ${table.lockToken} is null)`,
    ),
    check(
      "jobs_payload_object_check",
      sql`jsonb_typeof(${table.payload}) = 'object'`,
    ),
    check(
      "jobs_interpret_observation_input_check",
      sql`${table.jobKind} <> 'interpret_observation' or (${table.observationId} is not null and ${table.payload} ?& array['prompt_version', 'schema_version'] and (${table.payload} - array['prompt_version', 'schema_version']) = '{}'::jsonb and jsonb_typeof(${table.payload}->'prompt_version') = 'string' and jsonb_typeof(${table.payload}->'schema_version') = 'string' and ${table.payload}->>'prompt_version' = 'interpret-observation-v1' and ${table.payload}->>'schema_version' = 'candidate-set-v1')`,
    ),
    check(
      "jobs_last_failure_code_check",
      sql`${table.lastFailureCode} is null or ${table.lastFailureCode} in ('provider_unavailable', 'timeout', 'malformed_output', 'validation_failed', 'persistence_failed', 'configuration_error', 'cancelled', 'exhausted')`,
    ),
    check(
      "jobs_success_has_no_failure_check",
      sql`${table.status} <> 'succeeded' or ${table.lastFailureCode} is null`,
    ),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    actorKind: text("actor_kind").notNull(),
    actorAccountId: uuid("actor_account_id").references(() => accounts.id, {
      onDelete: "restrict",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata")
      .default(sql`'{}'::jsonb`)
      .notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_events_world_occurred_at_index").on(
      table.worldId,
      table.occurredAt,
    ),
    foreignKey({
      name: "audit_events_actor_world_membership_fk",
      columns: [table.worldId, table.actorAccountId],
      foreignColumns: [worldMemberships.worldId, worldMemberships.userId],
    }).onDelete("restrict"),
    check(
      "audit_events_actor_kind_check",
      sql`${table.actorKind} in ('user', 'system', 'policy')`,
    ),
    check(
      "audit_events_user_actor_check",
      sql`${table.actorKind} <> 'user' or ${table.actorAccountId} is not null`,
    ),
    check(
      "audit_events_action_not_blank",
      sql`length(btrim(${table.action})) > 0`,
    ),
    check(
      "audit_events_entity_type_not_blank",
      sql`length(btrim(${table.entityType})) > 0`,
    ),
    check(
      "audit_events_metadata_object_check",
      sql`jsonb_typeof(${table.metadata}) = 'object'`,
    ),
    check(
      "audit_events_temporal_correction_metadata_check",
      sql`${table.action} <> 'observation_operational_period_corrected' or (${table.entityType} = 'observation' and ${table.entityId} is not null and ${table.metadata} ?& array['prior_membership_id', 'prior_operational_period_id', 'successor_membership_id', 'successor_operational_period_id', 'reason_category'] and (${table.metadata} - array['prior_membership_id', 'prior_operational_period_id', 'successor_membership_id', 'successor_operational_period_id', 'reason_category']) = '{}'::jsonb and jsonb_typeof(${table.metadata}->'prior_membership_id') = 'string' and jsonb_typeof(${table.metadata}->'prior_operational_period_id') = 'string' and jsonb_typeof(${table.metadata}->'successor_membership_id') = 'string' and jsonb_typeof(${table.metadata}->'successor_operational_period_id') = 'string' and jsonb_typeof(${table.metadata}->'reason_category') = 'string')`,
    ),
  ],
);
