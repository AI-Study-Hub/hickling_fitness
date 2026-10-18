import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Two-stop gradient, drawn from bottom-left (first) to top-right (second). */
export type Gradient = readonly [string, string];

export type DistanceUnit = 'km' | 'm';

export interface WorkoutType {
  id: string;
  name: string;
  icon: IconName;
  gradient: Gradient;
}

export interface Sport {
  id: string;
  name: string;
  /** Section heading on Today, e.g. "Add run". */
  addLabel: string;
  icon: IconName;
  /** Unit distance is entered in. Omitted for sports that don't track distance. */
  distanceUnit?: DistanceUnit;
  workouts: WorkoutType[];
}

export interface ResolvedWorkoutType extends WorkoutType {
  sport: Sport;
}

// The first seven are sampled from Runna's run tiles; the rest extend the palette.
const G = {
  lime: ['#50BA25', '#E3C30F'],
  amber: ['#EDBE0F', '#E68423'],
  ember: ['#E57B21', '#D42F29'],
  moss: ['#2F5F31', '#7CA26A'],
  violet: ['#5A328B', '#9D72D0'],
  crimson: ['#981917', '#D55140'],
  lagoon: ['#253D4E', '#03C4A7'],
  ocean: ['#123A6B', '#2F8FE0'],
  sky: ['#1F6FB2', '#53C6F0'],
  indigo: ['#2B2F86', '#6A6FE0'],
  magenta: ['#7A1F6B', '#D2509E'],
  rose: ['#B0305A', '#F07A8A'],
  sunset: ['#C2482F', '#F2B33D'],
  slate: ['#2E3644', '#6F7F97'],
  forest: ['#1F4A3A', '#3FA27A'],
  sand: ['#7A5A22', '#D9B45A'],
  plum: ['#3E2266', '#8B5BC9'],
  steel: ['#2C4A63', '#7FA6C4'],
  mint: ['#1E7A63', '#7FE0B8'],
} as const satisfies Record<string, Gradient>;

const workout = (id: string, name: string, icon: IconName, gradient: Gradient): WorkoutType => ({
  id,
  name,
  icon,
  gradient,
});

export const SPORTS: Sport[] = [
  {
    id: 'run',
    name: 'Run',
    addLabel: 'Add run',
    icon: 'run',
    distanceUnit: 'km',
    workouts: [
      workout('run.easy', 'Easy Run', 'run', G.lime),
      workout('run.tempo', 'Tempo', 'run-fast', G.amber),
      workout('run.intervals', 'Intervals', 'timer-outline', G.ember),
      workout('run.hills', 'Hills', 'slope-uphill', G.moss),
      workout('run.long', 'Long Run', 'map-marker-distance', G.violet),
      workout('run.race', 'Race', 'flag-checkered', G.crimson),
      workout('run.parkrun', 'parkrun', 'tree', G.lagoon),
      workout('run.recovery', 'Recovery', 'heart-pulse', G.mint),
      workout('run.trail', 'Trail Run', 'image-filter-hdr', G.forest),
    ],
  },
  {
    id: 'ride',
    name: 'Ride',
    addLabel: 'Add ride',
    icon: 'bike',
    distanceUnit: 'km',
    workouts: [
      workout('ride.endurance', 'Endurance', 'bike', G.ocean),
      workout('ride.intervals', 'Intervals', 'bike-fast', G.ember),
      workout('ride.climbs', 'Hill Climbs', 'slope-uphill', G.moss),
      workout('ride.recovery', 'Recovery Spin', 'bike-pedal', G.mint),
      workout('ride.indoor', 'Indoor Trainer', 'speedometer', G.indigo),
      workout('ride.group', 'Group Ride', 'account-group', G.amber),
      workout('ride.gravel', 'Gravel / MTB', 'terrain', G.sand),
      workout('ride.race', 'Race', 'flag-checkered', G.crimson),
    ],
  },
  {
    id: 'swim',
    name: 'Swim',
    addLabel: 'Add swim',
    icon: 'swim',
    distanceUnit: 'm',
    workouts: [
      workout('swim.technique', 'Technique', 'swim', G.sky),
      workout('swim.endurance', 'Endurance', 'waves', G.ocean),
      workout('swim.intervals', 'Intervals', 'timer-outline', G.ember),
      workout('swim.open-water', 'Open Water', 'water', G.lagoon),
      workout('swim.recovery', 'Recovery', 'pool', G.mint),
      workout('swim.race', 'Race', 'flag-checkered', G.crimson),
    ],
  },
  {
    id: 'strength',
    name: 'Strength',
    addLabel: 'Add strength',
    icon: 'weight-lifter',
    workouts: [
      workout('strength.full', 'Full Body', 'weight-lifter', G.crimson),
      workout('strength.upper', 'Upper Body', 'arm-flex', G.ember),
      workout('strength.lower', 'Lower Body', 'weight', G.violet),
      workout('strength.core', 'Core', 'target', G.amber),
      workout('strength.kettlebell', 'Kettlebell', 'kettlebell', G.sunset),
      workout('strength.plyo', 'Plyometrics', 'jump-rope', G.lime),
    ],
  },
  {
    id: 'hiit',
    name: 'HIIT',
    addLabel: 'Add HIIT',
    icon: 'fire',
    workouts: [
      workout('hiit.hiit', 'HIIT', 'fire', G.ember),
      workout('hiit.circuit', 'Circuit', 'sync', G.amber),
      workout('hiit.crossfit', 'CrossFit / WOD', 'dumbbell', G.crimson),
      workout('hiit.bootcamp', 'Bootcamp', 'whistle', G.moss),
      workout('hiit.spin', 'Spin Class', 'bike-fast', G.magenta),
      workout('hiit.stairs', 'Stairs', 'stairs', G.violet),
    ],
  },
  {
    id: 'yoga',
    name: 'Yoga & Mobility',
    addLabel: 'Add yoga & mobility',
    icon: 'yoga',
    workouts: [
      workout('yoga.flow', 'Yoga', 'yoga', G.violet),
      workout('yoga.pilates', 'Pilates', 'human-handsup', G.rose),
      workout('yoga.mobility', 'Mobility', 'human', G.mint),
      workout('yoga.stretch', 'Stretching', 'spa', G.sky),
      workout('yoga.meditation', 'Meditation', 'meditation', G.plum),
    ],
  },
  {
    id: 'walk',
    name: 'Walk & Hike',
    addLabel: 'Add walk',
    icon: 'hiking',
    distanceUnit: 'km',
    workouts: [
      workout('walk.walk', 'Walk', 'walk', G.lime),
      workout('walk.hike', 'Hike', 'hiking', G.forest),
      workout('walk.mountain', 'Mountain', 'image-filter-hdr', G.moss),
      workout('walk.ruck', 'Rucking', 'bag-personal', G.sand),
    ],
  },
  {
    id: 'row',
    name: 'Row',
    addLabel: 'Add row',
    icon: 'rowing',
    distanceUnit: 'm',
    workouts: [
      workout('row.steady', 'Steady Row', 'rowing', G.ocean),
      workout('row.intervals', 'Intervals', 'timer-outline', G.ember),
      workout('row.test', 'Erg Test', 'flag-checkered', G.crimson),
      workout('row.water', 'On the Water', 'waves', G.lagoon),
    ],
  },
  {
    id: 'racket',
    name: 'Racket',
    addLabel: 'Add racket sport',
    icon: 'tennis',
    workouts: [
      workout('racket.tennis', 'Tennis', 'tennis', G.lime),
      workout('racket.padel', 'Padel', 'tennis-ball', G.amber),
      workout('racket.squash', 'Squash', 'racquetball', G.ember),
      workout('racket.badminton', 'Badminton', 'badminton', G.sky),
      workout('racket.table-tennis', 'Table Tennis', 'table-tennis', G.magenta),
    ],
  },
  {
    id: 'team',
    name: 'Team Sports',
    addLabel: 'Add team sport',
    icon: 'soccer',
    workouts: [
      workout('team.football', 'Football', 'soccer', G.forest),
      workout('team.rugby', 'Rugby', 'rugby', G.crimson),
      workout('team.basketball', 'Basketball', 'basketball', G.sunset),
      workout('team.hockey', 'Hockey', 'hockey-sticks', G.ocean),
      workout('team.netball', 'Netball', 'basketball-hoop-outline', G.rose),
      workout('team.cricket', 'Cricket', 'cricket', G.sand),
      workout('team.volleyball', 'Volleyball', 'volleyball', G.sky),
    ],
  },
  {
    id: 'climb',
    name: 'Climb',
    addLabel: 'Add climb',
    icon: 'carabiner',
    workouts: [
      workout('climb.bouldering', 'Bouldering', 'wall', G.sunset),
      workout('climb.indoor', 'Indoor Climb', 'carabiner', G.violet),
      workout('climb.outdoor', 'Outdoor Climb', 'image-filter-hdr', G.moss),
    ],
  },
  {
    id: 'combat',
    name: 'Combat',
    addLabel: 'Add combat sport',
    icon: 'boxing-glove',
    workouts: [
      workout('combat.boxing', 'Boxing', 'boxing-glove', G.crimson),
      workout('combat.mma', 'MMA', 'mixed-martial-arts', G.ember),
      workout('combat.martial-arts', 'Martial Arts', 'karate', G.plum),
      workout('combat.fencing', 'Fencing', 'fencing', G.steel),
    ],
  },
  {
    id: 'outdoor',
    name: 'Snow & Water',
    addLabel: 'Add snow & water',
    icon: 'ski',
    workouts: [
      workout('outdoor.ski', 'Ski', 'ski', G.sky),
      workout('outdoor.snowboard', 'Snowboard', 'snowboard', G.indigo),
      workout('outdoor.xc-ski', 'Cross-Country Ski', 'ski-cross-country', G.steel),
      workout('outdoor.surf', 'Surf', 'surfing', G.lagoon),
      workout('outdoor.kayak', 'Kayak', 'kayaking', G.ocean),
      workout('outdoor.sail', 'Sailing', 'sail-boat', G.slate),
      workout('outdoor.skate', 'Skating', 'roller-skate', G.rose),
    ],
  },
  {
    id: 'other',
    name: 'Other',
    addLabel: 'Add activity',
    icon: 'dots-horizontal',
    workouts: [
      workout('other.golf', 'Golf', 'golf', G.moss),
      workout('other.dance', 'Dance', 'dance-ballroom', G.magenta),
      workout('other.horse', 'Horse Riding', 'horse', G.sand),
      workout('other.skateboard', 'Skateboarding', 'skateboard', G.slate),
      workout('other.rest', 'Rest Day', 'sofa', G.mint),
      workout('other.custom', 'Custom', 'star-four-points-outline', G.steel),
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

export function getWorkoutType(id: string): ResolvedWorkoutType | undefined {
  return WORKOUTS_BY_ID.get(id);
}

/** Case-insensitive match on workout or sport name, e.g. "tempo", "swim", "pad". */
export function searchWorkoutTypes(query: string): ResolvedWorkoutType[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ALL_WORKOUT_TYPES.filter(
    (w) => w.name.toLowerCase().includes(q) || w.sport.name.toLowerCase().includes(q),
  );
}
