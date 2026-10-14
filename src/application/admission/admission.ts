import {
  parseCandidateMeaningV2,
  type CandidateMeaningV2,
} from "@/domain/interpretation/candidate-v2";

export type AdmissionAction = "accept" | "reject" | "correct" | "defer";

export type CandidateScalar = boolean | number | string;

export type CandidateEvidence = {
  exactText: string;
  sourceFragmentId: string;
};

export type CandidateReviewItem = {
  kind?: CandidateMeaningV2["kind"];
  schemaVersion?: "candidate-set-v1" | "candidate-set-v2";
  epistemic?: {
    actor: string;
    mode: import("@/domain/interpretation/candidate-v2").EpistemicMode;
  };
  createdAt: string;
  evidence: CandidateEvidence[];
  explanation: string;
  id: string;
  object: CandidateScalar;
  predicate: string;
  proposedSubjectNodeId: string | null;
  subject: string;
};

export type CandidateCorrection =
  | {
      object: CandidateScalar;
      predicate: string;
      subject: string;
    }
  | (CandidateMeaningV2 & {
      schema_version: "candidate-set-v2";
      supersedes_epistemic_assertion_id?: string;
    });

export type AdmissionResult = {
  canonicalEpistemicAssertionId?: string | null;
  action: AdmissionAction;
  canonicalAssertionId: string | null;
  canonicalNodeId: string | null;
  candidateClaimId: string;
  decisionId: string;
  supersededAssertionId: string | null;
  wasReplay: boolean;
};

export type AuthenticatedAdmissionContext = { userId: string };

export interface AdmissionRepository {
  decide(
    context: AuthenticatedAdmissionContext,
    candidateClaimId: string,
    action: AdmissionAction,
    correction?: CandidateCorrection,
  ): Promise<AdmissionResult>;
  list(context: AuthenticatedAdmissionContext): Promise<CandidateReviewItem[]>;
}

function requireAuthenticated(userId: string) {
  if (!userId) throw new Error("Authenticated context is required.");
}

export async function listCandidateReviews(
  userId: string,
  repository: AdmissionRepository,
) {
  requireAuthenticated(userId);
  return repository.list({ userId });
}

export async function decideCandidate(
  userId: string,
  candidateClaimId: string,
  action: AdmissionAction,
  repository: AdmissionRepository,
  correction?: CandidateCorrection,
) {
  requireAuthenticated(userId);
  if (!candidateClaimId) throw new Error("Candidate is required.");
  if (action === "correct" && !correction) {
    throw new Error("Correction payload is required.");
  }
  if (action !== "correct" && correction) {
    throw new Error("Only correction accepts corrected durable meaning.");
  }
  if (correction && "schema_version" in correction) {
    const { schema_version, supersedes_epistemic_assertion_id, ...meaning } =
      correction;
    if (schema_version !== "candidate-set-v2")
      throw new Error("Unsupported correction schema.");
    parseCandidateMeaningV2(meaning);
    if (
      supersedes_epistemic_assertion_id !== undefined &&
      (meaning.kind !== "epistemic_proposition" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          supersedes_epistemic_assertion_id,
        ))
    )
      throw new Error("Invalid explicit epistemic predecessor.");
  }
  return repository.decide({ userId }, candidateClaimId, action, correction);
}
