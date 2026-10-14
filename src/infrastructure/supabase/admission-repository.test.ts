import { describe, expect, it, vi } from "vitest";

import { SupabaseAdmissionRepository } from "./admission-repository";

describe("Supabase admission adapter candidate-set-v2", () => {
  it("returns the whole epistemic semantic unit and its exact evidence", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          candidate_claim_id: "candidate-1",
          candidate_payload: {
            confidence: 0.9,
            epistemic: { actor: "Warden", mode: "estimate" },
            explanation: "Explicitly attributed estimate.",
            kind: "epistemic_proposition",
            object: "approximately one to two days",
            predicate: "requires_remaining_time",
            schema_version: "candidate-set-v2",
            subject: "roadmap",
          },
          created_at: "2026-10-05T00:00:00.000Z",
          evidence: [
            { exact_text: "Exact source.", source_fragment_id: "fragment-1" },
          ],
          proposed_subject_node_id: null,
        },
      ],
      error: null,
    });
    const repository = new SupabaseAdmissionRepository({ rpc } as never);
    await expect(repository.list()).resolves.toEqual([
      expect.objectContaining({
        epistemic: { actor: "Warden", mode: "estimate" },
        evidence: [
          { exactText: "Exact source.", sourceFragmentId: "fragment-1" },
        ],
        kind: "epistemic_proposition",
        schemaVersion: "candidate-set-v2",
      }),
    ]);
  });

  it("forwards a complete correction and maps the separate canonical identity", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          candidate_claim_id: "candidate-1",
          canonical_assertion_id: null,
          canonical_epistemic_assertion_id: "epistemic-1",
          canonical_node_id: null,
          decision_action: "correct",
          decision_id: "decision-1",
          superseded_assertion_id: null,
          was_replay: false,
        },
      ],
      error: null,
    });
    const repository = new SupabaseAdmissionRepository({ rpc } as never);
    const correction = {
      epistemic: { actor: "Warden", mode: "estimate" as const },
      kind: "epistemic_proposition" as const,
      object: "approximately one to two days",
      predicate: "requires_remaining_time",
      schema_version: "candidate-set-v2" as const,
      subject: "roadmap",
    };
    await expect(
      repository.decide(
        { userId: "user-1" },
        "candidate-1",
        "correct",
        correction,
      ),
    ).resolves.toMatchObject({
      canonicalAssertionId: null,
      canonicalEpistemicAssertionId: "epistemic-1",
    });
    expect(rpc).toHaveBeenCalledWith("decide_candidate", {
      p_action: "correct",
      p_candidate_claim_id: "candidate-1",
      p_correction_payload: correction,
    });
  });
});
