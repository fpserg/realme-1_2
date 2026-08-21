"use client";

import { useLayoutEffect, useRef, useState } from "react";

import type {
  DialoguePersistence,
  DialogueRecentTurn,
} from "@/domain/dialogue/dialogue";

import styles from "./companion-dialogue.module.css";

const recoveryPrefix = "realme.dialogue.turn.v1";

interface RecoveryEnvelope {
  accountId: string;
  evidenceSaved: boolean;
  idempotencyKey: string;
  persistence: DialoguePersistence;
  text: string;
}

interface ThreadMessage {
  evidenceState?: "ephemeral" | "saved" | "unsynced";
  id: string;
  role: "assistant" | "user";
  status: "complete" | "failed" | "streaming";
  text: string;
}

interface DialogueStreamEvent {
  code?: string;
  delta?: string;
  message?: string;
  model?: string;
  observationId?: string;
  provider?: string;
  recordedAt?: string;
  retryable?: boolean;
  type:
    | "delta"
    | "done"
    | "error"
    | "evidence_saved"
    | "provider"
    | "transient_ready";
}

const companionWelcome =
  "I’m here. Tell me what is happening, or ask me to think with you.";

function neutralThread(): ThreadMessage[] {
  return [
    {
      id: "companion-welcome",
      role: "assistant",
      status: "complete",
      text: companionWelcome,
    },
  ];
}

export function companionRecoveryKey(accountId: string) {
  return `${recoveryPrefix}:${accountId}`;
}

function newEnvelope(
  accountId: string,
  text: string,
  persistence: DialoguePersistence,
): RecoveryEnvelope {
  return {
    accountId,
    evidenceSaved: false,
    idempotencyKey: crypto.randomUUID(),
    persistence,
    text,
  };
}

function readRecovery(accountId: string): RecoveryEnvelope | null {
  const key = companionRecoveryKey(accountId);
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<RecoveryEnvelope>;
    if (
      value.accountId !== accountId ||
      typeof value.text !== "string" ||
      typeof value.idempotencyKey !== "string" ||
      (value.persistence !== "observation" && value.persistence !== "transient")
    ) {
      window.localStorage.removeItem(key);
      return null;
    }
    return {
      accountId,
      evidenceSaved: value.evidenceSaved === true,
      idempotencyKey: value.idempotencyKey,
      persistence: value.persistence,
      text: value.text,
    };
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function recentTurns(messages: ThreadMessage[]): DialogueRecentTurn[] {
  return messages
    .filter((message) => message.text && message.status === "complete")
    .slice(-6)
    .map((message) => ({
      role: message.role,
      text: message.text.slice(0, 2_000),
    }));
}

async function consumeNdjson(
  response: Response,
  onEvent: (event: DialogueStreamEvent) => void,
) {
  if (!response.body) throw new Error("Dialogue stream unavailable.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as DialogueStreamEvent);
    }
    if (done) break;
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as DialogueStreamEvent);
}

export function CompanionDialogue({
  authenticatedAccountId,
  endpoint = "/api/dialogue",
}: {
  authenticatedAccountId: string;
  endpoint?: string;
}) {
  const [draft, setDraft] = useState("");
  const [remember, setRemember] = useState(true);
  const [messages, setMessages] = useState<ThreadMessage[]>(neutralThread);
  const [recovery, setRecovery] = useState<RecoveryEnvelope | null>(null);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionAccountId, setSessionAccountId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeAccountRef = useRef<string | null>(null);
  const sessionGenerationRef = useRef(0);

  useLayoutEffect(() => {
    const generation = sessionGenerationRef.current + 1;
    sessionGenerationRef.current = generation;
    activeAccountRef.current = authenticatedAccountId;
    abortRef.current?.abort();
    abortRef.current = null;

    const recovered = readRecovery(authenticatedAccountId);
    queueMicrotask(() => {
      if (
        activeAccountRef.current !== authenticatedAccountId ||
        sessionGenerationRef.current !== generation
      ) {
        return;
      }
      setSessionAccountId(authenticatedAccountId);
      setMessages(neutralThread());
      setDraft(recovered?.text ?? "");
      setRemember(recovered?.persistence !== "transient");
      setRecovery(recovered);
      setProviderLabel(null);
      setIsStreaming(false);
    });

    return () => {
      if (sessionGenerationRef.current !== generation) return;
      sessionGenerationRef.current += 1;
      activeAccountRef.current = null;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [authenticatedAccountId]);

  function isCurrentSession(accountId: string, generation: number) {
    return (
      activeAccountRef.current === accountId &&
      sessionGenerationRef.current === generation
    );
  }

  function saveRecovery(envelope: RecoveryEnvelope, generation: number) {
    if (!isCurrentSession(envelope.accountId, generation)) return;
    window.localStorage.setItem(
      companionRecoveryKey(envelope.accountId),
      JSON.stringify(envelope),
    );
    setRecovery((current) =>
      isCurrentSession(envelope.accountId, generation) ? envelope : current,
    );
  }

  function clearRecovery(accountId: string, generation: number) {
    if (!isCurrentSession(accountId, generation)) return;
    window.localStorage.removeItem(companionRecoveryKey(accountId));
    setRecovery((current) =>
      isCurrentSession(accountId, generation) ? null : current,
    );
  }

  function updateMessage(
    id: string,
    update: Partial<ThreadMessage>,
    accountId: string,
    generation: number,
  ) {
    if (!isCurrentSession(accountId, generation)) return;
    setMessages((current) =>
      isCurrentSession(accountId, generation)
        ? current.map((message) =>
            message.id === id ? { ...message, ...update } : message,
          )
        : current,
    );
  }

  async function send(envelope: RecoveryEnvelope, retry = false) {
    const accountId = envelope.accountId;
    const generation = sessionGenerationRef.current;
    if (!isCurrentSession(accountId, generation) || abortRef.current) return;
    const userMessageId = retry ? "retry-user" : crypto.randomUUID();
    const assistantMessageId = retry ? "retry-assistant" : crypto.randomUUID();

    if (retry) {
      setMessages((current) =>
        isCurrentSession(accountId, generation)
          ? [
              ...current.filter(
                (message) =>
                  message.id !== "retry-user" &&
                  message.id !== "retry-assistant",
              ),
              {
                evidenceState:
                  envelope.persistence === "transient"
                    ? "ephemeral"
                    : envelope.evidenceSaved
                      ? "saved"
                      : "unsynced",
                id: userMessageId,
                role: "user",
                status: "complete",
                text: envelope.text,
              },
              {
                id: assistantMessageId,
                role: "assistant",
                status: "streaming",
                text: "",
              },
            ]
          : current,
      );
    } else {
      setMessages((current) =>
        isCurrentSession(accountId, generation)
          ? [
              ...current,
              {
                evidenceState:
                  envelope.persistence === "transient"
                    ? "ephemeral"
                    : "unsynced",
                id: userMessageId,
                role: "user",
                status: "complete",
                text: envelope.text,
              },
              {
                id: assistantMessageId,
                role: "assistant",
                status: "streaming",
                text: "",
              },
            ]
          : current,
      );
    }

    saveRecovery(envelope, generation);
    setDraft("");
    const abortController = new AbortController();
    abortRef.current = abortController;
    setIsStreaming(true);
    let completed = false;
    let failed = false;
    let currentEnvelope = envelope;

    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify({
          idempotencyKey: envelope.idempotencyKey,
          persistence: envelope.persistence,
          recentTurns: recentTurns(messages),
          text: envelope.text,
        }),
        headers: {
          "Content-Type": "application/json",
          "X-RealMe-Recovery-Account-Id": envelope.accountId,
        },
        method: "POST",
        signal: abortController.signal,
      });
      if (!response.ok) throw new Error("Dialogue was not confirmed.");

      await consumeNdjson(response, (streamEvent) => {
        if (!isCurrentSession(accountId, generation)) return;
        if (streamEvent.type === "evidence_saved") {
          currentEnvelope = { ...currentEnvelope, evidenceSaved: true };
          saveRecovery(currentEnvelope, generation);
          updateMessage(
            userMessageId,
            { evidenceState: "saved" },
            accountId,
            generation,
          );
        } else if (streamEvent.type === "provider") {
          setProviderLabel(`${streamEvent.provider} · ${streamEvent.model}`);
        } else if (streamEvent.type === "delta" && streamEvent.delta) {
          setMessages((current) =>
            isCurrentSession(accountId, generation)
              ? current.map((message) =>
                  message.id === assistantMessageId
                    ? { ...message, text: message.text + streamEvent.delta }
                    : message,
                )
              : current,
          );
        } else if (streamEvent.type === "done") {
          completed = true;
          updateMessage(
            assistantMessageId,
            { status: "complete" },
            accountId,
            generation,
          );
          clearRecovery(accountId, generation);
        } else if (streamEvent.type === "error") {
          failed = true;
          updateMessage(
            assistantMessageId,
            {
              status: "failed",
              text:
                streamEvent.message ??
                "The companion could not respond. Saved evidence remains safe.",
            },
            accountId,
            generation,
          );
        }
      });

      if (isCurrentSession(accountId, generation) && !completed && !failed) {
        updateMessage(
          assistantMessageId,
          {
            status: "failed",
            text: "The response ended before completion. Saved evidence remains safe.",
          },
          accountId,
          generation,
        );
      }
    } catch (error) {
      failed = true;
      if (isCurrentSession(accountId, generation)) {
        updateMessage(
          assistantMessageId,
          {
            status: "failed",
            text:
              error instanceof DOMException && error.name === "AbortError"
                ? "The response was stopped. Saved evidence remains safe."
                : "The companion could not respond. Retry with the same message identity.",
          },
          accountId,
          generation,
        );
      }
    } finally {
      if (isCurrentSession(accountId, generation)) {
        if (abortRef.current === abortController) abortRef.current = null;
        setIsStreaming(false);
        if (!completed) setRecovery(currentEnvelope);
      }
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sessionAccountId !== authenticatedAccountId || !draft.trim()) return;
    void send(
      newEnvelope(
        authenticatedAccountId,
        draft,
        remember ? "observation" : "transient",
      ),
    );
  }

  const sessionReady = sessionAccountId === authenticatedAccountId;
  const visibleMessages = sessionReady ? messages : neutralThread();
  const visibleRecovery = sessionReady ? recovery : null;
  const visibleStreaming = sessionReady && isStreaming;

  return (
    <section className={styles.dialogue} aria-labelledby="companion-title">
      <header className={styles.heading}>
        <div>
          <span>One companion</span>
          <h1 id="companion-title">Dialogue</h1>
        </div>
        {sessionReady && providerLabel ? <small>{providerLabel}</small> : null}
      </header>

      <ol className={styles.thread} aria-live="polite">
        {visibleMessages.map((message) => (
          <li className={styles[message.role]} key={message.id}>
            <span>{message.role === "assistant" ? "Companion" : "You"}</span>
            <p>{message.text || "…"}</p>
            {message.evidenceState ? (
              <small>{message.evidenceState}</small>
            ) : null}
            {message.status === "streaming" ? <small>responding</small> : null}
            {message.status === "failed" ? <small>incomplete</small> : null}
          </li>
        ))}
      </ol>

      <form className={styles.composer} onSubmit={submit}>
        <label htmlFor="dialogue-text">Message</label>
        <textarea
          id="dialogue-text"
          disabled={!sessionReady}
          maxLength={4000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Tell your companion what is happening…"
          readOnly={Boolean(visibleRecovery)}
          rows={3}
          value={sessionReady ? draft : ""}
        />
        <label className={styles.remember}>
          <input
            checked={remember}
            disabled={!sessionReady || Boolean(visibleRecovery)}
            onChange={(event) => setRemember(event.target.checked)}
            type="checkbox"
          />
          Remember my exact message as an observation
        </label>
        <p>
          Unchecked messages and companion replies are ephemeral. No full
          conversation archive is created.
        </p>
        <div className={styles.actions}>
          {visibleRecovery && !visibleStreaming ? (
            <button
              onClick={() => void send(visibleRecovery, true)}
              type="button"
            >
              Retry companion
            </button>
          ) : sessionReady && !visibleStreaming ? (
            <button disabled={!draft.trim()} type="submit">
              Send
            </button>
          ) : null}
          {visibleStreaming ? (
            <button
              className={styles.secondary}
              onClick={() => abortRef.current?.abort()}
              type="button"
            >
              Stop
            </button>
          ) : null}
          {visibleRecovery && !visibleStreaming ? (
            <button
              className={styles.secondary}
              onClick={() => {
                clearRecovery(
                  authenticatedAccountId,
                  sessionGenerationRef.current,
                );
                setDraft("");
              }}
              type="button"
            >
              Clear retry
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
