import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AdmissionAction,
  AdmissionRepository,
  CandidateCorrection,
  CandidateEvidence,
  CandidateReviewItem,
} from "@/application/admission/admission";

import type { RealMeDatabase } from "./database.types";

type CandidateReviewRow = {
  candidate_claim_id: string;
  candidate_payload: Record<string, unknown>;
  created_at: string;
  evidence: unknown;
  proposed_subject_node_id: string | null;
};

function readScalar(value: unknown) {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  throw new Error("Candidate scalar is invalid.");
}

function readEvidence(value: unknown): CandidateEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("exact_text" in entry) ||
      !("source_fragment_id" in entry) ||
      typeof entry.exact_text !== "string" ||
      typeof entry.source_fragment_id !== "string"
    ) {
      return [];
    }
    return [
      {
        exactText: entry.exact_text,
        sourceFragmentId: entry.source_fragment_id,
      },
    ];
  });
}

function mapCandidate(row: CandidateReviewRow): CandidateReviewItem {
  const payload = row.candidate_payload;
  if (
    typeof payload.subject !== "string" ||
    typeof payload.predicate !== "string" ||
    typeof payload.explanation !== "string"
  ) {
    throw new Error("Candidate payload is invalid.");
  }

  return {
    createdAt: row.created_at,
    evidence: readEvidence(row.evidence),
    explanation: payload.explanation,
    id: row.candidate_claim_id,
    object: readScalar(payload.object),
    predicate: payload.predicate,
    proposedSubjectNodeId: row.proposed_subject_node_id,
    subject: payload.subject,
  };
}

export class SupabaseAdmissionRepository implements AdmissionRepository {
  constructor(private readonly client: SupabaseClient<RealMeDatabase>) {}

  async list() {
    const { data, error } = await this.client.rpc("list_candidate_reviews");
    if (error) throw error;
    return data.map((row) => mapCandidate(row));
  }

  async decide(
    _context: { userId: string },
    candidateClaimId: string,
    action: AdmissionAction,
    correction?: CandidateCorrection,
  ) {
    const { data, error } = await this.client.rpc("decide_candidate", {
      p_action: action,
      p_candidate_claim_id: candidateClaimId,
      p_correction_payload: correction
        ? {
            object: correction.object,
            predicate: correction.predicate,
            subject: correction.subject,
          }
        : null,
    });
    if (error) throw error;
    const row = data[0];
    if (!row) throw new Error("Admission command returned no durable result.");

    return {
      action: row.decision_action as AdmissionAction,
      canonicalAssertionId: row.canonical_assertion_id,
      canonicalNodeId: row.canonical_node_id,
      candidateClaimId: row.candidate_claim_id,
      decisionId: row.decision_id,
      supersededAssertionId: row.superseded_assertion_id,
      wasReplay: row.was_replay,
    };
  }
}
