import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { toolStock } from "@/lib/inventory";
import { listCheckouts } from "@/lib/checkouts";
import { CheckoutList } from "@/components/checkout-list";
import { updateTool } from "../actions";
import { CATEGORIES } from "@/lib/category";

export default async function ToolPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { msg } = await searchParams;
  const t = toolStock(Number(id));
  if (!t) notFound();
  const history = listCheckouts({ tool: t.id, status: "all" });
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-bold">{t.name}</h1>
      {msg && <p className="rounded bg-amber-50 p-2 text-sm">{msg}</p>}

      <div className="card grid grid-cols-4 text-center text-sm">
        <div><b>{t.total_qty}</b><br />total</div>
        <div><b>{t.on_hand}</b><br />on hand</div>
        <div><b>{t.out_qty}</b><br />out{t.out_to ? ` (${t.out_to})` : ""}</div>
        <div><b>{t.damaged_qty + t.lost_qty}</b><br />dmg/lost</div>
      </div>

      <form action={updateTool} className="card flex flex-col gap-2">
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="item_type" value={t.item_type} />
        <label className="text-xs text-zinc-500">Name</label>
        <input name="name" defaultValue={t.name} required className="input" />
        {t.item_type === "quantity" && (
          <>
            <label className="text-xs text-zinc-500">Total quantity</label>
            <input name="total_qty" type="number" inputMode="numeric" min={0} defaultValue={t.total_qty} className="input" />
          </>
        )}
        <label className="text-xs text-zinc-500">Model</label>
        <input name="model" defaultValue={t.model ?? ""} className="input" />
        <label className="text-xs text-zinc-500">Scan code</label>
        <input name="scan_code" defaultValue={t.scan_code ?? ""} className="input" />
        <label className="text-xs text-zinc-500">Serial number</label>
        <input name="serial_number" defaultValue={t.serial_number ?? ""} className="input" />
        <label className="text-xs text-zinc-500">Manufacturer</label>
        <input name="manufacturer" defaultValue={t.manufacturer ?? ""} className="input" />
        <label className="text-xs text-zinc-500">Category</label>
        <select name="category" defaultValue={t.category ?? ""} className="input">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="text-xs text-zinc-500">Status</label>
        <select name="status" defaultValue={t.status} className="input">
          <option value="active">Active</option>
          <option value="damaged">Damaged</option>
          <option value="lost">Lost</option>
          <option value="retired">Retired (hidden from checkout)</option>
        </select>
        <label className="text-xs text-zinc-500">Notes</label>
        <input name="notes" defaultValue={t.notes ?? ""} className="input" />
        {t.import_flag && (
          <label className="flex min-h-11 items-center gap-2 text-sm text-amber-700">
            <input type="checkbox" name="clear_flag" value="1" className="size-5" />
            Reviewed, clear flag: {t.import_flag}
          </label>
        )}
        <button className="btn-primary">Save</button>
      </form>

      <h2 className="font-semibold">History</h2>
      <CheckoutList rows={history} empty="Never checked out." />
    </div>
  );
}
