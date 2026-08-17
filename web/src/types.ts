export type PrintStatus =
  | "queued"
  | "printing"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "open"
  | "monitoring"
  | "resolved";

export type EntryCategory = "print" | "issue" | "maintenance";

export interface Print {
  id: string;
  title: string;
  description?: string;
  category?: EntryCategory;
  status: PrintStatus;
  progressPercent?: number;
  material?: string;
  dimensions?: string;
  filamentGrams?: number;
  printer?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationSeconds?: number | null;
  hidden?: boolean;
  stlKey?: string | null;
  gcodeKey?: string | null;
  photos?: string[];
  bedPhotoKey?: string | null;
  renderKey?: string | null;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}
