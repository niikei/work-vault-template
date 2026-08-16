#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import {
  ALLOWED_TOP_LEVEL,
  basenameWithoutExtension,
  isMain,
  listMarkdownFiles,
  normalizeYamlScalar,
  parseArgs,
  parseFrontmatter,
  printRows,
  readUtf8Safe,
  relativePath,
  requireNode22,
  resolveVaultRoot,
  startsWithAnyPrefix,
} from "./vault-toolkit.mjs";

const ALLOWED_TYPES = new Set(["note", "record", "living-document", "checkpoint"]);
const COMMON_ALLOWED_KEYS = ["type", "created", "updated", "created_at", "description", "tags", "confidential"];
const ALLOWED_KEYS_BY_TYPE = {
  note: [],
  record: ["source_raw", "source_canonical", "clip_title", "author", "published", "file_name"],
  "living-document": ["marp", "theme", "size", "paginate", "date"],
  checkpoint: ["date", "week", "week_start", "month", "month_start", "carryover_done", "carried_from"],
};
const REQUIRED_KEYS_BY_TYPE = {
  note: ["type", "created"],
  record: ["type", "created"],
  "living-document": ["type"],
  checkpoint: ["type", "created"],
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_WITH_OFFSET = /^"?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+\-]\d{2}:?\d{2})"?$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;
const ISO_WEEK = /^\d{4}-W\d{2}$/;

function addIssue(issues, severity, rule, filePath, message) {
  issues.push({ severity, rule, path: filePath, message });
}

function validateCheckpointMetadata(issues, rel, frontmatter) {
  let match = rel.match(/^10-checkpoints\/daily\/(\d{4})\/(\d{2})\/(\d{8})\.md$/);
  if (match) {
    const expectedDate = `${match[1]}-${match[2]}-${match[3].slice(6, 8)}`;
    if (!frontmatter.properties.has("date")) {
      addIssue(issues, "error", "checkpoint-daily-date-required", rel, "Daily checkpoint requires date: YYYY-MM-DD");
    } else {
      const value = normalizeYamlScalar(frontmatter.properties.get("date"));
      if (!ISO_DATE.test(value)) addIssue(issues, "error", "checkpoint-daily-date-format", rel, "Daily checkpoint date should use YYYY-MM-DD");
      else if (value !== expectedDate) addIssue(issues, "error", "checkpoint-daily-date-consistency", rel, `Daily checkpoint date must match filename date (${expectedDate}).`);
    }
    if (frontmatter.properties.has("carryover_done")) {
      const value = normalizeYamlScalar(frontmatter.properties.get("carryover_done")).toLowerCase();
      if (value !== "true" && value !== "false") {
        addIssue(issues, "error", "checkpoint-daily-carryover-done-format", rel, "Daily checkpoint carryover_done must be true or false.");
      }
    }
    if (frontmatter.properties.has("carried_from")) {
      const value = normalizeYamlScalar(frontmatter.properties.get("carried_from"));
      if (!ISO_DATE.test(value)) {
        addIssue(issues, "error", "checkpoint-daily-carried-from-format", rel, "Daily checkpoint carried_from should use YYYY-MM-DD.");
      } else if (value >= expectedDate) {
        addIssue(issues, "error", "checkpoint-daily-carried-from-order", rel, "Daily checkpoint carried_from must be earlier than date.");
      }
    }
  }

  match = rel.match(/^10-checkpoints\/weekly\/(\d{4})\/(\d{4})W(\d{2})\.md$/);
  if (match) {
    const [, yearInPath, yearInFile, weekNumber] = match;
    if (yearInPath !== yearInFile) addIssue(issues, "error", "weekly-path-date-consistency", rel, "Weekly checkpoint year in path and filename are inconsistent.");
    const expectedWeek = `${yearInFile}-W${weekNumber}`;
    if (!frontmatter.properties.has("week")) {
      addIssue(issues, "error", "checkpoint-weekly-week-required", rel, "Weekly checkpoint requires week: YYYY-Www");
    } else {
      const value = normalizeYamlScalar(frontmatter.properties.get("week"));
      if (!ISO_WEEK.test(value)) addIssue(issues, "error", "checkpoint-weekly-week-format", rel, "Weekly checkpoint week should use YYYY-Www");
      else if (value !== expectedWeek) addIssue(issues, "error", "checkpoint-weekly-week-consistency", rel, `Weekly checkpoint week must match filename week (${expectedWeek}).`);
    }
    if (!frontmatter.properties.has("week_start")) {
      addIssue(issues, "error", "checkpoint-weekly-week-start-required", rel, "Weekly checkpoint requires week_start: YYYY-MM-DD");
    } else if (!ISO_DATE.test(normalizeYamlScalar(frontmatter.properties.get("week_start")))) {
      addIssue(issues, "error", "checkpoint-weekly-week-start-format", rel, "Weekly checkpoint week_start should use YYYY-MM-DD");
    }
  }

  match = rel.match(/^10-checkpoints\/monthly\/(\d{4})\/(\d{4})(\d{2})\.md$/);
  if (match) {
    const [, yearInPath, yearInFile, monthInFile] = match;
    if (yearInPath !== yearInFile) addIssue(issues, "error", "monthly-path-date-consistency", rel, "Monthly checkpoint year in path and filename are inconsistent.");
    const expectedMonth = `${yearInFile}-${monthInFile}`;
    if (!frontmatter.properties.has("month")) {
      addIssue(issues, "error", "checkpoint-monthly-month-required", rel, "Monthly checkpoint requires month: YYYY-MM");
    } else {
      const value = normalizeYamlScalar(frontmatter.properties.get("month"));
      if (!ISO_MONTH.test(value)) addIssue(issues, "error", "checkpoint-monthly-month-format", rel, "Monthly checkpoint month should use YYYY-MM");
      else if (value !== expectedMonth) addIssue(issues, "error", "checkpoint-monthly-month-consistency", rel, `Monthly checkpoint month must match filename month (${expectedMonth}).`);
    }
    if (!frontmatter.properties.has("month_start")) {
      addIssue(issues, "error", "checkpoint-monthly-month-start-required", rel, "Monthly checkpoint requires month_start: YYYY-MM-DD");
    } else if (!ISO_DATE.test(normalizeYamlScalar(frontmatter.properties.get("month_start")))) {
      addIssue(issues, "error", "checkpoint-monthly-month-start-format", rel, "Monthly checkpoint month_start should use YYYY-MM-DD");
    }
  }
}

function validateCheckpointPath(issues, rel, fileName) {
  const daily = rel.match(/^10-checkpoints\/daily\/(\d{4})\/(\d{2})\/(\d{8})\.md$/);
  if (daily) {
    if (daily[3].slice(0, 4) !== daily[1] || daily[3].slice(4, 6) !== daily[2]) {
      addIssue(issues, "error", "daily-path-date-consistency", rel, "Daily checkpoint path and filename date are inconsistent.");
    }
  } else if (rel.startsWith("10-checkpoints/daily/") && rel.endsWith(".md")) {
    addIssue(issues, "warning", "daily-path-pattern", rel, "Daily checkpoint should be 10-checkpoints/daily/YYYY/MM/YYYYMMDD.md");
  }
  if (rel.startsWith("10-checkpoints/weekly/") && !/^\d{4}W\d{2}\.md$/.test(fileName)) {
    addIssue(issues, "warning", "weekly-filename", rel, "Weekly checkpoint should be YYYYWww.md");
  }
  if (rel.startsWith("10-checkpoints/monthly/") && !/^\d{6}\.md$/.test(fileName)) {
    addIssue(issues, "warning", "monthly-filename", rel, "Monthly checkpoint should be YYYYMM.md");
  }
}

export function runValidateVaultRules({
  vaultRoot = ".",
  failOnError = false,
  asJson = false,
  jsonOutPath,
  includePrefixes = [],
} = {}) {
  requireNode22();
  const root = resolveVaultRoot(vaultRoot);
  const issues = [];

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !startsWithAnyPrefix(entry.name, includePrefixes)) continue;
    if (!ALLOWED_TOP_LEVEL.has(entry.name)) {
      addIssue(issues, "warning", "top-level-path", entry.name, "Top-level directory is not in allowed paths.");
    }
  }

  for (const filePath of listMarkdownFiles(root)) {
    const rel = relativePath(root, filePath);
    if (!startsWithAnyPrefix(rel, includePrefixes)) continue;
    const read = readUtf8Safe(filePath);
    if (!read.ok) {
      addIssue(issues, "warning", "encoding-safety", rel, `Skipped rule parse because file is not strict UTF-8 (${read.reason}).`);
      continue;
    }

    const content = read.content;
    const lines = content.length > 0 ? content.split(/\r?\n/) : [];
    const isTemplate = rel.startsWith("99-system/templates/");
    const styleContent = content.replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "");
    const fileName = path.basename(filePath);
    const baseName = basenameWithoutExtension(filePath);

    const obsidianLinks = styleContent.match(/!?\[\[[^\]]+\]\]/g) ?? [];
    const invalidObsidianLink = obsidianLinks.find(
      (link) => !/^!\[\[[^\]\r\n]+\.base(?:#[^\]\r\n]+)?\]\]$/.test(link),
    );
    if (invalidObsidianLink) {
      addIssue(
        issues,
        "warning",
        "no-obsidian-link-syntax",
        rel,
        "Use standard Markdown links/images; only ![[path/file.base#View]] Base embeds are allowed.",
      );
    }
    if (/ copy\.md$/i.test(fileName) || /最新版|最終版/.test(fileName)) {
      addIssue(issues, "warning", "filename-cleanliness", rel, "Avoid copy/latest/final suffix in file names.");
    }
    for (const match of styleContent.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].trim();
      if (/^(?:https?:\/\/|data:|#)/.test(target)) continue;
      if (!target.startsWith("./assets/")) {
        addIssue(issues, "warning", "image-assets-path", rel, "Local image should use ./assets/<file> path.");
        break;
      }
    }

    const frontmatter = parseFrontmatter(lines);
    const isInInbox = rel.startsWith("00-inbox/");
    const isCheckpointPath = rel.startsWith("10-checkpoints/");
    const isRootGuide = ["AGENTS.md", "README.md", "Home.md"].includes(rel);
    const isLocalOnly = rel.startsWith("local-only/");

    if (!frontmatter.hasFrontmatter) {
      if (isLocalOnly) addIssue(issues, "error", "local-only-frontmatter-required", rel, "Files under local-only must have frontmatter with confidential: true");
      else if (!isInInbox && !isRootGuide) addIssue(issues, "warning", "frontmatter-required", rel, "Frontmatter is missing.");
      continue;
    }

    if (isLocalOnly) {
      if (!frontmatter.properties.has("confidential")) {
        addIssue(issues, "error", "local-only-confidential-required", rel, "Files under local-only must set confidential: true");
      } else if (normalizeYamlScalar(frontmatter.properties.get("confidential")).toLowerCase() !== "true") {
        addIssue(issues, "error", "local-only-confidential-value", rel, "local-only confidential must be true");
      }
    }
    if (frontmatter.endLineIndex >= 0 && frontmatter.endLineIndex + 1 < lines.length && lines[frontmatter.endLineIndex + 1].trim() === "") {
      addIssue(issues, "warning", "no-blank-after-frontmatter", rel, "Do not add blank line right after frontmatter closing ---");
    }
    for (const key of frontmatter.repeatedPropertyKeys) {
      addIssue(issues, "warning", "frontmatter-duplicate-key", rel, `Duplicate frontmatter key: ${key}`);
    }

    if (!frontmatter.properties.has("type")) {
      if (!isInInbox) addIssue(issues, "warning", "type-required", rel, "type property is missing.");
    } else {
      const type = normalizeYamlScalar(frontmatter.properties.get("type"));
      if (!ALLOWED_TYPES.has(type)) {
        addIssue(issues, "error", "type-value", rel, "type must be one of: note, record, living-document, checkpoint");
      } else if (!isTemplate) {
        for (const key of REQUIRED_KEYS_BY_TYPE[type]) {
          if (!frontmatter.properties.has(key)) addIssue(issues, "error", "type-schema-required-key", rel, `type=${type} requires frontmatter key: ${key}`);
        }
        const allowedKeys = new Set([...COMMON_ALLOWED_KEYS, ...ALLOWED_KEYS_BY_TYPE[type]]);
        for (const key of frontmatter.properties.keys()) {
          if (!allowedKeys.has(key)) addIssue(issues, "error", "type-schema-unknown-key", rel, `type=${type} does not allow key: ${key}`);
        }
      }

      if (type === "living-document" && /^\d{8}(?:_|$)/.test(baseName)) {
        addIssue(issues, "warning", "living-document-filename", rel, "living-document should not have date prefix in filename.");
      }
      if (!isTemplate && (type === "note" || type === "record") && !/^\d{8}(?:_|T\d{6}[+\-]\d{4}_)/.test(baseName)) {
        addIssue(issues, "warning", "note-record-filename", rel, "note/record should use YYYYMMDD_<name>.md or datetime prefix.");
      }
      if (!isTemplate && type === "checkpoint" && !isCheckpointPath) {
        addIssue(issues, "warning", "checkpoint-location", rel, "checkpoint should be under 10-checkpoints.");
      }
      if (isCheckpointPath && type !== "checkpoint" && rel !== "10-checkpoints/Checkpoints.md") {
        addIssue(issues, "warning", "checkpoint-type", rel, "Files under 10-checkpoints should use type: checkpoint.");
      }
      if (!isTemplate && type === "checkpoint") validateCheckpointMetadata(issues, rel, frontmatter);
    }

    if (!isTemplate && frontmatter.properties.has("created") && !ISO_DATE.test(normalizeYamlScalar(frontmatter.properties.get("created")))) {
      addIssue(issues, "warning", "created-date-format", rel, "created should use YYYY-MM-DD");
    }
    if (!isTemplate && frontmatter.properties.has("updated") && !ISO_DATE.test(normalizeYamlScalar(frontmatter.properties.get("updated")))) {
      addIssue(issues, "warning", "updated-date-format", rel, "updated should use YYYY-MM-DD");
    }
    if (!isTemplate && frontmatter.properties.has("created_at") && !ISO_DATETIME_WITH_OFFSET.test(frontmatter.properties.get("created_at"))) {
      addIssue(issues, "warning", "created-at-format", rel, "created_at should use ISO8601 with timezone offset.");
    }
    validateCheckpointPath(issues, rel, fileName);
  }

  issues.sort((a, b) => a.severity.localeCompare(b.severity) || a.rule.localeCompare(b.rule) || a.path.localeCompare(b.path));
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const json = `${JSON.stringify(issues, null, 2)}\n`;
  if (asJson && !jsonOutPath) {
    process.stdout.write(json);
  } else {
    console.log(`Vault root: ${root}`);
    console.log(`Issues: error=${errorCount}, warning=${warningCount}`);
    if (issues.length > 0) {
      console.log("");
      printRows(issues, ["severity", "rule", "path", "message"]);
    } else {
      console.log("No issues found.");
    }
    if (jsonOutPath) {
      const outputPath = path.resolve(jsonOutPath);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, json, "utf8");
      console.log("");
      console.log(`JSON report written: ${outputPath}`);
    }
  }

  const exitCode = failOnError && errorCount > 0 ? 1 : 0;
  return { issues, errorCount, warningCount, exitCode };
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2), {
      booleans: ["failOnError", "asJson"],
      strings: ["vaultRoot", "jsonOutPath"],
      arrays: ["includePrefixes"],
    });
    const result = runValidateVaultRules(options);
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (isMain(import.meta.url)) main();
