import { getWorkoutType, SPORTS, type Sport } from '@/data/sports';
import { addDays, startOfWeek, type ISODate } from '@/lib/dates';
import type { Activity } from '@/store/activities';

export interface Totals {
  count: number;
  durationSec: number;
  distanceKm: number;
}

/** `'all'` or a sport id. */
export type SportFilter = string;

export const ALL_SPORTS: SportFilter = 'all';

export function sportOf(activity: Activity): Sport | undefined {
  return getWorkoutType(activity.workoutTypeId)?.sport;
}

export function sumActivities(list: Activity[]): Totals {
  return list.reduce<Totals>(
    (t, a) => ({
      count: t.count + 1,
      durationSec: t.durationSec + (a.durationSec ?? 0),
      distanceKm: t.distanceKm + (a.distanceKm ?? 0),
    }),
    { count: 0, durationSec: 0, distanceKm: 0 },
  );
}

/** Per-sport totals in catalogue order, only for sports that appear in `list`. */
export function totalsBySport(list: Activity[]): { sport: Sport; totals: Totals }[] {
  return SPORTS.map((sport) => ({
    sport,
    totals: sumActivities(list.filter((a) => sportOf(a)?.id === sport.id)),
  })).filter((entry) => entry.totals.count > 0);
}

/** Completed activities for one sport, or every sport with `'all'`. */
export function completedFor(activities: Activity[], filter: SportFilter): Activity[] {
  return activities.filter((a) => a.completed && (filter === ALL_SPORTS || sportOf(a)?.id === filter));
}

export function totalsBetween(list: Activity[], from: ISODate, to: ISODate): Totals {
  return sumActivities(list.filter((a) => a.date >= from && a.date <= to));
}

/** Totals for `weeks` consecutive weeks ending with the week starting `lastWeekStart`, oldest first. */
export function weeklySeries(
  list: Activity[],
  lastWeekStart: ISODate,
  weeks = 12,
): { weekStart: ISODate; totals: Totals }[] {
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(lastWeekStart, -7 * (weeks - 1 - i));
    return { weekStart, totals: totalsBetween(list, weekStart, addDays(weekStart, 6)) };
  });
}

/**
 * Strava-style weekly streak: consecutive weeks (Mon–Sun) with at least one session, counting back
 * from this week — or from last week if nothing is logged yet this week, so the streak isn't lost early.
 */
export function weeklyStreak(list: Activity[], currentWeekStart: ISODate): number {
  const weeks = new Set(list.map((a) => startOfWeek(a.date)));
  let week = weeks.has(currentWeekStart) ? currentWeekStart : addDays(currentWeekStart, -7);
  let streak = 0;
  while (weeks.has(week)) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}
