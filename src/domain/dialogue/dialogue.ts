export const dialogueMessageLimit = 4_000;
export const dialogueRecentTurnLimit = 6;
export const dialogueRecentTurnTextLimit = 2_000;
export const dialogueRecentTurnTotalLimit = 6_000;

export type DialoguePersistence = "observation" | "transient";
export type DialogueRole = "assistant" | "user";

export interface DialogueRecentTurn {
  role: DialogueRole;
  text: string;
}

export interface DialogueTurnInput {
  idempotencyKey: string;
  persistence: DialoguePersistence;
  recentTurns: DialogueRecentTurn[];
  text: string;
}

export class DialogueInputError extends Error {
  constructor(message = "Dialogue input is invalid.") {
    super(message);
    this.name = "DialogueInputError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireUuid(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new DialogueInputError();
  }
  return value;
}

function parseRecentTurns(value: unknown): DialogueRecentTurn[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > dialogueRecentTurnLimit) {
    throw new DialogueInputError();
  }

  let total = 0;
  return value.map((turn) => {
    if (!isRecord(turn)) throw new DialogueInputError();
    if (turn.role !== "assistant" && turn.role !== "user") {
      throw new DialogueInputError();
    }
    if (
      typeof turn.text !== "string" ||
      turn.text.length === 0 ||
      turn.text.length > dialogueRecentTurnTextLimit
    ) {
      throw new DialogueInputError();
    }
    total += turn.text.length;
    if (total > dialogueRecentTurnTotalLimit) throw new DialogueInputError();
    return { role: turn.role, text: turn.text };
  });
}

export function parseDialogueTurnInput(value: unknown): DialogueTurnInput {
  if (!isRecord(value)) throw new DialogueInputError();

  for (const forbidden of [
    "worldId",
    "world_id",
    "userId",
    "actorId",
    "recordedAt",
    "evidenceIds",
    "fragmentIds",
    "candidateIds",
  ]) {
    if (forbidden in value) throw new DialogueInputError();
  }

  if (
    typeof value.text !== "string" ||
    value.text.trim().length === 0 ||
    value.text.length > dialogueMessageLimit
  ) {
    throw new DialogueInputError();
  }
  if (
    value.persistence !== "observation" &&
    value.persistence !== "transient"
  ) {
    throw new DialogueInputError();
  }

  return {
    idempotencyKey: requireUuid(value.idempotencyKey),
    persistence: value.persistence,
    recentTurns: parseRecentTurns(value.recentTurns),
    text: value.text,
  };
}
