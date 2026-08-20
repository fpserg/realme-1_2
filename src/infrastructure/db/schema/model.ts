import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { sourceFragments } from "./evidence";
import { admissionDecisions } from "./interpretation";
import { worlds } from "./ownership";

export const ontologyNodes = pgTable(
  "ontology_nodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    admittedByDecisionId: uuid("admitted_by_decision_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("ontology_nodes_world_id_id_unique").on(table.worldId, table.id),
    foreignKey({
      name: "ontology_nodes_admission_decision_world_fk",
      columns: [table.worldId, table.admittedByDecisionId],
      foreignColumns: [admissionDecisions.worldId, admissionDecisions.id],
    }).onDelete("restrict"),
  ],
);

export const ontologyAliases = pgTable(
  "ontology_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    nodeId: uuid("node_id").notNull(),
    alias: text("alias").notNull(),
    locale: text("locale"),
    validFrom: timestamp("valid_from", { withTimezone: true })
      .defaultNow()
      .notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    admittedByDecisionId: uuid("admitted_by_decision_id").notNull(),
    supersedesAliasId: uuid("supersedes_alias_id").references(
      (): AnyPgColumn => ontologyAliases.id,
      { onDelete: "restrict" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("ontology_aliases_world_id_id_unique").on(table.worldId, table.id),
    index("ontology_aliases_node_id_index").on(table.nodeId),
    foreignKey({
      name: "ontology_aliases_node_world_fk",
      columns: [table.worldId, table.nodeId],
      foreignColumns: [ontologyNodes.worldId, ontologyNodes.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "ontology_aliases_admission_decision_world_fk",
      columns: [table.worldId, table.admittedByDecisionId],
      foreignColumns: [admissionDecisions.worldId, admissionDecisions.id],
    }).onDelete("restrict"),
    check(
      "ontology_aliases_alias_not_blank",
      sql`length(btrim(${table.alias})) > 0`,
    ),
    check(
      "ontology_aliases_valid_interval_check",
      sql`${table.validTo} is null or ${table.validTo} > ${table.validFrom}`,
    ),
  ],
);

export const ontologyRelationships = pgTable(
  "ontology_relationships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    subjectNodeId: uuid("subject_node_id").notNull(),
    objectNodeId: uuid("object_node_id").notNull(),
    predicate: text("predicate").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true })
      .defaultNow()
      .notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    admittedByDecisionId: uuid("admitted_by_decision_id").notNull(),
    supersedesRelationshipId: uuid("supersedes_relationship_id").references(
      (): AnyPgColumn => ontologyRelationships.id,
      { onDelete: "restrict" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("ontology_relationships_world_id_id_unique").on(
      table.worldId,
      table.id,
    ),
    index("ontology_relationships_subject_node_id_index").on(
      table.subjectNodeId,
    ),
    index("ontology_relationships_object_node_id_index").on(table.objectNodeId),
    foreignKey({
      name: "ontology_relationships_subject_node_world_fk",
      columns: [table.worldId, table.subjectNodeId],
      foreignColumns: [ontologyNodes.worldId, ontologyNodes.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "ontology_relationships_object_node_world_fk",
      columns: [table.worldId, table.objectNodeId],
      foreignColumns: [ontologyNodes.worldId, ontologyNodes.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "ontology_relationships_admission_decision_world_fk",
      columns: [table.worldId, table.admittedByDecisionId],
      foreignColumns: [admissionDecisions.worldId, admissionDecisions.id],
    }).onDelete("restrict"),
    check(
      "ontology_relationships_predicate_not_blank",
      sql`length(btrim(${table.predicate})) > 0`,
    ),
    check(
      "ontology_relationships_distinct_nodes_check",
      sql`${table.subjectNodeId} <> ${table.objectNodeId}`,
    ),
    check(
      "ontology_relationships_valid_interval_check",
      sql`${table.validTo} is null or ${table.validTo} > ${table.validFrom}`,
    ),
  ],
);

export const assertions = pgTable(
  "assertions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    subjectNodeId: uuid("subject_node_id"),
    predicate: text("predicate").notNull(),
    objectNodeId: uuid("object_node_id"),
    value: jsonb("value"),
    validFrom: timestamp("valid_from", { withTimezone: true })
      .defaultNow()
      .notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    admittedByDecisionId: uuid("admitted_by_decision_id").notNull(),
    supersedesAssertionId: uuid("supersedes_assertion_id").references(
      (): AnyPgColumn => assertions.id,
      { onDelete: "restrict" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("assertions_world_id_id_unique").on(table.worldId, table.id),
    index("assertions_world_id_predicate_index").on(
      table.worldId,
      table.predicate,
    ),
    foreignKey({
      name: "assertions_subject_node_world_fk",
      columns: [table.worldId, table.subjectNodeId],
      foreignColumns: [ontologyNodes.worldId, ontologyNodes.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "assertions_object_node_world_fk",
      columns: [table.worldId, table.objectNodeId],
      foreignColumns: [ontologyNodes.worldId, ontologyNodes.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "assertions_admission_decision_world_fk",
      columns: [table.worldId, table.admittedByDecisionId],
      foreignColumns: [admissionDecisions.worldId, admissionDecisions.id],
    }).onDelete("restrict"),
    check(
      "assertions_predicate_not_blank",
      sql`length(btrim(${table.predicate})) > 0`,
    ),
    check(
      "assertions_exactly_one_object_check",
      sql`num_nonnulls(${table.objectNodeId}, ${table.value}) = 1`,
    ),
    check(
      "assertions_scalar_value_check",
      sql`${table.value} is null or jsonb_typeof(${table.value}) in ('string', 'number', 'boolean')`,
    ),
    check(
      "assertions_valid_interval_check",
      sql`${table.validTo} is null or ${table.validTo} > ${table.validFrom}`,
    ),
  ],
);

export const assertionEvidence = pgTable(
  "assertion_evidence",
  {
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    assertionId: uuid("assertion_id").notNull(),
    sourceFragmentId: uuid("source_fragment_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: "assertion_evidence_primary_key",
      columns: [table.assertionId, table.sourceFragmentId],
    }),
    index("assertion_evidence_world_id_index").on(table.worldId),
    foreignKey({
      name: "assertion_evidence_assertion_world_fk",
      columns: [table.worldId, table.assertionId],
      foreignColumns: [assertions.worldId, assertions.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "assertion_evidence_fragment_world_fk",
      columns: [table.worldId, table.sourceFragmentId],
      foreignColumns: [sourceFragments.worldId, sourceFragments.id],
    }).onDelete("restrict"),
  ],
);
