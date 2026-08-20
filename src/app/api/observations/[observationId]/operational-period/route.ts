import { correctObservationMembership } from "@/application/time/temporal-continuity";
import {
  ObservationInputError,
  requireObservationId,
} from "@/domain/observation/observation";
import {
  parseHistoricalCorrectionInput,
  TemporalInputError,
} from "@/domain/time/operational-time";
import { SupabaseTemporalRepository } from "@/infrastructure/supabase/temporal-repository";

import { createSupabaseServerClient } from "../../../../_supabase/server";

const privateHeaders = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

export async function POST(
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
    const { reasonCategory } = parseHistoricalCorrectionInput(
      await request.json(),
    );
    const repository = new SupabaseTemporalRepository(supabase);
    const temporalPlacement = await correctObservationMembership(
      userId,
      requireObservationId(observationId),
      reasonCategory,
      repository,
    );

    return Response.json(
      { temporalPlacement },
      { headers: privateHeaders, status: 201 },
    );
  } catch (caught) {
    const status =
      caught instanceof TemporalInputError ||
      caught instanceof ObservationInputError ||
      caught instanceof SyntaxError
        ? 400
        : 503;
    return Response.json(
      {
        error:
          status === 400
            ? "The historical correction could not be accepted."
            : "The historical correction could not be confirmed.",
      },
      { headers: privateHeaders, status },
    );
  }
}
