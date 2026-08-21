import { describe, expect, it } from "vitest";

import { interpretationDatabaseUrl } from "./interpretation-job-repository";

describe("interpretation worker database environment", () => {
  it("accepts local development and a matching synthetic Supabase pooler", () => {
    expect(
      interpretationDatabaseUrl({
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
});
