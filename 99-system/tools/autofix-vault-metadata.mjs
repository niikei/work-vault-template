#!/usr/bin/env node

import {
  basenameWithoutExtension,
  countBy,
  isMain,
  listMarkdownFiles,
  numberOption,
  parseArgs,
  parseFrontmatter,
  printRows,
  readUtf8Safe,
  relativePath,
  requireNode22,
  resolveVaultRoot,
  startsWithAnyPrefix,
  writeUtf8PreservingBom,
} from "./vault-toolkit.mjs";

const DEFAULT_PREFIXES = ["20-work", "30-playground", "40-jottings", "90-archive"];

function inferType(relative, baseName, defaultType, defaultDatedType) {
  if (relative.toLocaleLowerCase("en-US").startsWith("10-checkpoints/")) return "checkpoint";
  if (/^\d{8}(?:_|$)/.test(baseName) || /^\d{8}T\d{6}[+\-]\d{4}_/.test(baseName)) return defaultDatedType;
  return defaultType;
}

function inferCreatedDate(baseName) {
  const match = baseName.match(/^(\d{4})(\d{2})(\d{2})(?:_|$)/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function insertBeforeClosing(lines, closingIndex, value) {
  return [...lines.slice(0, closingIndex), value, ...lines.slice(closingIndex)];
}

export function runAutofixVaultMetadata({
  vaultRoot = ".",
  apply = false,
  includePrefixes = DEFAULT_PREFIXES,
  defaultType = "note",
  defaultDatedType = "record",
  maxApplyFiles = 20,
  allowLargeApply = false,
} = {}) {
  requireNode22();
  const root = resolveVaultRoot(vaultRoot);
  const limit = numberOption(String(maxApplyFiles), 20, "max-apply-files");
  if (apply && limit < 1) throw new Error("max-apply-files must be >= 1");

  const actions = [];
  const pendingWrites = [];
  console.log(`Vault root: ${root}`);
  console.log(`Mode: ${apply ? "apply" : "dry-run"}`);
  console.log(`Include prefixes: ${includePrefixes.join(", ")}`);

  for (const filePath of listMarkdownFiles(root)) {
    const rel = relativePath(root, filePath);
    if (!startsWithAnyPrefix(rel, includePrefixes)) continue;

    const read = readUtf8Safe(filePath);
    if (!read.ok) {
      actions.push({ status: "review", path: rel, action: "encoding-safety", detail: `skipped (${read.reason})` });
      continue;
    }

    const raw = read.content;
    let lines = raw.length > 0 ? raw.split(/\r?\n/) : [];
    let frontmatter = parseFrontmatter(lines);
    const baseName = basenameWithoutExtension(filePath);
    const inferredType = inferType(rel, baseName, defaultType, defaultDatedType);
    const inferredCreated = inferCreatedDate(baseName);

    if (!frontmatter.hasFrontmatter) {
      const frontmatterLines = ["---", `type: ${inferredType}`];
      if (inferredCreated) frontmatterLines.push(`created: ${inferredCreated}`);
      frontmatterLines.push("---");
      const content = raw.length > 0
        ? `${frontmatterLines.join(read.newline)}${read.newline}${raw}`
        : frontmatterLines.join(read.newline);
      const item = {
        filePath,
        path: rel,
        content,
        hadBom: read.hadBom,
        action: "add-frontmatter",
        detail: `type=${inferredType}`,
      };
      if (apply) pendingWrites.push(item);
      else actions.push({ status: "planned", path: rel, action: item.action, detail: item.detail });
      continue;
    }

    let modified = false;
    if (!frontmatter.properties.has("type") && frontmatter.endLineIndex >= 1) {
      lines = insertBeforeClosing(lines, frontmatter.endLineIndex, `type: ${inferredType}`);
      modified = true;
      frontmatter = parseFrontmatter(lines);
    }
    if (!frontmatter.properties.has("created") && inferredCreated && frontmatter.endLineIndex >= 1) {
      lines = insertBeforeClosing(lines, frontmatter.endLineIndex, `created: ${inferredCreated}`);
      modified = true;
    }

    if (modified) {
      const item = {
        filePath,
        path: rel,
        content: lines.join(read.newline),
        hadBom: read.hadBom,
        action: "patch-frontmatter",
        detail: "added missing fields",
      };
      if (apply) pendingWrites.push(item);
      else actions.push({ status: "planned", path: rel, action: item.action, detail: "would add missing fields" });
    }
  }

  if (apply && !allowLargeApply && pendingWrites.length > limit) {
    throw new Error(
      `Safety stop: planned changes (${pendingWrites.length}) exceed max-apply-files (${limit}). Re-run with smaller scope, a higher limit, or --allow-large-apply.`,
    );
  }
  if (apply) {
    for (const item of pendingWrites) {
      writeUtf8PreservingBom(item.filePath, item.content, item.hadBom);
      actions.push({ status: "changed", path: item.path, action: item.action, detail: item.detail });
    }
  }

  actions.sort((a, b) => a.action.localeCompare(b.action) || a.path.localeCompare(b.path));
  console.log("");
  console.log(
    `Summary: changed=${countBy(actions, "status", "changed")} planned=${countBy(actions, "status", "planned")} review=${countBy(actions, "status", "review")}`,
  );
  if (actions.length > 0) {
    console.log("");
    printRows(actions, ["status", "action", "path", "detail"]);
  } else {
    console.log("No targets found.");
  }
  return { actions, pendingWrites: pendingWrites.length };
}

function main() {
  try {
    const parsed = parseArgs(process.argv.slice(2), {
      booleans: ["apply", "allowLargeApply"],
      strings: ["vaultRoot", "defaultType", "defaultDatedType", "maxApplyFiles"],
      arrays: ["includePrefixes"],
    });
    runAutofixVaultMetadata({
      ...parsed,
      maxApplyFiles: numberOption(parsed.maxApplyFiles, 20, "max-apply-files"),
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (isMain(import.meta.url)) main();
