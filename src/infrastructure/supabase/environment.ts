export type RealMeEnvironment =
  | "local"
  | "preview"
  | "production"
  | "staging"
  | "test";

export interface SupabasePublicConfig {
  environment: RealMeEnvironment;
  publishableKey: string;
  url: string;
}

function projectRefFromUrl(url: string) {
  const hostname = new URL(url).hostname;
  const suffix = ".supabase.co";

  return hostname.endsWith(suffix)
    ? hostname.slice(0, -suffix.length)
    : hostname === "127.0.0.1" || hostname === "localhost"
      ? "local"
      : null;
}

export function validateSupabaseEnvironment(input: {
  dataClassification?: string;
  environment?: string;
  expectedProjectRef?: string;
  publishableKey?: string;
  url?: string;
}): SupabasePublicConfig | null {
  const { expectedProjectRef, publishableKey, url } = input;

  if (!publishableKey || !url) return null;

  const environment = input.environment ?? "local";
  if (
    !["local", "preview", "production", "staging", "test"].includes(environment)
  ) {
    throw new Error("REALME_ENVIRONMENT is invalid.");
  }

  const projectRef = projectRefFromUrl(url);
  if (!projectRef) throw new Error("The Supabase URL is not an approved host.");

  if (projectRef !== "local" && (!input.environment || !expectedProjectRef)) {
    throw new Error(
      "Managed Supabase projects require an explicit context lock.",
    );
  }

  if (expectedProjectRef && projectRef !== expectedProjectRef) {
    throw new Error(
      "The configured Supabase project does not match its context.",
    );
  }

  if (
    (environment === "preview" || environment === "staging") &&
    input.dataClassification !== "synthetic"
  ) {
    throw new Error("Preview and staging contexts must be synthetic-only.");
  }

  if (environment === "production" && input.dataClassification !== "personal") {
    throw new Error("Production must declare its personal-data boundary.");
  }

  return { environment: environment as RealMeEnvironment, publishableKey, url };
}

export function readSupabasePublicConfig() {
  return validateSupabaseEnvironment({
    dataClassification: process.env.REALME_DATA_CLASSIFICATION,
    environment: process.env.REALME_ENVIRONMENT,
    expectedProjectRef: process.env.REALME_EXPECTED_SUPABASE_PROJECT_REF,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}
