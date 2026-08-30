import type { CanonicalUnderstandingItem } from "@/application/world/list-canonical-understanding";

import styles from "./page.module.css";

function displayValue(value: CanonicalUnderstandingItem["value"]) {
  return typeof value === "string" ? value : String(value);
}

export function CanonicalUnderstanding({
  items,
}: {
  items: CanonicalUnderstandingItem[];
}) {
  return (
    <section
      className={styles.canonicalUnderstanding}
      aria-labelledby="canonical-understanding-title"
    >
      <div className={styles.sectionIntro}>
        <div>
          <span className={styles.eyebrow}>You admitted · canonical</span>
          <h3 id="canonical-understanding-title">What RealMe knows</h3>
          <p>
            Current admitted understanding only. This is canonical World state,
            not an interpretation proposal and not a projection.
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className={styles.canonicalEmpty}>
          Nothing has been admitted into current World understanding yet.
        </p>
      ) : (
        <div className={styles.canonicalList}>
          {items.map((item) => (
            <article className={styles.canonicalCard} key={item.assertionId}>
              <div className={styles.canonicalFact}>
                <strong>{item.subjectLabel}</strong>
                <span>{item.predicate.replaceAll("_", " ")}</span>
                <strong>{displayValue(item.value)}</strong>
              </div>
              <p>
                Current admitted understanding · {item.admissionAction === "correct" ? "admitted correction" : "accepted by you"}
              </p>
              <details>
                <summary>Admission & evidence</summary>
                <dl>
                  <div>
                    <dt>Stable subject identity</dt>
                    <dd>{item.subjectNodeId}</dd>
                  </div>
                  <div>
                    <dt>Assertion version</dt>
                    <dd>{item.assertionId}</dd>
                  </div>
                  <div>
                    <dt>Admitted</dt>
                    <dd>{item.admittedAt}</dd>
                  </div>
                  <div>
                    <dt>Admission decision</dt>
                    <dd>{item.admissionDecisionId}</dd>
                  </div>
                  <div>
                    <dt>Source candidate</dt>
                    <dd>{item.candidateClaimId}</dd>
                  </div>
                  {item.supersedesAssertionId ? (
                    <div>
                      <dt>Supersedes assertion</dt>
                      <dd>{item.supersedesAssertionId}</dd>
                    </div>
                  ) : null}
                </dl>
                {item.evidence.length > 0 ? (
                  <div>
                    <strong>Exact evidence</strong>
                    {item.evidence.map((evidence) => (
                      <blockquote key={evidence.sourceFragmentId}>
                        {evidence.exactText}
                      </blockquote>
                    ))}
                  </div>
                ) : (
                  <p>No linked evidence fragment is available for this assertion.</p>
                )}
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
