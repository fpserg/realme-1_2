import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/app/_supabase/server";
import { readSupabasePublicConfig } from "@/infrastructure/supabase/environment";

import { login, signup } from "../auth/actions";
import styles from "./login.module.css";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const config = readSupabasePublicConfig();

  if (config) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    if (typeof data?.claims?.sub === "string") redirect("/");
  }

  const { notice } = await searchParams;

  return (
    <main className={styles.main}>
      <section className={styles.panel} aria-labelledby="login-title">
        <span className={styles.eyebrow}>Private entrance</span>
        <h1 id="login-title">Enter RealMe</h1>
        <p>
          A new account receives one private, unformed World and one unnamed
          companion.
        </p>

        {notice ? <p className={styles.notice}>{notice}</p> : null}

        <form className={styles.form}>
          <label htmlFor="email">Email</label>
          <input
            autoComplete="email"
            id="email"
            name="email"
            required
            type="email"
          />
          <label htmlFor="password">Password</label>
          <input
            autoComplete="current-password"
            id="password"
            minLength={8}
            name="password"
            required
            type="password"
          />
          <div className={styles.actions}>
            <button disabled={!config} formAction={login} type="submit">
              Sign in
            </button>
            <button disabled={!config} formAction={signup} type="submit">
              Create account
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
