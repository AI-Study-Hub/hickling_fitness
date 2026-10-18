import { describeWeekLoad, weeklyLoads, weekLoad } from '@/coach/load';

describe('weekly load', () => {
  it('sums minutes, running minutes, quality sessions and session-RPE load', () => {
    const w = weekLoad('2026-10-12', [
      { date: '2026-10-13', workoutTypeId: 'run.easy', durationSec: 3600 },
      { date: '2026-10-14', workoutTypeId: 'run.intervals', durationSec: 3000, workout: { intensity: 'moderate' } },
      { date: '2026-10-15', workoutTypeId: 'strength.full', durationSec: 2700 },
      { date: '2026-10-18', workoutTypeId: 'ride.endurance' },
    ]);
    expect(w).toEqual({
      weekStart: '2026-10-12',
      sessions: 4,
      minutes: 60 + 50 + 45 + 45,
      runMinutes: 110,
      qualitySessions: 1,
      longestMinutes: 60,
      load: 60 * 3 + 50 * 6 + 45 * 5 + 45 * 3,
    });
    expect(describeWeekLoad(w)).toBe('2026-10-12: 4 sessions, 3h 20m (run 1h 50m), 1 quality, longest 60 min, load 840');
  });

  it('counts only completed sessions in the past and planned ones from today', () => {
    const sessions = [
      { date: '2026-10-13', workoutTypeId: 'run.easy', durationSec: 1800, completed: false },
      { date: '2026-10-14', workoutTypeId: 'run.easy', durationSec: 1800, completed: true },
      { date: '2026-10-20', workoutTypeId: 'run.easy', durationSec: 1800, completed: false },
    ];
    const weeks = weeklyLoads(sessions, '2026-10-12', '2026-10-19', '2026-10-18');
    expect(weeks.map((w) => [w.weekStart, w.sessions])).toEqual([
      ['2026-10-12', 1],
      ['2026-10-19', 1],
    ]);
  });
});
