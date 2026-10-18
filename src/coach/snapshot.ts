import { Profile } from '../constants/profile';
import { addDays, startOfWeek } from '../lib/dates';
import type { Activity } from '../store/activities';
import type { AthleteProfilePatch, Snapshot } from './contract';

function timezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London';
  } catch {
    return 'Europe/London';
  }
}

/** What the coach sees each turn: the last 8 weeks and everything ahead. */
export function buildSnapshot(activities: Record<string, Activity>, profile: AthleteProfilePatch, today: string): Snapshot {
  const from = addDays(startOfWeek(today), -7 * 8);
  return {
    today,
    timezone: timezone(),
    athleteName: Profile.firstName,
    profile,
    activities: Object.values(activities)
      .filter((a) => a.date >= from)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((a) => ({
        id: a.id,
        date: a.date,
        workoutTypeId: a.workoutTypeId,
        title: a.title,
        durationSec: a.durationSec ?? null,
        distanceKm: a.distanceKm ?? null,
        notes: a.notes ?? null,
        completed: a.completed,
        source: a.source ?? 'manual',
        // The coach only needs its own prescriptions back, and only for sessions still to come.
        workout: a.workout && !a.completed && a.date >= today ? a.workout : null,
      })),
  };
}
