# RealMe 1.2 — Native Architecture Constitution

Version: 1.0  
Status: ACCEPTED — STEP 94 COMPLETE  
Accepted by: Warden  
Accepted on: 2026-08-16  
Next step: Step 95 — NOT STARTED

## 1. Purpose and authority

This constitution freezes the native application boundaries for RealMe 1.2 before concrete 1.1 files, modules and components are classified for salvage.

It implements the accepted requirements in:

- [`FOUNDING_SYNTHESIS.md`](FOUNDING_SYNTHESIS.md);
- [`FOUNDING_CONSTITUTION.md`](FOUNDING_CONSTITUTION.md);
- [`PRODUCT_DECISIONS/PD-001_MODULAR_LIVING_WORLD_GENERATION.md`](PRODUCT_DECISIONS/PD-001_MODULAR_LIVING_WORLD_GENERATION.md).

Technology serves these boundaries. Later implementation may replace a provider or framework only if the constitutional separation of evidence, admission, durable understanding, projections and user authority remains intact.

## 2. Architectural form

RealMe 1.2 is a **TypeScript modular monolith** with explicit internal boundaries.

The accepted initial platform is:

- Next.js App Router and React;
- mobile-first installable Progressive Web App;
- Netlify hosting and deploy previews;
- managed Supabase in an appropriate European Union region;
- PostgreSQL, Supabase Auth and private Supabase Storage;
- Drizzle and version-controlled SQL migrations;
- server-side AI-provider abstraction;
- durable asynchronous job processing.

No Python/FastAPI service, graph database or microservice split is justified for RealMe 1.2.

## 3. Constitutional information flow

```text
User expression
      ↓
Observation persisted
      ↓
Interpretation run
      ↓
Candidate claims or changes
      ↓
Evidence and admission policy
      ↓
Versioned World Model
      ↓
Operational projections · Reflections · Living World
```

Observation, interpretation, admission and canonical understanding remain separate.

No AI model may directly mutate canonical state.

## 4. Application boundaries

The system contains five logical layers:

1. **Experience layer** — conversation, operational views and Living World.
2. **Application layer** — authenticated commands, queries and workflows.
3. **Domain layer** — ontology, evidence, admission, time and projection rules.
4. **Infrastructure adapters** — PostgreSQL, storage, AI providers and job workers.
5. **Projection layer** — operational, reflective, search and visual representations.

The domain layer must not depend on Next.js, Netlify, Supabase or a particular AI provider.

Server Actions may support web interactions, but all durable capabilities must also be accessible through authenticated application interfaces suitable for future native clients.

## 5. Ownership and tenancy

RealMe 1.2 initially supports one private owner per World.

The schema nevertheless establishes:

- users;
- Worlds;
- World memberships;
- ownership and permission boundaries.

Sharing and collaboration remain disabled until separately designed.

Every durable record belongs to a World. PostgreSQL Row-Level Security provides defence in depth, while canonical writes still pass through the application layer. Service credentials remain server-side.

## 6. Canonical persistence model

PostgreSQL is the sole canonical store.

The model includes:

- observations and exact source fragments;
- attachments and provenance;
- interpretation runs;
- candidate claims and structural proposals;
- admissions, rejections and corrections;
- ontology nodes, aliases and relationships;
- versioned assertions and validity intervals;
- commitments, recurrence rules and occurrences;
- operational and reflection periods;
- optional conversation archives;
- visual definitions, assets and generation history;
- AI-run and decision audit records.

Canonical knowledge must not be stored as one global JSON/KV document.

A relational core with graph-shaped node and relationship tables supports arbitrary ontology depth. A separate graph database is unnecessary.

Search indexes and embeddings are rebuildable derivatives, never canonical memory.

## 7. Identity and historical truth

Every meaningful entity has a stable machine identity independent of:

- name;
- alias;
- classification;
- parent;
- visual form;
- current status.

Reclassification creates new versioned assertions. It does not replace the entity.

Normal correction supersedes earlier understanding without erasing provenance. AI cannot hard-delete historical records. Explicit user-directed deletion remains a sovereignty operation and may remove data according to the product’s retention and backup policy.

## 8. Evidence and admission

Observations are persisted before interpretation begins.

Admission policy distinguishes:

- explicit observation;
- explicit durable fact;
- candidate interpretation;
- confirmed interpretation;
- unresolved information;
- rejected interpretation;
- superseded understanding.

Candidate structures may remain hidden and non-canonical.

Higher-level structure requires stronger, more varied evidence. Mention frequency alone is insufficient. Realm discovery and Realmer emergence always require explicit acceptance.

Every admission records:

- supporting evidence;
- decision basis;
- actor;
- policy version;
- model/run provenance where applicable;
- recorded and validity times.

## 9. Companion and AI architecture

A new user receives one companion.

Continuity, perception, structure, meaning, challenge and curation are internal cognitive capabilities. They are not a preinstalled roster of characters.

The AI boundary consists of:

- context assembly;
- provider routing;
- structured interpretation;
- deterministic validation;
- admission policy;
- transactional persistence;
- response generation.

RealMe-managed server keys are the default. Optional user-supplied keys may be added later.

Provider, model, prompts, schemas and run metadata are versioned. AI failure cannot lose an observation or corrupt admitted understanding.

## 10. Temporal architecture

RealMe records separately:

- occurred time;
- recorded time;
- source timezone;
- local calendar date;
- operational-period membership;
- validity intervals;
- reflection-period membership.

The default operational boundary is 04:00 local time.

Boundary settings are versioned and apply prospectively. Historical observations are never silently reassigned. Explicit correction is possible and audited.

There is no mandatory Freeze or hard daily closure. Operational periods are projections that may receive versioned late observations.

Schedulers may activate reminders or background processing, but scheduled jobs never define chronological truth.

## 11. Operational and reflective projections

Operational views are derived from canonical records and current temporal context.

They may include:

- current commitments;
- Today;
- Horizon;
- operational-period history;
- reminders;
- reflections;
- Chronicles;
- Book of Life views.

A projection may be cached or persisted for performance, but it never becomes an independent source of truth.

Reflection periods are not required to align with operational days or calendar dates.

## 12. Conversation preservation

Complete conversation archiving is **off by default** and explicitly opt-in.

Evidence-bearing source fragments remain attached to observations independently of any archive.

When enabled, conversation archives:

- remain user-owned;
- have separate retention controls;
- may be exported or deleted;
- do not become canonical understanding merely by existing.

Transient or explicitly ephemeral dialogue is not retained.

## 13. Client and connectivity

The first production client is an online-first, mobile-first PWA.

It provides:

- installability;
- responsive 9:16-first experience;
- conversation;
- operational views;
- code-native Living World navigation;
- visible synchronization state.

A minimal local outbox may preserve unsent inputs with idempotency keys and explicit unsynced status. It is not a local copy of the World Model.

Full offline synchronization and native iOS/Android clients are deferred.

## 14. Modular Living World architecture

PD-001 is binding.

```text
World Model
      ↓
Visual World Definition
      ↓
Modular composition
      ↓
World Viewer
      +
Dynamic state overlays
```

The Living World must not depend on generating one complete painted atlas.

The universal system provides:

- stable code-native identity, hierarchy, topology and navigation;
- bounded visual units for Realms, terrain, landmarks or scenes;
- lazy generation only when representation is warranted;
- higher-level compositions emphasizing immediate discovered children;
- richer detail through semantic approach;
- versioned visual assets and provenance;
- smallest-scope regeneration;
- an always-usable code-native fallback.

Generated imagery cannot create ontology.

A failed, delayed, missing or rejected image reduces visual richness, not correctness, identity or navigability.

Sergey’s thirteen accepted masters remain canonical for his authored instance. Within them, **the painting is geography and the code is semantics**. They migrate as Sergey-specific assets and regression fixtures, not universal onboarding requirements.

## 15. Visual evolution records

The architecture represents separately:

- personal visual language;
- visual units and their semantic scope;
- scene compositions;
- topology;
- visual anchors;
- hit regions;
- entry focuses;
- generation requests and providers;
- acceptance or rejection;
- version succession;
- affected-scope dependencies.

Adaptive reframing within one semantic level remains distinct from navigation between levels.

No assumption is made that every ontology node needs a full-screen image.

## 16. Jobs and external services

Potentially long operations run asynchronously:

- AI interpretation requiring extended processing;
- reflection generation;
- image generation;
- visual recomposition;
- imports and exports;
- notification delivery.

Jobs are durably recorded before execution and are:

- idempotent;
- retryable;
- observable;
- independently cancellable where practical;
- safe against duplicate delivery.

Netlify request handlers do not own durable job state. Scheduled functions may wake work, but PostgreSQL records job truth.

The exact worker host and image-generation provider are Step 96 implementation choices behind these contracts.

## 17. Deployment and environments

Development flow:

```text
Architecture/specification
→ bounded branch
→ automated checks
→ database migration validation
→ Netlify deploy preview
→ Architect review
→ Warden acceptance
→ merge
```

Environments:

- local;
- isolated pull-request preview;
- production.

Preview environments use synthetic data only. Production personal data is not copied into previews.

Secrets remain in platform secret stores. Database and object-storage recovery are handled separately.

## 18. Security and privacy

Constitutional requirements:

- least-privilege access;
- Row-Level Security on every exposed user-data table;
- server-side provider and service credentials;
- signed access to private assets;
- no personal conversation or observation content in routine logs;
- explicit export and deletion facilities;
- audited privileged operations;
- validated file types and size limits;
- protection against cross-World retrieval;
- test coverage for authorization policies.

Preview, analytics and observability systems must not receive production personal content by default.

## 19. Recovery and auditability

RealMe supports:

- database backups and point-in-time recovery where available;
- separate asset recovery;
- migration rollback or forward repair;
- idempotent reprocessing from preserved observations;
- reconstruction of projections;
- provenance inspection;
- regular restoration tests.

Derived views may be rebuilt. Admitted history must remain explainable.

## 20. Explicitly deferred

Step 94 does not decide:

- native mobile-client technology;
- full offline synchronization;
- collaborative Worlds;
- user-supplied AI-key implementation;
- AI or image-generation vendors;
- detailed visual-generation prompts;
- exact composition algorithms;
- automatic Realmer names or characters;
- concrete 1.1 file transplantation;
- infrastructure provisioning details.

These are assigned to later product decisions, Step 95 or Step 96 as appropriate.

## 21. Architectural consequences for 1.1

The following 1.1 structures are architecturally incompatible:

- global `worldStore`;
- single-table JSON/KV persistence;
- browser-local canonical state;
- fixed `RealmArea`;
- mandatory Domain/Locus ranks;
- fixed Realmer roster;
- direct AI mutation execution;
- simulated dates and manual day closure;
- complete chat history as required memory;
- hard-coded universal fantasy atlas.

Potentially valuable components and algorithms remain unclassified until Step 95.

## 22. Accepted defaults

The Warden accepted the following defaults before accepting this constitution:

1. installable mobile-first PWA first; native iOS/Android later;
2. managed Supabase/PostgreSQL in the European Union, with SQL migrations and adapter boundaries preserving portability;
3. RealMe-managed server AI keys by default; optional user-supplied keys later;
4. online-first operation with durable retry; full offline synchronization deferred;
5. one private owner per World in 1.2, with membership boundaries designed now and sharing deferred;
6. complete conversation archive off by default and explicitly opt-in.

## 23. Acceptance boundary

Step 94 is complete and accepted. This constitution freezes native architecture boundaries; it does not classify concrete 1.1 files or authorize infrastructure implementation.

Step 95 may begin only through a separate explicit Warden instruction.

