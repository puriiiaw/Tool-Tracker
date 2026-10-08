"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getCheckout } from "@/lib/checkouts";

type Outcome = "returned" | "damaged" | "lost";
const OUTCOMES: Outcome[] = ["returned", "damaged", "lost"];

export async function recordReturns(
  actorId: number,
  checkoutId: number,
  items: { lineId: number; outcome: Outcome; to?: string }[] // `to`: handed straight to this worker; lands in the audit record
) {
  await requireUser();
  const co = getCheckout(checkoutId);
  if (!co) throw new Error("Checkout not found.");
  db.transaction(() => {
    for (const it of items) {
      const line = co.lines.find((l) => l.id === it.lineId);
      if (!line) throw new Error("Line not found.");
      if (line.returned + line.damaged + line.lost > 0) throw new Error(`${line.tool_name} is already back.`);
      const id = Number(
        db.prepare("INSERT INTO return_event (checkout_line_id, qty, outcome, created_by) VALUES (?, 1, ?, ?)")
          .run(it.lineId, it.outcome, actorId).lastInsertRowid
      );
      audit(actorId, "return_event", id, "create", null, { checkoutId, ...it });
      // A tool that comes back broken or never comes back changes the tool's own status.
      if (it.outcome !== "returned") {
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
    .filter((l) => l.returned + l.damaged + l.lost === 0)
    .map((l) => ({ lineId: l.id, outcome: "returned" as Outcome }));
  if (!items.length) back(id, "Nothing left to return.");
  try {
    await recordReturns(actor.id, id, items);
  } catch (e) {
    back(id, (e as Error).message);
  }
  redirect(`/log?msg=${encodeURIComponent(`${co.worker_name}: all returned.`)}`);
}

export async function returnPartial(form: FormData) {
  const actor = await requireUser();
  const id = Number(form.get("id"));
  const items: { lineId: number; outcome: Outcome }[] = [];
  for (const k of form.keys()) {
    const m = /^back_(\d+)$/.exec(k);
    if (!m) continue;
    const o = String(form.get(`outcome_${m[1]}`));
    items.push({ lineId: Number(m[1]), outcome: OUTCOMES.includes(o as Outcome) ? (o as Outcome) : "returned" });
  }
  if (!items.length) back(id, "Tick at least one tool.");
  try {
    await recordReturns(actor.id, id, items);
  } catch (e) {
    back(id, (e as Error).message);
  }
  back(id, "Return recorded.");
}
