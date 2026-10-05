import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  unique,
  foreignKey,
  check,
  primaryKey,
} from "drizzle-orm/pg-core";
import { worlds } from "./ownership";
import { ontologyNodes } from "./model";
import { admissionDecisions } from "./interpretation";
import { sourceFragments } from "./evidence";

export const epistemicAssertions = pgTable(
  "epistemic_assertions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "restrict" }),
    subjectNodeId: uuid("subject_node_id").notNull(),
    predicate: text("predicate").notNull(),
    value: jsonb("value").notNull(),
    epistemicActorNodeId: uuid("epistemic_actor_node_id").notNull(),
    epistemicMode: text("epistemic_mode").notNull(),
    admittedByDecisionId: uuid("admitted_by_decision_id").notNull().unique(),
    supersedesEpistemicAssertionId: uuid(
      "supersedes_epistemic_assertion_id",
    ).unique(),
    validFrom: timestamp("valid_from", { withTimezone: true })
      .defaultNow()
      .notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("epistemic_assertions_world_id_id_key").on(t.worldId, t.id),
    foreignKey({
      columns: [t.worldId, t.subjectNodeId],
      foreignColumns: [ontologyNodes.worldId, ontologyNodes.id],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.worldId, t.epistemicActorNodeId],
      foreignColumns: [ontologyNodes.worldId, ontologyNodes.id],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.worldId, t.admittedByDecisionId],
      foreignColumns: [admissionDecisions.worldId, admissionDecisions.id],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.worldId, t.supersedesEpistemicAssertionId],
      foreignColumns: [t.worldId, t.id],
    }).onDelete("restrict"),
    check(
      "epistemic_assertions_predicate_check",
      sql`${t.predicate} ~ '^[a-z][a-z0-9_]{0,63}$'`,
    ),
    check(
      "epistemic_assertions_value_check",
      sql`jsonb_typeof(${t.value}) in ('string','number','boolean')`,
    ),
    check(
      "epistemic_assertions_epistemic_mode_check",
      sql`${t.epistemicMode} in ('estimate','belief','assessment','report','feeling')`,
    ),
    check(
      "epistemic_assertions_check",
      sql`${t.supersedesEpistemicAssertionId} is distinct from ${t.id}`,
    ),
    check(
      "epistemic_assertions_check1",
      sql`${t.validTo} is null or ${t.validTo} > ${t.validFrom}`,
    ),
  ],
);

export const epistemicAssertionEvidence = pgTable(
  "epistemic_assertion_evidence",
  {
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "restrict" }),
    epistemicAssertionId: uuid("epistemic_assertion_id").notNull(),
    sourceFragmentId: uuid("source_fragment_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.epistemicAssertionId, t.sourceFragmentId] }),
    foreignKey({
      columns: [t.worldId, t.epistemicAssertionId],
      foreignColumns: [epistemicAssertions.worldId, epistemicAssertions.id],
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.worldId, t.sourceFragmentId],
      foreignColumns: [sourceFragments.worldId, sourceFragments.id],
    }).onDelete("restrict"),
  ],
);
