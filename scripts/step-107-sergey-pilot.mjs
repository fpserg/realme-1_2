import { createHash } from 'node:crypto';

export const AUTHORITY_CLASSES = new Set(['A', 'B', 'C', 'D', 'E']);
export const IMPORTABLE_CLASSES = new Set(['A', 'B', 'C', 'D']);
export const CANONICAL_TABLES = new Set([
  'ontology_nodes',
  'ontology_aliases',
  'ontology_relationships',
  'assertions',
  'assertion_evidence',
  'admission_decisions',
]);

export class SourceValidationError extends Error {}
export class AmbiguousIdentityError extends Error {}

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function deterministicUuid(seed) {
  const bytes = Buffer.from(sha256(seed).slice(0, 32), 'hex');
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function requireIsoInstant(value, itemId) {
  if (value == null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new SourceValidationError(`${itemId}: occurredAt must be an exact ISO instant or null`);
  }
  return value;
}

export function validateManifest(manifest) {
  if (!manifest || manifest.version !== 1) throw new SourceValidationError('manifest version must be 1');
  if (!manifest.sourceRepository || !/^[^/]+\/[^/]+$/.test(manifest.sourceRepository)) {
    throw new SourceValidationError('sourceRepository must be owner/repo');
  }
  if (!/^[0-9a-f]{40}$/.test(manifest.sourceCommit ?? '')) throw new SourceValidationError('sourceCommit must be pinned');
  if (!/^[0-9a-f]{40}$/.test(manifest.sourceTree ?? '')) throw new SourceValidationError('sourceTree must be pinned');
  if (!Array.isArray(manifest.items) || manifest.items.length === 0) throw new SourceValidationError('items required');
  const ids = new Set();
  for (const item of manifest.items) {
    if (!item.id || ids.has(item.id)) throw new SourceValidationError('item ids must be unique');
    ids.add(item.id);
    if (!AUTHORITY_CLASSES.has(item.authorityClass)) throw new SourceValidationError(`${item.id}: invalid authority class`);
    if (!/^[0-9a-f]{40}$/.test(item.blobSha ?? '')) throw new SourceValidationError(`${item.id}: blobSha required`);
    if (!item.path || item.path.includes('..')) throw new SourceValidationError(`${item.id}: unsafe path`);
    if (!['import', 'exclude'].includes(item.action)) throw new SourceValidationError(`${item.id}: invalid action`);
    if (item.action === 'exclude' && !item.excludeReason) throw new SourceValidationError(`${item.id}: exclude reason required`);
    if (item.action === 'import' && !IMPORTABLE_CLASSES.has(item.authorityClass)) {
      throw new SourceValidationError(`${item.id}: presentation-only material cannot be imported`);
    }
    if (!item.selection || !['whole_file', 'exact_text'].includes(item.selection.kind)) {
      throw new SourceValidationError(`${item.id}: unsupported selection`);
    }
    if (item.selection.kind === 'exact_text' && !item.selection.text) {
      throw new SourceValidationError(`${item.id}: exact_text selection requires text`);
    }
    requireIsoInstant(item.occurredAt, item.id);
  }
  return manifest;
}

export function extractSourceText(fileText, item) {
  if (typeof fileText !== 'string') throw new SourceValidationError(`${item.id}: source file missing`);
  if (item.selection.kind === 'whole_file') return fileText;
  const needle = item.selection.text;
  const first = fileText.indexOf(needle);
  if (first < 0) throw new SourceValidationError(`${item.id}: exact text not found`);
  if (fileText.indexOf(needle, first + needle.length) >= 0) {
    throw new SourceValidationError(`${item.id}: exact text is not unique`);
  }
  return needle;
}

export function buildSourceLocator(manifest, item) {
  const selection = item.selection.kind === 'whole_file' ? 'whole_file' : `exact_text:${sha256(item.selection.text)}`;
  return `${manifest.sourceRepository}@${manifest.sourceCommit}:${item.path}#${selection}`;
}

export function buildImportPlan(manifest, filesByPath) {
  validateManifest(manifest);
  const included = [];
  const excluded = [];
  for (const item of manifest.items) {
    if (item.action === 'exclude') {
      excluded.push({ id: item.id, authorityClass: item.authorityClass, reason: item.excludeReason });
      continue;
    }
    const exactText = extractSourceText(filesByPath[item.path], item);
    const locator = buildSourceLocator(manifest, item);
    const contentHash = sha256(exactText);
    const observationId = deterministicUuid(`observation|${locator}`);
    const sourceFragmentId = deterministicUuid(`fragment|${locator}|0`);
    const captureIdempotencyKey = deterministicUuid(`capture|${locator}`);
    included.push({
      id: item.id,
      authorityClass: item.authorityClass,
      sourceKind: item.sourceKind,
      sourceRepository: manifest.sourceRepository,
      sourceCommit: manifest.sourceCommit,
      sourceTree: manifest.sourceTree,
      sourcePath: item.path,
      sourceBlobSha: item.blobSha,
      sourceLocator: locator,
      contentHash,
      operationalDay: item.operationalDay ?? null,
      occurredAt: requireIsoInstant(item.occurredAt, item.id),
      observationId,
      sourceFragmentId,
      captureIdempotencyKey,
      exactText,
    });
  }
  return { included, excluded };
}

export function buildEvidenceRows(plan, serverDerivedWorldId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(serverDerivedWorldId ?? '')) {
    throw new SourceValidationError('server-derived World id required');
  }
  return plan.included.map((item) => ({
    observation: {
      id: item.observationId,
      world_id: serverDerivedWorldId,
      source_kind: `sergey_pilot:${item.authorityClass}:${item.sourceKind}`,
      source_locator: item.sourceLocator,
      occurred_at: item.occurredAt,
      occurred_precision: item.occurredAt ? 'exact' : 'unknown',
      local_calendar_date: item.operationalDay,
      capture_idempotency_key: item.captureIdempotencyKey,
    },
    fragment: {
      id: item.sourceFragmentId,
      world_id: serverDerivedWorldId,
      observation_id: item.observationId,
      ordinal: 0,
      exact_text: item.exactText,
      content_hash: item.contentHash,
    },
  }));
}

export function buildCandidateRequests(plan) {
  return plan.included.map((item) => ({
    sourceItemId: item.id,
    observationId: item.observationId,
    evidenceSourceFragmentId: item.sourceFragmentId,
    authorityClass: item.authorityClass,
    admissionAuthority: 'none',
  }));
}

export function assertNoCanonicalWrites(payload) {
  for (const key of Object.keys(payload ?? {})) {
    if (CANONICAL_TABLES.has(key)) throw new SourceValidationError(`import planner attempted canonical write: ${key}`);
  }
  return true;
}

export function resolveExplicitIdentityMappings(entries) {
  const bySource = new Map();
  const byNormalizedLabel = new Map();
  for (const entry of entries) {
    if (!entry.sourceIdentity || !entry.nativeNodeId || !entry.label) throw new SourceValidationError('identity mapping is incomplete');
    const prior = bySource.get(entry.sourceIdentity);
    if (prior && prior !== entry.nativeNodeId) throw new AmbiguousIdentityError(`source identity ${entry.sourceIdentity} maps to multiple native ids`);
    bySource.set(entry.sourceIdentity, entry.nativeNodeId);
    const normalized = entry.label.trim().replace(/\s+/g, ' ').toLowerCase();
    const labelSet = byNormalizedLabel.get(normalized) ?? new Set();
    labelSet.add(entry.nativeNodeId);
    byNormalizedLabel.set(normalized, labelSet);
  }
  const ambiguities = [...byNormalizedLabel.entries()]
    .filter(([, ids]) => ids.size > 1)
    .map(([label, ids]) => ({ label, nativeNodeIds: [...ids].sort() }));
  return { bySource: Object.fromEntries(bySource), ambiguities };
}

export function reconciliationFingerprint(rows) {
  const canonical = rows
    .map((row) => JSON.stringify(row, Object.keys(row).sort()))
    .sort()
    .join('\n');
  return sha256(canonical);
}
