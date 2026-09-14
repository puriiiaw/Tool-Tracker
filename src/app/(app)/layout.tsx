import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-white px-3 py-2 text-sm">
        <Link href="/" className="font-bold">
          Tools
        </Link>
        <nav className="flex gap-1 overflow-x-auto whitespace-nowrap">
          <Link href="/checkout" className="nav">
            Checkout
          </Link>
          <Link href="/log" className="nav">
            Log
          </Link>
          <Link href="/tools" className="nav">
            Inventory
          </Link>
          <Link href="/workers" className="nav">
            Workers
          </Link>
          {user.role === "super_admin" && (
            <Link href="/accounts" className="nav">
              Accounts
            </Link>
          )}
        </nav>
        <form action={logout} className="ml-auto">
          <button className="nav text-zinc-500" title={user.email}>
            Sign out
          </button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-2xl p-3">{children}</main>
    </>
  );
}
