// This closed vocabulary is part of candidate-set-v2's immutable contract.
export const epistemicModes = [
  "estimate",
  "belief",
  "assessment",
  "report",
  "feeling",
] as const;
export type EpistemicMode = (typeof epistemicModes)[number];
export type Scalar = string | number | boolean;
export type CoreProposition = {
  subject: string;
  predicate: string;
  object: Scalar;
};
export type CandidateMeaningV2 =
  | (CoreProposition & { kind: "proposition" })
  | (CoreProposition & {
      kind: "epistemic_proposition";
      epistemic: { actor: string; mode: EpistemicMode };
    });

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function exactKeys(value: Record<string, unknown>, keys: string[]) {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

export function isEpistemicMode(value: unknown): value is EpistemicMode {
  return (
    typeof value === "string" && epistemicModes.some((mode) => mode === value)
  );
}

export function validCore(value: Record<string, unknown>) {
  return (
    typeof value.subject === "string" &&
    value.subject.trim().length > 0 &&
    value.subject.length <= 160 &&
    typeof value.predicate === "string" &&
    /^[a-z][a-z0-9_]{0,63}$/.test(value.predicate) &&
    ((typeof value.object === "string" && value.object.length <= 500) ||
      (typeof value.object === "number" && Number.isFinite(value.object)) ||
      typeof value.object === "boolean")
  );
}

export function parseCandidateMeaningV2(value: unknown): CandidateMeaningV2 {
  if (!isRecord(value) || !validCore(value))
    throw new Error("Invalid candidate-set-v2 meaning.");
  const base = ["kind", "subject", "predicate", "object"];
  if (value.kind === "proposition" && exactKeys(value, base))
    return value as CandidateMeaningV2;
  if (
    value.kind === "epistemic_proposition" &&
    exactKeys(value, [...base, "epistemic"]) &&
    isRecord(value.epistemic) &&
    exactKeys(value.epistemic, ["actor", "mode"]) &&
    typeof value.epistemic.actor === "string" &&
    value.epistemic.actor.trim().length > 0 &&
    value.epistemic.actor.length <= 160 &&
    isEpistemicMode(value.epistemic.mode)
  ) {
    return value as CandidateMeaningV2;
  }
  throw new Error("Invalid candidate-set-v2 meaning.");
}
