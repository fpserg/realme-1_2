import { describe, expect, it } from "vitest";

import { getHealth } from "./get-health";

describe("getHealth", () => {
  it("reports the bounded Step 96 candidate", () => {
    expect(getHealth()).toEqual({
      status: "ok",
      service: "realme-1-2",
      architecture: "modular-monolith",
      phase: "step-96-candidate",
    });
  });
});
