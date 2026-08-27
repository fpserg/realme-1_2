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

export interface InterpretationReconciliationRepository {
  reconcile(context: { userId: string }): Promise<{ processed: number }>;
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
  repository: InterpretationReconciliationRepository,
) {
  if (!userId) throw new Error("Authentication is required.");
  return repository.reconcile({ userId });
}
