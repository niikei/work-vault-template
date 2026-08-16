import { type App, MarkdownView, Notice } from "obsidian";

import { applyFormattedMarkdown } from "./editor-format";
import { formatMarkdown } from "./markdown-format";

export class MarkdownFormatter {
  constructor(private readonly app: App) {}

  async formatActive(): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view === null || view.file === null) {
      new Notice("Open a Markdown note before formatting.");
      return;
    }

    const source = view.editor.getValue();
    const result = formatMarkdown(source);
    if (result.formatted === source) {
      new Notice("Markdown formatting is already clean.");
      return;
    }

    const application = applyFormattedMarkdown(
      view.editor,
      source,
      result.formatted,
    );
    if (application !== "applied") {
      console.error(
        "Work Vault Commands",
        "Markdown formatting was not applied to the editor.",
      );
      new Notice("Markdown formatting failed. Run it again.");
      return;
    }

    const fixes = result.changes.reduce(
      (total, change) => total + change.count,
      0,
    );
    view.editor.focus();
    new Notice(`Markdown formatting applied (${fixes}). Undo is available.`);
  }
}
