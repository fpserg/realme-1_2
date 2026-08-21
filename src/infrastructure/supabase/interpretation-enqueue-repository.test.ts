import { describe, expect, it, vi } from "vitest";

import { SupabaseInterpretationEnqueueRepository } from "./interpretation-enqueue-repository";

describe("Supabase interpretation enqueue adapter", () => {
  it("passes only the persisted observation identity to the hardened RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          job_id: "223e4567-e89b-42d3-a456-426614174000",
          job_status: "queued",
          was_created: true,
        },
      ],
      error: null,
    });
    const repository = new SupabaseInterpretationEnqueueRepository({
      rpc,
    } as never);

    await expect(
      repository.enqueue(
        { userId: "account-a" },
        "123e4567-e89b-42d3-a456-426614174000",
      ),
    ).resolves.toMatchObject({ status: "queued", wasCreated: true });
    expect(rpc).toHaveBeenCalledWith("enqueue_observation_interpretation", {
      p_observation_id: "123e4567-e89b-42d3-a456-426614174000",
    });
    expect(JSON.stringify(rpc.mock.calls[0])).not.toMatch(/worldId|actorId/);
  });
});
