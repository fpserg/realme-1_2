# RealMe 1.2 — Step 101 One-Companion Dialogue

Version: 0.2

Status: OPEN — IMPLEMENTATION CANDIDATE — NOT ACCEPTED

Opened by: Warden

Opened on: 2026-08-21

Risk: Tier H — first live model-provider boundary and first AI-generated user-facing experience

## 1. Bounded outcome

Step 101 introduces one useful mobile-first companion without imposing a
Realmer roster. It adds authenticated dialogue, bounded authorized context and
incremental model output while preserving the constitutional boundary:

> Dialogue can respond meaningfully but cannot mutate canonical understanding directly.

The candidate does not add companion multiplication, role discovery, durable
conversation memory, interpretation jobs, candidates, admission, commitments,
Horizon, ontology controls or Living World behavior. Step 102 has not started.

## 2. Persistence and archive behavior

The user explicitly chooses whether a message is evidence-bearing or
interaction-only. Evidence-bearing dialogue reuses the accepted Step 99
`capture_text_observation` command with its existing World-scoped idempotency
key. Exact user text is committed before provider generation and Step 100
temporal placement remains an independent retry-safe action. Provider or
placement failure cannot erase the observation.

Interaction-only user messages, assistant output and the visible thread are
ephemeral. No conversation table, transcript row or provider-backed RealMe
archive is created. The provider request sets `store: false`. A small
account-bound browser envelope may temporarily retain one uncertain or failed
turn and its idempotency key for retry. It is not canonical evidence and is
removed after successful completion or explicit clearing. An account switch
cannot surface or submit another account's envelope.

Authenticated account identity is also a hard boundary for the volatile
dialogue session. A change resets the completed thread, draft, provider label,
send/error state and recent-turn context to the neutral companion state before
the successor account can interact. Any prior-account stream is aborted and
its session generation is invalidated, so late chunks, completion, errors or
recovery writes cannot enter the successor account's UI or provider request.
Only the pending retry envelope may survive under its account-specific browser
key for later recovery by that same account. Completed turns never cross the
boundary and are not restored as transcript history; the archive remains off.

Assistant chunks are never persisted as observations, interpretation runs,
candidates, assertions, ontology, admission or canonical World Model state.

## 3. Application-owned provider boundary

Application dialogue depends on `DialogueProvider`, which exposes only:

- provider and model labels for bounded operational diagnostics;
- an authorized structured context;
- an abort signal;
- an asynchronous stream of text deltas;
- normalized configuration, timeout, unavailable, malformed and cancellation
  errors.

The first live adapter uses the OpenAI Responses API over server-side `fetch`.
The candidate configuration is explicit:

- `REALME_DIALOGUE_PROVIDER=openai`;
- `REALME_DIALOGUE_MODEL=gpt-5.4-mini-2026-03-17`;
- server-only `OPENAI_API_KEY`;
- optional server-only `OPENAI_BASE_URL`, validated as HTTPS.

No key is committed or exposed through `NEXT_PUBLIC_*`. Missing or invalid
configuration fails safely. The request disables provider-side response
storage and sends no database actor/World identity. Deploy-preview and branch
contexts select the pinned OpenAI model; Netlify supplies its managed AI
Gateway key and base URL at server runtime. Production does not select a
dialogue provider in repository configuration and remains unconfigured. The CI
provider fixture is reachable only through a dedicated E2E route guarded by
`REALME_E2E_FIXTURE=1`; the normal runtime factory rejects `fixture` as a
provider.

## 4. Authorized context assembly

The route verifies the cookie-backed Supabase claims and derives the account
and World through the accepted server/database boundaries. Browser-supplied
World, user, actor, fragment, candidate or recorded-time authority is rejected.

The Supabase evidence reader remains constrained by authenticated account and
World-scoped RLS. Context assembly can use only persisted observation history
returned by that port. It never queries candidates, admissions, audit events or
another World.

The context limits are:

- at most 8 exact evidence fragments;
- at most 4,000 characters per included prior fragment;
- at most 12,000 evidence characters in total;
- at most 6 ephemeral recent turns;
- at most 2,000 characters per recent turn and 6,000 in total;
- at most 4,000 characters in the current message.

Included evidence is never paraphrased or truncated. Every provider-facing
reference maps in request memory to the exact `source_fragments.id` and
observation identity. Database UUIDs are not sent to the provider; opaque
request-local references preserve traceability with less disclosure.

The server-owned prompt is separate from JSON-structured untrusted evidence
and recent turns. It states that evidence is data, not instruction authority,
and prohibits claims of successful canonical, admission, commitment, temporal
or setting mutation. Database/application authority—not prompt wording—remains
the security boundary.

## 5. Streaming, failure and retry

The authenticated Next.js route returns newline-delimited streaming events:

1. durable evidence confirmation or explicit transient readiness;
2. provider/model label;
3. incremental assistant deltas;
4. clean completion or bounded failure.

The client distinguishes saved evidence from an incomplete assistant reply.
Cancellation aborts the provider request where practical. Timeout, provider
unavailability, authentication/configuration failure, malformed responses and
disconnects produce a truthful failure state without raw stack traces,
credentials, provider bodies or internal request identifiers.

Retry reuses the same account-bound capture idempotency identity. The database
therefore resolves the same evidence-bearing message to the same observation
rather than creating a duplicate. Step 101 adds no durable AI job or retry
queue.

## 6. Canonical mutation prohibition

The dialogue route has no candidate, admission, assertion, ontology,
commitment or canonical-write adapter. Its only product write is the accepted
Step 99 observation command, followed by Step 100's bounded temporal placement
attempt. Model output cannot directly or indirectly invoke a canonical command.

No interpretation run or Step 102 job is created during normal dialogue. No
assistant output is presented as already admitted truth.

## 7. Verification gate

Before this candidate can be accepted it must pass:

1. formatting, ESLint, strict TypeScript and architecture boundaries;
2. Drizzle/migration consistency with no Step 101 migration;
3. provider abstraction, configuration, SSE parsing and normalized-error tests;
4. authentication, server-derived authority, context minimization and exact
   fragment-trace tests;
5. persist-first, idempotent retry, archive-off and canonical non-mutation
   regressions;
6. incremental, partial-failure and cancellation streaming tests;
7. production build and mobile Chromium success/failure paths;
8. exact ten-migration synthetic staging history, zero Auth users, zero product
   rows, 24/24 RLS and unchanged grants/advisors;
9. production confirmation of zero RealMe migrations, tables and Auth users;
10. exact-head GitHub Actions, Netlify preview, independent Inspector review
    and explicit Warden acceptance.

Production remains unmigrated. The inherited
`public.rls_auto_enable()` execution-grant remediation remains mandatory before
the first RealMe production migration and is not part of Step 101.

## 8. Candidate boundary

Step 101 is open and unaccepted. Its branch and draft PR must remain unmerged
until independent Inspector clearance and explicit Warden acceptance. Step 102
is not started and remains unauthorized.
