import {
  completedFor,
  sumActivities,
  totalsBetween,
  totalsBySport,
  weeklySeries,
  weeklyStreak,
} from '@/lib/progress';
import type { Activity } from '@/store/activities';

const make = (id: string, workoutTypeId: string, date: string, extra: Partial<Activity> = {}): Activity => ({
  id,
  workoutTypeId,
  title: id,
  date,
  completed: true,
  createdAt: 0,
  ...extra,
});

const list: Activity[] = [
  make('r1', 'run.easy', '2026-10-13', { distanceKm: 5, durationSec: 1800 }),
  make('r2', 'run.long', '2026-10-17', { distanceKm: 13.5, durationSec: 4912 }),
  make('r3', 'run.tempo', '2026-10-06', { distanceKm: 8, durationSec: 2400 }),
  make('s1', 'swim.endurance', '2026-10-14', { distanceKm: 2, durationSec: 2700 }),
  make('h1', 'hyrox.amrap', '2026-10-15', { durationSec: 3600 }),
  make('p1', 'run.easy', '2026-10-19', { distanceKm: 6, completed: false }),
  make('x1', 'team.football', '2026-10-16', { durationSec: 3600 }),
];

describe('progress', () => {
  it('sums activities', () => {
    expect(sumActivities(list.slice(0, 2))).toEqual({ count: 2, distanceKm: 18.5, durationSec: 6712 });
  });

  it('keeps only completed activities for a sport', () => {
    expect(completedFor(list, 'run').map((a) => a.id)).toEqual(['r1', 'r2', 'r3']);
    // "all" includes sessions whose sport was removed from the catalogue.
    expect(completedFor(list, 'all').map((a) => a.id)).toEqual(['r1', 'r2', 'r3', 's1', 'h1', 'x1']);
  });

  it('totals a date range inclusively', () => {
    expect(totalsBetween(completedFor(list, 'run'), '2026-10-12', '2026-10-18').distanceKm).toBe(18.5);
  });

  it('builds a weekly series oldest first', () => {
    const series = weeklySeries(completedFor(list, 'run'), '2026-10-12', 3);
    expect(series.map((w) => w.weekStart)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
    expect(series.map((w) => w.totals.distanceKm)).toEqual([0, 8, 18.5]);
  });

  it('groups by sport in catalogue order, skipping unknown sports', () => {
    expect(totalsBySport(list).map((e) => [e.sport.id, e.totals.count])).toEqual([
      ['run', 4],
      ['swim', 1],
      ['hyrox', 1],
    ]);
  });

  it('counts the weekly streak back from this week', () => {
    const runs = completedFor(list, 'run'); // weeks of 5 Oct and 12 Oct
    expect(weeklyStreak(runs, '2026-10-12')).toBe(2);
    // Nothing logged yet in the week of 19 Oct: the streak still counts back from last week.
    expect(weeklyStreak(runs, '2026-10-19')).toBe(2);
    // A gap week breaks it.
    expect(weeklyStreak(runs, '2026-10-26')).toBe(0);
  });
});
