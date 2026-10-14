import { describe, expect, it, vi } from "vitest";

import {
  decideCandidate,
  listCandidateReviews,
  type AdmissionRepository,
} from "./admission";

function repository(): AdmissionRepository {
  return {
    decide: vi.fn(async (_context, candidateClaimId, action) => ({
      action,
      canonicalAssertionId: action === "accept" ? "assertion-1" : null,
      canonicalNodeId: null,
      candidateClaimId,
      decisionId: "decision-1",
      supersededAssertionId: null,
      wasReplay: false,
    })),
    list: vi.fn(async () => []),
  };
}

describe("admission application boundary", () => {
  it("requires authenticated context before candidate review", async () => {
    await expect(listCandidateReviews("", repository())).rejects.toThrow(
      "Authenticated context is required.",
    );
  });

  it("only invokes canonical mutation after an explicit admission action", async () => {
    const target = repository();
    await listCandidateReviews("account-1", target);
    expect(target.decide).not.toHaveBeenCalled();

    await decideCandidate("account-1", "candidate-1", "accept", target);
    expect(target.decide).toHaveBeenCalledOnce();
  });

  it("requires corrected durable meaning for correct", async () => {
    await expect(
      decideCandidate("account-1", "candidate-1", "correct", repository()),
    ).rejects.toThrow("Correction payload is required.");
  });

  it("does not permit payload mutation through accept, reject or defer", async () => {
    await expect(
      decideCandidate("account-1", "candidate-1", "accept", repository(), {
        subject: "A",
        predicate: "is",
        object: "B",
      }),
    ).rejects.toThrow("Only correction accepts corrected durable meaning.");
  });

  it("accepts only a complete closed candidate-set-v2 correction", async () => {
    const target = repository();
    const correction = {
      epistemic: { actor: "Warden", mode: "estimate" as const },
      kind: "epistemic_proposition" as const,
      object: "approximately one to two days",
      predicate: "requires_remaining_time",
      schema_version: "candidate-set-v2" as const,
      subject: "roadmap",
      supersedes_epistemic_assertion_id: "123e4567-e89b-42d3-a456-426614174000",
    };
    await decideCandidate(
      "account-1",
      "candidate-1",
      "correct",
      target,
      correction,
    );
    expect(target.decide).toHaveBeenCalledWith(
      { userId: "account-1" },
      "candidate-1",
      "correct",
      correction,
    );
  });

  it("fails closed for unsupported epistemic modes, participant qualifiers and nested meaning", async () => {
    const base = {
      epistemic: { actor: "Warden", mode: "estimate" },
      kind: "epistemic_proposition",
      object: true,
      predicate: "expects_progress",
      schema_version: "candidate-set-v2",
      subject: "roadmap",
    };
    for (const correction of [
      { ...base, epistemic: { actor: "Warden", mode: "other" } },
      { ...base, participant: "Maksim" },
      {
        ...base,
        epistemic: { actor: "Warden", mode: "estimate", proposition: base },
      },
    ]) {
      await expect(
        decideCandidate(
          "account-1",
          "candidate-1",
          "correct",
          repository(),
          correction as never,
        ),
      ).rejects.toThrow("Invalid candidate-set-v2 meaning.");
    }
  });
});
