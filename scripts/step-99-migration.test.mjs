import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const tag = "20260820185900_step_99_persist_first_observation_capture";
const migrationPath = `supabase/migrations/${tag}.sql`;

describe("Step 99 persist-first migration", () => {
  it("keeps migration, journal and snapshot identities aligned", async () => {
    const [journal, snapshot] = await Promise.all([
      readFile("supabase/migrations/meta/_journal.json", "utf8"),
      readFile(`supabase/migrations/meta/20260820185900_snapshot.json`, "utf8"),
    ]);

    expect(JSON.parse(journal).entries.at(-1)?.tag).toBe(tag);
    expect(JSON.parse(snapshot).id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("enforces World-scoped capture idempotency and correction chains", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toMatch(/ADD COLUMN capture_idempotency_key uuid/i);
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX observations_world_capture_idempotency_unique[\s\S]*\(world_id, capture_idempotency_key\)[\s\S]*capture_idempotency_key IS NOT NULL/i,
    );
    expect(sql).toMatch(
      /observation_corrections_supersedes_observation_world_fk[\s\S]*FOREIGN KEY \(world_id, observation_id, supersedes_correction_id\)[\s\S]*REFERENCES public\.observation_corrections \(world_id, observation_id, id\)/i,
    );
    expect(sql).toMatch(/observation_corrections_root_unique/i);
    expect(sql).toMatch(/observation_corrections_successor_unique/i);
  });

  it("derives authority and recorded time while atomically preserving exact text", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const captureFunction = sql.slice(
      sql.indexOf("CREATE OR REPLACE FUNCTION public.capture_text_observation"),
      sql.indexOf(
        "CREATE OR REPLACE FUNCTION public.correct_observation_occurred_time",
      ),
    );

    expect(captureFunction).toMatch(
      /v_actor_id uuid := \(SELECT auth\.uid\(\)\)/i,
    );
    expect(captureFunction).toMatch(
      /WHERE world\.initial_owner_id = v_actor_id/i,
    );
    expect(captureFunction).not.toMatch(/p_world_id|p_recorded_at|p_actor_id/i);
    expect(captureFunction).toMatch(
      /INSERT INTO public\.observations[\s\S]*INSERT INTO public\.source_fragments/i,
    );
    expect(captureFunction).toMatch(/fragment\.exact_text[\s\S]*p_exact_text/i);
    expect(captureFunction).toMatch(
      /ON CONFLICT \(world_id, capture_idempotency_key\)/i,
    );
    expect(captureFunction).not.toMatch(
      /interpretation_runs|candidate_claims|assertions/i,
    );
  });

  it("exposes only the narrow functions and preserves generic write denials", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toMatch(/SECURITY DEFINER[\s\S]*SET search_path = ''/i);
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.capture_text_observation[\s\S]*FROM PUBLIC, anon, authenticated/i,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.capture_text_observation[\s\S]*TO authenticated/i,
    );
    expect(sql).not.toMatch(
      /GRANT (INSERT|UPDATE|DELETE) ON (TABLE )?public\.(observations|source_fragments|observation_corrections)/i,
    );
  });

  it("carries rollback-only staging regression coverage", async () => {
    const verification = await readFile(
      "scripts/verify-step-99-persist-first.sql",
      "utf8",
    );

    expect(verification).toMatch(/^begin;/i);
    expect(verification).toMatch(/rollback;\s*$/i);
    for (const phrase of [
      "unauthenticated capture",
      "duplicate delivery",
      "transaction rollback",
      "downstream failure",
      "append-only correction",
      "direct observation write",
      "cross-world read isolation",
    ]) {
      expect(verification).toContain(phrase);
    }
  });
});
