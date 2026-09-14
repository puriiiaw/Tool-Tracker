export const CATEGORIES = [
  "Batteries",
  "Chargers",
  "Power Tools",
  "Safety Equipment",
  "Lasers & Layout",
  "Access Equipment",
] as const;
export type Category = (typeof CATEGORIES)[number];

// Name rules used at import and for backfill. Editable per tool afterwards.
export function categoryFor(name: string): Category {
  const n = name.toLowerCase();
  if (/\b(battery|batterie|b ?22|b ?12)\b/.test(n)) return "Batteries";
  if (/\b(charger|chargeur|c ?4|c ?8)\b/.test(n)) return "Chargers";
  if (/harness|fall arrest|fall protection|fall limiter|sling/.test(n)) return "Safety Equipment";
  if (/scissor|lift|tablet/.test(n)) return "Access Equipment";
  if (/laser|layout|niveau|\bpm\b|\bpr\b|\bpoa\b|\bpua\b|\bplt\b/.test(n)) return "Lasers & Layout";
  return "Power Tools";
}
