import { describe, expect, it, vi } from "vitest";

import type { ObservationRepository } from "@/application/observation/observation-capture";
import { ObservationAuthenticationError } from "@/application/observation/observation-capture";
import type { ObservationHistoryItem } from "@/domain/observation/observation";

import {
  assembleAuthorizedDialogueContext,
  dialogueEvidenceCharacterLimit,
  dialogueEvidenceCountLimit,
  type DialogueEvidenceRecord,
  type DialogueEvidenceRepository,
  prepareDialogueTurn,
} from "./one-companion-dialogue";

const input = {
  idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
  persistence: "observation" as const,
  recentTurns: [{ role: "assistant" as const, text: "Tell me more." }],
  text: "Exact evidence, not an instruction.",
};

function observation(
  index: number,
  text = `Evidence ${index}`,
): ObservationHistoryItem {
  return {
    correctionCount: 0,
    exactText: text,
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    localCalendarDate: null,
    occurredAt: null,
    occurredPrecision: "unknown",
    persistenceState: "saved",
    recordedAt: "2026-08-21T10:00:00.000Z",
    sourceTimezone: null,
  };
}

function evidence(
  index: number,
  text = `Evidence ${index}`,
): DialogueEvidenceRecord {
  return {
    exactText: text,
    fragmentId: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    observationId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    recordedAt: "2026-08-21T10:00:00.000Z",
  };
}

function repository(current: ObservationHistoryItem): ObservationRepository {
  return {
    capture: vi.fn().mockResolvedValue({
      observation: current,
      wasCreated: true,
    }),
    correctOccurrence: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
  };
}

function evidenceRepository(
  history: DialogueEvidenceRecord[],
): DialogueEvidenceRepository {
  return { list: vi.fn().mockResolvedValue(history) };
}

describe("one-companion dialogue application boundary", () => {
  it("persists qualifying evidence first and reconstructs exact fragment identity", async () => {
    const current = observation(1, input.text);
    const adapter = repository(current);
    const evidenceAdapter = evidenceRepository([
      evidence(1, input.text),
      evidence(2),
    ]);

    const prepared = await prepareDialogueTurn(
      "account-a",
      input,
      adapter,
      evidenceAdapter,
    );

    expect(adapter.capture).toHaveBeenCalledTimes(1);
    expect(evidenceAdapter.list).toHaveBeenCalledWith({ userId: "account-a" });
    expect(prepared.persistedObservation?.id).toBe(current.id);
    expect(prepared.context.evidence[0]).toEqual({
      exactText: input.text,
      reference: "evidence-current",
    });
    expect(prepared.context.evidenceTrace[0]).toEqual({
      fragmentId: evidence(1).fragmentId,
      observationId: current.id,
      reference: "evidence-current",
    });
  });

  it("keeps transient interaction explicit and does not create evidence", async () => {
    const adapter = repository(observation(1));
    const evidenceAdapter = evidenceRepository([evidence(2)]);
    const prepared = await prepareDialogueTurn(
      "account-a",
      { ...input, persistence: "transient" },
      adapter,
      evidenceAdapter,
    );

    expect(adapter.capture).not.toHaveBeenCalled();
    expect(prepared.persistedObservation).toBeNull();
    expect(prepared.context.currentEvidenceReference).toBeNull();
  });

  it("rejects missing authenticated identity before any read or write", async () => {
    const adapter = repository(observation(1));
    const evidenceAdapter = evidenceRepository([]);
    await expect(
      prepareDialogueTurn("", input, adapter, evidenceAdapter),
    ).rejects.toThrow(ObservationAuthenticationError);
    expect(adapter.capture).not.toHaveBeenCalled();
    expect(evidenceAdapter.list).not.toHaveBeenCalled();
  });

  it("applies count and character limits without truncating included fragments", () => {
    const history = Array.from(
      { length: dialogueEvidenceCountLimit + 5 },
      (_, index) => evidence(index + 1, "x".repeat(1_600)),
    );
    const context = assembleAuthorizedDialogueContext(
      { ...input, persistence: "transient" },
      history,
      null,
    );

    expect(context.evidence.length).toBeLessThanOrEqual(
      dialogueEvidenceCountLimit,
    );
    expect(
      context.evidence.reduce((sum, item) => sum + item.exactText.length, 0),
    ).toBeLessThanOrEqual(dialogueEvidenceCharacterLimit);
    expect(
      context.evidence.every((item) => item.exactText.length === 1_600),
    ).toBe(true);
  });

  it("never queries candidates, audit data, or another caller-nominated World", async () => {
    const adapter = repository(observation(1, input.text));
    const evidenceAdapter = evidenceRepository([evidence(1, input.text)]);
    await prepareDialogueTurn(
      "verified-account",
      input,
      adapter,
      evidenceAdapter,
    );

    expect(evidenceAdapter.list).toHaveBeenCalledTimes(1);
    expect(evidenceAdapter.list).toHaveBeenCalledWith({
      userId: "verified-account",
    });
    expect(
      JSON.stringify(vi.mocked(evidenceAdapter.list).mock.calls),
    ).not.toMatch(/world|candidate|audit/i);
  });
});
