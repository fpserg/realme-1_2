export const bootstrapStatus = {
  status: "ok",
  service: "realme-1-2",
  architecture: "modular-monolith",
  phase: "step-99-implementation-candidate",
} as const;

export function getHealth() {
  return bootstrapStatus;
}
