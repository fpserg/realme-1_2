import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260817002110_step_97_identity_and_world_ownership.sql";

describe("Step 97 ownership migration", () => {
  it("enables RLS and denies anonymous table access", async () => {
    const sql = await readFile(migrationPath, "utf8");

    for (const table of [
      "accounts",
      "worlds",
      "world_memberships",
      "companions",
    ]) {
      expect(sql).toMatch(
        new RegExp(
          `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
          "i",
        ),
      );
      expect(sql).toMatch(
        new RegExp(
          `revoke\\s+all\\s+on\\s+public\\.${table}\\s+from\\s+anon,\\s*authenticated`,
          "i",
        ),
      );
    }
  });

  it("does not cross into Step 98 canonical truth", async () => {
    const sql = await readFile(migrationPath, "utf8");

    for (const deferredTable of [
      "observations",
      "interpretations",
      "admissions",
      "ontology_nodes",
      "operational_periods",
      "jobs",
    ]) {
      expect(sql).not.toMatch(
        new RegExp(`create\\s+table\\s+(?:public\\.)?${deferredTable}\\b`, "i"),
      );
    }
  });
});
