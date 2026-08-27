import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function authorizeDispatch(
  authorizationHeader: string | null,
  configuredSecret: string | undefined,
) {
  if (!configuredSecret || configuredSecret.length < 32) return false;
  if (!authorizationHeader?.startsWith("Bearer ")) return false;
  const supplied = authorizationHeader.slice("Bearer ".length);
  return timingSafeEqual(digest(supplied), digest(configuredSecret));
}
