import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { validateCandidateSet } from "@/application/interpretation/interpret-observation";
import { OpenAIInterpretationProvider } from "@/infrastructure/ai/openai-interpretation-provider";

type CorpusCase = {
  byteLength: number;
  byteOffset: number;
  excerptSha256: string;
  id: string;
  semanticClass: string;
  sourceBlob: string;
  sourcePath: string;
};

type Corpus = {
  cases: CorpusCase[];
  model: string;
  promptVersion: string;
  provider: string;
  schemaVersion: string;
  sourceCommit: string;
  sourceRepository: string;
  sourceTree: string;
};

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function git(sourceRoot: string, args: string[], encoding?: BufferEncoding) {
  return execFileSync("git", ["-C", sourceRoot, ...args], {
    encoding,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function loadFrozenCorpus(sourceRoot: string) {
  const corpus = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "scripts/step-107-semantic-corpus.json"),
      "utf8",
    ),
  ) as Corpus;
  const tree = String(
    git(sourceRoot, ["rev-parse", `${corpus.sourceCommit}^{tree}`], "utf8"),
  ).trim();
  if (tree !== corpus.sourceTree)
    throw new Error("Frozen corpus source tree differs from its manifest.");

  const cases = corpus.cases.map((entry) => {
    const blob = String(
      git(
        sourceRoot,
        ["rev-parse", `${corpus.sourceCommit}:${entry.sourcePath}`],
        "utf8",
      ),
    ).trim();
    if (blob !== entry.sourceBlob)
      throw new Error(`${entry.id}: source blob differs from its manifest.`);
    const bytes = git(sourceRoot, [
      "cat-file",
      "blob",
      entry.sourceBlob,
    ]) as Buffer;
    const excerptBytes = bytes.subarray(
      entry.byteOffset,
      entry.byteOffset + entry.byteLength,
    );
    if (
      excerptBytes.length !== entry.byteLength ||
      sha256(excerptBytes) !== entry.excerptSha256
    )
      throw new Error(`${entry.id}: frozen excerpt does not match its digest.`);
    return { ...entry, exactText: excerptBytes.toString("utf8") };
  });
  return { ...corpus, cases };
}

export async function runFrozenCorpus(
  sourceRoot: string,
  outputPath: string,
  apiKey: string,
) {
  if (!apiKey)
    throw new Error(
      "OPENAI_API_KEY is required for an explicit live corpus run.",
    );
  const corpus = loadFrozenCorpus(sourceRoot);
  const provider = new OpenAIInterpretationProvider(apiKey, corpus.model);
  const executions = [];
  for (const entry of corpus.cases) {
    const input = {
      evidence: [{ exactText: entry.exactText, reference: "evidence-0" }],
      promptVersion: corpus.promptVersion,
      schemaVersion: corpus.schemaVersion,
    };
    const inputHash = sha256(JSON.stringify(input));
    const rawStructuredOutput = await provider.interpret(input, {
      signal: AbortSignal.timeout(60_000),
    });
    validateCandidateSet(rawStructuredOutput, corpus.schemaVersion);
    executions.push({
      caseId: entry.id,
      excerptSha256: entry.excerptSha256,
      inputHash,
      model: corpus.model,
      promptVersion: corpus.promptVersion,
      provider: corpus.provider,
      rawStructuredOutput,
      schemaVersion: corpus.schemaVersion,
      semanticClass: entry.semanticClass,
      sourceBlob: entry.sourceBlob,
      sourceCommit: corpus.sourceCommit,
      sourcePath: entry.sourcePath,
      sourceRepository: corpus.sourceRepository,
    });
  }
  writeFileSync(outputPath, `${JSON.stringify({ executions }, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  chmodSync(outputPath, 0o600);
  return executions;
}
