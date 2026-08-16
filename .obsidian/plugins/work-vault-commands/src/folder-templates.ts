import { TFile, moment as obsidianMoment, type App } from "obsidian";

interface Moment {
    format: (pattern: string) => string;
}

const createMoment = obsidianMoment as unknown as () => Moment;

/**
 * フォルダプレフィックス → テンプレートパスのマッピング。
 * 上から順に評価し、最初にマッチしたものを使う（より具体的なパスを先に書く）。
 */
const FOLDER_TEMPLATE_MAP: Array<[prefix: string, templatePath: string]> = [
    ["40-jottings", "99-system/templates/jotting.md"],
    ["00-inbox", "99-system/templates/note.md"],
    ["30-playground", "99-system/templates/note.md"],
];

function findTemplatePath(filePath: string): string | null {
    for (const [prefix, templatePath] of FOLDER_TEMPLATE_MAP) {
        if (filePath.startsWith(prefix + "/")) {
            return templatePath;
        }
    }
    return null;
}

/** YYYYMMDD_ や YYYYMMDD プレフィックスを除いてタイトルを推定する */
function inferTitle(file: TFile): string {
    return file.basename.replace(/^\d{8}[_\s]?/, "");
}

/** {{date:FORMAT}} と {{title}} を展開する */
function renderTemplate(template: string, title: string): string {
    const now = createMoment();
    return template
        .replaceAll("{{title}}", title)
        .replace(/\{\{date:([^}]+)\}\}/g, (_, fmt: string) => now.format(fmt));
}

export class FolderTemplates {
    constructor(private readonly app: App) { }

    async onFileCreated(file: TFile): Promise<void> {
        if (file.extension !== "md") return;

        const templatePath = findTemplatePath(file.path);
        if (!templatePath) return;

        // Obsidian が空ファイルへの書き込みを終えるのを待つ
        await new Promise<void>((resolve) => setTimeout(resolve, 150));

        const current = this.app.vault.getAbstractFileByPath(file.path);
        if (!(current instanceof TFile)) return;

        const existingContent = await this.app.vault.read(current);
        if (existingContent.trim() !== "") return; // すでに内容がある場合は適用しない

        const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
        if (!(templateFile instanceof TFile)) {
            console.warn(`Work Vault: template not found: ${templatePath}`);
            return;
        }

        const template = await this.app.vault.read(templateFile);
        const rendered = renderTemplate(template, inferTitle(file));
        await this.app.vault.modify(current, rendered);
    }
}
