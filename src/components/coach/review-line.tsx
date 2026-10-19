import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';

/** "Checked by the reviewer": its one-line summary, and the changes it made (tap to show). */
export function ReviewLine({ summary, changes }: { summary: string; changes: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      disabled={changes.length === 0}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={styles.review}>
      <View style={styles.head}>
        <Ionicons name="shield-checkmark" size={16} color={Colors.accent} />
        <Text style={styles.title}>Checked by the reviewer</Text>
        {changes.length > 0 && (
          <Text style={styles.toggle}>
            {open ? 'Hide' : `${changes.length} change${changes.length === 1 ? '' : 's'}`}
          </Text>
        )}
      </View>
      <Text style={styles.summary}>{summary}</Text>
      {open &&
        changes.map((change, i) => (
          <Text key={i} style={styles.change}>
            • {change}
          </Text>
        ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  review: {
    gap: 3,
    padding: 10,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    flex: 1,
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  toggle: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  summary: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  change: {
    color: Colors.textSubtle,
    fontSize: 12,
    lineHeight: 17,
  },
});
