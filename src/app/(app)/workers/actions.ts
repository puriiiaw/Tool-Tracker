"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

const getRow = db.prepare("SELECT id, name, active FROM worker WHERE id = ?");

export async function createWorker(form: FormData) {
  const actor = await requireUser();
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (!name) redirect("/workers?msg=" + encodeURIComponent("Name is required."));
  const id = db.transaction(() => {
    const id = Number(db.prepare("INSERT INTO worker (name, created_by) VALUES (?, ?)").run(name, actor.id).lastInsertRowid);
    audit(actor.id, "worker", id, "create", null, getRow.get(id));
    return id;
  })();
  redirect(`/workers/${id}`);
}

export async function updateWorker(form: FormData) {
  const actor = await requireUser();
  const id = Number(form.get("id"));
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  const active = form.get("active") === "0" ? 0 : 1;
  if (!name) redirect(`/workers/${id}?msg=` + encodeURIComponent("Name is required."));
  db.transaction(() => {
    const before = getRow.get(id);
    db.prepare("UPDATE worker SET name = ?, active = ? WHERE id = ?").run(name, active, id);
    audit(actor.id, "worker", id, "update", before, getRow.get(id));
  })();
  redirect(`/workers/${id}?msg=` + encodeURIComponent("Saved."));
}
