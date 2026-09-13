import { describe, expect, it, vi } from "vitest";

import {
  interpretationDatabaseUrl,
  type InterpretationDatabaseDiagnosticStage,
  PostgresInterpretationJobRepository,
} from "./interpretation-job-repository";

describe("interpretation worker database environment", () => {
  it("accepts local development and a matching synthetic Supabase pooler", () => {
    expect(
      interpretationDatabaseUrl({
        REALME_ENVIRONMENT: "local",
        REALME_INTERPRETATION_DATABASE_URL:
          "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      }),
    ).toContain("127.0.0.1");

    expect(
      interpretationDatabaseUrl({
        REALME_DATA_CLASSIFICATION: "synthetic",
        REALME_ENVIRONMENT: "preview",
        REALME_EXPECTED_SUPABASE_PROJECT_REF: "stagingref",
        REALME_INTERPRETATION_DATABASE_URL:
          "postgresql://postgres.stagingref:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require",
      }),
    ).toContain("stagingref");
  });

  it("rejects arbitrary hosts, context mismatch, missing TLS and personal preview data", () => {
    expect(() =>
      interpretationDatabaseUrl({
        REALME_INTERPRETATION_DATABASE_URL:
          "postgresql://postgres:secret@database.example/postgres",
      }),
    ).toThrow("not approved");

    expect(() =>
      interpretationDatabaseUrl({
        REALME_DATA_CLASSIFICATION: "synthetic",
        REALME_ENVIRONMENT: "preview",
        REALME_EXPECTED_SUPABASE_PROJECT_REF: "stagingref",
        REALME_INTERPRETATION_DATABASE_URL:
          "postgresql://postgres.productionref:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require",
      }),
    ).toThrow("does not match");

    expect(() =>
      interpretationDatabaseUrl({
        REALME_DATA_CLASSIFICATION: "synthetic",
        REALME_ENVIRONMENT: "preview",
        REALME_EXPECTED_SUPABASE_PROJECT_REF: "stagingref",
        REALME_INTERPRETATION_DATABASE_URL:
          "postgresql://postgres.stagingref:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
      }),
    ).toThrow("require TLS");

    expect(() =>
      interpretationDatabaseUrl({
        REALME_DATA_CLASSIFICATION: "personal",
        REALME_ENVIRONMENT: "preview",
        REALME_EXPECTED_SUPABASE_PROJECT_REF: "stagingref",
        REALME_INTERPRETATION_DATABASE_URL:
          "postgresql://postgres.stagingref:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require",
      }),
    ).toThrow("synthetic-only");
  });

  it.each(["preview", "staging", "production"])(
    "rejects localhost in the %s environment",
    (environment) => {
      expect(() =>
        interpretationDatabaseUrl({
          REALME_DATA_CLASSIFICATION:
            environment === "production" ? "personal" : "synthetic",
          REALME_ENVIRONMENT: environment,
          REALME_EXPECTED_SUPABASE_PROJECT_REF: "local",
          REALME_INTERPRETATION_DATABASE_URL:
            "postgresql://postgres:postgres@localhost:54322/postgres",
        }),
      ).toThrow("local development");
    },
  );

  it("rejects supported loopback representations outside local development", () => {
    for (const host of ["127.0.0.1", "[::1]"]) {
      expect(() =>
        interpretationDatabaseUrl({
          REALME_DATA_CLASSIFICATION: "synthetic",
          REALME_ENVIRONMENT: "preview",
          REALME_EXPECTED_SUPABASE_PROJECT_REF: "local",
          REALME_INTERPRETATION_DATABASE_URL: `postgresql://postgres:postgres@${host}:54322/postgres`,
        }),
      ).toThrow("local development");
    }
  });

  it("preserves username decoding failure before localhost rejection", () => {
    let stage: InterpretationDatabaseDiagnosticStage | undefined;
    const invoke = () =>
      interpretationDatabaseUrl(
        {
          REALME_ENVIRONMENT: "production",
          REALME_INTERPRETATION_DATABASE_URL:
            "postgresql://postgres%ZZ:secret@localhost:5432/postgres",
        },
        (value) => {
          stage = value;
        },
      );

    expect(invoke).toThrow(URIError);
    expect(invoke).toThrow("URI malformed");
    expect(stage).toBe("database_username_or_project_ref");
  });

  it.each([
    {
      environment: {},
      expected: "database_url_presence",
    },
    {
      environment: {
        REALME_INTERPRETATION_DATABASE_URL: "not a url",
      },
      expected: "database_url_parse",
    },
    {
      environment: {
        REALME_INTERPRETATION_DATABASE_URL:
          "https://postgres:secret@db.project.supabase.co/postgres",
      },
      expected: "database_protocol",
    },
    {
      environment: {
        REALME_ENVIRONMENT: "production",
        REALME_INTERPRETATION_DATABASE_URL:
          "postgresql://postgres:secret@localhost:5432/postgres",
      },
      expected: "database_host",
    },
    {
      environment: {
        REALME_INTERPRETATION_DATABASE_URL:
          "postgresql://postgres:secret@database.example/postgres",
      },
      expected: "database_username_or_project_ref",
    },
    {
      environment: {
        REALME_DATA_CLASSIFICATION: "synthetic",
        REALME_ENVIRONMENT: "preview",
        REALME_EXPECTED_SUPABASE_PROJECT_REF: "stagingref",
        REALME_INTERPRETATION_DATABASE_URL:
          "postgresql://postgres.stagingref:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
      },
      expected: "database_tls",
    },
    {
      environment: {
        REALME_DATA_CLASSIFICATION: "personal",
        REALME_ENVIRONMENT: "preview",
        REALME_EXPECTED_SUPABASE_PROJECT_REF: "stagingref",
        REALME_INTERPRETATION_DATABASE_URL:
          "postgresql://postgres.stagingref:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require",
      },
      expected: "database_environment_boundary",
    },
  ] as const)(
    "reports $expected immediately before the existing failing database gate",
    ({ environment, expected }) => {
      let stage: InterpretationDatabaseDiagnosticStage | undefined;
      expect(() =>
        interpretationDatabaseUrl(environment, (value) => {
          stage = value;
        }),
      ).toThrow();
      expect(stage).toBe(expected);
    },
  );

  it("reports the unchanged successful validation sequence without altering the returned URL", () => {
    const stages: InterpretationDatabaseDiagnosticStage[] = [];
    const url =
      "postgresql://postgres.stagingref:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require";
    expect(
      interpretationDatabaseUrl(
        {
          REALME_DATA_CLASSIFICATION: "synthetic",
          REALME_ENVIRONMENT: "preview",
          REALME_EXPECTED_SUPABASE_PROJECT_REF: "stagingref",
          REALME_INTERPRETATION_DATABASE_URL: url,
        },
        (stage) => stages.push(stage),
      ),
    ).toBe(url);
    expect(stages).toEqual([
      "database_url_presence",
      "database_url_parse",
      "database_protocol",
      "database_host",
      "database_username_or_project_ref",
      "database_host",
      "database_username_or_project_ref",
      "database_tls",
      "database_environment_boundary",
    ]);
  });

  it("runs stale-final terminalization before ordinary claim selection", async () => {
    const statements: string[] = [];
    const transaction = vi.fn((strings: TemplateStringsArray) => {
      statements.push(strings.join("?"));
      return Promise.resolve([]);
    });
    const sql = {
      begin: vi.fn(
        (callback: (input: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const repository = new PostgresInterpretationJobRepository(sql as never);

    await expect(
      repository.claim("33333333-3333-4333-8333-333333333333"),
    ).resolves.toBeNull();
    expect(statements[0]).toContain(
      "public.terminalize_stale_final_interpretation_job()",
    );
    expect(statements[1]).toContain("job.attempts < job.max_attempts");
  });
});
