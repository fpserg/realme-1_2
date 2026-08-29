"use client";

import { useState } from "react";

import type {
  AdmissionAction,
  CandidateCorrection,
  CandidateReviewItem,
  CandidateScalar,
} from "@/application/admission/admission";

import styles from "./candidate-review.module.css";

function displayObject(value: CandidateReviewItem["object"]) {
  return typeof value === "string" ? value : String(value);
}

type ScalarKind = "boolean" | "number" | "string";

function scalarKind(value: unknown): ScalarKind {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  throw new Error("Unsupported scalar value.");
}

function parseScalarKind(value: string): ScalarKind {
  if (value === "string" || value === "number" || value === "boolean") {
    return value;
  }
  throw new Error("Unsupported scalar type.");
}

function parseScalar(kind: ScalarKind, value: string): CandidateScalar {
  if (kind === "string") return value;
  if (kind === "boolean") return value === "true";
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    throw new Error("Value must be a finite number.");
  return parsed;
}

export function CandidateReview({
  initialCandidates,
}: {
  initialCandidates: CandidateReviewItem[];
}) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<Record<string, string>>({});

  async function decide(
    candidate: CandidateReviewItem,
    action: AdmissionAction,
    correction?: CandidateCorrection,
  ) {
    setPending(candidate.id);
    setNotice((current) => ({ ...current, [candidate.id]: "" }));
    try {
      const response = await fetch("/api/admission/decision", {
        body: JSON.stringify({ action, candidateId: candidate.id, correction }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Admission failed.");

      if (action === "defer") {
        setNotice((current) => ({
          ...current,
          [candidate.id]: "Deferred. This candidate remains reviewable.",
        }));
      } else {
        setCandidates((current) =>
          current.filter((item) => item.id !== candidate.id),
        );
      }
      setEditing(null);
    } catch (error) {
      setNotice((current) => ({
        ...current,
        [candidate.id]:
          error instanceof Error ? error.message : "Admission failed.",
      }));
    } finally {
      setPending(null);
    }
  }

  if (candidates.length === 0) {
    return (
      <section
        className={styles.section}
        aria-labelledby="candidate-review-title"
      >
        <div className={styles.heading}>
          <span>Understanding</span>
          <h2 id="candidate-review-title">Nothing waiting for review</h2>
        </div>
        <p className={styles.empty}>
          AI interpretation stays non-canonical until you explicitly accept or
          correct it.
        </p>
      </section>
    );
  }

  return (
    <section
      className={styles.section}
      aria-labelledby="candidate-review-title"
    >
      <div className={styles.heading}>
        <span>Understanding</span>
        <h2 id="candidate-review-title">Review proposed meaning</h2>
        <p>
          Only your decision can turn a proposal into durable World Model truth.
        </p>
      </div>
      <div className={styles.cards}>
        {candidates.map((candidate) => {
          const isEditing = editing === candidate.id;
          const isPending = pending === candidate.id;
          return (
            <article className={styles.card} key={candidate.id}>
              <div className={styles.proposal}>
                <strong>{candidate.subject}</strong>
                <span>{candidate.predicate.replaceAll("_", " ")}</span>
                <strong>{displayObject(candidate.object)}</strong>
              </div>
              <p className={styles.explanation}>{candidate.explanation}</p>
              <details className={styles.evidence}>
                <summary>Evidence · {candidate.evidence.length}</summary>
                {candidate.evidence.map((evidence) => (
                  <blockquote key={evidence.sourceFragmentId}>
                    {evidence.exactText}
                  </blockquote>
                ))}
              </details>
              <p className={styles.change}>
                Accepting creates one versioned canonical assertion. A
                classification proposal may create or reclassify the same stable
                ontology identity; prior versions remain preserved.
              </p>

              {isEditing ? (
                <CorrectionForm
                  candidate={candidate}
                  disabled={isPending}
                  onCancel={() => setEditing(null)}
                  onSubmit={(correction) =>
                    void decide(candidate, "correct", correction)
                  }
                />
              ) : (
                <div className={styles.actions}>
                  <button
                    disabled={isPending}
                    onClick={() => void decide(candidate, "accept")}
                    type="button"
                  >
                    Accept
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => setEditing(candidate.id)}
                    type="button"
                  >
                    Correct
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => void decide(candidate, "defer")}
                    type="button"
                  >
                    Defer
                  </button>
                  <button
                    className={styles.reject}
                    disabled={isPending}
                    onClick={() => void decide(candidate, "reject")}
                    type="button"
                  >
                    Reject
                  </button>
                </div>
              )}
              {notice[candidate.id] ? (
                <p className={styles.notice} role="status">
                  {notice[candidate.id]}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CorrectionForm({
  candidate,
  disabled,
  onCancel,
  onSubmit,
}: {
  candidate: CandidateReviewItem;
  disabled: boolean;
  onCancel: () => void;
  onSubmit: (correction: CandidateCorrection) => void;
}) {
  const [subject, setSubject] = useState(candidate.subject);
  const [predicate, setPredicate] = useState(candidate.predicate);
  const [objectKind, setObjectKind] = useState<ScalarKind>(
    scalarKind(candidate.object),
  );
  const [objectValue, setObjectValue] = useState(
    displayObject(candidate.object),
  );
  const [valueError, setValueError] = useState("");

  return (
    <form
      className={styles.correction}
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const object = parseScalar(objectKind, objectValue);
          setValueError("");
          onSubmit({ object, predicate, subject });
        } catch (error) {
          setValueError(
            error instanceof Error
              ? error.message
              : "Corrected value is invalid.",
          );
        }
      }}
    >
      <label>
        Subject
        <input
          disabled={disabled}
          maxLength={160}
          onChange={(event) => setSubject(event.target.value)}
          required
          value={subject}
        />
      </label>
      <label>
        Durable meaning
        <input
          disabled={disabled}
          maxLength={64}
          onChange={(event) => setPredicate(event.target.value)}
          pattern="[a-z][a-z0-9_]*"
          required
          value={predicate}
        />
      </label>
      <label>
        Value type
        <select
          disabled={disabled}
          onChange={(event) => {
            try {
              const nextKind = parseScalarKind(event.target.value);
              setObjectKind(nextKind);
              if (
                nextKind === "boolean" &&
                objectValue !== "true" &&
                objectValue !== "false"
              ) {
                setObjectValue("false");
              }
              setValueError("");
            } catch (error) {
              setValueError(
                error instanceof Error
                  ? error.message
                  : "Corrected value type is invalid.",
              );
            }
          }}
          value={objectKind}
        >
          <option value="string">Text</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
        </select>
      </label>
      <label>
        Value
        {objectKind === "boolean" ? (
          <select
            disabled={disabled}
            onChange={(event) => setObjectValue(event.target.value)}
            value={objectValue === "true" ? "true" : "false"}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : (
          <input
            disabled={disabled}
            inputMode={objectKind === "number" ? "decimal" : undefined}
            maxLength={500}
            onChange={(event) => {
              setObjectValue(event.target.value);
              setValueError("");
            }}
            required
            value={objectValue}
          />
        )}
      </label>
      {valueError ? <p role="alert">{valueError}</p> : null}
      <div className={styles.actions}>
        <button disabled={disabled} type="submit">
          Admit correction
        </button>
        <button disabled={disabled} onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}
