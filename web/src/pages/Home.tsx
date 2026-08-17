import { useEffect, useState } from "react";
import { fetchPrints } from "../api/client";
import type { Print } from "../types";
import { PrintCard } from "../components/PrintCard";

export function Home() {
  const [prints, setPrints] = useState<Print[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const items = await fetchPrints();
        if (!cancelled) setPrints(items);
      } catch {
        if (!cancelled) setError("Não deu pra carregar as impressões agora.");
      }
    }

    load();
    const interval = setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (error) return <div className="empty-state">{error}</div>;
  if (prints === null) return <div className="empty-state">Carregando…</div>;
  if (prints.length === 0) return <div className="empty-state">Nenhuma impressão publicada ainda.</div>;

  return (
    <div className="grid">
      {prints.map((p) => (
        <PrintCard key={p.id} print={p} />
      ))}
    </div>
  );
}
