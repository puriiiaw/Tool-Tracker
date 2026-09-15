import { notFound } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { listCheckouts } from "@/lib/checkouts";
import { CheckoutList } from "@/components/checkout-list";
import { hideWorker, setWorkerActive, updateWorker } from "../actions";

export default async function WorkerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { msg } = await searchParams;
  const w = db.prepare("SELECT id, name, active, hidden FROM worker WHERE id = ?").get(Number(id)) as
    | { id: number; name: string; active: number; hidden: number }
    | undefined;
  if (!w) notFound();
  const out = listCheckouts({ worker: w.id, status: "open" });
  const history = listCheckouts({ worker: w.id, status: "all" });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">
          {w.name}
          {!w.active && <span className="ml-2 text-sm font-normal text-zinc-500">{w.hidden ? "removed" : "inactive"}</span>}
        </h1>
        <form action={setWorkerActive}>
          <input type="hidden" name="id" value={w.id} />
          <input type="hidden" name="active" value={w.active ? 0 : 1} />
          <button className="btn">{w.active ? "Inactivate" : "Reactivate"}</button>
        </form>
      </div>
      {msg && <p className="rounded bg-amber-50 p-2 text-sm">{msg}</p>}

      <h2 className="font-semibold">Out now</h2>
      <CheckoutList rows={out} empty="Nothing out." />

      <h2 className="font-semibold">History</h2>
      <CheckoutList rows={history} empty="No checkouts yet." />

      <details className="card">
        <summary className="cursor-pointer py-2 text-sm text-zinc-600">Edit name</summary>
        <form action={updateWorker} className="flex gap-2 pt-2">
          <input type="hidden" name="id" value={w.id} />
          <input name="name" defaultValue={w.name} required className="input" />
          <button className="btn-primary">Save</button>
        </form>
      </details>

      {user.role === "super_admin" && !w.active && !w.hidden && (
        <form action={hideWorker} className="card flex flex-col gap-2">
          <p className="text-sm text-zinc-600">Remove from the roster. Past checkouts keep the name; adding the same name again brings them back.</p>
          <input type="hidden" name="id" value={w.id} />
          <button className="btn text-red-700">Remove from roster</button>
        </form>
      )}
    </div>
  );
}
