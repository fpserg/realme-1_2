"use client";

import { useEffect, useRef, useState } from "react";

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
  const [messages, setMessages] = useState<ThreadMessage[]>([
    {
      id: "companion-welcome",
      role: "assistant",
      status: "complete",
      text: "I’m here. Tell me what is happening, or ask me to think with you.",
    },
  ]);
  const [recovery, setRecovery] = useState<RecoveryEnvelope | null>(null);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const recovered = readRecovery(authenticatedAccountId);
      if (!recovered) return;
      setRecovery(recovered);
      setDraft(recovered.text);
      setRemember(recovered.persistence === "observation");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authenticatedAccountId]);

  function saveRecovery(envelope: RecoveryEnvelope) {
    if (envelope.accountId !== authenticatedAccountId) return;
    window.localStorage.setItem(
      companionRecoveryKey(authenticatedAccountId),
      JSON.stringify(envelope),
    );
    setRecovery(envelope);
  }

  function clearRecovery() {
    window.localStorage.removeItem(
      companionRecoveryKey(authenticatedAccountId),
    );
    setRecovery(null);
  }

  function updateMessage(id: string, update: Partial<ThreadMessage>) {
    setMessages((current) =>
      current.map((message) =>
        message.id === id ? { ...message, ...update } : message,
      ),
    );
  }

  async function send(envelope: RecoveryEnvelope, retry = false) {
    if (abortRef.current) return;
    const userMessageId = retry ? "retry-user" : crypto.randomUUID();
    const assistantMessageId = retry ? "retry-assistant" : crypto.randomUUID();

    if (retry) {
      setMessages((current) => [
        ...current.filter(
          (message) =>
            message.id !== "retry-user" && message.id !== "retry-assistant",
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
      ]);
    } else {
      setMessages((current) => [
        ...current,
        {
          evidenceState:
            envelope.persistence === "transient" ? "ephemeral" : "unsynced",
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
      ]);
    }

    saveRecovery(envelope);
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
        if (streamEvent.type === "evidence_saved") {
          currentEnvelope = { ...currentEnvelope, evidenceSaved: true };
          saveRecovery(currentEnvelope);
          updateMessage(userMessageId, { evidenceState: "saved" });
        } else if (streamEvent.type === "provider") {
          setProviderLabel(`${streamEvent.provider} · ${streamEvent.model}`);
        } else if (streamEvent.type === "delta" && streamEvent.delta) {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessageId
                ? { ...message, text: message.text + streamEvent.delta }
                : message,
            ),
          );
        } else if (streamEvent.type === "done") {
          completed = true;
          updateMessage(assistantMessageId, { status: "complete" });
          clearRecovery();
        } else if (streamEvent.type === "error") {
          failed = true;
          updateMessage(assistantMessageId, {
            status: "failed",
            text:
              streamEvent.message ??
              "The companion could not respond. Saved evidence remains safe.",
          });
        }
      });

      if (!completed && !failed) {
        updateMessage(assistantMessageId, {
          status: "failed",
          text: "The response ended before completion. Saved evidence remains safe.",
        });
      }
    } catch (error) {
      failed = true;
      updateMessage(assistantMessageId, {
        status: "failed",
        text:
          error instanceof DOMException && error.name === "AbortError"
            ? "The response was stopped. Saved evidence remains safe."
            : "The companion could not respond. Retry with the same message identity.",
      });
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
      if (!completed) setRecovery(currentEnvelope);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    void send(
      newEnvelope(
        authenticatedAccountId,
        draft,
        remember ? "observation" : "transient",
      ),
    );
  }

  return (
    <section className={styles.dialogue} aria-labelledby="companion-title">
      <header className={styles.heading}>
        <div>
          <span>One companion</span>
          <h1 id="companion-title">Dialogue</h1>
        </div>
        {providerLabel ? <small>{providerLabel}</small> : null}
      </header>

      <ol className={styles.thread} aria-live="polite">
        {messages.map((message) => (
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
          maxLength={4000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Tell your companion what is happening…"
          readOnly={Boolean(recovery)}
          rows={3}
          value={draft}
        />
        <label className={styles.remember}>
          <input
            checked={remember}
            disabled={Boolean(recovery)}
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
          {recovery && !isStreaming ? (
            <button onClick={() => void send(recovery, true)} type="button">
              Retry companion
            </button>
          ) : !isStreaming ? (
            <button disabled={!draft.trim()} type="submit">
              Send
            </button>
          ) : null}
          {isStreaming ? (
            <button
              className={styles.secondary}
              onClick={() => abortRef.current?.abort()}
              type="button"
            >
              Stop
            </button>
          ) : null}
          {recovery && !isStreaming ? (
            <button
              className={styles.secondary}
              onClick={() => {
                clearRecovery();
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
