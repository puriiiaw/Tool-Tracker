"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getCheckout, returnEvents } from "@/lib/checkouts";
import { halifaxToSqlite } from "@/lib/format";
import { toolStock } from "@/lib/inventory";

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
        const qty = Math.floor(Number(form.get(`rqty_${ev.id}`)));
        const outcome = String(form.get(`rout_${ev.id}`));
        const voided = form.get(`rvoid_${ev.id}`) ? 1 : 0;
        if (!voided && (qty < 1 || !["returned", "damaged", "lost"].includes(outcome))) throw new Error("Return quantities must be 1 or more.");
        db.prepare("UPDATE return_event SET qty = ?, outcome = ?, voided = ? WHERE id = ?").run(voided ? ev.qty : qty, voided ? ev.outcome : outcome, voided, ev.id);
      }

      // Existing lines: tool, qty, long-term, remove.
      for (const line of before.checkout!.lines) {
        if (form.get(`remove_${line.id}`)) {
          const live = db.prepare("SELECT COUNT(*) FROM return_event WHERE checkout_line_id = ? AND voided = 0").pluck().get(line.id) as number;
          if (live) throw new Error(`${line.tool_name}: void its returns before removing the line.`);
          db.prepare("UPDATE return_event SET voided = 1 WHERE checkout_line_id = ?").run(line.id);
          db.prepare("UPDATE checkout_line SET removed = 1 WHERE id = ?").run(line.id);
          continue;
        }
        const toolId = Number(form.get(`tool_${line.id}`)) || line.tool_id;
        const qty = Math.floor(Number(form.get(`qty_${line.id}`))) || line.qty_out;
        const longTerm = form.get(`lt_${line.id}`) ? 1 : 0;
        db.prepare("UPDATE checkout_line SET tool_id = ?, qty_out = ?, long_term = ? WHERE id = ?").run(toolId, qty, longTerm, line.id);
      }

      // One optional new line.
      const newTool = Number(form.get("new_tool"));
      if (newTool) {
        const qty = Math.max(1, Math.floor(Number(form.get("new_qty")) || 1));
        db.prepare("INSERT INTO checkout_line (checkout_id, tool_id, qty_out, long_term) VALUES (?, ?, ?, ?)").run(id, newTool, qty, form.get("new_lt") ? 1 : 0);
      }

      // Validate the result the same way a new checkout is validated.
      const after = getCheckout(id)!;
      if (!after.lines.length) throw new Error("A checkout needs at least one line.");
      for (const l of after.lines) {
        const back = l.returned + l.damaged + l.lost;
        if (back > l.qty_out) throw new Error(`${l.tool_name}: ${back} already returned, quantity cannot be lower.`);
        const stock = toolStock(l.tool_id)!;
        if (stock.item_type === "unique") {
          if (l.qty_out !== 1) throw new Error(`${l.tool_name}: quantity must be 1.`);
          const holders = db.prepare(
            `SELECT COUNT(*) FROM checkout_line cl JOIN checkout c ON c.id = cl.checkout_id
             WHERE cl.tool_id = ? AND c.id != ? AND cl.removed = 0
               AND cl.qty_out > (SELECT COALESCE(SUM(qty), 0) FROM return_event WHERE checkout_line_id = cl.id AND voided = 0)`
          ).pluck().get(l.tool_id, id) as number;
          if (holders && l.qty_out > back) throw new Error(`${l.tool_name} is out on another checkout.`);
        } else if (stock.on_hand < 0) {
          throw new Error(`${l.tool_name}: only ${stock.on_hand + (l.qty_out - back)} on hand.`);
        }
      }
      audit(actor.id, "checkout", id, "edit", before, snapshot(id));
    })();
  } catch (e) {
    fail((e as Error).message);
  }
  redirect(`/log/${id}?msg=${encodeURIComponent("Checkout updated. The original is kept in the audit trail.")}`);
}
