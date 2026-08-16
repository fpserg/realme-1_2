# RealMe 1.2 — Legacy 1.1 Salvage Map

Version: 1.0  
Status: ACCEPTED — STEP 95 COMPLETE  
Accepted by: Warden  
Accepted on: 2026-08-16  
Next step: Step 96 — NOT STARTED

## 1. Purpose and authority

This record classifies every file in the frozen RealMe 1.1 prototype before any legacy implementation is allowed to enter RealMe 1.2.

It applies the accepted requirements in:

- [`FOUNDING_SYNTHESIS.md`](FOUNDING_SYNTHESIS.md);
- [`FOUNDING_CONSTITUTION.md`](FOUNDING_CONSTITUTION.md);
- [`NATIVE_ARCHITECTURE_CONSTITUTION.md`](NATIVE_ARCHITECTURE_CONSTITUTION.md);
- [`PRODUCT_DECISIONS/PD-001_MODULAR_LIVING_WORLD_GENERATION.md`](PRODUCT_DECISIONS/PD-001_MODULAR_LIVING_WORLD_GENERATION.md).

Source examined:

- repository: `fpserg/realme-mvp-1_1`;
- branch: `frozen/realme-mvp-1_1-final`;
- commit: `e3556d1c89b7df20fef4d7bf05f0fd9bed7db5eb`;
- tree: `ac72a1a1de37ad5d2ece0e4b499772d83b072145`;
- inventory: 105 files.

Architecture target examined:

- repository: `fpserg/realme-1_2`;
- accepted Step 94 commit: `f7d52461791e5536178edef5ae060fdc7e7e9a43`.

Step 95 changes no application code or visual asset. It determines what later work may preserve, rewrite, discard or investigate.

## 2. Classification law

- **TRANSPLANT** — useful and structurally compatible implementation that may move with limited integration changes.
- **ADAPT** — valuable concept, behaviour or interaction whose implementation boundary, data model or semantics must change.
- **RETIRE** — superseded, unsafe, redundant or structurally incompatible implementation that must not enter active 1.2 code.
- **RE-DISCOVER** — product purpose, semantic identity or visual authority is not sufficiently established for implementation.

Classification applies to the frozen file, not to every idea visible inside it. A RETIRE file may remain historical evidence. An ADAPT file is not permission to copy it wholesale.

## 3. Founding verdict

No 1.1 subsystem is safe to transplant wholesale.

| Classification | Files |
| --- | ---: |
| TRANSPLANT | 2 |
| ADAPT | 36 |
| RETIRE | 49 |
| RE-DISCOVER | 18 |
| **Total** | **105** |

## 4. TRANSPLANT — 2

The Warden accepted retention of Beacon branding as the Step 95 default.

- `src/components/BeaconLogo.tsx`
- `public/beacon-icon.svg`

These may move substantially unchanged, subject to normal framework integration, accessibility verification and regression checks. TRANSPLANT does not make branding a substitute for the universally personal companion identity.

## 5. ADAPT — 36

ADAPT preserves evidence and intent, not the frozen architectural boundary.

### 5.1 Constitutional and product evidence — 9

- `00_PRINCIPLES.md`
- `02_ARCHITECTURE.md`
- `03_WORLD_MODEL.md`
- `04_LI_PIPELINE.md`
- `05_RULES.md`
- `08_API.md`
- `09_STATE.md`
- `11_EMERGENT_DISCOVERY_AND_ARCHITECTURE.md`
- `REALM_ROLES.md`

Useful clauses must be reconciled with the accepted constitutions. Fixed Realm/Domain hierarchy and mandatory named Realmers remain superseded.

### 5.2 Configuration and application language — 5

- `.env.example`
- `.gitignore`
- `src/index.css`
- `src/types.ts`
- `public/manifest.json`

Only useful secret categories, ignore patterns, visual vocabulary, selected domain concepts and PWA intent survive. Existing environment names, type unions and build assumptions are not binding.

### 5.3 Product interfaces — 14

- `src/components/BookOfLifeView.tsx`
- `src/components/CalendarView.tsx`
- `src/components/ChroniclesView.tsx`
- `src/components/CommitmentCardModal.tsx`
- `src/components/Header.tsx`
- `src/components/HomePortal.tsx`
- `src/components/HorizonView.tsx`
- `src/components/LivingInputBar.tsx`
- `src/components/MobileBottomNav.tsx`
- `src/components/RealmMapView.tsx`
- `src/components/SettingsModal.tsx`
- `src/components/StewardDialogueView.tsx`
- `src/components/TodayAgendaView.tsx`
- `src/components/WorldUpdateCard.tsx`

These contain useful interaction evidence. They must be rewritten around authenticated application interfaces, personal ontology, the accepted temporal model, evidence/admission separation and mobile-safe composition.

### 5.4 Living World interaction — 1

- `src/components/fantasy-map/IsometricWorldViewer.tsx`

Preserve interaction lessons concerning pan, zoom, framing and semantic navigation. Replace its fixed atlas, hard-coded node registry, coordinates and asset assumptions with the modular Visual World Definition and code-native fallback.

### 5.5 Data and services — 7

- `src/data/initialStore.ts`
- `src/db/drizzle.config.ts`
- `src/services/anchorStore.ts`
- `src/services/artworkStore.ts`
- `src/services/modelProvider.ts`
- `src/services/temporalEngine.ts`
- `src/services/worldClock.ts`

`initialStore.ts` is historical migration evidence only. It must never become a universal production seed or an authoritative personal record.

Provider abstraction, recurrence calculations, business-day handling, IANA-time concepts, anchors and artwork-version concepts may survive only behind new contracts and characterization tests.

## 6. RETIRE — 49

RETIRE files remain available in the frozen branch as historical evidence but must not enter active 1.2 implementation.

### 6.1 Superseded documentation — 6

- `01_MVP.md`
- `06_REPO.md`
- `07_STACK.md`
- `10_ROADMAP.md`
- `AI_BUILDER.md`
- `README.md`

### 6.2 Obsolete build, entry and infrastructure — 11

- `bun.lock`
- `firestore.rules`
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `index.html`
- `metadata.json`
- `server.ts`
- `src/App.tsx`
- `src/main.tsx`
- `src/vite-env.d.ts`

The open Firestore rules are a security hazard and are specifically prohibited from reuse. The Vite/Express shell, dependency manifest and application monolith do not define the accepted Next.js modular monolith.

### 6.3 Obsolete persistence — 6

- `src/db/index.ts`
- `src/db/schema.ts`
- `src/services/firebaseService.ts`
- `src/services/lociStore.ts`
- `src/services/repository.ts`
- `src/services/worldStore.ts`

These depend on global mutable state, a single JSON/KV record, browser-local canonical state, fixed ontology or direct AI-plan execution. They cannot satisfy ownership, relational evidence, admission, history or audit boundaries.

### 6.4 Retired product surfaces — 4

- `src/components/CommandConsole.tsx`
- `src/components/SpecViewer.tsx`
- `src/components/TemporalControlBar.tsx`
- `src/components/WBTView.tsx`

The simulated clock and mandatory manual operational-day closing model are retired.

### 6.5 Fixed-atlas Living World implementation — 10

- `src/components/fantasy-map/AtlasControls.tsx`
- `src/components/fantasy-map/CommitmentModal.tsx`
- `src/components/fantasy-map/DomainCastleScreen.tsx`
- `src/components/fantasy-map/DomainLociBar.tsx`
- `src/components/fantasy-map/FantasyAtlasCanvas.tsx`
- `src/components/fantasy-map/FantasyAtlasEngine.ts`
- `src/components/fantasy-map/LociManagerModal.tsx`
- `src/components/fantasy-map/VisualGuideFlow.tsx`
- `src/components/fantasy-map/atlasImages.ts`
- `src/components/fantasy-map/mapData.ts`

These enforce fixed continents, compulsory Loci, absolute geography and a monolithic atlas contrary to personal ontology and PD-001.

### 6.6 Retired imagery — 12

- `src/assets/household_realm_island.jpg`
- `src/assets/career_realm_island.jpg`
- `src/assets/third_realm_island.jpg`
- `src/assets/fantasy_atlas_texture.jpg`
- `src/assets/fantasy_world_archipelago.jpg`
- `src/assets/fantasy_world_map.jpg`
- `src/assets/realme_monastery_domain.jpg`
- `public/fantasy_world_map.jpg`
- `public/apple-touch-icon-precomposed.png`
- `public/apple-touch-icon.png`
- `public/pwa-192.png`
- `public/pwa-512.png`

The four declared application-icon sizes are the same binary and must be regenerated correctly from an accepted source.

## 7. RE-DISCOVER — 18

### 7.1 Product surfaces — 3

- `src/components/WorldModelView.tsx`
- `src/components/fantasy-map/CustomArtworkModal.tsx`
- `src/components/fantasy-map/LandmarkDossier.tsx`

Their underlying needs may be valid, but their universal product role is not sufficiently established.

### 7.2 Visual candidates requiring Warden validation — 15

- `src/assets/beacon_app_icon.jpg`
- `src/assets/vertical_world.jpg`
- `src/assets/vertical_household.jpg`
- `src/assets/vertical_career.jpg`
- `src/assets/vertical_third.jpg`
- `src/assets/stronghold_fortress.jpg`
- `src/assets/family_village_domain.jpg`
- `src/assets/leadership_city_domain.jpg`
- `src/assets/strategy_fortress_domain.jpg`
- `src/assets/tmt_lighthouse.jpg`
- `src/assets/tower_synthesis.jpg`
- `src/assets/gifted_crystals_domain.jpg`
- `src/assets/stronghold_courtyard.jpg`
- `src/assets/castle_interior_homm.jpg`
- `src/assets/dwarf_steward_avatar.jpg`

No image becomes TRANSPLANT merely because its filename resembles a canonical master. The 1.1 registry reuses `leadership_city_domain.jpg` for two semantic locations and does not establish a trustworthy one-to-one representation of Sergey’s thirteen accepted masters.

Sergey’s accepted visual canon remains protected. Exact binaries must be mapped and validated before migration; inability to validate a 1.1 file does not reopen or weaken the canonical visual decision.

## 8. Conflicts discovered

The frozen implementation conflicts with accepted RealMe 1.2 decisions in six material areas:

1. fixed three-Realm and fixed-Domain ontology versus arbitrary personal depth;
2. mandatory named Realmer roster versus one initial companion and evidence-discovered roles;
3. manual Freeze and simulated dates versus an automatic 04:00 operational boundary and distinct temporal dimensions;
4. global JSON persistence versus relational evidence, admission, versioning and provenance;
5. direct AI mutation versus validated admission transactions;
6. monolithic painted atlas versus modular, lazy, code-native Living World composition.

These are known supersessions. No genuine contradiction requiring Step 93 or Step 94 to reopen was found.

## 9. Accepted Step 95 defaults

The Warden accepted the following defaults before accepting Step 95:

1. retain Beacon branding, allowing the two listed TRANSPLANT files;
2. retain all possible canonical visual binaries as RE-DISCOVER until manually mapped against accepted masters;
3. treat `initialStore.ts` only as historical migration evidence, never as a production seed or authoritative personal record;
4. require characterization tests before extracting any 1.1 algorithm because the frozen application contains no test suite.

## 10. Migration order

Acceptance authorizes the map, not immediate transplantation.

1. Step 96 establishes the clean infrastructure, authentication and test foundation.
2. New ontology, evidence, temporal and admission contracts are built from the constitutions.
3. Pure temporal and provider behaviour is adapted behind characterization tests and new interfaces.
4. Capture, dialogue and operational UX is adapted against authenticated application services.
5. The code-native Living World substrate is established.
6. Viewer interaction is adapted and modular visual generation is added.
7. Sergey’s data and validated canonical visual masters are imported through explicit migration tooling.
8. The frozen implementation remains available until replacement behaviour has parity evidence.

## 11. Acceptance boundary

Step 95 is complete and accepted. The classifications in this record govern later migration decisions.

Step 95 acceptance does not copy legacy code, approve any RE-DISCOVER item, authorize infrastructure changes or begin Step 96.

Step 96 may begin only through a separate explicit Warden instruction.
