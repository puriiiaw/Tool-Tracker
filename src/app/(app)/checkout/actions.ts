"use server";

import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toolStock } from "@/lib/inventory";

export type Line = { toolId: number; qty: number; longTerm: boolean };

function normalize(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Quick-add from the checkout screen. Warns on near-duplicate names unless force is set.
type AddWorkerResult = { error: string } | { similar: { id: number; name: string }[] } | { worker: { id: number; name: string } };

export async function addWorker(name: string, force = false): Promise<AddWorkerResult> {
  const actor = await requireUser();
  name = name.trim().replace(/\s+/g, " ");
  if (!name) return { error: "Name is required." };
  const key = normalize(name);
  const existing = db.prepare("SELECT id, name FROM worker WHERE active = 1").all() as {
    id: number;
    name: string;
  }[];
  const similar = existing.filter((w) => {
    const k = normalize(w.name);
    return k === key || k.includes(key) || key.includes(k);
  });
  if (similar.length && !force) return { similar };
  const id = db.transaction(() => {
    const id = Number(
      db.prepare("INSERT INTO worker (name, created_by) VALUES (?, ?)").run(name, actor.id).lastInsertRowid
    );
    audit(actor.id, "worker", id, "create", null, { id, name });
    return id;
  })();
  return { worker: { id, name } };
}

export async function createCheckout(input: {
  workerId: number;
  note: string;
  lines: Line[];
}): Promise<{ error: string } | { id: number }> {
  const actor = await requireUser();
  const worker = db.prepare("SELECT id, name FROM worker WHERE id = ? AND active = 1").get(input.workerId);
  if (!worker) return { error: "Pick a worker from the list." };
  if (!input.lines.length) return { error: "Add at least one tool." };

  try {
    const id = db.transaction(() => {
      // Validate against live stock inside the transaction so two foremen cannot double-book.
      for (const line of input.lines) {
        const tool = toolStock(line.toolId);
        if (!tool || tool.status !== "active") throw new Error("A tool on this checkout is not available.");
        const qty = Math.floor(line.qty);
        if (tool.item_type === "unique") {
          if (qty !== 1) throw new Error(`${tool.name}: quantity must be 1.`);
          if (tool.out_to) throw new Error(`${tool.name} is already out to ${tool.out_to}.`);
        } else if (qty < 1 || qty > tool.on_hand) {
          throw new Error(`${tool.name}: only ${tool.on_hand} on hand.`);
        }
      }
      const id = Number(
        db.prepare("INSERT INTO checkout (worker_id, created_by, note) VALUES (?, ?, ?)")
          .run(input.workerId, actor.id, input.note.trim() || null).lastInsertRowid
      );
      const ins = db.prepare(
        "INSERT INTO checkout_line (checkout_id, tool_id, qty_out, long_term) VALUES (?, ?, ?, ?)"
      );
      for (const line of input.lines) ins.run(id, line.toolId, Math.floor(line.qty), line.longTerm ? 1 : 0);
      audit(actor.id, "checkout", id, "create", null, { ...input, id });
      return id;
    })();
    return { id };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
