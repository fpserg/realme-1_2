export const observationTextLimit = 10_000;

export interface OccurrenceInput {
  occurredAt: string;
  sourceTimezone?: string;
}

export interface CaptureObservationInput {
  exactText: string;
  idempotencyKey: string;
  occurrence?: OccurrenceInput;
}

export interface ObservationHistoryItem {
  id: string;
  exactText: string;
  recordedAt: string;
  occurredAt: string | null;
  occurredPrecision: "exact" | "unknown";
  sourceTimezone: string | null;
  localCalendarDate: string | null;
  persistenceState: "saved";
  correctionCount: number;
}

export interface PersistedCapture {
  observation: ObservationHistoryItem;
  wasCreated: boolean;
}

export interface OccurrenceCorrection {
  correctionId: string;
  observationId: string;
  occurredAt: string;
  sourceTimezone: string | null;
  localCalendarDate: string;
  recordedAt: string;
}

export class ObservationInputError extends Error {
  constructor(message = "Observation input is invalid.") {
    super(message);
    this.name = "ObservationInputError";
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
    throw new ObservationInputError();
  }

  return value;
}

function optionalOccurrence(value: unknown): OccurrenceInput | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value) || typeof value.occurredAt !== "string") {
    throw new ObservationInputError();
  }

  const occurredAt = new Date(value.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) throw new ObservationInputError();

  const sourceTimezone = value.sourceTimezone;
  if (
    sourceTimezone !== undefined &&
    (typeof sourceTimezone !== "string" ||
      sourceTimezone.length === 0 ||
      sourceTimezone.length > 100)
  ) {
    throw new ObservationInputError();
  }

  return {
    occurredAt: occurredAt.toISOString(),
    ...(sourceTimezone ? { sourceTimezone } : {}),
  };
}

export function parseCaptureObservationInput(
  value: unknown,
): CaptureObservationInput {
  if (!isRecord(value)) throw new ObservationInputError();

  if (
    "worldId" in value ||
    "world_id" in value ||
    "recordedAt" in value ||
    "recorded_at" in value ||
    "actorId" in value ||
    "userId" in value
  ) {
    throw new ObservationInputError();
  }

  const exactText = value.exactText;
  if (
    typeof exactText !== "string" ||
    exactText.trim().length === 0 ||
    exactText.length > observationTextLimit
  ) {
    throw new ObservationInputError();
  }

  return {
    exactText,
    idempotencyKey: requireUuid(value.idempotencyKey),
    occurrence: optionalOccurrence(value.occurrence),
  };
}

export function parseOccurrenceCorrectionInput(value: unknown) {
  if (!isRecord(value)) throw new ObservationInputError();

  const occurrence = optionalOccurrence(value);
  if (!occurrence) throw new ObservationInputError();

  return occurrence;
}

export function requireObservationId(value: string) {
  return requireUuid(value);
}
