import type { Database } from "better-sqlite3";
import * as XLSX from "xlsx";

export const cleanName = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ");
export const nameKey = (s: string) => cleanName(s).toLowerCase();
// Loose key for "J Smith" vs "J. Smith" warnings.
export const looseKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

type WorkerRec = { id: number; name: string; active: number; hidden: number };

export type WorkerPlan = {
  add: string[];
  reactivate: WorkerRec[]; // inactive or hidden rows the file brings back
  existing: number;
  similar: { name: string; like: string }[]; // added anyway; the preview warns
};

// One worker per row. Header "Name" if present, else the first column; blanks and repeats skipped.
export function parseWorkerFile(buf: Buffer | ArrayBuffer): string[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
  const hi = rows.findIndex((r) => r.some((c) => nameKey(String(c ?? "")) === "name"));
  const col = hi < 0 ? 0 : rows[hi].findIndex((c) => nameKey(String(c ?? "")) === "name");
  const seen = new Set<string>();
  const names: string[] = [];
  for (const r of rows.slice(hi + 1)) {
    const n = cleanName(r[col]);
    if (!n || seen.has(nameKey(n))) continue;
    seen.add(nameKey(n));
    names.push(n);
  }
  return names;
}

export function planWorkerImport(db: Database, names: string[]): WorkerPlan {
  const all = db.prepare("SELECT id, name, active, hidden FROM worker").all() as WorkerRec[];
  const byKey = new Map(all.map((w) => [nameKey(w.name), w]));
  const plan: WorkerPlan = { add: [], reactivate: [], existing: 0, similar: [] };
  for (const n of names) {
    const hit = byKey.get(nameKey(n));
    if (hit) {
      if (hit.active && !hit.hidden) plan.existing++;
      else plan.reactivate.push(hit);
      continue;
    }
    plan.add.push(n);
    const k = looseKey(n);
    const like = all.find((w) => w.active && !w.hidden && (looseKey(w.name).includes(k) || k.includes(looseKey(w.name))));
    if (like) plan.similar.push({ name: n, like: like.name });
  }
  return plan;
}

// Insert a new roster row, or bring back an inactive/hidden one with the same name. Returns the id.
export function upsertWorker(db: Database, name: string, actorId: number): number {
  const hit = db.prepare("SELECT id, name, active, hidden FROM worker WHERE lower(name) = ?").get(nameKey(name)) as WorkerRec | undefined;
  const audit = db.prepare("INSERT INTO audit_log (actor_id, entity, entity_id, action, before_json, after_json) VALUES (?, 'worker', ?, ?, ?, ?)");
  if (hit) {
    if (hit.active && !hit.hidden) return hit.id;
    db.prepare("UPDATE worker SET active = 1, hidden = 0 WHERE id = ?").run(hit.id);
    audit.run(actorId, hit.id, "reactivate", JSON.stringify(hit), JSON.stringify({ ...hit, active: 1, hidden: 0 }));
    return hit.id;
  }
  const id = Number(db.prepare("INSERT INTO worker (name, created_by) VALUES (?, ?)").run(name, actorId).lastInsertRowid);
  audit.run(actorId, id, "create", null, JSON.stringify({ id, name }));
  return id;
}

export function applyWorkerImport(db: Database, plan: WorkerPlan, actorId: number) {
  db.transaction(() => {
    for (const n of plan.add) upsertWorker(db, n, actorId);
    for (const w of plan.reactivate) upsertWorker(db, w.name, actorId);
  })();
}

// The one-column sheet a foreman fills in. Also served by /workers/template.
export function workerTemplate(): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([["Name"], ["Jane Smith"], ["Marc Tremblay"]]);
  ws["!cols"] = [{ wch: 32 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Workers");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
