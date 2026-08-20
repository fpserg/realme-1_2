import { isInitialOwner, type WorldAccess } from "@/domain/world/world-access";

export interface WorldAccessRepository {
  findInitialWorldForUser(userId: string): Promise<WorldAccess | null>;
}

export class WorldProvisioningError extends Error {
  constructor() {
    super("The authenticated account does not have its initial World.");
    this.name = "WorldProvisioningError";
  }
}

export async function getCurrentWorld(
  authenticatedUserId: string,
  repository: WorldAccessRepository,
) {
  const access = await repository.findInitialWorldForUser(authenticatedUserId);

  if (!access || !isInitialOwner(access, authenticatedUserId)) {
    throw new WorldProvisioningError();
  }

  return access;
}
