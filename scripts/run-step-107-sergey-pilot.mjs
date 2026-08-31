import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";
import manifest from "./step-107-sergey-pilot-manifest.json" with { type: "json" };
import {
  buildCandidateRequests,
  buildEvidenceRows,
  buildImportPlan,
  loadPinnedSourceFiles,
} from "./step-107-sergey-pilot.mjs";

function argument(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found?.slice(prefix.length);
}

const sourceRoot = argument("source-root");
const execute = process.argv.includes("--execute");
if (!sourceRoot) {
  console.error(
    "usage: node scripts/run-step-107-sergey-pilot.mjs --source-root=/path/to/RealMe [--execute --world-id=<uuid> --account-id=<uuid>]",
  );
  process.exit(2);
}

const files = await loadPinnedSourceFiles(sourceRoot, manifest);
const plan = buildImportPlan(manifest, files);
const included = plan.included.map((item) => {
  const reportItem = { ...item };
  delete reportItem.exactText;
  return reportItem;
});

if (execute) {
  const worldId = argument("world-id");
  const accountId = argument("account-id");
  if (!worldId || !accountId || !process.env.DATABASE_URL) {
    throw new Error(
      "--execute requires --world-id, --account-id and DATABASE_URL",
    );
  }

  const rows = buildEvidenceRows(plan, worldId);
  const executorSql = await readFile(
    resolve(process.cwd(), "scripts/step-107-import-evidence.sql"),
    "utf8",
  );
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    await sql.begin(async (tx) => {
      await tx`select set_config('realme.step107_executor_guard', 'transactional-v1', true)`;
      await tx`select set_config('realme.step107_world_id', ${worldId}, true)`;
      await tx`select set_config('realme.step107_account_id', ${accountId}, true)`;
      await tx.unsafe(`
        CREATE TEMP TABLE step107_source_items (
          observation_id uuid NOT NULL,
          fragment_id uuid NOT NULL,
          capture_idempotency_key uuid NOT NULL,
          source_kind text NOT NULL,
          source_locator text NOT NULL,
          occurred_at timestamptz,
          occurred_precision text NOT NULL,
          local_calendar_date date,
          exact_text text NOT NULL,
          content_hash text NOT NULL
        ) ON COMMIT DROP
      `);

      for (const row of rows) {
        await tx`
          INSERT INTO step107_source_items (
            observation_id, fragment_id, capture_idempotency_key,
            source_kind, source_locator, occurred_at, occurred_precision,
            local_calendar_date, exact_text, content_hash
          ) VALUES (
            ${row.observation.id}, ${row.fragment.id},
            ${row.observation.capture_idempotency_key},
            ${row.observation.source_kind}, ${row.observation.source_locator},
            ${row.observation.occurred_at}, ${row.observation.occurred_precision},
            ${row.observation.local_calendar_date}, ${row.fragment.exact_text},
            ${row.fragment.content_hash}
          )
        `;
      }

      await tx.unsafe(executorSql);
    });
  } finally {
    await sql.end();
  }
}

const report = {
  mode: execute ? "execute" : "dry-run",
  source: {
    repository: manifest.sourceRepository,
    commit: manifest.sourceCommit,
    tree: manifest.sourceTree,
    bytes: "verified-and-read-from-pinned-git-blobs",
  },
  includedCounts: Object.fromEntries(
    ["A", "B", "C", "D", "E"].map((authorityClass) => [
      authorityClass,
      plan.included.filter((item) => item.authorityClass === authorityClass)
        .length,
    ]),
  ),
  excludedCounts: Object.fromEntries(
    ["A", "B", "C", "D", "E"].map((authorityClass) => [
      authorityClass,
      plan.excluded.filter((item) => item.authorityClass === authorityClass)
        .length,
    ]),
  ),
  included,
  excluded: plan.excluded,
  candidateRequests: buildCandidateRequests(plan),
  canonicalWrites: 0,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
