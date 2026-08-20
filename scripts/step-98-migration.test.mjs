import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const migrationTag = "20260820095459_step_98_canonical_truth_schema";
const migrationPath = `supabase/migrations/${migrationTag}.sql`;
const snapshotPath = `supabase/migrations/meta/20260820095459_snapshot.json`;
const denialMigrationTag = "20260820095634_step_98_internal_table_denials";
const denialSnapshotPath =
  "supabase/migrations/meta/20260820095634_snapshot.json";
const admissionMigrationTag = "20260820100146_step_98_admission_invariants";
const admissionSnapshotPath =
  "supabase/migrations/meta/20260820100146_snapshot.json";

const truthTables = [
  "observations",
  "source_fragments",
  "observation_corrections",
  "attachments",
  "interpretation_runs",
  "candidate_claims",
  "candidate_claim_evidence",
  "admission_decisions",
  "ontology_nodes",
  "ontology_aliases",
  "ontology_relationships",
  "assertions",
  "assertion_evidence",
  "time_settings",
  "operational_periods",
  "observation_operational_period_memberships",
  "reflection_periods",
  "observation_reflection_period_memberships",
  "jobs",
  "audit_events",
];

function tableBody(sql, table) {
  const match = sql.match(
    new RegExp(`CREATE TABLE "${table}" \\(([\\s\\S]*?)\\n\\);`, "i"),
  );
  if (!match) throw new Error(`Missing table definition for ${table}`);
  return match[1];
}

describe("Step 98 canonical truth migration", () => {
  it("keeps every durable family World-scoped, RLS-protected and client-write-denied", async () => {
    const sql = await readFile(migrationPath, "utf8");

    for (const table of truthTables) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE "${table}" \\(`, "i"));
      expect(tableBody(sql, table)).toMatch(/"world_id" uuid NOT NULL/i);
      expect(sql).toMatch(
        new RegExp(
          `ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`,
          "i",
        ),
      );
    }

    expect(sql).toMatch(/REVOKE ALL ON TABLE[\s\S]*FROM anon, authenticated/i);
    expect(sql).not.toMatch(
      /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)[\s\S]*TO authenticated/i,
    );
    expect(sql).not.toMatch(/GRANT[\s\S]*TO anon/i);
    expect(sql).not.toMatch(/service_role/i);
  });

  it("makes observation, interpretation, admission and admitted state different records", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toMatch(
      /interpretation_runs_observation_world_fk[\s\S]*REFERENCES "public"\."observations"\("world_id","id"\)/i,
    );
    expect(sql).toMatch(
      /candidate_claims_interpretation_run_world_fk[\s\S]*REFERENCES "public"\."interpretation_runs"\("world_id","id"\)/i,
    );
    expect(sql).toMatch(
      /admission_decisions_candidate_claim_world_fk[\s\S]*REFERENCES "public"\."candidate_claims"\("world_id","id"\)/i,
    );
    expect(sql).toMatch(
      /assertions_admission_decision_world_fk[\s\S]*REFERENCES "public"\."admission_decisions"\("world_id","id"\)/i,
    );
    expect(sql).toMatch(
      /candidate_claim_evidence_fragment_world_fk[\s\S]*REFERENCES "public"\."source_fragments"\("world_id","id"\)/i,
    );
    expect(sql).toMatch(
      /assertion_evidence_fragment_world_fk[\s\S]*REFERENCES "public"\."source_fragments"\("world_id","id"\)/i,
    );
  });

  it("keeps ontology identity free of fixed names, ranks, parents and visuals", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const node = tableBody(sql, "ontology_nodes");

    expect(node).toMatch(/"id" uuid PRIMARY KEY/i);
    expect(node).toMatch(/"world_id" uuid NOT NULL/i);
    expect(node).toMatch(/"admitted_by_decision_id" uuid NOT NULL/i);
    expect(node).not.toMatch(
      /"(?:name|rank|tier|parent_id|realm|domain|locus|visual|image|geography)"/i,
    );
    expect(sql).not.toMatch(/CREATE TYPE[\s\S]*(?:domain|locus)/i);
  });

  it("preserves temporal distinctions and supersession within one World", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const observation = tableBody(sql, "observations");

    expect(observation).toMatch(/"occurred_at" timestamp with time zone/i);
    expect(observation).toMatch(/"recorded_at" timestamp with time zone/i);
    expect(observation).toMatch(/"source_timezone" text/i);
    expect(observation).toMatch(/"local_calendar_date" date/i);
    expect(sql).toMatch(
      /"operational_day_boundary" time DEFAULT '04:00:00'::time NOT NULL/i,
    );

    for (const constraint of [
      "observation_corrections_supersedes_world_fk",
      "admission_decisions_supersedes_world_fk",
      "ontology_aliases_supersedes_world_fk",
      "ontology_relationships_supersedes_world_fk",
      "assertions_supersedes_world_fk",
      "time_settings_supersedes_world_fk",
      "operational_periods_supersedes_world_fk",
      "observation_operational_membership_supersedes_world_fk",
    ]) {
      expect(sql).toMatch(
        new RegExp(
          `${constraint}[\\s\\S]*FOREIGN KEY \\(world_id, supersedes_[^)]+\\)[\\s\\S]*\\(world_id, id\\)`,
          "i",
        ),
      );
    }
  });

  it("keeps migration, journal and snapshot identities aligned", async () => {
    const [
      journalText,
      snapshotText,
      denialSnapshotText,
      admissionSnapshotText,
    ] = await Promise.all([
      readFile("supabase/migrations/meta/_journal.json", "utf8"),
      readFile(snapshotPath, "utf8"),
      readFile(denialSnapshotPath, "utf8"),
      readFile(admissionSnapshotPath, "utf8"),
    ]);
    const journal = JSON.parse(journalText);
    const snapshot = JSON.parse(snapshotText);
    const denialSnapshot = JSON.parse(denialSnapshotText);
    const admissionSnapshot = JSON.parse(admissionSnapshotText);
    const schemaEntry = journal.entries.find(
      (entry) => entry.tag === migrationTag,
    );

    expect(schemaEntry?.tag).toBe(migrationTag);
    expect(journal.entries.at(-2)?.tag).toBe(denialMigrationTag);
    expect(journal.entries.at(-1)?.tag).toBe(admissionMigrationTag);
    expect(snapshot.prevId).toBe("5d5bbab0-36f3-4a3f-b2c9-24ef4a4493af");
    expect(denialSnapshot.prevId).toBe(snapshot.id);
    expect(admissionSnapshot.prevId).toBe(denialSnapshot.id);
    expect(Object.keys(snapshot.tables)).toHaveLength(24);
    for (const table of truthTables) {
      expect(snapshot.tables).toHaveProperty(`public.${table}`);
    }
  });

  it("makes hidden internal tables explicitly deny all public clients", async () => {
    const sql = await readFile(
      `supabase/migrations/${denialMigrationTag}.sql`,
      "utf8",
    );

    for (const table of [
      "interpretation_runs",
      "candidate_claims",
      "candidate_claim_evidence",
      "jobs",
      "audit_events",
    ]) {
      expect(sql).toMatch(
        new RegExp(
          `CREATE POLICY ${table}_no_client_access[\\s\\S]*ON public\\.${table}[\\s\\S]*FOR ALL TO anon, authenticated[\\s\\S]*USING \\(false\\)[\\s\\S]*WITH CHECK \\(false\\)`,
          "i",
        ),
      );
    }
  });

  it("prevents rejected or deferred decisions from creating canonical state", async () => {
    const sql = await readFile(
      `supabase/migrations/${admissionMigrationTag}.sql`,
      "utf8",
    );

    expect(sql).toMatch(/decision\.decision_kind IN \('accept', 'correct'\)/i);
    expect(sql).toMatch(/SECURITY INVOKER[\s\S]*SET search_path = ''/i);
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION private\.require_admitting_decision\(\)[\s\S]*FROM public, anon, authenticated/i,
    );
    for (const table of [
      "ontology_nodes",
      "ontology_aliases",
      "ontology_relationships",
      "assertions",
    ]) {
      expect(sql).toMatch(
        new RegExp(
          `CREATE TRIGGER ${table}_require_admission[\\s\\S]*ON public\\.${table}[\\s\\S]*EXECUTE FUNCTION private\\.require_admitting_decision\\(\\)`,
          "i",
        ),
      );
    }
  });
});
