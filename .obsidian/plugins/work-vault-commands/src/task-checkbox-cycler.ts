import { EditorView } from "@codemirror/view";
import { MarkdownView, Notice, type App } from "obsidian";

import {
  cycleTaskAtIndexInMarkdown,
  cycleTaskStateLine,
} from "./task-carryover";

const CHECKBOX_SELECTOR = [
  "input.task-list-item-checkbox",
  'input[type="checkbox"][data-task]',
  'li[data-task] > input[type="checkbox"]',
  'li[data-task] > p > input[type="checkbox"]',
  'li.task-list-item > input[type="checkbox"]',
  'li.task-list-item > p > input[type="checkbox"]',
].join(", ");

export class TaskCheckboxCycler {
  constructor(private readonly app: App) {}

  processClick(event: MouseEvent): void {
    try {
      const checkbox = this.getEventCheckbox(event);
      if (!checkbox || !this.isCyclableCheckbox(checkbox)) return;

      if (checkbox.closest(".markdown-source-view.mod-cm6")) {
        this.processLivePreviewClick(event, checkbox);
        return;
      }
      if (checkbox.closest(".markdown-preview-view")) {
        this.processReadingViewClick(event, checkbox);
      }
    } catch (error) {
      console.error("Work Vault task checkbox", error);
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }

  private processLivePreviewClick(
    event: MouseEvent,
    checkbox: HTMLInputElement,
  ): void {
    const view = this.findMarkdownView(checkbox);
    if (!view?.file) return;
    const editorElement = checkbox.closest<HTMLElement>(".cm-editor");
    const codeMirror = editorElement
      ? EditorView.findFromDOM(editorElement)
      : null;
    if (!codeMirror) return;
    const offset = codeMirror.posAtCoords(
      { x: event.clientX, y: event.clientY },
      false,
    );
    if (offset === null) return;

    const lineNumber = codeMirror.state.doc.lineAt(offset).number - 1;
    const before = view.editor.getLine(lineNumber);
    const after = cycleTaskStateLine(before);
    if (after === null) return;
    const isDone = /^\s*[-*+] \[[xX]\]/.test(after);

    this.stopDefaultToggle(event);
    checkbox.checked = isDone;
    checkbox.indeterminate = false;
    view.editor.setLine(lineNumber, after);
    this.syncLivePreviewCheckbox(codeMirror, lineNumber, isDone);
    checkbox.ownerDocument.defaultView?.requestAnimationFrame(() => {
      this.syncLivePreviewCheckbox(codeMirror, lineNumber, isDone);
    });
  }

  private syncLivePreviewCheckbox(
    codeMirror: EditorView,
    lineNumber: number,
    checked: boolean,
  ): void {
    if (lineNumber < 0 || lineNumber >= codeMirror.state.doc.lines) return;
    const lineStart = codeMirror.state.doc.line(lineNumber + 1).from;
    const node = codeMirror.domAtPos(lineStart).node;
    const element = node instanceof Element ? node : node.parentElement;
    const line = element?.closest<HTMLElement>(".HyperMD-task-line");
    const checkbox = line?.querySelector<HTMLInputElement>(
      "input.task-list-item-checkbox",
    );
    if (!checkbox) return;
    checkbox.checked = checked;
    checkbox.indeterminate = false;
  }

  private processReadingViewClick(
    event: MouseEvent,
    checkbox: HTMLInputElement,
  ): void {
    const view = this.findMarkdownView(checkbox);
    if (!view?.file) return;
    const preview = checkbox.closest<HTMLElement>(".markdown-preview-view");
    if (!preview) return;

    const taskIndex = this.getCyclableCheckboxes(preview).indexOf(checkbox);
    if (taskIndex < 0) return;

    this.stopDefaultToggle(event);
    void this.app.vault
      .process(view.file, (markdown) => {
        const updated = cycleTaskAtIndexInMarkdown(markdown, taskIndex);
        if (updated === null) {
          throw new Error("表示中のタスクとMarkdown行を対応付けられなかった。");
        }
        return updated;
      })
      .catch((error: unknown) => {
        console.error("Work Vault task checkbox", error);
        new Notice(error instanceof Error ? error.message : String(error));
      });
  }

  private findMarkdownView(element: HTMLElement): MarkdownView | null {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      if (
        leaf.view instanceof MarkdownView &&
        leaf.view.containerEl.contains(element)
      ) {
        return leaf.view;
      }
    }
    return null;
  }

  private getCyclableCheckboxes(element: HTMLElement): HTMLInputElement[] {
    return Array.from(
      element.querySelectorAll<HTMLInputElement>(CHECKBOX_SELECTOR),
    ).filter((checkbox) => this.isCyclableCheckbox(checkbox));
  }

  private isCyclableCheckbox(checkbox: HTMLInputElement): boolean {
    const marker = getCheckboxMarker(checkbox);
    return marker === " " || marker === "/" || marker.toLowerCase() === "x";
  }

  private getEventCheckbox(event: MouseEvent): HTMLInputElement | null {
    if (!(event.target instanceof Element)) return null;
    return event.target.closest<HTMLInputElement>(CHECKBOX_SELECTOR);
  }

  private stopDefaultToggle(event: MouseEvent): void {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

function getCheckboxMarker(checkbox: HTMLInputElement): string {
  const marker =
    checkbox.dataset.task ??
    checkbox.closest<HTMLElement>("li[data-task]")?.dataset.task;
  if (marker === undefined || marker === "") {
    return checkbox.checked ? "x" : " ";
  }
  return marker;
}
