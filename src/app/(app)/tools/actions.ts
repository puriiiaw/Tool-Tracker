"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";

const FIELDS = ["name", "item_type", "total_qty", "model", "scan_code", "serial_number", "manufacturer", "status", "notes", "import_flag"] as const;
const getRow = db.prepare(`SELECT id, ${FIELDS.join(", ")} FROM tool WHERE id = ?`);

function read(form: FormData) {
  const s = (k: string) => String(form.get(k) ?? "").trim() || null;
  const item_type = form.get("item_type") === "quantity" ? "quantity" : "unique";
  const total_qty = item_type === "quantity" ? Math.max(0, Math.floor(Number(form.get("total_qty")) || 0)) : 1;
  return {
    name: s("name"),
    item_type,
    total_qty,
    model: s("model"),
    scan_code: s("scan_code"),
    serial_number: s("serial_number"),
    manufacturer: s("manufacturer"),
    notes: s("notes"),
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
        `INSERT INTO tool (name, item_type, total_qty, model, scan_code, serial_number, manufacturer, notes)
         VALUES (@name, @item_type, @total_qty, @model, @scan_code, @serial_number, @manufacturer, @notes)`
      ).run(v).lastInsertRowid
    );
    audit(actor.id, "tool", id, "create", null, getRow.get(id));
    return id;
  })();
  redirect(`/tools/${id}?msg=` + encodeURIComponent("Tool added."));
}

export async function updateTool(form: FormData) {
  const actor = await requireUser();
  const id = Number(form.get("id"));
  const before = getRow.get(id) as { item_type: string } | undefined;
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
      `UPDATE tool SET name=@name, total_qty=@total_qty, model=@model, scan_code=@scan_code,
         serial_number=@serial_number, manufacturer=@manufacturer, notes=@notes, status=@status,
         import_flag = CASE WHEN @clear THEN NULL ELSE import_flag END
       WHERE id=@id`
    ).run({ ...v, status, id, clear: form.get("clear_flag") ? 1 : 0 });
    audit(actor.id, "tool", id, "update", before, getRow.get(id));
  })();
  redirect(`/tools/${id}?msg=` + encodeURIComponent("Saved."));
}
