import {
    ItemView,
    TFile,
    WorkspaceLeaf,
    moment as obsidianMoment,
} from "obsidian";

import { ensureCheckpoint } from "./checkpoints";

export const CALENDAR_VIEW_TYPE = "work-vault-calendar";

// obsidian バンドルの moment を使うが、型は必要なメソッドだけ宣言する
interface CalMoment {
    format: (pattern: string) => string;
    clone: () => CalMoment;
    startOf: (unit: string) => CalMoment;
    endOf: (unit: string) => CalMoment;
    add: (n: number, unit: string) => CalMoment;
    subtract: (n: number, unit: string) => CalMoment;
    isSame: (other: CalMoment, unit?: string) => boolean;
    date: () => number;
    day: () => number;
}

const createMoment = obsidianMoment as unknown as (date?: string) => CalMoment;

function dailyPath(m: CalMoment): string {
    return `10-checkpoints/daily/${m.format("YYYY/MM/YYYYMMDD")}.md`;
}

export class CalendarView extends ItemView {
    private current: CalMoment;
    private refreshTimer: number | null = null;
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
        this.current = createMoment().startOf("month");
    }

    getViewType(): string {
        return CALENDAR_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "カレンダー";
    }

    getIcon(): string {
        return "calendar";
    }

    async onOpen(): Promise<void> {
        await this.render();
        this.registerEvent(this.app.vault.on("create", () => this.scheduleRender()));
        this.registerEvent(this.app.vault.on("delete", () => this.scheduleRender()));
        this.registerEvent(this.app.vault.on("rename", () => this.scheduleRender()));
        this.registerEvent(this.app.metadataCache.on("changed", () => this.scheduleRender()));
    }

    async onClose(): Promise<void> {
        if (this.refreshTimer !== null) {
            window.clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    private scheduleRender(): void {
        if (this.refreshTimer !== null) {
            window.clearTimeout(this.refreshTimer);
        }
        this.refreshTimer = window.setTimeout(() => {
            this.refreshTimer = null;
            void this.render();
        }, 200);
    }

    private async render(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass("wvc-container");

        this.renderHeader(container);
        this.renderWeekdays(container);
        this.renderGrid(container);
    }

    private renderHeader(container: HTMLElement): void {
        const header = container.createDiv("wvc-header");

        const prev = header.createEl("button", { text: "‹", cls: "wvc-nav-btn" });
        prev.addEventListener("click", () => {
            this.current = this.current.clone().subtract(1, "month").startOf("month");
            void this.render();
        });

        header.createEl("span", {
            text: this.current.format("YYYY年M月"),
            cls: "wvc-month-label",
        });

        const next = header.createEl("button", { text: "›", cls: "wvc-nav-btn" });
        next.addEventListener("click", () => {
            this.current = this.current.clone().add(1, "month").startOf("month");
            void this.render();
        });

        const today = header.createEl("button", { text: "今日", cls: "wvc-today-btn" });
        today.addEventListener("click", () => {
            this.current = createMoment().startOf("month");
            void this.render();
        });
    }

    private renderWeekdays(container: HTMLElement): void {
        const row = container.createDiv("wvc-weekdays");
        for (const label of ["日", "月", "火", "水", "木", "金", "土"]) {
            row.createEl("span", { text: label, cls: "wvc-weekday" });
        }
    }

    private renderGrid(container: HTMLElement): void {
        const grid = container.createDiv("wvc-grid");
        const today = createMoment();
        const monthEnd = this.current.clone().endOf("month");
        const totalDays = monthEnd.date();

        // Sunday-based weekday: 日=0 … 土=6 → 前月の空白セル数
        const leadingBlanks = this.current.day();
        for (let i = 0; i < leadingBlanks; i++) {
            grid.createDiv("wvc-cell wvc-empty");
        }

        for (let d = 1; d <= totalDays; d++) {
            const dateStr =
                this.current.format("YYYY-MM") + "-" + String(d).padStart(2, "0");
            const m = createMoment(dateStr);
            const hasCheckpoint =
                this.app.vault.getAbstractFileByPath(dailyPath(m)) instanceof TFile;
            const isToday = m.isSame(today, "day");

            const cell = grid.createDiv("wvc-cell" + (isToday ? " wvc-today" : ""));
            cell.createEl("span", { text: String(d), cls: "wvc-day-num" });
            if (hasCheckpoint) {
                cell.createDiv("wvc-dot");
            }

            cell.addEventListener("click", () => {
                void this.openDay(m);
            });
        }
    }

    private async openDay(m: CalMoment): Promise<void> {
        const file = await ensureCheckpoint(this.app.vault, "daily", m);
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file);
        this.app.workspace.setActiveLeaf(leaf, { focus: true });
    }

}
