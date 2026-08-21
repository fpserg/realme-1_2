import { readFile, readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function source(path) {
  return readFile(path, "utf8");
}

describe("Step 101 constitutional boundary", () => {
  it("keeps provider-specific APIs out of application and client code", async () => {
    const [application, client] = await Promise.all([
      source("src/application/dialogue/one-companion-dialogue.ts"),
      source("src/app/companion-dialogue.tsx"),
    ]);
    expect(application).not.toMatch(/openai|api\.openai/i);
    expect(client).not.toMatch(/OPENAI_API_KEY|api\.openai/i);
  });

  it("keeps the fixture provider outside the normal runtime factory", async () => {
    const factory = await source(
      "src/infrastructure/ai/dialogue-provider-factory.ts",
    );
    expect(factory).not.toMatch(/REALME_E2E_FIXTURE|fixture/i);
    expect(factory).toContain('environment.provider !== "openai"');
  });

  it("gives dialogue no candidate or canonical-write adapter", async () => {
    const route = await source("src/app/api/dialogue/route.ts");
    expect(route).not.toMatch(
      /candidate_claim|admission_decision|ontology_|assertions|interpretation_runs|\bjobs\b/i,
    );
    expect(route).toContain("SupabaseObservationRepository");
    expect(route).toContain("SupabaseTemporalRepository");
    expect(route).toContain("SupabaseInterpretationEnqueueRepository");
  });

  it("adds no conversation archive or Step 101 migration", async () => {
    const migrations = (
      await readdir("supabase/migrations", { withFileTypes: true })
    )
      .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
      .map((entry) => entry.name);
    const schema = await source("src/infrastructure/db/schema/index.ts");
    expect(migrations.length).toBeGreaterThanOrEqual(10);
    expect(migrations.some((name) => name.includes("step_101"))).toBe(false);
    expect(schema).not.toMatch(/conversation|transcript/i);
  });

  it("keeps credentials server-only and disables provider response storage", async () => {
    const [example, adapter] = await Promise.all([
      source(".env.example"),
      source("src/infrastructure/ai/openai-dialogue-provider.ts"),
    ]);
    expect(example).toContain("OPENAI_API_KEY=");
    expect(example).not.toContain("NEXT_PUBLIC_OPENAI");
    expect(adapter).toContain("store: false");
  });
});
