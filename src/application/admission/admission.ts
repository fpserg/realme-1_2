export type AdmissionAction = "accept" | "reject" | "correct" | "defer";

export type CandidateScalar = boolean | number | string;

export type CandidateEvidence = {
  exactText: string;
  sourceFragmentId: string;
};

export type CandidateReviewItem = {
  createdAt: string;
  evidence: CandidateEvidence[];
  explanation: string;
  id: string;
  object: CandidateScalar;
  predicate: string;
  proposedSubjectNodeId: string | null;
  subject: string;
};

export type CandidateCorrection = {
  object: CandidateScalar;
  predicate: string;
  subject: string;
};

export type AdmissionResult = {
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
  return repository.decide({ userId }, candidateClaimId, action, correction);
}
