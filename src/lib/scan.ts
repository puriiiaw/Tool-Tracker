import { db } from "@/db";

export type Holder = { worker: string; lineId: number };
export type ScanHit = { kind: "tool"; toolId: number; name: string; status: string; outTo: Holder | null } | { kind: "unknown"; code: string };

// ponytail: Hilti tags decode to the 9-digit scan code; if a tag ever carries a URL, the first 9-digit run is used.
export function normalizeCode(raw: string) {
  const s = raw.replace(/\s+/g, "");
  return /\d{9}/.exec(s)?.[0] ?? s;
}

// Open line holding this tool: not removed, and not yet covered by a live return event.
export function toolHolder(toolId: number): Holder | null {
  return (
    (db
      .prepare(
        `SELECT w.name AS worker, cl.id AS lineId FROM checkout_line cl
         JOIN checkout c ON c.id = cl.checkout_id JOIN worker w ON w.id = c.worker_id
         WHERE cl.tool_id = ? AND cl.removed = 0
           AND cl.qty_out > (SELECT COALESCE(SUM(qty), 0) FROM return_event WHERE checkout_line_id = cl.id AND voided = 0)
         LIMIT 1`
      )
      .get(toolId) as Holder | undefined) ?? null
  );
}

export function lookupCode(raw: string): ScanHit {
  const code = normalizeCode(raw);
  const tool = db.prepare("SELECT id, name, status FROM tool WHERE scan_code = ?").get(code) as
    | { id: number; name: string; status: string }
    | undefined;
  if (tool) return { kind: "tool", toolId: tool.id, name: tool.name, status: tool.status, outTo: toolHolder(tool.id) };
  return { kind: "unknown", code };
}
