import { captureE2eObservation } from "@/app/_e2e/observation-store";
import { parseDialogueTurnInput } from "@/domain/dialogue/dialogue";

const encoder = new TextEncoder();
const fixtureState = globalThis as typeof globalThis & {
  realMeStep101DialogueAttempts?: Map<string, number>;
};

function attempts() {
  fixtureState.realMeStep101DialogueAttempts ??= new Map();
  return fixtureState.realMeStep101DialogueAttempts;
}

function unavailable() {
  return Response.json({ error: "Not found." }, { status: 404 });
}

function line(value: Record<string, unknown>) {
  return encoder.encode(`${JSON.stringify(value)}\n`);
}

export async function POST(request: Request) {
  if (process.env.REALME_E2E_FIXTURE !== "1") return unavailable();
  const input = parseDialogueTurnInput(await request.json());
  const attempt = (attempts().get(input.idempotencyKey) ?? 0) + 1;
  attempts().set(input.idempotencyKey, attempt);
  const capture =
    input.persistence === "observation"
      ? captureE2eObservation({
          exactText: input.text,
          idempotencyKey: input.idempotencyKey,
        })
      : null;

  const response = new ReadableStream<Uint8Array>({
    start(controller) {
      if (capture) {
        controller.enqueue(
          line({
            observationId: capture.observation.id,
            recordedAt: capture.observation.recordedAt,
            type: "evidence_saved",
          }),
        );
      } else {
        controller.enqueue(line({ type: "transient_ready" }));
      }
      controller.enqueue(
        line({
          model: "step-101-deterministic",
          provider: "fixture",
          type: "provider",
        }),
      );
      controller.enqueue(line({ delta: "I hear you. ", type: "delta" }));

      if (input.text.includes("FAIL_PROVIDER") && attempt === 1) {
        controller.enqueue(
          line({
            code: "unavailable",
            message:
              "The companion could not respond. Saved evidence remains safe.",
            retryable: true,
            type: "error",
          }),
        );
      } else {
        controller.enqueue(
          line({ delta: "Your evidence is safely held.", type: "delta" }),
        );
        controller.enqueue(line({ type: "done" }));
      }
      controller.close();
    },
  });

  return new Response(response, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
