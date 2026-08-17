export function formatDuration(seconds?: number | null): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}min`;
  return `${h}h${m.toString().padStart(2, "0")}min`;
}

export function formatDate(value?: string | number | null): string {
  if (!value) return "—";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatGrams(grams?: number | null): string {
  if (!grams) return "—";
  return `${grams}g`;
}
