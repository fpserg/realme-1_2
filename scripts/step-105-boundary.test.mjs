import { readFile, readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const repositoryPath =
  "src/infrastructure/supabase/living-world-repository.ts";

describe("Step 105 Living World boundary", () => {
  it("reads only admitted World Model structure and exposes no mutation path", async () => {
    const source = await readFile(repositoryPath, "utf8");

    expect(source).toContain('from("ontology_nodes")');
    expect(source).toContain('from("ontology_aliases")');
    expect(source).toContain('from("assertions")');
    expect(source).toContain('from("ontology_relationships")');
    expect(source.match(/\.eq\("world_id", worldId\)/g)).toHaveLength(4);
    expect(source).toContain('.eq("predicate", "classification")');
    expect(source).not.toMatch(
      /candidate_claims|interpretation_runs|source_fragments/,
    );
    expect(source).not.toMatch(/from\("observations"\)/);
    expect(source).not.toMatch(
      /\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/,
    );
  });

  it("adds no Step 105 database migration or derivative persistence", async () => {
    const migrations = await readdir("supabase/migrations");

    expect(migrations.some((name) => /step_105/i.test(name))).toBe(false);
  });

  it("keeps the renderer code-native and explicitly versioned", async () => {
    const source = await readFile(
      "src/domain/living-world/living-world.ts",
      "utf8",
    );

    expect(source).toContain(
      'LIVING_WORLD_RENDERER_VERSION = "living-world-code-v1"',
    );
    expect(source).toContain("canonicalId: node.id");
    expect(source).toContain("structuralHash");
    expect(source).not.toMatch(/Domain|Locus/);
  });
});
