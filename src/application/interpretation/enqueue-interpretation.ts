export interface InterpretationEnqueueResult {
  jobId: string;
  status: "failed" | "queued" | "running" | "succeeded";
  wasCreated: boolean;
}

export interface InterpretationEnqueueRepository {
  enqueue(
    context: { userId: string },
    observationId: string,
  ): Promise<InterpretationEnqueueResult>;
}

export function enqueueObservationInterpretation(
  userId: string | null | undefined,
  observationId: string,
  repository: InterpretationEnqueueRepository,
) {
  if (!userId) throw new Error("Authentication is required.");
  return repository.enqueue({ userId }, observationId);
}

export async function reconcileObservationInterpretations(
  userId: string | null | undefined,
  observationIds: string[],
  repository: InterpretationEnqueueRepository,
) {
  if (!userId) throw new Error("Authentication is required.");
  const uniqueIds = [...new Set(observationIds)].slice(0, 50);
  return Promise.allSettled(
    uniqueIds.map((observationId) =>
      repository.enqueue({ userId }, observationId),
    ),
  );
}
