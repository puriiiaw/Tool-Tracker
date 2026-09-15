import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { getCheckout, returnEvents } from "@/lib/checkouts";
import { fmtTime, toHalifaxInput } from "@/lib/format";
import { editCheckout } from "./actions";

export default async function EditCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { msg } = await searchParams;
  const co = getCheckout(Number(id));
  if (!co) notFound();
  const events = returnEvents(co.id);
  const workers = db.prepare("SELECT id, name FROM worker WHERE active = 1 OR id = ? ORDER BY name").all(co.worker_id) as { id: number; name: string }[];
  const tools = (
    db.prepare("SELECT id, name, serial_number, scan_code FROM tool WHERE status = 'active' ORDER BY name").all() as {
      id: number; name: string; serial_number: string | null; scan_code: string | null;
    }[]
  ).map((t) => ({ id: t.id, name: `${t.name} · ${t.serial_number || t.scan_code || t.id}` }));

  return (
    <form action={editCheckout} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={co.id} />
      <h1 className="text-xl font-bold">Edit checkout</h1>
      <p className="text-sm text-zinc-500">Every change is kept in the audit trail with the original.</p>
      {msg && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{msg}</p>}

      <div className="card flex flex-col gap-2">
        <label className="text-xs text-zinc-500">Worker</label>
        <select name="worker_id" defaultValue={co.worker_id} className="input">
          {workers.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <label className="text-xs text-zinc-500">Time out (Halifax)</label>
        <input type="datetime-local" name="created_at" defaultValue={toHalifaxInput(co.created_at)} required className="input" />
        <label className="text-xs text-zinc-500">Note</label>
        <input name="note" defaultValue={co.note ?? ""} className="input" />
      </div>

      <h2 className="font-semibold">Lines</h2>
      {co.lines.map((l) => (
        <div key={l.id} className="card flex flex-col gap-2">
          <select name={`tool_${l.id}`} defaultValue={l.tool_id} className="input">
            {tools.some((t) => t.id === l.tool_id) || <option value={l.tool_id}>{l.tool_name}</option>}
            {tools.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={`lt_${l.id}`} defaultChecked={!!l.long_term} className="size-5" /> Long-term
            </label>
            <label className="ml-auto flex items-center gap-2 text-sm text-red-700">
              <input type="checkbox" name={`remove_${l.id}`} className="size-5" /> Remove
            </label>
          </div>
          {l.returned + l.damaged + l.lost > 0 && <p className="text-xs text-zinc-500">Already back on this line.</p>}
        </div>
      ))}

      <div className="card flex flex-col gap-2">
        <label className="text-xs text-zinc-500">Add a line</label>
        <select name="new_tool" defaultValue="" className="input">
          <option value="">— none —</option>
          {tools.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="new_lt" className="size-5" /> Long-term
        </label>
      </div>

      {events.length > 0 && (
        <>
          <h2 className="font-semibold">Returns</h2>
          {events.map((e) => (
            <div key={e.id} className={`card flex flex-col gap-2 ${e.voided ? "opacity-60" : ""}`}>
              <div className="text-sm">
                {e.tool_name} · {fmtTime(e.created_at)} · {e.admin_name}
                {e.voided ? " · voided" : ""}
              </div>
              {!e.voided && (
                <div className="flex items-center gap-2">
                  <select name={`rout_${e.id}`} defaultValue={e.outcome} className="input flex-1">
                    <option value="returned">Returned</option>
                    <option value="damaged">Damaged</option>
                    <option value="lost">Lost</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm text-red-700">
                    <input type="checkbox" name={`rvoid_${e.id}`} className="size-5" /> Void
                  </label>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      <button className="btn-primary">Save changes</button>
      <Link href={`/log/${co.id}`} className="btn text-center leading-11">Cancel</Link>
    </form>
  );
}
