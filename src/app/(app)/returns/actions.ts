"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { lookupCode } from "@/lib/scan";
import { recordReturns } from "@/app/(app)/log/actions";

type Outcome = "returned" | "damaged" | "lost";

// Fields are named back_<checkoutId>_<lineId> and outcome_<checkoutId>_<lineId>.
export async function recordWorkerReturn(form: FormData) {
  const actor = await requireUser();
  const workerId = Number(form.get("worker"));
  const byCheckout = new Map<number, { lineId: number; outcome: Outcome }[]>();
  for (const k of form.keys()) {
    const m = /^back_(\d+)_(\d+)$/.exec(k);
    if (!m) continue;
    const o = String(form.get(`outcome_${m[1]}_${m[2]}`));
    const outcome: Outcome = o === "damaged" || o === "lost" ? o : "returned";
    const list = byCheckout.get(Number(m[1])) ?? [];
    list.push({ lineId: Number(m[2]), outcome });
    byCheckout.set(Number(m[1]), list);
  }
  const fail = (msg: string): never => redirect(`/returns?worker=${workerId}&msg=${encodeURIComponent(msg)}`);
  if (!byCheckout.size) fail("Tick at least one item.");
  try {
    for (const [checkoutId, items] of byCheckout) await recordReturns(actor.id, checkoutId, items);
  } catch (e) {
    fail((e as Error).message);
  }
  redirect(`/returns?worker=${workerId}&msg=${encodeURIComponent("Return recorded.")}`);
}

// One scan = one item back, committed at once so the beep means done.
export async function returnByScan(code: string): Promise<{ text: string; bad?: boolean }> {
  const actor = await requireUser();
  const hit = lookupCode(code);
  if (hit.kind === "unknown") return { text: `Tag ${hit.code} is not in inventory.`, bad: true };
  if (!hit.outTo) return { text: `${hit.name} is not out.`, bad: true };
  const checkoutId = db.prepare("SELECT checkout_id FROM checkout_line WHERE id = ?").pluck().get(hit.outTo.lineId) as number;
  try {
    await recordReturns(actor.id, checkoutId, [{ lineId: hit.outTo.lineId, outcome: "returned" }]);
  } catch (e) {
    return { text: (e as Error).message, bad: true };
  }
  return { text: `${hit.name} back from ${hit.outTo.worker}.` };
}
