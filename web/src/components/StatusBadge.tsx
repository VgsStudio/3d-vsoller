import type { PrintStatus } from "../types";

const LABELS: Record<PrintStatus, string> = {
  queued: "Na fila",
  printing: "Imprimindo",
  paused: "Pausado",
  completed: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
};

export function StatusBadge({ status }: { status: PrintStatus }) {
  return <span className={`badge badge-${status}`}>{LABELS[status] ?? status}</span>;
}
