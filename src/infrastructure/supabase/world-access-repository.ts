import type { SupabaseClient } from "@supabase/supabase-js";

import type { WorldAccessRepository } from "@/application/world/get-current-world";

import type { Step97Database } from "./database.types";

export class SupabaseWorldAccessRepository implements WorldAccessRepository {
  constructor(private readonly client: SupabaseClient<Step97Database>) {}

  async findInitialWorldForUser(userId: string) {
    const { data: membership, error: membershipError } = await this.client
      .from("world_memberships")
      .select("world_id, user_id, role")
      .eq("user_id", userId)
      .eq("role", "owner")
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) return null;

    const { data: companion, error: companionError } = await this.client
      .from("companions")
      .select("id")
      .eq("world_id", membership.world_id)
      .maybeSingle();

    if (companionError) throw companionError;
    if (!companion) return null;

    return {
      companionId: companion.id,
      role: membership.role,
      userId: membership.user_id,
      worldId: membership.world_id,
    };
  }
}
