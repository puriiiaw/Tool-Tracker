import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listCheckouts } from "@/lib/checkouts";
import { allToolStock } from "@/lib/inventory";
import { CheckoutList } from "@/components/checkout-list";

export default async function Home() {
  await requireUser();
  const open = listCheckouts({ status: "open" }, 50);
  const holders = new Set(open.map((c) => c.worker_id)).size;
  const tools = allToolStock();
  const stock = tools.filter((t) => t.item_type === "quantity" && t.status === "active");
  const flagged = tools.filter((t) => t.import_flag).length;
  const damaged = tools.filter((t) => t.status === "damaged").length;
  const lost = tools.filter((t) => t.status === "lost").length;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Link href="/checkout" className="btn-primary flex items-center justify-center">
          + New checkout
        </Link>
        <Link href="/log" className="btn flex items-center justify-center">
          Log
        </Link>
        <Link href="/workers" className="btn flex items-center justify-center">
          Search worker
        </Link>
        <Link href="/tools" className="btn flex items-center justify-center">
          Search tool
        </Link>
      </div>

      <div className="card grid grid-cols-2 text-center">
        <div>
          <div className="text-2xl font-bold">{open.length}</div>
          <div className="text-xs text-zinc-500">open checkouts</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{holders}</div>
          <div className="text-xs text-zinc-500">workers holding items</div>
        </div>
      </div>

      {stock.length > 0 && (
        <div className="card flex gap-3 overflow-x-auto whitespace-nowrap text-sm">
          {stock.map((t) => (
            <Link key={t.id} href={`/tools/${t.id}`} className="text-center">
              <div className={`font-bold ${t.on_hand === 0 ? "text-red-700" : ""}`}>
                {t.on_hand}/{t.total_qty}
              </div>
              <div className="text-xs text-zinc-500">{t.name}</div>
            </Link>
          ))}
        </div>
      )}

      {(flagged || damaged || lost) > 0 && (
        <div className="flex gap-2 text-xs">
          {flagged > 0 && <Link href="/tools?flag=1" className="rounded bg-amber-100 px-2 py-1 text-amber-800">{flagged} flagged by import</Link>}
          {damaged > 0 && <Link href="/tools?status=damaged" className="rounded bg-red-100 px-2 py-1 text-red-800">{damaged} damaged</Link>}
          {lost > 0 && <Link href="/tools?status=lost" className="rounded bg-red-100 px-2 py-1 text-red-800">{lost} lost</Link>}
        </div>
      )}

      <h2 className="font-semibold">Out now</h2>
      <CheckoutList rows={open} empty="Everything is in." />
    </div>
  );
}
