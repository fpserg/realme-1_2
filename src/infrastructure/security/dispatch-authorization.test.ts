import { describe, expect, it } from "vitest";

import { authorizeDispatch } from "./dispatch-authorization";

describe("interpretation dispatch authorization", () => {
  const secret = "0123456789abcdef0123456789abcdef";

  it("accepts only the exact independent bearer secret", () => {
    expect(authorizeDispatch(`Bearer ${secret}`, secret)).toBe(true);
    expect(authorizeDispatch("Bearer wrong", secret)).toBe(false);
    expect(authorizeDispatch(secret, secret)).toBe(false);
    expect(authorizeDispatch(null, secret)).toBe(false);
  });

  it("fails closed for absent or weak configuration", () => {
    expect(authorizeDispatch(`Bearer ${secret}`, undefined)).toBe(false);
    expect(authorizeDispatch("Bearer short", "short")).toBe(false);
  });
});
