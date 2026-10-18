/**
 * Intensity class of a session for the 80/20 balance. Shared by the app (Plan screen) and the coach server.
 * Strength and Hyrox station work are "other": they count as load but not as endurance intensity.
 */
export type IntensityClass = 'easy' | 'moderate' | 'hard' | 'other';

const DEFAULTS: Record<string, IntensityClass> = {
  'run.easy': 'easy',
  'run.long': 'easy',
  'run.recovery': 'easy',
  'run.trail': 'easy',
  'run.tempo': 'moderate',
  'run.intervals': 'hard',
  'run.hills': 'hard',
  'run.race': 'hard',
  'run.parkrun': 'hard',
  'ride.endurance': 'easy',
  'ride.recovery': 'easy',
  'ride.group': 'easy',
  'ride.gravel': 'easy',
  'ride.indoor': 'easy',
  'ride.intervals': 'hard',
  'ride.climbs': 'moderate',
  'ride.race': 'hard',
  'swim.technique': 'easy',
  'swim.endurance': 'easy',
  'swim.open-water': 'easy',
  'swim.recovery': 'easy',
  'swim.intervals': 'moderate',
  'swim.race': 'hard',
  'hyrox.compromised': 'moderate',
  'hyrox.stations': 'other',
  'hyrox.race': 'hard',
  'hyrox.simulation': 'hard',
};

export function intensityOf(session: {
  workoutTypeId: string;
  workout?: { intensity: 'easy' | 'moderate' | 'hard' } | null;
}): IntensityClass {
  if (session.workoutTypeId.startsWith('strength.')) return 'other';
  if (session.workout) return session.workout.intensity;
  return DEFAULTS[session.workoutTypeId] ?? (session.workoutTypeId.startsWith('hyrox.') ? 'hard' : 'easy');
}

/** Share of endurance time (or sessions, when durations are missing) that is easy. */
export function easyShare(
  sessions: { workoutTypeId: string; durationSec?: number | null; workout?: { intensity: 'easy' | 'moderate' | 'hard' } | null }[],
): { easy: number; quality: number; share: number | null } {
  let easy = 0;
  let quality = 0;
  for (const s of sessions) {
    const cls = intensityOf(s);
    if (cls === 'other') continue;
    const weight = s.durationSec && s.durationSec > 0 ? s.durationSec : 45 * 60;
    if (cls === 'easy') easy += weight;
    else quality += weight;
  }
  const total = easy + quality;
  return { easy, quality, share: total ? easy / total : null };
}
