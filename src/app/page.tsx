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

export function HomeView({ state }: { state: HomeState }) {
  if (state.kind === "ready") {
    return (
      <main className={styles.appMain}>
        <header className={styles.appHeader}>
          <div>
            <span className={styles.eyebrow}>RealMe 1.2 · Step 105</span>
            <p>Admitted World structure projected code-natively</p>
          </div>
          <form action={logout}>
            <button className={styles.secondaryAction} type="submit">
              Sign out
            </button>
          </form>
        </header>
        <div className={styles.appSections}>
          <LivingWorld projection={state.livingWorld} />
          <OperationalProjections horizon={state.horizon} today={state.today} />
          <CompanionDialogue
            authenticatedAccountId={state.accountId}
            key={`dialogue-${state.accountId}`}
          />
          <CandidateReview initialCandidates={state.candidates} />
          <ObservationCapture
            authenticatedAccountId={state.accountId}
            initialTemporalContext={state.temporal}
            initialObservations={state.observations}
            key={`capture-${state.accountId}`}
          />
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <section className={styles.panel} aria-labelledby="world-title">
        <span className={styles.eyebrow}>RealMe 1.2 · Step 105</span>
        <h1 id="world-title">A private World begins here.</h1>
        <p>
          Sign in to receive one private World and one companion. Your World
          begins unformed, without a generic map or imposed roster.
        </p>

        {state.kind === "signed-out" ? (
          <Link className={styles.primaryAction} href="/login">
            Sign in or create account
          </Link>
        ) : null}

        <dl className={styles.status}>
          <div>
            <dt>Current step</dt>
            <dd>104 accepted · 105 implementation candidate</dd>
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
