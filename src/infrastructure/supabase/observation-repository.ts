import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AuthenticatedObservationContext,
  ObservationRepository,
} from "@/application/observation/observation-capture";
import type {
  CaptureObservationInput,
  ObservationHistoryItem,
  OccurrenceInput,
} from "@/domain/observation/observation";

import type { RealMeDatabase } from "./database.types";

type ObservationHistoryRow = Pick<
  RealMeDatabase["public"]["Tables"]["observations"]["Row"],
  | "id"
  | "recorded_at"
  | "occurred_at"
  | "occurred_precision"
  | "source_timezone"
  | "local_calendar_date"
>;

type SourceFragmentHistoryRow = Pick<
  RealMeDatabase["public"]["Tables"]["source_fragments"]["Row"],
  "observation_id" | "exact_text" | "ordinal"
>;

type CorrectionHistoryRow = Pick<
  RealMeDatabase["public"]["Tables"]["observation_corrections"]["Row"],
  | "id"
  | "observation_id"
  | "corrected_occurred_at"
  | "corrected_occurred_precision"
  | "corrected_source_timezone"
  | "corrected_local_calendar_date"
  | "recorded_at"
  | "supersedes_correction_id"
>;

function uniqueCorrectionLeaf(corrections: CorrectionHistoryRow[]) {
  if (corrections.length === 0) return undefined;

  const byId = new Map(
    corrections.map((correction) => [correction.id, correction]),
  );
  if (byId.size !== corrections.length) {
    throw new Error("Malformed observation correction chain.");
  }

  const supersededIds = new Set<string>();
  for (const correction of corrections) {
    if (!correction.supersedes_correction_id) continue;
    if (!byId.has(correction.supersedes_correction_id)) {
      throw new Error("Malformed observation correction chain.");
    }
    supersededIds.add(correction.supersedes_correction_id);
  }

  const leaves = corrections.filter(
    (correction) => !supersededIds.has(correction.id),
  );
  if (leaves.length !== 1) {
    throw new Error("Malformed observation correction chain.");
  }

  const leaf = leaves[0];
  const visited = new Set<string>();
  let current: CorrectionHistoryRow | undefined = leaf;
  while (current) {
    if (visited.has(current.id)) {
      throw new Error("Malformed observation correction chain.");
    }
    visited.add(current.id);
    current = current.supersedes_correction_id
      ? byId.get(current.supersedes_correction_id)
      : undefined;
  }

  if (visited.size !== corrections.length) {
    throw new Error("Malformed observation correction chain.");
  }

  return leaf;
}

export function reconstructObservationHistory(
  observations: ObservationHistoryRow[],
  fragments: SourceFragmentHistoryRow[],
  corrections: CorrectionHistoryRow[],
) {
  const textByObservation = new Map(
    fragments.map((fragment) => [fragment.observation_id, fragment.exact_text]),
  );
  const correctionsByObservation = new Map<string, CorrectionHistoryRow[]>();

  for (const correction of corrections) {
    const current = correctionsByObservation.get(correction.observation_id);
    if (current) current.push(correction);
    else correctionsByObservation.set(correction.observation_id, [correction]);
  }

  return observations.flatMap<ObservationHistoryItem>((observation) => {
    const exactText = textByObservation.get(observation.id);
    if (exactText === undefined) return [];

    const observationCorrections =
      correctionsByObservation.get(observation.id) ?? [];
    const effectiveCorrection = uniqueCorrectionLeaf(observationCorrections);

    return [
      {
        correctionCount: observationCorrections.length,
        exactText,
        id: observation.id,
        localCalendarDate:
          effectiveCorrection?.corrected_local_calendar_date ??
          observation.local_calendar_date,
        occurredAt:
          effectiveCorrection?.corrected_occurred_at ?? observation.occurred_at,
        occurredPrecision: (effectiveCorrection?.corrected_occurred_precision ??
          observation.occurred_precision) as "exact" | "unknown",
        persistenceState: "saved",
        recordedAt: observation.recorded_at,
        sourceTimezone:
          effectiveCorrection?.corrected_source_timezone ??
          observation.source_timezone,
      },
    ];
  });
}

export class SupabaseObservationRepository implements ObservationRepository {
  constructor(private readonly client: SupabaseClient<RealMeDatabase>) {}

  async capture(
    context: AuthenticatedObservationContext,
    input: CaptureObservationInput,
  ) {
    if (!context.userId) throw new Error("Authenticated context is required.");

    const { data, error } = await this.client.rpc("capture_text_observation", {
      p_exact_text: input.exactText,
      p_idempotency_key: input.idempotencyKey,
      p_occurred_at: input.occurrence?.occurredAt ?? null,
      p_source_timezone: input.occurrence?.sourceTimezone ?? null,
    });

    if (error) throw error;
    const row = data[0];
    if (!row) throw new Error("Capture returned no durable observation.");

    return {
      observation: {
        correctionCount: 0,
        exactText: input.exactText,
        id: row.observation_id,
        localCalendarDate: row.local_calendar_date,
        occurredAt: row.occurred_at,
        occurredPrecision: row.occurred_precision as "exact" | "unknown",
        persistenceState: "saved" as const,
        recordedAt: row.recorded_at,
        sourceTimezone: row.source_timezone,
      },
      wasCreated: row.was_created,
    };
  }

  async correctOccurrence(
    context: AuthenticatedObservationContext,
    observationId: string,
    occurrence: OccurrenceInput,
  ) {
    if (!context.userId) throw new Error("Authenticated context is required.");

    const { data, error } = await this.client.rpc(
      "correct_observation_occurred_time",
      {
        p_observation_id: observationId,
        p_occurred_at: occurrence.occurredAt,
        p_source_timezone: occurrence.sourceTimezone ?? null,
      },
    );

    if (error) throw error;
    const row = data[0];
    if (!row) throw new Error("Correction returned no durable record.");

    return {
      correctionId: row.correction_id,
      localCalendarDate: row.local_calendar_date,
      observationId: row.observation_id,
      occurredAt: row.occurred_at,
      recordedAt: row.recorded_at,
      sourceTimezone: row.source_timezone,
    };
  }

  async list(context: AuthenticatedObservationContext) {
    const { data: observations, error: observationsError } = await this.client
      .from("observations")
      .select(
        "id, recorded_at, occurred_at, occurred_precision, source_timezone, local_calendar_date",
      )
      .eq("recorded_by_account_id", context.userId)
      .order("recorded_at", { ascending: false })
      .limit(50);

    if (observationsError) throw observationsError;
    if (observations.length === 0) return [];

    const observationIds = observations.map((observation) => observation.id);
    const [fragmentsResult, correctionsResult] = await Promise.all([
      this.client
        .from("source_fragments")
        .select("observation_id, exact_text, ordinal")
        .in("observation_id", observationIds)
        .eq("ordinal", 0),
      this.client
        .from("observation_corrections")
        .select(
          "id, observation_id, corrected_occurred_at, corrected_occurred_precision, corrected_source_timezone, corrected_local_calendar_date, recorded_at, supersedes_correction_id",
        )
        .in("observation_id", observationIds),
    ]);

    if (fragmentsResult.error) throw fragmentsResult.error;
    if (correctionsResult.error) throw correctionsResult.error;

    return reconstructObservationHistory(
      observations,
      fragmentsResult.data,
      correctionsResult.data,
    );
  }
}
