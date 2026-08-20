import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ObservationCapture,
  observationRecoveryKey,
  PersistenceState,
} from "./observation-capture";

const accountA = "123e4567-e89b-42d3-a456-426614174001";
const accountB = "123e4567-e89b-42d3-a456-426614174002";

const savedObservation = {
  correctionCount: 0,
  exactText: "Exact mobile evidence.",
  id: "223e4567-e89b-42d3-a456-426614174000",
  localCalendarDate: null,
  occurredAt: null,
  occurredPrecision: "unknown" as const,
  persistenceState: "saved" as const,
  recordedAt: "2026-08-20T10:00:00.000Z",
  sourceTimezone: null,
};

describe("ObservationCapture", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders all persistence states without manufacturing processing", () => {
    render(
      <div>
        <PersistenceState state="unsynced" />
        <PersistenceState state="saved" />
        <PersistenceState state="processing" />
        <PersistenceState state="failed" />
      </div>,
    );

    expect(screen.getByText("unsynced")).toBeInTheDocument();
    expect(screen.getByText("saved")).toBeInTheDocument();
    expect(screen.getByText("processing")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
  });

  it("recovers an uncertain draft and retries with the same text and identity", async () => {
    const idempotencyKey = "123e4567-e89b-42d3-a456-426614174000";
    window.localStorage.setItem(
      observationRecoveryKey(accountA),
      JSON.stringify({
        accountId: accountA,
        attempted: true,
        exactText: savedObservation.exactText,
        idempotencyKey,
        occurredLocal: "",
      }),
    );
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ observation: savedObservation, wasCreated: false }),
        { status: 200 },
      ),
    );

    render(
      <ObservationCapture
        authenticatedAccountId={accountA}
        initialObservations={[]}
      />,
    );
    await screen.findByDisplayValue(savedObservation.exactText);
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));

    await screen.findByText(savedObservation.exactText);
    const request = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(request[1]?.body))).toMatchObject({
      exactText: savedObservation.exactText,
      idempotencyKey,
    });
    expect(window.localStorage.getItem(observationRecoveryKey(accountA))).toBe(
      null,
    );
  });

  it("keeps text and retry identity locally when confirmation fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }));
    render(
      <ObservationCapture
        authenticatedAccountId={accountA}
        initialObservations={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Observation text"), {
      target: { value: "Uncertain but recoverable." },
    });
    const before = JSON.parse(
      window.localStorage.getItem(observationRecoveryKey(accountA)) ?? "{}",
    ) as { idempotencyKey: string };
    fireEvent.click(screen.getByRole("button", { name: "Save observation" }));

    await screen.findByRole("alert");
    const after = JSON.parse(
      window.localStorage.getItem(observationRecoveryKey(accountA)) ?? "{}",
    ) as { exactText: string; idempotencyKey: string };
    expect(after).toMatchObject({
      exactText: "Uncertain but recoverable.",
      idempotencyKey: before.idempotencyKey,
    });
    expect(screen.getByRole("button", { name: "Retry save" })).toBeEnabled();
  });

  it("never surfaces or submits another account's recoverable draft", async () => {
    const accountAText = "User A uncertain evidence.";
    const accountBText = "User B separate evidence.";
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            observation: { ...savedObservation, exactText: accountBText },
            wasCreated: true,
          }),
          { status: 201 },
        ),
      );

    const { rerender } = render(
      <ObservationCapture
        authenticatedAccountId={accountA}
        initialObservations={[]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Observation text"), {
      target: { value: accountAText },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save observation" }));
    await screen.findByRole("alert");

    const accountAEnvelope = JSON.parse(
      window.localStorage.getItem(observationRecoveryKey(accountA)) ?? "{}",
    ) as {
      accountId: string;
      attempted: boolean;
      exactText: string;
      idempotencyKey: string;
    };
    expect(accountAEnvelope).toMatchObject({
      accountId: accountA,
      attempted: true,
      exactText: accountAText,
    });
    window.localStorage.setItem(
      observationRecoveryKey(accountB),
      JSON.stringify(accountAEnvelope),
    );

    rerender(
      <ObservationCapture
        authenticatedAccountId={accountB}
        initialObservations={[]}
      />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Observation text")).toHaveValue(""),
    );
    expect(screen.queryByDisplayValue(accountAText)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Retry save" }),
    ).not.toBeInTheDocument();
    expect(
      window.localStorage.getItem(observationRecoveryKey(accountB)),
    ).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Observation text"), {
      target: { value: accountBText },
    });
    const accountBEnvelope = JSON.parse(
      window.localStorage.getItem(observationRecoveryKey(accountB)) ?? "{}",
    ) as { accountId: string; idempotencyKey: string };
    expect(accountBEnvelope.accountId).toBe(accountB);
    expect(accountBEnvelope.idempotencyKey).not.toBe(
      accountAEnvelope.idempotencyKey,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save observation" }));
    await screen.findByText(accountBText);
    const accountBRequest = vi.mocked(fetch).mock.calls[1];
    expect(JSON.parse(String(accountBRequest[1]?.body))).toMatchObject({
      exactText: accountBText,
      idempotencyKey: accountBEnvelope.idempotencyKey,
    });
    expect(
      new Headers(accountBRequest[1]?.headers).get(
        "X-RealMe-Recovery-Account-Id",
      ),
    ).toBe(accountB);
    expect(String(accountBRequest[1]?.body)).not.toContain(accountAText);

    rerender(
      <ObservationCapture
        authenticatedAccountId={accountA}
        initialObservations={[]}
      />,
    );
    await screen.findByDisplayValue(accountAText);
    expect(screen.getByRole("button", { name: "Retry save" })).toBeEnabled();
    expect(
      JSON.parse(
        window.localStorage.getItem(observationRecoveryKey(accountA)) ?? "{}",
      ),
    ).toMatchObject({
      accountId: accountA,
      exactText: accountAText,
      idempotencyKey: accountAEnvelope.idempotencyKey,
    });
  });

  it("reconstructs history from the supplied server state", async () => {
    render(
      <ObservationCapture
        authenticatedAccountId={accountA}
        initialObservations={[savedObservation]}
      />,
    );

    expect(screen.getByText(savedObservation.exactText)).toBeInTheDocument();
    expect(screen.getByText(/Recorded Aug 20, 2026/)).toBeInTheDocument();
    await waitFor(() => expect(fetch).not.toHaveBeenCalled());
  });
});
