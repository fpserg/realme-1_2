import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeDispatch: vi.fn(),
  createDatabase: vi.fn(),
  createProvider: vi.fn(),
  processNext: vi.fn(),
  repositoryConstructor: vi.fn(),
}));

vi.mock("@/application/interpretation/interpret-observation", () => ({
  processNextInterpretationJob: mocks.processNext,
}));

vi.mock("@/infrastructure/ai/interpretation-provider-factory", () => ({
  createInterpretationProvider: mocks.createProvider,
}));

vi.mock("@/infrastructure/postgres/interpretation-job-repository", () => ({
  createInterpretationDatabaseClient: mocks.createDatabase,
  PostgresInterpretationJobRepository: class {
    constructor(database: unknown) {
      mocks.repositoryConstructor(database);
    }

    claim() {
      throw new Error("Unexpected repository claim in route test.");
    }

    complete() {
      throw new Error("Unexpected repository completion in route test.");
    }

    fail() {
      throw new Error("Unexpected repository failure handling in route test.");
    }

    startRun() {
      throw new Error("Unexpected repository run start in route test.");
    }
  },
}));

vi.mock("@/infrastructure/security/dispatch-authorization", () => ({
  authorizeDispatch: mocks.authorizeDispatch,
}));

import { POST } from "./route";

describe("POST /api/internal/interpretation/dispatch", () => {
  const previousSecret = process.env.JOB_DISPATCH_SECRET;
  let databaseEnd: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JOB_DISPATCH_SECRET = "0123456789abcdef0123456789abcdef";
    databaseEnd = vi.fn().mockResolvedValue(undefined);
    mocks.authorizeDispatch.mockReturnValue(true);
    mocks.createDatabase.mockReturnValue({ end: databaseEnd });
    mocks.createProvider.mockReturnValue({
      interpret: vi.fn(),
      modelId: "test-model",
      providerId: "openai",
    });
    mocks.processNext.mockResolvedValue({ state: "idle" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (previousSecret === undefined) delete process.env.JOB_DISPATCH_SECRET;
    else process.env.JOB_DISPATCH_SECRET = previousSecret;
  });

  it("rejects a browser or unauthenticated caller before worker initialization", async () => {
    mocks.authorizeDispatch.mockReturnValue(false);
    const response = await POST(
      new Request("http://localhost/api/internal/interpretation/dispatch", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Not authorized.",
    });
    expect(mocks.createProvider).not.toHaveBeenCalled();
    expect(mocks.createDatabase).not.toHaveBeenCalled();
    expect(mocks.processNext).not.toHaveBeenCalled();
  });

  it("keeps the 503 response contract unchanged and logs only a safe initialization stage", async () => {
    const providerSecret = "sk-provider-secret-value";
    const databaseUrl =
      "postgresql://user:database-password@db.example.invalid/postgres";
    const authorization = "Bearer dispatch-authorization-secret";
    const consoleError = vi.spyOn(console, "error");
    consoleError.mockImplementation(() => {});
    mocks.createProvider.mockImplementationOnce(() => {
      throw new Error(
        `unsafe ${providerSecret} ${databaseUrl} ${authorization}`,
      );
    });

    const response = await POST(
      new Request("http://localhost/api/internal/interpretation/dispatch", {
        headers: { Authorization: authorization },
        method: "POST",
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.text()).resolves.toBe(
      '{"error":"Interpretation dispatch is unavailable."}',
    );
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith({
      event: "interpretation_dispatch_unavailable",
      stage: "provider_config",
    });
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).not.toContain(providerSecret);
    expect(logged).not.toContain(databaseUrl);
    expect(logged).not.toContain(authorization);
    expect(logged).not.toContain(process.env.JOB_DISPATCH_SECRET);
    expect(mocks.createProvider).toHaveBeenCalledTimes(1);
    expect(mocks.createDatabase).not.toHaveBeenCalled();
    expect(mocks.processNext).not.toHaveBeenCalled();
  });

  it.each(["database_tls", "database_environment_boundary"] as const)(
    "logs the refined %s database stage without logging a secret-bearing exception",
    async (stage) => {
      const unsafeDatabaseUrl =
        "postgresql://postgres.project:database-password@aws-0.pooler.supabase.com/postgres?sslmode=require";
      const consoleError = vi.spyOn(console, "error");
      consoleError.mockImplementation(() => {});
      mocks.createDatabase.mockImplementationOnce(
        (_url: unknown, setStage: (value: typeof stage) => void) => {
          setStage(stage);
          throw new Error(`unsafe ${unsafeDatabaseUrl}`);
        },
      );

      const response = await POST(
        new Request("http://localhost/api/internal/interpretation/dispatch", {
          headers: { Authorization: "Bearer accepted" },
          method: "POST",
        }),
      );

      expect(response.status).toBe(503);
      await expect(response.text()).resolves.toBe(
        '{"error":"Interpretation dispatch is unavailable."}',
      );
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith({
        event: "interpretation_dispatch_unavailable",
        stage,
      });
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
        unsafeDatabaseUrl,
      );
      expect(mocks.createProvider).toHaveBeenCalledTimes(1);
      expect(mocks.createDatabase).toHaveBeenCalledTimes(1);
      expect(mocks.repositoryConstructor).not.toHaveBeenCalled();
      expect(mocks.processNext).not.toHaveBeenCalled();
    },
  );

  it("keeps successful dispatch behavior and operation cardinality unchanged", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal/interpretation/dispatch", {
        headers: { Authorization: "Bearer accepted" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('{"state":"idle"}');
    expect(mocks.authorizeDispatch).toHaveBeenCalledTimes(1);
    expect(mocks.createProvider).toHaveBeenCalledTimes(1);
    expect(mocks.createDatabase).toHaveBeenCalledTimes(1);
    expect(mocks.repositoryConstructor).toHaveBeenCalledTimes(1);
    expect(mocks.processNext).toHaveBeenCalledTimes(1);
    expect(databaseEnd).toHaveBeenCalledTimes(1);
  });

  it("classifies delegated provider failures without adding provider calls", async () => {
    const providerInterpret = vi.fn();
    providerInterpret.mockRejectedValue(new Error("provider"));
    const consoleError = vi.spyOn(console, "error");
    consoleError.mockImplementation(() => {});
    mocks.createProvider.mockReturnValue({
      interpret: providerInterpret,
      modelId: "test-model",
      providerId: "openai",
    });
    mocks.processNext.mockImplementationOnce(async ({ provider }) => {
      await provider.interpret(
        { evidence: [], promptVersion: "v", schemaVersion: "v" },
        { signal: new AbortController().signal },
      );
    });

    const response = await POST(
      new Request("http://localhost/api/internal/interpretation/dispatch", {
        headers: { Authorization: "Bearer accepted" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(503);
    expect(providerInterpret).toHaveBeenCalledTimes(1);
    expect(mocks.processNext).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith({
      event: "interpretation_dispatch_unavailable",
      stage: "provider_call",
    });
  });
});
