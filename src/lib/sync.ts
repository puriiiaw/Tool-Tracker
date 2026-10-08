import type { Database } from "better-sqlite3";
import { categoryFor } from "./category.ts";
import { fmtTime } from "./format.ts";
import { holderOf } from "./holder.ts";
import { cleanName, upsertWorker } from "./workers.ts";

// What a phone queues. Negative ids are workers/tools the phone made up offline; the server resolves them by name / scan code.
export type QLine = { toolId: number; longTerm: boolean; newTool?: { code: string; name: string } };
export type QItem =
  | { id: string; at: string; kind: "checkout"; worker: { id: number; name: string }; note: string; lines: QLine[] }
  | { id: string; at: string; kind: "return"; toolId: number; to?: string };
export type Applied = { outcome: "done" | "ignored" | "rejected"; messages: string[] };

const utc = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
// The phone's tap time is kept unless it is unusable (invalid, or more than 5 minutes ahead of the server).
const tapTime = (at: string, now: Date) => {
  const t = new Date(at);
  return isNaN(+t) || +t > +now + 300_000 ? utc(now) : utc(t);
};

function log(db: Database, actor: number, entity: string, id: number, action: string, before: unknown, after: unknown) {
  db.prepare("INSERT INTO audit_log (actor_id, entity, entity_id, action, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)")
    .run(actor, entity, id, action, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after));
}

function ensureTool(db: Database, actor: number, code: string, rawName: string): number {
  const hit = db.prepare("SELECT id FROM tool WHERE scan_code = ?").pluck().get(code) as number | undefined;
  if (hit) return hit;
  const name = cleanName(rawName) || code;
  const id = Number(
    db.prepare("INSERT INTO tool (name, scan_code, category, created_by) VALUES (?, ?, ?, ?)").run(name, code, categoryFor(name), actor).lastInsertRowid
  );
  log(db, actor, "tool", id, "create_on_site", null, { id, name, scan_code: code });
  return id;
}

// Apply one queued item. Call inside a transaction. Safe to call twice with the same id.
export function applyItem(db: Database, actor: number, item: QItem, now = new Date()): Applied {
  const seen = db.prepare("SELECT outcome FROM sync_item WHERE id = ?").pluck().get(item.id) as Applied["outcome"] | undefined;
  if (seen) return { outcome: seen, messages: [] }; // a retry of something already applied

  const at = tapTime(item.at, now);
  const messages: string[] = [];
  const attn = (message: string, workerId: number | null, toolId: number | null) => {
    db.prepare("INSERT INTO attention (sync_id, message, worker_id, tool_id, tap_at) VALUES (?, ?, ?, ?, ?)").run(item.id, message, workerId, toolId, at);
    messages.push(message);
  };
  const toolName = (id: number) => db.prepare("SELECT name FROM tool WHERE id = ?").pluck().get(id) as string | undefined;

  function applyReturn(it: Extract<QItem, { kind: "return" }>): Applied["outcome"] {
    const h = holderOf(db, it.toolId);
    if (!h) return "ignored"; // already back
    if (h.since > at) {
      attn(`${toolName(it.toolId)}: the return you recorded was skipped because it went out again to ${h.worker} at ${fmtTime(h.since)}.`, null, it.toolId);
      return "rejected";
    }
    const id = Number(
      db.prepare("INSERT INTO return_event (checkout_line_id, qty, outcome, created_by, created_at) VALUES (?, 1, 'returned', ?, ?)").run(h.lineId, actor, at).lastInsertRowid
    );
    log(db, actor, "return_event", id, "create", null, { lineId: h.lineId, outcome: "returned", to: it.to, at, via: "phone" });
    return "done";
  }

  function applyCheckout(it: Extract<QItem, { kind: "checkout" }>): Applied["outcome"] {
    let workerId = it.worker.id;
    if (workerId < 0) workerId = upsertWorker(db, cleanName(it.worker.name), actor);
    else {
      const w = db.prepare("SELECT active, hidden FROM worker WHERE id = ?").get(workerId) as { active: number; hidden: number } | undefined;
      if (!w || !w.active || w.hidden) {
        attn(`${it.worker.name} is no longer on the active roster, so their checkout of ${it.lines.length} tool${it.lines.length === 1 ? "" : "s"} was not saved. Enter it again if it is still needed.`, null, null);
        return "rejected";
      }
    }
    const seenTools = new Set<number>();
    const ok: { toolId: number; longTerm: boolean }[] = [];
    for (const l of it.lines) {
      const toolId = l.toolId < 0 && l.newTool ? ensureTool(db, actor, l.newTool.code, l.newTool.name) : l.toolId;
      if (seenTools.has(toolId)) continue;
      seenTools.add(toolId);
      const t = db.prepare("SELECT name, status FROM tool WHERE id = ?").get(toolId) as { name: string; status: string } | undefined;
      if (!t) continue;
      if (t.status !== "active") {
        attn(`${t.name} is ${t.status}, so it was not checked out to ${it.worker.name}.`, null, toolId);
        continue;
      }
      const h = holderOf(db, toolId);
      if (h?.workerId === workerId) continue; // already theirs
      if (h) {
        attn(`${t.name} was already out to ${h.worker} when ${it.worker.name} took it. Hand it over?`, workerId, toolId);
        continue;
      }
      ok.push({ toolId, longTerm: l.longTerm });
    }
    if (!ok.length) return messages.length ? "rejected" : "ignored";
    const id = Number(
      db.prepare("INSERT INTO checkout (worker_id, created_by, note, created_at) VALUES (?, ?, ?, ?)").run(workerId, actor, it.note.trim() || null, at).lastInsertRowid
    );
    const ins = db.prepare("INSERT INTO checkout_line (checkout_id, tool_id, long_term) VALUES (?, ?, ?)");
    for (const l of ok) ins.run(id, l.toolId, l.longTerm ? 1 : 0);
    log(db, actor, "checkout", id, "create", null, { id, workerId, note: it.note, lines: ok, at, receivedAt: utc(now), via: "phone" });
    return "done";
  }

  const outcome = item.kind === "return" ? applyReturn(item) : applyCheckout(item);
  db.prepare("INSERT INTO sync_item (id, kind, tap_at, outcome) VALUES (?, ?, ?, ?)").run(item.id, item.kind, at, outcome);
  return { outcome, messages };
}
