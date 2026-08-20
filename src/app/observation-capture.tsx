"use client";

import { useEffect, useState } from "react";

import type {
  ObservationHistoryItem,
  PersistedCapture,
} from "@/domain/observation/observation";

import styles from "./observation-capture.module.css";

const recoveryKeyPrefix = "realme.observation.capture.v2";

interface LocalDraft {
  accountId: string;
  attempted: boolean;
  exactText: string;
  idempotencyKey: string;
  occurredLocal: string;
}

type DraftState = "failed" | "idle" | "saved" | "saving" | "unsynced";

export function observationRecoveryKey(accountId: string) {
  return `${recoveryKeyPrefix}:${accountId}`;
}

function freshDraft(
  accountId: string,
  exactText = "",
  occurredLocal = "",
): LocalDraft {
  return {
    accountId,
    attempted: false,
    exactText,
    idempotencyKey: crypto.randomUUID(),
    occurredLocal,
  };
}

function readRecoveredDraft(accountId: string) {
  const recoveryKey = observationRecoveryKey(accountId);
  const raw = window.localStorage.getItem(recoveryKey);
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<LocalDraft>;
    if (
      value.accountId !== accountId ||
      typeof value.exactText !== "string" ||
      typeof value.idempotencyKey !== "string" ||
      typeof value.occurredLocal !== "string"
    ) {
      window.localStorage.removeItem(recoveryKey);
      return null;
    }

    return {
      accountId,
      attempted: value.attempted === true,
      exactText: value.exactText,
      idempotencyKey: value.idempotencyKey,
      occurredLocal: value.occurredLocal,
    };
  } catch {
    window.localStorage.removeItem(recoveryKey);
    return null;
  }
}

function occurrenceFromLocal(value: string) {
  if (!value) return undefined;

  return {
    occurredAt: new Date(value).toISOString(),
    sourceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
}

function formatInstant(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function upsertObservation(
  current: ObservationHistoryItem[],
  observation: ObservationHistoryItem,
) {
  return [observation, ...current.filter((item) => item.id !== observation.id)];
}

export function PersistenceState({
  state,
}: {
  state: "failed" | "processing" | "saved" | "unsynced";
}) {
  return <span className={`${styles.state} ${styles[state]}`}>{state}</span>;
}

function OccurrenceEditor({
  observation,
  onCorrected,
}: {
  observation: ObservationHistoryItem;
  onCorrected: (next: ObservationHistoryItem) => void;
}) {
  const [occurredLocal, setOccurredLocal] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "failed">("idle");

  async function submitCorrection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const occurrence = occurrenceFromLocal(occurredLocal);
    if (!occurrence) return;

    setState("saving");
    try {
      const response = await fetch(
        `/api/observations/${observation.id}/occurred-time`,
        {
          body: JSON.stringify(occurrence),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        },
      );
      if (!response.ok) throw new Error("Correction was not confirmed.");

      const body = (await response.json()) as {
        correction: {
          localCalendarDate: string;
          occurredAt: string;
          sourceTimezone: string | null;
        };
      };
      onCorrected({
        ...observation,
        correctionCount: observation.correctionCount + 1,
        localCalendarDate: body.correction.localCalendarDate,
        occurredAt: body.correction.occurredAt,
        occurredPrecision: "exact",
        sourceTimezone: body.correction.sourceTimezone,
      });
      setOccurredLocal("");
      setState("idle");
    } catch {
      setState("failed");
    }
  }

  return (
    <details className={styles.correction}>
      <summary>Correct occurred time</summary>
      <form onSubmit={submitCorrection}>
        <label htmlFor={`correction-${observation.id}`}>Occurred</label>
        <input
          id={`correction-${observation.id}`}
          onChange={(event) => setOccurredLocal(event.target.value)}
          required
          type="datetime-local"
          value={occurredLocal}
        />
        <button disabled={state === "saving"} type="submit">
          {state === "saving" ? "Saving..." : "Append correction"}
        </button>
      </form>
      {state === "failed" ? (
        <p role="alert">
          Correction was not confirmed. The original is intact.
        </p>
      ) : null}
    </details>
  );
}

export function ObservationCapture({
  authenticatedAccountId,
  captureEndpoint = "/api/observations",
  historyEndpoint,
  initialObservations,
}: {
  authenticatedAccountId: string;
  captureEndpoint?: string;
  historyEndpoint?: string;
  initialObservations: ObservationHistoryItem[];
}) {
  const [draft, setDraft] = useState<LocalDraft | null>(null);
  const [draftState, setDraftState] = useState<DraftState>("idle");
  const [observations, setObservations] = useState(initialObservations);
  const activeDraft =
    draft?.accountId === authenticatedAccountId ? draft : null;
  const activeDraftState = draft === null || activeDraft ? draftState : "idle";

  useEffect(() => {
    const recoveryTimer = window.setTimeout(() => {
      setDraft(null);
      setDraftState("idle");
      const recovered = readRecoveredDraft(authenticatedAccountId);
      if (recovered?.exactText) {
        setDraft(recovered);
        setDraftState("unsynced");
      }
    }, 0);

    return () => window.clearTimeout(recoveryTimer);
  }, [authenticatedAccountId]);

  useEffect(() => {
    if (!historyEndpoint) return;

    void fetch(historyEndpoint, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("History unavailable.");
        return response.json() as Promise<{
          observations: ObservationHistoryItem[];
        }>;
      })
      .then((body) => setObservations(body.observations))
      .catch(() => undefined);
  }, [historyEndpoint]);

  function persistDraft(next: LocalDraft) {
    if (next.accountId !== authenticatedAccountId) return;

    setDraft(next);
    const recoveryKey = observationRecoveryKey(authenticatedAccountId);
    if (next.exactText.length === 0) {
      window.localStorage.removeItem(recoveryKey);
      setDraftState("idle");
      return;
    }

    window.localStorage.setItem(recoveryKey, JSON.stringify(next));
    setDraftState("unsynced");
  }

  function updateText(exactText: string) {
    persistDraft({
      ...(activeDraft ?? freshDraft(authenticatedAccountId)),
      exactText,
    });
  }

  function updateOccurredLocal(occurredLocal: string) {
    persistDraft({
      ...(activeDraft ?? freshDraft(authenticatedAccountId)),
      occurredLocal,
    });
  }

  function editAsNewCapture() {
    const next = freshDraft(
      authenticatedAccountId,
      activeDraft?.exactText,
      activeDraft?.occurredLocal,
    );
    persistDraft(next);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeDraft?.exactText.trim()) return;

    const attemptedDraft = { ...activeDraft, attempted: true };
    setDraft(attemptedDraft);
    const recoveryKey = observationRecoveryKey(authenticatedAccountId);
    window.localStorage.setItem(recoveryKey, JSON.stringify(attemptedDraft));
    setDraftState("saving");

    try {
      const response = await fetch(captureEndpoint, {
        body: JSON.stringify({
          exactText: attemptedDraft.exactText,
          idempotencyKey: attemptedDraft.idempotencyKey,
          occurrence: occurrenceFromLocal(attemptedDraft.occurredLocal),
        }),
        headers: {
          "Content-Type": "application/json",
          "X-RealMe-Recovery-Account-Id": attemptedDraft.accountId,
        },
        method: "POST",
      });
      if (!response.ok) throw new Error("Capture was not confirmed.");

      const result = (await response.json()) as PersistedCapture;
      setObservations((current) =>
        upsertObservation(current, result.observation),
      );
      window.localStorage.removeItem(recoveryKey);
      setDraft(null);
      setDraftState("saved");
    } catch {
      setDraftState("failed");
    }
  }

  return (
    <div className={styles.captureShell}>
      <section className={styles.composer} aria-labelledby="capture-title">
        <div className={styles.sectionHeading}>
          <div>
            <span>Observation</span>
            <h1 id="capture-title">What should be remembered?</h1>
          </div>
          {activeDraftState === "unsynced" || activeDraftState === "saving" ? (
            <PersistenceState state="unsynced" />
          ) : activeDraftState === "failed" ? (
            <PersistenceState state="failed" />
          ) : activeDraftState === "saved" ? (
            <PersistenceState state="saved" />
          ) : null}
        </div>

        <form onSubmit={submit}>
          <label className={styles.srOnly} htmlFor="observation-text">
            Observation text
          </label>
          <textarea
            autoFocus
            id="observation-text"
            maxLength={10000}
            onChange={(event) => updateText(event.target.value)}
            placeholder="Write what happened, exactly as you want it kept."
            readOnly={activeDraft?.attempted === true}
            rows={5}
            value={activeDraft?.exactText ?? ""}
          />

          <details className={styles.occurredTime}>
            <summary>Add occurred time</summary>
            <label htmlFor="occurred-at">When it happened</label>
            <input
              disabled={activeDraft?.attempted === true}
              id="occurred-at"
              onChange={(event) => updateOccurredLocal(event.target.value)}
              type="datetime-local"
              value={activeDraft?.occurredLocal ?? ""}
            />
          </details>

          <div className={styles.captureActions}>
            <button
              className={styles.saveButton}
              disabled={
                activeDraftState === "saving" ||
                !activeDraft?.exactText.trim().length
              }
              type="submit"
            >
              {activeDraftState === "saving"
                ? "Saving..."
                : activeDraft?.attempted
                  ? "Retry save"
                  : "Save observation"}
            </button>
            {activeDraft?.attempted ? (
              <button
                className={styles.textButton}
                onClick={editAsNewCapture}
                type="button"
              >
                Edit as new capture
              </button>
            ) : null}
          </div>
        </form>

        {activeDraftState === "failed" ? (
          <p className={styles.failure} role="alert">
            Save was not confirmed. Your exact text and retry identity remain on
            this device.
          </p>
        ) : null}
      </section>

      <section className={styles.history} aria-labelledby="history-title">
        <div className={styles.sectionHeading}>
          <div>
            <span>Evidence</span>
            <h2 id="history-title">Observation history</h2>
          </div>
          <strong>{observations.length}</strong>
        </div>
        <p className={styles.guarantee}>
          Saved evidence is durable. Later processing cannot erase it.
        </p>

        {observations.length === 0 ? (
          <p className={styles.empty}>No observations have been saved yet.</p>
        ) : (
          <ol className={styles.observationList}>
            {observations.map((observation) => (
              <li key={observation.id}>
                <div className={styles.observationMeta}>
                  <PersistenceState state="saved" />
                  <time dateTime={observation.recordedAt}>
                    Recorded {formatInstant(observation.recordedAt)} UTC
                  </time>
                </div>
                <p>{observation.exactText}</p>
                <div className={styles.occurredSummary}>
                  <span>
                    {observation.occurredAt
                      ? `Occurred ${formatInstant(observation.occurredAt)} UTC`
                      : "Occurred time not supplied"}
                  </span>
                  {observation.correctionCount > 0 ? (
                    <span>
                      {observation.correctionCount} occurrence correction
                      {observation.correctionCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
                <OccurrenceEditor
                  observation={observation}
                  onCorrected={(next) =>
                    setObservations((current) =>
                      current.map((item) =>
                        item.id === next.id ? next : item,
                      ),
                    )
                  }
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      <details className={styles.stateGuide}>
        <summary>Persistence states</summary>
        <dl>
          <div>
            <dt>
              <PersistenceState state="unsynced" />
            </dt>
            <dd>Local text has no durable server confirmation yet.</dd>
          </div>
          <div>
            <dt>
              <PersistenceState state="saved" />
            </dt>
            <dd>Exact evidence is durably stored.</dd>
          </div>
          <div>
            <dt>
              <PersistenceState state="processing" />
            </dt>
            <dd>Shown only while real downstream work is active.</dd>
          </div>
          <div>
            <dt>
              <PersistenceState state="failed" />
            </dt>
            <dd>
              An unsaved attempt remains recoverable; saved evidence remains
              safe.
            </dd>
          </div>
        </dl>
      </details>
    </div>
  );
}
