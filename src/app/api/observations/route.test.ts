import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assignTemporal: vi.fn(),
  capture: vi.fn(),
  enqueue: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("../../_supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: { getClaims: mocks.getClaims },
  }),
}));

vi.mock("@/infrastructure/supabase/observation-repository", () => ({
  SupabaseObservationRepository: class {
    capture = mocks.capture;
    correctOccurrence = vi.fn();
    list = vi.fn();
  },
}));

vi.mock("@/infrastructure/supabase/temporal-repository", () => ({
  SupabaseTemporalRepository: class {
    assignObservation = mocks.assignTemporal;
  },
}));

vi.mock("@/infrastructure/supabase/interpretation-enqueue-repository", () => ({
  SupabaseInterpretationEnqueueRepository: class {
    enqueue = mocks.enqueue;
  },
}));

import { POST } from "./route";

function request(body: Record<string, unknown>, accountId = "account-a") {
  return new Request("http://localhost/api/observations", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "X-RealMe-Recovery-Account-Id": accountId,
    },
    method: "POST",
  });
}

describe("POST /api/observations", () => {
  beforeEach(() => {
    mocks.capture.mockReset();
    mocks.enqueue.mockReset();
    mocks.assignTemporal.mockReset();
    mocks.getClaims.mockReset();
  });

  it("rejects unauthenticated capture before constructing evidence", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: new Error("no") });

    const response = await POST(
      request({
        exactText: "Must not persist",
        idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it.each(["worldId", "recordedAt", "actorId"])(
    "rejects caller-supplied %s authority",
    async (field) => {
      mocks.getClaims.mockResolvedValue({
        data: { claims: { sub: "account-a" } },
        error: null,
      });

      const response = await POST(
        request({
          exactText: "Evidence",
          idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
          [field]: "caller-controlled",
        }),
      );

      expect(response.status).toBe(400);
      expect(mocks.capture).not.toHaveBeenCalled();
    },
  );

  it("rejects a draft bound to a different authenticated account", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "account-b" } },
      error: null,
    });

    const response = await POST(
      request(
        {
          exactText: "User A evidence",
          idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
        },
        "account-a",
      ),
    );

    expect(response.status).toBe(409);
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it("confirms saved evidence when temporal assignment remains pending", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "account-a" } },
      error: null,
    });
    mocks.capture.mockResolvedValue({
      observation: {
        correctionCount: 0,
        exactText: "Saved before temporal processing.",
        id: "223e4567-e89b-42d3-a456-426614174000",
        localCalendarDate: null,
        occurredAt: null,
        occurredPrecision: "unknown",
        persistenceState: "saved",
        recordedAt: "2026-08-21T10:00:00.000Z",
        sourceTimezone: null,
      },
      wasCreated: true,
    });
    mocks.assignTemporal.mockRejectedValue(new Error("temporal unavailable"));
    mocks.enqueue.mockRejectedValue(new Error("enqueue unavailable"));

    const response = await POST(
      request({
        exactText: "Saved before temporal processing.",
        idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      observation: {
        exactText: "Saved before temporal processing.",
        persistenceState: "saved",
        temporalPlacement: { state: "pending" },
      },
    });
    expect(mocks.enqueue).toHaveBeenCalledWith(
      { userId: "account-a" },
      "223e4567-e89b-42d3-a456-426614174000",
    );
  });
});
