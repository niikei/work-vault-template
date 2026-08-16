import { TFile, type Vault } from "obsidian";

export async function ensureFolder(vault: Vault, path: string): Promise<void> {
  let current = "";
  for (const part of path.split("/")) {
    current = current ? `${current}/${part}` : part;
    const existing = vault.getAbstractFileByPath(current);
    if (!existing) {
      await vault.createFolder(current);
    } else if (existing instanceof TFile) {
      throw new Error(`Folder path is a file: ${current}`);
    }
  }
}

export function getFile(vault: Vault, path: string): TFile {
  const file = vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    throw new Error(`File not found: ${path}`);
  }
  return file;
}
