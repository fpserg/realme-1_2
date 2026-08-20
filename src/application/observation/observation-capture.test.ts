import { describe, expect, it, vi } from "vitest";

import type { ObservationRepository } from "./observation-capture";
import {
  ObservationAuthenticationError,
  captureTextObservation,
  correctObservationOccurrence,
  listObservationHistory,
} from "./observation-capture";

const input = {
  exactText: "Evidence survives processing failure.",
  idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
};

function repository(): ObservationRepository {
  return {
    capture: vi.fn().mockResolvedValue({
      observation: {
        correctionCount: 0,
        exactText: input.exactText,
        id: "223e4567-e89b-42d3-a456-426614174000",
        localCalendarDate: null,
        occurredAt: null,
        occurredPrecision: "unknown",
        persistenceState: "saved",
        recordedAt: "2026-08-20T10:00:00.000Z",
        sourceTimezone: null,
      },
      wasCreated: true,
    }),
    correctOccurrence: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
  };
}

describe("authenticated observation use cases", () => {
  it("rejects capture, history and correction without authenticated identity", () => {
    const adapter = repository();

    expect(() => captureTextObservation(null, input, adapter)).toThrow(
      ObservationAuthenticationError,
    );
    expect(() => listObservationHistory(undefined, adapter)).toThrow(
      ObservationAuthenticationError,
    );
    expect(() =>
      correctObservationOccurrence(
        "",
        "223e4567-e89b-42d3-a456-426614174000",
        { occurredAt: "2026-08-20T10:00:00.000Z" },
        adapter,
      ),
    ).toThrow(ObservationAuthenticationError);
  });

  it("passes only verified context and capture input to the repository", async () => {
    const adapter = repository();

    await captureTextObservation("account-a", input, adapter);

    expect(adapter.capture).toHaveBeenCalledWith(
      { userId: "account-a" },
      input,
    );
  });

  it("keeps a saved observation independent from downstream failure", async () => {
    const adapter = repository();
    const saved = await captureTextObservation("account-a", input, adapter);

    await expect(
      Promise.reject(new Error("downstream unavailable")),
    ).rejects.toThrow("downstream unavailable");
    expect(saved.observation.persistenceState).toBe("saved");
    expect(saved.observation.exactText).toBe(input.exactText);
  });
});
