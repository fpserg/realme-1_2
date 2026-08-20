import type { ObservationHistoryItem } from "@/domain/observation/observation";
import type {
  CurrentOperationalPeriod,
  TemporalPlacement,
  TimeSettingInput,
  TimeSettingView,
} from "@/domain/time/operational-time";

export interface AuthenticatedTemporalContext {
  userId: string;
}

export interface TemporalContextView {
  currentPeriod: CurrentOperationalPeriod | null;
  setting: TimeSettingView | null;
}

export interface TemporalContinuityView extends TemporalContextView {
  observations: ObservationHistoryItem[];
}

export interface TemporalRepository {
  assignObservation(
    context: AuthenticatedTemporalContext,
    observationId: string,
  ): Promise<TemporalPlacement>;
  correctObservationMembership(
    context: AuthenticatedTemporalContext,
    observationId: string,
    reasonCategory: "occurred_time_correction" | "user_review",
  ): Promise<TemporalPlacement>;
  getCurrentContext(
    context: AuthenticatedTemporalContext,
  ): Promise<TemporalContextView>;
  saveSetting(
    context: AuthenticatedTemporalContext,
    input: TimeSettingInput,
  ): Promise<TimeSettingView>;
}

export class TemporalAuthenticationError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "TemporalAuthenticationError";
  }
}

function authenticatedContext(userId: string | null | undefined) {
  if (!userId) throw new TemporalAuthenticationError();
  return { userId };
}

export async function loadTemporalContinuity(
  authenticatedUserId: string | null | undefined,
  observations: ObservationHistoryItem[],
  repository: TemporalRepository,
): Promise<TemporalContinuityView> {
  const context = authenticatedContext(authenticatedUserId);
  const current = await repository.getCurrentContext(context);
  if (!current.setting || !current.currentPeriod) {
    return { ...current, observations };
  }

  const withPlacement: ObservationHistoryItem[] = [];
  for (const observation of observations) {
    try {
      const temporalPlacement = await repository.assignObservation(
        context,
        observation.id,
      );
      withPlacement.push({ ...observation, temporalPlacement });
    } catch {
      withPlacement.push({
        ...observation,
        temporalPlacement: {
          membershipId: null,
          operationalDate: null,
          operationalPeriodId: null,
          state: "pending",
          suggestedOperationalDate: null,
        },
      });
    }
  }

  return { ...current, observations: withPlacement };
}

export function saveTimeSetting(
  authenticatedUserId: string | null | undefined,
  input: TimeSettingInput,
  repository: TemporalRepository,
) {
  return repository.saveSetting(
    authenticatedContext(authenticatedUserId),
    input,
  );
}

export function assignObservationTime(
  authenticatedUserId: string | null | undefined,
  observationId: string,
  repository: TemporalRepository,
) {
  return repository.assignObservation(
    authenticatedContext(authenticatedUserId),
    observationId,
  );
}

export function correctObservationMembership(
  authenticatedUserId: string | null | undefined,
  observationId: string,
  reasonCategory: "occurred_time_correction" | "user_review",
  repository: TemporalRepository,
) {
  return repository.correctObservationMembership(
    authenticatedContext(authenticatedUserId),
    observationId,
    reasonCategory,
  );
}
