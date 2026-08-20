import {
  DialogueProviderError,
  prepareDialogueTurn,
} from "@/application/dialogue/one-companion-dialogue";
import {
  DialogueInputError,
  parseDialogueTurnInput,
} from "@/domain/dialogue/dialogue";
import { createDialogueProvider } from "@/infrastructure/ai/dialogue-provider-factory";
import { SupabaseDialogueEvidenceRepository } from "@/infrastructure/supabase/dialogue-evidence-repository";
import { SupabaseObservationRepository } from "@/infrastructure/supabase/observation-repository";
import { SupabaseTemporalRepository } from "@/infrastructure/supabase/temporal-repository";

import { createSupabaseServerClient } from "../../_supabase/server";

const privateHeaders = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

const encoder = new TextEncoder();

function event(value: Record<string, unknown>) {
  return encoder.encode(`${JSON.stringify(value)}\n`);
}

function normalizedFailure(error: unknown) {
  const code =
    error instanceof DialogueProviderError ? error.code : "unavailable";
  return {
    code,
    message:
      code === "cancelled"
        ? "The companion response was stopped."
        : "The companion could not respond. Saved evidence remains safe.",
    retryable: code !== "configuration",
    type: "error",
  };
}

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

  let input;
  try {
    input = parseDialogueTurnInput(await request.json());
  } catch (caught) {
    const status =
      caught instanceof DialogueInputError || caught instanceof SyntaxError
        ? 400
        : 503;
    return Response.json(
      { error: "The dialogue request could not be accepted." },
      { headers: privateHeaders, status },
    );
  }

  let prepared;
  try {
    const observationRepository = new SupabaseObservationRepository(supabase);
    const evidenceRepository = new SupabaseDialogueEvidenceRepository(supabase);
    prepared = await prepareDialogueTurn(
      userId,
      input,
      observationRepository,
      evidenceRepository,
    );

    if (prepared.persistedObservation) {
      const temporalRepository = new SupabaseTemporalRepository(supabase);
      try {
        await temporalRepository.assignObservation(
          { userId },
          prepared.persistedObservation.id,
        );
      } catch {
        // Step 99 evidence remains authoritative when Step 100 placement retries.
      }
    }
  } catch {
    return Response.json(
      {
        error:
          "The message could not be prepared. Any uncertain evidence can be retried with the same identity.",
      },
      { headers: privateHeaders, status: 503 },
    );
  }

  const abortController = new AbortController();
  if (request.signal.aborted) abortController.abort();
  const abortFromRequest = () => abortController.abort();
  request.signal.addEventListener("abort", abortFromRequest, { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (prepared.persistedObservation) {
        controller.enqueue(
          event({
            observationId: prepared.persistedObservation.id,
            recordedAt: prepared.persistedObservation.recordedAt,
            type: "evidence_saved",
          }),
        );
      } else {
        controller.enqueue(event({ type: "transient_ready" }));
      }

      try {
        const provider = createDialogueProvider();
        controller.enqueue(
          event({
            model: provider.modelId,
            provider: provider.providerId,
            type: "provider",
          }),
        );
        for await (const delta of provider.stream(prepared.context, {
          signal: abortController.signal,
        })) {
          controller.enqueue(event({ delta, type: "delta" }));
        }
        controller.enqueue(event({ type: "done" }));
      } catch (caught) {
        if (!abortController.signal.aborted) {
          controller.enqueue(event(normalizedFailure(caught)));
        }
      } finally {
        request.signal.removeEventListener("abort", abortFromRequest);
        if (!abortController.signal.aborted) controller.close();
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      ...privateHeaders,
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
