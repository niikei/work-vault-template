import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { TextDecoder } from "node:util";

export const ALLOWED_TOP_LEVEL = new Set([
  ".git",
  ".githooks",
  ".obsidian",
  ".vscode",
  "00-inbox",
  "10-checkpoints",
  "20-work",
  "30-playground",
  "40-jottings",
  "90-archive",
  "99-system",
  "local-only",
]);

export function requireNode22() {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  if (major < 22) {
    throw new Error(`Node.js 22 or later is required. Current: ${process.versions.node}`);
  }
}

export function isMain(importMetaUrl) {
  return process.argv[1] !== undefined && importMetaUrl === pathToFileURL(path.resolve(process.argv[1])).href;
}

export function parseArgs(argv, { booleans = [], strings = [], arrays = [] } = {}) {
  const booleanNames = new Set(booleans);
  const stringNames = new Set(strings);
  const arrayNames = new Set(arrays);
  const result = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unknown positional argument: ${token}`);
    }

    const equalAt = token.indexOf("=");
    const rawName = token.slice(2, equalAt >= 0 ? equalAt : undefined);
    const name = rawName.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
    let value = equalAt >= 0 ? token.slice(equalAt + 1) : undefined;

    if (booleanNames.has(name)) {
      if (value !== undefined && value !== "true" && value !== "false") {
        throw new Error(`--${rawName} expects true or false.`);
      }
      result[name] = value === undefined ? true : value === "true";
      continue;
    }

    if (!stringNames.has(name) && !arrayNames.has(name)) {
      throw new Error(`Unknown option: --${rawName}`);
    }
    if (value === undefined) {
      index += 1;
      value = argv[index];
    }
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`--${rawName} requires a value.`);
    }

    if (arrayNames.has(name)) {
      const values = value.split(",").map((item) => item.trim()).filter(Boolean);
      result[name] = [...(result[name] ?? []), ...values];
    } else {
      result[name] = value;
    }
  }

  return result;
}

export function resolveVaultRoot(value = ".") {
  const root = path.resolve(value);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Vault root not found: ${root}`);
  }
  return root;
}

export function relativePath(root, target) {
  const relative = path.relative(root, target);
  return relative === "" ? "." : relative.split(path.sep).join("/");
}

export function normalizeVaultPath(value) {
  return value.split(/[\\/]+/).filter(Boolean).join("/");
}

export function startsWithAnyPrefix(value, prefixes = []) {
  if (prefixes.length === 0) return true;
  const normalizedValue = normalizeVaultPath(value).toLocaleLowerCase("en-US");
  return prefixes.some((prefix) => {
    const normalizedPrefix = normalizeVaultPath(prefix).toLocaleLowerCase("en-US");
    return normalizedValue === normalizedPrefix || normalizedValue.startsWith(`${normalizedPrefix}/`);
  });
}

export function listEntries(root, {
  kind = "file",
  extension,
  skipDirectory = () => false,
} = {}) {
  const output = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      const rel = relativePath(root, fullPath);
      if (entry.isDirectory()) {
        if (skipDirectory(rel, entry.name)) continue;
        if (kind === "directory") output.push(fullPath);
        visit(fullPath);
      } else if (entry.isFile() && kind === "file") {
        if (extension === undefined || entry.name.toLowerCase().endsWith(extension.toLowerCase())) {
          output.push(fullPath);
        }
      }
    }
  };
  visit(root);
  return output;
}

export function listMarkdownFiles(root) {
  return listEntries(root, {
    extension: ".md",
    skipDirectory: (rel, name) =>
      name === "node_modules" || rel === ".git" || rel.startsWith(".git/") || rel === ".obsidian" || rel.startsWith(".obsidian/"),
  });
}

export function readUtf8Safe(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const hadBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
    const body = hadBom ? buffer.subarray(3) : buffer;
    const content = new TextDecoder("utf-8", { fatal: true }).decode(body);
    if (content.includes("\uFFFD")) {
      return { ok: false, content: "", hadBom, newline: "\n", reason: "replacement-char-detected" };
    }
    return {
      ok: true,
      content,
      hadBom,
      newline: content.includes("\r\n") ? "\r\n" : "\n",
      reason: "",
    };
  } catch {
    return { ok: false, content: "", hadBom: false, newline: "\n", reason: "invalid-utf8" };
  }
}

export function writeUtf8PreservingBom(filePath, content, hadBom) {
  const prefix = hadBom ? Buffer.from([0xef, 0xbb, 0xbf]) : Buffer.alloc(0);
  fs.writeFileSync(filePath, Buffer.concat([prefix, Buffer.from(content, "utf8")]));
}

export function parseFrontmatter(lines) {
  const result = {
    hasFrontmatter: false,
    endLineIndex: -1,
    properties: new Map(),
    repeatedPropertyKeys: [],
  };
  if (lines.length === 0 || lines[0].trim() !== "---") return result;

  result.hasFrontmatter = true;
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "---") {
      result.endLineIndex = index;
      break;
    }
    const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (result.properties.has(key)) result.repeatedPropertyKeys.push(key);
    else result.properties.set(key, value.trim());
  }
  return result;
}

export function normalizeYamlScalar(value) {
  let normalized = String(value ?? "").trim();
  if (normalized.length >= 1 && (normalized[0] === "'" || normalized[0] === '"')) normalized = normalized.slice(1);
  if (normalized.length >= 1 && (normalized.at(-1) === "'" || normalized.at(-1) === '"')) normalized = normalized.slice(0, -1);
  return normalized;
}

export function basenameWithoutExtension(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

export function printRows(rows, columns) {
  if (rows.length === 0) return;
  console.table(rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? ""]))));
}

export function countBy(rows, key, value) {
  return rows.filter((row) => row[key] === value).length;
}

export function numberOption(value, fallback, name) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer.`);
  return parsed;
}
