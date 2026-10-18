import { StyleSheet, Text, View } from 'react-native';

import { easyShare, intensityOf } from '@/coach/intensity';
import { Colors, Radius } from '@/constants/theme';
import { addDays, startOfWeek, todayISO } from '@/lib/dates';
import { formatDurationShort } from '@/lib/format';
import { useActivities } from '@/store/activities';

/** This week's planned + completed training and its 80/20 split — the Norwegian method at a glance. */
export function WeekBalance() {
  const activities = useActivities((s) => s.activities);
  const monday = startOfWeek(todayISO());
  const sunday = addDays(monday, 6);
  const week = Object.values(activities).filter((a) => a.date >= monday && a.date <= sunday);
  if (week.length === 0) return null;

  const { share } = easyShare(week);
  const quality = week.filter((a) => ['moderate', 'hard'].includes(intensityOf(a))).length;
  const duration = week.reduce((sum, a) => sum + (a.durationSec ?? 0), 0);
  const done = week.filter((a) => a.completed).length;
  const pct = share == null ? null : Math.round(share * 100);

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.title}>This week</Text>
        <Text style={styles.meta}>
          {done}/{week.length} done{duration ? ` · ${formatDurationShort(duration)}` : ''} · {quality} quality
        </Text>
      </View>
      {pct != null && (
        <>
          <View style={styles.bar} accessibilityLabel={`${pct}% easy, ${100 - pct}% quality`}>
            <View style={[styles.easy, { flex: pct }]} />
            <View style={[styles.quality, { flex: 100 - pct }]} />
          </View>
          <View style={styles.legend}>
            <Text style={styles.legendText}>
              <Text style={styles.legendValue}>{pct}%</Text> easy
            </Text>
            <Text style={styles.legendText}>Target 75–80%</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.md,
    padding: 12,
    gap: 8,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  title: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    color: Colors.textSubtle,
    fontSize: 12,
  },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    gap: 2,
  },
  easy: {
    backgroundColor: Colors.accent,
  },
  quality: {
    backgroundColor: Colors.chart,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendText: {
    color: Colors.textSubtle,
    fontSize: 12,
  },
  legendValue: {
    color: Colors.text,
    fontWeight: '700',
  },
});
