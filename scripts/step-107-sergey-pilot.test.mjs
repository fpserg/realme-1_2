import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  AmbiguousIdentityError,
  SourceValidationError,
  assertNoCanonicalWrites,
  buildCandidateRequests,
  buildEvidenceRows,
  buildImportPlan,
  deterministicUuid,
  reconciliationFingerprint,
  resolveExplicitIdentityMappings,
  sha256,
  validateManifest,
} from './step-107-sergey-pilot.mjs';

const manifest = {
  version: 1,
  sourceRepository: 'fpserg/RealMe',
  sourceCommit: 'b701e303e0e716dd54099938fab092d419d30e61',
  sourceTree: 'b5b3edd5d31cc1a4955a493ad0d9dd8948550d88',
  items: [
    {
      id: 'li', path: 'daily/LI.md', blobSha: 'a'.repeat(40), authorityClass: 'A', sourceKind: 'living_input',
      selection: { kind: 'whole_file' }, operationalDay: '2026-08-30', occurredAt: null, action: 'import',
    },
    {
      id: 'derived', path: 'daily/OR.md', blobSha: 'b'.repeat(40), authorityClass: 'B', sourceKind: 'operational_record',
      selection: { kind: 'exact_text', text: '- Exact derived fact.' }, operationalDay: '2026-08-30', occurredAt: '2026-08-30T10:15:00.000Z', action: 'import',
    },
    {
      id: 'decorative', path: 'world.md', blobSha: 'c'.repeat(40), authorityClass: 'E', sourceKind: 'presentation_only',
      selection: { kind: 'exact_text', text: 'GREEN' }, operationalDay: null, occurredAt: null, action: 'exclude', excludeReason: 'presentation_only',
    },
  ],
};

const files = {
  'daily/LI.md': 'LI\n\nVerbatim historical input.\n',
  'daily/OR.md': '# OR\n\n- Exact derived fact.\n',
  'world.md': 'GREEN',
};

describe('Step 107 Sergey pilot planner', () => {
  it('pins repository, commit and tree and rejects malformed manifests', () => {
    expect(validateManifest(manifest)).toBe(manifest);
    expect(() => validateManifest({ ...manifest, sourceCommit: 'main' })).toThrow(SourceValidationError);
  });

  it('uses whole-file LI segmentation and exact unique anchors only', () => {
    const plan = buildImportPlan(manifest, files);
    expect(plan.included[0].exactText).toBe(files['daily/LI.md']);
    expect(() => buildImportPlan({ ...manifest, items: [{ ...manifest.items[1], selection: { kind: 'exact_text', text: 'missing' } }] }, files)).toThrow(SourceValidationError);
    expect(() => buildImportPlan({ ...manifest, items: [{ ...manifest.items[1], selection: { kind: 'exact_text', text: 'same' } }] }, { 'daily/OR.md': 'same same' })).toThrow(SourceValidationError);
  });

  it('produces deterministic fingerprints and replay-stable ids', () => {
    const first = buildImportPlan(manifest, files);
    const second = buildImportPlan(manifest, files);
    expect(first).toEqual(second);
    expect(first.included[0].contentHash).toBe(sha256(files['daily/LI.md']));
    expect(first.included[0].observationId).toBe(deterministicUuid(`observation|${first.included[0].sourceLocator}`));
  });

  it('preserves unknown timestamp as unknown and exact timestamp verbatim', () => {
    const plan = buildImportPlan(manifest, files);
    expect(plan.included[0].occurredAt).toBeNull();
    expect(plan.included[1].occurredAt).toBe('2026-08-30T10:15:00.000Z');
    expect(() => validateManifest({ ...manifest, items: [{ ...manifest.items[0], occurredAt: '2026-08-30' }] })).toThrow(SourceValidationError);
  });

  it('keeps derived authority explicit and excludes presentation material', () => {
    const plan = buildImportPlan(manifest, files);
    expect(plan.included.map((item) => item.authorityClass)).toEqual(['A', 'B']);
    expect(plan.excluded).toEqual([{ id: 'decorative', authorityClass: 'E', reason: 'presentation_only' }]);
  });

  it('derives World ownership only from an executor argument, never the source manifest', () => {
    const plan = buildImportPlan(manifest, files);
    const world = '11111111-1111-4111-8111-111111111111';
    const rows = buildEvidenceRows(plan, world);
    expect(rows.every((row) => row.observation.world_id === world && row.fragment.world_id === world)).toBe(true);
    expect(rows[0].observation.local_calendar_date).toBe('2026-08-30');
    expect(rows[0].fragment).toHaveProperty('content_hash');
    expect(() => buildEvidenceRows(plan, 'not-a-world')).toThrow(SourceValidationError);
  });

  it('emits evidence and candidate requests but no canonical mutation authority', () => {
    const plan = buildImportPlan(manifest, files);
    const candidates = buildCandidateRequests(plan);
    expect(candidates.every((candidate) => candidate.admissionAuthority === 'none')).toBe(true);
    expect(assertNoCanonicalWrites({ observations: [], source_fragments: [], candidateRequests: candidates })).toBe(true);
    expect(() => assertNoCanonicalWrites({ assertions: [] })).toThrow(SourceValidationError);
  });

  it('keeps the SQL executor evidence-only and replay-safe', async () => {
    const sql = await readFile(new URL('./step-107-import-evidence.sql', import.meta.url), 'utf8');
    expect(sql).toContain('INSERT INTO public.observations');
    expect(sql).toContain('INSERT INTO public.source_fragments');
    expect(sql).toContain('ON CONFLICT (id) DO NOTHING');
    for (const table of ['admission_decisions', 'ontology_nodes', 'ontology_aliases', 'ontology_relationships', 'assertions', 'assertion_evidence']) {
      expect(sql).not.toMatch(new RegExp(`(?:INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+public\\.${table}`, 'i'));
    }
  });

  it('fails closed on ambiguous identity mappings', () => {
    expect(() => resolveExplicitIdentityMappings([
      { sourceIdentity: 'legacy:household', nativeNodeId: '11111111-1111-4111-8111-111111111111', label: 'Household' },
      { sourceIdentity: 'legacy:household', nativeNodeId: '22222222-2222-4222-8222-222222222222', label: 'Household' },
    ])).toThrow(AmbiguousIdentityError);

    const result = resolveExplicitIdentityMappings([
      { sourceIdentity: 'legacy:a', nativeNodeId: '11111111-1111-4111-8111-111111111111', label: 'Same Name' },
      { sourceIdentity: 'legacy:b', nativeNodeId: '22222222-2222-4222-8222-222222222222', label: ' same   name ' },
    ]);
    expect(result.ambiguities).toHaveLength(1);
  });

  it('creates stable reconciliation fingerprints independent of row order', () => {
    const a = [{ id: '2', value: 'b' }, { id: '1', value: 'a' }];
    const b = [...a].reverse();
    expect(reconciliationFingerprint(a)).toBe(reconciliationFingerprint(b));
  });
});
