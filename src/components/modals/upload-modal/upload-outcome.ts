export type UploadStep = "idle" | "inspecting" | "stage1" | "completed" | "error";

export type ClassifiedHistoryFile =
  | { kind: "history"; rows: unknown[] }
  | { kind: "basic-export" }
  | { kind: "unreadable" };

/**
 * Decide what an uploaded JSON file is. The basic account data export
 * (StreamingHistory_music_*.json) has endTime and trackName but no Track URI,
 * so none of its rows can become a Play.
 */
export function classifyHistoryFile(jsonText: string): ClassifiedHistoryFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { kind: "unreadable" };
  }
  if (!Array.isArray(parsed)) return { kind: "unreadable" };

  const sample = parsed.find((row) => row && typeof row === "object") as Record<string, unknown> | undefined;
  if (sample && "endTime" in sample && "trackName" in sample && !("spotify_track_uri" in sample) && !("ts" in sample)) {
    return { kind: "basic-export" };
  }
  return { kind: "history", rows: parsed };
}

export interface ImportTotals {
  qualifiedPlays: number;
  /** Files that contributed nothing: unreadable ones plus basic export files. */
  skippedFiles: number;
  basicExportFiles: number;
}

export type ImportOutcome = { ok: true; skippedNote: string | null } | { ok: false; error: string };

/** An import that produced no Plays is a failure, whatever the reason. */
export function resolveImportOutcome({ qualifiedPlays, skippedFiles, basicExportFiles }: ImportTotals): ImportOutcome {
  if (qualifiedPlays > 0) {
    if (skippedFiles === 0) return { ok: true, skippedNote: null };
    return {
      ok: true,
      skippedNote:
        skippedFiles === 1
          ? "1 file was skipped because it is not Extended streaming history."
          : `${skippedFiles} files were skipped because they are not Extended streaming history.`,
    };
  }
  if (basicExportFiles > 0) {
    return {
      ok: false,
      error:
        "No Plays were imported. These files are from the basic account data export, which cannot be imported. Request the Extended streaming history export from Spotify and upload that instead.",
    };
  }
  if (skippedFiles > 0) {
    return {
      ok: false,
      error: `No Plays were imported. ${skippedFiles} ${skippedFiles === 1 ? "file" : "files"} could not be read as streaming history.`,
    };
  }
  return { ok: false, error: "No Plays were imported. The uploaded files contain no qualified Plays." };
}

/** Reopening after a finished import starts a new one; any other step is kept. */
export function stepOnOpen(step: UploadStep): UploadStep {
  return step === "completed" ? "idle" : step;
}
