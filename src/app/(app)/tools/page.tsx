import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { allToolStock } from "@/lib/inventory";
import { createTool } from "./actions";

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; msg?: string; add?: string; status?: string; flag?: string; category?: string; onsite?: string }>;
}) {
  await requireUser();
  const { q = "", msg, add, status, flag, category, onsite } = await searchParams;
  const k = q.toLowerCase();
  const tools = allToolStock().filter(
    (t) =>
      (!k || [t.name, t.model, t.scan_code, t.serial_number].some((f) => f && f.toLowerCase().includes(k))) &&
      (!status || t.status === status) &&
      (!flag || t.import_flag) &&
      (!category || t.category === category) &&
      (!onsite || t.added_by)
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Inventory</h1>
        <Link href="/tools?add=1" className="btn flex items-center">
          + Add tool
        </Link>
      </div>
      {msg && <p className="rounded bg-amber-50 p-2 text-sm">{msg}</p>}

      {add && (
        <form action={createTool} className="card flex flex-col gap-2">
          <h2 className="font-semibold">New tool</h2>
          <input name="name" placeholder="Name (e.g. Cordless impact driver SID 6-22)" required className="input" />
          <select name="item_type" className="input">
            <option value="unique">Unique tool (one serial number)</option>
            <option value="quantity">Quantity item (batteries, chargers)</option>
          </select>
          <input name="total_qty" type="number" inputMode="numeric" min={0} placeholder="Total quantity (quantity items only)" className="input" />
          <input name="model" placeholder="Model" className="input" />
          <input name="scan_code" placeholder="Scan code" className="input" />
          <input name="serial_number" placeholder="Serial number" className="input" />
          <input name="manufacturer" placeholder="Manufacturer" className="input" />
          <input name="notes" placeholder="Notes" className="input" />
          <button className="btn-primary">Add</button>
        </form>
      )}

      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, model, scan code, serial" className="input" />
        <button className="btn">Go</button>
      </form>
      <Link href={onsite ? "/tools" : "/tools?onsite=1"} className="text-sm text-blue-700 underline">
        {onsite ? "Show all tools" : "Show only tools added on site"}
      </Link>

      <ul className="flex flex-col gap-1">
        {tools.map((t) => (
          <li key={t.id}>
            <Link href={`/tools/${t.id}`} className={`card flex items-center justify-between ${t.status === "retired" ? "opacity-50" : ""}`}>
              <div>
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs text-zinc-500">
                  {t.item_type === "unique" ? t.serial_number || t.scan_code || t.model : t.model}
                  {t.import_flag && <span className="ml-1 text-amber-700">· {t.import_flag}</span>}
                  {t.added_by && <span className="ml-1 text-amber-700">· added on site {t.created_at.slice(0, 10)}</span>}
                </div>
              </div>
              <div className="text-right text-sm">
                {t.status !== "active" ? (
                  <span className="text-red-700">{t.status}</span>
                ) : t.item_type === "unique" ? (
                  t.out_to ? <span className="text-amber-700">out: {t.out_to}</span> : <span className="text-green-700">in</span>
                ) : (
                  <span>
                    <b>{t.on_hand}</b> / {t.total_qty}
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
        {!tools.length && <li className="p-3 text-sm text-zinc-500">No tools yet.</li>}
      </ul>
    </div>
  );
}
