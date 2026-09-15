import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

// A parsed upload waits here between preview and confirm. Tool imports stage ExportRow[], worker uploads string[].
export const STAGING_DIR = path.join(process.cwd(), "data", "imports");

export function stageFile(data: { fileName: string; rows: unknown[] }): string {
  fs.mkdirSync(STAGING_DIR, { recursive: true });
  const token = randomBytes(16).toString("hex");
  fs.writeFileSync(path.join(STAGING_DIR, `${token}.json`), JSON.stringify(data));
  return token;
}

export function stagedFile<T>(token: string): { fileName: string; rows: T[] } | null {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(STAGING_DIR, `${token}.json`), "utf8"));
  } catch {
    return null;
  }
}

export function dropStaged(token: string) {
  fs.rmSync(path.join(STAGING_DIR, `${token}.json`), { force: true });
}
