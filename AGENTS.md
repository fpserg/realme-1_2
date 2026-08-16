# RealMe 1.2 builder instructions

Read these records before changing architecture or product behaviour:

- `docs/FOUNDING_SYNTHESIS.md`
- `docs/FOUNDING_CONSTITUTION.md`
- `docs/NATIVE_ARCHITECTURE_CONSTITUTION.md`
- `docs/LEGACY_1_1_SALVAGE_MAP.md`
- `docs/PRODUCT_DECISIONS/PD-001_MODULAR_LIVING_WORLD_GENERATION.md`

## Non-negotiable boundaries

- Persist observations before interpretation.
- Keep observation, interpretation, admission and canonical understanding separate.
- Never allow an AI provider to mutate canonical state directly.
- Preserve stable identity, provenance and superseded history.
- Do not impose fixed Domain/Locus ranks or a fixed Realmer roster.
- Keep generated illustration separate from code-native identity and navigation.
- Keep secrets and personal content out of source, logs, fixtures and previews.

## Dependency direction

`app → application → domain`

Infrastructure implements ports owned by application or domain. Domain code does not import framework, database, Supabase, provider or UI modules. Projections are derived and are never canonical truth.

Run `pnpm check` before requesting review. Run `pnpm test:e2e` after a successful production build.
