import type { SupabaseClient } from "@supabase/supabase-js";

import type { InterpretationEnqueueRepository } from "@/application/interpretation/enqueue-interpretation";

import type { RealMeDatabase } from "./database.types";

export class SupabaseInterpretationEnqueueRepository
  implements InterpretationEnqueueRepository
{
  constructor(private readonly client: SupabaseClient<RealMeDatabase>) {}

  async enqueue(context: { userId: string }, observationId: string) {
    if (!context.userId) throw new Error("Authentication is required.");
    const { data, error } = await this.client.rpc(
      "enqueue_observation_interpretation",
      { p_observation_id: observationId },
    );
    if (error) throw error;
    const row = data[0];
    if (!row) throw new Error("Interpretation enqueue returned no job.");
    return {
      jobId: row.job_id,
      status: row.job_status,
      wasCreated: row.was_created,
    };
  }
}
