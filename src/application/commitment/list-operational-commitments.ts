import type {
  CommitmentProjectionItem,
  CommitmentSurface,
} from "@/domain/commitment/commitment";

export type CommitmentProjectionRepository = {
  list(
    surface: CommitmentSurface,
    horizonDays?: number,
  ): Promise<CommitmentProjectionItem[]>;
};

export async function listOperationalCommitments(
  repository: CommitmentProjectionRepository,
): Promise<{
  horizon: CommitmentProjectionItem[];
  today: CommitmentProjectionItem[];
}> {
  const [today, horizon] = await Promise.all([
    repository.list("today"),
    repository.list("horizon", 30),
  ]);

  return { horizon, today };
}
