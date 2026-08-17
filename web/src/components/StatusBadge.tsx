import type { PrintStatus } from "../types";

const LABELS: Record<PrintStatus, string> = {
  queued: "Na fila",
  printing: "Imprimindo",
  paused: "Pausado",
  completed: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
  open: "Em aberto",
  monitoring: "Acompanhando",
  resolved: "Resolvido",
};

const DOT_CLASS: Record<PrintStatus, string> = {
  queued: "queued",
  printing: "printing",
  paused: "paused",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
  open: "failed",
  monitoring: "paused",
  resolved: "completed",
};

export function StatusBadge({ status }: { status: PrintStatus }) {
  return <span className={`badge badge-${DOT_CLASS[status] ?? "queued"}`}>{LABELS[status] ?? status}</span>;
}

export function dotClassFor(status: PrintStatus): string {
  return DOT_CLASS[status] ?? "queued";
}
