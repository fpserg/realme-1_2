const PAYLOAD_PLACEHOLDER = "__STEP107_PAYLOAD_SQL__";
const PAYLOAD_CHUNK_SIZE = 800;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value, label) {
  if (!UUID_PATTERN.test(value ?? "")) {
    throw new Error(`${label} must be a UUID`);
  }
  return value;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function buildControlPlanePayload(
  manifest,
  plan,
  expectedWorldId,
  expectedAccountId,
  options = {},
) {
  requireUuid(expectedWorldId, "expected World id");
  requireUuid(expectedAccountId, "expected account id");

  if (plan.included.length !== 5) {
    throw new Error(
      "control-plane payload requires exactly five included items",
    );
  }
  if (plan.excluded.length !== 1 || plan.excluded[0].authorityClass !== "E") {
    throw new Error(
      "control-plane payload requires exactly one Class E exclusion",
    );
  }
  if (plan.included.some((item) => item.authorityClass === "E")) {
    throw new Error("control-plane payload cannot contain Class E material");
  }
  if (plan.included.some((item) => item.occurredAt !== null)) {
    throw new Error(
      "approved Step 107 control-plane items must keep occurredAt null",
    );
  }

  return {
    version: 1,
    source: {
      repository: manifest.sourceRepository,
      commit: manifest.sourceCommit,
      tree: manifest.sourceTree,
    },
    expected: {
      worldId: expectedWorldId,
      accountId: expectedAccountId,
    },
    excludedClassECount: 1,
    items: plan.included.map((item) => ({
      id: item.id,
      authorityClass: item.authorityClass,
      sourceKind: item.sourceKind,
      sourceRepository: item.sourceRepository,
      sourceCommit: item.sourceCommit,
      sourceTree: item.sourceTree,
      sourcePath: item.sourcePath,
      sourceBlobSha: item.sourceBlobSha,
      sourceLocator: item.sourceLocator,
      contentHash: item.contentHash,
      operationalDay: item.operationalDay,
      occurredAt: item.occurredAt,
      observationId: item.observationId,
      sourceFragmentId: item.sourceFragmentId,
      captureIdempotencyKey: item.captureIdempotencyKey,
      exactTextBase64: Buffer.from(item.exactText, "utf8").toString("base64"),
    })),
    test: {
      failAfterObservationInsert: options.failAfterObservationInsert === true,
    },
  };
}

export function encodeControlPlanePayload(payload) {
  const encoded = Buffer.from(canonicalJson(payload), "utf8").toString(
    "base64",
  );
  if (!/^[A-Za-z0-9+/=]+$/.test(encoded)) {
    throw new Error("control-plane payload encoding is not base64-safe");
  }
  return encoded;
}

export function renderControlPlanePayloadSql(payload) {
  const encoded = encodeControlPlanePayload(payload);
  const chunks = [];
  for (let offset = 0; offset < encoded.length; offset += PAYLOAD_CHUNK_SIZE) {
    chunks.push(`'${encoded.slice(offset, offset + PAYLOAD_CHUNK_SIZE)}'`);
  }
  return chunks.join(" ||\n      ");
}

export function renderControlPlaneSql(template, payload) {
  const first = template.indexOf(PAYLOAD_PLACEHOLDER);
  if (first < 0 || template.indexOf(PAYLOAD_PLACEHOLDER, first + 1) >= 0) {
    throw new Error(
      "control-plane SQL template must contain one payload placeholder",
    );
  }
  return template.replace(PAYLOAD_PLACEHOLDER, renderControlPlanePayloadSql(payload));
}

export function decodeControlPlanePayloadFromSql(sql) {
  const decodeCall = sql.match(/decode\(([\s\S]*?),\s*'base64'\)/);
  if (!decodeCall) throw new Error("control-plane SQL payload not found");
  const chunks = [...decodeCall[1].matchAll(/'([A-Za-z0-9+/=]+)'/g)].map(
    (match) => match[1],
  );
  if (chunks.length === 0) throw new Error("control-plane SQL chunks missing");
  return JSON.parse(Buffer.from(chunks.join(""), "base64").toString("utf8"));
}
