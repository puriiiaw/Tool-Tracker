"use client";

// The phone's outbox: checkouts and returns wait here (IndexedDB) until the server confirms them.
import { useEffect, useState } from "react";
import { applyQueued } from "@/app/(app)/sync/actions";
import type { QItem } from "@/lib/sync";

export type Queued = QItem & { seq?: number };

const open = () =>
  new Promise<IDBDatabase>((ok, fail) => {
    const r = indexedDB.open("tracker", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("queue", { keyPath: "seq", autoIncrement: true });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
const tx = async <T,>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>) => {
  const d = await open();
  return new Promise<T>((ok, fail) => {
    const r = f(d.transaction("queue", mode).objectStore("queue"));
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
};
const changed = () => window.dispatchEvent(new Event("queue-changed"));

export const pending = () => tx<Queued[]>("readonly", (s) => s.getAll());
export async function enqueue(item: QItem) {
  await tx("readwrite", (s) => s.add(item));
  changed();
}

export type Flush = { sent: number; left: number; messages: string[]; auth: boolean };
let running: Promise<Flush> | null = null;
// One flush at a time per tab; two tabs racing are safe because the server knows each item id.
export const flush = () => (running ??= run().finally(() => (running = null)));

async function run(): Promise<Flush> {
  const out: Flush = { sent: 0, left: 0, messages: [], auth: false };
  for (const it of await pending().catch(() => [])) {
    try {
      // If a timed-out request did land, the item id makes the retry harmless.
      const r = await within(applyQueued(it), 20000);
      if ("auth" in r) {
        out.auth = true;
        break;
      }
      await tx("readwrite", (s) => s.delete(it.seq!)); // sent items leave the phone's outbox; the server keeps the record
      out.sent++;
      if ("bad" in r) out.messages.push(r.bad);
      else out.messages.push(...r.messages);
    } catch {
      break;
    }
  }
  out.left = (await pending().catch(() => [])).length;
  try {
    localStorage.setItem("queue-last-try", String(Date.now()));
  } catch {}
  changed();
  return out;
}

export function useQueued() {
  const [items, set] = useState<Queued[]>([]);
  useEffect(() => {
    const load = () => pending().then(set, () => {});
    load();
    window.addEventListener("queue-changed", load);
    return () => window.removeEventListener("queue-changed", load);
  }, []);
  return items;
}

export const newId = () => crypto.randomUUID();

// A request that hangs on a weak signal counts as no signal after `ms`.
export const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);
