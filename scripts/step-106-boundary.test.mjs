import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const repository = fs.readFileSync(
  path.join(
    root,
    "src/infrastructure/supabase/canonical-understanding-repository.ts",
  ),
  "utf8",
);
const page = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
const review = fs.readFileSync(
  path.join(root, "src/app/candidate-review.tsx"),
  "utf8",
);

describe("Step 106 canonical-understanding boundary", () => {
  it("reads current admitted World state through existing scoped tables only", () => {
    for (const table of [
      "assertions",
      "ontology_aliases",
      "admission_decisions",
      "assertion_evidence",
      "source_fragments",
    ]) {
      expect(repository).toContain(`.from(\"${table}\")`);
    }

    expect(repository.match(/\.eq\("world_id", worldId\)/g)?.length).toBe(5);
    expect(repository).toContain('.is("valid_to", null)');
    expect(repository).not.toContain('.from("candidate_claims")');
    expect(repository).not.toContain('.from("interpretation_runs")');
  });

  it("introduces no canonical write or privileged RPC path", () => {
    for (const forbidden of [
      ".insert(",
      ".update(",
      ".delete(",
      ".upsert(",
      ".rpc(",
    ]) {
      expect(repository).not.toContain(forbidden);
    }

    expect(page).toContain("const access = await getCurrentWorld(");
    expect(page).toContain("userId,");
    expect(page).toContain(
      "const canonicalUnderstanding = await listCanonicalUnderstanding(",
    );
    expect(page).toContain("access.worldId,");
  });

  it("refreshes authoritative server reads after successful admission", () => {
    expect(review).toContain("useRouter");
    expect(review).toContain("router.refresh()");
    expect(review).toContain('decisionEndpoint = "/api/admission/decision"');
  });
});
