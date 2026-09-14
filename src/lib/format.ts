// SQLite stores UTC 'YYYY-MM-DD HH:MM:SS'; show it in Halifax time.
export function fmtTime(sqlite: string) {
  return new Date(sqlite.replace(" ", "T") + "Z").toLocaleString("en-CA", {
    timeZone: "America/Halifax",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
