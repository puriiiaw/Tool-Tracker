import { notFound } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { listCheckouts } from "@/lib/checkouts";
import { CheckoutList } from "@/components/checkout-list";
import { updateWorker } from "../actions";

export default async function WorkerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { msg } = await searchParams;
  const w = db.prepare("SELECT id, name, active FROM worker WHERE id = ?").get(Number(id)) as
    | { id: number; name: string; active: number }
    | undefined;
  if (!w) notFound();
  const out = listCheckouts({ worker: w.id, status: "open" });
  const history = listCheckouts({ worker: w.id, status: "all" });

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-bold">{w.name}</h1>
      {msg && <p className="rounded bg-amber-50 p-2 text-sm">{msg}</p>}

      <h2 className="font-semibold">Out now</h2>
      <CheckoutList rows={out} empty="Nothing out." />

      <h2 className="font-semibold">History</h2>
      <CheckoutList rows={history} empty="No checkouts yet." />

      <details className="card">
        <summary className="cursor-pointer py-2 text-sm text-zinc-600">Edit worker</summary>
        <form action={updateWorker} className="flex flex-col gap-2 pt-2">
          <input type="hidden" name="id" value={w.id} />
          <input name="name" defaultValue={w.name} required className="input" />
          <select name="active" defaultValue={w.active} className="input">
            <option value={1}>Active</option>
            <option value={0}>Inactive (hidden from checkout)</option>
          </select>
          <button className="btn-primary">Save</button>
        </form>
      </details>
    </div>
  );
}
