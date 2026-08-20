# RealMe 1.2 — Infrastructure Bootstrap

Version: 1.0  
Status: ACCEPTED — STEP 96 COMPLETE  
Accepted by: Warden  
Accepted on: 2026-08-16  
Next phase: Step 98 — ACCEPTED / Step 99 — OPEN, IMPLEMENTATION CANDIDATE, NOT ACCEPTED

## 1. Scope

Step 96 establishes the clean application skeleton, dependency direction, package/runtime baseline, CI, deploy configuration, database migration boundary, secret contracts and baseline tests.

It does not implement observations, ontology, admission, AI interpretation, operational projections, authentication journeys, personal data migration or the Living World.

## 2. Accepted bootstrap defaults

1. Node.js 24 LTS and pnpm 11.
2. Security-supported Next.js 16.2 with React 19.2 and App Router.
3. CSS Modules and global design tokens without Tailwind.
4. Explicit `app → application → domain` dependency direction with infrastructure adapters and rebuildable projections.
5. Drizzle schema-first development with reviewed SQL migrations under `supabase/migrations`; no direct push to shared environments.
6. Supabase Queues/PGMQ with bounded Supabase Edge Function consumers and canonical RealMe job records.
7. Vitest, React Testing Library, Playwright and GitHub Actions.
8. App Router manifest and mobile-safe installable shell without offline caching.
9. Netlify’s automatically maintained OpenNext adapter without a pinned legacy plugin.
10. Repository contracts only until external Netlify and Supabase projects, names, accounts and EU region are separately authorized.

## 3. Runtime and dependency policy

- Runtime major versions are fixed in `.nvmrc`, `.node-version`, `package.json` and `netlify.toml`.
- Direct dependencies use deliberate versions and the committed pnpm lockfile freezes the complete graph.
- Dependency updates arrive through bounded Dependabot pull requests and must pass the same checks as product changes.
- The Netlify OpenNext adapter is not pinned because Netlify maintains compatibility with supported Next.js releases automatically.

## 4. Application layers

```text
Next.js app / experience
          ↓
Authenticated application commands, queries and workflows
          ↓
Pure domain rules

Infrastructure adapters → implement application/domain ports
Projections             → derived, rebuildable views
```

`scripts/check-boundaries.mjs` rejects forbidden inward dependencies before code review.

## 5. Database and environment strategy

- PostgreSQL remains the sole canonical store.
- Drizzle TypeScript schemas generate reviewable SQL migrations.
- Local Supabase uses `supabase/config.toml`.
- Pull-request previews use synthetic data only.
- Staging and production require distinct Supabase projects.
- Production migrations run through CI after explicit environment provisioning.
- No product schema or migration is introduced in Step 96.

## 6. Durable work

Supabase Queues/PGMQ is the durable transport. Canonical job records remain in the RealMe relational model and will contain ownership, job type, status, attempts, idempotency identity, provenance and timestamps.

Supabase Edge Functions consume bounded work. Long workflows must be split into resumable steps or external asynchronous-provider operations. Transport delivery never substitutes for application-level idempotency.

No concrete queue, job table or worker is introduced until its first separately reviewed use case.

## 7. Security and secrets

`.env.example` distinguishes public browser values from server-only database, administration and dispatch secrets. Real values remain in local or platform secret stores.

Baseline response headers disable framing, MIME sniffing and unnecessary camera/microphone permissions. Content Security Policy is deferred until authenticated application and provider requirements are known; a false or permissive placeholder policy would not provide meaningful protection.

### 7.1 Post-acceptance advisory policy

CI audits the complete lockfile and blocks high and critical advisories. Moderate findings require explicit attack-surface triage and remain tracked until removed; passing the severity gate is not a permanent waiver.

The 2026-08-17 hardening baseline enforces `postcss` 8.5.23 and `sharp` 0.35.0 through pnpm workspace overrides. The remaining esbuild advisory, GHSA-67mh-4wv8-2f99, is accepted temporarily because esbuild is a development-only transitive dependency of Drizzle tooling and no esbuild development server is exposed. It must be removed through a compatible dependency update and reassessed before any development tooling is exposed beyond trusted local or CI execution.

## 8. Validation gates

Every pull request must pass:

1. frozen dependency installation;
2. complete-lock high/critical advisory audit;
3. environment-secret exclusion verification;
4. formatting;
5. ESLint;
6. strict TypeScript;
7. architecture-boundary validation;
8. unit, component and enforcement-parser tests;
9. production build;
10. mobile-viewport Playwright smoke test.

The health route discloses only service and build-phase state. It does not query dependencies or expose secrets.

## 9. External provisioning gate

Repository readiness does not create external resources. Before provisioning, the Warden must confirm:

- Netlify account/team and site name;
- Supabase account/organization, project names and EU region;
- preview/staging strategy and cost boundary;
- secret custodianship;
- production domain.

## 10. Acceptance boundary

Step 96 is complete and accepted. Acceptance freezes the runtime and package baseline, dependency direction, migration discipline, durable-work boundary, repository secret contracts, deployment configuration and automated validation gates recorded here.

Acceptance does not provision external services, introduce product schema, authorize personal-data migration or begin substantive product implementation. Each subsequent implementation step requires its own bounded scope and review.
