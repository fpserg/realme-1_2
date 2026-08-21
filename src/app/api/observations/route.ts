import { captureTextObservation } from "@/application/observation/observation-capture";
import {
  ObservationInputError,
  parseCaptureObservationInput,
} from "@/domain/observation/observation";
import { SupabaseObservationRepository } from "@/infrastructure/supabase/observation-repository";
import { SupabaseInterpretationEnqueueRepository } from "@/infrastructure/supabase/interpretation-enqueue-repository";
import { SupabaseTemporalRepository } from "@/infrastructure/supabase/temporal-repository";

import { createSupabaseServerClient } from "../../_supabase/server";

const privateHeaders = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || typeof userId !== "string") {
    return Response.json(
      { error: "Authentication required." },
      { headers: privateHeaders, status: 401 },
    );
  }

  if (request.headers.get("X-RealMe-Recovery-Account-Id") !== userId) {
    return Response.json(
      { error: "The signed-in account changed. Reload before retrying." },
      { headers: privateHeaders, status: 409 },
    );
  }

  try {
    const input = parseCaptureObservationInput(await request.json());
    const repository = new SupabaseObservationRepository(supabase);
    const result = await captureTextObservation(userId, input, repository);
    const temporalRepository = new SupabaseTemporalRepository(supabase);
    try {
      result.observation.temporalPlacement =
        await temporalRepository.assignObservation(
          { userId },
          result.observation.id,
        );
    } catch {
      result.observation.temporalPlacement = {
        membershipId: null,
        operationalDate: null,
        operationalPeriodId: null,
        state: "pending",
        suggestedOperationalDate: null,
      };
    }
    try {
      await new SupabaseInterpretationEnqueueRepository(supabase).enqueue(
        { userId },
        result.observation.id,
      );
    } catch {
      // Step 99 evidence remains safely persisted; reload reconciliation retries.
    }

    return Response.json(result, {
      headers: privateHeaders,
      status: result.wasCreated ? 201 : 200,
    });
  } catch (caught) {
    const status =
      caught instanceof ObservationInputError || caught instanceof SyntaxError
        ? 400
        : 503;
    return Response.json(
      {
        error:
          status === 400
            ? "The observation could not be accepted."
            : "The observation could not be confirmed as saved.",
      },
      { headers: privateHeaders, status },
    );
  }
}
