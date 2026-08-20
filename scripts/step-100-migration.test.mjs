import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const tag = "20260820213941_step_100_native_temporal_continuity";
const migrationPath = `supabase/migrations/${tag}.sql`;
const correctionTag = "20260820214041_step_100_period_conflict_correction";
const clockCorrectionTag =
  "20260820214147_step_100_setting_monotonic_clock_correction";
const dstCorrectionTag =
  "20260820223440_step_100_dst_civil_boundary_correction";

describe("Step 100 native temporal continuity migration", () => {
  it("keeps migration, journal and snapshot identities aligned", async () => {
    const [journal, snapshot] = await Promise.all([
      readFile("supabase/migrations/meta/_journal.json", "utf8"),
      readFile("supabase/migrations/meta/20260820213941_snapshot.json", "utf8"),
    ]);

    const entries = JSON.parse(journal).entries;
    expect(entries.some((entry) => entry.tag === tag && entry.idx === 6)).toBe(
      true,
    );
    expect(
      entries.some((entry) => entry.tag === correctionTag && entry.idx === 7),
    ).toBe(true);
    expect(entries.some((entry) => entry.tag === clockCorrectionTag)).toBe(
      true,
    );
    expect(entries.at(-1)?.tag).toBe(dstCorrectionTag);
    expect(JSON.parse(snapshot).id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(
      JSON.parse(
        await readFile(
          "supabase/migrations/meta/20260820223440_snapshot.json",
          "utf8",
        ),
      ).id,
    ).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("keeps successive prospective changes monotonic under one transaction", async () => {
    const correction = await readFile(
      `supabase/migrations/${clockCorrectionTag}.sql`,
      "utf8",
    );

    expect(correction).toMatch(/v_now timestamptz := clock_timestamp\(\)/i);
    expect(correction).toMatch(
      /greatest\([\s\S]*v_current\.effective_from \+ interval '1 microsecond'/i,
    );
  });

  it("preserves the deployed first migration and corrects its helper forward-only", async () => {
    const correction = await readFile(
      `supabase/migrations/${correctionTag}.sql`,
      "utf8",
    );

    expect(correction).toMatch(
      /CREATE OR REPLACE FUNCTION private\.ensure_operational_period/i,
    );
    expect(correction).toMatch(/ON CONFLICT DO NOTHING/i);
    expect(correction).not.toMatch(
      /ON CONFLICT \(time_setting_id, local_date\)/i,
    );
  });

  it("enforces version intervals and deterministic period identity", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toMatch(/time_settings_one_open_version_unique/i);
    expect(sql).toMatch(/time_settings_one_successor_unique/i);
    expect(sql).toMatch(/time_settings_world_effective_interval_exclusion/i);
    expect(sql).toMatch(
      /operational_periods_setting_local_date_unique[\s\S]*time_setting_id[\s\S]*local_date/i,
    );
    expect(sql).toMatch(/pg_catalog\.pg_timezone_names/i);
    expect(sql).toMatch(
      /\(p_local_date \+ v_boundary\) AT TIME ZONE v_timezone/i,
    );
  });

  it("corrects configurable DST gap and fold boundaries forward-only", async () => {
    const correction = await readFile(
      `supabase/migrations/${dstCorrectionTag}.sql`,
      "utf8",
    );

    expect(correction).toMatch(
      /CREATE OR REPLACE FUNCTION private\.resolve_civil_boundary/i,
    );
    expect(correction).toMatch(
      /least\(v_before_candidate, v_after_candidate\)/i,
    );
    expect(correction).toMatch(/v_gap := v_after_offset - v_before_offset/i);
    expect(correction).toMatch(/v_resolved_local := v_local \+ v_gap/i);
    expect(correction).toMatch(
      /CREATE OR REPLACE FUNCTION private\.resolve_operational_period_for_anchor/i,
    );
    expect(correction).toMatch(
      /period\.starts_at <= p_anchor_at[\s\S]*p_anchor_at < period\.ends_at/i,
    );
    expect(correction).not.toMatch(
      /\(v_anchor_at AT TIME ZONE v_timezone\) - v_boundary/i,
    );
    expect(correction).not.toMatch(
      /\(v_now AT TIME ZONE v_timezone\) - v_boundary/i,
    );
  });

  it("keeps the reviewed public temporal command signatures unchanged", async () => {
    const correction = await readFile(
      `supabase/migrations/${dstCorrectionTag}.sql`,
      "utf8",
    );

    expect(correction).toContain(
      "CREATE OR REPLACE FUNCTION public.get_current_operational_period()",
    );
    expect(correction).not.toMatch(
      /CREATE OR REPLACE FUNCTION public\.(save_time_setting|assign_observation_operational_period|correct_observation_operational_period)/i,
    );
    expect(correction).toContain(
      "REVOKE ALL ON FUNCTION public.get_current_operational_period()",
    );
    expect(correction).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_current_operational_period()",
    );
  });

  it("keeps evidence persistence outside temporal assignment transactions", async () => {
    const captureSql = await readFile(
      "supabase/migrations/20260820185900_step_99_persist_first_observation_capture.sql",
      "utf8",
    );
    const step100Sql = await readFile(migrationPath, "utf8");

    expect(captureSql).not.toMatch(
      /assign_observation_operational_period|get_current_operational_period/i,
    );
    expect(step100Sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.assign_observation_operational_period/i,
    );
    expect(step100Sql).toMatch(/'correction_required'::text/i);
  });

  it("derives actor and World and exposes only exact hardened commands", async () => {
    const sql = await readFile(migrationPath, "utf8");

    for (const signature of [
      "save_time_setting(text, time)",
      "get_current_operational_period()",
      "assign_observation_operational_period(uuid)",
      "correct_observation_operational_period(uuid, text)",
    ]) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${signature}`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${signature}`);
    }
    expect(sql).toMatch(/SECURITY DEFINER[\s\S]*SET search_path = ''/i);
    expect(sql).toMatch(/v_actor_id uuid := \(SELECT auth\.uid\(\)\)/i);
    expect(sql).not.toMatch(
      /GRANT (INSERT|UPDATE|DELETE) ON (TABLE )?public\.(time_settings|operational_periods|observation_operational_period_memberships|audit_events)/i,
    );
  });

  it("audits explicit historical correction with a strict metadata allow-list", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const correction = sql.slice(
      sql.indexOf(
        "CREATE OR REPLACE FUNCTION public.correct_observation_operational_period",
      ),
      sql.indexOf("REVOKE ALL ON FUNCTION public.save_time_setting"),
    );

    expect(sql).toMatch(/audit_events_temporal_correction_metadata_check/i);
    expect(correction).toMatch(
      /INSERT INTO public\.observation_operational_period_memberships[\s\S]*'correction'/i,
    );
    expect(correction).toMatch(/INSERT INTO public\.audit_events/i);
    expect(correction).toMatch(/jsonb_build_object/i);
    expect(correction).not.toMatch(/exact_text|source_fragments/i);
  });

  it("carries rollback-only temporal regression coverage", async () => {
    const verification = await readFile(
      "scripts/verify-step-100-native-temporal.sql",
      "utf8",
    );

    expect(verification).toMatch(/^begin;/i);
    expect(verification).toMatch(/rollback;\s*$/i);
    for (const phrase of [
      "invalid timezone",
      "spring-forward",
      "fall-back",
      "spring-gap civil boundary",
      "fall-fold civil boundary",
      "membership containment",
      "prospective boundary change",
      "late observation",
      "explicit historical correction",
      "strict audit allow-list",
      "assignment failure preserves evidence",
      "cross-world temporal isolation",
      "generic temporal write denial",
    ]) {
      expect(verification).toContain(phrase);
    }
  });
});
