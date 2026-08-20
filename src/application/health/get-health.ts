export const bootstrapStatus = {
  status: "ok",
  service: "realme-1-2",
  architecture: "modular-monolith",
  phase: "step-97-accepted-step-98-not-started",
} as const;

export function getHealth() {
  return bootstrapStatus;
}
