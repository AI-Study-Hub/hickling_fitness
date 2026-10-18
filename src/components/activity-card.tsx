import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { getWorkoutType } from '@/data/sports';
import { formatActivitySummary } from '@/lib/format';
import type { Activity } from '@/store/activities';

/** Fixed so calendar rows have predictable heights (see calendar `getItemLayout`). */
export const ACTIVITY_CARD_HEIGHT = 52;

interface Props {
  activity: Activity;
  onPress: () => void;
  onToggleCompleted?: () => void;
}

export function ActivityCard({ activity, onPress, onToggleCompleted }: Props) {
  const type = getWorkoutType(activity.workoutTypeId);
  const summary =
    formatActivitySummary(activity, type?.sport.distanceUnit) || type?.sport.name || 'Activity';
  const accent = type?.gradient[1] ?? Colors.marker;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${activity.title}, ${summary}${activity.completed ? ', completed' : ''}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={[styles.strip, { backgroundColor: activity.completed ? Colors.marker : accent }]} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {activity.title}
        </Text>
        <Text style={styles.summary} numberOfLines={1}>
          {summary}
        </Text>
      </View>
      <Pressable
        onPress={onToggleCompleted}
        hitSlop={10}
        disabled={!onToggleCompleted}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: activity.completed }}
        style={[styles.check, activity.completed ? styles.checkDone : styles.checkTodo]}>
        {activity.completed && <Ionicons name="checkmark" size={15} color={Colors.textOnLight} />}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: ACTIVITY_CARD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
  },
  cardPressed: {
    backgroundColor: Colors.surfacePressed,
  },
  strip: {
    width: 6,
    alignSelf: 'stretch',
  },
  body: {
    flex: 1,
    paddingHorizontal: 10,
    gap: 2,
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  summary: {
    color: Colors.textSubtle,
    fontSize: 13,
    fontWeight: '500',
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: {
    backgroundColor: Colors.light,
  },
  checkTodo: {
    borderWidth: 1.5,
    borderColor: Colors.textSubtle,
  },
});
