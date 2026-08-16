import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));

function createVault() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "work-vault-tools-"));
}

function runTool(name, ...args) {
  return spawnSync(process.execPath, [path.join(toolsDirectory, name), ...args], {
    encoding: "utf8",
  });
}

test("autofix is dry-run by default and applies only with --apply", () => {
  const root = createVault();
  try {
    fs.mkdirSync(path.join(root, "20-work"));
    const target = path.join(root, "20-work", "20260816_test.md");
    fs.writeFileSync(target, "# test\n", "utf8");

    const dryRun = runTool("autofix-vault-metadata.mjs", "--vault-root", root, "--include-prefixes", "20-work");
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.equal(fs.readFileSync(target, "utf8"), "# test\n");

    const apply = runTool("autofix-vault-metadata.mjs", "--vault-root", root, "--include-prefixes", "20-work", "--apply");
    assert.equal(apply.status, 0, apply.stderr);
    assert.match(fs.readFileSync(target, "utf8"), /^---\ntype: record\ncreated: 2026-08-16\n---\n# test\n$/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("autofix stops before writing when the apply limit is exceeded", () => {
  const root = createVault();
  try {
    fs.mkdirSync(path.join(root, "20-work"));
    for (const name of ["20260816_a.md", "20260816_b.md"]) {
      fs.writeFileSync(path.join(root, "20-work", name), `# ${name}\n`, "utf8");
    }
    const result = runTool(
      "autofix-vault-metadata.mjs",
      "--vault-root", root,
      "--include-prefixes", "20-work",
      "--apply",
      "--max-apply-files", "1",
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Safety stop/);
    assert.equal(fs.readFileSync(path.join(root, "20-work", "20260816_a.md"), "utf8"), "# 20260816_a.md\n");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("validator returns exit code 1 for checkpoint metadata errors", () => {
  const root = createVault();
  try {
    const directory = path.join(root, "10-checkpoints", "daily", "2026", "08");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, "20260816.md"),
      "---\ntype: checkpoint\ndate: 2026-08-15\ncreated: 2026-08-16\n---\n# test\n",
      "utf8",
    );
    const result = runTool(
      "validate-vault-rules.mjs",
      "--vault-root", root,
      "--include-prefixes", "10-checkpoints",
      "--fail-on-error",
    );
    assert.equal(result.status, 1);
    assert.match(result.stdout, /checkpoint-daily-date-consistency/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("validator checks Daily carryover metadata", () => {
  const root = createVault();
  try {
    const directory = path.join(root, "10-checkpoints", "daily", "2026", "08");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, "20260816.md"),
      "---\ntype: checkpoint\ndate: 2026-08-16\ncreated: 2026-08-16\ncarryover_done: yes\ncarried_from: 2026-08-17\n---\n# test\n",
      "utf8",
    );
    const result = runTool(
      "validate-vault-rules.mjs",
      "--vault-root", root,
      "--include-prefixes", "10-checkpoints",
      "--fail-on-error",
    );
    assert.equal(result.status, 1);
    assert.match(result.stdout, /checkpoint-daily-carryover-done-format/);
    assert.match(result.stdout, /checkpoint-daily-carried-from-order/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("validator allows only Obsidian Base embeds", () => {
  const root = createVault();
  try {
    const directory = path.join(root, "20-work");
    fs.mkdirSync(directory);
    const target = path.join(directory, "Guide.md");
    const frontmatter =
      "---\ntype: living-document\ncreated: 2026-08-17\nupdated: 2026-08-17\n---\n";
    fs.writeFileSync(
      target,
      `${frontmatter}![[99-system/bases/example.base#View]]\n`,
      "utf8",
    );

    const allowed = runTool(
      "validate-vault-rules.mjs",
      "--vault-root",
      root,
      "--include-prefixes",
      "20-work",
    );
    assert.equal(allowed.status, 0, allowed.stderr);
    assert.doesNotMatch(allowed.stdout, /no-obsidian-link-syntax/);

    fs.writeFileSync(target, `${frontmatter}[[Other note]]\n`, "utf8");
    const rejected = runTool(
      "validate-vault-rules.mjs",
      "--vault-root",
      root,
      "--include-prefixes",
      "20-work",
    );
    assert.equal(rejected.status, 0, rejected.stderr);
    assert.match(rejected.stdout, /no-obsidian-link-syntax/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("organizer renames copy files only in apply mode", () => {
  const root = createVault();
  try {
    fs.mkdirSync(path.join(root, "20-work"));
    const source = path.join(root, "20-work", "example copy.md");
    const destination = path.join(root, "20-work", "example.md");
    fs.writeFileSync(source, "# test\n", "utf8");

    const dryRun = runTool("organize-vault.mjs", "--vault-root", root);
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.equal(fs.existsSync(source), true);

    const apply = runTool("organize-vault.mjs", "--vault-root", root, "--apply");
    assert.equal(apply.status, 0, apply.stderr);
    assert.equal(fs.existsSync(source), false);
    assert.equal(fs.existsSync(destination), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
