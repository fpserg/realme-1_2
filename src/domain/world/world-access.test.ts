import { describe, expect, it } from "vitest";

import { isInitialOwner, type WorldAccess } from "./world-access";

const access: WorldAccess = {
  companionId: "companion-1",
  role: "owner",
  userId: "user-1",
  worldId: "world-1",
};

describe("isInitialOwner", () => {
  it("accepts only the matching owner", () => {
    expect(isInitialOwner(access, "user-1")).toBe(true);
    expect(isInitialOwner(access, "user-2")).toBe(false);
    expect(isInitialOwner({ ...access, role: "member" }, "user-1")).toBe(false);
  });
});
