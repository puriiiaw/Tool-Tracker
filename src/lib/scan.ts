import { db } from "@/db";

export type Holder = { worker: string; lineId: number };
export type ScanHit =
  | { kind: "tool"; toolId: number; name: string; status: string; outTo: Holder | null }
  | { kind: "unit"; unitId: number; toolId: number; name: string; status: string; outTo: Holder | null }
  | { kind: "unknown"; code: string };

// ponytail: Hilti tags decode to the 9-digit scan code; if a tag ever carries a URL, the first 9-digit run is used.
export function normalizeCode(raw: string) {
  const s = raw.replace(/\s+/g, "");
  return /\d{9}/.exec(s)?.[0] ?? s;
}

const LIVE_LINE = `cl.removed = 0
  AND cl.qty_out > (SELECT COALESCE(SUM(qty), 0) FROM return_event WHERE checkout_line_id = cl.id AND voided = 0)`;

// Open line holding a unique tool.
export function toolHolder(toolId: number): Holder | null {
  return (
    (db
      .prepare(
        `SELECT w.name AS worker, cl.id AS lineId FROM checkout_line cl
         JOIN checkout c ON c.id = cl.checkout_id JOIN worker w ON w.id = c.worker_id
         WHERE cl.tool_id = ? AND ${LIVE_LINE} LIMIT 1`
      )
      .get(toolId) as Holder | undefined) ?? null
  );
}

// Open line whose scanned units include this one and has not been returned by a live return event.
// Tested in scan.test.ts.
export const UNIT_HOLDER_SQL = `SELECT w.name AS worker, cl.id AS lineId FROM checkout_line_unit clu
  JOIN checkout_line cl ON cl.id = clu.checkout_line_id
  JOIN checkout c ON c.id = cl.checkout_id JOIN worker w ON w.id = c.worker_id
  LEFT JOIN return_event r ON r.id = clu.return_event_id AND r.voided = 0
  WHERE clu.tool_unit_id = ? AND r.id IS NULL AND ${LIVE_LINE} LIMIT 1`;

export function unitHolder(unitId: number): Holder | null {
  return (db.prepare(UNIT_HOLDER_SQL).get(unitId) as Holder | undefined) ?? null;
}

export function lookupCode(raw: string): ScanHit {
  const code = normalizeCode(raw);
  const tool = db.prepare("SELECT id, name, status FROM tool WHERE scan_code = ?").get(code) as
    | { id: number; name: string; status: string }
    | undefined;
  if (tool) return { kind: "tool", toolId: tool.id, name: tool.name, status: tool.status, outTo: toolHolder(tool.id) };
  const unit = db
    .prepare("SELECT u.id, u.tool_id, t.name, t.status FROM tool_unit u JOIN tool t ON t.id = u.tool_id WHERE u.scan_code = ?")
    .get(code) as { id: number; tool_id: number; name: string; status: string } | undefined;
  if (unit) return { kind: "unit", unitId: unit.id, toolId: unit.tool_id, name: unit.name, status: unit.status, outTo: unitHolder(unit.id) };
  return { kind: "unknown", code };
}

export type UnitRow = { id: number; scan_code: string; serial_number: string | null; worker: string | null; lineId: number | null };

// Every tag under a quantity tool with who holds it now. For the tool page and the line detail.
export function unitsForTool(toolId: number): UnitRow[] {
  return db
    .prepare("SELECT id, scan_code, serial_number FROM tool_unit WHERE tool_id = ? ORDER BY scan_code")
    .all(toolId)
    .map((u) => {
      const h = unitHolder((u as UnitRow).id);
      return { ...(u as UnitRow), worker: h?.worker ?? null, lineId: h?.lineId ?? null };
    });
}

// Tags scanned on one checkout line and whether each has come back (voided returns do not count).
export function unitsForLine(lineId: number): { scan_code: string; back: number }[] {
  return db
    .prepare(
      `SELECT u.scan_code, EXISTS(SELECT 1 FROM return_event r WHERE r.id = clu.return_event_id AND r.voided = 0) AS back
       FROM checkout_line_unit clu JOIN tool_unit u ON u.id = clu.tool_unit_id
       WHERE clu.checkout_line_id = ? ORDER BY u.scan_code`
    )
    .all(lineId) as { scan_code: string; back: number }[];
}
