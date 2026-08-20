import type {
  CaptureObservationInput,
  ObservationHistoryItem,
  OccurrenceCorrection,
  OccurrenceInput,
  PersistedCapture,
} from "@/domain/observation/observation";

export interface AuthenticatedObservationContext {
  userId: string;
}

export interface ObservationRepository {
  capture(
    context: AuthenticatedObservationContext,
    input: CaptureObservationInput,
  ): Promise<PersistedCapture>;
  correctOccurrence(
    context: AuthenticatedObservationContext,
    observationId: string,
    occurrence: OccurrenceInput,
  ): Promise<OccurrenceCorrection>;
  list(
    context: AuthenticatedObservationContext,
  ): Promise<ObservationHistoryItem[]>;
}

export class ObservationAuthenticationError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "ObservationAuthenticationError";
  }
}

function authenticatedContext(userId: string | null | undefined) {
  if (!userId) throw new ObservationAuthenticationError();
  return { userId };
}

export function captureTextObservation(
  authenticatedUserId: string | null | undefined,
  input: CaptureObservationInput,
  repository: ObservationRepository,
) {
  return repository.capture(authenticatedContext(authenticatedUserId), input);
}

export function correctObservationOccurrence(
  authenticatedUserId: string | null | undefined,
  observationId: string,
  occurrence: OccurrenceInput,
  repository: ObservationRepository,
) {
  return repository.correctOccurrence(
    authenticatedContext(authenticatedUserId),
    observationId,
    occurrence,
  );
}

export function listObservationHistory(
  authenticatedUserId: string | null | undefined,
  repository: ObservationRepository,
) {
  return repository.list(authenticatedContext(authenticatedUserId));
}
