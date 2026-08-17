import { useEffect, useMemo, useState } from "react";
import { fetchPrints } from "../api/client";
import type { EntryCategory, Print } from "../types";
import { AboutStrip } from "../components/AboutStrip";
import { StatsStrip } from "../components/StatsStrip";
import { TimelineEntry } from "../components/TimelineEntry";
import { MaterialsSection } from "../components/MaterialsSection";

const TABS: { id: EntryCategory | "all"; label: string }[] = [
  { id: "all", label: "Tudo" },
  { id: "print", label: "Impressão" },
  { id: "issue", label: "Problemas" },
  { id: "maintenance", label: "Manutenção" },
];

export function Home() {
  const [prints, setPrints] = useState<Print[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<EntryCategory | "all">("all");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const items = await fetchPrints();
        if (!cancelled) setPrints(items);
      } catch {
        if (!cancelled) setError("Não deu pra carregar o histórico agora.");
      }
    }

    load();
    const interval = setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!prints) return null;
    if (tab === "all") return prints;
    return prints.filter((p) => (p.category ?? "print") === tab);
  }, [prints, tab]);

  return (
    <div>
      <AboutStrip />

      {prints && <StatsStrip prints={prints} />}

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="empty-state">{error}</div>}
      {!error && filtered === null && <div className="empty-state">carregando…</div>}
      {!error && filtered !== null && filtered.length === 0 && (
        <div className="empty-state">nada por aqui ainda.</div>
      )}
      {!error && filtered && filtered.length > 0 && (
        <div className="timeline">
          {filtered.map((p, i) => (
            <TimelineEntry key={p.id} print={p} index={i} />
          ))}
        </div>
      )}

      <MaterialsSection />
    </div>
  );
}
