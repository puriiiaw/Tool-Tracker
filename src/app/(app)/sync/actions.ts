"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { getUser, requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { holderOf } from "@/lib/holder";
import { applyItem, type Applied, type QItem } from "@/lib/sync";

const isItem = (x: unknown): x is QItem => {
  const i = x as QItem;
  if (!i || typeof i.id !== "string" || !i.id || i.id.length > 64 || typeof i.at !== "string") return false;
  if (i.kind === "return") return Number.isInteger(i.toolId);
  return i.kind === "checkout" && Number.isInteger(i.worker?.id) && typeof i.worker.name === "string" && typeof i.note === "string"
    && Array.isArray(i.lines) && i.lines.every((l) => Number.isInteger(l.toolId));
};

// Called by the phone's queue. Never redirects: a signed-out phone is told so and keeps its items.
export async function applyQueued(item: QItem): Promise<Applied | { auth: false } | { bad: string }> {
  const user = await getUser();
  if (!user) return { auth: false };
  if (!isItem(item)) return { bad: "A queued item was unreadable and was skipped." };
  return db.transaction(() => applyItem(db, user.id, item))();
}

const back = (msg: string): never => {
  revalidatePath("/", "layout"); // the count in the top bar changed
  redirect(`/?msg=${encodeURIComponent(msg)}`);
};

export async function dismissAttention(form: FormData) {
  const actor = await requireUser();
  const id = Number(form.get("id"));
  db.transaction(() => {
    const r = db.prepare("UPDATE attention SET resolution = 'dismissed', resolved_by = ?, resolved_at = datetime('now') WHERE id = ? AND resolution IS NULL").run(actor.id, id);
    if (r.changes) audit(actor.id, "attention", id, "dismiss", null, null);
  })();
  back("Dismissed.");
}

// Clash fix: take the tool from whoever holds it now and give it to the worker who wanted it.
export async function handOverAttention(form: FormData) {
  const actor = await requireUser();
  const id = Number(form.get("id"));
  const a = db.prepare("SELECT worker_id, tool_id FROM attention WHERE id = ? AND resolution IS NULL").get(id) as { worker_id: number | null; tool_id: number | null } | undefined;
  if (!a?.worker_id || !a.tool_id) back("Nothing to hand over.");
  const w = db.prepare("SELECT name FROM worker WHERE id = ? AND active = 1 AND hidden = 0").pluck().get(a!.worker_id) as string | undefined;
  if (!w) back("That worker is no longer on the active roster.");
  db.transaction(() => {
    const h = holderOf(db, a!.tool_id!);
    if (h) {
      const rid = Number(db.prepare("INSERT INTO return_event (checkout_line_id, qty, outcome, created_by) VALUES (?, 1, 'returned', ?)").run(h.lineId, actor.id).lastInsertRowid);
      audit(actor.id, "return_event", rid, "create", null, { lineId: h.lineId, outcome: "returned", to: w, via: "handover" });
    }
    const cid = Number(db.prepare("INSERT INTO checkout (worker_id, created_by, note) VALUES (?, ?, ?)").run(a!.worker_id, actor.id, h ? `Handed over from ${h.worker}` : null).lastInsertRowid);
    db.prepare("INSERT INTO checkout_line (checkout_id, tool_id) VALUES (?, ?)").run(cid, a!.tool_id);
    audit(actor.id, "checkout", cid, "create", null, { id: cid, workerId: a!.worker_id, toolId: a!.tool_id, via: "handover" });
    db.prepare("UPDATE attention SET resolution = 'handed over', resolved_by = ?, resolved_at = datetime('now') WHERE id = ?").run(actor.id, id);
    audit(actor.id, "attention", id, "hand_over", null, null);
  })();
  back(`Handed over to ${w}.`);
}
