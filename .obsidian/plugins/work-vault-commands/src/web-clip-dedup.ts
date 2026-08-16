import { App, Notice, TFile } from "obsidian";
import { findDuplicate, getMergeDestPath } from "./web-clip-dedup-logic";

export class WebClipDedup {
	// vault.on("create") で登録し metadataCache.on("changed") で処理するファイルを追跡
	private readonly pending = new Set<string>();

	constructor(private readonly app: App) {}

	onFileCreated(file: TFile): void {
		if (getMergeDestPath(file.path)) this.pending.add(file.path);
	}

	async onMetadataChanged(file: TFile): Promise<void> {
		if (!this.pending.delete(file.path)) return;

		const canonical =
			this.app.metadataCache.getFileCache(file)?.frontmatter
				?.source_canonical;
		if (!canonical) return;

		const allFiles = this.app.vault.getMarkdownFiles().map((f) => ({
			path: f.path,
			canonical: this.app.metadataCache.getFileCache(f)?.frontmatter
				?.source_canonical as string | undefined,
		}));

		const duplicate = findDuplicate(canonical, file.path, allFiles);
		if (!duplicate) return;

		const destPath = getMergeDestPath(file.path)!;
		await this.app.fileManager.renameFile(file, destPath);
		new Notice(
			`重複URL検出: merge-queue へ移動\n既存: ${duplicate.path.split("/").pop()?.replace(".md", "")}`,
		);
	}
}
