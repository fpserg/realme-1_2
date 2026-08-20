import Link from "next/link";

import { getCurrentWorld } from "@/application/world/get-current-world";
import { readSupabasePublicConfig } from "@/infrastructure/supabase/environment";
import { SupabaseWorldAccessRepository } from "@/infrastructure/supabase/world-access-repository";

import { createSupabaseServerClient } from "./_supabase/server";
import { logout } from "./auth/actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type HomeState =
  | { kind: "configuration-needed" }
  | { kind: "provisioning-error" }
  | { kind: "ready" }
  | { kind: "signed-out" };

export function HomeView({ state }: { state: HomeState }) {
  const isReady = state.kind === "ready";

  return (
    <main className={styles.main}>
      <section className={styles.panel} aria-labelledby="world-title">
        <span className={styles.eyebrow}>RealMe 1.2 · Step 97</span>
        <h1 id="world-title">
          {isReady
            ? "Your private World is ready."
            : "A private World begins here."}
        </h1>
        <p>
          {isReady
            ? "Your stable World identity and one unnamed companion are present. Nothing has been classified or filled merely to occupy the surface."
            : "Sign in to receive one private World and one companion. Your World begins unformed, without a generic map or imposed roster."}
        </p>

        {state.kind === "signed-out" ? (
          <Link className={styles.primaryAction} href="/login">
            Sign in or create account
          </Link>
        ) : null}

        {isReady ? (
          <form action={logout}>
            <button className={styles.secondaryAction} type="submit">
              Sign out
            </button>
          </form>
        ) : null}

        <dl className={styles.status}>
          <div>
            <dt>Current step</dt>
            <dd>97 accepted · 98 not started</dd>
          </div>
          <div>
            <dt>World access</dt>
            <dd>
              {isReady
                ? "Private · owner"
                : state.kind === "configuration-needed"
                  ? "Build not configured"
                  : state.kind === "provisioning-error"
                    ? "Provisioning check failed"
                    : "Authentication required"}
            </dd>
          </div>
          <div>
            <dt>Companion</dt>
            <dd>{isReady ? "Present · unnamed" : "Created after sign-up"}</dd>
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
    state = { kind: "ready" };
  } catch {
    state = { kind: "provisioning-error" };
  }

  return <HomeView state={state} />;
}
