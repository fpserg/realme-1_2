import type { LivingWorldProjection } from "@/domain/living-world/living-world";

import styles from "./living-world.module.css";

export function LivingWorld({ projection }: { projection: LivingWorldProjection }) {
  const nodeById = new Map(projection.nodes.map((node) => [node.canonicalId, node]));

  return (
    <section className={styles.panel} aria-labelledby="living-world-title">
      <div className={styles.headingRow}>
        <div>
          <span className={styles.eyebrow}>Derived visual projection</span>
          <h2 id="living-world-title">Living World</h2>
        </div>
        <span className={styles.version}>{projection.rendererVersion}</span>
      </div>

      {projection.nodes.length === 0 ? (
        <p className={styles.empty}>
          No admitted Realms yet. The World remains visually unformed.
        </p>
      ) : (
        <div className={styles.canvasWrap}>
          <svg
            aria-label="Code-native Living World structure"
            className={styles.canvas}
            role="img"
            viewBox={`0 0 ${projection.width} ${projection.height}`}
          >
            {projection.edges.map((edge) => {
              const source = nodeById.get(edge.sourceId);
              const target = nodeById.get(edge.targetId);
              if (!source || !target) return null;

              return (
                <line
                  className={styles.edge}
                  data-canonical-relationship-id={edge.canonicalRelationshipId}
                  key={edge.canonicalRelationshipId}
                  x1={source.x}
                  x2={target.x}
                  y1={source.y}
                  y2={target.y}
                >
                  <title>{edge.predicate}</title>
                </line>
              );
            })}

            {projection.nodes.map((node) => (
              <g
                data-canonical-id={node.canonicalId}
                key={node.canonicalId}
                transform={`translate(${node.x} ${node.y})`}
              >
                <circle className={node.isRealm ? styles.realm : styles.structure} r={node.isRealm ? 34 : 25} />
                <text className={styles.label} dy={node.isRealm ? 53 : 43} textAnchor="middle">
                  {node.label}
                </text>
                {node.classification ? (
                  <text className={styles.classification} dy={node.isRealm ? 68 : 58} textAnchor="middle">
                    {node.classification}
                  </text>
                ) : null}
              </g>
            ))}
          </svg>
        </div>
      )}

      <p className={styles.provenance}>
        Regenerable from admitted World state · structural hash {projection.structuralHash}
      </p>
    </section>
  );
}
