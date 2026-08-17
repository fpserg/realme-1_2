# RealMe 1.2 — Step 97 Environments, Authentication and World Ownership

Version: 0.1

Status: IMPLEMENTATION CANDIDATE — NOT ACCEPTED

Opened by: Warden

Opened on: 2026-08-17

## 1. Bounded outcome

Step 97 establishes authenticated private ownership before any observation,
interpretation, ontology, temporal continuity or AI workflow exists.

The candidate delivers:

- Supabase email/password authentication through cookie-backed SSR;
- one private account identity per authenticated user;
- one stable World for each initial owner;
- explicit World membership with owner/member authorization semantics;
- one initially unnamed companion per World;
- deny-by-default Row-Level Security;
- a synthetic-only preview/staging context lock;
- a mobile-safe signed-out and authenticated ownership surface.

It does not enter Step 98. No observation, interpretation, admission, ontology,
time, job, conversation or AI-provider table exists.

## 2. Provisioned environments

The Warden authorized personal/default accounts and a zero-cost boundary.

### Supabase

- organization: `fpserg`;
- plan: Free;
- region: `eu-west-1`;
- production project: `RealMe`, preserved blank during Step 97 validation;
- staging project: `RealMe Staging`, synthetic-only;
- staging migration target: Step 97 migration only;
- staging migration recorded by Supabase as `20260817002310`;
- production migration target: none before Step 97 acceptance.

### Netlify

- team: `fpserg’s team`;
- plan: Free;
- requested site name: `realme-1-2`;
- globally assigned site name: `realme-1-2-570`;
- repository: `fpserg/realme-1_2`;
- production branch: `main`;
- repository linkage: deferred until the implementation branch and
  context-specific environment variables are ready;
- no production deployment occurred during provisioning.

## 3. Ownership model

`auth.users` remains owned by Supabase Auth. The Step 97 relational boundary is:

```text
auth.users
   │
   ├── accounts (private identity, no profile fields)
   │
   └── worlds (one initial ownership root)
          │
          ├── world_memberships
          └── companions (exactly one initially unnamed companion)
```

The auth trigger is idempotent. Re-running provisioning preserves stable World
and companion identities. No user-facing name, Realmer role or ontology is
invented during bootstrap.

## 4. Authorization law

- Anonymous roles receive no table privileges.
- Authenticated users may select only their own account identity.
- A World is visible only when the caller has a membership in it.
- A membership row is visible only to its own authenticated user.
- A companion is visible only to a member of its World.
- Browser and server application code use only the publishable key plus the
  caller's verified session.
- No service-role client exists in application runtime code.
- Client roles cannot insert, update or delete Step 97 ownership records.

The application resolves the current World from the verified JWT subject and
does not accept a caller-supplied user identity.

## 5. Environment isolation

Netlify deploy previews and branch deploys are marked `synthetic`. Runtime
configuration rejects:

- an unexpected Supabase project reference;
- preview or staging contexts not marked synthetic-only;
- Supabase hosts outside the approved local or managed Supabase boundary.

The expected project reference and publishable configuration are supplied by
context-specific platform environment variables. Secret or personal values are
not committed.

## 6. Acceptance evidence required

Before Step 97 can be presented for acceptance:

1. apply the migration to `RealMe Staging` only;
2. create two synthetic authenticated users;
3. verify each receives exactly one World and one companion;
4. verify user A cannot read user B's account, World, membership or companion
   through direct Supabase API requests;
5. verify the UI never accepts a caller-supplied World identity;
6. verify production remains unmigrated and undeployed;
7. pass `pnpm check` and the mobile Playwright smoke test;
8. obtain exact-head code review and explicit Warden acceptance.

Step 98 must not begin before that acceptance.

## 7. Verification record

Verified on 2026-08-17 against `RealMe Staging`:

- four expected public tables exist and all have RLS enabled;
- all account/user, World/user, membership/user and child/World foreign keys
  exist;
- Supabase security advisors reported zero findings;
- two disposable synthetic Auth identities each received exactly one account,
  one distinct World, one owner membership and one distinct companion;
- four targeted cross-World reads through the publishable-key REST API returned
  zero rows;
- a direct authenticated World insert was denied;
- deleting the two synthetic Auth identities cascade-removed every test account,
  World, membership and companion, leaving all four tables at zero rows;
- production still had zero public product tables and zero migrations.

Local formatting, ESLint, strict TypeScript, architecture enforcement, all 13
unit/enforcement tests and the production build passed. The local Playwright
browser download was blocked because the isolated runner's future-dated clock
caused the CDN certificate to appear not yet valid. Browser execution therefore
remains an exact-head GitHub CI requirement; TLS validation was not weakened.
