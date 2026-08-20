import { parseCaptureObservationInput } from "@/domain/observation/observation";
import type { ObservationHistoryItem } from "@/domain/observation/observation";

interface E2eStore {
  byIdempotencyKey: Map<string, ObservationHistoryItem>;
}

const globalStore = globalThis as typeof globalThis & {
  realMeStep99E2eStore?: E2eStore;
};

const currentOperationalPeriodId = "00000000-0000-4000-8000-000000000100";

function store() {
  globalStore.realMeStep99E2eStore ??= { byIdempotencyKey: new Map() };
  return globalStore.realMeStep99E2eStore;
}

function unavailable() {
  return Response.json({ error: "Not found." }, { status: 404 });
}

export async function GET() {
  if (process.env.REALME_E2E_FIXTURE !== "1") return unavailable();

  return Response.json({
    observations: [...store().byIdempotencyKey.values()].toReversed(),
  });
}

export async function POST(request: Request) {
  if (process.env.REALME_E2E_FIXTURE !== "1") return unavailable();

  const input = parseCaptureObservationInput(await request.json());
  const existing = store().byIdempotencyKey.get(input.idempotencyKey);
  if (existing) {
    return Response.json({ observation: existing, wasCreated: false });
  }

  const occurredAt = input.occurrence?.occurredAt ?? null;
  const observation: ObservationHistoryItem = {
    correctionCount: 0,
    exactText: input.exactText,
    id: crypto.randomUUID(),
    localCalendarDate: occurredAt?.slice(0, 10) ?? null,
    occurredAt,
    occurredPrecision: occurredAt ? "exact" : "unknown",
    persistenceState: "saved",
    recordedAt: new Date().toISOString(),
    sourceTimezone: input.occurrence?.sourceTimezone ?? null,
    temporalPlacement: {
      membershipId: crypto.randomUUID(),
      operationalDate: "2026-08-21",
      operationalPeriodId: currentOperationalPeriodId,
      state: "assigned",
      suggestedOperationalDate: null,
    },
  };
  store().byIdempotencyKey.set(input.idempotencyKey, observation);

  return Response.json({ observation, wasCreated: true }, { status: 201 });
}
