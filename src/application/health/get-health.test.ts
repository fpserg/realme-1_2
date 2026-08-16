import { describe, expect, it } from "vitest";

import { getHealth } from "./get-health";

describe("getHealth", () => {
  it("reports accepted Step 96 and unopened Step 97", () => {
    expect(getHealth()).toEqual({
      status: "ok",
      service: "realme-1-2",
      architecture: "modular-monolith",
      phase: "step-96-accepted-step-97-not-started",
    });
  });
});
