import type { RealMeEnvironment } from "@/infrastructure/supabase/environment";

type ApplicationUrlEnvironment = Readonly<{
  [key: string]: string | undefined;
  DEPLOY_PRIME_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
  URL?: string;
}>;

function applicationOrigin(value: string, source: string) {
  const url = new URL(value);

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${source} is not a valid application origin.`);
  }

  return url.origin;
}

export function resolveAuthCallbackUrl(
  environment: RealMeEnvironment,
  runtime: ApplicationUrlEnvironment,
) {
  let source: string;
  let value: string | undefined;

  if (environment === "production") {
    source = "the canonical production application URL";
    value = runtime.URL ?? runtime.NEXT_PUBLIC_APP_URL;
  } else if (environment === "preview" || environment === "staging") {
    source = "the isolated deploy application URL";
    value = runtime.DEPLOY_PRIME_URL;
  } else {
    source = "the local application URL";
    value =
      runtime.NEXT_PUBLIC_APP_URL ??
      runtime.DEPLOY_PRIME_URL ??
      runtime.URL ??
      "http://127.0.0.1:3000";
  }

  if (!value) throw new Error(`${source} is required.`);

  return new URL("/auth/callback", applicationOrigin(value, source)).toString();
}
