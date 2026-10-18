/**
 * Weekly training load — what the coach and the reviewer use to judge progression and deloads.
 * Shared by app and server; relative imports only.
 *
 * Load is session-RPE × minutes (Foster): easy ≈ RPE 3, sub-threshold ≈ 6, hard ≈ 8, strength/Hyrox
 * station work ≈ 5. Sessions without a duration count as 45 minutes.
 */
import { addDays, startOfWeek } from '../lib/dates';
import { intensityOf, type IntensityClass } from './intensity';

export const SESSION_RPE: Record<IntensityClass, number> = { easy: 3, moderate: 6, hard: 8, other: 5 };
const DEFAULT_MINUTES = 45;

export interface LoadSession {
  date: string;
  workoutTypeId: string;
  durationSec?: number | null;
  completed?: boolean;
  workout?: { intensity: 'easy' | 'moderate' | 'hard' } | null;
}

export interface WeekLoad {
  weekStart: string;
  sessions: number;
  minutes: number;
  runMinutes: number;
  qualitySessions: number;
  longestMinutes: number;
  /** Session-RPE × minutes. */
  load: number;
}

const minutesOf = (s: LoadSession) => (s.durationSec && s.durationSec > 0 ? s.durationSec / 60 : DEFAULT_MINUTES);

export function weekLoad(weekStart: string, sessions: LoadSession[]): WeekLoad {
  let minutes = 0;
  let runMinutes = 0;
  let qualitySessions = 0;
  let longestMinutes = 0;
  let load = 0;
  for (const s of sessions) {
    const m = minutesOf(s);
    const cls = intensityOf(s);
    minutes += m;
    if (s.workoutTypeId.startsWith('run.')) runMinutes += m;
    if (cls === 'moderate' || cls === 'hard') qualitySessions++;
    longestMinutes = Math.max(longestMinutes, m);
    load += m * SESSION_RPE[cls];
  }
  return {
    weekStart,
    sessions: sessions.length,
    minutes: Math.round(minutes),
    runMinutes: Math.round(runMinutes),
    qualitySessions,
    longestMinutes: Math.round(longestMinutes),
    load: Math.round(load),
  };
}

/**
 * Loads for every week from `fromWeek` to `toWeek` (Monday dates, inclusive). Past days count only completed
 * sessions; today and later count planned ones too.
 */
export function weeklyLoads(sessions: LoadSession[], fromWeek: string, toWeek: string, today: string): WeekLoad[] {
  const weeks: WeekLoad[] = [];
  for (let week = startOfWeek(fromWeek); week <= toWeek; week = addDays(week, 7)) {
    const end = addDays(week, 6);
    weeks.push(
      weekLoad(
        week,
        sessions.filter((s) => s.date >= week && s.date <= end && (s.date >= today || s.completed)),
      ),
    );
  }
  return weeks;
}

/** "Sep 29: 6h 10m (run 4h 05m), 3 quality, longest 95 min, load 1840" */
export function describeWeekLoad(w: WeekLoad): string {
  const hm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
  return `${w.weekStart}: ${w.sessions} sessions, ${hm(w.minutes)} (run ${hm(w.runMinutes)}), ${w.qualitySessions} quality, longest ${w.longestMinutes} min, load ${w.load}`;
}
