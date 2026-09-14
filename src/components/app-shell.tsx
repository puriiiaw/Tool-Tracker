"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  ChevronDown, Download, FileText, HardHat, Home, LogIn, MapPin,
  MoreHorizontal, Undo2, Users, Wrench, type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skyline } from "@/components/skyline";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: LucideIcon };

const NAV: Item[] = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/checkout", label: "Checkout", icon: LogIn },
  { href: "/returns", label: "Returns", icon: Undo2 },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/workers", label: "Workers", icon: HardHat },
  { href: "/log", label: "Log", icon: FileText },
];
const ADMIN: Item[] = [
  { href: "/import", label: "Import from ON!Track", icon: Download },
  { href: "/accounts", label: "Accounts", icon: Users },
];
const TABS = NAV.slice(0, 4);

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

export function AppShell({
  user,
  signOut,
  children,
}: {
  user: { name: string; role: string };
  signOut: ReactNode;
  children: ReactNode;
}) {
  const path = usePathname();
  const isSuper = user.role === "super_admin";
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <span className="grid size-10 place-items-center rounded-full bg-primary text-sm font-semibold text-white">{initials(user.name)}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="font-medium">{user.name}</div>
          <div className="text-xs font-normal text-muted-foreground">{isSuper ? "Super-admin" : "Admin"}</div>
        </DropdownMenuLabel>
        {isSuper && (
          <>
            <DropdownMenuSeparator />
            {ADMIN.map((i) => (
              <DropdownMenuItem key={i.href} asChild>
                <Link href={i.href}><i.icon className="size-4" /> {i.label}</Link>
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <div className="[&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:rounded-sm [&_button]:px-2 [&_button]:py-1.5 [&_button]:text-sm [&_button]:hover:bg-muted">
          {signOut}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="px-6 pb-5 pt-7">
          <HardHat className="size-10 text-amber-400" strokeWidth={2} />
          <div className="mt-2 text-xl font-semibold leading-tight text-white">Site Tool Tracker</div>
        </div>
        <nav className="flex flex-col gap-0.5 pr-3">
          {NAV.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={cn(
                "flex items-center gap-3.5 rounded-r-lg border-l-4 py-3 pl-6 pr-3 text-[15px] font-medium transition-colors",
                active(i.href)
                  ? "border-white bg-sidebar-accent text-white"
                  : "border-transparent text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-white"
              )}
            >
              <i.icon className="size-5 shrink-0" strokeWidth={2} />
              {i.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto px-6 pb-6">
          <div className="border-t border-sidebar-border pt-5 text-xs text-sidebar-foreground/70">EX-4002</div>
          <div className="mt-1 text-sm text-sidebar-foreground">QEII Halifax Infirmary Expansion</div>
          <Skyline className="mt-5 w-full text-sidebar-foreground/40" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop header */}
        <header className="relative hidden overflow-hidden border-b bg-card lg:block">
          <Skyline className="pointer-events-none absolute -right-6 top-0 h-full w-[46%] text-primary/10" />
          <div className="relative flex items-end justify-between px-8 py-6">
            <div>
              <h1 className="text-4xl font-bold text-navy">Site Tool Tracker</h1>
              <div className="mt-1 text-lg text-muted-foreground">
                EX-4002 <span className="mx-2">•</span> QEII Halifax Infirmary Expansion
              </div>
            </div>
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-4" /> Halifax, NS</div>
              <div className="h-8 w-px bg-border" />
              {userMenu}
            </div>
          </div>
        </header>

        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 bg-sidebar px-4 py-3 text-white lg:hidden">
          <HardHat className="size-7 text-amber-400" />
          <div className="text-lg font-semibold">Site Tool Tracker</div>
          <div className="ml-auto [&_span]:size-9 [&_span]:bg-white/15">{userMenu}</div>
        </header>

        <main className="min-w-0 flex-1 px-4 pb-24 pt-4 lg:px-8 lg:pb-10 lg:pt-6">{children}</main>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] lg:hidden">
        {TABS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", active(i.href) ? "text-white" : "text-sidebar-foreground/70")}
          >
            <i.icon className={cn("size-6", active(i.href) && "text-amber-400")} strokeWidth={2} />
            {i.label}
          </Link>
        ))}
        <Sheet>
          <SheetTrigger className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-sidebar-foreground/70">
            <MoreHorizontal className="size-6" strokeWidth={2} />
            More
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <SheetTitle className="text-xl">More</SheetTitle>
            <div className="flex flex-col gap-1">
              {[...NAV.slice(4), ...(isSuper ? ADMIN : [])].map((i) => (
                <Link key={i.href} href={i.href} className="flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium hover:bg-muted">
                  <i.icon className="size-5 text-primary" /> {i.label}
                </Link>
              ))}
              <div className="mt-2 border-t pt-2 [&_button]:w-full [&_button]:rounded-lg [&_button]:px-3 [&_button]:py-3 [&_button]:text-left [&_button]:text-base [&_button]:text-muted-foreground">
                {signOut}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
