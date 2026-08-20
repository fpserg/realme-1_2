import { describe, expect, it } from "vitest";

import {
  ObservationInputError,
  parseCaptureObservationInput,
  parseOccurrenceCorrectionInput,
} from "./observation";

describe("observation input", () => {
  it("preserves exact text and permits omitted occurred time", () => {
    expect(
      parseCaptureObservationInput({
        exactText: "  The exact lived wording.\n",
        idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
      }),
    ).toEqual({
      exactText: "  The exact lived wording.\n",
      idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
      occurrence: undefined,
    });
  });

  it("normalizes supplied occurred time without inventing recorded time", () => {
    expect(
      parseCaptureObservationInput({
        exactText: "Met a friend.",
        idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
        occurrence: {
          occurredAt: "2026-08-20T10:30:00+03:00",
          sourceTimezone: "Europe/Helsinki",
        },
      }),
    ).toMatchObject({
      occurrence: {
        occurredAt: "2026-08-20T07:30:00.000Z",
        sourceTimezone: "Europe/Helsinki",
      },
    });
  });

  it.each([
    { worldId: "not-authority" },
    { world_id: "not-authority" },
    { recordedAt: "2026-08-20T00:00:00Z" },
    { recorded_at: "2026-08-20T00:00:00Z" },
    { actorId: "not-authority" },
    { userId: "not-authority" },
  ])("rejects caller-supplied authority and recorded time: %o", (extra) => {
    expect(() =>
      parseCaptureObservationInput({
        exactText: "Evidence",
        idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
        ...extra,
      }),
    ).toThrow(ObservationInputError);
  });

  it("requires an actual occurred instant for correction", () => {
    expect(() => parseOccurrenceCorrectionInput({})).toThrow(
      ObservationInputError,
    );
  });
});
