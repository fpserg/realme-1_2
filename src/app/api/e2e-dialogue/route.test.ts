import { afterEach, describe, expect, it } from "vitest";

import { POST } from "./route";

describe("Step 101 fixture route", () => {
  const previous = process.env.REALME_E2E_FIXTURE;

  afterEach(() => {
    if (previous === undefined) delete process.env.REALME_E2E_FIXTURE;
    else process.env.REALME_E2E_FIXTURE = previous;
  });

  it("is unavailable when the explicit E2E process gate is absent", async () => {
    delete process.env.REALME_E2E_FIXTURE;
    const response = await POST(
      new Request("http://localhost/api/e2e-dialogue", {
        body: JSON.stringify({}),
        method: "POST",
      }),
    );
    expect(response.status).toBe(404);
  });
});
