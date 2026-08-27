import { describe, expect, it } from "vitest";

import { createInterpretationProvider } from "./interpretation-provider-factory";

describe("interpretation provider factory", () => {
  it("rejects absent configuration and fixture activation", () => {
    expect(() => createInterpretationProvider({})).toThrow(
      expect.objectContaining({ code: "configuration_error" }),
    );
    expect(() =>
      createInterpretationProvider({
        apiKey: "test-only",
        model: "fixture-model",
        provider: "fixture",
      }),
    ).toThrow(expect.objectContaining({ code: "configuration_error" }));
  });

  it("constructs the server-owned OpenAI adapter", () => {
    expect(
      createInterpretationProvider({
        apiKey: "test-only",
        model: "fixture-model",
        provider: "openai",
      }),
    ).toMatchObject({ modelId: "fixture-model", providerId: "openai" });
  });
});
