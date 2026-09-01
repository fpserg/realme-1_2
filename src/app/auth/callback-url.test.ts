import { describe, expect, it } from "vitest";

import { resolveAuthCallbackUrl } from "./callback-url";

describe("resolveAuthCallbackUrl", () => {
  it("uses the canonical application origin in production", () => {
    expect(
      resolveAuthCallbackUrl("production", {
        DEPLOY_PRIME_URL:
          "https://deploy-preview-27--realme-1-2-570.netlify.app",
        NEXT_PUBLIC_APP_URL: "https://fallback.example.com",
        URL: "https://realme-1-2-570.netlify.app",
      }),
    ).toBe("https://realme-1-2-570.netlify.app/auth/callback");
  });

  it("never falls back to a deploy-specific origin in production", () => {
    expect(() =>
      resolveAuthCallbackUrl("production", {
        DEPLOY_PRIME_URL:
          "https://deploy-preview-27--realme-1-2-570.netlify.app",
      }),
    ).toThrow("canonical production application URL is required");
  });

  it.each(["preview", "staging"] as const)(
    "keeps %s on its isolated deploy origin",
    (environment) => {
      expect(
        resolveAuthCallbackUrl(environment, {
          DEPLOY_PRIME_URL: `https://${environment}.synthetic.example.com`,
          URL: "https://realme-1-2-570.netlify.app",
        }),
      ).toBe(`https://${environment}.synthetic.example.com/auth/callback`);
    },
  );

  it.each(["preview", "staging"] as const)(
    "refuses to fall through from %s to the production origin",
    (environment) => {
      expect(() =>
        resolveAuthCallbackUrl(environment, {
          URL: "https://realme-1-2-570.netlify.app",
        }),
      ).toThrow("isolated deploy application URL is required");
    },
  );

  it("keeps local and test callback construction valid", () => {
    expect(resolveAuthCallbackUrl("local", {})).toBe(
      "http://127.0.0.1:3000/auth/callback",
    );
    expect(
      resolveAuthCallbackUrl("test", {
        NEXT_PUBLIC_APP_URL: "http://localhost:3210",
      }),
    ).toBe("http://localhost:3210/auth/callback");
  });
});
