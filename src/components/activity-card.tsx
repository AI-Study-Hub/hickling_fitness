import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';
import { getWorkoutType } from '@/data/sports';
import { formatActivitySummary } from '@/lib/format';
import type { Activity } from '@/store/activities';

/** Fixed so calendar rows have predictable heights (see calendar `getItemLayout`). */
export const ACTIVITY_CARD_HEIGHT = 46;
/** Width of a card in the calendar's per-day carousel. */
export const ACTIVITY_CARD_WIDTH = 204;

interface Props {
  activity: Activity;
  onPress: () => void;
  onToggleCompleted?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ActivityCard({ activity, onPress, onToggleCompleted, style }: Props) {
  const type = getWorkoutType(activity.workoutTypeId);
  const summary =
    formatActivitySummary(activity, type?.sport.distanceUnit) || type?.sport.name || 'Activity';
  const accent = type?.color ?? Colors.marker;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${activity.title}, ${summary}${activity.completed ? ', completed' : ''}`}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}>
      <View style={[styles.strip, { backgroundColor: accent }]} />
      {type && <MaterialCommunityIcons name={type.icon} size={18} color={accent} style={styles.icon} />}
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
        {activity.completed && <Ionicons name="checkmark" size={13} color={Colors.textOnLight} />}
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
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
  },
  cardPressed: {
    backgroundColor: Colors.surfacePressed,
  },
  strip: {
    width: 5,
    alignSelf: 'stretch',
  },
  icon: {
    marginLeft: 8,
  },
  body: {
    flex: 1,
    paddingLeft: 7,
    paddingRight: 9,
    gap: 1,
  },
  title: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  summary: {
    color: Colors.textSubtle,
    fontSize: 12,
    fontWeight: '500',
  },
  check: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 8,
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
