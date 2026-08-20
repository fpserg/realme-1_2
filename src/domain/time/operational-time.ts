export const defaultOperationalBoundary = "04:00";

export interface TimeSettingInput {
  operationalBoundary: string;
  timezone: string;
}

export interface TimeSettingView extends TimeSettingInput {
  effectiveFrom: string;
  id: string;
}

export type TemporalPlacementState =
  | "assigned"
  | "correction-required"
  | "pending";

export interface TemporalPlacement {
  membershipId: string | null;
  operationalDate: string | null;
  operationalPeriodId: string | null;
  state: TemporalPlacementState;
  suggestedOperationalDate: string | null;
}

export interface CurrentOperationalPeriod {
  endsAt: string;
  id: string;
  localDate: string;
  startsAt: string;
}

export class TemporalInputError extends Error {
  constructor(message = "Temporal input is invalid.") {
    super(message);
    this.name = "TemporalInputError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isIanaTimezone(value: string) {
  if (!value || value.length > 100) return false;

  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
    return value.includes("/") || value === "UTC";
  } catch {
    return false;
  }
}

export function requireOperationalBoundary(value: unknown) {
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new TemporalInputError();
  }
  return value;
}

export function parseTimeSettingInput(value: unknown): TimeSettingInput {
  if (!isRecord(value)) throw new TemporalInputError();
  if (
    "worldId" in value ||
    "world_id" in value ||
    "actorId" in value ||
    "userId" in value ||
    "effectiveFrom" in value ||
    "effective_from" in value
  ) {
    throw new TemporalInputError();
  }

  if (typeof value.timezone !== "string" || !isIanaTimezone(value.timezone)) {
    throw new TemporalInputError();
  }

  return {
    operationalBoundary: requireOperationalBoundary(value.operationalBoundary),
    timezone: value.timezone,
  };
}

export function parseHistoricalCorrectionInput(value: unknown): {
  reasonCategory: "occurred_time_correction" | "user_review";
} {
  if (!isRecord(value)) throw new TemporalInputError();
  if (
    "worldId" in value ||
    "world_id" in value ||
    "actorId" in value ||
    "userId" in value ||
    "operationalPeriodId" in value ||
    "operational_period_id" in value
  ) {
    throw new TemporalInputError();
  }

  if (
    value.reasonCategory !== "occurred_time_correction" &&
    value.reasonCategory !== "user_review"
  ) {
    throw new TemporalInputError();
  }
  return {
    reasonCategory: value.reasonCategory as
      | "occurred_time_correction"
      | "user_review",
  };
}

function localParts(instant: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(instant);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    month: Number(values.month),
    second: Number(values.second),
    year: Number(values.year),
  };
}

function isoDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function shiftIsoDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return isoDate(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

export function operationalDateForInstant(
  instantValue: string,
  timezone: string,
  operationalBoundary: string,
) {
  if (!isIanaTimezone(timezone)) throw new TemporalInputError();
  const boundary = requireOperationalBoundary(operationalBoundary);
  const instant = new Date(instantValue);
  if (Number.isNaN(instant.getTime())) throw new TemporalInputError();

  const parts = localParts(instant, timezone);
  const localDate = isoDate(parts.year, parts.month, parts.day);
  const candidates = [shiftIsoDate(localDate, -1), localDate].filter(
    (candidateDate) => {
      const period = operationalPeriodForDate(
        candidateDate,
        timezone,
        boundary,
      );
      return (
        new Date(period.startsAt).getTime() <= instant.getTime() &&
        instant.getTime() < new Date(period.endsAt).getTime()
      );
    },
  );

  if (candidates.length !== 1) {
    throw new TemporalInputError(
      "The instant does not belong to exactly one resolved operational period.",
    );
  }

  return candidates[0];
}

function offsetAt(instantMs: number, timezone: string) {
  const instant = new Date(instantMs);
  const parts = localParts(instant, timezone);
  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) -
    Math.floor(instantMs / 1000) * 1000
  );
}

function partsMatchNaiveInstant(
  candidate: number,
  naiveInstant: number,
  timezone: string,
) {
  const actual = localParts(new Date(candidate), timezone);
  const expected = new Date(naiveInstant);
  return (
    actual.year === expected.getUTCFullYear() &&
    actual.month === expected.getUTCMonth() + 1 &&
    actual.day === expected.getUTCDate() &&
    actual.hour === expected.getUTCHours() &&
    actual.minute === expected.getUTCMinutes() &&
    actual.second === expected.getUTCSeconds()
  );
}

export function resolvedBoundaryForDate(
  localDate: string,
  operationalBoundary: string,
  timezone: string,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate) || !isIanaTimezone(timezone)) {
    throw new TemporalInputError();
  }
  const boundary = requireOperationalBoundary(operationalBoundary);
  const [year, month, day] = localDate.split("-").map(Number);
  const [hour, minute] = boundary.split(":").map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  const probeRange = 259_200_000;
  const beforeOffset = offsetAt(naive - probeRange, timezone);
  const afterOffset = offsetAt(naive + probeRange, timezone);
  const offsets = new Set([beforeOffset, afterOffset]);
  const matches = [...offsets]
    .map((offset) => naive - offset)
    .filter((candidate) => partsMatchNaiveInstant(candidate, naive, timezone));

  if (matches.length > 0) {
    // A fold has two matches. Personal chronology uses the earlier physical
    // occurrence deterministically.
    return new Date(Math.min(...matches)).toISOString();
  }

  const gapSize = afterOffset - beforeOffset;
  if (gapSize <= 0) {
    throw new TemporalInputError(
      "The local civil boundary could not be resolved.",
    );
  }

  // A gap has no exact match. Move the wall-clock value forward by the gap,
  // preserving its position within that gap, then apply the post-gap offset.
  const resolvedNaive = naive + gapSize;
  const resolvedCandidate = resolvedNaive - afterOffset;
  if (!partsMatchNaiveInstant(resolvedCandidate, resolvedNaive, timezone)) {
    throw new TemporalInputError(
      "The local civil boundary could not be normalized through its gap.",
    );
  }

  return new Date(resolvedCandidate).toISOString();
}

export function operationalPeriodForDate(
  localDate: string,
  timezone: string,
  operationalBoundary = defaultOperationalBoundary,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate) || !isIanaTimezone(timezone)) {
    throw new TemporalInputError();
  }
  const boundary = requireOperationalBoundary(operationalBoundary);
  const startsAt = resolvedBoundaryForDate(localDate, boundary, timezone);
  const endsAt = resolvedBoundaryForDate(
    shiftIsoDate(localDate, 1),
    boundary,
    timezone,
  );
  return {
    durationHours:
      (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 3_600_000,
    endsAt,
    startsAt,
  };
}
