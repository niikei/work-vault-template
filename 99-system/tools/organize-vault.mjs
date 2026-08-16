#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import {
  ALLOWED_TOP_LEVEL,
  countBy,
  isMain,
  listEntries,
  parseArgs,
  parseFrontmatter,
  printRows,
  readUtf8Safe,
  relativePath,
  requireNode22,
  resolveVaultRoot,
} from "./vault-toolkit.mjs";

const KEPT_EMPTY_DIRECTORIES = /^00-inbox\/web-clips\/(?:merge-queue|new)\/(?:general|sharepoint-files)$/;

function markdownFiles(root) {
  return listEntries(root, {
    extension: ".md",
    skipDirectory: (rel, name) => name === "node_modules" || rel === ".git" || rel.startsWith(".git/") || rel === ".obsidian" || rel.startsWith(".obsidian/"),
  });
}

export function runOrganizeVault({ vaultRoot = ".", apply = false, includeFrontmatterAudit = false } = {}) {
  requireNode22();
  const root = resolveVaultRoot(vaultRoot);
  const actions = [];
  const files = markdownFiles(root);

  console.log(`Vault root: ${root}`);
  console.log(`Mode: ${apply ? "apply" : "dry-run"}`);

  for (const filePath of files) {
    if (!/ copy\.md$/i.test(path.basename(filePath))) continue;
    const newName = path.basename(filePath).replace(/ copy\.md$/i, ".md");
    const newPath = path.join(path.dirname(filePath), newName);
    const rel = relativePath(root, filePath);
    if (fs.existsSync(newPath)) {
      actions.push({ kind: "rename-copy", status: "skip", path: rel, detail: `skip: target already exists (${newName})` });
    } else if (apply) {
      fs.renameSync(filePath, newPath);
      actions.push({ kind: "rename-copy", status: "changed", path: rel, detail: `renamed to ${newName}` });
    } else {
      actions.push({ kind: "rename-copy", status: "planned", path: rel, detail: `would rename to ${newName}` });
    }
  }

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || ALLOWED_TOP_LEVEL.has(entry.name)) continue;
    const fullPath = path.join(root, entry.name);
    const children = fs.readdirSync(fullPath);
    if (children.length > 0) {
      actions.push({ kind: "unexpected-root-dir", status: "review", path: entry.name, detail: "non-empty: manual review required" });
    } else if (apply) {
      fs.rmdirSync(fullPath);
      actions.push({ kind: "unexpected-root-dir", status: "changed", path: entry.name, detail: "removed empty directory" });
    } else {
      actions.push({ kind: "unexpected-root-dir", status: "planned", path: entry.name, detail: "would remove empty directory" });
    }
  }

  if (includeFrontmatterAudit) {
    for (const filePath of files) {
      const read = readUtf8Safe(filePath);
      if (!read.ok) {
        actions.push({ kind: "metadata-audit", status: "review", path: relativePath(root, filePath), detail: `skipped (${read.reason})` });
        continue;
      }
      const lines = read.content.split(/\r?\n/).slice(0, 50);
      const frontmatter = parseFrontmatter(lines);
      const hasType = frontmatter.properties.has("type");
      if (!frontmatter.hasFrontmatter || !hasType) {
        actions.push({
          kind: "metadata-audit",
          status: "review",
          path: relativePath(root, filePath),
          detail: `frontmatter=${frontmatter.hasFrontmatter}, type=${hasType}`,
        });
      }
    }
  }

  const directories = listEntries(root, {
    kind: "directory",
    skipDirectory: (rel, name) => name === "node_modules" || rel === ".git" || rel.startsWith(".git/"),
  });
  for (const directory of directories) {
    if (fs.readdirSync(directory).length !== 0) continue;
    const rel = relativePath(root, directory);
    if (KEPT_EMPTY_DIRECTORIES.test(rel)) continue;
    actions.push({ kind: "empty-dir", status: "review", path: rel, detail: "manual decision" });
  }

  actions.sort((a, b) => a.kind.localeCompare(b.kind) || a.path.localeCompare(b.path));
  console.log("");
  console.log(
    `Summary: changed=${countBy(actions, "status", "changed")}, planned=${countBy(actions, "status", "planned")}, review=${countBy(actions, "status", "review")}, skip=${countBy(actions, "status", "skip")}`,
  );
  if (actions.length > 0) {
    console.log("");
    printRows(actions, ["kind", "status", "path", "detail"]);
  } else {
    console.log("No actions found.");
  }
  return { actions };
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2), {
      booleans: ["apply", "includeFrontmatterAudit"],
      strings: ["vaultRoot"],
    });
    runOrganizeVault(options);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (isMain(import.meta.url)) main();
