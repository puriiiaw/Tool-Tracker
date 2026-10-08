"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
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
