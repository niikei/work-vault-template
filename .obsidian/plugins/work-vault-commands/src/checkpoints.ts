import { TFile, moment as obsidianMoment, type Vault } from "obsidian";

import { ensureFolder, getFile } from "./files";

export type CheckpointKind = "daily" | "weekly" | "monthly";

export interface CheckpointMoment {
  format: (pattern: string) => string;
  clone: () => CheckpointMoment;
  startOf: (unit: "isoWeek" | "month") => CheckpointMoment;
}

const createMoment = obsidianMoment as unknown as () => CheckpointMoment;

interface CheckpointSpec {
  path: string;
  template: string;
  render: (template: string) => string;
}

const TEMPLATE_PATHS: Record<CheckpointKind, string> = {
  daily: "99-system/templates/daily-checkpoint.md",
  weekly: "99-system/templates/weekly-checkpoint.md",
  monthly: "99-system/templates/monthly-checkpoint.md",
};

export function checkpointNow(): CheckpointMoment {
  return createMoment();
}

export async function ensureCheckpoint(
  vault: Vault,
  kind: CheckpointKind,
  now: CheckpointMoment,
): Promise<TFile> {
  const spec = getCheckpointSpec(kind, now);
  const existing = vault.getAbstractFileByPath(spec.path);
  if (existing) {
    if (!(existing instanceof TFile)) {
      throw new Error(`Checkpoint path is not a file: ${spec.path}`);
    }
    return existing;
  }

  await ensureFolder(vault, spec.path.substring(0, spec.path.lastIndexOf("/")));
  const template = await vault.read(getFile(vault, spec.template));
  const content = spec.render(template);

  try {
    return await vault.create(spec.path, content);
  } catch (error) {
    const raced = vault.getAbstractFileByPath(spec.path);
    if (raced instanceof TFile) {
      return raced;
    }
    throw error;
  }
}

function getCheckpointSpec(
  kind: CheckpointKind,
  now: CheckpointMoment,
): CheckpointSpec {
  const created = now.format("YYYY-MM-DD");

  if (kind === "daily") {
    const date = now.format("YYYY-MM-DD");
    return {
      path: `10-checkpoints/daily/${now.format("YYYY/MM/YYYYMMDD")}.md`,
      template: TEMPLATE_PATHS.daily,
      render: (template) => template.replaceAll("{{date:YYYY-MM-DD}}", date),
    };
  }

  if (kind === "weekly") {
    const week = now.format("GGGG-[W]WW");
    const weekStart = now.clone().startOf("isoWeek").format("YYYY-MM-DD");
    return {
      path: `10-checkpoints/weekly/${now.format("GGGG")}/${now.format("GGGG[W]WW")}.md`,
      template: TEMPLATE_PATHS.weekly,
      render: (template) =>
        template
          .replace('week: "{{date:GGGG-[W]WW}}"', `week: "${week}"`)
          .replace(
            'week_start: "{{date:YYYY-MM-DD}}"',
            `week_start: ${weekStart}`,
          )
          .replace(
            'created: "{{date:YYYY-MM-DD}}"',
            `created: ${created}`,
          )
          .replaceAll("{{date:GGGG-[W]WW}}", week),
    };
  }

  if (kind === "monthly") {
    const month = now.format("YYYY-MM");
    const monthStart = now.clone().startOf("month").format("YYYY-MM-DD");
    return {
      path: `10-checkpoints/monthly/${now.format("YYYY/YYYYMM")}.md`,
      template: TEMPLATE_PATHS.monthly,
      render: (template) =>
        template
          .replace('month: "{{date:YYYY-MM}}"', `month: "${month}"`)
          .replace(
            'month_start: "{{date:YYYY-MM-01}}"',
            `month_start: ${monthStart}`,
          )
          .replace(
            'created: "{{date:YYYY-MM-DD}}"',
            `created: ${created}`,
          )
          .replaceAll("{{date:YYYY-MM}}", month),
    };
  }

  const unknownKind: never = kind;
  throw new Error(`Unknown checkpoint kind: ${String(unknownKind)}`);
}
