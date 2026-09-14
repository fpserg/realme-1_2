import { describe, expect, it, vi } from "vitest";

import {
  InterpretationProviderError,
  InterpretationValidationError,
  buildInterpretationInput,
  processNextInterpretationJob,
  sha256Hex,
  type ClaimedInterpretationJob,
  type InterpretationJobRepository,
  type InterpretationProvider,
  validateCandidateSet,
} from "./interpret-observation";

const baseJob: ClaimedInterpretationJob = {
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
  promptVersion: "interpret-observation-v1",
  schemaVersion: "candidate-set-v1",
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
  constructor(readonly claimedJob: ClaimedInterpretationJob = baseJob) {}
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
    return {
      ...this.claimedJob,
      attemptNumber: this.attempts,
      lockToken: workerId,
    };
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
    if (input.runId)
      this.runs.find((run) => run.id === input.runId)!.status = "failed";
    this.jobState = input.retryable && this.attempts < 5 ? "queued" : "failed";
    return this.jobState;
  }
}

function provider(
  interpret = vi.fn().mockResolvedValue(output),
): InterpretationProvider {
  return { interpret, modelId: "fixture-model", providerId: "fixture" };
}

async function run(
  job: ClaimedInterpretationJob,
  interpret = vi.fn().mockResolvedValue(output),
) {
  const repository = new MemoryRepository(job);
  const transport = provider(interpret);
  const result = await processNextInterpretationJob({
    provider: transport,
    repository,
    signal: new AbortController().signal,
    workerId: "623e4567-e89b-42d3-a456-426614174000",
  });
  return { repository, result, transport: interpret };
}

describe("Step 102 interpretation pipeline", () => {
  it("strictly rejects candidate schema drift", () => {
    expect(() => validateCandidateSet({ ...output, extra: true })).toThrow(
      InterpretationValidationError,
    );
    expect(() =>
      validateCandidateSet({
        ...output,
        candidates: [{ ...output.candidates[0], action: "write_assertion" }],
      }),
    ).toThrow(InterpretationValidationError);
  });

  it("executes a persisted v1 job as v1 even though new jobs use v2", async () => {
    const transport = vi.fn().mockResolvedValue(output);
    const { repository, result } = await run(baseJob, transport);
    expect(result).toMatchObject({ candidateCount: 1, state: "succeeded" });
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        promptVersion: "interpret-observation-v1",
        schemaVersion: "candidate-set-v1",
      }),
      expect.anything(),
    );
    expect(repository.started[0]).toMatchObject({
      promptVersion: "interpret-observation-v1",
      schemaVersion: "candidate-set-v1",
    });
  });

  it("executes a persisted v2 job as v2", async () => {
    const v2Job = { ...baseJob, promptVersion: "interpret-observation-v2" };
    const transport = vi.fn().mockResolvedValue(output);
    const { repository } = await run(v2Job, transport);
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({ promptVersion: "interpret-observation-v2" }),
      expect.anything(),
    );
    expect(repository.started[0]).toMatchObject({
      promptVersion: "interpret-observation-v2",
      schemaVersion: "candidate-set-v1",
    });
  });

  it("includes the persisted prompt and schema versions in the input hash contract", async () => {
    const v1 = buildInterpretationInput(baseJob).hashContract;
    const v2 = buildInterpretationInput({
      ...baseJob,
      promptVersion: "interpret-observation-v2",
    }).hashContract;
    expect(v1.promptVersion).toBe("interpret-observation-v1");
    expect(v2.promptVersion).toBe("interpret-observation-v2");
    expect(v1.schemaVersion).toBe("candidate-set-v1");
    expect(await sha256Hex(JSON.stringify(v1))).not.toBe(
      await sha256Hex(JSON.stringify(v2)),
    );
  });

  it("fails closed for an unsupported persisted version before provider transport", async () => {
    const transport = vi.fn().mockResolvedValue(output);
    const { result, repository } = await run(
      { ...baseJob, promptVersion: "interpret-observation-v999" },
      transport,
    );
    expect(result).toMatchObject({
      code: "configuration_error",
      state: "failed",
    });
    expect(transport).not.toHaveBeenCalled();
    expect(repository.started).toHaveLength(0);
  });

  it("preserves failed run provenance and converges on one later success", async () => {
    const repository = new MemoryRepository();
    await expect(
      processNextInterpretationJob({
        provider: provider(
          vi
            .fn()
            .mockRejectedValue(
              new InterpretationProviderError("provider_unavailable"),
            ),
        ),
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
  });
});
