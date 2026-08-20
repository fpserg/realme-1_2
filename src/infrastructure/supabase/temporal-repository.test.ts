import { describe, expect, it, vi } from "vitest";

import { SupabaseTemporalRepository } from "./temporal-repository";

describe("Supabase temporal command adapter", () => {
  it("derives authority in the database without sending World or actor identity", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          assignment_state: "assigned",
          local_date: "2026-08-21",
          membership_id: "123e4567-e89b-42d3-a456-426614174000",
          operational_period_id: "223e4567-e89b-42d3-a456-426614174000",
          suggested_local_date: null,
          suggested_operational_period_id: null,
        },
      ],
      error: null,
    });
    const repository = new SupabaseTemporalRepository({ rpc } as never);

    await repository.assignObservation(
      { userId: "verified-user" },
      "323e4567-e89b-42d3-a456-426614174000",
    );

    expect(rpc).toHaveBeenCalledWith("assign_observation_operational_period", {
      p_observation_id: "323e4567-e89b-42d3-a456-426614174000",
    });
    expect(JSON.stringify(rpc.mock.calls[0])).not.toMatch(
      /world|actor|recorded|reference/i,
    );
  });

  it("surfaces a prospective correction without mutating membership", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          assignment_state: "correction_required",
          local_date: "2026-08-20",
          membership_id: "123e4567-e89b-42d3-a456-426614174000",
          operational_period_id: "223e4567-e89b-42d3-a456-426614174000",
          suggested_local_date: "2026-08-21",
          suggested_operational_period_id:
            "323e4567-e89b-42d3-a456-426614174000",
        },
      ],
      error: null,
    });
    const repository = new SupabaseTemporalRepository({ rpc } as never);

    await expect(
      repository.assignObservation(
        { userId: "verified-user" },
        "423e4567-e89b-42d3-a456-426614174000",
      ),
    ).resolves.toMatchObject({
      operationalDate: "2026-08-20",
      state: "correction-required",
      suggestedOperationalDate: "2026-08-21",
    });
  });
});
