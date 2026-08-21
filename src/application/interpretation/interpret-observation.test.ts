import { describe, expect, it, vi } from "vitest";

import {
  InterpretationProviderError,
  InterpretationValidationError,
  processNextInterpretationJob,
  type ClaimedInterpretationJob,
  type InterpretationJobRepository,
  type InterpretationProvider,
  validateCandidateSet,
} from "./interpret-observation";

const job: ClaimedInterpretationJob = {
  attemptNumber: 1,
  evidence: [
    {
      contentHash: "sha256-evidence",
      exactText: "I worked deeply on an investment model.",
      id: "323e4567-e89b-42d3-a456-426614174000",
      ordinal: 0,
    },
  ],
  id: "123e4567-e89b-42d3-a456-426614174000",
  lockToken: "423e4567-e89b-42d3-a456-426614174000",
  observationId: "223e4567-e89b-42d3-a456-426614174000",
  worldId: "523e4567-e89b-42d3-a456-426614174000",
};

const output = {
  candidates: [
    {
      confidence: 0.72,
      evidenceReferences: ["evidence-0"],
      explanation: "The exact observation supports this possibility.",
      kind: "proposition",
      object: "investment_model",
      predicate: "focused_on",
      subject: "user",
    },
  ],
  schemaVersion: "candidate-set-v1",
};

class MemoryRepository implements InterpretationJobRepository {
  candidates: Parameters<
    InterpretationJobRepository["complete"]
  >[0]["candidates"] = [];
  jobState: "queued" | "running" | "succeeded" | "failed" = "queued";
  runs: { id: string; status: "failed" | "running" | "succeeded" }[] = [];
  attempts = 0;
  started: Parameters<InterpretationJobRepository["startRun"]>[0][] = [];

  async claim(workerId: string) {
    if (this.jobState !== "queued") return null;
    this.jobState = "running";
    this.attempts += 1;
    return { ...job, attemptNumber: this.attempts, lockToken: workerId };
  }

  async startRun(
    input: Parameters<InterpretationJobRepository["startRun"]>[0],
  ) {
    this.started.push(input);
    const id = `run-${this.runs.length + 1}`;
    this.runs.push({ id, status: "running" });
    return id;
  }

  async complete(
    input: Parameters<InterpretationJobRepository["complete"]>[0],
  ) {
    this.candidates = input.candidates;
    this.runs.find((run) => run.id === input.runId)!.status = "succeeded";
    this.jobState = "succeeded";
  }

  async fail(input: Parameters<InterpretationJobRepository["fail"]>[0]) {
    if (input.runId) {
      this.runs.find((run) => run.id === input.runId)!.status = "failed";
    }
    this.jobState = input.retryable && this.attempts < 5 ? "queued" : "failed";
    return this.jobState;
  }
}

function provider(
  interpret = vi.fn().mockResolvedValue(output),
): InterpretationProvider {
  return { interpret, modelId: "fixture-model", providerId: "fixture" };
}

describe("Step 102 interpretation pipeline", () => {
  it("strictly rejects extra fields, unsupported shapes and missing evidence", () => {
    expect(() => validateCandidateSet({ ...output, extra: true })).toThrow(
      InterpretationValidationError,
    );
    expect(() =>
      validateCandidateSet({
        ...output,
        candidates: [{ ...output.candidates[0], action: "write_assertion" }],
      }),
    ).toThrow(InterpretationValidationError);
    expect(() =>
      validateCandidateSet({
        ...output,
        candidates: [{ ...output.candidates[0], evidenceReferences: [] }],
      }),
    ).toThrow(InterpretationValidationError);
    expect(() =>
      validateCandidateSet({
        ...output,
        candidates: [{ ...output.candidates[0], object: { unsafe: true } }],
      }),
    ).toThrow(InterpretationValidationError);
    expect(() =>
      validateCandidateSet({
        ...output,
        candidates: Array.from({ length: 9 }, () => output.candidates[0]),
      }),
    ).toThrow(InterpretationValidationError);
  });

  it("persists one hidden candidate set and exact evidence links", async () => {
    const repository = new MemoryRepository();
    const result = await processNextInterpretationJob({
      provider: provider(),
      repository,
      signal: new AbortController().signal,
      workerId: "623e4567-e89b-42d3-a456-426614174000",
    });

    expect(result).toMatchObject({ candidateCount: 1, state: "succeeded" });
    expect(repository.candidates).toHaveLength(1);
    expect(repository.candidates[0]?.evidenceFragmentIds).toEqual([
      job.evidence[0]!.id,
    ]);
    expect(repository.candidates[0]?.logicalKey).toMatch(/^[0-9a-f]{64}$/);
    expect(repository.runs).toEqual([{ id: "run-1", status: "succeeded" }]);
    expect(repository.started[0]).toMatchObject({
      model: "fixture-model",
      promptVersion: "interpret-observation-v1",
      provider: "fixture",
      schemaVersion: "candidate-set-v1",
    });
    expect(repository.started[0]?.inputHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects duplicate normalized provider candidates", async () => {
    const repository = new MemoryRepository();
    const duplicateOutput = {
      ...output,
      candidates: [output.candidates[0], output.candidates[0]],
    };

    await expect(
      processNextInterpretationJob({
        provider: provider(vi.fn().mockResolvedValue(duplicateOutput)),
        repository,
        signal: new AbortController().signal,
        workerId: "d23e4567-e89b-42d3-a456-426614174000",
      }),
    ).resolves.toMatchObject({ code: "validation_failed", state: "failed" });
    expect(repository.candidates).toHaveLength(0);
  });

  it("preserves failed run provenance and converges on one later success", async () => {
    const repository = new MemoryRepository();
    const unavailable = provider(
      vi
        .fn()
        .mockRejectedValue(
          new InterpretationProviderError("provider_unavailable"),
        ),
    );

    await expect(
      processNextInterpretationJob({
        provider: unavailable,
        repository,
        signal: new AbortController().signal,
        workerId: "623e4567-e89b-42d3-a456-426614174000",
      }),
    ).resolves.toMatchObject({ code: "provider_unavailable", state: "queued" });

    await expect(
      processNextInterpretationJob({
        provider: provider(),
        repository,
        signal: new AbortController().signal,
        workerId: "723e4567-e89b-42d3-a456-426614174000",
      }),
    ).resolves.toMatchObject({ candidateCount: 1, state: "succeeded" });

    expect(repository.runs).toEqual([
      { id: "run-1", status: "failed" },
      { id: "run-2", status: "succeeded" },
    ]);
    expect(repository.candidates).toHaveLength(1);
  });

  it("makes concurrent claim and post-success replay harmless", async () => {
    const repository = new MemoryRepository();
    const [first, second] = await Promise.all([
      repository.claim("823e4567-e89b-42d3-a456-426614174000"),
      repository.claim("923e4567-e89b-42d3-a456-426614174000"),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);

    repository.jobState = "queued";
    await processNextInterpretationJob({
      provider: provider(),
      repository,
      signal: new AbortController().signal,
      workerId: "a23e4567-e89b-42d3-a456-426614174000",
    });
    const count = repository.candidates.length;
    await expect(
      processNextInterpretationJob({
        provider: provider(),
        repository,
        signal: new AbortController().signal,
        workerId: "b23e4567-e89b-42d3-a456-426614174000",
      }),
    ).resolves.toEqual({ state: "idle" });
    expect(repository.candidates).toHaveLength(count);
  });
});
