import type { SupabaseClient } from "@supabase/supabase-js";

import type { CommitmentProjectionRepository } from "@/application/commitment/list-operational-commitments";
import {
  isCommitmentStatus,
  isCommitmentSurface,
  type CommitmentProjectionItem,
  type CommitmentSurface,
} from "@/domain/commitment/commitment";

import type { RealMeDatabase } from "./database.types";

export class SupabaseCommitmentProjectionRepository
  implements CommitmentProjectionRepository
{
  constructor(private readonly client: SupabaseClient<RealMeDatabase>) {}

  async list(
    surface: CommitmentSurface,
    horizonDays = 30,
  ): Promise<CommitmentProjectionItem[]> {
    const { data, error } = await this.client.rpc("list_operational_commitments", {
      p_horizon_days: horizonDays,
      p_surface: surface,
    });

    if (error) {
      throw new Error("Unable to load operational commitments", {
        cause: error,
      });
    }

    return (data ?? []).map((row) => {
      if (
        !row.classification_assertion_id ||
        !row.commitment_id ||
        !row.title ||
        !row.due_local_date ||
        !row.due_assertion_id ||
        !row.status_assertion_id ||
        !isCommitmentStatus(row.status) ||
        !isCommitmentSurface(row.surface)
      ) {
        throw new Error("Invalid commitment projection row");
      }

      return {
        classificationAssertionId: row.classification_assertion_id,
        commitmentId: row.commitment_id,
        dueLocalDate: row.due_local_date,
        dueAssertionId: row.due_assertion_id,
        isStale: row.is_stale,
        status: row.status,
        statusAssertionId: row.status_assertion_id,
        surface: row.surface,
        title: row.title,
        titleAssertionId: row.title_assertion_id,
      };
    });
  }
}
