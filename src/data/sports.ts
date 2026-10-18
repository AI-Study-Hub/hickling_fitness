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
  /** Always the sport's icon — the app uses exactly one icon per sport. */
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

const workout = (id: string, name: string, swatch: Swatch) => ({ id, name, ...swatch });

/** Gives every workout type its sport's icon; types differ by colour and name only. */
function sport({ workouts, ...rest }: Omit<Sport, 'workouts'> & { workouts: Omit<WorkoutType, 'icon'>[] }): Sport {
  return { ...rest, workouts: workouts.map((w) => ({ ...w, icon: rest.icon })) };
}

export const SPORTS: Sport[] = [
  sport({
    id: 'run',
    name: 'Run',
    addLabel: 'Add run',
    icon: 'run',
    color: S.lime.color,
    distanceUnit: 'km',
    workouts: [
      workout('run.easy', 'Easy Run', S.lime),
      workout('run.tempo', 'Tempo', S.amber),
      workout('run.intervals', 'Intervals', S.ember),
      workout('run.hills', 'Hills', S.moss),
      workout('run.long', 'Long Run', S.violet),
      workout('run.race', 'Race', S.crimson),
      workout('run.parkrun', 'parkrun', S.lagoon),
      workout('run.recovery', 'Recovery', S.mint),
      workout('run.trail', 'Trail Run', S.forest),
    ],
  }),
  sport({
    id: 'ride',
    name: 'Ride',
    addLabel: 'Add ride',
    icon: 'bike',
    color: S.ocean.color,
    distanceUnit: 'km',
    workouts: [
      workout('ride.endurance', 'Endurance', S.ocean),
      workout('ride.intervals', 'Intervals', S.ember),
      workout('ride.climbs', 'Hill Climbs', S.moss),
      workout('ride.recovery', 'Recovery Spin', S.mint),
      workout('ride.indoor', 'Indoor Trainer', S.indigo),
      workout('ride.group', 'Group Ride', S.amber),
      workout('ride.gravel', 'Gravel / MTB', S.sand),
      workout('ride.race', 'Race', S.crimson),
    ],
  }),
  sport({
    id: 'swim',
    name: 'Swim',
    addLabel: 'Add swim',
    icon: 'swim',
    color: S.sky.color,
    distanceUnit: 'm',
    workouts: [
      workout('swim.technique', 'Technique', S.sky),
      workout('swim.endurance', 'Endurance', S.ocean),
      workout('swim.intervals', 'Intervals', S.ember),
      workout('swim.open-water', 'Open Water', S.lagoon),
      workout('swim.recovery', 'Recovery', S.mint),
      workout('swim.race', 'Race', S.crimson),
    ],
  }),
  sport({
    id: 'strength',
    name: 'Strength',
    addLabel: 'Add strength',
    icon: 'weight-lifter',
    color: S.crimson.color,
    workouts: [
      workout('strength.full', 'Full Body', S.crimson),
      workout('strength.upper', 'Upper Body', S.ember),
      workout('strength.lower', 'Lower Body', S.violet),
      workout('strength.core', 'Core', S.amber),
      workout('strength.kettlebell', 'Kettlebell', S.sunset),
      workout('strength.plyo', 'Plyometrics', S.lime),
    ],
  }),
  sport({
    id: 'hyrox',
    name: 'Hyrox',
    addLabel: 'Add Hyrox',
    icon: 'fire',
    color: S.ember.color,
    workouts: [
      workout('hyrox.combo', 'Combo', S.ember),
      workout('hyrox.amrap', 'AMRAP', S.amber),
      workout('hyrox.emom', 'EMOM', S.sky),
      workout('hyrox.metcon', 'METCON', S.crimson),
      workout('hyrox.for-time', 'For Time', S.violet),
      workout('hyrox.compromised', 'Compromised Run', S.lime),
      workout('hyrox.stations', 'Stations', S.steel),
      workout('hyrox.simulation', 'Simulation', S.plum),
      workout('hyrox.race', 'Race', S.magenta),
    ],
  }),
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
