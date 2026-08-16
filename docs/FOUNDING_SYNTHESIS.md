# RealMe 1.2 — Founding Synthesis

Version: 0.2  
Status: ACCEPTED — STEP 93 COMPLETE  
Accepted by: Warden  
Accepted on: 2026-08-16  
Next step: Step 94 — NOT STARTED

## 1. Purpose

This synthesis records the product truths, inheritance decisions and architectural constraints accepted before RealMe 1.2 architecture is designed.

It is the Step 93 bridge between:

- the product and operational evidence in `fpserg/RealMe`;
- the frozen implementation evidence in `fpserg/realme-mvp-1_1` at `e3556d1c89b7df20fef4d7bf05f0fd9bed7db5eb`; and
- the native application to be designed in `fpserg/realme-1_2`.

The accepted founding model is:

> Observation → Candidate Interpretation → Admission → Versioned World Model → Operational and reflective projections + Living World

Observation, interpretation and admitted understanding are distinct states. No predecessor implementation is transplanted before its compatibility with this model is demonstrated.

## 2. Authority and evidence

When evidence conflicts, authority remains:

1. explicit current Warden decision;
2. validated product truth supported by actual use;
3. later correction or discovery over earlier assumption;
4. working prototype evidence over speculative implementation theory;
5. implementation convenience last.

`fpserg/RealMe` is the strongest source for product meaning, operational evidence, roles, continuity requirements and the authored visual World. `fpserg/realme-mvp-1_1` is the strongest source for implemented UX, components, data structures, integration experiments and revealed architectural debt.

Neither repository is universal implementation canon.

## 3. Accepted founding decisions

### 3.1 Personal ontology

- **Realm is the only universally named tier.** A personal World may contain `0..N` Realms.
- Every tier below Realm is personally discoverable and may extend to arbitrary depth.
- **Domain** is a useful interpretation for a major structure within a Realm, not a mandatory second tier.
- **Locus** is not a compulsory rank. In Sergey’s World it may remain a personal node role for a meaningful spatial, mnemonic or experiential anchor.
- Reclassification, movement, merging or retirement must preserve stable identity, history and provenance.
- Sergey’s Household / Career / Third World and its existing visual geography remain authoritative evidence for his authored instance, not a universal schema.

### 3.2 Companion and Realmers

- Every new user begins with one companion and no imposed roster of Realmers.
- The cognitive functions of continuity, perception, structure, meaning, challenge and curation are universally available through the experience.
- Named Realmers are optional, evidence-driven discoveries.
- A distinct role emerges only when use reveals a durable need for a separate cognitive office.
- Role name, character and visibility are personal and require user acceptance.
- Discovery is RealMe’s native form of progression: it represents growing truthful understanding, not accumulated usage.

### 3.3 Memory and evidence

- RealMe preserves lived observations before their future importance is known.
- Observations retain dates, stable identities, aliases, exact supporting source fragments and provenance.
- Interpretation remains distinct from observation.
- Admitted understanding lives separately in the World Model and is versioned.
- Later correction supersedes earlier understanding without erasing its history.
- Complete conversation preservation is optional, not constitutional.
- Full conversations may exist as a user-owned archive; transient or explicitly ephemeral dialogue need not be retained.

### 3.4 Temporal continuity

- RealMe does not require a daily Freeze or any other manual closing ritual.
- The default operational-day boundary is **04:00 in the user’s local timezone**.
- The boundary is user-configurable and may later adapt to stable individual behaviour.
- The time model distinguishes occurred time, recorded time, local calendar date, operational-period membership, validity intervals and reflection periods.
- Changing the boundary never silently reassigns historical observations.
- Physical chronology, calendar chronology and personal operational continuity remain distinct.

### 3.5 Living World

- The Living World is a core capability and destination, not a compulsory initial interface.
- A new user begins with one companion and an unformed World Model.
- Visual geography emerges progressively from accepted personal ontology and discovered visual language.
- RealMe does not generate a generic World merely to fill an empty surface.
- Visible geography is a viewport onto an evolving World, not its permanent boundary.
- When accepted ontology expands, affected views may reframe or regenerate to reveal territory while preserving identity, topology, provenance and visual history.
- Adaptive framing at one structural level remains distinct from semantic zoom between levels.
- RealMe distinguishes previously latent structure, gradually emerging structure and genuinely new structure.

## 4. Graduated Evidence Law

RealMe remains conservative when declaring personal structure.

- Candidate interpretations may exist without becoming canonical or visible.
- Higher structural significance requires stronger and more varied evidence.
- Mention frequency alone is insufficient.
- Realm-level discoveries carry the highest burden of proof and always require explicit user acceptance.
- RealMe does not display empty Realm or Domain slots, discovery counts or structural completion percentages.
- A World with more nodes is not inherently more developed.
- Merging, moving or retiring structure is not regression.
- Premature classification is worse than temporary absence.

These rules govern both AI proposals and product presentation. The system may assist discovery; it may not manufacture certainty.

## 5. Inheritance classification

The Step 93 classification concerns product concepts and subsystem directions. Step 95 will classify concrete files, modules and components.

| Evidence or subsystem | Step 93 classification | Accepted direction |
| --- | --- | --- |
| Stable identities, aliases, relationships and provenance | ADAPT | Preserve across reclassification and history. |
| Fixed `RealmArea` model and mandatory Domain/Locus hierarchy | RETIRE | Replace with Realm plus arbitrary-depth personal structure. |
| Arbitrary-depth personal-node model | RE-DISCOVER | Design its native representation in Step 94; classify implementation in Step 95. |
| Fixed Realmer roster and provider-to-role mapping | RETIRE | No universal roster; one companion initially. |
| Continuity, perception, structure, meaning, challenge and curation functions | ADAPT | Make capabilities universally available without requiring named offices. |
| Role-selection UI and character presentation | RE-DISCOVER | Roles emerge from evidence and require acceptance. |
| LI-style raw capture | ADAPT | Preserve its observational value as durable evidence records. |
| Candidate mutation or interpretation plan | ADAPT | Keep candidate state separate and subordinate to admission and evidence law. |
| Global `worldStore` / KV-style persistence | RETIRE | Replace with user-scoped native persistence boundaries. |
| Temporal and recurrence algorithms | ADAPT | Rebase on the accepted multi-dimensional time model. |
| Simulated-date hacks and manual Freeze endpoints | RETIRE | Native time continuity removes the manual closing requirement. |
| Complete conversation history as mandatory memory | RETIRE | Conversation archives are optional; evidence and admitted understanding are durable. |
| Optional user-owned conversation archive | ADAPT | Keep separate from the constitutional memory model. |
| World viewer and interaction experiments | ADAPT | Preserve proven interaction evidence without fixing a universal ontology. |
| Fixed three-level World/Realm/Domain engine | RETIRE | Semantic navigation must support personal depth. |
| Hard-coded Household/Career/Third presets | RETIRE as product schema | Preserve only as Sergey-specific migration and regression fixtures. |
| Visual anchor calibration and distinct hit/entry geometry | ADAPT | Preserve the separation of visual anchor, hit region and entry focus. |
| Artwork registry and archipelago-specific universal terminology | RETIRE | Visual language must emerge personally; implementation must not universalise one map. |
| Discovery milestones | ADAPT | Tie to accepted understanding, not engagement volume. |
| XP, node counts and completion percentages | RETIRE | They conflict with truthful, conservative discovery. |
| Custom artwork upload | RE-DISCOVER | Its role follows the native Living World architecture and user-owned visual language. |

No subsystem receives unconditional **TRANSPLANT** status in Step 93. Concrete transplant decisions are reserved for Step 95 after the native boundaries are established.

## 6. Enduring requirements inherited from ChatGPT-era operations

The LI → OR → WBTD → Freeze → Chronicle workflow is not native-app architecture. It is evidence for requirements that survive:

- durable, user-scoped memory;
- recoverable and auditable state;
- reliable chronology and timezone awareness;
- provenance and non-destructive correction;
- separation of observation, interpretation and admitted understanding;
- continuity of commitments;
- periodic reflection and synthesis;
- user-visible history where valuable;
- correctness independent of conversation reconstruction.

Native storage, event/history models, scheduling and projections may satisfy these requirements without reproducing the historical files or rituals.

## 7. Constraints inherited by Step 94

Step 94 must design architecture that:

- supports Realm plus arbitrary-depth personal ontology without imposing empty structure;
- preserves identity, provenance and versions through structural change;
- starts each user with one companion and supports optional accepted Realmer emergence;
- stores observations and admitted World Model understanding as distinct, queryable records;
- represents the accepted temporal distinctions and preserves historical operational membership;
- treats the Living World as an evolving projection over accepted ontology, not the system of record;
- separates adaptive framing from semantic zoom;
- supports conservative candidates, graduated evidence and explicit Realm acceptance;
- remains user-scoped, secure, recoverable, auditable and provider-independent where practical.

These are requirements for Step 94, not frozen technology choices.

## 8. Acceptance boundary

Step 93 is complete and accepted. This record does not begin Step 94, choose a technical stack, or author production code.

Step 94 may begin only through a separate explicit Warden instruction.

