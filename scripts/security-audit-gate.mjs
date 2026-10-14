import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  evaluateSecurityGate,
  parseAuditJson,
  sha256,
} from "./security-audit-gate-lib.mjs";

const root = resolve(import.meta.dirname, "..");
const artifactDirectory = resolve(root, "artifacts/security-audit");
const reviewPath = resolve(
  root,
  "security/dependency-reviews/GHSA-vfj7-8cjw-p6xm.json",
);

function runPnpm(args, label) {
  const result = spawnSync("pnpm", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.signal || typeof result.stdout !== "string") {
    throw new Error(
      `Dependency security gate failed: ${label} retrieval failed`,
    );
  }
  return result.stdout;
}

await mkdir(artifactDirectory, { recursive: true });

let fullText = "";
let productionText = "";
let versionsText = "";
try {
  fullText = runPnpm(["audit", "--json"], "full audit");
  productionText = runPnpm(["audit", "--prod", "--json"], "Production audit");
  versionsText = runPnpm(
    ["view", "braces", "versions", "--json"],
    "braces release metadata",
  );
} finally {
  await Promise.all([
    writeFile(resolve(artifactDirectory, "full-audit.json"), fullText),
    writeFile(
      resolve(artifactDirectory, "production-audit.json"),
      productionText,
    ),
    writeFile(resolve(artifactDirectory, "braces-versions.json"), versionsText),
  ]);
}

const fullAudit = parseAuditJson(fullText, "full");
const productionAudit = parseAuditJson(productionText, "Production");
let availableVersions;
try {
  availableVersions = JSON.parse(versionsText);
} catch {
  throw new Error(
    "Dependency security gate failed: package release metadata could not be parsed",
  );
}
if (!Array.isArray(availableVersions)) {
  throw new Error(
    "Dependency security gate failed: package release metadata is incomplete",
  );
}

const lockfile = await readFile(resolve(root, "pnpm-lock.yaml"));
const reviewRecord = JSON.parse(await readFile(reviewPath, "utf8"));
const summary = evaluateSecurityGate({
  fullAudit,
  productionAudit,
  reviewRecords: [reviewRecord],
  lockfileSha256: sha256(lockfile),
  availableVersions,
});

await writeFile(
  resolve(artifactDirectory, "gate-summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);
console.log(JSON.stringify(summary, null, 2));
console.log("Dependency security gate passed.");
