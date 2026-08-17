import type { Print } from "../types";

function formatHours(totalSeconds: number): string {
  const hours = totalSeconds / 3600;
  if (hours < 1) return `${Math.round(totalSeconds / 60)}min`;
  return `${hours.toFixed(1)}h`;
}

export function StatsStrip({ prints }: { prints: Print[] }) {
  const completed = prints.filter((p) => p.status === "completed");
  const totalSeconds = completed.reduce((sum, p) => sum + (p.durationSeconds ?? 0), 0);
  const totalGrams = prints.reduce((sum, p) => sum + (p.filamentGrams ?? 0), 0);
  const activeNow = prints.filter((p) => p.status === "printing").length;

  const stats = [
    { label: "Peças impressas", value: completed.length },
    { label: "Tempo total", value: formatHours(totalSeconds) },
    { label: "Filamento usado", value: `${(totalGrams / 1000).toFixed(2)}kg` },
    { label: "Agora", value: activeNow > 0 ? "imprimindo" : "parada" },
  ];

  return (
    <div className="stat-strip">
      {stats.map((s) => (
        <div className="stat" key={s.label}>
          <div className="stat-label">{s.label}</div>
          <div className="stat-value">{s.value}</div>
        </div>
      ))}
    </div>
  );
}
