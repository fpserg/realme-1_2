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

async function renderDialogue(accountId: string) {
  const result = render(
    <CompanionDialogue authenticatedAccountId={accountId} />,
  );
  await waitFor(() => expect(screen.getByLabelText("Message")).toBeEnabled());
  return result;
}

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
    await renderDialogue(accountA);

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
    await renderDialogue(accountA);
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
    await renderDialogue(accountA);
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

  it("resets a completed ephemeral thread when the authenticated account changes", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        stream([
          { type: "transient_ready" },
          { model: "account-a-model", provider: "fixture", type: "provider" },
          { delta: "Account A assistant text.", type: "delta" },
          { type: "done" },
        ]),
      )
      .mockResolvedValueOnce(
        stream([
          { type: "transient_ready" },
          { model: "account-b-model", provider: "fixture", type: "provider" },
          { delta: "Account B assistant text.", type: "delta" },
          { type: "done" },
        ]),
      );
    const { rerender } = await renderDialogue(accountA);

    fireEvent.click(
      screen.getByLabelText("Remember my exact message as an observation"),
    );
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Account A user text." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByText("Account A assistant text.");
    expect(screen.getByText("fixture · account-a-model")).toBeInTheDocument();

    rerender(<CompanionDialogue authenticatedAccountId={accountB} />);

    expect(screen.getByLabelText("Message")).toBeDisabled();
    expect(screen.queryByText("Account A user text.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Account A assistant text."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("fixture · account-a-model"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toHaveValue("");
    expect(
      screen.getByText(
        "I’m here. Tell me what is happening, or ask me to think with you.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Message")).toBeEnabled());

    fireEvent.click(
      screen.getByLabelText("Remember my exact message as an observation"),
    );
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Account B user text." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByText("Account B assistant text.");
    const accountBBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[1]?.[1]?.body),
    );
    expect(accountBBody.persistence).toBe("transient");
    expect(JSON.stringify(accountBBody)).not.toContain("Account A user text.");
    expect(JSON.stringify(accountBBody)).not.toContain(
      "Account A assistant text.",
    );
    expect(accountBBody.recentTurns).toEqual([
      {
        role: "assistant",
        text: "I’m here. Tell me what is happening, or ask me to think with you.",
      },
    ]);
  });

  it("aborts and invalidates an in-flight prior-account stream", async () => {
    const encoder = new TextEncoder();
    let accountAController:
      | ReadableStreamDefaultController<Uint8Array>
      | undefined;
    let accountASignal: AbortSignal | null | undefined;
    vi.mocked(fetch)
      .mockImplementationOnce((_input, init) => {
        accountASignal = init?.signal;
        return Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                accountAController = controller;
              },
            }),
            { status: 200 },
          ),
        );
      })
      .mockResolvedValueOnce(
        stream([
          { type: "transient_ready" },
          { model: "account-b-model", provider: "fixture", type: "provider" },
          { delta: "Account B fresh reply.", type: "delta" },
          { type: "done" },
        ]),
      );
    const { rerender } = await renderDialogue(accountA);

    fireEvent.click(
      screen.getByLabelText("Remember my exact message as an observation"),
    );
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Account A in-flight text." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(accountAController).toBeDefined());

    accountAController!.enqueue(
      encoder.encode(
        `${JSON.stringify({ type: "transient_ready" })}\n${JSON.stringify({
          model: "account-a-model",
          provider: "fixture",
          type: "provider",
        })}\n${JSON.stringify({
          delta: "Account A partial reply.",
          type: "delta",
        })}\n`,
      ),
    );
    await screen.findByText("Account A partial reply.");

    rerender(<CompanionDialogue authenticatedAccountId={accountB} />);

    expect(screen.getByLabelText("Message")).toBeDisabled();
    await waitFor(() => expect(accountASignal?.aborted).toBe(true));
    expect(
      screen.queryByText("Account A in-flight text."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Account A partial reply."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("fixture · account-a-model"),
    ).not.toBeInTheDocument();

    accountAController!.enqueue(
      encoder.encode(
        `${JSON.stringify({
          delta: "Account A late reply.",
          type: "delta",
        })}\n${JSON.stringify({ type: "done" })}\n`,
      ),
    );
    accountAController!.close();
    await waitFor(() =>
      expect(
        screen.queryByText("Account A late reply."),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.getByLabelText("Message")).toBeEnabled());

    fireEvent.click(
      screen.getByLabelText("Remember my exact message as an observation"),
    );
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Account B fresh text." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByText("Account B fresh reply.");
    const accountBBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[1]?.[1]?.body),
    );
    expect(JSON.stringify(accountBBody)).not.toContain("Account A");
    expect(accountBBody.recentTurns).toEqual([
      {
        role: "assistant",
        text: "I’m here. Tell me what is happening, or ask me to think with you.",
      },
    ]);
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
    await renderDialogue(accountA);
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
    const accountAIdempotencyKey = "123e4567-e89b-42d3-a456-426614174000";
    const accountBIdempotencyKey = "223e4567-e89b-42d3-a456-426614174000";
    window.localStorage.setItem(
      companionRecoveryKey(accountA),
      JSON.stringify({
        accountId: accountA,
        evidenceSaved: false,
        idempotencyKey: accountAIdempotencyKey,
        persistence: "observation",
        text: "Account A private draft.",
      }),
    );
    window.localStorage.setItem(
      companionRecoveryKey(accountB),
      JSON.stringify({
        accountId: accountB,
        evidenceSaved: false,
        idempotencyKey: accountBIdempotencyKey,
        persistence: "transient",
        text: "Account B own draft.",
      }),
    );
    const { rerender } = await renderDialogue(accountB);
    await waitFor(() =>
      expect(screen.getByLabelText("Message")).toHaveValue(
        "Account B own draft.",
      ),
    );
    expect(
      screen.queryByText("Account A private draft."),
    ).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(
      JSON.parse(
        window.localStorage.getItem(companionRecoveryKey(accountB)) ?? "{}",
      ).idempotencyKey,
    ).toBe(accountBIdempotencyKey);

    rerender(<CompanionDialogue authenticatedAccountId={accountA} />);
    await waitFor(() =>
      expect(screen.getByLabelText("Message")).toHaveValue(
        "Account A private draft.",
      ),
    );
    expect(
      JSON.parse(
        window.localStorage.getItem(companionRecoveryKey(accountA)) ?? "{}",
      ).idempotencyKey,
    ).toBe(accountAIdempotencyKey);
  });
});
