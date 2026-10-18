import type { DistanceUnit } from '@/data/sports';

/** 4912 → "1h 21m 52s", 2700 → "45m", 30 → "30s". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (sec || parts.length === 0) parts.push(`${sec}s`);
  return parts.join(' ');
}

/** Distances are stored in km; swim and row are shown in metres. */
export function formatDistance(km: number, unit: DistanceUnit = 'km'): string {
  if (unit === 'm') return `${Math.round(km * 1000).toLocaleString('en-GB')} m`;
  return `${Number(km.toFixed(2))} km`;
}

export function splitDuration(totalSeconds: number): { h: number; m: number; s: number } {
  const s = Math.max(0, Math.round(totalSeconds));
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** "13.5 km • 1h 21m 52s"; parts that aren't set are left out. */
export function formatActivitySummary(
  { distanceKm, durationSec }: { distanceKm?: number; durationSec?: number },
  unit?: DistanceUnit,
): string {
  const parts: string[] = [];
  if (distanceKm && unit) parts.push(formatDistance(distanceKm, unit));
  if (durationSec) parts.push(formatDuration(durationSec));
  return parts.join(' • ');
}
