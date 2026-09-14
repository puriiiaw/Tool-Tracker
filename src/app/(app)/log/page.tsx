import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { listCheckouts, type Filters } from "@/lib/checkouts";
import { CheckoutList } from "@/components/checkout-list";

type Params = { status?: string; worker?: string; tool?: string; admin?: string; from?: string; to?: string; msg?: string };

export default async function LogPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireUser();
  const p = await searchParams;
  const f: Filters = {
    status: p.status === "all" || p.status === "closed" ? p.status : "open",
    worker: Number(p.worker) || undefined,
    tool: Number(p.tool) || undefined,
    admin: Number(p.admin) || undefined,
    from: p.from || undefined,
    to: p.to || undefined,
  };
  const rows = listCheckouts(f);
  const workers = db.prepare("SELECT id, name FROM worker ORDER BY name").all() as { id: number; name: string }[];
  const tools = db.prepare("SELECT id, name FROM tool ORDER BY name").all() as { id: number; name: string }[];
  const admins = db.prepare("SELECT id, name FROM user ORDER BY name").all() as { id: number; name: string }[];
  const extra = f.worker || f.tool || f.admin || f.from || f.to;

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-bold">Log</h1>
      {p.msg && <p className="rounded bg-green-50 p-2 text-sm text-green-800">{p.msg}</p>}

      <form className="card flex flex-col gap-2">
        <div className="flex gap-2">
          <select name="status" defaultValue={f.status} className="input">
            <option value="open">Not fully returned</option>
            <option value="all">All</option>
            <option value="closed">Closed</option>
          </select>
          <button className="btn">Apply</button>
        </div>
        <details open={!!extra}>
          <summary className="cursor-pointer py-2 text-sm text-zinc-600">More filters</summary>
          <div className="flex flex-col gap-2">
            <select name="worker" defaultValue={f.worker ?? ""} className="input">
              <option value="">Any worker</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <select name="tool" defaultValue={f.tool ?? ""} className="input">
              <option value="">Any tool</option>
              {tools.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select name="admin" defaultValue={f.admin ?? ""} className="input">
              <option value="">Any admin</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input type="date" name="from" defaultValue={f.from} className="input" />
              <input type="date" name="to" defaultValue={f.to} className="input" />
            </div>
          </div>
        </details>
      </form>

      <p className="text-sm text-zinc-500">{rows.length} checkout{rows.length === 1 ? "" : "s"}</p>
      <CheckoutList rows={rows} empty="No checkouts match." />
    </div>
  );
}
