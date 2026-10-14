import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { loadFrozenCorpus, runFrozenCorpus } from "./step-107-semantic-corpus";

const sourceRoot = process.env.REALME_PINNED_SOURCE_ROOT;

describe("Step 107 frozen semantic evaluation corpus", () => {
  const run = sourceRoot ? it : it.skip;

  run("pins all eight semantic classes to exact immutable source bytes", () => {
    const corpus = loadFrozenCorpus(sourceRoot);
    expect(corpus.sourceRepository).toBe("fpserg/RealMe");
    expect(corpus.sourceCommit).toBe(
      "b701e303e0e716dd54099938fab092d419d30e61",
    );
    expect(corpus.sourceTree).toBe("b5b3edd5d31cc1a4955a493ad0d9dd8948550d88");
    expect(corpus.promptVersion).toBe("interpret-observation-v4");
    expect(corpus.schemaVersion).toBe("candidate-set-v2");
    expect(corpus.cases.map(({ id }) => id)).toEqual([
      "E1",
      "E2",
      "E3",
      "E4",
      "E5",
      "E6",
      "E7",
      "E8",
    ]);
    expect(
      new Set(corpus.cases.map(({ semanticClass }) => semanticClass)),
    ).toHaveLength(8);
    for (const entry of corpus.cases) {
      expect(entry.exactText.length).toBeGreaterThan(0);
      expect(createHash("sha256").update(entry.exactText).digest("hex")).toBe(
        entry.excerptSha256,
      );
    }
  });

  it("does not store personal source text in the repository fixture", async () => {
    const fixture = await import("./step-107-semantic-corpus.json");
    for (const entry of fixture.default.cases)
      expect(entry).not.toHaveProperty("exactText");
  });

  const liveRun =
    process.env.REALME_RUN_LIVE_SEMANTIC_CORPUS === "1" ? it : it.skip;
  liveRun(
    "executes each frozen case exactly once and records raw structured output",
    async () => {
      if (!sourceRoot || !process.env.REALME_CORPUS_OUTPUT_PATH)
        throw new Error(
          "REALME_PINNED_SOURCE_ROOT and REALME_CORPUS_OUTPUT_PATH are required.",
        );
      const executions = await runFrozenCorpus(
        sourceRoot,
        process.env.REALME_CORPUS_OUTPUT_PATH,
        process.env.OPENAI_API_KEY ?? "",
      );
      expect(executions).toHaveLength(8);
      expect(new Set(executions.map(({ caseId }) => caseId))).toHaveLength(8);
      expect(
        new Set(executions.map(({ inputHash }) => inputHash)),
      ).toHaveLength(8);
    },
    600_000,
  );
});
