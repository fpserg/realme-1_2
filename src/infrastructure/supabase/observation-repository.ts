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
          "id, observation_id, corrected_occurred_at, corrected_occurred_precision, corrected_source_timezone, corrected_local_calendar_date, recorded_at",
        )
        .in("observation_id", observationIds)
        .order("recorded_at", { ascending: true }),
    ]);

    if (fragmentsResult.error) throw fragmentsResult.error;
    if (correctionsResult.error) throw correctionsResult.error;

    const textByObservation = new Map(
      fragmentsResult.data.map((fragment) => [
        fragment.observation_id,
        fragment.exact_text,
      ]),
    );
    const correctionsByObservation = new Map<
      string,
      (typeof correctionsResult.data)[number][]
    >();

    for (const correction of correctionsResult.data) {
      const current = correctionsByObservation.get(correction.observation_id);
      if (current) current.push(correction);
      else
        correctionsByObservation.set(correction.observation_id, [correction]);
    }

    return observations.flatMap<ObservationHistoryItem>((observation) => {
      const exactText = textByObservation.get(observation.id);
      if (exactText === undefined) return [];

      const corrections = correctionsByObservation.get(observation.id) ?? [];
      const latestCorrection = corrections.at(-1);

      return [
        {
          correctionCount: corrections.length,
          exactText,
          id: observation.id,
          localCalendarDate:
            latestCorrection?.corrected_local_calendar_date ??
            observation.local_calendar_date,
          occurredAt:
            latestCorrection?.corrected_occurred_at ?? observation.occurred_at,
          occurredPrecision: (latestCorrection?.corrected_occurred_precision ??
            observation.occurred_precision) as "exact" | "unknown",
          persistenceState: "saved",
          recordedAt: observation.recorded_at,
          sourceTimezone:
            latestCorrection?.corrected_source_timezone ??
            observation.source_timezone,
        },
      ];
    });
  }
}
