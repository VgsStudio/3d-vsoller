import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchPrint, mediaUrl } from "../api/client";
import type { Print } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { ProgressBar } from "../components/ProgressBar";
import { formatDate, formatDuration, formatGrams } from "../utils/format";
import { materialRefFor } from "../data/materials";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { MaterialCard } from "../components/MaterialCard";

// three.js is heavy (~1MB) — only the detail page needs it, and only when
// a print actually has an STL, so keep it out of the homepage's bundle.
const StlViewer = lazy(() => import("../components/StlViewer").then((m) => ({ default: m.StlViewer })));

const CATEGORY_LABEL: Record<string, string> = {
  print: "🖨️ Impressão",
  issue: "⚠️ Problema",
  maintenance: "🔨 Manutenção",
};

// Keep the photo strip to a handful of representative shots instead of
// dumping every ~60s webcam snapshot from a long print — pick `max` evenly
// spaced across the sequence (always keeping the first and last).
function sampleMax<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = (items.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => items[Math.round(i * step)]);
}

export function PrintDetail() {
  const { id } = useParams<{ id: string }>();
  const [print, setPrint] = useState<Print | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        const item = await fetchPrint(id!);
        if (!cancelled) setPrint(item);
      } catch {
        if (!cancelled) setNotFound(true);
      }
    }

    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  if (notFound) return <div className="empty-state">Impressão não encontrada.</div>;
  if (!print) return <div className="empty-state">Carregando…</div>;

  const render = mediaUrl(print.renderKey);
  const bedPhoto = mediaUrl(print.bedPhotoKey);
  const photos = (print.photos ?? []).map((key) => mediaUrl(key)).filter(Boolean) as string[];
  const allPhotos = sampleMax([render, bedPhoto, ...photos].filter(Boolean) as string[], 6);
  const materialRef = materialRefFor(print.material);
  const stlUrl = mediaUrl(print.stlKey);

  return (
    <div>
      <Link to="/" className="back-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        todas as impressões
      </Link>

      <div className="detail-header">
        <span className="eyebrow">{CATEGORY_LABEL[print.category ?? "print"]}</span>
        <StatusBadge status={print.status} />
        <h2 style={{ margin: 0, fontSize: 26 }}>{print.title}</h2>
        {print.description && <p style={{ color: "var(--text-muted)", margin: 0 }}>{print.description}</p>}
        {print.status === "printing" && <ProgressBar percent={print.progressPercent ?? 0} />}
      </div>

      {stlUrl && (
        <>
          <span className="eyebrow" style={{ display: "block", marginBottom: 8 }}>
            modelo 3d
          </span>
          <ErrorBoundary fallback={<div className="stl-viewer empty-state">não deu pra carregar o visualizador 3d agora — usa o download do STL.</div>}>
            <Suspense fallback={<div className="stl-viewer" />}>
              <StlViewer url={stlUrl} />
            </Suspense>
          </ErrorBoundary>
        </>
      )}

      <div className="stat-grid">
        <div className="stat-item">
          <div className="label">Material</div>
          <div className="value">{print.material || "—"}</div>
        </div>
        <div className="stat-item">
          <div className="label">Filamento</div>
          <div className="value">{formatGrams(print.filamentGrams)}</div>
        </div>
        <div className="stat-item">
          <div className="label">Duração</div>
          <div className="value">{formatDuration(print.durationSeconds)}</div>
        </div>
        <div className="stat-item">
          <div className="label">Data</div>
          <div className="value">{formatDate(print.finishedAt ?? print.startedAt ?? print.createdAt)}</div>
        </div>
        <div className="stat-item">
          <div className="label">Impressora</div>
          <div className="value">{print.printer || "—"}</div>
        </div>
        {print.dimensions && (
          <div className="stat-item">
            <div className="label">Medidas</div>
            <div className="value">{print.dimensions}</div>
          </div>
        )}
      </div>

      {(print.stlKey || print.gcodeKey) && (
        <div className="file-links">
          {print.stlKey && <a href={mediaUrl(print.stlKey)}>Baixar STL</a>}
          {print.gcodeKey && <a href={mediaUrl(print.gcodeKey)}>Baixar G-code</a>}
        </div>
      )}

      {materialRef && (
        <div style={{ marginTop: 32 }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: 12 }}>
            material usado
          </span>
          <div className="materials-grid" style={{ paddingBottom: 0, gridTemplateColumns: "minmax(240px, 320px)" }}>
            <MaterialCard material={materialRef} />
          </div>
        </div>
      )}

      {allPhotos.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <span className="eyebrow" style={{ display: "block", marginBottom: 12 }}>
            fotos
          </span>
          <div className="detail-photos">
            {allPhotos.map((src) => (
              <img key={src} src={src} alt={print.title} loading="lazy" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
