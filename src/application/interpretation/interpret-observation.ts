export const interpretObservationJobKind = "interpret_observation";
export const interpretationPromptVersion = "interpret-observation-v1";
export const interpretationSchemaVersion = "candidate-set-v1";
export const interpretationCandidateLimit = 8;
export const interpretationEvidenceLimit = 8;
export const interpretationEvidenceCharacterLimit = 16_000;

export type InterpretationFailureCode =
  | "cancelled"
  | "configuration_error"
  | "exhausted"
  | "malformed_output"
  | "persistence_failed"
  | "provider_unavailable"
  | "timeout"
  | "validation_failed";

export interface InterpretationEvidenceFragment {
  contentHash: string;
  exactText: string;
  id: string;
  ordinal: number;
}

export interface ClaimedInterpretationJob {
  attemptNumber: number;
  evidence: InterpretationEvidenceFragment[];
  id: string;
  lockToken: string;
  observationId: string;
  worldId: string;
}

export interface InterpretationProviderInput {
  evidence: { exactText: string; reference: string }[];
  promptVersion: string;
  schemaVersion: string;
}

export interface InterpretationProvider {
  readonly modelId: string;
  readonly providerId: string;
  interpret(
    input: InterpretationProviderInput,
    options: { signal: AbortSignal },
  ): Promise<unknown>;
}

export class InterpretationProviderError extends Error {
  constructor(readonly code: InterpretationFailureCode) {
    super("Interpretation provider failed.");
    this.name = "InterpretationProviderError";
  }
}

export class InterpretationValidationError extends Error {
  constructor() {
    super("Interpretation output failed deterministic validation.");
    this.name = "InterpretationValidationError";
  }
}

export interface PersistableCandidate {
  evidenceFragmentIds: string[];
  logicalKey: string;
  payload: {
    confidence: number;
    explanation: string;
    object: boolean | number | string;
    predicate: string;
    schema_version: string;
    subject: string;
  };
}

export interface InterpretationJobRepository {
  claim(workerId: string): Promise<ClaimedInterpretationJob | null>;
  complete(input: {
    candidates: PersistableCandidate[];
    job: ClaimedInterpretationJob;
    runId: string;
  }): Promise<void>;
  fail(input: {
    code: InterpretationFailureCode;
    job: ClaimedInterpretationJob;
    retryable: boolean;
    runId: string | null;
  }): Promise<"failed" | "queued" | "stale">;
  startRun(input: {
    inputHash: string;
    job: ClaimedInterpretationJob;
    model: string;
    promptVersion: string;
    provider: string;
    schemaVersion: string;
  }): Promise<string>;
}

interface RawCandidate {
  confidence: number;
  evidenceReferences: string[];
  explanation: string;
  kind: "proposition";
  object: boolean | number | string;
  predicate: string;
  subject: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]) {
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function boundedString(value: unknown, maximum: number) {
  return (
    typeof value === "string" && value.length > 0 && value.length <= maximum
  );
}

function validateCandidate(value: unknown): RawCandidate {
  if (!isRecord(value)) throw new InterpretationValidationError();
  if (
    !hasExactKeys(value, [
      "confidence",
      "evidenceReferences",
      "explanation",
      "kind",
      "object",
      "predicate",
      "subject",
    ])
  ) {
    throw new InterpretationValidationError();
  }
  if (value.kind !== "proposition") throw new InterpretationValidationError();
  if (!boundedString(value.subject, 160)) {
    throw new InterpretationValidationError();
  }
  if (
    !boundedString(value.predicate, 64) ||
    !/^[a-z][a-z0-9_]*$/.test(value.predicate as string)
  ) {
    throw new InterpretationValidationError();
  }
  if (!boundedString(value.explanation, 500)) {
    throw new InterpretationValidationError();
  }
  if (
    !["boolean", "number", "string"].includes(typeof value.object) ||
    (typeof value.object === "string" && value.object.length > 500) ||
    (typeof value.object === "number" && !Number.isFinite(value.object))
  ) {
    throw new InterpretationValidationError();
  }
  if (
    typeof value.confidence !== "number" ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1
  ) {
    throw new InterpretationValidationError();
  }
  if (
    !Array.isArray(value.evidenceReferences) ||
    value.evidenceReferences.length === 0 ||
    value.evidenceReferences.length > interpretationEvidenceLimit ||
    !value.evidenceReferences.every((reference) => boundedString(reference, 32))
  ) {
    throw new InterpretationValidationError();
  }
  if (
    new Set(value.evidenceReferences).size !== value.evidenceReferences.length
  ) {
    throw new InterpretationValidationError();
  }
  return value as unknown as RawCandidate;
}

export function validateCandidateSet(value: unknown) {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["candidates", "schemaVersion"])
  ) {
    throw new InterpretationValidationError();
  }
  if (value.schemaVersion !== interpretationSchemaVersion) {
    throw new InterpretationValidationError();
  }
  if (
    !Array.isArray(value.candidates) ||
    value.candidates.length > interpretationCandidateLimit
  ) {
    throw new InterpretationValidationError();
  }
  return value.candidates.map(validateCandidate);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new InterpretationValidationError();
  return encoded;
}

export async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function buildInterpretationInput(job: ClaimedInterpretationJob) {
  const evidence = [...job.evidence].sort(
    (left, right) => left.ordinal - right.ordinal,
  );
  if (evidence.length === 0 || evidence.length > interpretationEvidenceLimit) {
    throw new InterpretationValidationError();
  }
  if (
    evidence.some(
      (fragment, index) =>
        fragment.ordinal !== index ||
        !boundedString(fragment.exactText, 8_000) ||
        !boundedString(fragment.contentHash, 128),
    ) ||
    evidence.reduce((total, fragment) => total + fragment.exactText.length, 0) >
      interpretationEvidenceCharacterLimit
  ) {
    throw new InterpretationValidationError();
  }

  return {
    hashContract: {
      evidence: evidence.map((fragment) => ({
        contentHash: fragment.contentHash,
        exactText: fragment.exactText,
        fragmentId: fragment.id,
        ordinal: fragment.ordinal,
      })),
      observationId: job.observationId,
      promptVersion: interpretationPromptVersion,
      schemaVersion: interpretationSchemaVersion,
    },
    providerInput: {
      evidence: evidence.map((fragment, index) => ({
        exactText: fragment.exactText,
        reference: `evidence-${index}`,
      })),
      promptVersion: interpretationPromptVersion,
      schemaVersion: interpretationSchemaVersion,
    } satisfies InterpretationProviderInput,
  };
}

async function prepareCandidates(
  output: unknown,
  evidence: InterpretationEvidenceFragment[],
) {
  const raw = validateCandidateSet(output);
  const fragmentByReference = new Map(
    [...evidence]
      .sort((left, right) => left.ordinal - right.ordinal)
      .map((fragment, index) => [`evidence-${index}`, fragment.id]),
  );
  const prepared: PersistableCandidate[] = [];
  const keys = new Set<string>();

  for (const candidate of raw) {
    const evidenceFragmentIds = candidate.evidenceReferences.map(
      (reference) => {
        const fragmentId = fragmentByReference.get(reference);
        if (!fragmentId) throw new InterpretationValidationError();
        return fragmentId;
      },
    );
    const payload = {
      confidence: candidate.confidence,
      explanation: candidate.explanation,
      object: candidate.object,
      predicate: candidate.predicate,
      schema_version: interpretationSchemaVersion,
      subject: candidate.subject,
    };
    const logicalKey = await sha256Hex(
      canonicalJson({
        evidenceFragmentIds: [...evidenceFragmentIds].sort(),
        payload,
      }),
    );
    if (keys.has(logicalKey)) throw new InterpretationValidationError();
    keys.add(logicalKey);
    prepared.push({ evidenceFragmentIds, logicalKey, payload });
  }
  return prepared;
}

function failure(error: unknown): {
  code: InterpretationFailureCode;
  retryable: boolean;
} {
  if (error instanceof InterpretationValidationError) {
    return { code: "validation_failed", retryable: false };
  }
  if (error instanceof InterpretationProviderError) {
    return {
      code: error.code,
      retryable: ["provider_unavailable", "timeout"].includes(error.code),
    };
  }
  return { code: "persistence_failed", retryable: true };
}

export async function processNextInterpretationJob(input: {
  provider: InterpretationProvider;
  repository: InterpretationJobRepository;
  signal: AbortSignal;
  workerId: string;
}) {
  const job = await input.repository.claim(input.workerId);
  if (!job) return { state: "idle" as const };

  let runId: string | null = null;
  try {
    const prepared = buildInterpretationInput(job);
    const inputHash = await sha256Hex(canonicalJson(prepared.hashContract));
    runId = await input.repository.startRun({
      inputHash,
      job,
      model: input.provider.modelId,
      promptVersion: interpretationPromptVersion,
      provider: input.provider.providerId,
      schemaVersion: interpretationSchemaVersion,
    });
    const output = await input.provider.interpret(prepared.providerInput, {
      signal: input.signal,
    });
    const candidates = await prepareCandidates(output, job.evidence);
    await input.repository.complete({ candidates, job, runId });
    return {
      candidateCount: candidates.length,
      jobId: job.id,
      state: "succeeded" as const,
    };
  } catch (error) {
    const normalized = failure(error);
    const jobState = await input.repository.fail({
      ...normalized,
      job,
      runId,
    });
    return { code: normalized.code, jobId: job.id, state: jobState };
  }
}
