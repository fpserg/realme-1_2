import type { DialogueProvider } from "@/application/dialogue/one-companion-dialogue";
import { DialogueProviderError } from "@/application/dialogue/one-companion-dialogue";

import { OpenAIDialogueProvider } from "./openai-dialogue-provider";

export interface DialogueProviderEnvironment {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  provider?: string;
}

export function dialogueProviderEnvironment(): DialogueProviderEnvironment {
  return {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL,
    model: process.env.REALME_DIALOGUE_MODEL,
    provider: process.env.REALME_DIALOGUE_PROVIDER,
  };
}

export function createDialogueProvider(
  environment = dialogueProviderEnvironment(),
): DialogueProvider {
  if (environment.provider !== "openai") {
    throw new DialogueProviderError("configuration");
  }
  if (!environment.apiKey || !environment.model) {
    throw new DialogueProviderError("configuration");
  }
  return new OpenAIDialogueProvider(
    environment.apiKey,
    environment.model,
    environment.baseUrl,
  );
}
