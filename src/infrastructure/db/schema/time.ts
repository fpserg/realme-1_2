import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { observations } from "./evidence";
import { accounts, worldMemberships, worlds } from "./ownership";

export const timeSettings = pgTable(
  "time_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    timezoneName: text("timezone_name").notNull(),
    operationalDayBoundary: time("operational_day_boundary")
      .default(sql`'04:00:00'::time`)
      .notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .defaultNow()
      .notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    recordedByAccountId: uuid("recorded_by_account_id").references(
      () => accounts.id,
      { onDelete: "restrict" },
    ),
    supersedesTimeSettingId: uuid("supersedes_time_setting_id").references(
      (): AnyPgColumn => timeSettings.id,
      { onDelete: "restrict" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("time_settings_world_id_id_unique").on(table.worldId, table.id),
    uniqueIndex("time_settings_world_effective_from_unique").on(
      table.worldId,
      table.effectiveFrom,
    ),
    foreignKey({
      name: "time_settings_recorded_by_world_membership_fk",
      columns: [table.worldId, table.recordedByAccountId],
      foreignColumns: [worldMemberships.worldId, worldMemberships.userId],
    }).onDelete("restrict"),
    check(
      "time_settings_timezone_not_blank",
      sql`length(btrim(${table.timezoneName})) > 0`,
    ),
    check(
      "time_settings_effective_interval_check",
      sql`${table.effectiveTo} is null or ${table.effectiveTo} > ${table.effectiveFrom}`,
    ),
  ],
);

export const operationalPeriods = pgTable(
  "operational_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    timeSettingId: uuid("time_setting_id").notNull(),
    localDate: date("local_date").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    supersedesPeriodId: uuid("supersedes_period_id").references(
      (): AnyPgColumn => operationalPeriods.id,
      { onDelete: "restrict" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("operational_periods_world_id_id_unique").on(
      table.worldId,
      table.id,
    ),
    index("operational_periods_world_local_date_index").on(
      table.worldId,
      table.localDate,
    ),
    foreignKey({
      name: "operational_periods_time_setting_world_fk",
      columns: [table.worldId, table.timeSettingId],
      foreignColumns: [timeSettings.worldId, timeSettings.id],
    }).onDelete("restrict"),
    check(
      "operational_periods_interval_check",
      sql`${table.endsAt} > ${table.startsAt}`,
    ),
  ],
);

export const observationOperationalPeriodMemberships = pgTable(
  "observation_operational_period_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    observationId: uuid("observation_id").notNull(),
    operationalPeriodId: uuid("operational_period_id").notNull(),
    assignmentKind: text("assignment_kind").notNull(),
    assignedByAccountId: uuid("assigned_by_account_id").references(
      () => accounts.id,
      { onDelete: "restrict" },
    ),
    supersedesMembershipId: uuid("supersedes_membership_id").references(
      (): AnyPgColumn => observationOperationalPeriodMemberships.id,
      { onDelete: "restrict" },
    ),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("observation_operational_period_memberships_world_id_id_unique").on(
      table.worldId,
      table.id,
    ),
    unique(
      "observation_operational_memberships_world_observation_id_unique",
    ).on(table.worldId, table.observationId, table.id),
    index("observation_operational_period_memberships_observation_index").on(
      table.observationId,
    ),
    index("observation_operational_membership_supersedes_path_index")
      .on(table.worldId, table.observationId, table.supersedesMembershipId)
      .where(sql`${table.supersedesMembershipId} is not null`),
    uniqueIndex("observation_operational_membership_successor_unique")
      .on(table.supersedesMembershipId)
      .where(sql`${table.supersedesMembershipId} is not null`),
    uniqueIndex("observation_operational_membership_initial_unique")
      .on(table.worldId, table.observationId)
      .where(sql`${table.assignmentKind} = 'initial'`),
    foreignKey({
      name: "observation_operational_membership_observation_world_fk",
      columns: [table.worldId, table.observationId],
      foreignColumns: [observations.worldId, observations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "observation_operational_membership_period_world_fk",
      columns: [table.worldId, table.operationalPeriodId],
      foreignColumns: [operationalPeriods.worldId, operationalPeriods.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "observation_operational_membership_actor_world_fk",
      columns: [table.worldId, table.assignedByAccountId],
      foreignColumns: [worldMemberships.worldId, worldMemberships.userId],
    }).onDelete("restrict"),
    check(
      "observation_operational_memberships_assignment_kind_check",
      sql`${table.assignmentKind} in ('initial', 'correction')`,
    ),
    check(
      "observation_operational_memberships_correction_chain_check",
      sql`(${table.assignmentKind} = 'initial' and ${table.supersedesMembershipId} is null) or (${table.assignmentKind} = 'correction' and ${table.supersedesMembershipId} is not null)`,
    ),
  ],
);

export const reflectionPeriods = pgTable(
  "reflection_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    periodKind: text("period_kind").notNull(),
    label: text("label"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("reflection_periods_world_id_id_unique").on(table.worldId, table.id),
    index("reflection_periods_world_starts_at_index").on(
      table.worldId,
      table.startsAt,
    ),
    check(
      "reflection_periods_kind_not_blank",
      sql`length(btrim(${table.periodKind})) > 0`,
    ),
    check(
      "reflection_periods_interval_check",
      sql`${table.endsAt} > ${table.startsAt}`,
    ),
  ],
);

export const observationReflectionPeriodMemberships = pgTable(
  "observation_reflection_period_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    observationId: uuid("observation_id").notNull(),
    reflectionPeriodId: uuid("reflection_period_id").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("observation_reflection_period_memberships_world_id_id_unique").on(
      table.worldId,
      table.id,
    ),
    uniqueIndex("observation_reflection_period_membership_unique").on(
      table.observationId,
      table.reflectionPeriodId,
    ),
    foreignKey({
      name: "observation_reflection_membership_observation_world_fk",
      columns: [table.worldId, table.observationId],
      foreignColumns: [observations.worldId, observations.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "observation_reflection_membership_period_world_fk",
      columns: [table.worldId, table.reflectionPeriodId],
      foreignColumns: [reflectionPeriods.worldId, reflectionPeriods.id],
    }).onDelete("restrict"),
  ],
);
