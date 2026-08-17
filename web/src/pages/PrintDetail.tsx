import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchPrint, mediaUrl } from "../api/client";
import type { Print } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { ProgressBar } from "../components/ProgressBar";
import { formatDate, formatDuration, formatGrams } from "../utils/format";
import { materialRefFor } from "../data/materials";

// three.js is heavy (~1MB) — only the detail page needs it, and only when
// a print actually has an STL, so keep it out of the homepage's bundle.
const StlViewer = lazy(() => import("../components/StlViewer").then((m) => ({ default: m.StlViewer })));

const CATEGORY_LABEL: Record<string, string> = {
  print: "Impressão",
  issue: "Problema",
  maintenance: "Manutenção",
};

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
    const interval = setInterval(load, 10000);
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
  const allPhotos = [render, bedPhoto, ...photos].filter(Boolean) as string[];
  const materialRef = materialRefFor(print.material);
  const stlUrl = mediaUrl(print.stlKey);

  return (
    <div>
      <Link to="/" className="back-link">
        ← todas as impressões
      </Link>

      <div className="detail-header">
        <span className="eyebrow">{CATEGORY_LABEL[print.category ?? "print"]}</span>
        <StatusBadge status={print.status} />
        <h2 style={{ margin: 0, fontSize: 26 }}>{print.title}</h2>
        {print.description && <p style={{ color: "var(--text-muted)", margin: 0 }}>{print.description}</p>}
        {print.status === "printing" && <ProgressBar percent={print.progressPercent ?? 0} />}
      </div>

      {allPhotos.length > 0 && (
        <div className="detail-photos">
          {allPhotos.map((src) => (
            <img key={src} src={src} alt={print.title} loading="lazy" />
          ))}
        </div>
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
      </div>

      {stlUrl && (
        <>
          <span className="eyebrow" style={{ display: "block", marginBottom: 8 }}>
            modelo 3d
          </span>
          <Suspense fallback={<div className="stl-viewer" />}>
            <StlViewer url={stlUrl} />
          </Suspense>
        </>
      )}

      {(print.stlKey || print.gcodeKey) && (
        <div className="file-links">
          {print.stlKey && <a href={mediaUrl(print.stlKey)}>Baixar STL</a>}
          {print.gcodeKey && <a href={mediaUrl(print.gcodeKey)}>Baixar G-code</a>}
        </div>
      )}

      {materialRef && (
        <div className="materials-section" style={{ marginTop: 32 }}>
          <h2>Material usado</h2>
          <div className="material-card">
            <div className="name">{materialRef.name}</div>
            <div className="desc">{materialRef.description}</div>
            <a href={materialRef.buyUrl} target="_blank" rel="noreferrer">
              onde comprar ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
