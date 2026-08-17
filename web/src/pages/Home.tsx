import { useEffect, useMemo, useState } from "react";
import { fetchPrints } from "../api/client";
import type { EntryCategory, Print } from "../types";
import { AboutStrip } from "../components/AboutStrip";
import { StatsStrip } from "../components/StatsStrip";
import { TimelineEntry } from "../components/TimelineEntry";
import { MaterialsSection } from "../components/MaterialsSection";

type TabId = EntryCategory | "all" | "materials";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "Tudo" },
  { id: "print", label: "Impressão" },
  { id: "issue", label: "Problemas" },
  { id: "maintenance", label: "Manutenção" },
  { id: "materials", label: "Materiais" },
];

export function Home() {
  const [prints, setPrints] = useState<Print[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("print");

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

  useEffect(() => {
    const active = prints?.some((p) => p.status === "printing");
    document.title = active ? "🖨️ imprimindo… · 3D Vitor Soller" : "3D · Vitor Soller";
  }, [prints]);

  const filtered = useMemo(() => {
    if (!prints) return null;
    if (tab === "all" || tab === "materials") return prints;
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

      {tab === "materials" ? (
        <MaterialsSection />
      ) : (
        <>
          {error && <div className="empty-state">{error}</div>}
          {!error && filtered === null && <div className="empty-state">carregando…</div>}
          {!error && filtered !== null && filtered.length === 0 && (
            <div className="empty-state">nada por aqui ainda.</div>
          )}
          {!error && filtered && filtered.length > 0 && (
            <>
              <div className="timeline">
                {filtered.map((p, i) => (
                  <TimelineEntry key={p.id} print={p} index={i} />
                ))}
              </div>
              <div className="timeline-end">
                <p>🎉 Parabéns, você chegou no final do histórico!</p>
                <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>voltar pro início ↑</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
