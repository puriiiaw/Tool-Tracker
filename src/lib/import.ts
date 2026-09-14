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

export type Translation = { source_name: string; english_name: string; item_type: "unique" | "quantity" | null };

type ToolRec = {
  id: number;
  name: string;
  scan_code: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  item_type: "unique" | "quantity";
  status: string;
};
type UnitRec = { id: number; tool_id: number; scan_code: string; serial_number: string | null };

export type NameRule = {
  source: string;
  english: string;
  type: "unique" | "quantity";
  count: number;
  known: boolean;
};

export type Plan = {
  names: NameRule[];
  newUnique: { scan_code: string; name: string; serial_number: string | null; manufacturer: string | null; model: string | null; flag: string | null }[];
  updatedUnique: { id: number; name: string; scan_code: string; changes: Record<string, [unknown, unknown]>; after: Record<string, unknown>; flag: string | null }[];
  unchanged: number;
  quantityGroups: { name: string; model: string | null; manufacturer: string | null; toolId: number | null; newUnits: { scan_code: string; serial_number: string | null }[]; existingUnits: number; flag: string | null }[];
  missing: { kind: "tool" | "unit"; id: number; tool_id: number; name: string; scan_code: string }[];
  conflicts: string[];
  counts: { new: number; updated: number; unchanged: number; missing: number };
};

export const nameKey = (s: string) => s.trim().replace(/\s+/g, " ").replace(/[’‘]/g, "'").toLowerCase();
const isQtyName = (s: string) => /\b(battery|batterie|charger|chargeur)\b/i.test(s);
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

export function planImport(db: Database, rows: ExportRow[]): Plan {
  const tools = db.prepare("SELECT id, name, scan_code, serial_number, manufacturer, model, item_type, status FROM tool").all() as ToolRec[];
  const units = db.prepare("SELECT id, tool_id, scan_code, serial_number FROM tool_unit").all() as UnitRec[];
  const translations = db.prepare("SELECT source_name, english_name, item_type FROM translation").all() as Translation[];
  const tr = new Map(translations.map((t) => [nameKey(t.source_name), t]));
  const uniqueByScan = new Map(tools.filter((t) => t.item_type === "unique").map((t) => [t.scan_code, t]));
  const qtyByName = new Map(tools.filter((t) => t.item_type === "quantity").map((t) => [nameKey(t.name), t]));
  const unitByScan = new Map(units.map((u) => [u.scan_code, u]));

  const plan: Plan = { names: [], newUnique: [], updatedUnique: [], unchanged: 0, quantityGroups: [], missing: [], conflicts: [], counts: { new: 0, updated: 0, unchanged: 0, missing: 0 } };
  const names = new Map<string, NameRule>();
  const groups = new Map<string, Plan["quantityGroups"][number]>();
  const seen = new Set<string>();

  for (const r of rows) {
    seen.add(r.scan_code);
    const blank = !r.name;
    const source = r.name ?? r.model ?? r.scan_code;
    const rule = tr.get(nameKey(source));
    const english = rule?.english_name ?? source;
    const type = rule?.item_type ?? (isQtyName(source) || isQtyName(english) ? "quantity" : "unique");
    const n = names.get(nameKey(source)) ?? { source, english, type, count: 0, known: !!rule };
    n.count++;
    names.set(nameKey(source), n);
    const flags = [blank ? "blank name in export" : null, rule ? null : "name not translated"].filter(Boolean);
    const flag = flags.length ? flags.join("; ") : null;

    if (type === "quantity") {
      if (uniqueByScan.has(r.scan_code)) {
        plan.conflicts.push(`${r.scan_code} (${english}) is a unique tool in the app but a quantity item in this import. Change one side manually.`);
        continue;
      }
      const g = groups.get(nameKey(english)) ?? {
        name: english, model: r.model, manufacturer: r.manufacturer,
        toolId: qtyByName.get(nameKey(english))?.id ?? null, newUnits: [], existingUnits: 0, flag: null,
      };
      if (flag) g.flag = flag;
      if (unitByScan.has(r.scan_code)) g.existingUnits++;
      else g.newUnits.push({ scan_code: r.scan_code, serial_number: r.serial_number });
      groups.set(nameKey(english), g);
      continue;
    }

    if (unitByScan.has(r.scan_code)) {
      plan.conflicts.push(`${r.scan_code} (${english}) is a quantity unit in the app but a unique tool in this import. Change one side manually.`);
      continue;
    }
    const existing = uniqueByScan.get(r.scan_code);
    const after = { name: english, serial_number: r.serial_number, manufacturer: r.manufacturer, model: r.model };
    if (!existing) {
      plan.newUnique.push({ scan_code: r.scan_code, ...after, flag });
      continue;
    }
    const changes: Record<string, [unknown, unknown]> = {};
    for (const k of Object.keys(after) as (keyof typeof after)[]) {
      if ((existing[k] ?? null) !== (after[k] ?? null)) changes[k] = [existing[k], after[k]];
    }
    if (Object.keys(changes).length) plan.updatedUnique.push({ id: existing.id, name: existing.name, scan_code: r.scan_code, changes, after, flag });
    else plan.unchanged++;
  }

  for (const t of tools) {
    if (t.item_type === "unique" && t.scan_code && t.status !== "retired" && !seen.has(t.scan_code))
      plan.missing.push({ kind: "tool", id: t.id, tool_id: t.id, name: t.name, scan_code: t.scan_code });
  }
  const toolName = new Map(tools.map((t) => [t.id, t.name]));
  for (const u of units) {
    if (!seen.has(u.scan_code)) plan.missing.push({ kind: "unit", id: u.id, tool_id: u.tool_id, name: toolName.get(u.tool_id) ?? "", scan_code: u.scan_code });
  }

  plan.names = [...names.values()].sort((a, b) => Number(a.known) - Number(b.known) || b.count - a.count);
  plan.quantityGroups = [...groups.values()];
  plan.unchanged += plan.quantityGroups.reduce((s, g) => s + g.existingUnits, 0);
  plan.counts = {
    new: plan.newUnique.length + plan.quantityGroups.reduce((s, g) => s + g.newUnits.length, 0),
    updated: plan.updatedUnique.length,
    unchanged: plan.unchanged,
    missing: plan.missing.length,
  };
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
      `INSERT INTO tool (name, scan_code, serial_number, manufacturer, model, item_type, total_qty, import_flag, category)
       VALUES (@name, @scan_code, @serial_number, @manufacturer, @model, @item_type, @total_qty, @flag, @category)`
    );
    for (const t of plan.newUnique) {
      const id = Number(insTool.run({ ...t, item_type: "unique", total_qty: 1, category: categoryFor(t.name) }).lastInsertRowid);
      audit.run(actorId, "tool", id, "import_create", null, JSON.stringify(getTool.get(id)));
    }
    const upd = db.prepare(
      "UPDATE tool SET name=@name, serial_number=@serial_number, manufacturer=@manufacturer, model=@model, import_flag=@flag WHERE id=@id"
    );
    for (const t of plan.updatedUnique) {
      const before = getTool.get(t.id);
      upd.run({ ...t.after, flag: t.flag, id: t.id });
      audit.run(actorId, "tool", t.id, "import_update", JSON.stringify(before), JSON.stringify(getTool.get(t.id)));
    }
    const insUnit = db.prepare("INSERT INTO tool_unit (tool_id, scan_code, serial_number) VALUES (?, ?, ?)");
    for (const g of plan.quantityGroups) {
      let id = g.toolId;
      if (!id) {
        id = Number(insTool.run({ name: g.name, scan_code: null, serial_number: null, manufacturer: g.manufacturer, model: g.model, item_type: "quantity", total_qty: 0, flag: g.flag, category: categoryFor(g.name) }).lastInsertRowid);
      }
      if (!g.newUnits.length && !g.flag) continue;
      const before = getTool.get(id);
      for (const u of g.newUnits) insUnit.run(id, u.scan_code, u.serial_number);
      db.prepare("UPDATE tool SET total_qty = total_qty + ?, import_flag = ? WHERE id = ?").run(g.newUnits.length, g.flag, id);
      audit.run(actorId, "tool", id, g.toolId ? "import_update" : "import_create", before ? JSON.stringify(before) : null, JSON.stringify(getTool.get(id)));
    }
    const missingUnitsByTool = new Map<number, number>();
    for (const m of plan.missing) {
      if (m.kind === "tool") {
        const before = getTool.get(m.id);
        db.prepare("UPDATE tool SET import_flag = 'not in latest export' WHERE id = ?").run(m.id);
        audit.run(actorId, "tool", m.id, "import_flag", JSON.stringify(before), JSON.stringify(getTool.get(m.id)));
      } else {
        db.prepare("UPDATE tool_unit SET import_flag = 'not in latest export' WHERE id = ?").run(m.id);
        missingUnitsByTool.set(m.tool_id, (missingUnitsByTool.get(m.tool_id) ?? 0) + 1);
      }
    }
    for (const [toolId, n] of missingUnitsByTool) {
      const before = getTool.get(toolId);
      db.prepare("UPDATE tool SET import_flag = ? WHERE id = ?").run(`${n} unit${n === 1 ? "" : "s"} not in latest export`, toolId);
      audit.run(actorId, "tool", toolId, "import_flag", JSON.stringify(before), JSON.stringify(getTool.get(toolId)));
    }
    const runId = Number(
      db.prepare("INSERT INTO import_run (run_by, file_name, counts_json) VALUES (?, ?, ?)").run(actorId, fileName, JSON.stringify(plan.counts)).lastInsertRowid
    );
    audit.run(actorId, "import_run", runId, "create", null, JSON.stringify({ fileName, ...plan.counts }));
  })();
}
