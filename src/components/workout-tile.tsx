import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Radius } from '@/constants/theme';
import type { WorkoutType } from '@/data/sports';

interface Props {
  workout: WorkoutType;
  width: number;
  onPress: () => void;
}

/** Gradient tile with a small icon, label, and a large faded icon cropped bottom-right. */
export function WorkoutTile({ workout, width, onPress }: Props) {
  const height = Math.round(width * 0.68);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={workout.name}
      style={({ pressed }) => [{ width, height, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
      <LinearGradient
        colors={workout.gradient}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.tile}>
        <MaterialCommunityIcons
          name={workout.icon}
          size={height * 0.92}
          color="rgba(255,255,255,0.28)"
          style={[styles.watermark, { right: -height * 0.18, bottom: -height * 0.2 }]}
        />
        <MaterialCommunityIcons name={workout.icon} size={22} color="#fff" />
        <Text style={styles.label} numberOfLines={2}>
          {workout.name}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: Radius.md,
    padding: 12,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  watermark: {
    position: 'absolute',
  },
  label: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
