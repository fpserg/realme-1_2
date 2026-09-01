import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import approvedManifest from "./step-107-sergey-pilot-manifest.json" with { type: "json" };
import {
  buildControlPlanePayload,
  decodeControlPlanePayloadFromSql,
  encodeControlPlanePayload,
  renderControlPlaneSql,
} from "./step-107-control-plane.mjs";

const worldId = "11111111-1111-4111-8111-111111111111";
const accountId = "22222222-2222-4222-8222-222222222222";

function approvedShapePlan() {
  const exactTexts = [
    "plain historical input\n",
    "quotes: 'single' and \"double\"\n",
    "newlines\nremain\nexact\n",
    "backslash: \\ and unicode: Москва — 家\n",
    "emoji: 🏗️ exact bytes\n",
  ];
  const classes = ["A", "A", "B", "C", "D"];
  return {
    included: approvedManifest.items
      .filter((item) => item.action === "import")
      .map((item, index) => ({
        id: item.id,
        authorityClass: classes[index],
        sourceKind: item.sourceKind,
        sourceRepository: approvedManifest.sourceRepository,
        sourceCommit: approvedManifest.sourceCommit,
        sourceTree: approvedManifest.sourceTree,
        sourcePath: item.path,
        sourceBlobSha: item.blobSha,
        sourceLocator: `locator-${index}`,
        contentHash: `hash-${index}`,
        operationalDay: item.operationalDay ?? null,
        occurredAt: null,
        observationId: `0000000${index + 1}-0000-4000-8000-00000000000${index + 1}`,
        sourceFragmentId: `1000000${index + 1}-0000-4000-8000-00000000000${index + 1}`,
        captureIdempotencyKey: `2000000${index + 1}-0000-4000-8000-00000000000${index + 1}`,
        exactText: exactTexts[index],
      })),
    excluded: approvedManifest.items
      .filter((item) => item.action === "exclude")
      .map((item) => ({
        id: item.id,
        authorityClass: item.authorityClass,
        reason: item.excludeReason,
      })),
  };
}

describe("Step 107 control-plane artifact", () => {
  it(
    "keeps the approved manifest at five imports, one Class E exclusion and unknown instants",
    () => {
      const included = approvedManifest.items.filter(
        (item) => item.action === "import",
      );
      const excluded = approvedManifest.items.filter(
        (item) => item.action === "exclude",
      );
      expect(included).toHaveLength(5);
      expect(excluded).toHaveLength(1);
      expect(excluded[0].authorityClass).toBe("E");
      expect(included.every((item) => item.occurredAt === null)).toBe(true);
    },
  );

  it("builds deterministic byte-identical SQL artifacts", async () => {
    const template = await readFile(
      resolve(
        process.cwd(),
        "scripts/step-107-import-evidence-control-plane.sql",
      ),
      "utf8",
    );
    const payload = buildControlPlanePayload(
      approvedManifest,
      approvedShapePlan(),
      worldId,
      accountId,
    );
    const first = renderControlPlaneSql(template, payload);
    const second = renderControlPlaneSql(template, payload);
    expect(first).toBe(second);
    expect(first).not.toContain("__STEP107_PAYLOAD_BASE64__");
    expect(first.match(/DO \$step107\$/g)).toHaveLength(1);
    expect(first.trim().endsWith("$step107$;")).toBe(true);
  });

  it(
    "round-trips arbitrary UTF-8 source text losslessly through nested base64",
    async () => {
      const template = await readFile(
        resolve(
          process.cwd(),
          "scripts/step-107-import-evidence-control-plane.sql",
        ),
        "utf8",
      );
      const plan = approvedShapePlan();
      const payload = buildControlPlanePayload(
        approvedManifest,
        plan,
        worldId,
        accountId,
      );
      const sql = renderControlPlaneSql(template, payload);
      const decoded = decodeControlPlanePayloadFromSql(sql);
      expect(decoded).toEqual(payload);
      decoded.items.forEach((item, index) => {
        expect(
          Buffer.from(item.exactTextBase64, "base64").toString("utf8"),
        ).toBe(plan.included[index].exactText);
      });
      expect(encodeControlPlanePayload(payload)).toMatch(/^[A-Za-z0-9+/=]+$/);
    },
  );

  it(
    "fails closed on non-approved cardinality, Class E inclusion and manufactured instants",
    () => {
      const plan = approvedShapePlan();
      expect(() =>
        buildControlPlanePayload(
          approvedManifest,
          { ...plan, included: plan.included.slice(0, 4) },
          worldId,
          accountId,
        ),
      ).toThrow(/exactly five/);
      expect(() =>
        buildControlPlanePayload(
          approvedManifest,
          {
            ...plan,
            included: [
              { ...plan.included[0], authorityClass: "E" },
              ...plan.included.slice(1),
            ],
          },
          worldId,
          accountId,
        ),
      ).toThrow(/Class E/);
      expect(() =>
        buildControlPlanePayload(
          approvedManifest,
          {
            ...plan,
            included: [
              {
                ...plan.included[0],
                occurredAt: "2026-08-30T10:15:00.000Z",
              },
              ...plan.included.slice(1),
            ],
          },
          worldId,
          accountId,
        ),
      ).toThrow(/occurredAt null/);
    },
  );

  it(
    "contains fail-closed ownership, reconciliation, rollback failpoint and canonical guards",
    async () => {
      const sql = await readFile(
        resolve(
          process.cwd(),
          "scripts/step-107-import-evidence-control-plane.sql",
        ),
        "utf8",
      );
      expect(sql).toContain("transactional-v1");
      expect(sql).toContain("auth.users");
      expect(sql).toContain("initial_owner_id = v_account_id");
      expect(sql).toContain("count(*)");
      expect(sql).toContain("ON CONFLICT (id) DO NOTHING");
      expect(sql).toContain("persisted evidence differs from pinned source plan");
      expect(sql).toContain("failAfterObservationInsert");
      expect(sql).toContain("RAISE EXCEPTION");
      expect(sql).toContain("admissionDecisionsBefore");
      expect(sql).toContain("ontologyNodesBefore");
      expect(sql).toContain("assertionsBefore");
      for (const table of [
        "admission_decisions",
        "ontology_nodes",
        "assertions",
      ]) {
        expect(sql).not.toMatch(
          new RegExp(
            `(?:INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+public\\.${table}`,
            "i",
          ),
        );
      }
    },
  );
});
