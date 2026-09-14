"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronsLeft, ChevronsRight, ClipboardList, Download, HardHat, LayoutDashboard,
  MoreHorizontal, PlusSquare, Users, Wrench, type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: LucideIcon; accent?: boolean; superOnly?: boolean };

const MAIN: Item[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/checkout", label: "New checkout", icon: PlusSquare, accent: true },
  { href: "/log", label: "Log", icon: ClipboardList },
  { href: "/tools", label: "Inventory", icon: Wrench },
  { href: "/workers", label: "Workers", icon: HardHat },
];
const ADMIN: Item[] = [
  { href: "/import", label: "Import", icon: Download, superOnly: true },
  { href: "/accounts", label: "Accounts", icon: Users, superOnly: true },
];
const TABS = MAIN.slice(0, 4);

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
  const [collapsed, setCollapsed] = useState(false);
  const isSuper = user.role === "super_admin";
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a per-device preference after hydration
      setCollapsed(localStorage.getItem("sidebar") === "collapsed");
    } catch {}
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem("sidebar", c ? "open" : "collapsed"); } catch {}
      return !c;
    });
  };

  const NavLink = ({ item, compact }: { item: Item; compact?: boolean }) => (
    <Link
      href={item.href}
      title={item.label}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-medium transition-colors",
        active(item.href)
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        item.accent && !active(item.href) && "text-primary",
        item.accent && active(item.href) && "bg-primary text-primary-foreground",
        compact && "justify-center px-0"
      )}
    >
      <item.icon className="size-5 shrink-0" strokeWidth={2.2} />
      {!compact && <span className="truncate">{item.label}</span>}
    </Link>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <div className="hazard h-1.5" />
        <div className={cn("flex items-center gap-3 px-4 py-4", collapsed && "justify-center px-0")}>
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary font-heading text-xl font-bold text-primary-foreground">
            T
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-heading text-lg font-semibold leading-tight text-white">Tool Tracker</div>
              <div className="truncate text-xs text-sidebar-foreground/60">EX-4002 Halifax</div>
            </div>
          )}
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {MAIN.map((i) => <NavLink key={i.href} item={i} compact={collapsed} />)}
          {isSuper && (
            <>
              <div className="my-2 border-t border-sidebar-border" />
              {ADMIN.map((i) => <NavLink key={i.href} item={i} compact={collapsed} />)}
            </>
          )}
        </nav>
        <div className={cn("flex items-center gap-2 border-t border-sidebar-border p-2", collapsed && "flex-col")}>
          {!collapsed && (
            <div className="min-w-0 flex-1 px-2">
              <div className="truncate text-sm font-medium text-white">{user.name}</div>
              <div className="text-xs text-sidebar-foreground/60">{isSuper ? "Super-admin" : "Admin"}</div>
            </div>
          )}
          <div className="[&_button]:rounded-md [&_button]:px-2 [&_button]:py-2 [&_button]:text-sm [&_button]:text-sidebar-foreground/70 [&_button]:hover:bg-sidebar-accent">
            {signOut}
          </div>
          <button onClick={toggle} className="rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent" aria-label="Toggle sidebar">
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-sidebar px-4 py-3 text-white lg:hidden">
        <div className="grid size-8 place-items-center rounded-md bg-primary font-heading text-lg font-bold text-primary-foreground">T</div>
        <div className="font-heading text-lg font-semibold">Tool Tracker</div>
        <div className="ml-auto text-xs text-sidebar-foreground/70">{user.name}</div>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-24 pt-4 lg:px-8 lg:pb-8 lg:pt-6">{children}</main>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] lg:hidden">
        {TABS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              active(i.href) ? "text-primary" : "text-sidebar-foreground/70",
              i.accent && "text-primary"
            )}
          >
            <i.icon className={cn("size-6", i.accent && "rounded-md bg-primary p-0.5 text-primary-foreground")} strokeWidth={2.2} />
            {i.label === "New checkout" ? "Checkout" : i.label}
          </Link>
        ))}
        <Sheet>
          <SheetTrigger className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-sidebar-foreground/70">
            <MoreHorizontal className="size-6" strokeWidth={2.2} />
            More
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <SheetTitle className="font-heading text-xl">More</SheetTitle>
            <div className="flex flex-col gap-1">
              {[MAIN[4], ...(isSuper ? ADMIN : [])].map((i) => (
                <Link key={i.href} href={i.href} className="flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium hover:bg-muted">
                  <i.icon className="size-5" /> {i.label}
                </Link>
              ))}
              <div className="mt-2 border-t pt-2 [&_button]:w-full [&_button]:rounded-md [&_button]:px-3 [&_button]:py-3 [&_button]:text-left [&_button]:text-base [&_button]:text-muted-foreground">
                {signOut}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
