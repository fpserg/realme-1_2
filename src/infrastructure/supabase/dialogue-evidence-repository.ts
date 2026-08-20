import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DialogueEvidenceRecord,
  DialogueEvidenceRepository,
} from "@/application/dialogue/one-companion-dialogue";

import type { RealMeDatabase } from "./database.types";

type ObservationRow = Pick<
  RealMeDatabase["public"]["Tables"]["observations"]["Row"],
  "id" | "recorded_at"
>;

type FragmentRow = Pick<
  RealMeDatabase["public"]["Tables"]["source_fragments"]["Row"],
  "id" | "observation_id" | "exact_text" | "ordinal"
>;

export function reconstructDialogueEvidence(
  observations: ObservationRow[],
  fragments: FragmentRow[],
): DialogueEvidenceRecord[] {
  const fragmentByObservation = new Map(
    fragments
      .filter((fragment) => fragment.ordinal === 0)
      .map((fragment) => [fragment.observation_id, fragment]),
  );

  return observations.flatMap((observation) => {
    const fragment = fragmentByObservation.get(observation.id);
    return fragment
      ? [
          {
            exactText: fragment.exact_text,
            fragmentId: fragment.id,
            observationId: observation.id,
            recordedAt: observation.recorded_at,
          },
        ]
      : [];
  });
}

export class SupabaseDialogueEvidenceRepository
  implements DialogueEvidenceRepository
{
  constructor(private readonly client: SupabaseClient<RealMeDatabase>) {}

  async list(context: { userId: string }) {
    if (!context.userId) throw new Error("Authenticated context is required.");

    const { data: observations, error: observationError } = await this.client
      .from("observations")
      .select("id, recorded_at")
      .eq("recorded_by_account_id", context.userId)
      .order("recorded_at", { ascending: false })
      .limit(50);

    if (observationError) throw observationError;
    if (observations.length === 0) return [];

    const { data: fragments, error: fragmentError } = await this.client
      .from("source_fragments")
      .select("id, observation_id, exact_text, ordinal")
      .in(
        "observation_id",
        observations.map((observation) => observation.id),
      )
      .eq("ordinal", 0);

    if (fragmentError) throw fragmentError;
    return reconstructDialogueEvidence(observations, fragments);
  }
}
