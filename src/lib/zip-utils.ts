import JSZip from "jszip";

export interface ZipAudioHistoryEntry {
  filename: string;
  relativePath: string;
  readText: () => Promise<string>;
}

/**
 * Checks if a zip entry path matches an audio streaming history file.
 * Matches filenames starting with Streaming_History_Audio or endsong_ (case-insensitive)
 * and ignores macOS __MACOSX metadata artifacts.
 */
export function isAudioHistoryFilename(fullPath: string): boolean {
  if (
    fullPath.includes("__MACOSX/") ||
    fullPath.includes("__MACOSX\\") ||
    fullPath.includes("/.") ||
    fullPath.includes("\\.") ||
    fullPath.startsWith(".")
  ) {
    return false;
  }
  const basename = fullPath.split(/[/\\]/).pop() || "";
  if (/video/i.test(basename)) {
    return false;
  }
  return /^(Streaming_?History.*|endsong.*)\.json$/i.test(basename);
}

/**
 * Inspects a ZIP archive and returns an array of matched audio history entries.
 * Decompression is deferred until `readText()` is called on each individual entry,
 * ensuring minimal memory overhead.
 */
export async function extractAudioHistoryEntries(
  zipInput: ArrayBuffer | Uint8Array | Buffer
): Promise<ZipAudioHistoryEntry[]> {
  const zip = await JSZip.loadAsync(zipInput);
  const matchedEntries: ZipAudioHistoryEntry[] = [];

  zip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir && isAudioHistoryFilename(relativePath)) {
      const filename = relativePath.split("/").pop() || relativePath;
      matchedEntries.push({
        filename,
        relativePath,
        readText: () => zipEntry.async("string"),
      });
    }
  });

  // Sort by filename naturally (e.g. 0, 1, 2)
  matchedEntries.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));

  if (matchedEntries.length === 0) {
    throw new Error(
      "No Spotify audio history files found in the archive. " +
        "Ensure the ZIP contains files starting with 'Streaming_History_Audio' or 'endsong_'."
    );
  }

  return matchedEntries;
}
