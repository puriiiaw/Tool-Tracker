import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCheckout, returnEvents } from "@/lib/checkouts";
import { fmtTime, ids } from "@/lib/format";
import { returnAll, returnPartial } from "../actions";

export default async function CheckoutPage({
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
  const open = co.lines.filter((l) => l.qty_out - l.returned - l.damaged - l.lost > 0);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-xl font-bold">
          <Link href={`/workers/${co.worker_id}`} className="underline">{co.worker_name}</Link>
        </h1>
        <p className="text-sm text-zinc-500">
          Out {fmtTime(co.created_at)} by {co.admin_name}
          {co.note ? ` · ${co.note}` : ""}
          {" · "}
          <Link href={`/log/${co.id}/edit`} className="underline">Edit</Link>
        </p>
      </div>
      {msg && <p className="rounded bg-amber-50 p-2 text-sm">{msg}</p>}

      {open.length > 0 ? (
        <form action={returnPartial} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={co.id} />
          {co.lines.map((l) => {
            const remaining = l.qty_out - l.returned - l.damaged - l.lost;
            return (
              <div key={l.id} className={`card flex flex-col gap-2 ${remaining ? "" : "opacity-60"}`}>
                <div>
                  <Link href={`/tools/${l.tool_id}`} className="font-semibold">{l.tool_name}</Link>
                  <div className="text-xs text-zinc-500">
                    {ids(l.serial, l.scan_code)}
                    {l.returned ? " · returned" : l.damaged ? " · damaged" : l.lost ? " · lost" : " · still out"}
                    {l.long_term ? " · long-term" : ""}
                  </div>
                </div>
                {remaining > 0 && (
                  <div className="flex gap-2">
                    <label className="flex min-h-11 items-center gap-2 px-1">
                      <input type="checkbox" name={`back_${l.id}`} value="1" className="size-5" /> Back
                    </label>
                    <select name={`outcome_${l.id}`} defaultValue="returned" className="input flex-1">
                      <option value="returned">Returned</option>
                      <option value="damaged">Damaged</option>
                      <option value="lost">Lost</option>
                    </select>
                  </div>
                )}
              </div>
            );
          })}
          <button className="btn">Save partial return</button>
        </form>
      ) : (
        <div className="card">
          {co.lines.map((l) => (
            <div key={l.id} className="text-sm">
              {l.tool_name} · {l.returned ? "returned" : l.damaged ? "damaged" : "lost"}
            </div>
          ))}
          <p className="mt-2 text-sm font-semibold text-green-700">Closed</p>
        </div>
      )}

      {open.length > 0 && (
        <form action={returnAll}>
          <input type="hidden" name="id" value={co.id} />
          <button className="btn-primary w-full">Mark all returned</button>
        </form>
      )}

      {events.length > 0 && (
        <div>
          <h2 className="mb-1 font-semibold">Return history</h2>
          <ul className="card flex flex-col gap-1 text-sm">
            {events.map((e) => (
              <li key={e.id} className={e.voided ? "text-zinc-400 line-through" : ""}>
                {e.tool_name} {e.outcome} · {fmtTime(e.created_at)} · {e.admin_name}
                {e.voided ? " (voided)" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

