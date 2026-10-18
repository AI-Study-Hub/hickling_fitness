import { ALL_WORKOUT_TYPES, getSport, getWorkoutType, searchWorkoutTypes, SPORTS } from '@/data/sports';

const HEX = /^#[0-9A-F]{6}$/i;

describe('sports catalogue', () => {
  it('has unique sport and workout ids', () => {
    const sportIds = SPORTS.map((s) => s.id);
    expect(new Set(sportIds).size).toBe(sportIds.length);
    const workoutIds = ALL_WORKOUT_TYPES.map((w) => w.id);
    expect(new Set(workoutIds).size).toBe(workoutIds.length);
  });

  it('prefixes workout ids with their sport id', () => {
    for (const sport of SPORTS) {
      for (const workout of sport.workouts) expect(workout.id.startsWith(`${sport.id}.`)).toBe(true);
    }
  });

  it('uses valid gradient colours', () => {
    for (const workout of ALL_WORKOUT_TYPES) {
      expect(workout.gradient).toHaveLength(2);
      workout.gradient.forEach((c) => expect(c).toMatch(HEX));
    }
  });

  it('keeps Runna run types first', () => {
    expect(SPORTS[0].workouts.slice(0, 7).map((w) => w.name)).toEqual([
      'Easy Run',
      'Tempo',
      'Intervals',
      'Hills',
      'Long Run',
      'Race',
      'parkrun',
    ]);
  });

  it('looks up sports and workout types', () => {
    expect(getSport('swim')?.distanceUnit).toBe('m');
    expect(getWorkoutType('run.tempo')?.sport.id).toBe('run');
    expect(getWorkoutType('nope')).toBeUndefined();
  });

  it('searches by workout or sport name', () => {
    expect(searchWorkoutTypes('pad').map((w) => w.id)).toEqual(['racket.padel']);
    expect(searchWorkoutTypes('SWIM').every((w) => w.sport.id === 'swim')).toBe(true);
    expect(searchWorkoutTypes('   ')).toEqual([]);
  });
});
