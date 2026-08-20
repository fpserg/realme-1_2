import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { updateSupabaseSession } from "./proxy";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

const authResponseHeaders = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

describe("updateSupabaseSession", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it("propagates refreshed cookies and required no-cache headers", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://staging-ref.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("REALME_ENVIRONMENT", "preview");
    vi.stubEnv("REALME_DATA_CLASSIFICATION", "synthetic");
    vi.stubEnv("REALME_EXPECTED_SUPABASE_PROJECT_REF", "staging-ref");

    const request = new NextRequest("https://preview.example.test/private", {
      headers: { cookie: "existing-cookie=before-refresh" },
    });

    vi.mocked(createServerClient).mockImplementation((_url, _key, options) => {
      const cookies = options.cookies;

      return {
        auth: {
          getClaims: async () => {
            expect(await cookies.getAll()).toContainEqual({
              name: "existing-cookie",
              value: "before-refresh",
            });

            await cookies.setAll?.(
              [
                {
                  name: "sb-test-auth-token",
                  value: "refreshed-session",
                  options: { httpOnly: true, path: "/", sameSite: "lax" },
                },
              ],
              authResponseHeaders,
            );

            return { data: null, error: null };
          },
        },
      } as ReturnType<typeof createServerClient>;
    });

    const response = await updateSupabaseSession(request);

    expect(request.cookies.get("sb-test-auth-token")?.value).toBe(
      "refreshed-session",
    );
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe(
      "refreshed-session",
    );
    expect(response.headers.get("Cache-Control")).toBe(
      authResponseHeaders["Cache-Control"],
    );
    expect(response.headers.get("Expires")).toBe(authResponseHeaders.Expires);
    expect(response.headers.get("Pragma")).toBe(authResponseHeaders.Pragma);
  });
});
