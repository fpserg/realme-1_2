export type WorldMembershipRole = "owner" | "member";

export interface WorldAccess {
  companionId: string;
  role: WorldMembershipRole;
  userId: string;
  worldId: string;
}

export function isInitialOwner(
  access: WorldAccess,
  authenticatedUserId: string,
) {
  return access.userId === authenticatedUserId && access.role === "owner";
}
