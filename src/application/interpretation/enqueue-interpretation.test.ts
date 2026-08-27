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

  it("delegates bounded missing-job reconciliation to authenticated server state", async () => {
    const reconcile = vi.fn().mockResolvedValue({ processed: 50 });
    await reconcileObservationInterpretations("account-a", { reconcile });
    expect(reconcile).toHaveBeenCalledWith({ userId: "account-a" });
  });
});
