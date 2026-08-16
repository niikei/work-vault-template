import type { Editor } from "obsidian";

export type EditorFormatResult = "applied" | "changed" | "failed";

export function applyFormattedMarkdown(
  editor: Editor,
  source: string,
  formatted: string,
): EditorFormatResult {
  if (editor.getValue() !== source) {
    return "changed";
  }

  const change = findChangedRange(source, formatted);
  editor.replaceRange(
    change.text,
    editor.offsetToPos(change.from),
    editor.offsetToPos(change.to),
    "markdownlint",
  );
  return editor.getValue() === formatted ? "applied" : "failed";
}

interface ChangedRange {
  from: number;
  text: string;
  to: number;
}

function findChangedRange(source: string, formatted: string): ChangedRange {
  let prefixLength = 0;
  const maximumPrefix = Math.min(source.length, formatted.length);
  while (
    prefixLength < maximumPrefix &&
    source[prefixLength] === formatted[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  const maximumSuffix = Math.min(
    source.length - prefixLength,
    formatted.length - prefixLength,
  );
  while (
    suffixLength < maximumSuffix &&
    source[source.length - suffixLength - 1] ===
      formatted[formatted.length - suffixLength - 1]
  ) {
    suffixLength += 1;
  }

  return {
    from: prefixLength,
    text: formatted.slice(prefixLength, formatted.length - suffixLength),
    to: source.length - suffixLength,
  };
}
