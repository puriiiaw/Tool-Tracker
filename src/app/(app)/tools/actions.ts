"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { CATEGORIES, categoryFor } from "@/lib/category";

const FIELDS = ["name", "model", "scan_code", "serial_number", "manufacturer", "status", "notes", "import_flag", "category"] as const;
const getRow = db.prepare(`SELECT id, ${FIELDS.join(", ")} FROM tool WHERE id = ?`);

function read(form: FormData) {
  const s = (k: string) => String(form.get(k) ?? "").trim() || null;
  return {
    name: s("name"),
    model: s("model"),
    scan_code: s("scan_code"),
    serial_number: s("serial_number"),
    manufacturer: s("manufacturer"),
    notes: s("notes"),
    category: (CATEGORIES as readonly string[]).includes(String(form.get("category"))) ? String(form.get("category")) : categoryFor(String(form.get("name") ?? "")),
  };
}

export async function createTool(form: FormData) {
  const actor = await requireUser();
  const v = read(form);
  if (!v.name) redirect("/tools?msg=" + encodeURIComponent("Name is required."));
  if (v.scan_code && db.prepare("SELECT 1 FROM tool WHERE scan_code = ?").get(v.scan_code))
    redirect("/tools?msg=" + encodeURIComponent("That scan code is already in inventory."));
  const id = db.transaction(() => {
    const id = Number(
      db.prepare(
        `INSERT INTO tool (name, model, scan_code, serial_number, manufacturer, notes, category, created_by)
         VALUES (@name, @model, @scan_code, @serial_number, @manufacturer, @notes, @category, @created_by)`
      ).run({ ...v, created_by: actor.id }).lastInsertRowid
    );
    audit(actor.id, "tool", id, "create", null, getRow.get(id));
    return id;
  })();
  redirect(`/tools/${id}?msg=` + encodeURIComponent("Tool added."));
}

export async function updateTool(form: FormData) {
  const actor = await requireUser();
  const id = Number(form.get("id"));
  const before = getRow.get(id);
  if (!before) redirect("/tools");
  const v = read(form);
  const status = ["active", "damaged", "lost", "retired"].includes(String(form.get("status")))
    ? String(form.get("status"))
    : "active";
  if (!v.name) redirect(`/tools/${id}?msg=` + encodeURIComponent("Name is required."));
  if (v.scan_code && db.prepare("SELECT 1 FROM tool WHERE scan_code = ? AND id != ?").get(v.scan_code, id))
    redirect(`/tools/${id}?msg=` + encodeURIComponent("That scan code belongs to another tool."));
  db.transaction(() => {
    db.prepare(
      `UPDATE tool SET name=@name, model=@model, scan_code=@scan_code,
         serial_number=@serial_number, manufacturer=@manufacturer, notes=@notes, status=@status, category=@category,
         import_flag = CASE WHEN @clear THEN NULL ELSE import_flag END
       WHERE id=@id`
    ).run({ ...v, status, id, clear: form.get("clear_flag") ? 1 : 0 });
    audit(actor.id, "tool", id, "update", before, getRow.get(id));
  })();
  redirect(`/tools/${id}?msg=` + encodeURIComponent("Saved."));
}
