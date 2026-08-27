import Link from "next/link";

import { listObservationHistory } from "@/application/observation/observation-capture";
import { reconcileObservationInterpretations } from "@/application/interpretation/enqueue-interpretation";
import {
  loadTemporalContinuity,
  type TemporalContextView,
} from "@/application/time/temporal-continuity";
import { getCurrentWorld } from "@/application/world/get-current-world";
import type { ObservationHistoryItem } from "@/domain/observation/observation";
import { readSupabasePublicConfig } from "@/infrastructure/supabase/environment";
import { SupabaseObservationRepository } from "@/infrastructure/supabase/observation-repository";
import { SupabaseInterpretationEnqueueRepository } from "@/infrastructure/supabase/interpretation-enqueue-repository";
import { SupabaseTemporalRepository } from "@/infrastructure/supabase/temporal-repository";
import { SupabaseWorldAccessRepository } from "@/infrastructure/supabase/world-access-repository";

import { createSupabaseServerClient } from "./_supabase/server";
import { logout } from "./auth/actions";
import { CompanionDialogue } from "./companion-dialogue";
import { ObservationCapture } from "./observation-capture";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type HomeState =
  | { kind: "configuration-needed" }
  | { kind: "provisioning-error" }
  | {
      accountId: string;
      kind: "ready";
      observations: ObservationHistoryItem[];
      temporal: TemporalContextView;
    }
  | { kind: "signed-out" };

export function HomeView({ state }: { state: HomeState }) {
  if (state.kind === "ready") {
    return (
      <main className={styles.appMain}>
        <header className={styles.appHeader}>
          <div>
            <span className={styles.eyebrow}>RealMe 1.2 · Step 102</span>
            <p>Durable interpretation pipeline candidate</p>
          </div>
          <form action={logout}>
            <button className={styles.secondaryAction} type="submit">
              Sign out
            </button>
          </form>
        </header>
        <div className={styles.appSections}>
          <CompanionDialogue
            authenticatedAccountId={state.accountId}
            key={`dialogue-${state.accountId}`}
          />
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
        <span className={styles.eyebrow}>RealMe 1.2 · Step 102</span>
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
            <dd>101 accepted · 102 implementation candidate</dd>
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
            <dt>Companion</dt>
            <dd>Created after sign-up</dd>
          </div>
          <div>
            <dt>World state</dt>
            <dd>Unformed by design</dd>
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
    await getCurrentWorld(userId, repository);
    const observationRepository = new SupabaseObservationRepository(supabase);
    const observations = await listObservationHistory(
      userId,
      observationRepository,
    );
    await reconcileObservationInterpretations(
      userId,
      new SupabaseInterpretationEnqueueRepository(supabase),
    );
    const temporalRepository = new SupabaseTemporalRepository(supabase);
    const temporal = await loadTemporalContinuity(
      userId,
      observations,
      temporalRepository,
    );
    state = {
      accountId: userId,
      kind: "ready",
      observations: temporal.observations,
      temporal: {
        currentPeriod: temporal.currentPeriod,
        setting: temporal.setting,
      },
    };
  } catch {
    state = { kind: "provisioning-error" };
  }

  return <HomeView state={state} />;
}
