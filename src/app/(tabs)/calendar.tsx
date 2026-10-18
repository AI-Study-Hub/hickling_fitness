import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ACTIVITY_CARD_HEIGHT, ACTIVITY_CARD_WIDTH, ActivityCard } from '@/components/activity-card';
import { ScreenHeader } from '@/components/screen-header';
import { Colors } from '@/constants/theme';
import {
  addDays,
  dayOfMonth,
  formatLongDate,
  formatWeekRange,
  startOfWeek,
  todayISO,
  WEEKDAYS_SHORT,
  weekdayIndex,
  type ISODate,
} from '@/lib/dates';
import { formatDistance, formatDurationShort } from '@/lib/format';
import { totalsBySport } from '@/lib/progress';
import { type Activity, useActivities, useActivitiesByDate } from '@/store/activities';

const WEEKS_BEFORE = 26;
const INITIAL_WEEKS_AFTER = 52;
const WEEK_GAP = 14;
const WEEK_TITLE_HEIGHT = 62;
const DAY_HEIGHT = ACTIVITY_CARD_HEIGHT + 16;
const REST_DAY_HEIGHT = 44;

type Row =
  | { kind: 'week'; key: string; weekStart: ISODate; activities: Activity[]; past: boolean }
  | { kind: 'day'; key: string; date: ISODate; activities: Activity[]; past: boolean; restDay: boolean };

const rowHeight = (row: Row) => {
  if (row.kind === 'week') return WEEK_GAP + WEEK_TITLE_HEIGHT;
  return row.restDay ? REST_DAY_HEIGHT : DAY_HEIGHT;
};

function openNew(date: ISODate) {
  router.push({ pathname: '/activity/new', params: { date } });
}

/** "Total:" followed by one figure per sport in the week, e.g. run 24.6 km · strength 1h. */
function WeekTotals({ activities }: { activities: Activity[] }) {
  const bySport = totalsBySport(activities);
  if (bySport.length === 0) return null;
  return (
    <View style={styles.totals}>
      <Text style={styles.totalsLabel}>Total:</Text>
      {bySport.map(({ sport, totals }) => (
        <View key={sport.id} style={styles.totalItem}>
          <MaterialCommunityIcons name={sport.icon} size={13} color={sport.color} />
          <Text style={styles.totalValue}>
            {sport.distanceUnit && totals.distanceKm > 0
              ? formatDistance(totals.distanceKm, sport.distanceUnit)
              : totals.durationSec > 0
                ? formatDurationShort(totals.durationSec)
                : `${totals.count}×`}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function CalendarScreen() {
  const today = todayISO();
  const listRef = useRef<FlatList<Row>>(null);
  const [weeksAfter, setWeeksAfter] = useState(INITIAL_WEEKS_AFTER);
  const byDate = useActivitiesByDate();
  const toggleCompleted = useActivities((s) => s.toggleCompleted);

  const { rows, offsets, anchorIndex } = useMemo(() => {
    const result: Row[] = [];
    const currentWeek = startOfWeek(today);
    let weekStart = addDays(currentWeek, -7 * WEEKS_BEFORE);
    for (let w = 0; w < WEEKS_BEFORE + weeksAfter; w++) {
      const past = weekStart < currentWeek;
      const days = Array.from({ length: 7 }, (_, d) => addDays(weekStart, d));
      result.push({
        kind: 'week',
        key: `w${weekStart}`,
        weekStart,
        past,
        activities: days.flatMap((date) => byDate.get(date) ?? []),
      });
      for (const date of days) {
        const activities = byDate.get(date) ?? [];
        result.push({ kind: 'day', key: date, date, activities, past, restDay: date < today && !activities.length });
      }
      weekStart = addDays(weekStart, 7);
    }
    const offs: number[] = [];
    let y = 0;
    for (const row of result) {
      offs.push(y);
      y += rowHeight(row);
    }
    // Open with the day before today at the top, like Runna, so today isn't jammed against the header.
    const todayIndex = result.findIndex((r) => r.kind === 'day' && r.date === today);
    return { rows: result, offsets: offs, anchorIndex: Math.max(0, todayIndex - 1) };
  }, [byDate, today, weeksAfter]);

  const scrollToToday = () => listRef.current?.scrollToIndex({ index: anchorIndex, animated: true });

  const showTips = () =>
    Alert.alert(
      'Calendar tips',
      '• Tap + Add on any day to schedule a session.\n' +
        '• Swipe sideways when a day has more than one session.\n' +
        '• Tap a session to edit it, move it to another day, or delete it.\n' +
        '• Tap the circle on a session to mark it done.\n' +
        '• Tap the date icon to jump back to today.',
    );

  const renderRow = ({ item }: { item: Row }) => {
    const tint = item.past && styles.pastWeek;

    if (item.kind === 'week') {
      return (
        <View style={{ height: rowHeight(item) }}>
          <View style={styles.weekGap} />
          <View style={[styles.weekTitleRow, tint]}>
            <Text style={styles.weekTitle}>{formatWeekRange(item.weekStart)}</Text>
            <WeekTotals activities={item.activities} />
          </View>
        </View>
      );
    }

    const { date, activities, restDay } = item;
    const isToday = date === today;
    return (
      <View style={[styles.dayRow, { height: rowHeight(item) }, tint]}>
        <View style={[styles.dayLabelCol, restDay && styles.dayLabelColCompact]}>
          <Text style={styles.dayLabel}>{WEEKDAYS_SHORT[weekdayIndex(date)]}</Text>
          <View style={[styles.dateCircle, isToday && styles.todayCircle, restDay && styles.dateCompact]}>
            <Text
              style={[
                styles.dateText,
                date < today && styles.pastDate,
                isToday && styles.todayDate,
                restDay && styles.dateTextCompact,
              ]}>
              {dayOfMonth(date)}
            </Text>
          </View>
        </View>

        {restDay ? (
          <Pressable
            onPress={() => openNew(date)}
            accessibilityRole="button"
            accessibilityLabel={`Rest day, ${formatLongDate(date)}. Add a session`}
            style={styles.restDay}>
            <Text style={styles.restDayText}>Rest day</Text>
          </Pressable>
        ) : activities.length === 0 ? (
          <Pressable
            onPress={() => openNew(date)}
            accessibilityRole="button"
            accessibilityLabel={`Add session on ${formatLongDate(date)}`}
            style={styles.addButton}>
            <Ionicons name="add" size={24} color={Colors.textMuted} />
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
            contentContainerStyle={styles.carouselContent}>
            {activities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                style={styles.card}
                onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}
                onToggleCompleted={() => toggleCompleted(activity.id)}
              />
            ))}
            <Pressable
              onPress={() => openNew(date)}
              accessibilityRole="button"
              accessibilityLabel={`Add another session on ${formatLongDate(date)}`}
              style={styles.addMore}>
              <Ionicons name="add" size={20} color={Colors.textMuted} />
            </Pressable>
          </ScrollView>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <ScreenHeader
          title="Calendar"
          right={
            <>
              <Pressable onPress={scrollToToday} hitSlop={8} accessibilityLabel="Jump to today">
                <View style={styles.todayIcon}>
                  <Text style={styles.todayIconText}>{dayOfMonth(today)}</Text>
                </View>
              </Pressable>
              <Pressable onPress={showTips} hitSlop={8} accessibilityLabel="Calendar tips">
                <Ionicons name="bulb-outline" size={27} color={Colors.text} />
              </Pressable>
            </>
          }
        />
      </View>
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        getItemLayout={(_, index) => ({ length: rowHeight(rows[index]), offset: offsets[index], index })}
        initialScrollIndex={anchorIndex}
        initialNumToRender={24}
        windowSize={11}
        onEndReached={() => setWeeksAfter((w) => w + 26)}
        onEndReachedThreshold={2}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  todayIcon: {
    width: 29,
    height: 29,
    borderRadius: 6,
    borderWidth: 2,
    borderTopWidth: 5,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayIconText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '800',
    marginTop: -2,
  },
  pastWeek: {
    backgroundColor: Colors.pastWeek,
  },
  weekGap: {
    height: WEEK_GAP,
    backgroundColor: Colors.backgroundAlt,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  weekTitleRow: {
    flex: 1,
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  weekTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  totals: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  totalsLabel: {
    color: Colors.textSubtle,
    fontSize: 13,
  },
  totalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  totalValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  dayLabelCol: {
    width: 58,
    alignItems: 'center',
    gap: 1,
  },
  dayLabelColCompact: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dayLabel: {
    color: Colors.textSubtle,
    fontSize: 12,
    fontWeight: '500',
  },
  dateCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCompact: {
    width: 'auto',
    height: 'auto',
  },
  todayCircle: {
    backgroundColor: Colors.light,
  },
  dateText: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '500',
  },
  dateTextCompact: {
    fontSize: 12,
  },
  pastDate: {
    color: Colors.textSubtle,
  },
  todayDate: {
    color: Colors.textOnLight,
    fontWeight: '600',
  },
  restDay: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingLeft: 14,
  },
  restDayText: {
    color: Colors.textSubtle,
    fontSize: 15,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingVertical: 8,
    paddingRight: 24,
  },
  addText: {
    color: Colors.textMuted,
    fontSize: 16,
    fontWeight: '500',
  },
  carousel: {
    flex: 1,
    alignSelf: 'stretch',
  },
  carouselContent: {
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 16,
  },
  card: {
    width: ACTIVITY_CARD_WIDTH,
  },
  addMore: {
    width: 30,
    height: ACTIVITY_CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
