import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Two-stop gradient, drawn from bottom-left (first) to top-right (second). */
export type Gradient = readonly [string, string];

export type DistanceUnit = 'km' | 'm';

interface Swatch {
  gradient: Gradient;
  /** Solid colour that reads as the tile's colour — used for calendar strips and charts. */
  color: string;
}

export interface WorkoutType extends Swatch {
  id: string;
  name: string;
  icon: IconName;
}

export interface Sport {
  id: string;
  name: string;
  /** Section heading on Today, e.g. "Add run". */
  addLabel: string;
  icon: IconName;
  color: string;
  /** Unit distance is entered in. Omitted for sports that don't track distance. */
  distanceUnit?: DistanceUnit;
  workouts: WorkoutType[];
}

export interface ResolvedWorkoutType extends WorkoutType {
  sport: Sport;
}

// The first seven gradients are sampled from Runna's run tiles; the rest extend the palette.
const S = {
  lime: { gradient: ['#50BA25', '#E3C30F'], color: '#5CBF22' },
  amber: { gradient: ['#EDBE0F', '#E68423'], color: '#EDB512' },
  ember: { gradient: ['#E57B21', '#D42F29'], color: '#E4602A' },
  moss: { gradient: ['#2F5F31', '#7CA26A'], color: '#5C9150' },
  violet: { gradient: ['#5A328B', '#9D72D0'], color: '#8461C6' },
  crimson: { gradient: ['#981917', '#D55140'], color: '#C93B30' },
  lagoon: { gradient: ['#253D4E', '#03C4A7'], color: '#0DB89D' },
  ocean: { gradient: ['#123A6B', '#2F8FE0'], color: '#2A7BCF' },
  sky: { gradient: ['#1F6FB2', '#53C6F0'], color: '#3BA6DE' },
  indigo: { gradient: ['#2B2F86', '#6A6FE0'], color: '#5459CC' },
  magenta: { gradient: ['#7A1F6B', '#D2509E'], color: '#B8428E' },
  sunset: { gradient: ['#C2482F', '#F2B33D'], color: '#E37A36' },
  forest: { gradient: ['#1F4A3A', '#3FA27A'], color: '#2F8A63' },
  sand: { gradient: ['#7A5A22', '#D9B45A'], color: '#C49B45' },
  plum: { gradient: ['#3E2266', '#8B5BC9'], color: '#7349B0' },
  steel: { gradient: ['#2C4A63', '#7FA6C4'], color: '#5E89AB' },
  mint: { gradient: ['#1E7A63', '#7FE0B8'], color: '#3DB68E' },
} as const satisfies Record<string, Swatch>;

const workout = (id: string, name: string, icon: IconName, swatch: Swatch): WorkoutType => ({
  id,
  name,
  icon,
  ...swatch,
});

export const SPORTS: Sport[] = [
  {
    id: 'run',
    name: 'Run',
    addLabel: 'Add run',
    icon: 'run',
    color: S.lime.color,
    distanceUnit: 'km',
    workouts: [
      workout('run.easy', 'Easy Run', 'run', S.lime),
      workout('run.tempo', 'Tempo', 'run-fast', S.amber),
      workout('run.intervals', 'Intervals', 'timer-outline', S.ember),
      workout('run.hills', 'Hills', 'slope-uphill', S.moss),
      workout('run.long', 'Long Run', 'map-marker-distance', S.violet),
      workout('run.race', 'Race', 'flag-checkered', S.crimson),
      workout('run.parkrun', 'parkrun', 'tree', S.lagoon),
      workout('run.recovery', 'Recovery', 'heart-pulse', S.mint),
      workout('run.trail', 'Trail Run', 'image-filter-hdr', S.forest),
    ],
  },
  {
    id: 'ride',
    name: 'Ride',
    addLabel: 'Add ride',
    icon: 'bike',
    color: S.ocean.color,
    distanceUnit: 'km',
    workouts: [
      workout('ride.endurance', 'Endurance', 'bike', S.ocean),
      workout('ride.intervals', 'Intervals', 'bike-fast', S.ember),
      workout('ride.climbs', 'Hill Climbs', 'slope-uphill', S.moss),
      workout('ride.recovery', 'Recovery Spin', 'bike-pedal', S.mint),
      workout('ride.indoor', 'Indoor Trainer', 'speedometer', S.indigo),
      workout('ride.group', 'Group Ride', 'account-group', S.amber),
      workout('ride.gravel', 'Gravel / MTB', 'terrain', S.sand),
      workout('ride.race', 'Race', 'flag-checkered', S.crimson),
    ],
  },
  {
    id: 'swim',
    name: 'Swim',
    addLabel: 'Add swim',
    icon: 'swim',
    color: S.sky.color,
    distanceUnit: 'm',
    workouts: [
      workout('swim.technique', 'Technique', 'swim', S.sky),
      workout('swim.endurance', 'Endurance', 'waves', S.ocean),
      workout('swim.intervals', 'Intervals', 'timer-outline', S.ember),
      workout('swim.open-water', 'Open Water', 'water', S.lagoon),
      workout('swim.recovery', 'Recovery', 'pool', S.mint),
      workout('swim.race', 'Race', 'flag-checkered', S.crimson),
    ],
  },
  {
    id: 'strength',
    name: 'Strength',
    addLabel: 'Add strength',
    icon: 'weight-lifter',
    color: S.crimson.color,
    workouts: [
      workout('strength.full', 'Full Body', 'weight-lifter', S.crimson),
      workout('strength.upper', 'Upper Body', 'arm-flex', S.ember),
      workout('strength.lower', 'Lower Body', 'weight', S.violet),
      workout('strength.core', 'Core', 'target', S.amber),
      workout('strength.kettlebell', 'Kettlebell', 'kettlebell', S.sunset),
      workout('strength.plyo', 'Plyometrics', 'jump-rope', S.lime),
    ],
  },
  {
    id: 'hyrox',
    name: 'Hyrox',
    addLabel: 'Add Hyrox',
    icon: 'fire',
    color: S.ember.color,
    workouts: [
      workout('hyrox.combo', 'Combo', 'shuffle-variant', S.ember),
      workout('hyrox.amrap', 'AMRAP', 'repeat', S.amber),
      workout('hyrox.emom', 'EMOM', 'timer-outline', S.sky),
      workout('hyrox.metcon', 'METCON', 'fire', S.crimson),
      workout('hyrox.for-time', 'For Time', 'timer-sand', S.violet),
      workout('hyrox.compromised', 'Compromised Run', 'run-fast', S.lime),
      workout('hyrox.stations', 'Stations', 'dumbbell', S.steel),
      workout('hyrox.simulation', 'Simulation', 'progress-clock', S.plum),
      workout('hyrox.race', 'Race', 'trophy-outline', S.magenta),
    ],
  },
];

const SPORTS_BY_ID = new Map(SPORTS.map((sport) => [sport.id, sport]));

const WORKOUTS_BY_ID = new Map<string, ResolvedWorkoutType>(
  SPORTS.flatMap((sport) => sport.workouts.map((w) => [w.id, { ...w, sport }] as const)),
);

export const ALL_WORKOUT_TYPES: ResolvedWorkoutType[] = [...WORKOUTS_BY_ID.values()];

export function getSport(id: string): Sport | undefined {
  return SPORTS_BY_ID.get(id);
}

/** Undefined for ids that are no longer in the catalogue (e.g. sports that were removed). */
export function getWorkoutType(id: string): ResolvedWorkoutType | undefined {
  return WORKOUTS_BY_ID.get(id);
}

/** Case-insensitive match on workout or sport name, e.g. "tempo", "swim", "amrap". */
export function searchWorkoutTypes(query: string): ResolvedWorkoutType[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ALL_WORKOUT_TYPES.filter(
    (w) => w.name.toLowerCase().includes(q) || w.sport.name.toLowerCase().includes(q),
  );
}
