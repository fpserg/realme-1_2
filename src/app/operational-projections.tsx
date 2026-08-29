import type { CommitmentProjectionItem } from "@/domain/commitment/commitment";

import styles from "./operational-projections.module.css";

function ProjectionList({
  empty,
  items,
}: {
  empty: string;
  items: CommitmentProjectionItem[];
}) {
  if (items.length === 0) {
    return <p className={styles.empty}>{empty}</p>;
  }

  return (
    <ol className={styles.list}>
      {items.map((item) => (
        <li className={styles.item} key={item.commitmentId}>
          <div>
            <strong>{item.title}</strong>
            <span>{item.dueLocalDate}</span>
          </div>
          {item.isStale ? <small>Overdue</small> : null}
        </li>
      ))}
    </ol>
  );
}

export function OperationalProjections({
  horizon,
  today,
}: {
  horizon: CommitmentProjectionItem[];
  today: CommitmentProjectionItem[];
}) {
  return (
    <section
      className={styles.panel}
      aria-labelledby="commitment-projections-title"
    >
      <header>
        <span className={styles.eyebrow}>Operational projection</span>
        <h2 id="commitment-projections-title">Commitments</h2>
        <p>
          Derived from admitted World facts. Projection state is disposable.
        </p>
      </header>
      <div className={styles.columns}>
        <section aria-labelledby="commitment-today-title">
          <h3 id="commitment-today-title">Today</h3>
          <ProjectionList
            empty="Nothing due in the current operational day."
            items={today}
          />
        </section>
        <section aria-labelledby="commitment-horizon-title">
          <h3 id="commitment-horizon-title">Horizon · 30 days</h3>
          <ProjectionList
            empty="Nothing due in the next 30 operational dates."
            items={horizon}
          />
        </section>
      </div>
    </section>
  );
}
