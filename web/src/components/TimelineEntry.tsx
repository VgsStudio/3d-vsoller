import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { Print } from "../types";
import { mediaUrl } from "../api/client";
import { StatusBadge, dotClassFor } from "./StatusBadge";
import { ProgressBar } from "./ProgressBar";
import { ErrorBoundary } from "./ErrorBoundary";
import { formatDate, formatDuration, formatGrams } from "../utils/format";

const StlViewer = lazy(() => import("./StlViewer").then((m) => ({ default: m.StlViewer })));

const CATEGORY_LABEL: Record<string, string> = {
  print: "Impressão",
  issue: "Problema",
  maintenance: "Manutenção",
};

export function TimelineEntry({ print, index }: { print: Print; index: number }) {
  const category = print.category ?? "print";
  const stlUrl = mediaUrl(print.stlKey);
  const staticThumb = mediaUrl(print.renderKey) ?? mediaUrl(print.bedPhotoKey) ?? mediaUrl(print.photos?.[0]);
  const when = print.finishedAt ?? print.startedAt ?? print.createdAt;

  return (
    <motion.div
      className="timeline-entry"
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay: Math.min(index, 6) * 0.03 }}
    >
      <span className={`timeline-dot dot-${dotClassFor(print.status)}`} />
      <Link to={`/impressoes/${print.id}`} className="timeline-card" style={{ display: "block" }}>
        <div className="timeline-top">
          <span className="timeline-date">
            {CATEGORY_LABEL[category] ?? category} · {formatDate(when)}
          </span>
          <StatusBadge status={print.status} />
        </div>
        <h3 className="timeline-title">{print.title}</h3>
        {print.status === "printing" && <ProgressBar percent={print.progressPercent ?? 0} />}
        {print.description && <p className="timeline-desc">{print.description}</p>}
        {category === "print" ? (
          <div className="timeline-meta">
            {print.material && <span><b>{print.material}</b></span>}
            <span>{formatGrams(print.filamentGrams)}</span>
            <span>{formatDuration(print.durationSeconds)}</span>
          </div>
        ) : (
          print.durationSeconds != null && (
            <div className="timeline-meta">
              <span>Levou {formatDuration(print.durationSeconds)} pra resolver</span>
            </div>
          )
        )}
        {stlUrl ? (
          <ErrorBoundary fallback={staticThumb ? <div className="timeline-thumb"><img src={staticThumb} alt={print.title} loading="lazy" /></div> : null}>
            <Suspense fallback={<div className="timeline-thumb timeline-thumb-loading" />}>
              <div className="timeline-thumb">
                <StlViewer url={stlUrl} interactive={false} className="timeline-thumb-canvas" />
              </div>
            </Suspense>
          </ErrorBoundary>
        ) : (
          staticThumb && (
            <div className="timeline-thumb">
              <img src={staticThumb} alt={print.title} loading="lazy" />
            </div>
          )
        )}
      </Link>
    </motion.div>
  );
}
