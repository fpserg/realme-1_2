import { describe, expect, it } from "vitest";

import { reconstructDialogueEvidence } from "./dialogue-evidence-repository";

describe("dialogue evidence reconstruction", () => {
  it("preserves exact fragment identity and observation order", () => {
    const observations = [
      { id: "observation-new", recorded_at: "2026-08-21T11:00:00.000Z" },
      { id: "observation-old", recorded_at: "2026-08-21T10:00:00.000Z" },
    ];
    const fragments = [
      {
        exact_text: "Older exact evidence.",
        id: "fragment-old",
        observation_id: "observation-old",
        ordinal: 0,
      },
      {
        exact_text: "Newer exact evidence.",
        id: "fragment-new",
        observation_id: "observation-new",
        ordinal: 0,
      },
    ];

    expect(reconstructDialogueEvidence(observations, fragments)).toEqual([
      {
        exactText: "Newer exact evidence.",
        fragmentId: "fragment-new",
        observationId: "observation-new",
        recordedAt: "2026-08-21T11:00:00.000Z",
      },
      {
        exactText: "Older exact evidence.",
        fragmentId: "fragment-old",
        observationId: "observation-old",
        recordedAt: "2026-08-21T10:00:00.000Z",
      },
    ]);
  });

  it("does not invent context when an exact ordinal-zero fragment is absent", () => {
    expect(
      reconstructDialogueEvidence(
        [{ id: "observation", recorded_at: "2026-08-21T10:00:00.000Z" }],
        [],
      ),
    ).toEqual([]);
  });
});
