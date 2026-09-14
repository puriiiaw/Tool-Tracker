"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getCheckout } from "@/lib/checkouts";

type Outcome = "returned" | "damaged" | "lost";
const OUTCOMES: Outcome[] = ["returned", "damaged", "lost"];

function recordReturns(
  actorId: number,
  checkoutId: number,
  items: { lineId: number; qty: number; outcome: Outcome }[]
) {
  const co = getCheckout(checkoutId);
  if (!co) throw new Error("Checkout not found.");
  db.transaction(() => {
    for (const it of items) {
      const line = co.lines.find((l) => l.id === it.lineId);
      if (!line) throw new Error("Line not found.");
      const remaining = line.qty_out - line.returned - line.damaged - line.lost;
      if (it.qty < 1 || it.qty > remaining) throw new Error(`${line.tool_name}: only ${remaining} still out.`);
      const id = Number(
        db.prepare("INSERT INTO return_event (checkout_line_id, qty, outcome, created_by) VALUES (?, ?, ?, ?)")
          .run(it.lineId, it.qty, it.outcome, actorId).lastInsertRowid
      );
      audit(actorId, "return_event", id, "create", null, { checkoutId, ...it });
      // A unique tool that comes back broken or never comes back changes the tool's own status.
      if (line.item_type === "unique" && it.outcome !== "returned") {
        const before = db.prepare("SELECT status FROM tool WHERE id = ?").get(line.tool_id);
        db.prepare("UPDATE tool SET status = ? WHERE id = ?").run(it.outcome, line.tool_id);
        audit(actorId, "tool", line.tool_id, "status", before, { status: it.outcome });
      }
    }
  })();
}

function back(id: number, msg: string): never {
  redirect(`/log/${id}?msg=${encodeURIComponent(msg)}`);
}

export async function returnAll(form: FormData) {
  const actor = await requireUser();
  const id = Number(form.get("id"));
  const co = getCheckout(id);
  if (!co) redirect("/log");
  const items = co.lines
    .map((l) => ({ lineId: l.id, qty: l.qty_out - l.returned - l.damaged - l.lost, outcome: "returned" as Outcome }))
    .filter((i) => i.qty > 0);
  if (!items.length) back(id, "Nothing left to return.");
  try {
    recordReturns(actor.id, id, items);
  } catch (e) {
    back(id, (e as Error).message);
  }
  redirect(`/log?msg=${encodeURIComponent(`${co.worker_name}: all returned.`)}`);
}

export async function returnPartial(form: FormData) {
  const actor = await requireUser();
  const id = Number(form.get("id"));
  const items: { lineId: number; qty: number; outcome: Outcome }[] = [];
  for (const [k, v] of form.entries()) {
    const m = /^qty_(\d+)$/.exec(k);
    if (!m) continue;
    const qty = Math.floor(Number(v));
    if (!qty) continue;
    const o = String(form.get(`outcome_${m[1]}`));
    items.push({ lineId: Number(m[1]), qty, outcome: OUTCOMES.includes(o as Outcome) ? (o as Outcome) : "returned" });
  }
  if (!items.length) back(id, "Enter a quantity for at least one line.");
  try {
    recordReturns(actor.id, id, items);
  } catch (e) {
    back(id, (e as Error).message);
  }
  back(id, "Return recorded.");
}
