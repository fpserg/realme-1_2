export type Step97Database = {
  public: {
    Tables: {
      accounts: {
        Row: { created_at: string; id: string };
        Insert: { created_at?: string; id: string };
        Update: { created_at?: string };
        Relationships: [];
      };
      companions: {
        Row: { created_at: string; id: string; world_id: string };
        Insert: { created_at?: string; id?: string; world_id: string };
        Update: never;
        Relationships: [];
      };
      world_memberships: {
        Row: {
          created_at: string;
          role: "member" | "owner";
          user_id: string;
          world_id: string;
        };
        Insert: {
          created_at?: string;
          role: "member" | "owner";
          user_id: string;
          world_id: string;
        };
        Update: never;
        Relationships: [];
      };
      worlds: {
        Row: { created_at: string; id: string; initial_owner_id: string };
        Insert: {
          created_at?: string;
          id?: string;
          initial_owner_id: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
