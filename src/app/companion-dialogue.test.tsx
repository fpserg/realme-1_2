import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CompanionDialogue, companionRecoveryKey } from "./companion-dialogue";

const accountA = "123e4567-e89b-42d3-a456-426614174001";
const accountB = "123e4567-e89b-42d3-a456-426614174002";

function stream(events: Record<string, unknown>[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const item of events) {
          controller.enqueue(encoder.encode(`${JSON.stringify(item)}\n`));
        }
        controller.close();
      },
    }),
    { status: 200 },
  );
}

const successfulEvents = [
  {
    observationId: "223e4567-e89b-42d3-a456-426614174000",
    recordedAt: "2026-08-21T10:00:00.000Z",
    type: "evidence_saved",
  },
  { model: "fixture-model", provider: "fixture", type: "provider" },
  { delta: "First ", type: "delta" },
  { delta: "response.", type: "delta" },
  { type: "done" },
];

describe("CompanionDialogue", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("streams a response after the exact user message is confirmed saved", async () => {
    vi.mocked(fetch).mockResolvedValue(stream(successfulEvents));
    render(<CompanionDialogue authenticatedAccountId={accountA} />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Exact dialogue evidence." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByText("First response.");
    expect(screen.getByText("saved", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("fixture · fixture-model")).toBeInTheDocument();
    expect(
      window.localStorage.getItem(companionRecoveryKey(accountA)),
    ).toBeNull();
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      persistence: "observation",
      text: "Exact dialogue evidence.",
    });
    expect(body).not.toHaveProperty("worldId");
    expect(body).not.toHaveProperty("userId");
  });

  it("renders incremental chunks before clean completion", async () => {
    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        new ReadableStream<Uint8Array>({
          start(streamController) {
            controller = streamController;
          },
        }),
        { status: 200 },
      ),
    );
    render(<CompanionDialogue authenticatedAccountId={accountA} />);
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Show the stream." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(controller).toBeDefined());
    controller!.enqueue(
      encoder.encode(
        `${JSON.stringify({ type: "transient_ready" })}\n${JSON.stringify({
          delta: "First",
          type: "delta",
        })}\n`,
      ),
    );
    await screen.findByText("First");
    expect(screen.getByText("responding", { exact: true })).toBeInTheDocument();

    controller!.enqueue(
      encoder.encode(
        `${JSON.stringify({ delta: " second", type: "delta" })}\n${JSON.stringify(
          {
            type: "done",
          },
        )}\n`,
      ),
    );
    controller!.close();
    await screen.findByText("First second");
    expect(
      screen.queryByText("responding", { exact: true }),
    ).not.toBeInTheDocument();
  });

  it("keeps interaction-only turns explicit and ephemeral", async () => {
    vi.mocked(fetch).mockResolvedValue(
      stream([
        { type: "transient_ready" },
        { model: "fixture-model", provider: "fixture", type: "provider" },
        { delta: "Ephemeral reply.", type: "delta" },
        { type: "done" },
      ]),
    );
    render(<CompanionDialogue authenticatedAccountId={accountA} />);
    fireEvent.click(
      screen.getByLabelText("Remember my exact message as an observation"),
    );
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "What can you do?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByText("Ephemeral reply.");
    expect(screen.getByText("ephemeral", { exact: true })).toBeInTheDocument();
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body.persistence).toBe("transient");
  });

  it("preserves saved-evidence retry identity across provider failure", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        stream([
          ...successfulEvents.slice(0, 2),
          { delta: "Partial", type: "delta" },
          {
            code: "unavailable",
            message:
              "The companion could not respond. Saved evidence remains safe.",
            retryable: true,
            type: "error",
          },
        ]),
      )
      .mockResolvedValueOnce(stream(successfulEvents));
    render(<CompanionDialogue authenticatedAccountId={accountA} />);
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Evidence survives failure." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByText("incomplete", { exact: true });
    const firstBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0]?.[1]?.body),
    );
    const recovered = JSON.parse(
      window.localStorage.getItem(companionRecoveryKey(accountA)) ?? "{}",
    );
    expect(recovered).toMatchObject({
      evidenceSaved: true,
      idempotencyKey: firstBody.idempotencyKey,
      text: "Evidence survives failure.",
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry companion" }));
    await screen.findByText("First response.");
    const secondBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[1]?.[1]?.body),
    );
    expect(secondBody.idempotencyKey).toBe(firstBody.idempotencyKey);
    expect(
      window.localStorage.getItem(companionRecoveryKey(accountA)),
    ).toBeNull();
  });

  it("never surfaces or submits another account's recovery envelope", async () => {
    window.localStorage.setItem(
      companionRecoveryKey(accountA),
      JSON.stringify({
        accountId: accountA,
        evidenceSaved: false,
        idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
        persistence: "observation",
        text: "Account A private draft.",
      }),
    );
    const { rerender } = render(
      <CompanionDialogue authenticatedAccountId={accountB} />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Message")).toHaveValue(""),
    );
    expect(
      screen.queryByText("Account A private draft."),
    ).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    rerender(<CompanionDialogue authenticatedAccountId={accountA} />);
    await waitFor(() =>
      expect(screen.getByLabelText("Message")).toHaveValue(
        "Account A private draft.",
      ),
    );
  });
});
