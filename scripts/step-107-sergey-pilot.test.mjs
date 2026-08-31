import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  AmbiguousIdentityError,
  SourceValidationError,
  assertNoCanonicalWrites,
  buildCandidateRequests,
  buildEvidenceRows,
  buildImportPlan,
  deterministicUuid,
  loadPinnedSourceFiles,
  reconciliationFingerprint,
  resolveExplicitIdentityMappings,
  sha256,
  validateManifest,
} from "./step-107-sergey-pilot.mjs";

const execFileAsync = promisify(execFile);

const manifest = {
  version: 1,
  sourceRepository: "fpserg/RealMe",
  sourceCommit: "b701e303e0e716dd54099938fab092d419d30e61",
  sourceTree: "b5b3edd5d31cc1a4955a493ad0d9dd8948550d88",
  items: [
    {
      id: "li",
      path: "daily/LI.md",
      blobSha: "a".repeat(40),
      authorityClass: "A",
      sourceKind: "living_input",
      selection: { kind: "whole_file" },
      operationalDay: "2026-08-30",
      occurredAt: null,
      action: "import",
    },
    {
      id: "derived",
      path: "daily/OR.md",
      blobSha: "b".repeat(40),
      authorityClass: "B",
      sourceKind: "operational_record",
      selection: { kind: "exact_text", text: "- Exact derived fact." },
      operationalDay: "2026-08-30",
      occurredAt: "2026-08-30T10:15:00.000Z",
      action: "import",
    },
    {
      id: "decorative",
      path: "world.md",
      blobSha: "c".repeat(40),
      authorityClass: "E",
      sourceKind: "presentation_only",
      selection: { kind: "exact_text", text: "GREEN" },
      operationalDay: null,
      occurredAt: null,
      action: "exclude",
      excludeReason: "presentation_only",
    },
  ],
};

const files = {
  "daily/LI.md": "LI\n\nVerbatim historical input.\n",
  "daily/OR.md": "# OR\n\n- Exact derived fact.\n",
  "world.md": "GREEN",
};

async function git(root, ...args) {
  const { stdout } = await execFileAsync("git", ["-C", root, ...args], {
    encoding: "utf8",
  });
  return stdout.trim();
}

async function createPinnedRepo() {
  const root = await mkdtemp(join(tmpdir(), "realme-step107-"));
  await git(root, "init");
  await git(root, "config", "user.email", "step107@example.invalid");
  await git(root, "config", "user.name", "Step 107 Test");
  await mkdir(join(root, "daily"), { recursive: true });
  const committedText = "LI\n\nPinned historical bytes.\n";
  await writeFile(join(root, "daily", "LI.md"), committedText, "utf8");
  await git(root, "add", "daily/LI.md");
  await git(root, "commit", "-m", "pinned source");
  const sourceCommit = await git(root, "rev-parse", "HEAD");
  const sourceTree = await git(root, "show", "-s", "--format=%T", "HEAD");
  const blobSha = await git(root, "rev-parse", `${sourceCommit}:daily/LI.md`);
  const pinnedManifest = {
    version: 1,
    sourceRepository: "fpserg/RealMe",
    sourceCommit,
    sourceTree,
    items: [
      {
        id: "li",
        path: "daily/LI.md",
        blobSha,
        authorityClass: "A",
        sourceKind: "living_input",
        selection: { kind: "whole_file" },
        operationalDay: "2026-08-30",
        occurredAt: null,
        action: "import",
      },
    ],
  };
  return { root, committedText, pinnedManifest, blobSha };
}

describe("Step 107 Sergey pilot planner", () => {
  it("pins repository, commit and tree and rejects malformed manifests", () => {
    expect(validateManifest(manifest)).toBe(manifest);
    expect(() =>
      validateManifest({ ...manifest, sourceCommit: "main" }),
    ).toThrow(SourceValidationError);
  });

  it("reads verified pinned Git blob bytes instead of a modified worktree", async () => {
    const fixture = await createPinnedRepo();
    try {
      await writeFile(
        join(fixture.root, "daily", "LI.md"),
        "MUTABLE WORKTREE CONTENT\n",
        "utf8",
      );
      const loaded = await loadPinnedSourceFiles(
        fixture.root,
        fixture.pinnedManifest,
      );
      expect(loaded["daily/LI.md"]).toBe(fixture.committedText);
      expect(loaded["daily/LI.md"]).not.toContain("MUTABLE WORKTREE");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("fails closed on a wrong manifest blob SHA", async () => {
    const fixture = await createPinnedRepo();
    try {
      const wrong = {
        ...fixture.pinnedManifest,
        items: [
          { ...fixture.pinnedManifest.items[0], blobSha: "f".repeat(40) },
        ],
      };
      await expect(loadPinnedSourceFiles(fixture.root, wrong)).rejects.toThrow(
        /source blob mismatch/,
      );
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("fails closed when the pinned commit is absent", async () => {
    const fixture = await createPinnedRepo();
    try {
      await expect(
        loadPinnedSourceFiles(fixture.root, {
          ...fixture.pinnedManifest,
          sourceCommit: "1".repeat(40),
        }),
      ).rejects.toThrow(SourceValidationError);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("fails closed on source tree mismatch", async () => {
    const fixture = await createPinnedRepo();
    try {
      await expect(
        loadPinnedSourceFiles(fixture.root, {
          ...fixture.pinnedManifest,
          sourceTree: "2".repeat(40),
        }),
      ).rejects.toThrow(/source tree mismatch/);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("fails closed when a pinned path is missing", async () => {
    const fixture = await createPinnedRepo();
    try {
      const missingPath = {
        ...fixture.pinnedManifest,
        items: [
          {
            ...fixture.pinnedManifest.items[0],
            path: "daily/MISSING.md",
          },
        ],
      };
      await expect(
        loadPinnedSourceFiles(fixture.root, missingPath),
      ).rejects.toThrow(SourceValidationError);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("fails closed when the pinned Git blob object is missing", async () => {
    const fixture = await createPinnedRepo();
    try {
      const objectPath = join(
        fixture.root,
        ".git",
        "objects",
        fixture.blobSha.slice(0, 2),
        fixture.blobSha.slice(2),
      );
      await rm(objectPath, { force: true });
      await expect(
        loadPinnedSourceFiles(fixture.root, fixture.pinnedManifest),
      ).rejects.toThrow(SourceValidationError);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it("uses whole-file LI segmentation and exact unique anchors only", () => {
    const plan = buildImportPlan(manifest, files);
    expect(plan.included[0].exactText).toBe(files["daily/LI.md"]);
    expect(() =>
      buildImportPlan(
        {
          ...manifest,
          items: [
            {
              ...manifest.items[1],
              selection: { kind: "exact_text", text: "missing" },
            },
          ],
        },
        files,
      ),
    ).toThrow(SourceValidationError);
    expect(() =>
      buildImportPlan(
        {
          ...manifest,
          items: [
            {
              ...manifest.items[1],
              selection: { kind: "exact_text", text: "same" },
            },
          ],
        },
        { "daily/OR.md": "same same" },
      ),
    ).toThrow(SourceValidationError);
  });

  it("produces deterministic fingerprints and replay-stable ids", () => {
    const first = buildImportPlan(manifest, files);
    const second = buildImportPlan(manifest, files);
    expect(first).toEqual(second);
    expect(first.included[0].contentHash).toBe(sha256(files["daily/LI.md"]));
    expect(first.included[0].observationId).toBe(
      deterministicUuid(`observation|${first.included[0].sourceLocator}`),
    );
  });

  it("preserves unknown timestamp as unknown and exact timestamp verbatim", () => {
    const plan = buildImportPlan(manifest, files);
    expect(plan.included[0].occurredAt).toBeNull();
    expect(plan.included[1].occurredAt).toBe("2026-08-30T10:15:00.000Z");
    expect(() =>
      validateManifest({
        ...manifest,
        items: [{ ...manifest.items[0], occurredAt: "2026-08-30" }],
      }),
    ).toThrow(SourceValidationError);
  });

  it("keeps derived authority explicit and excludes presentation material", () => {
    const plan = buildImportPlan(manifest, files);
    expect(plan.included.map((item) => item.authorityClass)).toEqual([
      "A",
      "B",
    ]);
    expect(plan.excluded).toEqual([
      {
        id: "decorative",
        authorityClass: "E",
        reason: "presentation_only",
      },
    ]);
  });

  it("derives World ownership only from an executor argument, never the source manifest", () => {
    const plan = buildImportPlan(manifest, files);
    const world = "11111111-1111-4111-8111-111111111111";
    const rows = buildEvidenceRows(plan, world);
    expect(
      rows.every(
        (row) =>
          row.observation.world_id === world && row.fragment.world_id === world,
      ),
    ).toBe(true);
    expect(rows[0].observation.local_calendar_date).toBe("2026-08-30");
    expect(rows[0].fragment).toHaveProperty("content_hash");
    expect(() => buildEvidenceRows(plan, "not-a-world")).toThrow(
      SourceValidationError,
    );
  });

  it("emits evidence and candidate requests but no canonical mutation authority", () => {
    const plan = buildImportPlan(manifest, files);
    const candidates = buildCandidateRequests(plan);
    expect(
      candidates.every((candidate) => candidate.admissionAuthority === "none"),
    ).toBe(true);
    expect(
      assertNoCanonicalWrites({
        observations: [],
        source_fragments: [],
        candidateRequests: candidates,
      }),
    ).toBe(true);
    expect(() => assertNoCanonicalWrites({ assertions: [] })).toThrow(
      SourceValidationError,
    );
  });

  it("keeps the SQL executor evidence-only, guarded and replay-safe", async () => {
    const sql = await readFile(
      resolve(process.cwd(), "scripts/step-107-import-evidence.sql"),
      "utf8",
    );
    const runner = await readFile(
      resolve(process.cwd(), "scripts/run-step-107-sergey-pilot.mjs"),
      "utf8",
    );
    expect(sql).toContain("INSERT INTO public.observations");
    expect(sql).toContain("INSERT INTO public.source_fragments");
    expect(sql).toContain("ON CONFLICT (id) DO NOTHING");
    expect(sql).toContain("transactional-v1");
    expect(runner).toContain("await sql.begin(async (tx) =>");
    expect(runner).toContain("realme.step107_executor_guard");
    expect(runner).toContain("realme.step107_world_id");
    expect(runner).toContain("realme.step107_account_id");
    for (const table of [
      "admission_decisions",
      "ontology_nodes",
      "ontology_aliases",
      "ontology_relationships",
      "assertions",
      "assertion_evidence",
    ]) {
      expect(sql).not.toMatch(
        new RegExp(
          `(?:INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+public\\.${table}`,
          "i",
        ),
      );
    }
  });

  it("fails closed on ambiguous identity mappings", () => {
    expect(() =>
      resolveExplicitIdentityMappings([
        {
          sourceIdentity: "legacy:household",
          nativeNodeId: "11111111-1111-4111-8111-111111111111",
          label: "Household",
        },
        {
          sourceIdentity: "legacy:household",
          nativeNodeId: "22222222-2222-4222-8222-222222222222",
          label: "Household",
        },
      ]),
    ).toThrow(AmbiguousIdentityError);

    const result = resolveExplicitIdentityMappings([
      {
        sourceIdentity: "legacy:a",
        nativeNodeId: "11111111-1111-4111-8111-111111111111",
        label: "Same Name",
      },
      {
        sourceIdentity: "legacy:b",
        nativeNodeId: "22222222-2222-4222-8222-222222222222",
        label: " same   name ",
      },
    ]);
    expect(result.ambiguities).toHaveLength(1);
  });

  it("creates stable reconciliation fingerprints independent of row order", () => {
    const a = [
      { id: "2", value: "b" },
      { id: "1", value: "a" },
    ];
    const b = [...a].reverse();
    expect(reconciliationFingerprint(a)).toBe(reconciliationFingerprint(b));
  });
});
