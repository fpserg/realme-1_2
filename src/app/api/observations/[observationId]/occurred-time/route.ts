import { correctObservationOccurrence } from "@/application/observation/observation-capture";
import {
  ObservationInputError,
  parseOccurrenceCorrectionInput,
  requireObservationId,
} from "@/domain/observation/observation";
import { SupabaseObservationRepository } from "@/infrastructure/supabase/observation-repository";

import { createSupabaseServerClient } from "../../../../_supabase/server";

const privateHeaders = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ observationId: string }> },
) {
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
    const { observationId } = await context.params;
    const occurrence = parseOccurrenceCorrectionInput(await request.json());
    const repository = new SupabaseObservationRepository(supabase);
    const correction = await correctObservationOccurrence(
      userId,
      requireObservationId(observationId),
      occurrence,
      repository,
    );

    return Response.json(
      { correction },
      { headers: privateHeaders, status: 201 },
    );
  } catch (caught) {
    const status =
      caught instanceof ObservationInputError || caught instanceof SyntaxError
        ? 400
        : 503;
    return Response.json(
      {
        error:
          status === 400
            ? "The occurred time could not be accepted."
            : "The occurred-time correction could not be confirmed.",
      },
      { headers: privateHeaders, status },
    );
  }
}
