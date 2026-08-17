import { describe, expect, it } from "vitest";

import { validateSupabaseEnvironment } from "./environment";

describe("validateSupabaseEnvironment", () => {
  it("keeps unconfigured builds inert", () => {
    expect(validateSupabaseEnvironment({})).toBeNull();
  });

  it("accepts a matching synthetic preview", () => {
    expect(
      validateSupabaseEnvironment({
        dataClassification: "synthetic",
        environment: "preview",
        expectedProjectRef: "staging-ref",
        publishableKey: "sb_publishable_test",
        url: "https://staging-ref.supabase.co",
      }),
    ).toMatchObject({ environment: "preview" });
  });

  it("rejects personal data and project mismatch in previews", () => {
    expect(() =>
      validateSupabaseEnvironment({
        dataClassification: "personal",
        environment: "preview",
        expectedProjectRef: "staging-ref",
        publishableKey: "sb_publishable_test",
        url: "https://staging-ref.supabase.co",
      }),
    ).toThrow("synthetic-only");

    expect(() =>
      validateSupabaseEnvironment({
        dataClassification: "synthetic",
        environment: "preview",
        expectedProjectRef: "staging-ref",
        publishableKey: "sb_publishable_test",
        url: "https://production-ref.supabase.co",
      }),
    ).toThrow("does not match");
  });

  it("rejects managed projects without an explicit context lock", () => {
    expect(() =>
      validateSupabaseEnvironment({
        publishableKey: "sb_publishable_test",
        url: "https://staging-ref.supabase.co",
      }),
    ).toThrow("explicit context lock");
  });

  it("requires an explicit personal-data boundary in production", () => {
    expect(() =>
      validateSupabaseEnvironment({
        dataClassification: "synthetic",
        environment: "production",
        expectedProjectRef: "production-ref",
        publishableKey: "sb_publishable_test",
        url: "https://production-ref.supabase.co",
      }),
    ).toThrow("personal-data boundary");
  });
});
