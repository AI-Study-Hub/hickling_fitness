import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { WorkoutTile } from '@/components/workout-tile';
import type { WorkoutType } from '@/data/sports';

const COLUMNS = 3;
const GAP = 8;

interface Props {
  workouts: WorkoutType[];
  onSelect: (workout: WorkoutType) => void;
  /** Horizontal padding around the grid, used to size tiles to the screen. */
  inset?: number;
}

export function WorkoutGrid({ workouts, onSelect, inset = 12 }: Props) {
  const { width } = useWindowDimensions();
  const tileWidth = Math.floor((Math.min(width, 600) - inset * 2 - GAP * (COLUMNS - 1)) / COLUMNS);
  return (
    <View style={[styles.grid, { paddingHorizontal: inset }]}>
      {workouts.map((workout) => (
        <WorkoutTile key={workout.id} workout={workout} width={tileWidth} onPress={() => onSelect(workout)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
});
