import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const sourceRoot = path.resolve("src");
const layers = ["domain", "application", "projections", "infrastructure"];
const allowedLayers = {
  domain: new Set(["domain"]),
  application: new Set(["application", "domain"]),
  projections: new Set(["projections", "domain"]),
  infrastructure: new Set(["infrastructure", "application", "domain"]),
};
const forbiddenPackages = {
  domain: ["next", "react", "drizzle-orm", "postgres", "@supabase/"],
  application: ["next", "react", "drizzle-orm", "postgres", "@supabase/"],
  projections: ["next", "react", "drizzle-orm", "postgres", "@supabase/"],
  infrastructure: ["next", "react"],
};

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(target)));
    if (entry.isFile() && /\.(?:ts|tsx|mts|mjs)$/.test(entry.name)) {
      files.push(target);
    }
  }

  return files;
}

function importedLayer(specifier, importer) {
  let resolved;

  if (specifier.startsWith("@/")) {
    resolved = path.join(sourceRoot, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    resolved = path.resolve(path.dirname(importer), specifier);
  } else {
    return null;
  }

  const relative = path.relative(sourceRoot, resolved);
  return relative.split(path.sep)[0];
}

function importsFrom(source) {
  const matches = source.matchAll(
    /(?:from\s+|import\s*\()\s*["']([^"']+)["']/g,
  );
  return [...matches].map((match) => match[1]);
}

const violations = [];

for (const layer of layers) {
  const files = await collectFiles(path.join(sourceRoot, layer));

  for (const file of files) {
    const source = await readFile(file, "utf8");

    for (const specifier of importsFrom(source)) {
      const packageViolation = forbiddenPackages[layer].some(
        (prefix) => specifier === prefix || specifier.startsWith(`${prefix}/`),
      );
      const targetLayer = importedLayer(specifier, file);
      const layerViolation =
        targetLayer &&
        layers.includes(targetLayer) &&
        !allowedLayers[layer].has(targetLayer);

      if (packageViolation || layerViolation) {
        violations.push(
          `${path.relative(process.cwd(), file)}: ${layer} cannot import ${specifier}`,
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Architecture boundary violations:\n");
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Architecture boundaries verified.");
}
