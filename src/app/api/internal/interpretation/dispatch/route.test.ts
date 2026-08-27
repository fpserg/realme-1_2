import { afterEach, describe, expect, it } from "vitest";

import { POST } from "./route";

describe("POST /api/internal/interpretation/dispatch", () => {
  const previous = process.env.JOB_DISPATCH_SECRET;

  afterEach(() => {
    if (previous === undefined) delete process.env.JOB_DISPATCH_SECRET;
    else process.env.JOB_DISPATCH_SECRET = previous;
  });

  it("rejects a browser or unauthenticated caller without the worker secret", async () => {
    process.env.JOB_DISPATCH_SECRET = "0123456789abcdef0123456789abcdef";
    const response = await POST(
      new Request("http://localhost/api/internal/interpretation/dispatch", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Not authorized.",
    });
  });
});
