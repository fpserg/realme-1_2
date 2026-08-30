import { NextResponse } from "next/server";

const REALM_CANDIDATE = "00000000-0000-4000-8000-000000001061";
const PRIORITY_CANDIDATE = "00000000-0000-4000-8000-000000001062";

export async function POST(request: Request) {
  if (process.env.REALME_E2E_FIXTURE !== "1") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = (await request.json()) as {
    action?: string;
    candidateId?: string;
  };
  if (
    !body.candidateId ||
    !["accept", "reject", "correct", "defer"].includes(body.action ?? "")
  ) {
    return NextResponse.json(
      { error: "Invalid fixture decision." },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ ok: true });
  if (
    body.action === "accept" ||
    body.action === "correct" ||
    body.action === "reject"
  ) {
    const key =
      body.candidateId === REALM_CANDIDATE
        ? "realme_e2e_realm_decision"
        : body.candidateId === PRIORITY_CANDIDATE
          ? "realme_e2e_priority_decision"
          : null;
    if (key)
      response.cookies.set(key, body.action, {
        httpOnly: true,
        sameSite: "lax",
      });
  }
  return response;
}
