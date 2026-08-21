import { describe, expect, it, vi } from "vitest";

import {
  enqueueObservationInterpretation,
  reconcileObservationInterpretations,
} from "./enqueue-interpretation";

describe("interpretation enqueue", () => {
  it("requires authenticated context", async () => {
    const enqueue = vi.fn();
    expect(() =>
      enqueueObservationInterpretation(null, "observation", { enqueue }),
    ).toThrow("Authentication is required");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("reconciles a bounded unique observation set", async () => {
    const enqueue = vi.fn().mockResolvedValue({
      jobId: "job",
      status: "queued",
      wasCreated: true,
    });
    await reconcileObservationInterpretations(
      "account-a",
      ["observation-a", "observation-a", "observation-b"],
      { enqueue },
    );
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenNthCalledWith(
      1,
      { userId: "account-a" },
      "observation-a",
    );
  });
});
