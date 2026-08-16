export const WATCH_PREFIXES: Record<string, string> = {
    "00-inbox/web-clips/new/general/":
        "00-inbox/web-clips/merge-queue/general/",
    "00-inbox/web-clips/new/sharepoint-files/":
        "00-inbox/web-clips/merge-queue/sharepoint-files/",
};

export interface FileEntry {
    path: string;
    canonical: string | undefined;
}

export function findDuplicate(
    canonical: string,
    currentPath: string,
    files: FileEntry[],
): FileEntry | undefined {
    return files.find(
        (f) => f.path !== currentPath && f.canonical === canonical,
    );
}

export function getMergeDestPath(filePath: string): string | undefined {
    for (const [src, dest] of Object.entries(WATCH_PREFIXES)) {
        if (filePath.startsWith(src)) {
            return dest + filePath.slice(src.length);
        }
    }
    return undefined;
}
