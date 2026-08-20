import { describe, expect, it } from "vitest";

import {
  defaultOperationalBoundary,
  operationalDateForInstant,
  operationalPeriodForDate,
  parseTimeSettingInput,
  resolvedBoundaryForDate,
  TemporalInputError,
} from "./operational-time";

describe("native operational time", () => {
  it("keeps the constitutional default at 04:00 local", () => {
    expect(defaultOperationalBoundary).toBe("04:00");
  });

  it("accepts IANA zones and rejects invalid timezone identities", () => {
    expect(
      parseTimeSettingInput({
        operationalBoundary: "04:00",
        timezone: "Europe/Amsterdam",
      }),
    ).toEqual({
      operationalBoundary: "04:00",
      timezone: "Europe/Amsterdam",
    });
    expect(() =>
      parseTimeSettingInput({
        operationalBoundary: "04:00",
        timezone: "+02:00",
      }),
    ).toThrow(TemporalInputError);
  });

  it("assigns local instants before 04:00 to the previous operational date", () => {
    expect(
      operationalDateForInstant(
        "2026-08-21T00:30:00.000Z",
        "Europe/Helsinki",
        "04:00",
      ),
    ).toBe("2026-08-20");
    expect(
      operationalDateForInstant(
        "2026-08-21T02:00:00.000Z",
        "Europe/Helsinki",
        "04:00",
      ),
    ).toBe("2026-08-21");
  });

  it("constructs 23-hour and 25-hour periods across Amsterdam DST", () => {
    expect(
      operationalPeriodForDate("2026-03-28", "Europe/Amsterdam"),
    ).toMatchObject({
      durationHours: 23,
      startsAt: "2026-03-28T03:00:00.000Z",
      endsAt: "2026-03-29T02:00:00.000Z",
    });
    expect(
      operationalPeriodForDate("2026-10-24", "Europe/Amsterdam"),
    ).toMatchObject({
      durationHours: 25,
      startsAt: "2026-10-24T02:00:00.000Z",
      endsAt: "2026-10-25T03:00:00.000Z",
    });
  });

  it("normalizes a spring-gap boundary forward and assigns by containment", () => {
    expect(
      resolvedBoundaryForDate("2026-03-29", "02:30", "Europe/Amsterdam"),
    ).toBe("2026-03-29T01:30:00.000Z");

    const period = operationalPeriodForDate(
      "2026-03-29",
      "Europe/Amsterdam",
      "02:30",
    );
    expect(period.startsAt).toBe("2026-03-29T01:30:00.000Z");
    expect(
      operationalDateForInstant(
        "2026-03-29T01:15:00.000Z",
        "Europe/Amsterdam",
        "02:30",
      ),
    ).toBe("2026-03-28");
    expect(
      operationalDateForInstant(period.startsAt, "Europe/Amsterdam", "02:30"),
    ).toBe("2026-03-29");
    expect(new Date(period.startsAt).getTime()).toBeLessThan(
      new Date(period.endsAt).getTime(),
    );
  });

  it("chooses the earlier physical occurrence for a fall-fold boundary", () => {
    const resolved = resolvedBoundaryForDate(
      "2026-10-25",
      "02:30",
      "Europe/Amsterdam",
    );
    expect(resolved).toBe("2026-10-25T00:30:00.000Z");

    expect(
      operationalDateForInstant(
        "2026-10-25T00:15:00.000Z",
        "Europe/Amsterdam",
        "02:30",
      ),
    ).toBe("2026-10-24");
    expect(
      operationalDateForInstant(
        "2026-10-25T00:30:00.000Z",
        "Europe/Amsterdam",
        "02:30",
      ),
    ).toBe("2026-10-25");
    expect(
      operationalDateForInstant(
        "2026-10-25T01:30:00.000Z",
        "Europe/Amsterdam",
        "02:30",
      ),
    ).toBe("2026-10-25");
  });
});
