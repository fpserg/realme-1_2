# RealMe 1.2 — Founding Constitution

Version: 0.1
Status: FOUNDING / SYNTHESIS BEFORE ARCHITECTURE FREEZE

## 1. Purpose

RealMe 1.2 is a native application implementation of the RealMe product discovered through prior product work and prototype use.

It is not a mechanical continuation of `realme-mvp-1_1`, and it is not a literal software implementation of every operational mechanism in `fpserg/RealMe`.

The founding task is to separate:

1. enduring product truths;
2. useful prototype implementations;
3. environment-specific workarounds;
4. obsolete or falsified concepts;
5. unresolved questions that require fresh design.

## 2. Evidence sources

### `fpserg/RealMe`

Treat as strongest evidence for:

- product meaning and terminology;
- roles and interaction philosophy;
- World Model discoveries;
- Realm / Domain / Locus semantics;
- visual canon and semantic zoom;
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
3. later falsification/discovery over earlier assumption;
4. working prototype evidence over speculative implementation theory;
5. implementation convenience last.

Architecture must solve the native application's actual requirements rather than reproduce historical workarounds.

## 4. ChatGPT operational scaffolding

Mechanisms such as LI files, OR reconstruction, WBTD recovery, Freeze archival and explicit Chronicle persistence were partly created to overcome limitations of running RealMe inside a stateless/time-limited conversational environment.

Their native-app equivalents are requirements, not necessarily file formats or workflows.

Underlying requirements include:

- durable memory;
- reliable chronology and timezone awareness;
- recoverable state;
- provenance/history;
- distinction between observed life events and interpreted state;
- commitment continuity;
- periodic reflection/synthesis;
- user-visible history where valuable;
- no dependency on conversational context reconstruction for correctness.

A database, event/history model and native scheduler may satisfy these requirements more naturally than reproducing LI → OR → WBTD → Freeze files.

## 5. 1.1 salvage classification

Every meaningful 1.1 subsystem receives one of four statuses before migration:

### TRANSPLANT

Implementation is useful, structurally compatible and can move with limited changes.

### ADAPT

The concept/UX is valuable but the implementation boundary, data model or semantics must change.

### RETIRE

The implementation or concept is superseded, unsafe, redundant or structurally incompatible.

### RE-DISCOVER

Evidence is insufficient to make a durable 1.2 decision yet.

No large subsystem is copied wholesale merely to save time.

## 6. Native-app principles

RealMe 1.2 should be:

- persistent by design;
- time-aware by design;
- user-scoped by design;
- secure at server/data boundaries;
- recoverable and auditable;
- model/provider independent where practical;
- mobile-first;
- deploy-preview friendly;
- database-backed where persistence matters;
- capable of evolving personal ontology rather than assuming one fixed World;
- capable of preserving history without making history the runtime architecture.

## 7. World and ontology

The current Household / Career / Third World is the first deeply authored user instance, not the universal schema.

Product architecture should support evolving 0..N Realms, Domains and Loci without forcing current 3 × 3 structure on future Realmers.

For the current user's visual World, frozen visual/interaction work in `fpserg/RealMe` remains authoritative evidence unless explicitly revised.

## 8. Development discipline

Target development workflow:

Architecture/specification → bounded implementation branch → automated build/tests → deploy preview → Architect review + Warden acceptance → merge to production branch.

Production code must not be changed directly merely because an AI agent can write to GitHub.

`main` should represent approved implementation truth once deployment begins.

## 9. Immediate founding sequence

### Step 93 — Founding synthesis

Create an explicit map of what 1.2 inherits, adapts, retires or redesigns from both source repositories.

### Step 94 — Native architecture constitution

Decide frontend/server/database/auth/AI/memory/time/deployment boundaries from requirements rather than predecessor structure.

### Step 95 — 1.1 salvage map

Classify concrete files/modules/components as TRANSPLANT / ADAPT / RETIRE / RE-DISCOVER.

### Step 96 — Infrastructure bootstrap

Establish clean application skeleton, Git workflow, CI, deploy previews, database strategy, secrets and baseline tests.

Only after these steps should substantive product migration begin.

## 10. Founding maxim

# INHERIT DISCOVERIES, NOT CONSTRAINTS.

# PRESERVE WORK THAT PROVED ITS VALUE, NOT WORK MERELY BECAUSE IT EXISTS.

# DESIGN THE NATIVE APP FOR THE PROBLEM REALME IS NOW KNOWN TO SOLVE.
