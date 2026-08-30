# Step 105 — Code-Native Living World

Version: 0.1

Status: OPEN / IMPLEMENTATION CANDIDATE / NOT ACCEPTED

Authorized base: `9bdf2e18f4f3ec579e1dc2f3d9b4bf5be6cef67a`

## Outcome

Step 105 implements the first visible Living World as a deterministic derivative
of admitted World Model state. It introduces no canonical visual entities and no
derivative persistence.

The projection reads only active admitted ontology nodes, aliases,
classification assertions and ontology relationships for the server-selected
World. Raw observations, interpretation runs and unresolved candidates are not
projection inputs.

## Projection law

`living-world-code-v1` is a pure TypeScript renderer. It:

- identifies roots only from admitted `classification = Realm` assertions;
- preserves ontology-node UUIDs as visual primitive identities;
- preserves admitted relationship UUIDs and predicates as visual edges;
- follows admitted directed relationships to arbitrary depth without naming a
  mandatory lower tier;
- sorts canonical nodes and relationships by stable ID before composition;
- uses deterministic minimum graph distance from an admitted Realm only for
  derivative placement;
- retains every visible admitted edge rather than selecting a canonical parent;
- leaves Worlds without an admitted Realm visually sparse;
- uses active canonical aliases only as presentation labels and a deterministic
  `Unlabeled structure` fallback when no alias exists;
- emits a deterministic structural hash together with the explicit renderer
  version as derivative provenance.

Cycles, multiple incoming relationships and unusual relationship predicates are
not resolved into new ontology. The compositor merely lays out the admitted
graph and preserves its edges.

## Identity-preserving evolution

Label, classification and relationship changes alter the generated projection
without changing the canonical node UUID. Adding an admitted child extends the
visible graph while existing projected identities remain stable. Reclassifying a
node as Realm may change its derivative depth to zero; moving it through a new
active relationship may change its position; neither operation creates a visual
replacement identity.

## Regeneration

No Living World table, cache or visual-state record is introduced in Step 105.
Destroying the projection means discarding the computed TypeScript value and
SVG output. Regeneration reruns the same canonical read and pure compositor.
Tests fingerprint canonical input, discard output, regenerate it and require
structural equality while the canonical input remains byte-for-byte unchanged.

This satisfies the Step 105 architectural direction without creating a second
truth store.

## Security and authority

The page first resolves the authenticated user's World through the accepted
Step 97 World-access path. The Living World repository receives only that
server-derived World ID and applies it to every canonical read. Existing RLS is
retained as defence in depth.

The adapter performs no insert, update, delete, upsert or RPC. It reads no raw
observation, source-fragment, interpretation-run or candidate-claim table. No
new `SECURITY DEFINER` function is introduced.

## Persistence and migrations

Step 105 adds no database migration, schema object, Drizzle artifact, canonical
map table or derivative visual persistence. The accepted Step 104 migration
remains the end of the migration chain.

## Visible boundary

The authenticated home surface shows a small read-only SVG projection made of
edges, node shapes and labels. It exposes renderer version, stable structural
hash and canonical IDs in the DOM for verification. It is intentionally not the
Step 106 integrated perceivable experience, an authored World Viewer or a map
editor.

## Explicit exclusions

Step 105 does not implement generated imagery, final visual polish, Sergey's
pilot migration, drag-and-drop restructuring, map editing, autonomous ontology
changes, policy admission, notifications, calendar features, production rollout
or the deferred production `public.rls_auto_enable()` remediation.

Step 106+ remains NOT AUTHORIZED.
