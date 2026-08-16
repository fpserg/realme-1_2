export const bootstrapStatus = {
  status: "ok",
  service: "realme-1-2",
  architecture: "modular-monolith",
  phase: "step-96-accepted-step-97-not-started",
} as const;

export function getHealth() {
  return bootstrapStatus;
}
