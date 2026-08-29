import { describe, expect, it, vi } from "vitest";

import { SupabaseCommitmentProjectionRepository } from "./commitment-projection-repository";

describe("SupabaseCommitmentProjectionRepository", () => {
  it("calls only the bounded read RPC and preserves canonical references", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          classification_assertion_id:
            "10400000-0000-4000-8000-000000000100",
          commitment_id: "10400000-0000-4000-8000-000000000010",
          due_assertion_id: "10400000-0000-4000-8000-000000000102",
          due_local_date: "2026-08-29",
          is_stale: false,
          status: "open",
          status_assertion_id: "10400000-0000-4000-8000-000000000103",
          surface: "today",
          title: "File report",
          title_assertion_id: "10400000-0000-4000-8000-000000000101",
        },
      ],
      error: null,
    });
    const repository = new SupabaseCommitmentProjectionRepository({
      rpc,
    } as never);

    await expect(repository.list("today")).resolves.toEqual([
      expect.objectContaining({
        classificationAssertionId: "10400000-0000-4000-8000-000000000100",
        commitmentId: "10400000-0000-4000-8000-000000000010",
        dueAssertionId: "10400000-0000-4000-8000-000000000102",
        statusAssertionId: "10400000-0000-4000-8000-000000000103",
        titleAssertionId: "10400000-0000-4000-8000-000000000101",
      }),
    ]);
    expect(rpc).toHaveBeenCalledWith("list_operational_commitments", {
      p_horizon_days: 30,
      p_surface: "today",
    });
  });
});
