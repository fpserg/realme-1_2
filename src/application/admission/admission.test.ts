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

    await decideCandidate(
      "account-1",
      "candidate-1",
      "accept",
      target,
    );
    expect(target.decide).toHaveBeenCalledOnce();
  });

  it("requires corrected durable meaning for correct", async () => {
    await expect(
      decideCandidate("account-1", "candidate-1", "correct", repository()),
    ).rejects.toThrow("Correction payload is required.");
  });

  it("does not permit payload mutation through accept, reject or defer", async () => {
    await expect(
      decideCandidate(
        "account-1",
        "candidate-1",
        "accept",
        repository(),
        { subject: "A", predicate: "is", object: "B" },
      ),
    ).rejects.toThrow("Only correction accepts corrected durable meaning.");
  });
});
