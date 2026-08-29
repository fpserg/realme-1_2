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
      observation_operational_period_memberships: {
        Row: {
          assigned_at: string;
          assigned_by_account_id: string | null;
          assignment_kind: "correction" | "initial";
          id: string;
          observation_id: string;
          operational_period_id: string;
          supersedes_membership_id: string | null;
          world_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      operational_periods: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          local_date: string;
          starts_at: string;
          supersedes_period_id: string | null;
          time_setting_id: string;
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
      time_settings: {
        Row: {
          created_at: string;
          effective_from: string;
          effective_to: string | null;
          id: string;
          operational_day_boundary: string;
          recorded_by_account_id: string | null;
          supersedes_time_setting_id: string | null;
          timezone_name: string;
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
      enqueue_observation_interpretation: {
        Args: { p_observation_id: string };
        Returns: {
          job_id: string;
          job_status: "failed" | "queued" | "running" | "succeeded";
          was_created: boolean;
        }[];
      };
      reconcile_observation_interpretations: {
        Args: Record<string, never>;
        Returns: number;
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
      assign_observation_operational_period: {
        Args: { p_observation_id: string };
        Returns: {
          assignment_state: "assigned" | "correction_required";
          local_date: string;
          membership_id: string;
          operational_period_id: string;
          suggested_local_date: string | null;
          suggested_operational_period_id: string | null;
        }[];
      };
      correct_observation_operational_period: {
        Args: {
          p_observation_id: string;
          p_reason_category: "occurred_time_correction" | "user_review";
        };
        Returns: {
          audit_event_id: string;
          local_date: string;
          membership_id: string;
          operational_period_id: string;
        }[];
      };
      get_current_operational_period: {
        Args: Record<string, never>;
        Returns: {
          ends_at: string;
          local_date: string;
          operational_day_boundary: string;
          operational_period_id: string;
          setting_effective_from: string;
          starts_at: string;
          time_setting_id: string;
          timezone_name: string;
        }[];
      };
      save_time_setting: {
        Args: {
          p_operational_day_boundary?: string;
          p_timezone_name: string;
        };
        Returns: {
          effective_from: string;
          operational_day_boundary: string;
          time_setting_id: string;
          timezone_name: string;
          was_created: boolean;
        }[];
      };
      list_candidate_reviews: {
        Args: Record<string, never>;
        Returns: {
          candidate_claim_id: string;
          candidate_payload: Record<string, unknown>;
          created_at: string;
          evidence: unknown;
          proposed_subject_node_id: string | null;
        }[];
      };
      decide_candidate: {
        Args: {
          p_action: "accept" | "reject" | "correct" | "defer";
          p_candidate_claim_id: string;
          p_correction_payload?: Record<string, unknown> | null;
        };
        Returns: {
          candidate_claim_id: string;
          decision_id: string;
          decision_action: string;
          canonical_assertion_id: string | null;
          canonical_node_id: string | null;
          superseded_assertion_id: string | null;
          was_replay: boolean;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Step97Database = RealMeDatabase;
