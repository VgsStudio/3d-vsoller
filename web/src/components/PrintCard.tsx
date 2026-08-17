import { Link } from "react-router-dom";
import type { Print } from "../types";
import { mediaUrl } from "../api/client";
import { StatusBadge } from "./StatusBadge";
import { ProgressBar } from "./ProgressBar";
import { formatDate, formatDuration, formatGrams } from "../utils/format";

export function PrintCard({ print }: { print: Print }) {
  const thumb = mediaUrl(print.renderKey) ?? mediaUrl(print.bedPhotoKey) ?? mediaUrl(print.photos?.[0]);

  return (
    <Link to={`/impressoes/${print.id}`} className="card">
      <div className="card-thumb">
        {thumb ? <img src={thumb} alt={print.title} loading="lazy" /> : "sem foto"}
      </div>
      <div className="card-body">
        <StatusBadge status={print.status} />
        <h3 className="card-title">{print.title}</h3>
        {print.status === "printing" && <ProgressBar percent={print.progressPercent ?? 0} />}
        <div className="card-meta">
          <span>{formatDate(print.finishedAt ?? print.startedAt ?? print.createdAt)}</span>
          <span>·</span>
          <span>{formatDuration(print.durationSeconds)}</span>
          <span>·</span>
          <span>{formatGrams(print.filamentGrams)}</span>
        </div>
      </div>
    </Link>
  );
}
