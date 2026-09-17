import { randomUUID } from "node:crypto";

import {
  type InterpretationJobRepository,
  type InterpretationProvider,
  processNextInterpretationJob,
} from "@/application/interpretation/interpret-observation";
import { createInterpretationProvider } from "@/infrastructure/ai/interpretation-provider-factory";
import {
  createInterpretationDatabaseClient,
  type InterpretationDatabaseDiagnosticStage,
  PostgresInterpretationJobRepository,
} from "@/infrastructure/postgres/interpretation-job-repository";
import { authorizeDispatch } from "@/infrastructure/security/dispatch-authorization";

export const runtime = "nodejs";

const noStore = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

type DispatchDiagnosticStage =
  | "provider_config"
  | InterpretationDatabaseDiagnosticStage
  | "worker_runtime_configuration"
  | "database_connect_or_claim"
  | "provider_call"
  | "persistence"
  | "other";

function diagnosticProvider(
  provider: InterpretationProvider,
  setStage: (stage: DispatchDiagnosticStage) => void,
): InterpretationProvider {
  return {
    get modelId() {
      return provider.modelId;
    },
    get providerId() {
      return provider.providerId;
    },
    interpret(input, options) {
      setStage("provider_call");
      return provider.interpret(input, options);
    },
  };
}

function diagnosticRepository(
  repository: InterpretationJobRepository,
  setStage: (stage: DispatchDiagnosticStage) => void,
): InterpretationJobRepository {
  return {
    claim(workerId) {
      setStage("database_connect_or_claim");
      return repository.claim(workerId);
    },
    complete(input) {
      setStage("persistence");
      return repository.complete(input);
    },
    fail(input) {
      setStage("persistence");
      return repository.fail(input);
    },
    startRun(input) {
      setStage("persistence");
      return repository.startRun(input);
    },
  };
}

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
  let diagnosticStage: DispatchDiagnosticStage = "other";
  const setDiagnosticStage = (stage: DispatchDiagnosticStage) => {
    diagnosticStage = stage;
  };
  try {
    diagnosticStage = "provider_config";
    const provider = createInterpretationProvider();
    diagnosticStage = "database_url_presence";
    database = createInterpretationDatabaseClient(
      undefined,
      setDiagnosticStage,
    );
    const repository = new PostgresInterpretationJobRepository(database);
    diagnosticStage = "worker_runtime_configuration";
    const workerId = randomUUID();
    const result = await processNextInterpretationJob({
      provider: diagnosticProvider(provider, setDiagnosticStage),
      repository: diagnosticRepository(repository, setDiagnosticStage),
      signal: request.signal,
      workerId,
    });
    return Response.json(result, { headers: noStore });
  } catch {
    console.error({
      event: "interpretation_dispatch_unavailable",
      stage: diagnosticStage,
    });
    return Response.json(
      { error: "Interpretation dispatch is unavailable." },
      { headers: noStore, status: 503 },
    );
  } finally {
    if (database) await database.end({ timeout: 1 });
  }
}
