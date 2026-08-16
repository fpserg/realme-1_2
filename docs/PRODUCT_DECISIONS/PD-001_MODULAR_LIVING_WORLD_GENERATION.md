# PD-001 — Modular Living World Generation

Status: ACCEPTED PRODUCT DECISION  
Decision source: Product Discovery / Realmers — Fireside  
Recorded on: 2026-08-16  
Sequence: Post-Step-93 amendment; binding input to Step 94 and later Living World architecture  
Implementation status: NOT STARTED

## 1. Purpose and authority

This record preserves the durable Product Discovery decision concerning how personalized Living Worlds should be generated at scale.

It does not reopen or revise the accepted Step 93 Founding Synthesis. It extends the accepted Step 93 Living World principles with a scalable visual-generation model.

This decision must be read with:

- [`../FOUNDING_SYNTHESIS.md`](../FOUNDING_SYNTHESIS.md), especially Personal Ontology, Living World and the Graduated Evidence Law;
- [`../FOUNDING_CONSTITUTION.md`](../FOUNDING_CONSTITUTION.md), especially the founding information model and Living World boundary;
- [`fpserg/RealMe — REALME_WORLD_V1_CANONICAL_FREEZE.md`](https://github.com/fpserg/RealMe/blob/main/docs/PRODUCT/VISUAL/REALME_WORLD_V1_CANONICAL_FREEZE.md);
- [`fpserg/RealMe — REALME_INTERACTIVE_WORLD_TECHNICAL_CONSTITUTION_V1.md`](https://github.com/fpserg/RealMe/blob/main/docs/PRODUCT/VISUAL/REALME_INTERACTIVE_WORLD_TECHNICAL_CONSTITUTION_V1.md).

## 2. Decision

RealMe must not depend on one-shot generation of a complete, monolithic painted World Map.

The scalable universal model is a modular illustrated Living World:

1. The World Model determines what exists and what it means.
2. Stable code-controlled semantics and spatial layout determine identity, hierarchy, navigation and topology.
3. Image generation produces bounded visual units such as Realm portraits, terrain, landmarks and local scenes.
4. Code composes those units into an interactive World.
5. Dynamic state remains a separate semantic and visual layer.

The generation request should normally concern one bounded place or level rather than an entire multi-level World.

## 3. Progressive Visual Formation

A new user begins without a generic map.

Visual formation proceeds progressively:

1. An accepted Realm may first receive one constrained visual identity or portrait.
2. Deeper structures acquire their own visual representations as they are discovered.
3. A coherent World view emerges only after sufficient accepted ontology and visual language exist.
4. Visual complexity increases inward through semantic approach.
5. Higher-level views remain simpler and emphasize only the identity of their immediate discovered children.
6. Artwork is generated lazily and only for structures that currently require representation.

A mature World may therefore be richly painted, while an early World remains visually simple without being incomplete or inferior.

## 4. Structural Evolution

When accepted ontology changes:

- regenerate or recompose the smallest affected visual scope;
- preserve stable node identities;
- preserve accepted topology wherever possible;
- preserve provenance and visual version history;
- do not redraw unrelated Realms or branches automatically;
- distinguish adaptive reframing at one semantic level from navigation between semantic levels;
- never allow generated imagery to create ontology merely because an incidental feature appeared in the artwork.

A newly accepted node may cause its parent view to reframe, expand or reveal previously unseen territory. This must not require recreating the entire World.

## 5. First-Generation Requirement

RealMe should optimize for:

- first-generation truthfulness;
- first-generation aesthetic coherence;
- stable evolution;
- bounded correction cost;
- semantic clarity;
- mobile-safe interaction.

It should not optimize only for producing a spectacular first image.

The first useful visual should be narrow enough to generate reliably and stable enough to keep. Further discovery should enrich or reveal the World rather than repeatedly replace it.

## 6. Sergey Instance Boundary

Sergey’s frozen World remains canonical for his personal instance.

It is a mature, high-fidelity authored World produced from extensive validated ontology and visual discovery. It must not be simplified merely to match the universal scalable default.

Preserve:

- the frozen World and Realm masters;
- the current visual and geographic canon;
- semantic continuity across the thirteen accepted masters;
- the rule that the painting is geography and code is semantics for this instance.

Do not treat Sergey’s production process or complete painterly atlas as the minimum workflow required from every future user.

## 7. Universal Product Boundary

The universal product must not assume:

- fantasy geography;
- continents or islands;
- a complete map at onboarding;
- a fixed number of Realms or lower tiers;
- one generated image containing all personal ontology;
- that every node requires its own full-screen painted master;
- that aesthetic detail is evidence of semantic truth.

Different users may develop different visual grammars, including cities, gardens, constellations, amusement parks, buildings, abstract spaces or other discovered forms.

## 8. Fallback Requirement

The Living World must remain usable if image generation:

- fails;
- produces an unacceptable result;
- is delayed;
- is unavailable;
- has not yet accumulated enough evidence.

A stable code-native representation must therefore exist beneath generated illustration. Generated artwork enriches the World but must not be the only carrier of identity, hierarchy or navigation.

## 9. Constitutional scope clarification

No genuine contradiction was found with Step 93 or the frozen visual constitutions.

For Sergey’s accepted authored instance, the frozen World and Realm masters remain canonical geography: **the painting is the geography; the code is the semantics**. Code must not reconstruct a competing geography inside those accepted masters.

For the universal product, code-native semantics, topology and interaction form the stable substrate. Modular generated illustration may become the accepted visual geography for its bounded scope, but it is never the sole carrier of identity, hierarchy or navigation. Absence or failure of generated artwork therefore degrades richness, not correctness or usability.

The frozen Interactive World Technical Constitution governs Sergey’s current authored instance wherever its rules depend on accepted masters. Its reusable interaction laws—including stable identity, distinct anchor/hit/focus geometry, semantic navigation and separation of dynamic state—remain strong universal evidence. Fixed level names and a complete set of painted masters are not universal requirements after Step 93 and this decision.

## 10. Consequences deferred to architecture and implementation

Step 94 must define:

- the boundary between the World Model, Visual World Definition, composition system and viewer;
- the code-native fallback representation and its accessibility contract;
- versioned visual-unit, topology, composition and generation-provenance records;
- asynchronous generation, validation, acceptance, retry and failure states;
- the invalidation rule that identifies the smallest affected visual scope;
- how adaptive reframing differs technically from semantic navigation;
- how visual-language discovery remains personal and evidence-driven.

Step 95 must classify the 1.1 viewer, map data, artwork registry, anchor storage and generation interfaces against this modular model.

Later implementation must determine generation providers, prompt assembly, compositing mechanics and quality evaluation. This decision does not choose those technologies.

