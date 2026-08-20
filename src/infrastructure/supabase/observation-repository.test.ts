import { describe, expect, it } from "vitest";

import { reconstructObservationHistory } from "./observation-repository";

const observation = {
  id: "observation-1",
  local_calendar_date: null,
  occurred_at: null,
  occurred_precision: "unknown",
  recorded_at: "2026-08-20T10:00:00.000Z",
  source_timezone: null,
};

const fragment = {
  exact_text: "Exact evidence survives reload.",
  observation_id: observation.id,
  ordinal: 0,
};

function correction({
  id,
  occurredAt,
  supersedes,
}: {
  id: string;
  occurredAt: string;
  supersedes: string | null;
}) {
  return {
    corrected_local_calendar_date: occurredAt.slice(0, 10),
    corrected_occurred_at: occurredAt,
    corrected_occurred_precision: "exact",
    corrected_source_timezone: "UTC",
    id,
    observation_id: observation.id,
    recorded_at: "2026-08-20T12:00:00.000Z",
    supersedes_correction_id: supersedes,
  };
}

describe("observation history correction reconstruction", () => {
  it("uses the unique supersession leaf despite input order and tied timestamps", () => {
    const root = correction({
      id: "correction-root",
      occurredAt: "2026-08-18T08:00:00.000Z",
      supersedes: null,
    });
    const leaf = correction({
      id: "correction-leaf",
      occurredAt: "2026-08-19T09:30:00.000Z",
      supersedes: root.id,
    });

    const history = reconstructObservationHistory(
      [observation],
      [fragment],
      [leaf, root],
    );

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      correctionCount: 2,
      exactText: fragment.exact_text,
      localCalendarDate: "2026-08-19",
      occurredAt: leaf.corrected_occurred_at,
      sourceTimezone: leaf.corrected_source_timezone,
    });
    expect(history[0]?.occurredAt).not.toBe(root.corrected_occurred_at);
  });

  it.each([
    {
      corrections: [
        correction({
          id: "root-a",
          occurredAt: "2026-08-18T08:00:00.000Z",
          supersedes: null,
        }),
        correction({
          id: "root-b",
          occurredAt: "2026-08-19T08:00:00.000Z",
          supersedes: null,
        }),
      ],
      name: "multiple leaves",
    },
    {
      corrections: [
        correction({
          id: "cycle-a",
          occurredAt: "2026-08-18T08:00:00.000Z",
          supersedes: "cycle-b",
        }),
        correction({
          id: "cycle-b",
          occurredAt: "2026-08-19T08:00:00.000Z",
          supersedes: "cycle-a",
        }),
      ],
      name: "zero leaves",
    },
  ])("fails safely for malformed $name", ({ corrections }) => {
    expect(() =>
      reconstructObservationHistory([observation], [fragment], corrections),
    ).toThrow("Malformed observation correction chain.");
  });
});
