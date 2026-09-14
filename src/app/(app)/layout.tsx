import { requireUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <AppShell
      user={{ name: user.name, role: user.role }}
      signOut={
        <form action={logout}>
          <button title={user.email}>Sign out</button>
        </form>
      }
    >
      {children}
    </AppShell>
  );
}
