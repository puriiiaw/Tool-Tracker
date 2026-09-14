import { db } from "@/db";

export type LineRow = {
  id: number;
  checkout_id: number;
  tool_id: number;
  tool_name: string;
  item_type: "unique" | "quantity";
  qty_out: number;
  long_term: number;
  returned: number;
  damaged: number;
  lost: number;
};

export type CheckoutRow = {
  id: number;
  worker_id: number;
  worker_name: string;
  created_by: number;
  admin_name: string;
  created_at: string;
  note: string | null;
  total: number;
  remaining: number;
  status: "open" | "partial" | "closed";
  lines: LineRow[];
};

export type Filters = {
  status?: "open" | "closed" | "all";
  worker?: number;
  tool?: number;
  admin?: number;
  from?: string; // YYYY-MM-DD, Halifax local
  to?: string;
};

// Per-line totals from return events. Reused by the log, detail, worker and tool pages.
const LINE_AGG = `
  SELECT cl.id, cl.checkout_id, cl.tool_id, cl.qty_out, cl.long_term,
         COALESCE(SUM(CASE WHEN r.outcome = 'returned' THEN r.qty END), 0) AS returned,
         COALESCE(SUM(CASE WHEN r.outcome = 'damaged' THEN r.qty END), 0) AS damaged,
         COALESCE(SUM(CASE WHEN r.outcome = 'lost' THEN r.qty END), 0) AS lost
  FROM checkout_line cl
  LEFT JOIN return_event r ON r.checkout_line_id = cl.id AND r.voided = 0
  WHERE cl.removed = 0
  GROUP BY cl.id`;

const CHECKOUTS = `
  WITH line_agg AS (${LINE_AGG}),
  co AS (
    SELECT c.id, c.worker_id, w.name AS worker_name, c.created_by, u.name AS admin_name,
           c.created_at, c.note,
           SUM(la.qty_out) AS total,
           SUM(la.qty_out - la.returned - la.damaged - la.lost) AS remaining
    FROM checkout c
    JOIN worker w ON w.id = c.worker_id
    JOIN user u ON u.id = c.created_by
    JOIN line_agg la ON la.checkout_id = c.id
    GROUP BY c.id
  )
  SELECT *, CASE WHEN remaining = 0 THEN 'closed' WHEN remaining = total THEN 'open' ELSE 'partial' END AS status
  FROM co`;

export function filtersFromParams(p: Record<string, string | undefined>): Filters {
  return {
    status: p.status === "all" || p.status === "closed" ? p.status : "open",
    worker: Number(p.worker) || undefined,
    tool: Number(p.tool) || undefined,
    admin: Number(p.admin) || undefined,
    from: p.from || undefined,
    to: p.to || undefined,
  };
}

export function listCheckouts(f: Filters, limit = 200): CheckoutRow[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.status === "open" || !f.status) where.push("remaining > 0");
  if (f.status === "closed") where.push("remaining = 0");
  const add = (clause: string, value: unknown) => {
    where.push(clause);
    params.push(value);
  };
  if (f.worker) add("worker_id = ?", f.worker);
  if (f.admin) add("created_by = ?", f.admin);
  if (f.tool) add("id IN (SELECT checkout_id FROM checkout_line WHERE tool_id = ? AND removed = 0)", f.tool);
  // Dates are Halifax local; SQLite stores UTC. Halifax is UTC-3 (ADT) or UTC-4 (AST); use -3 as the boundary.
  if (f.from) add("created_at >= datetime(?, '+3 hours')", f.from);
  if (f.to) add("created_at < datetime(?, '+1 day', '+3 hours')", f.to);
  const sql = `${CHECKOUTS} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT ${limit}`;
  const rows = db.prepare(sql).all(...params) as Omit<CheckoutRow, "lines">[];
  return attachLines(rows);
}

export function getCheckout(id: number): CheckoutRow | undefined {
  const row = db.prepare(`${CHECKOUTS} WHERE id = ?`).get(id) as Omit<CheckoutRow, "lines"> | undefined;
  return row && attachLines([row])[0];
}

function attachLines(rows: Omit<CheckoutRow, "lines">[]): CheckoutRow[] {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const lines = db
    .prepare(
      `WITH line_agg AS (${LINE_AGG})
       SELECT la.*, t.name AS tool_name, t.item_type FROM line_agg la JOIN tool t ON t.id = la.tool_id
       WHERE la.checkout_id IN (${ids.map(() => "?").join(",")}) ORDER BY la.id`
    )
    .all(...ids) as LineRow[];
  return rows.map((r) => ({ ...r, lines: lines.filter((l) => l.checkout_id === r.id) }));
}

export type ReturnEventRow = {
  id: number;
  checkout_line_id: number;
  voided: number;
  tool_name: string;
  qty: number;
  outcome: string;
  admin_name: string;
  created_at: string;
};

export function returnEvents(checkoutId: number): ReturnEventRow[] {
  return db
    .prepare(
      `SELECT r.id, r.checkout_line_id, r.voided, t.name AS tool_name, r.qty, r.outcome, u.name AS admin_name, r.created_at
       FROM return_event r
       JOIN checkout_line cl ON cl.id = r.checkout_line_id
       JOIN tool t ON t.id = cl.tool_id
       JOIN user u ON u.id = r.created_by
       WHERE cl.checkout_id = ? ORDER BY r.created_at DESC, r.id DESC`
    )
    .all(checkoutId) as ReturnEventRow[];
}

export type ActivityRow = {
  kind: "checkout" | "return";
  at: string;
  checkout_id: number;
  worker_name: string;
  admin_name: string;
  summary: string;
};

// Latest checkouts and returns, newest first, for the dashboard feed.
export function recentActivity(limit = 12): ActivityRow[] {
  return db
    .prepare(
      `SELECT 'checkout' AS kind, c.created_at AS at, c.id AS checkout_id, w.name AS worker_name, u.name AS admin_name,
              (SELECT GROUP_CONCAT(CASE WHEN cl.qty_out > 1 THEN cl.qty_out || '× ' ELSE '' END || t.name, ', ')
                 FROM checkout_line cl JOIN tool t ON t.id = cl.tool_id WHERE cl.checkout_id = c.id AND cl.removed = 0) AS summary
       FROM checkout c JOIN worker w ON w.id = c.worker_id JOIN user u ON u.id = c.created_by
       UNION ALL
       SELECT 'return', r.created_at, c.id, w.name, u.name,
              (CASE WHEN r.qty > 1 THEN r.qty || '× ' ELSE '' END) || t.name || ' ' || r.outcome
       FROM return_event r
       JOIN checkout_line cl ON cl.id = r.checkout_line_id
       JOIN checkout c ON c.id = cl.checkout_id
       JOIN worker w ON w.id = c.worker_id
       JOIN user u ON u.id = r.created_by
       JOIN tool t ON t.id = cl.tool_id
       WHERE r.voided = 0
       ORDER BY at DESC LIMIT ?`
    )
    .all(limit) as ActivityRow[];
}
