import type { Database } from "better-sqlite3";

export type HolderRow = { workerId: number; worker: string; lineId: number; since: string; others: number };

// Still out: not removed, and not yet covered by a live return event.
const OPEN = (cl: string) =>
  `${cl}.removed = 0 AND ${cl}.qty_out > (SELECT COALESCE(SUM(qty), 0) FROM return_event WHERE checkout_line_id = ${cl}.id AND voided = 0)`;

// Who has this tool now, since when, and how many other tools that worker still holds.
export function holderOf(db: Database, toolId: number): HolderRow | null {
  const h = db
    .prepare(
      `SELECT w.id AS workerId, w.name AS worker, cl.id AS lineId, c.created_at AS since FROM checkout_line cl
       JOIN checkout c ON c.id = cl.checkout_id JOIN worker w ON w.id = c.worker_id
       WHERE cl.tool_id = ? AND ${OPEN("cl")} LIMIT 1`
    )
    .get(toolId) as Omit<HolderRow, "others"> | undefined;
  if (!h) return null;
  const others = db
    .prepare(
      `SELECT COUNT(*) FROM checkout_line cl JOIN checkout c ON c.id = cl.checkout_id
       WHERE c.worker_id = ? AND cl.id != ? AND ${OPEN("cl")}`
    )
    .pluck()
    .get(h.workerId, h.lineId) as number;
  return { ...h, others };
}
