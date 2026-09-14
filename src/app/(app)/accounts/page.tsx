import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { createAccount, setActive, setPassword } from "./actions";

type Row = { id: number; email: string; name: string; role: string; active: number };

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const me = await requireUser("super_admin");
  const { msg } = await searchParams;
  const users = db.prepare("SELECT id, email, name, role, active FROM user ORDER BY name").all() as Row[];
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Accounts</h1>
      {msg && <p className="rounded bg-amber-50 p-2 text-sm">{msg}</p>}

      <form action={createAccount} className="card flex flex-col gap-2">
        <h2 className="font-semibold">New account</h2>
        <input name="name" placeholder="Name" required className="input" />
        <input name="email" placeholder="Email" required className="input" autoComplete="off" />
        <input name="password" type="password" placeholder="Password (6+ characters)" required className="input" autoComplete="new-password" />
        <select name="role" className="input">
          <option value="admin">Admin (foreman)</option>
          <option value="super_admin">Super-admin</option>
        </select>
        <button className="btn-primary">Create</button>
      </form>

      <ul className="flex flex-col gap-2">
        {users.map((u) => (
          <li key={u.id} className={`card flex flex-col gap-2 ${u.active ? "" : "opacity-60"}`}>
            <div>
              <span className="font-semibold">{u.name}</span>{" "}
              <span className="text-sm text-zinc-500">
                {u.email} · {u.role === "super_admin" ? "super-admin" : "admin"}
                {u.active ? "" : " · disabled"}
              </span>
            </div>
            <form action={setPassword} className="flex gap-2">
              <input type="hidden" name="id" value={u.id} />
              <input name="password" type="password" placeholder="New password" required className="input flex-1" autoComplete="new-password" />
              <button className="btn">Set</button>
            </form>
            {u.id !== me.id && (
              <form action={setActive}>
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="active" value={u.active ? "0" : "1"} />
                <button className="btn w-full">{u.active ? "Disable" : "Enable"}</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
