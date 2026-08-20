export const bootstrapStatus = {
  status: "ok",
  service: "realme-1-2",
  architecture: "modular-monolith",
  phase: "step-101-implementation-candidate",
} as const;

export function getHealth() {
  return bootstrapStatus;
}
