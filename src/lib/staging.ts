import fs from "node:fs";
import path from "node:path";
import type { ExportRow } from "./import";

// A parsed upload waits here between preview and confirm.
export const STAGING_DIR = path.join(process.cwd(), "data", "imports");

export function stagedFile(token: string): { fileName: string; rows: ExportRow[] } | null {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(STAGING_DIR, `${token}.json`), "utf8"));
  } catch {
    return null;
  }
}
