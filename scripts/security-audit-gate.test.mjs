import { describe, expect, it } from "vitest";

import {
  evaluateSecurityGate,
  parseAuditJson,
} from "./security-audit-gate-lib.mjs";

const path =
  ".>eslint-config-next>@next/eslint-plugin-next>fast-glob>micromatch>braces";
const lockfileSha256 = "reviewed-lockfile";

function bracesAdvisory(overrides = {}) {
  return {
    id: 1240992,
    github_advisory_id: "GHSA-vfj7-8cjw-p6xm",
    module_name: "braces",
    vulnerable_versions: "<=3.0.3",
    patched_versions: ">=3.0.4",
    severity: "high",
    findings: [
      {
        version: "3.0.3",
        paths: [path],
        dev: true,
        optional: false,
        bundled: false,
      },
    ],
    ...overrides,
  };
}

function audit(advisories = []) {
  const vulnerabilities = {
    info: 0,
    low: 0,
    moderate: 0,
    high: advisories.filter((item) => item.severity === "high").length,
    critical: advisories.filter((item) => item.severity === "critical").length,
  };
  return {
    metadata: { vulnerabilities },
    advisories: Object.fromEntries(
      advisories.map((advisory, index) => [
        String(advisory.id ?? index),
        advisory,
      ]),
    ),
  };
}

function review(overrides = {}) {
  return {
    schema_version: 1,
    advisory: "GHSA-vfj7-8cjw-p6xm",
    cve: "CVE-2026-93687",
    package: "braces",
    installed_version: "3.0.3",
    affected_range: "<=3.0.3",
    patched_range: ">=3.0.4",
    severity: "high",
    dependency_ancestry: [path],
    classification: "build_tooling_only",
    production_reachable: false,
    reachability_rationale:
      "Only the repository-controlled lint dependency path can execute this package.",
    impact_rationale:
      "A hostile nested pattern could terminate lint, but application requests cannot reach it.",
    lockfile: { algorithm: "sha256", digest: lockfileSha256 },
    inspector_disposition: "APPROVE SPLIT SECURITY GATE",
    reviewed_at: "2026-10-14",
    expires_at: "2026-11-05",
    supported_fix: {
      minimum_safe_version: "3.0.4",
      available_at_review: false,
    },
    invalidation_conditions: [
      "supported_fix_available",
      "advisory_changed",
      "package_version_or_path_changed",
      "lockfile_changed",
      "runtime_reachable",
      "untrusted_input_reachable",
      "upstream_path_removed",
    ],
    ...overrides,
  };
}

function evaluate({
  full = audit([bracesAdvisory()]),
  production = audit(),
  records = [review()],
  digest = lockfileSha256,
  versions = ["3.0.3"],
  now = new Date("2026-10-14T12:00:00Z"),
} = {}) {
  return evaluateSecurityGate({
    fullAudit: full,
    productionAudit: production,
    reviewRecords: records,
    lockfileSha256: digest,
    availableVersions: versions,
    now,
  });
}

describe("split dependency security gate", () => {
  it("passes a zero-severe Production closure and exact reviewed tooling finding", () => {
    expect(evaluate()).toMatchObject({
      production: { high: 0, critical: 0 },
      toolingSevere: 1,
      reviewedExceptions: ["GHSA-vfj7-8cjw-p6xm"],
    });
  });

  it("accepts pnpm's equivalent unpublished-patch advisory representation", () => {
    const unpublished = bracesAdvisory({
      patched_versions: null,
      patched_versions_unpublished: true,
    });
    expect(evaluate({ full: audit([unpublished]) })).toMatchObject({
      production: { high: 0, critical: 0 },
      toolingSevere: 1,
    });
  });

  it("passes a fully clean graph without an exception record", () => {
    expect(evaluate({ full: audit(), records: [] })).toMatchObject({
      toolingSevere: 0,
      reviewedExceptions: [],
    });
  });

  it("blocks any severe Production runtime finding", () => {
    const runtime = bracesAdvisory({
      findings: [
        {
          version: "3.0.3",
          paths: [".>runtime>braces"],
          dev: false,
          optional: false,
          bundled: false,
        },
      ],
    });
    expect(() =>
      evaluate({ full: audit([runtime]), production: audit([runtime]) }),
    ).toThrow("Production runtime contains HIGH or CRITICAL");
  });

  it("blocks an unknown severe tooling finding", () => {
    const unknown = bracesAdvisory({
      id: 9,
      github_advisory_id: "GHSA-unknown",
      module_name: "unknown-package",
    });
    expect(() => evaluate({ full: audit([unknown]) })).toThrow(
      "unreviewed severe tooling advisory GHSA-unknown",
    );
  });

  it("blocks a mismatched reviewed advisory identity", () => {
    expect(() =>
      evaluate({ records: [review({ advisory: "GHSA-not-authorized" })] }),
    ).toThrow("unreviewed severe tooling advisory");
  });

  it("blocks changed patch metadata", () => {
    expect(() =>
      evaluate({
        full: audit([bracesAdvisory({ patched_versions: ">=3.0.5" })]),
      }),
    ).toThrow("reviewed advisory metadata changed");
  });

  it.each([
    ["package", { module_name: "other" }],
    [
      "version",
      {
        findings: [
          {
            version: "3.0.2",
            paths: [path],
            dev: true,
            optional: false,
            bundled: false,
          },
        ],
      },
    ],
    [
      "path",
      {
        findings: [
          {
            version: "3.0.3",
            paths: [".>different>braces"],
            dev: true,
            optional: false,
            bundled: false,
          },
        ],
      },
    ],
  ])("blocks a mismatched %s", (_label, change) => {
    expect(() => evaluate({ full: audit([bracesAdvisory(change)]) })).toThrow();
  });

  it("blocks a changed lockfile", () => {
    expect(() => evaluate({ digest: "changed-lockfile" })).toThrow(
      "reviewed lockfile identity changed",
    );
  });

  it("blocks an expired exception", () => {
    expect(() => evaluate({ now: new Date("2026-11-06T00:00:00Z") })).toThrow(
      "security-review exception expired",
    );
  });

  it("blocks when a supported fixed release becomes available", () => {
    expect(() => evaluate({ versions: ["3.0.3", "3.0.4"] })).toThrow(
      "supported patched braces release is now available",
    );
  });

  it("blocks when tooling becomes runtime reachable", () => {
    const production = bracesAdvisory();
    expect(() => evaluate({ production: audit([production]) })).toThrow(
      "Production runtime contains HIGH or CRITICAL",
    );
  });

  it("blocks an orphaned record after the upstream path disappears", () => {
    expect(() => evaluate({ full: audit() })).toThrow(
      "security-review record no longer maps",
    );
  });

  it("blocks failed or incomplete audit parsing", () => {
    expect(() => parseAuditJson("not-json", "full")).toThrow(
      "full audit could not be parsed",
    );
    expect(() => parseAuditJson("{}", "full")).toThrow(
      "full audit could not be parsed",
    );
  });

  it("blocks audit reports that cannot be reconciled", () => {
    const runtime = bracesAdvisory({
      findings: [
        {
          version: "3.0.3",
          paths: [".>unexpected>braces"],
          dev: false,
          optional: false,
          bundled: false,
        },
      ],
    });
    expect(() => evaluate({ production: audit([runtime]) })).toThrow(
      "Production dependency ancestry does not reconcile",
    );
  });
});
