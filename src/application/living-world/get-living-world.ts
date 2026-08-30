import {
  composeLivingWorld,
  type CanonicalLivingWorldState,
  type LivingWorldProjection,
} from "@/domain/living-world/living-world";

export interface LivingWorldRepository {
  loadCanonicalStructure(worldId: string): Promise<CanonicalLivingWorldState>;
}

export class LivingWorldIsolationError extends Error {
  constructor() {
    super("Living World canonical structure crossed the requested World boundary.");
    this.name = "LivingWorldIsolationError";
  }
}

export async function getLivingWorld(
  worldId: string,
  repository: LivingWorldRepository,
): Promise<LivingWorldProjection> {
  const canonical = await repository.loadCanonicalStructure(worldId);

  if (canonical.worldId !== worldId) {
    throw new LivingWorldIsolationError();
  }

  return composeLivingWorld(canonical);
}
