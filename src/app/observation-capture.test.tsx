import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ObservationCapture, PersistenceState } from "./observation-capture";

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
      "realme.observation.capture.v1",
      JSON.stringify({
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

    render(<ObservationCapture initialObservations={[]} />);
    await screen.findByDisplayValue(savedObservation.exactText);
    fireEvent.click(screen.getByRole("button", { name: "Retry save" }));

    await screen.findByText(savedObservation.exactText);
    const request = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(request[1]?.body))).toMatchObject({
      exactText: savedObservation.exactText,
      idempotencyKey,
    });
    expect(window.localStorage.getItem("realme.observation.capture.v1")).toBe(
      null,
    );
  });

  it("keeps text and retry identity locally when confirmation fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }));
    render(<ObservationCapture initialObservations={[]} />);

    fireEvent.change(screen.getByLabelText("Observation text"), {
      target: { value: "Uncertain but recoverable." },
    });
    const before = JSON.parse(
      window.localStorage.getItem("realme.observation.capture.v1") ?? "{}",
    ) as { idempotencyKey: string };
    fireEvent.click(screen.getByRole("button", { name: "Save observation" }));

    await screen.findByRole("alert");
    const after = JSON.parse(
      window.localStorage.getItem("realme.observation.capture.v1") ?? "{}",
    ) as { exactText: string; idempotencyKey: string };
    expect(after).toMatchObject({
      exactText: "Uncertain but recoverable.",
      idempotencyKey: before.idempotencyKey,
    });
    expect(screen.getByRole("button", { name: "Retry save" })).toBeEnabled();
  });

  it("reconstructs history from the supplied server state", async () => {
    render(<ObservationCapture initialObservations={[savedObservation]} />);

    expect(screen.getByText(savedObservation.exactText)).toBeInTheDocument();
    expect(screen.getByText(/Recorded Aug 20, 2026/)).toBeInTheDocument();
    await waitFor(() => expect(fetch).not.toHaveBeenCalled());
  });
});
