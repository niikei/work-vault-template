export type DocumentTemplateKind = "note" | "record" | "living-document";

const DOCUMENT_TEMPLATE_KINDS = new Map<string, DocumentTemplateKind>([
  ["99-system/templates/note.md", "note"],
  ["99-system/templates/record.md", "record"],
  ["99-system/templates/living-document.md", "living-document"],
]);

const INBOX_FOLDER = "00-inbox";
const WORK_FOLDER = "20-work";
const PLAYGROUND_FOLDER = "30-playground";

export const CREATABLE_TEMPLATE_PATHS = new Set(
  DOCUMENT_TEMPLATE_KINDS.keys(),
);

export interface TemplateNoteMoment {
  format: (pattern: string) => string;
}

export interface TemplateNoteSpec {
  path: string;
  title: string;
}

export function documentTemplateKind(path: string): DocumentTemplateKind {
  const kind = DOCUMENT_TEMPLATE_KINDS.get(path);
  if (!kind) throw new Error(`作成対象ではないテンプレートである: ${path}`);
  return kind;
}

export function documentDestinationRoots(
  kind: DocumentTemplateKind,
): string[] {
  if (kind === "living-document") return [WORK_FOLDER];
  return [INBOX_FOLDER, WORK_FOLDER, PLAYGROUND_FOLDER];
}

export function isAllowedDocumentDestination(
  kind: DocumentTemplateKind,
  folderPath: string,
): boolean {
  if (folderPath === INBOX_FOLDER) return kind !== "living-document";
  return [WORK_FOLDER, PLAYGROUND_FOLDER]
    .filter((root) => kind !== "living-document" || root === WORK_FOLDER)
    .some((root) => folderPath === root || folderPath.startsWith(`${root}/`));
}

export function normalizeDocumentName(input: string): string {
  return input.trim().replace(/\.md$/i, "").trim();
}

export function documentNameError(name: string): string | null {
  if (name.length === 0) return "文書名を入力する。";
  if (name === "." || name === "..") return "別の文書名を入力する。";
  if (/[<>:"/\\|?*\u0000-\u001F]/.test(name)) {
    return '文書名に < > : " / \\ | ? * は使えない。';
  }
  if (/[. ]$/.test(name)) return "文書名の末尾にピリオドは使えない。";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) {
    return "Windowsで予約されている文書名は使えない。";
  }
  return null;
}

export function templateNoteSpec(
  now: TemplateNoteMoment,
  kind: DocumentTemplateKind,
  folderPath: string,
  title: string,
): TemplateNoteSpec {
  if (!isAllowedDocumentDestination(kind, folderPath)) {
    throw new Error(`${kind}を作成できない場所である: ${folderPath}`);
  }
  const normalizedTitle = normalizeDocumentName(title);
  const error = documentNameError(normalizedTitle);
  if (error) throw new Error(error);

  const filename =
    kind === "living-document"
      ? `${normalizedTitle}.md`
      : `${now.format("YYYYMMDD")}_${normalizedTitle}.md`;
  return { path: `${folderPath}/${filename}`, title: normalizedTitle };
}

export function renderDocumentTemplate(
  template: string,
  title: string,
  now: TemplateNoteMoment,
): string {
  return template
    .replaceAll("{{title}}", title)
    .replace(/\{\{date:([^}]+)\}\}/g, (_, format: string) =>
      now.format(format),
    );
}
