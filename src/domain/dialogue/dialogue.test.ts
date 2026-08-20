import { describe, expect, it } from "vitest";

import {
  DialogueInputError,
  dialogueMessageLimit,
  parseDialogueTurnInput,
} from "./dialogue";

const valid = {
  idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
  persistence: "observation",
  recentTurns: [{ role: "assistant", text: "What happened?" }],
  text: "An exact observation.",
};

describe("dialogue input", () => {
  it("accepts bounded observation and transient turns", () => {
    expect(parseDialogueTurnInput(valid)).toEqual(valid);
    expect(
      parseDialogueTurnInput({
        ...valid,
        persistence: "transient",
        recentTurns: [],
      }),
    ).toMatchObject({ persistence: "transient" });
  });

  it.each(["worldId", "userId", "actorId", "recordedAt", "fragmentIds"])(
    "rejects caller-supplied %s authority",
    (field) => {
      expect(() =>
        parseDialogueTurnInput({ ...valid, [field]: "caller-value" }),
      ).toThrow(DialogueInputError);
    },
  );

  it("enforces message and recent-session bounds", () => {
    expect(() =>
      parseDialogueTurnInput({
        ...valid,
        text: "x".repeat(dialogueMessageLimit + 1),
      }),
    ).toThrow(DialogueInputError);
    expect(() =>
      parseDialogueTurnInput({
        ...valid,
        recentTurns: Array.from({ length: 7 }, () => ({
          role: "user",
          text: "bounded",
        })),
      }),
    ).toThrow(DialogueInputError);
  });
});
