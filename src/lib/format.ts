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

/** Totals-style duration without seconds: 13500 → "3h 45m", 2700 → "45m", 20 → "0m". */
export function formatDurationShort(totalSeconds: number): string {
  const minutes = Math.round(Math.max(0, totalSeconds) / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Run pace "5:12 /km", swim pace "1:45 /100m", ride speed "28.4 km/h". */
export function formatPace(
  { distanceKm, durationSec }: { distanceKm?: number; durationSec?: number },
  sportId: string,
): string | undefined {
  if (!distanceKm || !durationSec) return undefined;
  if (sportId === 'ride') return `${(distanceKm / (durationSec / 3600)).toFixed(1)} km/h`;
  const perUnit = sportId === 'swim' ? durationSec / (distanceKm * 10) : durationSec / distanceKm;
  const total = Math.round(perUnit);
  const label = sportId === 'swim' ? '/100m' : '/km';
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} ${label}`;
}
