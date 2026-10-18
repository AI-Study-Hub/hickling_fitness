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

  it('uses valid colours', () => {
    for (const workout of ALL_WORKOUT_TYPES) {
      expect(workout.gradient).toHaveLength(2);
      workout.gradient.forEach((c) => expect(c).toMatch(HEX));
      expect(workout.color).toMatch(HEX);
    }
    SPORTS.forEach((sport) => expect(sport.color).toMatch(HEX));
  });

  it('offers only the five sports in use', () => {
    expect(SPORTS.map((s) => s.id)).toEqual(['run', 'ride', 'swim', 'strength', 'hyrox']);
    expect(getSport('hyrox')?.workouts.map((w) => w.name)).toEqual(
      expect.arrayContaining(['Combo', 'AMRAP', 'EMOM', 'METCON']),
    );
  });

  it('colours Easy Run green to match its tile', () => {
    expect(getWorkoutType('run.easy')?.color).toBe('#5CBF22');
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
    expect(getWorkoutType('team.football')).toBeUndefined();
  });

  it('searches by workout or sport name', () => {
    expect(searchWorkoutTypes('amrap').map((w) => w.id)).toEqual(['hyrox.amrap']);
    expect(searchWorkoutTypes('SWIM').every((w) => w.sport.id === 'swim')).toBe(true);
    expect(searchWorkoutTypes('   ')).toEqual([]);
  });
});
