import { describe, expect, it, vi } from "vitest";

import type { ObservationHistoryItem } from "@/domain/observation/observation";

import {
  loadTemporalContinuity,
  TemporalAuthenticationError,
  type TemporalRepository,
} from "./temporal-continuity";

const observation: ObservationHistoryItem = {
  correctionCount: 0,
  exactText: "Persisted evidence.",
  id: "223e4567-e89b-42d3-a456-426614174000",
  localCalendarDate: null,
  occurredAt: null,
  occurredPrecision: "unknown",
  persistenceState: "saved",
  recordedAt: "2026-08-21T02:00:00.000Z",
  sourceTimezone: null,
};

function repository(): TemporalRepository {
  return {
    assignObservation: vi.fn().mockResolvedValue({
      membershipId: "323e4567-e89b-42d3-a456-426614174000",
      operationalDate: "2026-08-20",
      operationalPeriodId: "423e4567-e89b-42d3-a456-426614174000",
      state: "assigned",
      suggestedOperationalDate: null,
    }),
    correctObservationMembership: vi.fn(),
    getCurrentContext: vi.fn().mockResolvedValue({
      currentPeriod: {
        endsAt: "2026-08-22T01:00:00.000Z",
        id: "423e4567-e89b-42d3-a456-426614174000",
        localDate: "2026-08-20",
        startsAt: "2026-08-21T01:00:00.000Z",
      },
      setting: {
        effectiveFrom: "-infinity",
        id: "523e4567-e89b-42d3-a456-426614174000",
        operationalBoundary: "04:00",
        timezone: "Europe/Helsinki",
      },
    }),
    saveSetting: vi.fn(),
  };
}

describe("temporal continuity application flow", () => {
  it("rejects unauthenticated temporal work", async () => {
    await expect(
      loadTemporalContinuity(null, [observation], repository()),
    ).rejects.toBeInstanceOf(TemporalAuthenticationError);
  });

  it("retries placement without losing persisted evidence when assignment fails", async () => {
    const temporalRepository = repository();
    vi.mocked(temporalRepository.assignObservation).mockRejectedValue(
      new Error("Temporal engine unavailable."),
    );

    const result = await loadTemporalContinuity(
      "123e4567-e89b-42d3-a456-426614174000",
      [observation],
      temporalRepository,
    );

    expect(result.observations[0]).toMatchObject({
      exactText: observation.exactText,
      persistenceState: "saved",
      temporalPlacement: { state: "pending" },
    });
  });
});
