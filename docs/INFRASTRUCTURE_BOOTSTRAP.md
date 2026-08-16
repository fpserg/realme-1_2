# RealMe 1.2 — Infrastructure Bootstrap

Version: 0.1  
Status: STEP 96 CANDIDATE — AWAITING WARDEN ACCEPTANCE  
Defaults accepted by: Warden  
Defaults accepted on: 2026-08-16

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

## 8. Validation gates

Every pull request must pass:

1. formatting;
2. ESLint;
3. strict TypeScript;
4. architecture-boundary validation;
5. unit and component tests;
6. production build;
7. mobile-viewport Playwright smoke test.

The health route discloses only service and build-phase state. It does not query dependencies or expose secrets.

## 9. External provisioning gate

Repository readiness does not create external resources. Before provisioning, the Warden must confirm:

- Netlify account/team and site name;
- Supabase account/organization, project names and EU region;
- preview/staging strategy and cost boundary;
- secret custodianship;
- production domain.

## 10. Acceptance boundary

This is a Step 96 candidate. Accepted defaults authorize its construction but do not constitute acceptance of the resulting bootstrap.

Step 96 completes only after the Warden reviews the verified candidate and explicitly says `Accept 96`.
