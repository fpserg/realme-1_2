# RealMe 1.2 — Founding Constitution

Version: 0.5  
Status: FOUNDING SEQUENCE COMPLETE / STEP 96 ACCEPTED

## 1. Purpose

RealMe 1.2 is a native application implementation of the RealMe product discovered through prior product work and prototype use.

It is not a mechanical continuation of `realme-mvp-1_1`, and it is not a literal software implementation of every operational mechanism in `fpserg/RealMe`.

The founding task is to separate:

1. enduring product truths;
2. useful prototype implementations;
3. environment-specific workarounds;
4. obsolete or falsified concepts;
5. unresolved questions that require fresh design.

The accepted Step 93 synthesis is recorded in `docs/FOUNDING_SYNTHESIS.md` and is constitutional input to subsequent architecture.

## 2. Evidence sources

### `fpserg/RealMe`

Treat as strongest evidence for:

- product meaning and terminology;
- roles and interaction philosophy;
- World Model discoveries;
- personal ontology and visual semantics;
- visual canon and semantic navigation;
- interaction principles;
- Daily Operations learnings;
- continuity requirements discovered while operating RealMe in ChatGPT.

Do not automatically treat file-based ChatGPT operations as native-app architecture.

### `fpserg/realme-mvp-1_1`

Treat as strongest evidence for:

- implemented UX that has actually been used;
- working components and interaction patterns;
- concrete data structures;
- visual/map implementation experiments;
- LLM/provider integration experiments;
- persistence and application-shell lessons;
- technical failures and architectural debt revealed by review.

1.1 is frozen at:

`e3556d1c89b7df20fef4d7bf05f0fd9bed7db5eb`

Reference branch:

`frozen/realme-mvp-1_1-final`

## 3. Authority model

No predecessor repository is absolute implementation canon.

When evidence conflicts, prefer in this order:

1. explicit current Warden decision;
2. validated product truth supported by actual RealMe use;
3. later correction or discovery over earlier assumption;
4. working prototype evidence over speculative implementation theory;
5. implementation convenience last.

Architecture must solve the native application's actual requirements rather than reproduce historical workarounds.

## 4. Founding information model

The constitutional flow is:

> Observation → Candidate Interpretation → Admission → Versioned World Model → Operational and reflective projections + Living World

RealMe preserves lived observations before their future importance is known. Observations retain dates, stable identities, aliases, exact supporting source fragments and provenance.

Interpretation remains distinct from observation. Candidate interpretations may remain non-canonical and invisible. Admitted understanding is maintained separately in a versioned World Model. Later correction supersedes earlier understanding without erasing its history.

Complete conversation preservation is optional rather than constitutionally required. Full conversations may exist as a user-owned archive, while transient or explicitly ephemeral dialogue need not be retained.

## 5. ChatGPT operational scaffolding

Mechanisms such as LI files, OR reconstruction, WBTD recovery, Freeze archival and explicit Chronicle persistence were partly created to overcome limitations of running RealMe inside a stateless or time-limited conversational environment.

Their native-app equivalents are requirements, not necessarily file formats or workflows.

Underlying requirements include:

- durable memory;
- reliable chronology and timezone awareness;
- recoverable state;
- provenance and non-destructive history;
- distinction between observed life events, candidate interpretation and admitted state;
- commitment continuity;
- periodic reflection and synthesis;
- user-visible history where valuable;
- no dependency on conversational context reconstruction for correctness.

A database, event/history model and native scheduler may satisfy these requirements more naturally than reproducing LI → OR → WBTD → Freeze files.

RealMe must not require a daily Freeze or other manual closing ritual.

## 6. Personal ontology

Realm is the only universally named tier. A personal World may contain `0..N` Realms.

Every tier below Realm is personally discoverable and may extend to arbitrary depth. Domain is a useful interpretation for a major structure within a Realm, but it is not a mandatory second tier. Locus is not a compulsory rank; in Sergey’s World it may remain a personal node role for a meaningful spatial, mnemonic or experiential anchor.

Reclassification, movement, merging or retirement must preserve stable identity, history and provenance.

The current Household / Career / Third World is the first deeply authored user instance, not a universal schema. Frozen visual and interaction work in `fpserg/RealMe` remains authoritative evidence for that personal World unless explicitly revised.

## 7. Companion and Realmers

Every new user begins with one companion and no imposed roster of Realmers.

The cognitive functions of continuity, perception, structure, meaning, challenge and curation are universally available. Named Realmers are optional, evidence-driven discoveries. A distinct cognitive office emerges only when actual use reveals a durable need.

Role names, characters and visibility are personal and require user acceptance.

Discovery is RealMe’s native form of progression. It reflects growing truthful understanding, not accumulated usage.

## 8. Temporal continuity

The default operational-day boundary is 04:00 in the user’s local timezone. It is user-configurable and may eventually adapt to stable individual behaviour.

The native time model distinguishes:

- occurred time;
- recorded time;
- local calendar date;
- operational-period membership;
- validity intervals;
- reflection periods.

Changing the operational boundary must not silently reassign historical observations. Physical chronology, calendar chronology and personal operational continuity remain distinct.

## 9. Living World

The Living World is a core RealMe capability and destination, but not a compulsory initial interface.

A new user begins with one companion and an unformed World Model. Visual geography emerges progressively from accepted personal ontology and discovered visual language. RealMe must not generate a generic World merely to fill an empty surface.

Visible geography is a viewport onto an evolving World, not its permanent boundary. When accepted ontology expands, affected views may reframe or regenerate to reveal additional territory while preserving identity, topology, provenance and visual history.

Adaptive framing at one structural level remains distinct from semantic zoom between levels. RealMe distinguishes previously latent structure, gradually emerging structure and genuinely new structure.

## 10. Graduated Evidence Law

RealMe remains conservative when declaring personal structure.

- Candidate interpretations may exist without becoming canonical or visible.
- Higher structural significance requires stronger and more varied evidence.
- Mention frequency alone is insufficient.
- Realm-level discoveries carry the highest burden of proof and always require explicit user acceptance.
- RealMe must not display empty Realm or Domain slots, discovery counts or structural completion percentages.
- A World with more nodes is not inherently more developed.
- Merging, moving or retiring structure is not regression.
- Premature classification is worse than temporary absence.

## 11. 1.1 salvage classification

Every meaningful 1.1 subsystem receives one of four statuses before migration:

### TRANSPLANT

Implementation is useful, structurally compatible and can move with limited changes.

### ADAPT

The concept or UX is valuable but the implementation boundary, data model or semantics must change.

### RETIRE

The implementation or concept is superseded, unsafe, redundant or structurally incompatible.

### RE-DISCOVER

Evidence is insufficient to make a durable 1.2 decision yet.

No large subsystem is copied wholesale merely to save time. The accepted concrete classification is recorded in `docs/LEGACY_1_1_SALVAGE_MAP.md`.

## 12. Native-app principles

RealMe 1.2 should be:

- persistent by design;
- time-aware by design;
- user-scoped by design;
- secure at server and data boundaries;
- recoverable and auditable;
- model and provider independent where practical;
- mobile-first;
- deploy-preview friendly;
- database-backed where persistence matters;
- capable of evolving personal ontology without assuming one fixed World;
- capable of preserving history without making history the runtime architecture;
- conservative about declaring personal structure;
- capable of presenting an evolving Living World without treating its rendering as canonical truth.

## 13. Development discipline

Target development workflow:

Architecture/specification → bounded implementation branch → automated build/tests → deploy preview → Architect review + Warden acceptance → merge to production branch.

Production code must not be changed directly merely because an AI agent can write to GitHub.

`main` should represent approved implementation truth once deployment begins.

## 14. Immediate founding sequence

### Step 93 — Founding synthesis — ACCEPTED

The explicit inheritance map and founding product decisions are recorded in `docs/FOUNDING_SYNTHESIS.md`.

### Step 94 — Native architecture constitution — ACCEPTED

The accepted frontend, server, database, auth, AI, memory, time, security, deployment and Living World boundaries are recorded in `docs/NATIVE_ARCHITECTURE_CONSTITUTION.md`.

### Step 95 — 1.1 salvage map — ACCEPTED

The accepted classification of all 105 frozen 1.1 files is recorded in `docs/LEGACY_1_1_SALVAGE_MAP.md`.

### Step 96 — Infrastructure bootstrap — ACCEPTED

The accepted clean application skeleton, Git workflow, CI, deployment configuration, database strategy, secret contracts and baseline tests are recorded in `docs/INFRASTRUCTURE_BOOTSTRAP.md`.

The founding sequence is complete. Substantive product implementation may now proceed only through separately scoped, bounded steps that preserve this constitution.

## 15. Acceptance records

The Warden explicitly accepted Step 93 on 2026-08-16 after Product Discovery resolved the founding questions concerning personal ontology, companion and Realmers, memory and evidence, temporal continuity, the Living World and graduated evidence.

The Warden explicitly accepted Step 94 on 2026-08-16 after accepting the six architecture defaults and incorporating the post-Step-93 modular Living World generation decision.

The Warden explicitly accepted Step 95 on 2026-08-16 after accepting the complete 105-file salvage map and its four defaults.

Step 95 acceptance freezes legacy classifications. It does not itself authorize Step 96, infrastructure implementation or legacy-code migration.

The Warden explicitly accepted Step 96 on 2026-08-16 after accepting its ten bootstrap defaults and reviewing the verified infrastructure candidate. The frozen dependency graph, formatting, linting, strict type checking, architecture-boundary validation, unit and component tests, production build and mobile Playwright smoke test all passed before acceptance.

Step 96 acceptance completes the founding sequence. It does not provision external Netlify or Supabase resources, introduce product schema, authorize personal-data migration or approve an unbounded migration of legacy product code.

## 16. Founding maxim

# INHERIT DISCOVERIES, NOT CONSTRAINTS.

# PRESERVE WORK THAT PROVED ITS VALUE, NOT WORK MERELY BECAUSE IT EXISTS.

# DESIGN THE NATIVE APP FOR THE PROBLEM REALME IS NOW KNOWN TO SOLVE.
