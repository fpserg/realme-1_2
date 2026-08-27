import { describe, expect, it, vi } from "vitest";

import {
  interpretationDatabaseUrl,
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
