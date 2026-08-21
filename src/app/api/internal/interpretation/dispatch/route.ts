import { randomUUID } from "node:crypto";

import { processNextInterpretationJob } from "@/application/interpretation/interpret-observation";
import { createInterpretationProvider } from "@/infrastructure/ai/interpretation-provider-factory";
import {
  createInterpretationDatabaseClient,
  PostgresInterpretationJobRepository,
} from "@/infrastructure/postgres/interpretation-job-repository";
import { authorizeDispatch } from "@/infrastructure/security/dispatch-authorization";

export const runtime = "nodejs";

const noStore = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

export async function POST(request: Request) {
  if (
    !authorizeDispatch(
      request.headers.get("Authorization"),
      process.env.JOB_DISPATCH_SECRET,
    )
  ) {
    return Response.json(
      { error: "Not authorized." },
      { headers: noStore, status: 401 },
    );
  }

  let database:
    | ReturnType<typeof createInterpretationDatabaseClient>
    | undefined;
  try {
    const provider = createInterpretationProvider();
    database = createInterpretationDatabaseClient();
    const result = await processNextInterpretationJob({
      provider,
      repository: new PostgresInterpretationJobRepository(database),
      signal: request.signal,
      workerId: randomUUID(),
    });
    return Response.json(result, { headers: noStore });
  } catch {
    return Response.json(
      { error: "Interpretation dispatch is unavailable." },
      { headers: noStore, status: 503 },
    );
  } finally {
    if (database) await database.end({ timeout: 1 });
  }
}
