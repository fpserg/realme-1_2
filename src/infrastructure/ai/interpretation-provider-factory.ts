import type { InterpretationProvider } from "@/application/interpretation/interpret-observation";
import { InterpretationProviderError } from "@/application/interpretation/interpret-observation";

import { OpenAIInterpretationProvider } from "./openai-interpretation-provider";

export interface InterpretationProviderEnvironment {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  provider?: string;
}

export function interpretationProviderEnvironment(): InterpretationProviderEnvironment {
  return {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL,
    model: process.env.REALME_INTERPRETATION_MODEL,
    provider: process.env.REALME_INTERPRETATION_PROVIDER,
  };
}

export function createInterpretationProvider(
  environment = interpretationProviderEnvironment(),
): InterpretationProvider {
  if (environment.provider !== "openai") {
    throw new InterpretationProviderError("configuration_error");
  }
  if (!environment.apiKey || !environment.model) {
    throw new InterpretationProviderError("configuration_error");
  }
  return new OpenAIInterpretationProvider(
    environment.apiKey,
    environment.model,
    environment.baseUrl,
  );
}
