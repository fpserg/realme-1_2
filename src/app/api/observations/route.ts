import { captureTextObservation } from "@/application/observation/observation-capture";
import {
  ObservationInputError,
  parseCaptureObservationInput,
} from "@/domain/observation/observation";
import { SupabaseObservationRepository } from "@/infrastructure/supabase/observation-repository";

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

  try {
    const input = parseCaptureObservationInput(await request.json());
    const repository = new SupabaseObservationRepository(supabase);
    const result = await captureTextObservation(userId, input, repository);

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
