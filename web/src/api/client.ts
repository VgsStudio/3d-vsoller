import type { Print } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE as string;

export async function fetchPrints(): Promise<Print[]> {
  const res = await fetch(`${API_BASE}/prints`);
  if (!res.ok) throw new Error(`Failed to load prints: ${res.status}`);
  const data = await res.json();
  return data.items as Print[];
}

export async function fetchPrint(id: string): Promise<Print> {
  const res = await fetch(`${API_BASE}/prints/${id}`);
  if (!res.ok) throw new Error(`Failed to load print ${id}: ${res.status}`);
  return (await res.json()) as Print;
}

export function mediaUrl(key?: string | null): string | undefined {
  if (!key) return undefined;
  const base = import.meta.env.VITE_MEDIA_BASE as string;
  return `${base}/${key}`;
}
