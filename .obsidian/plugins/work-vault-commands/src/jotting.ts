export const JOTTINGS_FOLDER = "40-jottings";
export const JOTTING_TEMPLATE_PATH = "99-system/templates/jotting.md";

export interface JottingMoment {
  format: (pattern: string) => string;
}

export function nextJottingPath(
  now: JottingMoment,
  pathExists: (path: string) => boolean,
): string {
  const stem = now.format("YYYYMMDD_HHmmssSSS");
  for (let sequence = 1; sequence <= 999; sequence += 1) {
    const suffix = sequence === 1 ? "" : `_${sequence}`;
    const path = `${JOTTINGS_FOLDER}/${stem}${suffix}.md`;
    if (!pathExists(path)) return path;
  }
  throw new Error("Jottingの一意なファイル名を作成できなかった。");
}

export function renderJottingTemplate(
  template: string,
  now: JottingMoment,
): string {
  const title = now.format("YYYY-MM-DD HH:mm:ss");
  return template
    .replaceAll("{{title}}", title)
    .replace(/\{\{date:([^}]+)\}\}/g, (_, format: string) =>
      now.format(format),
    );
}
