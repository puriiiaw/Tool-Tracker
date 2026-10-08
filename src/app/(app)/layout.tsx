import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { AppShell } from "@/components/app-shell";
import { SyncBar } from "@/components/sync-bar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const attention = db.prepare("SELECT COUNT(*) FROM attention WHERE resolution IS NULL").pluck().get() as number;
  return (
    <AppShell
      user={{ name: user.name, role: user.role }}
      signOut={
        <form action={logout}>
          <button title={user.email}>Sign out</button>
        </form>
      }
    >
      {/* dataAt: when this page's data was read; an offline copy of the page keeps its old time */}
      <SyncBar dataAt={new Date().toISOString()} attention={attention} />
      {children}
    </AppShell>
  );
}
