import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { allToolStock, type ToolStock } from "@/lib/inventory";
import { createTool } from "./actions";

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; msg?: string; add?: string; status?: string; flag?: string; category?: string; onsite?: string }>;
}) {
  const user = await requireUser();
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
  // One row per model name; tap to see the serials. Counts match the dashboard.
  const groups = new Map<string, ToolStock[]>();
  for (const t of tools) groups.set(t.name, [...(groups.get(t.name) ?? []), t]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Inventory</h1>
        <div className="flex gap-2">
          {user.role === "super_admin" && (
            <Link href="/import" className="btn flex items-center">
              Import
            </Link>
          )}
          <Link href="/tools?add=1" className="btn flex items-center">
            + Add tool
          </Link>
        </div>
      </div>
      {msg && <p className="rounded bg-amber-50 p-2 text-sm">{msg}</p>}

      {add && (
        <form action={createTool} className="card flex flex-col gap-2">
          <h2 className="font-semibold">New tool</h2>
          <input name="name" placeholder="Name (e.g. Cordless impact driver SID 6-22)" required className="input" />
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
        {[...groups].map(([name, rows]) => {
          const active = rows.filter((t) => t.status !== "retired");
          const onHand = active.filter((t) => t.status === "active" && t.on_hand > 0).length;
          const flagged = rows.filter((t) => t.import_flag || t.added_by).length;
          return (
            <li key={name}>
              <details className="card p-0" open={rows.length === 1 || !!k}>
                <summary className="flex min-h-11 cursor-pointer items-center justify-between px-3 py-2">
                  <span>
                    <span className="font-semibold">{name}</span>
                    {flagged > 0 && <span className="ml-1 text-xs text-amber-700">· {flagged} flagged</span>}
                  </span>
                  <span className="text-sm tabular-nums">
                    <b>{onHand}</b> / {active.length}
                  </span>
                </summary>
                <ul className="divide-y border-t">
                  {rows.map((t) => (
                    <li key={t.id}>
                      <Link href={`/tools/${t.id}`} className={`flex min-h-11 items-center justify-between px-3 py-2 ${t.status === "retired" ? "opacity-50" : ""}`}>
                        <span className="text-sm">
                          {t.serial_number || t.scan_code || t.model}
                          {t.serial_number && t.scan_code ? <span className="text-zinc-500"> · {t.scan_code}</span> : ""}
                          {t.import_flag && <span className="ml-1 text-xs text-amber-700">· {t.import_flag}</span>}
                          {t.added_by && <span className="ml-1 text-xs text-amber-700">· added on site {t.created_at.slice(0, 10)}</span>}
                        </span>
                        <span className="text-sm">
                          {t.status !== "active" ? (
                            <span className="text-red-700">{t.status}</span>
                          ) : t.out_to ? (
                            <span className="text-amber-700">out: {t.out_to}</span>
                          ) : (
                            <span className="text-green-700">in</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
        {!groups.size && <li className="p-3 text-sm text-zinc-500">No tools yet. {user.role === "super_admin" ? "Import the ON!Track export to start." : ""}</li>}
      </ul>
    </div>
  );
}
