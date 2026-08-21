import type { ObservationRepository } from "@/application/observation/observation-capture";
import {
  captureTextObservation,
  ObservationAuthenticationError,
} from "@/application/observation/observation-capture";
import type {
  DialogueRecentTurn,
  DialogueTurnInput,
} from "@/domain/dialogue/dialogue";
import type { ObservationHistoryItem } from "@/domain/observation/observation";

export const dialogueEvidenceCountLimit = 8;
export const dialogueEvidenceCharacterLimit = 12_000;
export const dialogueEvidenceFragmentLimit = 4_000;

export interface DialogueEvidenceReference {
  exactText: string;
  reference: string;
}

export interface DialogueEvidenceTrace {
  fragmentId: string;
  observationId: string;
  reference: string;
}

export interface DialogueEvidenceRecord {
  exactText: string;
  fragmentId: string;
  observationId: string;
  recordedAt: string;
}

export interface DialogueEvidenceRepository {
  list(context: { userId: string }): Promise<DialogueEvidenceRecord[]>;
}

export interface AuthorizedDialogueContext {
  currentEvidenceReference: string | null;
  currentMessage: string;
  evidence: DialogueEvidenceReference[];
  evidenceTrace: DialogueEvidenceTrace[];
  recentTurns: DialogueRecentTurn[];
}

export interface PreparedDialogueTurn {
  context: AuthorizedDialogueContext;
  persistedObservation: ObservationHistoryItem | null;
}

export type DialogueProviderErrorCode =
  | "cancelled"
  | "configuration"
  | "malformed_response"
  | "timeout"
  | "unavailable";

export class DialogueProviderError extends Error {
  constructor(
    readonly code: DialogueProviderErrorCode,
    message = "The companion is unavailable.",
  ) {
    super(message);
    this.name = "DialogueProviderError";
  }
}

export interface DialogueProvider {
  readonly modelId: string;
  readonly providerId: string;
  stream(
    context: AuthorizedDialogueContext,
    options: { signal: AbortSignal },
  ): AsyncIterable<string>;
}

function appendEvidence(
  target: DialogueEvidenceReference[],
  trace: DialogueEvidenceTrace[],
  observation: DialogueEvidenceRecord,
  reference: string,
) {
  target.push({ exactText: observation.exactText, reference });
  trace.push({
    fragmentId: observation.fragmentId,
    observationId: observation.observationId,
    reference,
  });
}

export function assembleAuthorizedDialogueContext(
  input: DialogueTurnInput,
  observations: DialogueEvidenceRecord[],
  currentObservationId: string | null,
): AuthorizedDialogueContext {
  const evidence: DialogueEvidenceReference[] = [];
  const evidenceTrace: DialogueEvidenceTrace[] = [];
  let characters = 0;
  let currentEvidenceReference: string | null = null;

  const current = currentObservationId
    ? observations.find((item) => item.observationId === currentObservationId)
    : undefined;
  if (current) {
    currentEvidenceReference = "evidence-current";
    appendEvidence(evidence, evidenceTrace, current, currentEvidenceReference);
    characters += current.exactText.length;
  }

  for (const observation of observations) {
    if (observation.observationId === currentObservationId) continue;
    if (evidence.length >= dialogueEvidenceCountLimit) break;
    if (observation.exactText.length > dialogueEvidenceFragmentLimit) continue;
    if (
      characters + observation.exactText.length >
      dialogueEvidenceCharacterLimit
    ) {
      continue;
    }
    const reference = `evidence-${evidence.length + 1}`;
    appendEvidence(evidence, evidenceTrace, observation, reference);
    characters += observation.exactText.length;
  }

  return {
    currentEvidenceReference,
    currentMessage: input.text,
    evidence,
    evidenceTrace,
    recentTurns: input.recentTurns,
  };
}

export async function prepareDialogueTurn(
  authenticatedUserId: string,
  input: DialogueTurnInput,
  observationRepository: ObservationRepository,
  evidenceRepository: DialogueEvidenceRepository,
): Promise<PreparedDialogueTurn> {
  if (!authenticatedUserId) throw new ObservationAuthenticationError();
  const capture =
    input.persistence === "observation"
      ? await captureTextObservation(
          authenticatedUserId,
          { exactText: input.text, idempotencyKey: input.idempotencyKey },
          observationRepository,
        )
      : null;

  const observations = await evidenceRepository.list({
    userId: authenticatedUserId,
  });
  const persistedObservation = capture?.observation ?? null;

  if (
    persistedObservation &&
    !observations.some((item) => item.observationId === persistedObservation.id)
  ) {
    throw new Error("Saved evidence could not be reconstructed for dialogue.");
  }

  return {
    context: assembleAuthorizedDialogueContext(
      input,
      observations,
      persistedObservation?.id ?? null,
    ),
    persistedObservation,
  };
}
