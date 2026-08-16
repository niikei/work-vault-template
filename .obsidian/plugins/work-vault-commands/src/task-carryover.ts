export const TASKS_START = "<!-- TASKS:START -->";
export const TASKS_END = "<!-- TASKS:END -->";
export const CARRYOVER_START = "<!-- CARRYOVER:START -->";
export const CARRYOVER_END = "<!-- CARRYOVER:END -->";
export const NO_CARRYOVER = "<!-- 繰越タスクなし -->";

type TaskState = "todo" | "doing" | "done";

interface TaskNode {
  line: string;
  indent: number;
  state: TaskState;
  children: TaskNode[];
}

interface MarkedRegion {
  start: number;
  contentStart: number;
  endStart: number;
  end: number;
}

export interface TaskLineCycle {
  lineOffset: number;
  before: string;
  after: string;
}

const DAILY_PATH = /^10-checkpoints\/daily\/(\d{4})\/(\d{2})\/(\d{8})\.md$/;
const TASK_LINE = /^([ \t]*)[-*+] \[([ /xX])\](?:\s+(.*))?$/;
const LEGACY_TASK_HEADINGS = new Set([
  "## Tasks",
  "## タスク",
  "## 前回からの引き継ぎ",
  "## 今日の最重要3つ",
  "## 次の仕事日の最初の一手",
]);

export function cycleTaskStateLine(line: string): string | null {
  const match = line.match(/^(\s*[-*+] \[)([ /xX])(\].*)$/);
  if (!match) return null;

  const next =
    match[2] === " " ? "/" : match[2] === "/" ? "x" : " ";
  return `${match[1]}${next}${match[3]}`;
}

export function cycleTaskAtIndex(
  markdownSection: string,
  taskIndex: number,
): TaskLineCycle | null {
  if (!Number.isInteger(taskIndex) || taskIndex < 0) return null;

  const lines = markdownSection.split(/\r?\n/);
  let currentIndex = 0;
  for (let lineOffset = 0; lineOffset < lines.length; lineOffset += 1) {
    const before = lines[lineOffset];
    if (before === undefined) continue;
    const after = cycleTaskStateLine(before);
    if (after === null) continue;
    if (currentIndex === taskIndex) return { lineOffset, before, after };
    currentIndex += 1;
  }
  return null;
}

export function cycleTaskAtIndexInMarkdown(
  markdown: string,
  taskIndex: number,
): string | null {
  const cycle = cycleTaskAtIndex(markdown, taskIndex);
  if (!cycle) return null;

  const lineEnding = markdown.includes("\r\n") ? "\r\n" : "\n";
  const lines = markdown.split(/\r?\n/);
  lines[cycle.lineOffset] = cycle.after;
  return lines.join(lineEnding);
}

export function extractCarryoverTaskLines(markdown: string): string[] {
  const taskContent = extractTaskContent(markdown);
  const roots: TaskNode[] = [];
  const stack: TaskNode[] = [];

  for (const line of taskContent.split(/\r?\n/)) {
    const match = line.match(TASK_LINE);
    if (!match) continue;

    const label = (match[3] ?? "").trim();
    if (label === "" || isLegacyPlaceholder(label)) continue;

    const state = markerToState(match[2] ?? " ");
    const node: TaskNode = {
      line,
      indent: indentationWidth(match[1] ?? ""),
      state,
      children: [],
    };

    while (
      stack.length > 0 &&
      (stack[stack.length - 1]?.indent ?? -1) >= node.indent
    ) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(node);
    else roots.push(node);
    stack.push(node);
  }

  return roots.flatMap(unfinishedTreeLines);
}

export function replaceCarryoverBlock(
  markdown: string,
  taskLines: readonly string[],
): string {
  const region = findUniqueRegion(markdown, CARRYOVER_START, CARRYOVER_END);
  const body = taskLines.length > 0 ? taskLines.join("\n") : NO_CARRYOVER;
  return `${markdown.slice(0, region.contentStart)}\n${body}\n${markdown.slice(region.endStart)}`;
}

export function assertManagedDaily(markdown: string): void {
  const tasks = findUniqueRegion(markdown, TASKS_START, TASKS_END);
  const carryover = findUniqueRegion(markdown, CARRYOVER_START, CARRYOVER_END);
  if (
    carryover.start < tasks.contentStart ||
    carryover.end > tasks.endStart
  ) {
    throw new Error("DailyのCARRYOVER領域はTASKS領域の内側に置く必要がある。");
  }
}

export function hasManagedDailyMarker(markdown: string): boolean {
  return [TASKS_START, TASKS_END, CARRYOVER_START, CARRYOVER_END].some(
    (marker) => markdown.includes(marker),
  );
}

export function selectMostRecentDailyPath(
  paths: readonly string[],
  todayCompact: string,
): string | null {
  let selectedPath: string | null = null;
  let selectedDate = "";

  for (const path of paths) {
    const match = path.match(DAILY_PATH);
    if (!match) continue;
    const compactDate = match[3] ?? "";
    if (compactDate >= todayCompact || compactDate <= selectedDate) continue;
    selectedDate = compactDate;
    selectedPath = path;
  }

  return selectedPath;
}

export function dailyDateFromPath(path: string): string | null {
  const match = path.match(DAILY_PATH);
  if (!match) return null;
  const compact = match[3] ?? "";
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

export function isFrontmatterTrue(markdown: string, key: string): boolean {
  const frontmatter = getFrontmatter(markdown);
  if (!frontmatter) return false;
  const keyPattern = escapeRegExp(key);
  const match = frontmatter.body.match(
    new RegExp(`^${keyPattern}:\\s*(.*?)\\s*$`, "m"),
  );
  if (!match) return false;
  return stripYamlQuotes(match[1] ?? "").toLowerCase() === "true";
}

export function setFrontmatterProperties(
  markdown: string,
  properties: Readonly<Record<string, string | null>>,
): string {
  const frontmatter = getFrontmatter(markdown);
  if (!frontmatter) throw new Error("Dailyにfrontmatterがないため更新できない。");

  const lines = frontmatter.body.split(/\r?\n/);
  for (const [key, value] of Object.entries(properties)) {
    const keyPattern = new RegExp(`^${escapeRegExp(key)}:\\s*`);
    const indexes = lines.flatMap((line, index) =>
      keyPattern.test(line) ? [index] : [],
    );
    if (indexes.length > 1) {
      throw new Error(`Dailyのfrontmatterに${key}が複数ある。`);
    }
    if (indexes.length === 1) {
      const index = indexes[0];
      if (index === undefined) continue;
      if (value === null) lines.splice(index, 1);
      else lines[index] = `${key}: ${value}`;
    } else if (value !== null) {
      lines.push(`${key}: ${value}`);
    }
  }

  return `---\n${lines.join("\n")}\n---${markdown.slice(frontmatter.end)}`;
}

function extractTaskContent(markdown: string): string {
  const taskStartCount = countOccurrences(markdown, TASKS_START);
  const taskEndCount = countOccurrences(markdown, TASKS_END);
  if (taskStartCount > 0 || taskEndCount > 0) {
    const region = findUniqueRegion(markdown, TASKS_START, TASKS_END);
    return markdown.slice(region.contentStart, region.endStart);
  }

  const selectedLines: string[] = [];
  let inSelectedSection = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^##\s+/.test(line)) {
      inSelectedSection = LEGACY_TASK_HEADINGS.has(line.trim());
      continue;
    }
    if (inSelectedSection) selectedLines.push(line);
  }
  return selectedLines.join("\n");
}

function findUniqueRegion(
  markdown: string,
  startMarker: string,
  endMarker: string,
): MarkedRegion {
  if (
    countOccurrences(markdown, startMarker) !== 1 ||
    countOccurrences(markdown, endMarker) !== 1
  ) {
    throw new Error(
      `Dailyの${startMarker}と${endMarker}はそれぞれ1個必要である。`,
    );
  }

  const start = markdown.indexOf(startMarker);
  const endStart = markdown.indexOf(endMarker);
  const contentStart = start + startMarker.length;
  if (endStart < contentStart) {
    throw new Error(`Dailyの${startMarker}と${endMarker}の順序が正しくない。`);
  }
  return {
    start,
    contentStart,
    endStart,
    end: endStart + endMarker.length,
  };
}

function unfinishedTreeLines(node: TaskNode): string[] {
  if (node.state === "done") return [];
  return [node.line, ...node.children.flatMap(unfinishedTreeLines)];
}

function markerToState(marker: string): TaskState {
  if (marker === "/") return "doing";
  if (marker.toLowerCase() === "x") return "done";
  return "todo";
}

function indentationWidth(indentation: string): number {
  return [...indentation].reduce(
    (width, character) => width + (character === "\t" ? 4 : 1),
    0,
  );
}

function isLegacyPlaceholder(label: string): boolean {
  return /^前日の未完了タスクはない。(?:\s+🔁前日繰越)?$/.test(label);
}

function countOccurrences(value: string, needle: string): number {
  let count = 0;
  let position = 0;
  while ((position = value.indexOf(needle, position)) !== -1) {
    count += 1;
    position += needle.length;
  }
  return count;
}

function getFrontmatter(
  markdown: string,
): { body: string; end: number } | null {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  return { body: match[1] ?? "", end: match[0].length };
}

function stripYamlQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
