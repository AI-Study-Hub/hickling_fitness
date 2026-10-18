import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ACTIVITY_CARD_HEIGHT, ActivityCard } from '@/components/activity-card';
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
import { type Activity, useActivities, useActivitiesByDate } from '@/store/activities';

const WEEKS_BEFORE = 26;
const INITIAL_WEEKS_AFTER = 52;
const WEEK_GAP = 16;
const WEEK_TITLE_HEIGHT = 68;
const DAY_MIN_HEIGHT = 68;
const DAY_PADDING = 8;
const CARD_GAP = 6;

type Row =
  | { kind: 'week'; key: string; weekStart: ISODate }
  | { kind: 'day'; key: string; date: ISODate; activities: Activity[] };

function dayRowHeight(activityCount: number): number {
  if (activityCount === 0) return DAY_MIN_HEIGHT;
  const content = DAY_PADDING * 2 + activityCount * ACTIVITY_CARD_HEIGHT + (activityCount - 1) * CARD_GAP;
  return Math.max(DAY_MIN_HEIGHT, content);
}

const rowHeight = (row: Row) =>
  row.kind === 'week' ? WEEK_GAP + WEEK_TITLE_HEIGHT : dayRowHeight(row.activities.length);

function openNew(date: ISODate) {
  router.push({ pathname: '/activity/new', params: { date } });
}

export default function CalendarScreen() {
  const today = todayISO();
  const listRef = useRef<FlatList<Row>>(null);
  const [weeksAfter, setWeeksAfter] = useState(INITIAL_WEEKS_AFTER);
  const byDate = useActivitiesByDate();
  const toggleCompleted = useActivities((s) => s.toggleCompleted);

  const { rows, offsets, anchorIndex } = useMemo(() => {
    const result: Row[] = [];
    let weekStart = addDays(startOfWeek(today), -7 * WEEKS_BEFORE);
    for (let w = 0; w < WEEKS_BEFORE + weeksAfter; w++) {
      result.push({ kind: 'week', key: `w${weekStart}`, weekStart });
      for (let d = 0; d < 7; d++) {
        const date = addDays(weekStart, d);
        result.push({ kind: 'day', key: date, date, activities: byDate.get(date) ?? [] });
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
        '• Tap a session to edit it, move it to another day, or delete it.\n' +
        '• Tap the circle on a session to mark it done.\n' +
        '• Tap the date icon to jump back to today.',
    );

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'week') {
      return (
        <View style={{ height: rowHeight(item) }}>
          <View style={styles.weekGap} />
          <View style={styles.weekTitleRow}>
            <Text style={styles.weekTitle}>{formatWeekRange(item.weekStart)}</Text>
          </View>
        </View>
      );
    }

    const { date, activities } = item;
    const isToday = date === today;
    return (
      <View style={[styles.dayRow, { height: rowHeight(item) }]}>
        <View style={styles.dayLabelCol}>
          <Text style={styles.dayLabel}>{WEEKDAYS_SHORT[weekdayIndex(date)]}</Text>
          <View style={[styles.dateCircle, isToday && styles.todayCircle]}>
            <Text style={[styles.dateText, date < today && styles.pastDate, isToday && styles.todayDate]}>
              {dayOfMonth(date)}
            </Text>
          </View>
        </View>

        {activities.length === 0 ? (
          <Pressable
            onPress={() => openNew(date)}
            accessibilityRole="button"
            accessibilityLabel={`Add session on ${formatLongDate(date)}`}
            style={styles.addButton}>
            <Ionicons name="add" size={30} color={Colors.textMuted} />
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        ) : (
          <>
            <View style={styles.cards}>
              {activities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}
                  onToggleCompleted={() => toggleCompleted(activity.id)}
                />
              ))}
            </View>
            <Pressable
              onPress={() => openNew(date)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Add another session on ${formatLongDate(date)}`}
              style={styles.addMore}>
              <Ionicons name="add" size={24} color={Colors.textMuted} />
            </Pressable>
          </>
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
                <Ionicons name="bulb-outline" size={30} color={Colors.text} />
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
        initialNumToRender={20}
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
    width: 32,
    height: 32,
    borderRadius: 7,
    borderWidth: 2,
    borderTopWidth: 6,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayIconText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '800',
    marginTop: -2,
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
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  weekTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
    paddingRight: 12,
  },
  dayLabelCol: {
    width: 64,
    alignItems: 'center',
    gap: 2,
  },
  dayLabel: {
    color: Colors.textSubtle,
    fontSize: 13,
    fontWeight: '500',
  },
  dateCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: {
    backgroundColor: Colors.light,
  },
  dateText: {
    color: Colors.text,
    fontSize: 19,
    fontWeight: '500',
  },
  pastDate: {
    color: Colors.textSubtle,
  },
  todayDate: {
    color: Colors.textOnLight,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 14,
    paddingVertical: 10,
    paddingRight: 24,
  },
  addText: {
    color: Colors.textMuted,
    fontSize: 18,
    fontWeight: '500',
  },
  cards: {
    flex: 1,
    maxWidth: 280,
    marginLeft: 22,
    gap: CARD_GAP,
  },
  addMore: {
    marginLeft: 'auto',
    padding: 6,
  },
});
