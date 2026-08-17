// Drizzle schema modules will be added only with separately reviewed domain work.
// An empty export keeps the migration boundary explicit during Step 96.
export {};
import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const worlds = pgTable(
  "worlds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    initialOwnerId: uuid("initial_owner_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("worlds_initial_owner_id_unique").on(table.initialOwnerId),
  ],
);

export const worldMemberships = pgTable(
  "world_memberships",
  {
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      name: "world_memberships_world_id_user_id_primary_key",
      columns: [table.worldId, table.userId],
    }),
    check(
      "world_memberships_role_check",
      sql`${table.role} in ('owner', 'member')`,
    ),
  ],
);

export const companions = pgTable(
  "companions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("companions_world_id_unique").on(table.worldId)],
);
