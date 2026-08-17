import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Step97Database } from "@/infrastructure/supabase/database.types";
import { readSupabasePublicConfig } from "@/infrastructure/supabase/environment";

export async function createSupabaseServerClient() {
  const config = readSupabasePublicConfig();
  if (!config) throw new Error("Supabase is not configured for this build.");

  const cookieStore = await cookies();

  return createServerClient<Step97Database>(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, options, value }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. The proxy refreshes sessions.
        }
      },
    },
  });
}
