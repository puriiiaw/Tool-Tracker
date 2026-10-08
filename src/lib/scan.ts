import { db } from "@/db";

export type Holder = { worker: string; lineId: number; since: string; others: number };
export type ScanHit =
  | { kind: "tool"; toolId: number; name: string; serial: string | null; code: string; status: string; outTo: Holder | null }
  | { kind: "unknown"; code: string };

// Still out: not removed, and not yet covered by a live return event.
const OPEN = (cl: string) =>
  `${cl}.removed = 0 AND ${cl}.qty_out > (SELECT COALESCE(SUM(qty), 0) FROM return_event WHERE checkout_line_id = ${cl}.id AND voided = 0)`;

// ponytail: Hilti tags decode to the 9-digit scan code; if a tag ever carries a URL, the first 9-digit run is used.
export function normalizeCode(raw: string) {
  const s = raw.replace(/\s+/g, "");
  return /\d{9}/.exec(s)?.[0] ?? s;
}

// Open line holding this tool: not removed, and not yet covered by a live return event.
export function toolHolder(toolId: number): Holder | null {
  const h = db
    .prepare(
      `SELECT w.id AS workerId, w.name AS worker, cl.id AS lineId, c.created_at AS since FROM checkout_line cl
       JOIN checkout c ON c.id = cl.checkout_id JOIN worker w ON w.id = c.worker_id
       WHERE cl.tool_id = ? AND ${OPEN("cl")} LIMIT 1`
    )
    .get(toolId) as (Omit<Holder, "others"> & { workerId: number }) | undefined;
  if (!h) return null;
  const others = db
    .prepare(
      `SELECT COUNT(*) FROM checkout_line cl JOIN checkout c ON c.id = cl.checkout_id
       WHERE c.worker_id = ? AND cl.id != ? AND ${OPEN("cl")}`
    )
    .pluck()
    .get(h.workerId, h.lineId) as number;
  return { worker: h.worker, lineId: h.lineId, since: h.since, others };
}

export function lookupCode(raw: string): ScanHit {
  const code = normalizeCode(raw);
  const tool = db.prepare("SELECT id, name, serial_number AS serial, status FROM tool WHERE scan_code = ?").get(code) as
    | { id: number; name: string; serial: string | null; status: string }
    | undefined;
  if (tool) return { kind: "tool", toolId: tool.id, name: tool.name, serial: tool.serial, code, status: tool.status, outTo: toolHolder(tool.id) };
  return { kind: "unknown", code };
}
