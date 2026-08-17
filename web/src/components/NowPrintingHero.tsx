import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import type { Print } from "../types";
import { mediaUrl } from "../api/client";
import { ProgressBar } from "./ProgressBar";
import { ErrorBoundary } from "./ErrorBoundary";
import { formatGrams } from "../utils/format";

const StlViewer = lazy(() => import("./StlViewer").then((m) => ({ default: m.StlViewer })));

function elapsedLabel(startedAt?: string | null): string {
  if (!startedAt) return "";
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return "";
  const mins = Math.max(0, Math.round((Date.now() - started) / 60000));
  if (mins < 1) return "começou agora";
  if (mins < 60) return `há ${mins}min`;
  return `há ${Math.floor(mins / 60)}h${(mins % 60).toString().padStart(2, "0")}min`;
}

export function NowPrintingHero({ print }: { print: Print }) {
  // While it's actually printing, real webcam proof beats a synthetic
  // render — show the most recent snapshot first. Falls back to the
  // interactive model, then any static image, if no live photo exists yet.
  const livePhoto = mediaUrl(print.photos?.[print.photos.length - 1]);
  const stlUrl = mediaUrl(print.stlKey);
  const staticThumb = mediaUrl(print.renderKey) ?? mediaUrl(print.bedPhotoKey);

  return (
    <Link to={`/impressoes/${print.id}`} className="now-printing">
      <div className="now-printing-visual">
        {livePhoto ? (
          <>
            <img src={livePhoto} alt={print.title} />
            <span className="now-printing-photo-tag">📷 ao vivo</span>
          </>
        ) : stlUrl ? (
          <ErrorBoundary fallback={staticThumb ? <img src={staticThumb} alt={print.title} /> : <div />}>
            <Suspense fallback={<div className="now-printing-visual-loading" />}>
              <StlViewer url={stlUrl} interactive={false} className="now-printing-canvas" />
            </Suspense>
          </ErrorBoundary>
        ) : (
          staticThumb && <img src={staticThumb} alt={print.title} />
        )}
      </div>
      <div className="now-printing-body">
        <span className="now-printing-live">
          <span className="live-dot" /> imprimindo agora
        </span>
        <h2>{print.title}</h2>
        <ProgressBar percent={print.progressPercent ?? 0} />
        <div className="now-printing-meta">
          <span>{Math.round(print.progressPercent ?? 0)}%</span>
          <span>·</span>
          <span>{elapsedLabel(print.startedAt)}</span>
          {print.material && (
            <>
              <span>·</span>
              <span>{print.material}</span>
            </>
          )}
          {print.filamentGrams ? (
            <>
              <span>·</span>
              <span>{formatGrams(print.filamentGrams)}</span>
            </>
          ) : null}
        </div>
        {print.nozzleTemp != null && (
          <div className="now-printing-temps">
            <span>🔥 {print.nozzleTemp.toFixed(0)}°C / {(print.nozzleTarget ?? 0).toFixed(0)}°C</span>
            <span>🛏️ {print.bedTemp?.toFixed(0)}°C / {(print.bedTarget ?? 0).toFixed(0)}°C</span>
          </div>
        )}
      </div>
    </Link>
  );
}
