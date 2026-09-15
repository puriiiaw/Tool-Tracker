import type { Database } from "better-sqlite3";
import * as XLSX from "xlsx";
import { categoryFor } from "./category.ts";

export type ExportRow = {
  name: string | null;
  scan_code: string;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
};

type ToolRec = {
  id: number;
  name: string;
  scan_code: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  status: string;
  created_by: number | null;
};

type Fields = { name: string; serial_number: string | null; manufacturer: string | null; model: string | null };

export type Plan = {
  newTools: (Fields & { scan_code: string; flag: string | null })[];
  updated: { id: number; name: string; scan_code: string; changes: Record<string, [unknown, unknown]>; after: Fields; flag: string | null }[];
  unchanged: number;
  missing: { id: number; name: string; scan_code: string; onSite: boolean }[]; // onSite: added from the app, never in ON!Track
  counts: { new: number; updated: number; unchanged: number; missing: number };
};

const clean = (v: unknown) => (v == null ? null : String(v).trim() || null);

// Reads the ON!Track Assets_Details.xlsx as-is: row 1 is a count, row 2 the header.
export function parseExport(buf: Buffer | ArrayBuffer): ExportRow[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
  const hi = rows.findIndex((r) => r.includes("Scan Code"));
  if (hi < 0) throw new Error("This file has no 'Scan Code' column. Is it the ON!Track asset export?");
  const h = rows[hi] as string[];
  const col = (n: string) => h.indexOf(n);
  return rows
    .slice(hi + 1)
    .filter((r) => clean(r[col("Scan Code")]))
    .map((r) => ({
      name: clean(r[col("Name")]),
      scan_code: String(r[col("Scan Code")]).trim(),
      serial_number: clean(r[col("Serial Number")]),
      manufacturer: clean(r[col("Manufacturer")]),
      model: clean(r[col("Model")]),
    }));
}

// Keyed on scan code: new codes are added, known ones updated if a field changed, codes not in the file flagged.
export function planImport(db: Database, rows: ExportRow[]): Plan {
  const tools = db.prepare("SELECT id, name, scan_code, serial_number, manufacturer, model, status, created_by FROM tool").all() as ToolRec[];
  const byScan = new Map(tools.map((t) => [t.scan_code, t]));
  const plan: Plan = { newTools: [], updated: [], unchanged: 0, missing: [], counts: { new: 0, updated: 0, unchanged: 0, missing: 0 } };
  const seen = new Set<string>();

  for (const r of rows) {
    if (seen.has(r.scan_code)) continue;
    seen.add(r.scan_code);
    const flag = r.name ? null : "blank name in export";
    const after: Fields = { name: r.name ?? r.model ?? r.scan_code, serial_number: r.serial_number, manufacturer: r.manufacturer, model: r.model };
    const existing = byScan.get(r.scan_code);
    if (!existing) {
      plan.newTools.push({ scan_code: r.scan_code, ...after, flag });
      continue;
    }
    const changes: Record<string, [unknown, unknown]> = {};
    for (const k of Object.keys(after) as (keyof Fields)[]) {
      if ((existing[k] ?? null) !== (after[k] ?? null)) changes[k] = [existing[k], after[k]];
    }
    if (Object.keys(changes).length) plan.updated.push({ id: existing.id, name: existing.name, scan_code: r.scan_code, changes, after, flag });
    else plan.unchanged++;
  }

  for (const t of tools) {
    if (t.scan_code && t.status !== "retired" && !seen.has(t.scan_code))
      plan.missing.push({ id: t.id, name: t.name, scan_code: t.scan_code, onSite: t.created_by != null });
  }
  plan.counts = { new: plan.newTools.length, updated: plan.updated.length, unchanged: plan.unchanged, missing: plan.missing.length };
  return plan;
}

// Never closes a checkout, never retires a tool. Missing tags are flagged only.
export function applyImport(db: Database, plan: Plan, actorId: number, fileName: string) {
  const audit = db.prepare(
    "INSERT INTO audit_log (actor_id, entity, entity_id, action, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const getTool = db.prepare("SELECT * FROM tool WHERE id = ?");
  db.transaction(() => {
    const insTool = db.prepare(
      `INSERT INTO tool (name, scan_code, serial_number, manufacturer, model, import_flag, category)
       VALUES (@name, @scan_code, @serial_number, @manufacturer, @model, @flag, @category)`
    );
    for (const t of plan.newTools) {
      const id = Number(insTool.run({ ...t, category: categoryFor(t.name) }).lastInsertRowid);
      audit.run(actorId, "tool", id, "import_create", null, JSON.stringify(getTool.get(id)));
    }
    const upd = db.prepare(
      "UPDATE tool SET name=@name, serial_number=@serial_number, manufacturer=@manufacturer, model=@model, import_flag=@flag WHERE id=@id"
    );
    for (const t of plan.updated) {
      const before = getTool.get(t.id);
      upd.run({ ...t.after, flag: t.flag, id: t.id });
      audit.run(actorId, "tool", t.id, "import_update", JSON.stringify(before), JSON.stringify(getTool.get(t.id)));
    }
    for (const m of plan.missing) {
      const before = getTool.get(m.id);
      db.prepare("UPDATE tool SET import_flag = ? WHERE id = ?").run(m.onSite ? "added on site, not in ON!Track" : "not in latest export", m.id);
      audit.run(actorId, "tool", m.id, "import_flag", JSON.stringify(before), JSON.stringify(getTool.get(m.id)));
    }
    const runId = Number(
      db.prepare("INSERT INTO import_run (run_by, file_name, counts_json) VALUES (?, ?, ?)").run(actorId, fileName, JSON.stringify(plan.counts)).lastInsertRowid
    );
    audit.run(actorId, "import_run", runId, "create", null, JSON.stringify({ fileName, ...plan.counts }));
  })();
}
