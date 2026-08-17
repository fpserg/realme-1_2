import { describe, expect, it } from "vitest";

import { getHealth } from "./get-health";

describe("getHealth", () => {
  it("reports accepted Step 96 and the Step 97 candidate", () => {
    expect(getHealth()).toEqual({
      status: "ok",
      service: "realme-1-2",
      architecture: "modular-monolith",
      phase: "step-96-accepted-step-97-implementation-candidate",
    });
  });
});
