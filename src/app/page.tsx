import Link from "next/link";

import {
  listCandidateReviews,
  type CandidateReviewItem,
} from "@/application/admission/admission";
import { listOperationalCommitments } from "@/application/commitment/list-operational-commitments";
import { reconcileObservationInterpretations } from "@/application/interpretation/enqueue-interpretation";
import { getLivingWorld } from "@/application/living-world/get-living-world";
import { listObservationHistory } from "@/application/observation/observation-capture";
import {
  loadTemporalContinuity,
  type TemporalContextView,
} from "@/application/time/temporal-continuity";
import { getCurrentWorld } from "@/application/world/get-current-world";
import type { CommitmentProjectionItem } from "@/domain/commitment/commitment";
import type { LivingWorldProjection } from "@/domain/living-world/living-world";
import type { ObservationHistoryItem } from "@/domain/observation/observation";
import { SupabaseAdmissionRepository } from "@/infrastructure/supabase/admission-repository";
import { SupabaseCommitmentProjectionRepository } from "@/infrastructure/supabase/commitment-projection-repository";
import { readSupabasePublicConfig } from "@/infrastructure/supabase/environment";
import { SupabaseInterpretationEnqueueRepository } from "@/infrastructure/supabase/interpretation-enqueue-repository";
import { SupabaseLivingWorldRepository } from "@/infrastructure/supabase/living-world-repository";
import { SupabaseObservationRepository } from "@/infrastructure/supabase/observation-repository";
import { SupabaseTemporalRepository } from "@/infrastructure/supabase/temporal-repository";
import { SupabaseWorldAccessRepository } from "@/infrastructure/supabase/world-access-repository";

import { createSupabaseServerClient } from "./_supabase/server";
import { logout } from "./auth/actions";
import { CandidateReview } from "./candidate-review";
import { CompanionDialogue } from "./companion-dialogue";
import { LivingWorld } from "./living-world";
import { ObservationCapture } from "./observation-capture";
import { OperationalProjections } from "./operational-projections";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type HomeState =
  | { kind: "configuration-needed" }
  | { kind: "provisioning-error" }
  | {
      accountId: string;
      candidates: CandidateReviewItem[];
      horizon: CommitmentProjectionItem[];
      kind: "ready";
      livingWorld: LivingWorldProjection;
      observations: ObservationHistoryItem[];
      temporal: TemporalContextView;
      today: CommitmentProjectionItem[];
    }
  | { kind: "signed-out" };

function AuthorityGuide() {
  return (
    <aside className={styles.authorityGuide} aria-labelledby="authority-title">
      <div>
        <span className={styles.eyebrow}>How to read RealMe</span>
        <h2 id="authority-title">One loop, four authority states</h2>
      </div>
      <dl>
        <div>
          <dt>You said</dt>
          <dd>Saved observation and evidence. It is not an interpretation.</dd>
        </div>
        <div>
          <dt>RealMe interpreted</dt>
          <dd>Candidate understanding. It remains non-canonical until you decide.</dd>
        </div>
        <div>
          <dt>You admitted</dt>
          <dd>Canonical World understanding created only through explicit review.</dd>
        </div>
        <div>
          <dt>Projected</dt>
          <dd>Today, Horizon and the Living World are rebuildable views, not truth stores.</dd>
        </div>
      </dl>
    </aside>
  );
}

function InterpretationSummary({
  candidates,
  observations,
}: {
  candidates: CandidateReviewItem[];
  observations: ObservationHistoryItem[];
}) {
  if (candidates.length > 0) {
    return (
      <section className={styles.loopStatus} aria-labelledby="interpretation-status-title">
        <span className={styles.statusDot} aria-hidden="true" />
        <div>
          <span className={styles.eyebrow}>Interpretation</span>
          <h2 id="interpretation-status-title">Review is ready</h2>
          <p>
            {candidates.length} unresolved {candidates.length === 1 ? "candidate is" : "candidates are"} waiting. Nothing becomes canonical until you explicitly accept or correct it.
          </p>
          <a href="#review">Go to review</a>
        </div>
      </section>
    );
  }

  if (observations.length > 0) {
    return (
      <section className={styles.loopStatus} aria-labelledby="interpretation-status-title">
        <span className={styles.statusDot} aria-hidden="true" />
        <div>
          <span className={styles.eyebrow}>Interpretation</span>
          <h2 id="interpretation-status-title">No review is ready</h2>
          <p>
            Your observations are saved. Interpretation may still be pending, or it may have produced no unresolved candidate. RealMe does not claim completion before the durable pipeline exposes review work.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.loopStatus} aria-labelledby="interpretation-status-title">
      <span className={styles.statusDot} aria-hidden="true" />
      <div>
        <span className={styles.eyebrow}>Interpretation</span>
        <h2 id="interpretation-status-title">Nothing to interpret yet</h2>
        <p>Capture an observation first. Empty state is preserved without invented understanding.</p>
        <a href="#capture">Capture an observation</a>
      </div>
    </section>
  );
}

export function HomeView({ state }: { state: HomeState }) {
  if (state.kind === "ready") {
    return (
      <main className={styles.appMain}>
        <header className={styles.appHeader}>
          <div>
            <span className={styles.eyebrow}>RealMe</span>
            <h1>Your World, from evidence to understanding</h1>
            <p>Capture what happened, review what RealMe inferred, and move through admitted understanding and projections without mixing their authority.</p>
          </div>
          <form action={logout}>
            <button className={styles.secondaryAction} type="submit">
              Sign out
            </button>
          </form>
        </header>

        <nav className={styles.primaryNav} aria-label="RealMe core loop">
          <a href="#capture">Capture</a>
          <a href="#companion">Companion</a>
          <a href="#review">Review</a>
          <a href="#projections">Today & Horizon</a>
          <a href="#world">World</a>
        </nav>

        <AuthorityGuide />
        <InterpretationSummary
          candidates={state.candidates}
          observations={state.observations}
        />

        <div className={styles.appSections}>
          <section id="capture" className={styles.integratedSection} aria-label="Capture and continuity">
            <div className={styles.sectionIntro}>
              <span className={styles.sequence}>01</span>
              <div>
                <h2>Capture what happened</h2>
                <p>Persistence comes first. Unsynced recovery stays account-scoped until the server confirms the observation.</p>
              </div>
            </div>
            <ObservationCapture
              authenticatedAccountId={state.accountId}
              initialTemporalContext={state.temporal}
              initialObservations={state.observations}
              key={`capture-${state.accountId}`}
            />
          </section>

          <section id="companion" className={styles.integratedSection} aria-label="Companion">
            <div className={styles.sectionIntro}>
              <span className={styles.sequence}>02</span>
              <div>
                <h2>Talk with your companion</h2>
                <p>Dialogue can help you reflect and capture material, but conversation itself does not become canonical World truth.</p>
              </div>
            </div>
            <CompanionDialogue
              authenticatedAccountId={state.accountId}
              key={`dialogue-${state.accountId}`}
            />
          </section>

          <section id="review" className={styles.integratedSection} aria-label="Interpretation review and admission">
            <div className={styles.sectionIntro}>
              <span className={styles.sequence}>03</span>
              <div>
                <h2>Review interpretation</h2>
                <p>Accept, reject, correct or defer unresolved candidates. Canonical change requires your explicit admission action.</p>
              </div>
            </div>
            <CandidateReview initialCandidates={state.candidates} />
          </section>

          <section id="projections" className={styles.integratedSection} aria-label="Operational projections">
            <div className={styles.sectionIntro}>
              <span className={styles.sequence}>04</span>
              <div>
                <h2>Act from projections</h2>
                <p>Today and Horizon are rebuildable operational views derived from admitted facts and authoritative time.</p>
              </div>
            </div>
            <OperationalProjections horizon={state.horizon} today={state.today} />
          </section>

          <section id="world" className={styles.integratedSection} aria-label="World understanding">
            <div className={styles.sectionIntro}>
              <span className={styles.sequence}>05</span>
              <div>
                <h2>See admitted World understanding</h2>
                <p>The Living World is a disposable visual projection. At the current canonical boundary it shows admitted Realm roots only; sparse output is truthful.</p>
              </div>
            </div>
            <LivingWorld projection={state.livingWorld} />
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <section className={styles.panel} aria-labelledby="world-title">
        <span className={styles.eyebrow}>RealMe</span>
        <h1 id="world-title">A private World begins here.</h1>
        <p>
          Sign in to receive one private World and one companion. Your World begins unformed, without a generic map or imposed roster.
        </p>

        {state.kind === "signed-out" ? (
          <Link className={styles.primaryAction} href="/login">
            Sign in or create account
          </Link>
        ) : null}

        <dl className={styles.status}>
          <div>
            <dt>Experience</dt>
            <dd>Evidence → review → admitted understanding → projections</dd>
          </div>
          <div>
            <dt>World access</dt>
            <dd>
              {state.kind === "configuration-needed"
                ? "Build not configured"
                : state.kind === "provisioning-error"
                  ? "Provisioning check failed"
                  : "Authentication required"}
            </dd>
          </div>
          <div>
            <dt>Admission authority</dt>
            <dd>User only</dd>
          </div>
          <div>
            <dt>Projection authority</dt>
            <dd>Derived only</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

export default async function HomePage() {
  if (!readSupabasePublicConfig()) {
    return <HomeView state={{ kind: "configuration-needed" }} />;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || typeof userId !== "string") {
    return <HomeView state={{ kind: "signed-out" }} />;
  }

  let state: HomeState;

  try {
    const repository = new SupabaseWorldAccessRepository(supabase);
    const access = await getCurrentWorld(userId, repository);
    const observationRepository = new SupabaseObservationRepository(supabase);
    const observations = await listObservationHistory(
      userId,
      observationRepository,
    );
    await reconcileObservationInterpretations(
      userId,
      new SupabaseInterpretationEnqueueRepository(supabase),
    );
    const candidates = await listCandidateReviews(
      userId,
      new SupabaseAdmissionRepository(supabase),
    );
    const commitments = await listOperationalCommitments(
      new SupabaseCommitmentProjectionRepository(supabase),
    );
    const livingWorld = await getLivingWorld(
      access.worldId,
      new SupabaseLivingWorldRepository(supabase),
    );
    const temporalRepository = new SupabaseTemporalRepository(supabase);
    const temporal = await loadTemporalContinuity(
      userId,
      observations,
      temporalRepository,
    );
    state = {
      accountId: userId,
      candidates,
      horizon: commitments.horizon,
      kind: "ready",
      livingWorld,
      observations: temporal.observations,
      temporal: {
        currentPeriod: temporal.currentPeriod,
        setting: temporal.setting,
      },
      today: commitments.today,
    };
  } catch {
    state = { kind: "provisioning-error" };
  }

  return <HomeView state={state} />;
}
