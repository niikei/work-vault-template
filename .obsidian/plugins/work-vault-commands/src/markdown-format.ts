import { applyFixes, type LintError, type Rule } from "markdownlint";
import { lint } from "markdownlint/sync";

const DOCUMENT_NAME = "current-document";
const YAML_FRONT_MATTER =
  /^---[^\S\r\n]*(?:\r\n|\r|\n)[\s\S]*?^---[^\S\r\n]*(?:\r\n|\r|\n|$)/m;

const frontmatterBodySpacingRule: Rule = {
  names: ["work-vault-frontmatter-body-spacing"],
  description: "Front matter and body must be adjacent",
  tags: ["blank_lines", "whitespace"],
  parser: "none",
  function: (params, onError) => {
    if (params.frontMatterLines.length === 0) {
      return;
    }

    const firstBodyLine = params.lines.findIndex(
      (line) => line.trim().length > 0,
    );
    if (firstBodyLine <= 0) {
      return;
    }
    for (let lineIndex = 0; lineIndex < firstBodyLine; lineIndex += 1) {
      onError({
        lineNumber: lineIndex + 1,
        fixInfo: { deleteCount: -1 },
      });
    }
  },
};

const config = {
  default: false,
  MD009: {
    br_spaces: 2,
    code_blocks: false,
    list_item_empty_lines: false,
    strict: false,
  },
  MD012: { maximum: 1 },
  MD022: {
    include_front_matter: false,
    lines_above: 1,
    lines_below: 1,
  },
  MD031: true,
  MD032: true,
  MD047: true,
  MD058: true,
  "work-vault-frontmatter-body-spacing": true,
} as const;

export interface MarkdownFormatChange {
  count: number;
  description: string;
  rule: string;
}

export interface MarkdownFormatResult {
  changes: MarkdownFormatChange[];
  formatted: string;
}

type FixableLintError = LintError & {
  fixInfo: NonNullable<LintError["fixInfo"]>;
};

export function formatMarkdown(source: string): MarkdownFormatResult {
  const errors = lint({
    config,
    customRules: [frontmatterBodySpacingRule],
    frontMatter: YAML_FRONT_MATTER,
    strings: { [DOCUMENT_NAME]: source },
  })[DOCUMENT_NAME];
  if (errors === undefined) {
    throw new Error("markdownlint did not return a result.");
  }

  const sourceLines = source.split(/\r\n|\r|\n/);
  const fixableErrors = errors
    .filter((error): error is FixableLintError => error.fixInfo !== null)
    .map((error) => preserveHardBreak(error, sourceLines));

  return {
    changes: summarizeChanges(fixableErrors),
    formatted: applyFixes(source, fixableErrors),
  };
}

function preserveHardBreak(
  error: FixableLintError,
  sourceLines: string[],
): FixableLintError {
  if (error.ruleNames[0] !== "MD009") {
    return error;
  }

  const line = sourceLines[error.lineNumber - 1];
  const trailingWhitespace = line?.match(/[ \t]+$/)?.[0];
  const trailingSpaces = line?.match(/ +$/)?.[0];
  if (
    line === undefined ||
    trailingWhitespace === undefined ||
    (trailingSpaces?.length ?? 0) < 2
  ) {
    return error;
  }

  return {
    ...error,
    fixInfo: {
      deleteCount: trailingWhitespace.length,
      editColumn: line.length - trailingWhitespace.length + 1,
      insertText: "  ",
      lineNumber: error.lineNumber,
    },
  };
}

function summarizeChanges(errors: LintError[]): MarkdownFormatChange[] {
  const changes = new Map<string, MarkdownFormatChange>();
  for (const error of errors) {
    const rule = error.ruleNames[0] ?? "unknown";
    const current = changes.get(rule);
    if (current === undefined) {
      changes.set(rule, {
        count: 1,
        description: error.ruleDescription,
        rule,
      });
    } else {
      current.count += 1;
    }
  }
  return [...changes.values()].sort((left, right) =>
    left.rule.localeCompare(right.rule),
  );
}
