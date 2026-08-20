import { describe, expect, it } from "vitest";

import { DialogueProviderError } from "@/application/dialogue/one-companion-dialogue";

import { createDialogueProvider } from "./dialogue-provider-factory";

describe("dialogue provider factory", () => {
  it("fails safely when live provider configuration is missing", () => {
    expect(() => createDialogueProvider({})).toThrow(DialogueProviderError);
    expect(() =>
      createDialogueProvider({ provider: "openai", model: "gpt-5.4-mini" }),
    ).toThrow(DialogueProviderError);
  });

  it("constructs only the explicit server-side OpenAI adapter", () => {
    const provider = createDialogueProvider({
      apiKey: "test-only-key",
      baseUrl: "https://gateway.example/v1",
      model: "gpt-5.4-mini-2026-03-17",
      provider: "openai",
    });
    expect(provider.providerId).toBe("openai");
    expect(provider.modelId).toBe("gpt-5.4-mini-2026-03-17");
  });

  it("does not recognize the E2E fixture as a normal runtime provider", () => {
    expect(() =>
      createDialogueProvider({
        apiKey: "fixture",
        model: "fixture",
        provider: "fixture",
      }),
    ).toThrow(DialogueProviderError);
  });
});
