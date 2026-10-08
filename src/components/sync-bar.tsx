"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { flush, useQueued } from "@/lib/queue";
import { cn } from "@/lib/utils";

const HOUR = 3600_000;
const time = (ms: number) => new Date(ms).toLocaleTimeString("en-CA", { timeZone: "America/Halifax", hour: "numeric", minute: "2-digit" });
const PAGES = ["/", "/checkout", "/returns"]; // what the service worker keeps for offline opening; keep in sync with public/sw.js

// Fetch the offline pages and the scripts they need now, while there is signal.
async function prime() {
  if (sessionStorage.getItem("primed")) return;
  for (const p of PAGES) {
    const html = await (await fetch(p, { headers: { accept: "text/html" } })).text();
    for (const m of html.matchAll(/static\/(?:chunks|css|media)\/[\w.~%/-]+?\.(?:js|css|woff2)/g)) fetch("/_next/" + m[0]).catch(() => {});
  }
  import("zxing-wasm/reader").catch(() => {});
  fetch("/zxing_reader.wasm").catch(() => {});
  sessionStorage.setItem("primed", "1");
}

// Always-on status: what is waiting to send, whether the tool list is stale, what needs an admin.
export function SyncBar({ dataAt, attention }: { dataAt: string; attention: number }) {
  const router = useRouter();
  const items = useQueued();
  const [online, setOnline] = useState(true);
  const [auth, setAuth] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const [installed, setInstalled] = useState(true);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const send = () =>
      flush().then((r) => {
        setAuth(r.auth);
        if (r.sent && !r.left) {
          setSentAt(1);
          setTimeout(() => setSentAt(0), 4000);
        }
        if (r.sent) router.refresh(); // stock changed
      });
    const up = () => {
      setOnline(true);
      send();
    };
    const down = () => setOnline(false);
    setOnline(navigator.onLine);
    setInstalled(matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true || !/Android|iPhone|iPad/.test(navigator.userAgent));
    addEventListener("online", up);
    addEventListener("offline", down);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(() => { if (navigator.onLine) prime(); }).catch(() => {});
      navigator.storage?.persist?.(); // asks the phone not to clear our saved data
    }
    send();
    const tick = setInterval(() => {
      setNow(Date.now());
      if (!navigator.onLine) return;
      send();
    }, 30_000);
    // Fresh tool list every 5 minutes while the app is open and online.
    const refresh = setInterval(() => navigator.onLine && document.visibilityState === "visible" && router.refresh(), 300_000);
    setNow(Date.now());
    return () => {
      removeEventListener("online", up);
      removeEventListener("offline", down);
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [router]);

  const age = now - new Date(dataAt).getTime();
  const oldest = items.length ? now - Math.min(...items.map((i) => new Date(i.at).getTime())) : 0;
  const lastTry = Number(typeof localStorage === "undefined" ? 0 : localStorage.getItem("queue-last-try")) || 0;
  const tone = "rounded-lg px-3 py-2 text-sm font-medium";
  const rows: { key: string; cls: string; body: React.ReactNode }[] = [];

  if (items.length)
    rows.push({
      key: "q",
      cls: oldest > 24 * HOUR ? "bg-red-100 text-red-900" : "bg-amber-100 text-amber-900",
      body: (
        <span className="flex items-center justify-between gap-3">
          <span>
            {items.length} waiting to send{lastTry ? ` · last tried ${time(lastTry)}` : ""}
            {oldest > 24 * HOUR && " · over a day old, get signal soon"}
          </span>
          <button className="btn shrink-0" onClick={() => flush().then((r) => setAuth(r.auth))}>Send now</button>
        </span>
      ),
    });
  if (auth)
    rows.push({ key: "a", cls: "bg-red-100 text-red-900", body: <Link href="/login" className="underline">Signed out. Sign in again to send what is waiting.</Link> });
  if (!online)
    rows.push({
      key: "o",
      cls: age > 24 * HOUR ? "bg-red-100 text-red-900" : age > 4 * HOUR ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-800",
      body: `Offline. Tool list from ${time(new Date(dataAt).getTime())}${age > 4 * HOUR ? " (old, check with the worker)" : ""}.`,
    });
  if (attention > 0)
    rows.push({ key: "n", cls: "bg-red-100 text-red-900", body: <Link href="/" className="underline">{attention} sent item{attention === 1 ? " needs" : "s need"} an admin&apos;s attention</Link> });
  if (!installed && (items.length || !online))
    rows.push({ key: "i", cls: "bg-amber-100 text-amber-900", body: "Add this app to your Home Screen, or the phone may erase what is waiting to send." });
  if (!rows.length && sentAt)
    rows.push({ key: "g", cls: "bg-green-100 text-green-900", body: "All sent." });

  if (!rows.length) return null;
  return (
    <div className="sticky top-[3.25rem] z-10 -mx-4 mb-3 flex flex-col gap-1 bg-background/95 px-4 pb-1 pt-1 lg:top-0 lg:mx-0 lg:px-0">
      {rows.map((r) => (
        <div key={r.key} className={cn(tone, r.cls)}>{r.body}</div>
      ))}
    </div>
  );
}
