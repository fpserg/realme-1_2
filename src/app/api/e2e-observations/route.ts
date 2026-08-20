import { parseCaptureObservationInput } from "@/domain/observation/observation";
import {
  captureE2eObservation,
  listE2eObservations,
} from "@/app/_e2e/observation-store";

function unavailable() {
  return Response.json({ error: "Not found." }, { status: 404 });
}

export async function GET() {
  if (process.env.REALME_E2E_FIXTURE !== "1") return unavailable();

  return Response.json({
    observations: listE2eObservations(),
  });
}

export async function POST(request: Request) {
  if (process.env.REALME_E2E_FIXTURE !== "1") return unavailable();

  const input = parseCaptureObservationInput(await request.json());
  const result = captureE2eObservation(input);
  return Response.json(result, { status: result.wasCreated ? 201 : 200 });
}
