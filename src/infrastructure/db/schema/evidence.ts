import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { accounts, worldMemberships, worlds } from "./ownership";

export const observations = pgTable(
  "observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    recordedByAccountId: uuid("recorded_by_account_id").references(
      () => accounts.id,
      { onDelete: "restrict" },
    ),
    sourceKind: text("source_kind").notNull(),
    sourceLocator: text("source_locator"),
    sourceTimezone: text("source_timezone"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    occurredPrecision: text("occurred_precision").default("unknown").notNull(),
    localCalendarDate: date("local_calendar_date"),
    captureIdempotencyKey: uuid("capture_idempotency_key"),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("observations_world_id_id_unique").on(table.worldId, table.id),
    index("observations_world_id_recorded_at_index").on(
      table.worldId,
      table.recordedAt,
    ),
    index("observations_recorded_by_account_id_index").on(
      table.recordedByAccountId,
    ),
    uniqueIndex("observations_world_capture_idempotency_unique")
      .on(table.worldId, table.captureIdempotencyKey)
      .where(sql`${table.captureIdempotencyKey} is not null`),
    foreignKey({
      name: "observations_recorded_by_world_membership_fk",
      columns: [table.worldId, table.recordedByAccountId],
      foreignColumns: [worldMemberships.worldId, worldMemberships.userId],
    }).onDelete("restrict"),
    check(
      "observations_source_kind_not_blank",
      sql`length(btrim(${table.sourceKind})) > 0`,
    ),
    check(
      "observations_occurred_precision_check",
      sql`${table.occurredPrecision} in ('exact', 'approximate', 'date', 'unknown')`,
    ),
    check(
      "observations_exact_occurrence_requires_instant",
      sql`${table.occurredPrecision} <> 'exact' or ${table.occurredAt} is not null`,
    ),
  ],
);

export const sourceFragments = pgTable(
  "source_fragments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    observationId: uuid("observation_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    exactText: text("exact_text").notNull(),
    contentHash: text("content_hash").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("source_fragments_world_id_id_unique").on(table.worldId, table.id),
    uniqueIndex("source_fragments_observation_ordinal_unique").on(
      table.observationId,
      table.ordinal,
    ),
    foreignKey({
      name: "source_fragments_observation_world_fk",
      columns: [table.worldId, table.observationId],
      foreignColumns: [observations.worldId, observations.id],
    }).onDelete("restrict"),
    check("source_fragments_ordinal_check", sql`${table.ordinal} >= 0`),
    check(
      "source_fragments_exact_text_not_blank",
      sql`length(${table.exactText}) > 0`,
    ),
    check(
      "source_fragments_content_hash_not_blank",
      sql`length(btrim(${table.contentHash})) > 0`,
    ),
  ],
);

export const observationCorrections = pgTable(
  "observation_corrections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    observationId: uuid("observation_id").notNull(),
    correctedOccurredAt: timestamp("corrected_occurred_at", {
      withTimezone: true,
    }),
    correctedOccurredPrecision: text("corrected_occurred_precision"),
    correctedSourceTimezone: text("corrected_source_timezone"),
    correctedLocalCalendarDate: date("corrected_local_calendar_date"),
    rationale: text("rationale"),
    recordedByAccountId: uuid("recorded_by_account_id").references(
      () => accounts.id,
      { onDelete: "restrict" },
    ),
    supersedesCorrectionId: uuid("supersedes_correction_id"),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("observation_corrections_world_id_id_unique").on(
      table.worldId,
      table.id,
    ),
    unique("observation_corrections_world_observation_id_unique").on(
      table.worldId,
      table.observationId,
      table.id,
    ),
    index("observation_corrections_observation_id_index").on(
      table.observationId,
    ),
    uniqueIndex("observation_corrections_root_unique")
      .on(table.worldId, table.observationId)
      .where(sql`${table.supersedesCorrectionId} is null`),
    uniqueIndex("observation_corrections_successor_unique")
      .on(table.supersedesCorrectionId)
      .where(sql`${table.supersedesCorrectionId} is not null`),
    foreignKey({
      name: "observation_corrections_observation_world_fk",
      columns: [table.worldId, table.observationId],
      foreignColumns: [observations.worldId, observations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "observation_corrections_recorded_by_world_membership_fk",
      columns: [table.worldId, table.recordedByAccountId],
      foreignColumns: [worldMemberships.worldId, worldMemberships.userId],
    }).onDelete("restrict"),
    foreignKey({
      name: "observation_corrections_supersedes_observation_world_fk",
      columns: [
        table.worldId,
        table.observationId,
        table.supersedesCorrectionId,
      ],
      foreignColumns: [table.worldId, table.observationId, table.id],
    }).onDelete("restrict"),
    check(
      "observation_corrections_precision_check",
      sql`${table.correctedOccurredPrecision} is null or ${table.correctedOccurredPrecision} in ('exact', 'approximate', 'date', 'unknown')`,
    ),
    check(
      "observation_corrections_has_change_check",
      sql`${table.correctedOccurredAt} is not null or ${table.correctedOccurredPrecision} is not null or ${table.correctedSourceTimezone} is not null or ${table.correctedLocalCalendarDate} is not null`,
    ),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    observationId: uuid("observation_id").notNull(),
    storageBucket: text("storage_bucket").notNull(),
    storageObjectKey: text("storage_object_key").notNull(),
    mediaType: text("media_type").notNull(),
    byteCount: bigint("byte_count", { mode: "number" }).notNull(),
    contentHash: text("content_hash").notNull(),
    originalFilename: text("original_filename"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("attachments_world_id_id_unique").on(table.worldId, table.id),
    uniqueIndex("attachments_world_storage_object_unique").on(
      table.worldId,
      table.storageBucket,
      table.storageObjectKey,
    ),
    foreignKey({
      name: "attachments_observation_world_fk",
      columns: [table.worldId, table.observationId],
      foreignColumns: [observations.worldId, observations.id],
    }).onDelete("restrict"),
    check("attachments_byte_count_check", sql`${table.byteCount} >= 0`),
    check(
      "attachments_storage_bucket_not_blank",
      sql`length(btrim(${table.storageBucket})) > 0`,
    ),
    check(
      "attachments_storage_object_key_not_blank",
      sql`length(btrim(${table.storageObjectKey})) > 0`,
    ),
    check(
      "attachments_media_type_not_blank",
      sql`length(btrim(${table.mediaType})) > 0`,
    ),
    check(
      "attachments_content_hash_not_blank",
      sql`length(btrim(${table.contentHash})) > 0`,
    ),
  ],
);
