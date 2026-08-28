import { NextResponse } from "next/server";

import {
  decideCandidate,
  type AdmissionAction,
  type CandidateCorrection,
} from "@/application/admission/admission";
import { SupabaseAdmissionRepository } from "@/infrastructure/supabase/admission-repository";

import { createSupabaseServerClient } from "@/app/_supabase/server";

const allowedActions = new Set<AdmissionAction>([
  "accept",
  "reject",
  "correct",
  "defer",
]);

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || typeof userId !== "string") {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "Invalid admission request." },
      { status: 400 },
    );
  }

  const candidateId = "candidateId" in body ? body.candidateId : undefined;
  const action = "action" in body ? body.action : undefined;
  const correction = "correction" in body ? body.correction : undefined;

  if (
    typeof candidateId !== "string" ||
    typeof action !== "string" ||
    !allowedActions.has(action as AdmissionAction)
  ) {
    return NextResponse.json(
      { error: "Invalid admission request." },
      { status: 400 },
    );
  }

  try {
    const result = await decideCandidate(
      userId,
      candidateId,
      action as AdmissionAction,
      new SupabaseAdmissionRepository(supabase),
      correction as CandidateCorrection | undefined,
    );
    return NextResponse.json(result);
  } catch (admissionError) {
    const message =
      admissionError instanceof Error
        ? admissionError.message
        : "Admission command failed.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
