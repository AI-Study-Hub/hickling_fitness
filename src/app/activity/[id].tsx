import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActivityEditor } from '@/components/activity-editor';
import { Colors } from '@/constants/theme';
import { useActivities } from '@/store/activities';

export default function EditActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const activity = useActivities((s) => s.activities[id]);

  if (!activity) {
    return (
      <View style={styles.missing}>
        <Text style={styles.text}>This session no longer exists.</Text>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.link}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return <ActivityEditor activity={activity} defaultDate={activity.date} />;
}

const styles = StyleSheet.create({
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.backgroundAlt,
  },
  text: {
    color: Colors.textMuted,
    fontSize: 15,
  },
  link: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
});
