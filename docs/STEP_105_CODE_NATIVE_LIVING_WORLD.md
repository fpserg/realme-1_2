# Step 105 — Code-Native Living World

Version: 0.2

Status: OPEN / IMPLEMENTATION CORRECTION CANDIDATE / NOT ACCEPTED

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

`living-world-code-v1` is a pure TypeScript renderer. At the currently accepted
canonical boundary it:

- identifies visible structural roots only from admitted `classification = Realm`
  assertions;
- preserves Realm ontology-node UUIDs as visual primitive identities;
- gives generic admitted ontology relationships no structural-containment
  authority;
- does not infer descendants, depth or hierarchy from relationship direction or
  predicate spelling;
- does not treat `contains`, `parent_of`, `part_of`, `belongs_to` or any other
  predicate string as containment merely by intuition;
- sorts admitted Realm roots by stable ID before composition;
- places admitted Realm roots deterministically at depth zero;
- leaves Worlds without an admitted Realm visually sparse;
- uses active canonical aliases only as presentation labels and a deterministic
  `Unlabeled structure` fallback when no alias exists;
- emits a deterministic structural hash together with the explicit renderer
  version as derivative provenance.

Generic admitted relationships may remain present in canonical projection input
for future evolution, but they currently create neither visible Living World
edges nor structural descendants. In particular, an otherwise invisible
non-Realm node is never exposed merely because an admitted relationship points
to it.

Sparse Realm-root-only output is constitutionally correct at this stage. It is
not a degraded fallback. The accepted canonical model has not yet established a
universally authorized containment semantic beneath Realm, and Step 105 does not
invent one to make the World look richer.

## Dormant arbitrary-depth capability

The renderer contract already accepts generic canonical nodes and relationships,
so a future accepted structural-containment law can supply lower structural
visibility without replacing the Living World projection boundary, stable node
identity, renderer provenance or code-native composition architecture.

Arbitrary-depth projection is therefore an architectural capability, not a
fabricated current ontology. Domain, Locus and any other lower tier remain
personal/discoverable rather than universal renderer ranks.

## Identity-preserving evolution

A label change or admitted reclassification may alter the generated projection
without changing the canonical node UUID. In the current slice, a node becomes a
visible structural root only when its active admitted classification is Realm;
reclassification away from Realm removes that derivative root without replacing
its canonical identity.

Generic relationship additions, removals, chains, cycles or direction changes do
not currently alter structural visibility or depth because no accepted universal
containment law authorizes them to do so.

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
code-native Realm primitives and labels. It exposes renderer version, stable
structural hash and canonical IDs in the DOM for verification. It is
intentionally not the Step 106 integrated perceivable experience, an authored
World Viewer or a map editor.

## Explicit exclusions

Step 105 does not implement generated imagery, final visual polish, Sergey's
pilot migration, drag-and-drop restructuring, map editing, autonomous ontology
changes, policy admission, notifications, calendar features, production rollout
or the deferred production `public.rls_auto_enable()` remediation.

Step 106+ remains NOT AUTHORIZED.
