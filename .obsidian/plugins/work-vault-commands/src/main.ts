import { Notice, Plugin, TFile } from "obsidian";

import { WorkNotesActions } from "./actions";
import { CalendarView, CALENDAR_VIEW_TYPE } from "./calendar-view";
import { ExplorerIcons } from "./explorer-icons";
import { MarkdownFormatter } from "./formatting";
import { FolderTemplates } from "./folder-templates";
import { TaskCheckboxCycler } from "./task-checkbox-cycler";
import { cycleTaskStateLine } from "./task-carryover";
import { WebClipDedup } from "./web-clip-dedup";

export default class WorkNotesCommandsPlugin extends Plugin {
  onload(): void {
    this.registerView(CALENDAR_VIEW_TYPE, (leaf) => new CalendarView(leaf));

    const actions = new WorkNotesActions(this.app);
    const explorerIcons = new ExplorerIcons(this.app);
    const formatter = new MarkdownFormatter(this.app);
    const dedup = new WebClipDedup(this.app);
    const folderTemplates = new FolderTemplates(this.app);
    const taskCheckboxCycler = new TaskCheckboxCycler(this.app);

    this.registerDomEvent(
      document,
      "click",
      (event) => taskCheckboxCycler.processClick(event),
      { capture: true },
    );

    this.app.workspace.onLayoutReady(() => {
      explorerIcons.start();
      void this.run(() => this.ensureCalendarTab(false));
    });
    this.register(() => explorerIcons.stop());
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile) {
          dedup.onFileCreated(file);
          this.run(() => folderTemplates.onFileCreated(file));
        }
      }),
    );
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) =>
        this.run(() => dedup.onMetadataChanged(file)),
      ),
    );
    this.addCommand({
      id: "open-home",
      name: "Open Home",
      callback: () => this.run(() => actions.openHome()),
    });
    this.addCommand({
      id: "start-today",
      name: "Start Today",
      callback: () => this.run(() => actions.startToday()),
    });
    this.addCommand({
      id: "open-todays-checkpoint",
      name: "Open today's checkpoint",
      callback: () => this.run(() => actions.openCheckpoint("daily")),
    });
    this.addCommand({
      id: "open-current-weekly",
      name: "Open current Weekly checkpoint",
      callback: () => this.run(() => actions.openCheckpoint("weekly")),
    });
    this.addCommand({
      id: "open-current-monthly",
      name: "Open current Monthly checkpoint",
      callback: () => this.run(() => actions.openCheckpoint("monthly")),
    });
    this.addCommand({
      id: "open-checkpoint-review",
      name: "Open checkpoint review",
      callback: () => this.run(() => actions.openCheckpointReview()),
    });
    this.addCommand({
      id: "create-from-template",
      name: "Create from Template",
      callback: () => this.run(() => actions.createFromTemplate()),
    });
    this.addCommand({
      id: "create-jotting",
      name: "Create Jotting",
      callback: () => this.run(() => actions.createJotting()),
    });
    this.addCommand({
      id: "create-jotting-in-new-pane",
      name: "Create Jotting in new pane",
      callback: () => this.run(() => actions.createJottingInNewPane()),
    });
    this.addCommand({
      id: "format-current-markdown",
      name: "Format current Markdown",
      callback: () => this.run(() => formatter.formatActive()),
    });
    this.addCommand({
      id: "open-calendar",
      name: "Open Calendar",
      callback: () => this.run(() => this.activateCalendar()),
    });
    this.addCommand({
      id: "cycle-task-state",
      name: "Cycle task state",
      editorCallback: (editor) => {
        const cursor = editor.getCursor();
        const currentLine = editor.getLine(cursor.line);
        const updatedLine = cycleTaskStateLine(currentLine);
        if (updatedLine === null) {
          new Notice("カーソル行はタスクではない。");
          return;
        }
        editor.setLine(cursor.line, updatedLine);
      },
    });

    this.addRibbonIcon("calendar-check", "Open today's checkpoint", () =>
      this.run(() => actions.openCheckpoint("daily")),
    );
    this.addRibbonIcon("calendar", "Open Calendar", () =>
      this.run(() => this.activateCalendar()),
    );
    this.addRibbonIcon("sunrise", "Start Today", () =>
      this.run(() => actions.startToday()),
    );
    this.addRibbonIcon("files", "Create from Template", () =>
      this.run(() => actions.createFromTemplate()),
    );
    this.addRibbonIcon("pencil", "Create Jotting", () =>
      this.run(() => actions.createJotting()),
    );
  }

  private async activateCalendar(): Promise<void> {
    await this.ensureCalendarTab(true);
  }

  private async ensureCalendarTab(reveal: boolean): Promise<void> {
    await this.app.workspace.ensureSideLeaf(CALENDAR_VIEW_TYPE, "right", {
      active: reveal,
      reveal,
      split: false,
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      console.error("Work Vault Commands", error);
      new Notice(error instanceof Error ? error.message : String(error));
    }
  }
}
