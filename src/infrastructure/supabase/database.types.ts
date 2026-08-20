export type RealMeDatabase = {
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
      observation_corrections: {
        Row: {
          corrected_local_calendar_date: string | null;
          corrected_occurred_at: string | null;
          corrected_occurred_precision: string | null;
          corrected_source_timezone: string | null;
          id: string;
          observation_id: string;
          rationale: string | null;
          recorded_at: string;
          recorded_by_account_id: string | null;
          supersedes_correction_id: string | null;
          world_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      observations: {
        Row: {
          capture_idempotency_key: string | null;
          id: string;
          local_calendar_date: string | null;
          occurred_at: string | null;
          occurred_precision: string;
          recorded_at: string;
          recorded_by_account_id: string | null;
          source_kind: string;
          source_locator: string | null;
          source_timezone: string | null;
          world_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      source_fragments: {
        Row: {
          captured_at: string;
          content_hash: string;
          exact_text: string;
          id: string;
          observation_id: string;
          ordinal: number;
          world_id: string;
        };
        Insert: never;
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
    Functions: {
      capture_text_observation: {
        Args: {
          p_exact_text: string;
          p_idempotency_key: string;
          p_occurred_at?: string | null;
          p_source_timezone?: string | null;
        };
        Returns: {
          local_calendar_date: string | null;
          observation_id: string;
          occurred_at: string | null;
          occurred_precision: string;
          recorded_at: string;
          source_timezone: string | null;
          was_created: boolean;
        }[];
      };
      correct_observation_occurred_time: {
        Args: {
          p_observation_id: string;
          p_occurred_at: string;
          p_source_timezone?: string | null;
        };
        Returns: {
          correction_id: string;
          local_calendar_date: string;
          observation_id: string;
          occurred_at: string;
          occurred_precision: string;
          recorded_at: string;
          source_timezone: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Step97Database = RealMeDatabase;
