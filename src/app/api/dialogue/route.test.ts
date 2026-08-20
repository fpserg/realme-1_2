import { beforeEach, describe, expect, it, vi } from "vitest";

import { DialogueProviderError } from "@/application/dialogue/one-companion-dialogue";

const mocks = vi.hoisted(() => ({
  assignTemporal: vi.fn(),
  capture: vi.fn(),
  getClaims: vi.fn(),
  list: vi.fn(),
  providerFactory: vi.fn(),
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
    list = mocks.list;
  },
}));

vi.mock("@/infrastructure/supabase/dialogue-evidence-repository", () => ({
  SupabaseDialogueEvidenceRepository: class {
    list = mocks.list;
  },
}));

vi.mock("@/infrastructure/supabase/temporal-repository", () => ({
  SupabaseTemporalRepository: class {
    assignObservation = mocks.assignTemporal;
  },
}));

vi.mock("@/infrastructure/ai/dialogue-provider-factory", () => ({
  createDialogueProvider: mocks.providerFactory,
}));

import { POST } from "./route";

const input = {
  idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
  persistence: "observation",
  recentTurns: [],
  text: "Persist before the provider runs.",
};

const persisted = {
  correctionCount: 0,
  exactText: input.text,
  id: "223e4567-e89b-42d3-a456-426614174000",
  localCalendarDate: null,
  occurredAt: null,
  occurredPrecision: "unknown",
  persistenceState: "saved",
  recordedAt: "2026-08-21T10:00:00.000Z",
  sourceFragmentId: "323e4567-e89b-42d3-a456-426614174000",
  sourceTimezone: null,
};

function request(body: Record<string, unknown>, accountId = "account-a") {
  return new Request("http://localhost/api/dialogue", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "X-RealMe-Recovery-Account-Id": accountId,
    },
    method: "POST",
  });
}

function events(responseText: string) {
  return responseText
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("POST /api/dialogue", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "account-a" } },
      error: null,
    });
    mocks.capture.mockResolvedValue({
      observation: persisted,
      wasCreated: true,
    });
    mocks.list.mockResolvedValue([
      {
        exactText: persisted.exactText,
        fragmentId: persisted.sourceFragmentId,
        observationId: persisted.id,
        recordedAt: persisted.recordedAt,
      },
    ]);
    mocks.assignTemporal.mockResolvedValue({ state: "assigned" });
    mocks.providerFactory.mockReturnValue({
      modelId: "fixture-model",
      providerId: "fixture-provider",
      async *stream() {
        yield "Meaningful ";
        yield "response.";
      },
    });
  });

  it("rejects unauthenticated dialogue before evidence or provider access", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: new Error("no") });
    const response = await POST(request(input));
    expect(response.status).toBe(401);
    expect(mocks.capture).not.toHaveBeenCalled();
    expect(mocks.providerFactory).not.toHaveBeenCalled();
  });

  it.each(["worldId", "userId", "actorId", "fragmentIds"])(
    "rejects caller-supplied %s authority",
    async (field) => {
      const response = await POST(
        request({ ...input, [field]: "other-world" }),
      );
      expect(response.status).toBe(400);
      expect(mocks.capture).not.toHaveBeenCalled();
    },
  );

  it("persists evidence before streaming and uses only server-derived authority", async () => {
    const response = await POST(request(input));
    const streamed = events(await response.text());

    expect(response.status).toBe(200);
    expect(mocks.capture).toHaveBeenCalledWith(
      { userId: "account-a" },
      { exactText: input.text, idempotencyKey: input.idempotencyKey },
    );
    expect(mocks.list).toHaveBeenCalledWith({ userId: "account-a" });
    expect(streamed.map((item) => item.type)).toEqual([
      "evidence_saved",
      "provider",
      "delta",
      "delta",
      "done",
    ]);
    expect(streamed[0]).toMatchObject({ observationId: persisted.id });
    expect(streamed.filter((item) => item.type === "delta")).toEqual([
      { delta: "Meaningful ", type: "delta" },
      { delta: "response.", type: "delta" },
    ]);
  });

  it("preserves saved evidence and reports truthful failure after a partial response", async () => {
    mocks.providerFactory.mockReturnValue({
      modelId: "fixture-model",
      providerId: "fixture-provider",
      async *stream() {
        yield "Partial";
        throw new DialogueProviderError("unavailable");
      },
    });

    const response = await POST(request(input));
    const streamed = events(await response.text());

    expect(streamed[0]).toMatchObject({
      observationId: persisted.id,
      type: "evidence_saved",
    });
    expect(streamed).toContainEqual({ delta: "Partial", type: "delta" });
    expect(streamed.at(-1)).toMatchObject({
      code: "unavailable",
      type: "error",
    });
    expect(mocks.capture).toHaveBeenCalledTimes(1);
  });

  it("keeps explicit interaction-only messages transient", async () => {
    const response = await POST(
      request({ ...input, persistence: "transient", text: "What can you do?" }),
    );
    const streamed = events(await response.text());

    expect(mocks.capture).not.toHaveBeenCalled();
    expect(streamed[0]).toEqual({ type: "transient_ready" });
    expect(mocks.list).toHaveBeenCalledWith({ userId: "account-a" });
  });

  it("aborts the provider stream when the client cancels", async () => {
    let providerSignal: AbortSignal | undefined;
    mocks.providerFactory.mockReturnValue({
      modelId: "fixture-model",
      providerId: "fixture-provider",
      async *stream(_context: unknown, options: { signal: AbortSignal }) {
        providerSignal = options.signal;
        await new Promise<void>((resolve) => {
          options.signal.addEventListener("abort", () => resolve(), {
            once: true,
          });
        });
        throw new DialogueProviderError("cancelled");
      },
    });

    const response = await POST(request(input));
    const reader = response.body!.getReader();
    await reader.read();
    await reader.read();
    await reader.cancel();

    await vi.waitFor(() => expect(providerSignal?.aborted).toBe(true));
  });

  it("rejects a recovery envelope owned by another signed-in account", async () => {
    const response = await POST(request(input, "account-b"));
    expect(response.status).toBe(409);
    expect(mocks.capture).not.toHaveBeenCalled();
  });
});
