import { describe, expect, it, vi } from "vitest";

import type { CommitmentProjectionRepository } from "./list-operational-commitments";
import { listOperationalCommitments } from "./list-operational-commitments";

const item = {
  classificationAssertionId: "10400000-0000-4000-8000-000000000100",
  commitmentId: "10400000-0000-4000-8000-000000000010",
  dueAssertionId: "10400000-0000-4000-8000-000000000102",
  dueLocalDate: "2026-08-29",
  isStale: false,
  status: "open" as const,
  statusAssertionId: "10400000-0000-4000-8000-000000000103",
  surface: "today" as const,
  title: "File report",
  titleAssertionId: "10400000-0000-4000-8000-000000000101",
};

describe("listOperationalCommitments", () => {
  it("loads Today and a bounded 30-day Horizon without mutating truth", async () => {
    const list = vi
      .fn<CommitmentProjectionRepository["list"]>()
      .mockResolvedValueOnce([item])
      .mockResolvedValueOnce([]);

    const result = await listOperationalCommitments({ list });

    expect(list).toHaveBeenNthCalledWith(1, "today");
    expect(list).toHaveBeenNthCalledWith(2, "horizon", 30);
    expect(result).toEqual({ horizon: [], today: [item] });
  });
});
