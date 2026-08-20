export const bootstrapStatus = {
  status: "ok",
  service: "realme-1-2",
  architecture: "modular-monolith",
  phase: "step-98-implementation-candidate",
} as const;

export function getHealth() {
  return bootstrapStatus;
}
