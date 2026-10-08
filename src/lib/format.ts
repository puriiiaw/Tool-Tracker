const TZ = "America/Halifax";

// SQLite stores UTC 'YYYY-MM-DD HH:MM:SS'; show it in Halifax time.
export function fmtTime(sqlite: string) {
  return new Date(sqlite.replace(" ", "T") + "Z").toLocaleString("en-CA", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// For <input type="datetime-local">: 'YYYY-MM-DDTHH:MM' in Halifax time.
export function toHalifaxInput(sqlite: string) {
  const d = new Date(sqlite.replace(" ", "T") + "Z");
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

// Halifax local 'YYYY-MM-DDTHH:MM' -> SQLite UTC. Tries ADT (-3) then AST (-4).
export function halifaxToSqlite(local: string) {
  for (const off of ["-03:00", "-04:00"]) {
    const d = new Date(`${local}:00${off}`);
    if (!isNaN(d.getTime()) && toHalifaxInput(d.toISOString().slice(0, 19).replace("T", " ")) === local) {
      return d.toISOString().slice(0, 19).replace("T", " ");
    }
  }
  return null;
}

// Age of a checkout as "3d 4h" / "45m", plus a severity for colouring.
export function ageOf(sqlite: string, now = Date.now()) {
  const ms = now - new Date(sqlite.replace(" ", "T") + "Z").getTime();
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  const label = d >= 1 ? `${d}d ${h % 24}h` : h >= 1 ? `${h}h` : `${Math.max(1, Math.floor(ms / 60000))}m`;
  const level: "ok" | "warn" | "bad" = d >= 30 ? "bad" : d >= 7 ? "warn" : "ok";
  return { label, level, days: d };
}

// "Serial 123 · Code 987"; a tool with only one of them shows only that one.
export const ids = (serial: string | null | undefined, code: string | null | undefined) =>
  [serial && `Serial ${serial}`, code && `Code ${code}`].filter(Boolean).join(" · ");
