import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import manifest from './step-107-sergey-pilot-manifest.json' with { type: 'json' };
import { buildCandidateRequests, buildImportPlan } from './step-107-sergey-pilot.mjs';

const sourceRootArg = process.argv.find((arg) => arg.startsWith('--source-root='));
if (!sourceRootArg) {
  console.error('usage: node scripts/run-step-107-sergey-pilot.mjs --source-root=/path/to/pinned/RealMe');
  process.exit(2);
}

const sourceRoot = sourceRootArg.slice('--source-root='.length);
const uniquePaths = [...new Set(manifest.items.map((item) => item.path))];
const files = Object.fromEntries(
  await Promise.all(uniquePaths.map(async (path) => [path, await readFile(resolve(sourceRoot, path), 'utf8')])),
);

const plan = buildImportPlan(manifest, files);
const report = {
  mode: 'dry-run',
  source: {
    repository: manifest.sourceRepository,
    commit: manifest.sourceCommit,
    tree: manifest.sourceTree,
  },
  includedCounts: Object.fromEntries(
    ['A', 'B', 'C', 'D', 'E'].map((authorityClass) => [
      authorityClass,
      plan.included.filter((item) => item.authorityClass === authorityClass).length,
    ]),
  ),
  excludedCounts: Object.fromEntries(
    ['A', 'B', 'C', 'D', 'E'].map((authorityClass) => [
      authorityClass,
      plan.excluded.filter((item) => item.authorityClass === authorityClass).length,
    ]),
  ),
  included: plan.included.map(({ exactText: _exactText, ...item }) => item),
  excluded: plan.excluded,
  candidateRequests: buildCandidateRequests(plan),
  canonicalWrites: 0,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
