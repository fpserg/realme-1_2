import { describe, expect, it } from "vitest";

import {
  getCurrentWorld,
  WorldProvisioningError,
  type WorldAccessRepository,
} from "./get-current-world";

describe("getCurrentWorld", () => {
  it("returns the authenticated owner's World and companion", async () => {
    const repository: WorldAccessRepository = {
      findInitialWorldForUser: async (userId) => ({
        companionId: "companion-1",
        role: "owner",
        userId,
        worldId: "world-1",
      }),
    };

    await expect(getCurrentWorld("user-1", repository)).resolves.toEqual({
      companionId: "companion-1",
      role: "owner",
      userId: "user-1",
      worldId: "world-1",
    });
  });

  it("rejects absent or mismatched ownership", async () => {
    const absent: WorldAccessRepository = {
      findInitialWorldForUser: async () => null,
    };
    const mismatched: WorldAccessRepository = {
      findInitialWorldForUser: async () => ({
        companionId: "companion-2",
        role: "owner",
        userId: "user-2",
        worldId: "world-2",
      }),
    };

    await expect(getCurrentWorld("user-1", absent)).rejects.toBeInstanceOf(
      WorldProvisioningError,
    );
    await expect(getCurrentWorld("user-1", mismatched)).rejects.toBeInstanceOf(
      WorldProvisioningError,
    );
  });
});
