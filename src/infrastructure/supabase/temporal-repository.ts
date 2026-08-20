import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AuthenticatedTemporalContext,
  TemporalRepository,
} from "@/application/time/temporal-continuity";
import type { TimeSettingInput } from "@/domain/time/operational-time";

import type { RealMeDatabase } from "./database.types";

function boundaryMinute(value: string) {
  return value.slice(0, 5);
}

export class SupabaseTemporalRepository implements TemporalRepository {
  constructor(private readonly client: SupabaseClient<RealMeDatabase>) {}

  async getCurrentContext(context: AuthenticatedTemporalContext) {
    if (!context.userId) throw new Error("Authenticated context is required.");

    const { data, error } = await this.client.rpc(
      "get_current_operational_period",
    );
    if (error) throw error;
    const row = data[0];
    if (!row) return { currentPeriod: null, setting: null };

    return {
      currentPeriod: {
        endsAt: row.ends_at,
        id: row.operational_period_id,
        localDate: row.local_date,
        startsAt: row.starts_at,
      },
      setting: {
        effectiveFrom: row.setting_effective_from,
        id: row.time_setting_id,
        operationalBoundary: boundaryMinute(row.operational_day_boundary),
        timezone: row.timezone_name,
      },
    };
  }

  async saveSetting(
    context: AuthenticatedTemporalContext,
    input: TimeSettingInput,
  ) {
    if (!context.userId) throw new Error("Authenticated context is required.");

    const { data, error } = await this.client.rpc("save_time_setting", {
      p_operational_day_boundary: `${input.operationalBoundary}:00`,
      p_timezone_name: input.timezone,
    });
    if (error) throw error;
    const row = data[0];
    if (!row) throw new Error("Time setting returned no durable version.");

    return {
      effectiveFrom: row.effective_from,
      id: row.time_setting_id,
      operationalBoundary: boundaryMinute(row.operational_day_boundary),
      timezone: row.timezone_name,
    };
  }

  async assignObservation(
    context: AuthenticatedTemporalContext,
    observationId: string,
  ) {
    if (!context.userId) throw new Error("Authenticated context is required.");

    const { data, error } = await this.client.rpc(
      "assign_observation_operational_period",
      { p_observation_id: observationId },
    );
    if (error) throw error;
    const row = data[0];
    if (!row) throw new Error("Temporal assignment returned no state.");

    return {
      membershipId: row.membership_id,
      operationalDate: row.local_date,
      operationalPeriodId: row.operational_period_id,
      state:
        row.assignment_state === "correction_required"
          ? ("correction-required" as const)
          : ("assigned" as const),
      suggestedOperationalDate: row.suggested_local_date,
    };
  }

  async correctObservationMembership(
    context: AuthenticatedTemporalContext,
    observationId: string,
    reasonCategory: "occurred_time_correction" | "user_review",
  ) {
    if (!context.userId) throw new Error("Authenticated context is required.");

    const { data, error } = await this.client.rpc(
      "correct_observation_operational_period",
      {
        p_observation_id: observationId,
        p_reason_category: reasonCategory,
      },
    );
    if (error) throw error;
    const row = data[0];
    if (!row) throw new Error("Historical correction returned no state.");

    return {
      membershipId: row.membership_id,
      operationalDate: row.local_date,
      operationalPeriodId: row.operational_period_id,
      state: "assigned" as const,
      suggestedOperationalDate: null,
    };
  }
}
