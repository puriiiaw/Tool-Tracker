"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getCheckout, returnEvents } from "@/lib/checkouts";
import { halifaxToSqlite } from "@/lib/format";

function snapshot(id: number) {
  return { checkout: getCheckout(id), returns: returnEvents(id) };
}

// Full edit of a mistaken entry. The audit row keeps the complete before and after.
export async function editCheckout(form: FormData) {
  const actor = await requireUser();
  const id = Number(form.get("id"));
  const fail = (msg: string): never => redirect(`/log/${id}/edit?msg=${encodeURIComponent(msg)}`);
  const before = snapshot(id);
  if (!before.checkout) redirect("/log");

  const workerId = Number(form.get("worker_id"));
  const createdAt = halifaxToSqlite(String(form.get("created_at") ?? ""));
  const note = String(form.get("note") ?? "").trim() || null;
  if (!db.prepare("SELECT 1 FROM worker WHERE id = ?").get(workerId)) fail("Pick a worker.");
  if (!createdAt) fail("Enter a valid date and time.");

  try {
    db.transaction(() => {
      db.prepare("UPDATE checkout SET worker_id = ?, created_at = ?, note = ? WHERE id = ?").run(workerId, createdAt, note, id);

      // Return events: qty, outcome, voided.
      for (const ev of before.returns) {
        const outcome = String(form.get(`rout_${ev.id}`));
        const voided = form.get(`rvoid_${ev.id}`) ? 1 : 0;
        if (!voided && !["returned", "damaged", "lost"].includes(outcome)) throw new Error("Pick an outcome for each return.");
        db.prepare("UPDATE return_event SET outcome = ?, voided = ? WHERE id = ?").run(voided ? ev.outcome : outcome, voided, ev.id);
      }

      // Existing lines: tool, long-term, remove.
      for (const line of before.checkout!.lines) {
        if (form.get(`remove_${line.id}`)) {
          const live = db.prepare("SELECT COUNT(*) FROM return_event WHERE checkout_line_id = ? AND voided = 0").pluck().get(line.id) as number;
          if (live) throw new Error(`${line.tool_name}: void its returns before removing the line.`);
          db.prepare("UPDATE return_event SET voided = 1 WHERE checkout_line_id = ?").run(line.id);
          db.prepare("UPDATE checkout_line SET removed = 1 WHERE id = ?").run(line.id);
          continue;
        }
        const toolId = Number(form.get(`tool_${line.id}`)) || line.tool_id;
        const longTerm = form.get(`lt_${line.id}`) ? 1 : 0;
        db.prepare("UPDATE checkout_line SET tool_id = ?, long_term = ? WHERE id = ?").run(toolId, longTerm, line.id);
      }

      // One optional new line.
      const newTool = Number(form.get("new_tool"));
      if (newTool) {
        db.prepare("INSERT INTO checkout_line (checkout_id, tool_id, long_term) VALUES (?, ?, ?)").run(id, newTool, form.get("new_lt") ? 1 : 0);
      }

      // Validate the result the same way a new checkout is validated.
      const after = getCheckout(id)!;
      if (!after.lines.length) throw new Error("A checkout needs at least one line.");
      const seen = new Set<number>();
      for (const l of after.lines) {
        const back = l.returned + l.damaged + l.lost;
        if (back > 1) throw new Error(`${l.tool_name}: returned more than once, void one of the returns.`);
        if (seen.has(l.tool_id)) throw new Error(`${l.tool_name} is on this checkout twice.`);
        seen.add(l.tool_id);
        const holders = db.prepare(
          `SELECT COUNT(*) FROM checkout_line cl JOIN checkout c ON c.id = cl.checkout_id
           WHERE cl.tool_id = ? AND c.id != ? AND cl.removed = 0
             AND cl.qty_out > (SELECT COALESCE(SUM(qty), 0) FROM return_event WHERE checkout_line_id = cl.id AND voided = 0)`
        ).pluck().get(l.tool_id, id) as number;
        if (holders && !back) throw new Error(`${l.tool_name} is out on another checkout.`);
      }
      audit(actor.id, "checkout", id, "edit", before, snapshot(id));
    })();
  } catch (e) {
    fail((e as Error).message);
  }
  redirect(`/log/${id}?msg=${encodeURIComponent("Checkout updated. The original is kept in the audit trail.")}`);
}
