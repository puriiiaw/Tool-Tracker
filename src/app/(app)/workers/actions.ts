"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { applyWorkerImport, cleanName, parseWorkerFile, planWorkerImport, upsertWorker } from "@/lib/workers";
import { dropStaged, stageFile, stagedFile } from "@/lib/staging";

const getRow = db.prepare("SELECT id, name, active, hidden FROM worker WHERE id = ?");
const itemsOut = db.prepare(
  `SELECT COUNT(*) FROM checkout_line cl JOIN checkout c ON c.id = cl.checkout_id
   WHERE c.worker_id = ? AND cl.removed = 0
     AND cl.qty_out > (SELECT COALESCE(SUM(qty), 0) FROM return_event WHERE checkout_line_id = cl.id AND voided = 0)`
);

export async function createWorker(form: FormData) {
  const actor = await requireUser();
  const name = cleanName(form.get("name"));
  if (!name) redirect("/workers?msg=" + encodeURIComponent("Name is required."));
  const id = db.transaction(() => upsertWorker(db, name, actor.id))();
  redirect(`/workers/${id}`);
}

export async function updateWorker(form: FormData) {
  const actor = await requireUser();
  const id = Number(form.get("id"));
  const name = cleanName(form.get("name"));
  if (!name) redirect(`/workers/${id}?msg=` + encodeURIComponent("Name is required."));
  db.transaction(() => {
    const before = getRow.get(id);
    db.prepare("UPDATE worker SET name = ? WHERE id = ?").run(name, id);
    audit(actor.id, "worker", id, "update", before, getRow.get(id));
  })();
  redirect(`/workers/${id}?msg=` + encodeURIComponent("Saved."));
}

// Any admin. Blocked while the worker still holds tools.
export async function setWorkerActive(form: FormData) {
  const actor = await requireUser();
  const id = Number(form.get("id"));
  const active = form.get("active") === "1" ? 1 : 0;
  const out = itemsOut.pluck().get(id) as number;
  if (!active && out) redirect(`/workers/${id}?msg=` + encodeURIComponent(`Return their ${out} item${out === 1 ? "" : "s"} first.`));
  db.transaction(() => {
    const before = getRow.get(id);
    db.prepare("UPDATE worker SET active = ?, hidden = 0 WHERE id = ?").run(active, id);
    audit(actor.id, "worker", id, active ? "reactivate" : "deactivate", before, getRow.get(id));
  })();
  redirect(`/workers/${id}?msg=` + encodeURIComponent(active ? "Back on the active roster." : "Marked inactive."));
}

// Super-admin only, inactive workers only. Hides the row; the log still names them.
export async function hideWorker(form: FormData) {
  const actor = await requireUser("super_admin");
  const id = Number(form.get("id"));
  const w = getRow.get(id) as { active: number } | undefined;
  if (!w || w.active) redirect(`/workers/${id}?msg=` + encodeURIComponent("Mark the worker inactive first."));
  db.transaction(() => {
    db.prepare("UPDATE worker SET hidden = 1 WHERE id = ?").run(id);
    audit(actor.id, "worker", id, "hide", w, getRow.get(id));
  })();
  redirect("/workers?tab=inactive&msg=" + encodeURIComponent("Removed from the roster. Adding the same name again brings them back."));
}

export async function uploadWorkers(form: FormData) {
  await requireUser("super_admin");
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) redirect("/workers?msg=" + encodeURIComponent("Choose the workers .xlsx file first."));
  let names: string[];
  try {
    names = parseWorkerFile(await file.arrayBuffer());
  } catch {
    redirect("/workers?msg=" + encodeURIComponent("Could not read that file. Use the template."));
  }
  if (!names.length) redirect("/workers?msg=" + encodeURIComponent("No names found. Put one name per row under a 'Name' header."));
  redirect(`/workers?t=${stageFile({ fileName: file.name, rows: names })}`);
}

export async function commitWorkers(form: FormData) {
  const actor = await requireUser("super_admin");
  const token = String(form.get("t") ?? "");
  const staged = stagedFile<string>(token);
  if (!staged) redirect("/workers?msg=" + encodeURIComponent("That preview has expired. Upload the file again."));
  const plan = planWorkerImport(db, staged.rows);
  applyWorkerImport(db, plan, actor.id);
  dropStaged(token);
  redirect("/workers?msg=" + encodeURIComponent(`${staged.fileName}: ${plan.add.length} added, ${plan.reactivate.length} brought back, ${plan.existing} already on the roster.`));
}
