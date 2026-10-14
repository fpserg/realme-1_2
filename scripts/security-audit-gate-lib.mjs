import { createHash } from "node:crypto";

const severeLevels = new Set(["high", "critical"]);

export const authorizedException = Object.freeze({
  advisory: "GHSA-vfj7-8cjw-p6xm",
  cve: "CVE-2026-93687",
  package: "braces",
  version: "3.0.3",
  affectedRange: "<=3.0.3",
  patchedRange: ">=3.0.4",
  minimumSafeVersion: "3.0.4",
  severity: "high",
});

const requiredInvalidations = [
  "supported_fix_available",
  "advisory_changed",
  "package_version_or_path_changed",
  "lockfile_changed",
  "runtime_reachable",
  "untrusted_input_reachable",
  "upstream_path_removed",
];

function fail(message) {
  throw new Error(`Dependency security gate failed: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function advisoryIdentity(advisory) {
  return advisory.github_advisory_id ?? String(advisory.id ?? "");
}

function findings(advisory) {
  if (!Array.isArray(advisory.findings)) fail("advisory findings are missing");
  return advisory.findings.flatMap((finding) => {
    if (typeof finding.version !== "string" || !Array.isArray(finding.paths)) {
      fail("advisory finding shape is invalid");
    }
    return finding.paths.map((path) => ({
      version: finding.version,
      path,
      dev: finding.dev === true,
      optional: finding.optional === true,
      bundled: finding.bundled === true,
    }));
  });
}

function canonicalFindings(advisory) {
  return findings(advisory)
    .map(
      ({ version, path, dev, optional, bundled }) =>
        `${version}\u0000${path}\u0000${dev}\u0000${optional}\u0000${bundled}`,
    )
    .sort();
}

function sameArray(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function validateAudit(report, label) {
  if (!isObject(report) || !isObject(report.metadata)) {
    fail(`${label} audit could not be parsed`);
  }
  if (
    !isObject(report.metadata.vulnerabilities) ||
    !isObject(report.advisories)
  ) {
    fail(`${label} audit is incomplete`);
  }
  for (const level of ["info", "low", "moderate", "high", "critical"]) {
    if (!Number.isInteger(report.metadata.vulnerabilities[level])) {
      fail(`${label} audit has invalid ${level} metadata`);
    }
  }
  const computed = { high: 0, critical: 0 };
  for (const advisory of Object.values(report.advisories)) {
    if (!isObject(advisory) || typeof advisory.severity !== "string") {
      fail(`${label} audit advisory shape is invalid`);
    }
    findings(advisory);
    if (advisory.severity === "high" || advisory.severity === "critical") {
      computed[advisory.severity] += 1;
    }
  }
  for (const level of ["high", "critical"]) {
    if (computed[level] !== report.metadata.vulnerabilities[level]) {
      fail(`${label} audit ${level} totals do not reconcile`);
    }
  }
}

function compareVersions(left, right) {
  const parse = (value) => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
    if (!match) return null;
    return match.slice(1).map(Number);
  };
  const a = parse(left);
  const b = parse(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function supportedFixExists(availableVersions, minimumSafeVersion) {
  if (!Array.isArray(availableVersions))
    fail("package release metadata is unavailable");
  return availableVersions.some((version) => {
    const comparison = compareVersions(version, minimumSafeVersion);
    return comparison !== null && comparison >= 0;
  });
}

function reconcileAudits(fullAudit, productionAudit) {
  const fullByIdentity = new Map(
    Object.values(fullAudit.advisories).map((advisory) => [
      advisoryIdentity(advisory),
      advisory,
    ]),
  );
  for (const production of Object.values(productionAudit.advisories)) {
    const full = fullByIdentity.get(advisoryIdentity(production));
    if (!full)
      fail("Production audit contains an advisory absent from the full audit");
    if (
      full.module_name !== production.module_name ||
      full.severity !== production.severity
    ) {
      fail("Production and full audit advisory metadata disagree");
    }
    const fullSet = new Set(canonicalFindings(full));
    if (
      canonicalFindings(production).some((finding) => !fullSet.has(finding))
    ) {
      fail(
        "Production dependency ancestry does not reconcile with the full audit",
      );
    }
  }
}

function validateReviewRecord({
  record,
  advisory,
  lockfileSha256,
  availableVersions,
  now,
}) {
  if (!isObject(record) || record.schema_version !== 1) {
    fail("security-review record is missing or malformed");
  }
  const expected = authorizedException;
  for (const [field, value] of [
    ["advisory", expected.advisory],
    ["cve", expected.cve],
    ["package", expected.package],
    ["installed_version", expected.version],
    ["affected_range", expected.affectedRange],
    ["patched_range", expected.patchedRange],
    ["severity", expected.severity],
  ]) {
    if (record[field] !== value)
      fail(`security-review ${field} does not match`);
  }
  if (
    record.classification !== "build_tooling_only" ||
    record.production_reachable !== false
  ) {
    fail("security-review runtime classification changed");
  }
  if (
    typeof record.reachability_rationale !== "string" ||
    record.reachability_rationale.length < 40 ||
    typeof record.impact_rationale !== "string" ||
    record.impact_rationale.length < 40
  ) {
    fail("security-review rationale is incomplete");
  }
  if (
    !isObject(record.lockfile) ||
    record.lockfile.algorithm !== "sha256" ||
    record.lockfile.digest !== lockfileSha256
  ) {
    fail("reviewed lockfile identity changed");
  }
  if (record.inspector_disposition !== "APPROVE SPLIT SECURITY GATE") {
    fail("Inspector disposition does not match authorization");
  }
  if (
    record.reviewed_at !== "2026-10-14" ||
    record.expires_at !== "2026-11-05"
  ) {
    fail("security-review dates do not match authorization");
  }
  const today = now.toISOString().slice(0, 10);
  if (today > record.expires_at) fail("security-review exception expired");
  if (
    !Array.isArray(record.invalidation_conditions) ||
    !sameArray(
      [...record.invalidation_conditions].sort(),
      [...requiredInvalidations].sort(),
    )
  ) {
    fail("security-review invalidation conditions are incomplete");
  }
  if (
    !isObject(record.supported_fix) ||
    record.supported_fix.minimum_safe_version !== expected.minimumSafeVersion ||
    record.supported_fix.available_at_review !== false
  ) {
    fail("security-review supported-fix record is invalid");
  }
  if (supportedFixExists(availableVersions, expected.minimumSafeVersion)) {
    fail("a supported patched braces release is now available");
  }

  const patchMetadataMatches =
    advisory.patched_versions === expected.patchedRange ||
    (advisory.patched_versions === null &&
      advisory.patched_versions_unpublished === true);
  if (
    advisoryIdentity(advisory) !== expected.advisory ||
    advisory.module_name !== expected.package ||
    advisory.severity !== expected.severity ||
    advisory.vulnerable_versions !== expected.affectedRange ||
    !patchMetadataMatches
  ) {
    fail("reviewed advisory metadata changed");
  }
  const observed = canonicalFindings(advisory);
  const reviewed = record.dependency_ancestry
    .map(
      (path) =>
        `${record.installed_version}\u0000${path}\u0000true\u0000false\u0000false`,
    )
    .sort();
  if (!sameArray(observed, reviewed)) {
    fail("reviewed package version or dependency ancestry changed");
  }
}

export function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

export function parseAuditJson(text, label) {
  let report;
  try {
    report = JSON.parse(text);
  } catch {
    fail(`${label} audit could not be parsed`);
  }
  validateAudit(report, label);
  return report;
}

export function evaluateSecurityGate({
  fullAudit,
  productionAudit,
  reviewRecords,
  lockfileSha256,
  availableVersions,
  now = new Date(),
}) {
  validateAudit(fullAudit, "full");
  validateAudit(productionAudit, "Production");
  reconcileAudits(fullAudit, productionAudit);

  const productionSevere = Object.values(productionAudit.advisories).filter(
    (advisory) => severeLevels.has(advisory.severity),
  );
  if (productionSevere.length > 0) {
    fail("Production runtime contains HIGH or CRITICAL findings");
  }

  if (!Array.isArray(reviewRecords))
    fail("security-review records are unavailable");
  const fullSevere = Object.values(fullAudit.advisories).filter((advisory) =>
    severeLevels.has(advisory.severity),
  );
  const usedRecords = new Set();
  const exceptions = [];
  for (const advisory of fullSevere) {
    const identity = advisoryIdentity(advisory);
    const candidates = reviewRecords.filter(
      (record) => record.advisory === identity,
    );
    if (candidates.length !== 1)
      fail(`unreviewed severe tooling advisory ${identity}`);
    validateReviewRecord({
      record: candidates[0],
      advisory,
      lockfileSha256,
      availableVersions,
      now,
    });
    usedRecords.add(candidates[0]);
    exceptions.push(identity);
  }
  if (reviewRecords.some((record) => !usedRecords.has(record))) {
    fail(
      "security-review record no longer maps to an installed severe finding",
    );
  }

  return {
    full: fullAudit.metadata.vulnerabilities,
    production: productionAudit.metadata.vulnerabilities,
    toolingSevere: fullSevere.length,
    reviewedExceptions: exceptions.sort(),
  };
}
