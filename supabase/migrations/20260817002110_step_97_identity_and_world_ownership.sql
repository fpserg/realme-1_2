CREATE SCHEMA IF NOT EXISTS private;
--> statement-breakpoint
REVOKE ALL ON SCHEMA private FROM public, anon, authenticated;
--> statement-breakpoint
GRANT USAGE ON SCHEMA private TO authenticated;
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"world_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_memberships" (
	"world_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "world_memberships_world_id_user_id_primary_key" PRIMARY KEY("world_id","user_id"),
	CONSTRAINT "world_memberships_role_check" CHECK ("world_memberships"."role" in ('owner', 'member'))
);
--> statement-breakpoint
CREATE TABLE "worlds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"initial_owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companions" ADD CONSTRAINT "companions_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_memberships" ADD CONSTRAINT "world_memberships_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "companions_world_id_unique" ON "companions" USING btree ("world_id");--> statement-breakpoint
CREATE UNIQUE INDEX "worlds_initial_owner_id_unique" ON "worlds" USING btree ("initial_owner_id");
--> statement-breakpoint
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_id_auth_users_id_fk
  FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE public.worlds
  ADD CONSTRAINT worlds_initial_owner_id_auth_users_id_fk
  FOREIGN KEY (initial_owner_id) REFERENCES auth.users (id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE public.world_memberships
  ADD CONSTRAINT world_memberships_user_id_auth_users_id_fk
  FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
--> statement-breakpoint
COMMENT ON TABLE public.accounts IS
  'Private account identity only. Personal profile fields are outside Step 97.';
--> statement-breakpoint
COMMENT ON TABLE public.worlds IS
  'Stable private World ownership root. Ontology begins in Step 98.';
--> statement-breakpoint
COMMENT ON TABLE public.companions IS
  'One initially unnamed companion per World; no imposed Realmer roster.';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.ensure_initial_world(target_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_world_id uuid;
BEGIN
  INSERT INTO public.accounts (id)
  VALUES (target_user_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.worlds (initial_owner_id)
  VALUES (target_user_id)
  ON CONFLICT (initial_owner_id) DO UPDATE
    SET initial_owner_id = excluded.initial_owner_id
  RETURNING id INTO target_world_id;

  INSERT INTO public.world_memberships (world_id, user_id, role)
  VALUES (target_world_id, target_user_id, 'owner')
  ON CONFLICT (world_id, user_id) DO NOTHING;

  INSERT INTO public.companions (world_id)
  VALUES (target_world_id)
  ON CONFLICT (world_id) DO NOTHING;

  RETURN target_world_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.ensure_initial_world(uuid) FROM public, anon, authenticated;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.bootstrap_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.ensure_initial_world(new.id);
  RETURN new;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.bootstrap_new_auth_user() FROM public, anon, authenticated;
--> statement-breakpoint
CREATE TRIGGER realme_bootstrap_new_auth_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE private.bootstrap_new_auth_user();
--> statement-breakpoint
SELECT private.ensure_initial_world(id) FROM auth.users;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION private.is_world_member(target_world_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.world_memberships membership
    WHERE membership.world_id = target_world_id
      AND membership.user_id = (SELECT auth.uid())
  );
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION private.is_world_member(uuid) FROM public, anon;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION private.is_world_member(uuid) TO authenticated;
--> statement-breakpoint
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.worlds ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.world_memberships ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.companions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON public.accounts FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON public.worlds FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON public.world_memberships FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON public.companions FROM anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON public.accounts TO authenticated;
--> statement-breakpoint
GRANT SELECT ON public.worlds TO authenticated;
--> statement-breakpoint
GRANT SELECT ON public.world_memberships TO authenticated;
--> statement-breakpoint
GRANT SELECT ON public.companions TO authenticated;
--> statement-breakpoint
CREATE POLICY accounts_select_self
  ON public.accounts
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));
--> statement-breakpoint
CREATE POLICY worlds_select_member
  ON public.worlds
  FOR SELECT
  TO authenticated
  USING (private.is_world_member(id));
--> statement-breakpoint
CREATE POLICY memberships_select_self
  ON public.world_memberships
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
--> statement-breakpoint
CREATE POLICY companions_select_member
  ON public.companions
  FOR SELECT
  TO authenticated
  USING (private.is_world_member(world_id));
