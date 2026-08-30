export type CanonicalEvidence = {
  exactText: string;
  sourceFragmentId: string;
};

export type CanonicalUnderstandingItem = {
  assertionId: string;
  subjectNodeId: string;
  subjectLabel: string;
  predicate: string;
  value: string | number | boolean;
  validFrom: string;
  admittedAt: string;
  admissionAction: "accept" | "correct";
  admissionDecisionId: string;
  candidateClaimId: string;
  supersedesAssertionId: string | null;
  evidence: CanonicalEvidence[];
};

export interface CanonicalUnderstandingRepository {
  listCurrent(worldId: string): Promise<CanonicalUnderstandingItem[]>;
}

export async function listCanonicalUnderstanding(
  worldId: string,
  repository: CanonicalUnderstandingRepository,
) {
  const items = await repository.listCurrent(worldId);
  return items;
}
