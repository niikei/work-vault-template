import {
  MarkdownView,
  Modal,
  Notice,
  Setting,
  TFile,
  TFolder,
  type App,
  type WorkspaceLeaf,
} from "obsidian";

import {
  checkpointNow,
  ensureCheckpoint,
  type CheckpointKind,
} from "./checkpoints";
import { ensureFolder, getFile } from "./files";
import {
  JOTTINGS_FOLDER,
  JOTTING_TEMPLATE_PATH,
  nextJottingPath,
  renderJottingTemplate,
} from "./jotting";
import { startToday as runStartToday } from "./start-today";
import {
  CREATABLE_TEMPLATE_PATHS,
  documentDestinationRoots,
  documentNameError,
  documentTemplateKind,
  isAllowedDocumentDestination,
  normalizeDocumentName,
  renderDocumentTemplate,
  templateNoteSpec,
} from "./template-note";

const HOME_PATH = "Home.md";

export class WorkNotesActions {
  constructor(private readonly app: App) {}

  async openHome(): Promise<void> {
    const file = getFile(this.app.vault, HOME_PATH);
    await this.openFile(file, this.app.workspace.getLeaf(false));
  }

  async openCheckpoint(kind: CheckpointKind): Promise<void> {
    const file = await ensureCheckpoint(this.app.vault, kind, checkpointNow());
    await this.openFile(file, this.app.workspace.getLeaf(false));
  }

  async startToday(): Promise<void> {
    const result = await runStartToday(this.app.vault, checkpointNow());
    await this.openFile(result.file, this.app.workspace.getLeaf(false));

    if (result.legacyFormat) {
      new Notice("既存形式のDailyを無変更で開いた。自動繰越は行っていない。");
    } else if (result.alreadyStarted) {
      new Notice("今日のDailyは開始済みである。");
    } else if (result.carriedFrom) {
      new Notice(
        `${result.carriedFrom}から${result.carriedTaskCount}件を繰り越した。`,
      );
    } else {
      new Notice("繰越元なしで今日のDailyを開始した。");
    }
  }

  async openCheckpointReview(): Promise<void> {
    const now = checkpointNow();
    const monthly = await ensureCheckpoint(this.app.vault, "monthly", now);
    const weekly = await ensureCheckpoint(this.app.vault, "weekly", now);
    const daily = await ensureCheckpoint(this.app.vault, "daily", now);

    const monthlyLeaf = this.app.workspace.getLeaf(false);
    const checkpointPaths = new Set([
      monthly.path,
      weekly.path,
      daily.path,
    ]);
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      if (
        leaf !== monthlyLeaf &&
        leaf.view instanceof MarkdownView &&
        checkpointPaths.has(leaf.view.file?.path ?? "")
      ) {
        leaf.detach();
      }
    }

    await this.openFile(monthly, monthlyLeaf);

    const weeklyLeaf = this.app.workspace.getLeaf("split", "vertical");
    await this.openFile(weekly, weeklyLeaf);

    const dailyLeaf = this.app.workspace.getLeaf("split", "vertical");
    await this.openFile(daily, dailyLeaf);
    this.app.workspace.setActiveLeaf(dailyLeaf, { focus: true });
  }

  async createJotting(): Promise<void> {
    await this.createJottingInLeaf(this.app.workspace.getLeaf(false));
  }

  async createJottingInNewPane(): Promise<void> {
    await this.createJottingInLeaf(
      this.app.workspace.getLeaf("split", "vertical"),
    );
  }

  async createFromTemplate(): Promise<void> {
    const targetLeaf = this.app.workspace.getLeaf(false);
    const templates = this.app.vault
      .getMarkdownFiles()
      .filter((file) => CREATABLE_TEMPLATE_PATHS.has(file.path))
      .sort(
        (left, right) =>
          templateOrder(left.path) - templateOrder(right.path),
      );
    if (templates.length === 0) {
      throw new Error("作成可能な文書テンプレートが見つからない。");
    }

    for (const root of documentDestinationRoots("note")) {
      await ensureFolder(this.app.vault, root);
    }
    const destinations = this.app.vault
      .getAllLoadedFiles()
      .filter(
        (file): file is TFolder =>
          file instanceof TFolder &&
          documentDestinationRoots("note").some(
            (root) => file.path === root || file.path.startsWith(`${root}/`),
          ),
      )
      .sort((left, right) => left.path.localeCompare(right.path));
    const selection = await promptDocumentCreation(
      this.app,
      templates,
      destinations,
    );
    if (!selection) return;

    const now = checkpointNow();
    const kind = documentTemplateKind(selection.template.path);
    const spec = templateNoteSpec(
      now,
      kind,
      selection.destination.path,
      selection.title,
    );
    const existing = this.app.vault
      .getMarkdownFiles()
      .find((file) => file.path.toLowerCase() === spec.path.toLowerCase());
    if (existing) {
      await this.openFile(existing, targetLeaf);
      new Notice("同名の文書があるため、新規作成せず既存文書を開いた。");
      return;
    }

    const content = renderDocumentTemplate(
      await this.app.vault.read(selection.template),
      spec.title,
      now,
    );
    const file = await this.app.vault.create(spec.path, content);
    await this.openFile(file, targetLeaf);
    new Notice(`作成して開いた: ${file.path}`);
  }

  private async createJottingInLeaf(leaf: WorkspaceLeaf): Promise<void> {
    const now = checkpointNow();
    await ensureFolder(this.app.vault, JOTTINGS_FOLDER);
    const path = nextJottingPath(
      now,
      (candidate) => this.app.vault.getAbstractFileByPath(candidate) !== null,
    );
    const template = await this.app.vault.read(
      getFile(this.app.vault, JOTTING_TEMPLATE_PATH),
    );
    const file = await this.app.vault.create(
      path,
      renderJottingTemplate(template, now),
    );
    await this.openFile(file, leaf);
  }

  private async openFile(file: TFile, leaf: WorkspaceLeaf): Promise<void> {
    await leaf.openFile(file, { active: true });
    await this.app.workspace.revealLeaf(leaf);
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
  }
}

interface DocumentCreationSelection {
  template: TFile;
  destination: TFolder;
  title: string;
}

function promptDocumentCreation(
  app: App,
  templates: TFile[],
  destinations: TFolder[],
): Promise<DocumentCreationSelection | null> {
  return new Promise((resolve) => {
    new DocumentCreationModal(
      app,
      templates,
      destinations,
      resolve,
    ).open();
  });
}

function templateOrder(path: string): number {
  const order: Record<string, number> = {
    "99-system/templates/note.md": 0,
    "99-system/templates/record.md": 1,
    "99-system/templates/living-document.md": 2,
  };
  return order[path] ?? Number.MAX_SAFE_INTEGER;
}

function templateLabel(template: TFile): string {
  const labels: Record<string, string> = {
    note: "Note — 着想・観察・自由な書き出し",
    record: "Record — 起きたことの記録",
    "living-document": "Living document — 現在状態の正本",
  };
  return labels[template.basename] ?? template.basename;
}

function destinationLabel(folder: TFolder): string {
  const labels: Record<string, string> = {
    "00-inbox": "Inbox — 置き場所・役割を後で判断",
    "20-work": "Work — 現在の業務",
    "30-playground": "Playground — 目的のある実験",
  };
  return labels[folder.path] ?? folder.path;
}

class DocumentCreationModal extends Modal {
  private inputEl: HTMLInputElement | null = null;
  private nameSetting: Setting | null = null;
  private destinationSelectEl: HTMLSelectElement | null = null;
  private templatePath: string;
  private destinationPath: string | null = null;
  private selection: DocumentCreationSelection | null = null;
  private resolutionSent = false;

  constructor(
    app: App,
    private readonly templates: TFile[],
    private readonly destinations: TFolder[],
    private readonly resolveSelection: (
      selection: DocumentCreationSelection | null,
    ) => void,
  ) {
    super(app);
    this.templatePath =
      templates.find((template) => template.basename === "note")?.path ??
      templates[0]?.path ??
      "";
    this.shouldRestoreSelection = false;
  }

  onOpen(): void {
    this.titleEl.textContent = "Create from Template";

    new Setting(this.contentEl)
      .setName("テンプレート")
      .setDesc("文書の役割を一つ選ぶ。")
      .addDropdown((dropdown) => {
        for (const template of this.templates) {
          dropdown.addOption(template.path, templateLabel(template));
        }
        dropdown.setValue(this.templatePath).onChange((path) => {
          this.templatePath = path;
          this.refreshDestinations();
        });
      });

    new Setting(this.contentEl)
      .setName("保存先")
      .setDesc("Living documentはWork配下だけに作成できる。")
      .addDropdown((dropdown) => {
        this.destinationSelectEl = dropdown.selectEl;
        dropdown.onChange((path) => {
          this.destinationPath = path;
        });
      });

    this.nameSetting = new Setting(this.contentEl)
      .setName("文書名")
      .setDesc("拡張子と保存先は入力しない。")
      .addText((text) => {
        text.setPlaceholder("例: 顧客ヒアリング");
        this.inputEl = text.inputEl;
        text.inputEl.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          this.submit();
        });
      });

    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText("作成")
        .setCta()
        .onClick(() => this.submit()),
    );

    this.refreshDestinations();
    window.setTimeout(() => this.inputEl?.focus(), 0);
  }

  onClose(): void {
    super.onClose();
    this.contentEl.replaceChildren();
    if (this.resolutionSent) return;
    this.resolutionSent = true;
    this.resolveSelection(this.selection);
  }

  private submit(): void {
    const name = normalizeDocumentName(this.inputEl?.value ?? "");
    const error = documentNameError(name);
    this.nameSetting?.setErrorMessage(error);
    if (error) return;

    const template = this.templates.find(
      (candidate) => candidate.path === this.templatePath,
    );
    const destination = this.destinations.find(
      (candidate) => candidate.path === this.destinationPath,
    );
    if (!template || !destination) {
      this.nameSetting?.setErrorMessage("テンプレートと保存先を選ぶ。");
      return;
    }
    const kind = documentTemplateKind(template.path);
    if (!isAllowedDocumentDestination(kind, destination.path)) {
      this.nameSetting?.setErrorMessage("選択した保存先には作成できない。");
      return;
    }

    this.selection = { template, destination, title: name };
    this.close();
  }

  private refreshDestinations(): void {
    if (!this.destinationSelectEl) return;
    const kind = documentTemplateKind(this.templatePath);
    const allowed = this.destinations.filter((folder) =>
      isAllowedDocumentDestination(kind, folder.path),
    );
    this.destinationSelectEl.replaceChildren();
    for (const folder of allowed) {
      const option = this.contentEl.ownerDocument.createElement("option");
      option.value = folder.path;
      option.textContent = destinationLabel(folder);
      this.destinationSelectEl.appendChild(option);
    }
    this.destinationPath = allowed[0]?.path ?? null;
    this.destinationSelectEl.value = this.destinationPath ?? "";
  }
}
