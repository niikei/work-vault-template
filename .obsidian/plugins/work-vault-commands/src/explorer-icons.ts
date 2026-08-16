import { type App, setIcon, TFile, TFolder } from "obsidian";

const ICON_CLASS = "work-vault-explorer-icon";
const TITLE_SELECTOR =
  ".nav-folder-title[data-path], .nav-file-title[data-path]";

const folderIcons: Readonly<Record<string, string>> = {
  "00-inbox": "inbox",
  "10-checkpoints": "calendar-check",
  "20-work": "briefcase",
  "30-playground": "flask-conical",
  "40-jottings": "pencil",
  "90-archive": "archive",
  "99-system": "settings",
  "local-only": "hard-drive",
};

const markdownTypeIcons: Readonly<Record<string, string>> = {
  checkpoint: "calendar-check",
  "living-document": "book-open",
  note: "sticky-note",
  record: "scroll-text",
};

const extensionIcons: Readonly<Record<string, string>> = {
  base: "table-2",
  canvas: "layout-dashboard",
  gif: "image",
  jpeg: "image",
  jpg: "image",
  md: "file-text",
  mp3: "file-audio",
  mp4: "file-video",
  pdf: "file-text",
  png: "image",
  svg: "image",
  webm: "file-video",
  webp: "image",
};

export class ExplorerIcons {
  private frame: number | null = null;
  private observer: MutationObserver | null = null;

  constructor(private readonly app: App) {}

  start(): void {
    if (this.observer !== null) {
      return;
    }
    this.observer = new MutationObserver(() => this.refresh());
    this.observer.observe(document.body, {
      attributeFilter: ["data-path"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    this.refresh();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.frame !== null) {
      window.cancelAnimationFrame(this.frame);
      this.frame = null;
    }
    document
      .querySelectorAll<HTMLElement>(`.${ICON_CLASS}`)
      .forEach((icon) => icon.remove());
  }

  refresh(): void {
    if (this.observer === null || this.frame !== null) {
      return;
    }
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      this.decorateVisibleItems();
    });
  }

  private decorateVisibleItems(): void {
    document
      .querySelectorAll<HTMLElement>(TITLE_SELECTOR)
      .forEach((title) => this.decorateTitle(title));
  }

  private decorateTitle(title: HTMLElement): void {
    const path = title.dataset.path;
    if (path === undefined) {
      return;
    }

    const iconName = this.getIcon(path);
    let icon = title.querySelector<HTMLElement>(`:scope > .${ICON_CLASS}`);
    if (icon === null) {
      const content = title.querySelector<HTMLElement>(
        ":scope > .nav-folder-title-content, :scope > .nav-file-title-content",
      );
      if (content === null) {
        return;
      }
      icon = document.createElement("span");
      icon.classList.add(ICON_CLASS);
      title.insertBefore(icon, content);
    }
    if (icon.dataset.icon === iconName) {
      return;
    }
    setIcon(icon, iconName);
    icon.dataset.icon = iconName;
  }

  private getIcon(path: string): string {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFolder) {
      return folderIcons[path] ?? "folder";
    }
    if (!(file instanceof TFile)) {
      return "file";
    }
    if (file.path === "Home.md") {
      return "home";
    }
    if (file.path === "AGENTS.md") {
      return "bot";
    }
    if (file.extension === "md") {
      const type = this.app.metadataCache.getFileCache(file)?.frontmatter?.type;
      if (typeof type === "string") {
        return markdownTypeIcons[type] ?? "file-text";
      }
    }
    return extensionIcons[file.extension.toLowerCase()] ?? "file";
  }
}
