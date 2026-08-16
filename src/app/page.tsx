import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.main}>
      <section className={styles.panel} aria-labelledby="foundation-title">
        <span className={styles.eyebrow}>RealMe 1.2</span>
        <h1 id="foundation-title">The foundation is taking form.</h1>
        <p>
          This is the clean application boundary for a truthful, evolving model
          of a lived world. Product migration has not begun.
        </p>
        <dl className={styles.status}>
          <div>
            <dt>Architecture</dt>
            <dd>Modular monolith</dd>
          </div>
          <div>
            <dt>Current step</dt>
            <dd>96 accepted · 97 not started</dd>
          </div>
          <div>
            <dt>World state</dt>
            <dd>Unformed by design</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
