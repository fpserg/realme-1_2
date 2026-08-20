import { saveTimeSetting } from "@/application/time/temporal-continuity";
import {
  parseTimeSettingInput,
  TemporalInputError,
} from "@/domain/time/operational-time";
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

  try {
    const input = parseTimeSettingInput(await request.json());
    const repository = new SupabaseTemporalRepository(supabase);
    const setting = await saveTimeSetting(userId, input, repository);
    return Response.json({ setting }, { headers: privateHeaders, status: 201 });
  } catch (caught) {
    const status =
      caught instanceof TemporalInputError || caught instanceof SyntaxError
        ? 400
        : 503;
    return Response.json(
      {
        error:
          status === 400
            ? "The time setting could not be accepted."
            : "The time setting could not be confirmed.",
      },
      { headers: privateHeaders, status },
    );
  }
}
