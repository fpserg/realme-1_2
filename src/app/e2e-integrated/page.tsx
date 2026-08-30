import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import type { CandidateReviewItem } from "@/application/admission/admission";
import type { CanonicalUnderstandingItem } from "@/application/world/list-canonical-understanding";

import { HomeView } from "../page";

export const dynamic = "force-dynamic";

const WORLD_ID = "00000000-0000-4000-8000-000000000206";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000106";
const REALM_NODE_ID = "00000000-0000-4000-8000-000000001070";
const WORK_NODE_ID = "00000000-0000-4000-8000-000000001071";
const REALM_CANDIDATE = "00000000-0000-4000-8000-000000001061";
const PRIORITY_CANDIDATE = "00000000-0000-4000-8000-000000001062";

const realmCandidate: CandidateReviewItem = {
  createdAt: "2026-08-30T12:00:00.000Z",
  evidence: [
    {
      exactText: "Family is one of the main parts of my life.",
      sourceFragmentId: "00000000-0000-4000-8000-000000001080",
    },
  ],
  explanation:
    "Proposes a Realm classification for an existing stable subject.",
  id: REALM_CANDIDATE,
  object: "Realm",
  predicate: "classification",
  proposedSubjectNodeId: REALM_NODE_ID,
  subject: "Family",
};

const priorityCandidate: CandidateReviewItem = {
  createdAt: "2026-08-30T12:01:00.000Z",
  evidence: [
    {
      exactText: "Work is a high priority right now.",
      sourceFragmentId: "00000000-0000-4000-8000-000000001081",
    },
  ],
  explanation: "Proposes a non-structural current fact.",
  id: PRIORITY_CANDIDATE,
  object: "high",
  predicate: "priority",
  proposedSubjectNodeId: WORK_NODE_ID,
  subject: "Work",
};

function canonicalItem(
  assertionId: string,
  candidateClaimId: string,
  subjectNodeId: string,
  subjectLabel: string,
  predicate: string,
  value: string,
  evidenceText: string,
): CanonicalUnderstandingItem {
  return {
    admissionAction: "accept",
    admissionDecisionId: `${assertionId.slice(0, -1)}d`,
    admittedAt: "2026-08-30T12:02:00.000Z",
    assertionId,
    candidateClaimId,
    evidence: [
      {
        exactText: evidenceText,
        sourceFragmentId: `${assertionId.slice(0, -1)}e`,
      },
    ],
    predicate,
    subjectLabel,
    subjectNodeId,
    supersedesAssertionId: null,
    validFrom: "2026-08-30T12:02:00.000Z",
    value,
  };
}

export default async function Step106IntegratedFixturePage() {
  if (process.env.REALME_E2E_FIXTURE !== "1") notFound();

  const store = await cookies();
  const realmAdmitted =
    store.get("realme_e2e_realm_decision")?.value === "accept";
  const priorityAdmitted =
    store.get("realme_e2e_priority_decision")?.value === "accept";

  const candidates = [
    ...(realmAdmitted ? [] : [realmCandidate]),
    ...(priorityAdmitted ? [] : [priorityCandidate]),
  ];
  const canonicalUnderstanding: CanonicalUnderstandingItem[] = [
    ...(realmAdmitted
      ? [
          canonicalItem(
            "00000000-0000-4000-8000-000000001090",
            REALM_CANDIDATE,
            REALM_NODE_ID,
            "Family",
            "classification",
            "Realm",
            "Family is one of the main parts of my life.",
          ),
        ]
      : []),
    ...(priorityAdmitted
      ? [
          canonicalItem(
            "00000000-0000-4000-8000-000000001091",
            PRIORITY_CANDIDATE,
            WORK_NODE_ID,
            "Work",
            "priority",
            "high",
            "Work is a high priority right now.",
          ),
        ]
      : []),
  ];

  return (
    <HomeView
      state={{
        accountId: ACCOUNT_ID,
        admissionDecisionEndpoint: "/api/e2e-integrated-admission",
        candidates,
        canonicalUnderstanding,
        horizon: [],
        kind: "ready",
        livingWorld: {
          edges: [],
          height: 220,
          nodes: realmAdmitted
            ? [
                {
                  canonicalId: REALM_NODE_ID,
                  classification: "Realm",
                  depth: 0,
                  id: REALM_NODE_ID,
                  isRealm: true,
                  label: "Family",
                  x: 160,
                  y: 70,
                },
              ]
            : [],
          rendererVersion: "living-world-code-v1",
          structuralHash: realmAdmitted ? "106realm" : "106empty",
          width: 320,
          worldId: WORLD_ID,
        },
        observations: [],
        temporal: { currentPeriod: null, setting: null },
        today: [],
      }}
    />
  );
}
