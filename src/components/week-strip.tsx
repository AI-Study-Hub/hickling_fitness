import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import {
  addDays,
  dayOfMonth,
  parseISODate,
  startOfWeek,
  toISODate,
  WEEKDAYS_SHORT,
  weekDays,
  type ISODate,
} from '@/lib/dates';
import { haptics } from '@/lib/haptics';

interface Props {
  today: ISODate;
  selected: ISODate;
  markedDates: Set<ISODate>;
  expanded: boolean;
  onSelect: (date: ISODate) => void;
  onToggleExpanded: () => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** First day of the month containing `iso`, as an ISO date. */
const monthStart = (iso: ISODate) => `${iso.slice(0, 7)}-01`;

function monthWeeks(firstOfMonth: ISODate): ISODate[][] {
  const month = firstOfMonth.slice(0, 7);
  const weeks: ISODate[][] = [];
  for (let start = startOfWeek(firstOfMonth); start.slice(0, 7) <= month; start = addDays(start, 7)) {
    weeks.push(weekDays(start));
  }
  return weeks;
}

function shiftMonth(firstOfMonth: ISODate, delta: number): ISODate {
  const date = parseISODate(firstOfMonth);
  date.setMonth(date.getMonth() + delta);
  return toISODate(date);
}

/**
 * Runna-style MON–SUN strip. Tapping the handle underneath expands it into a month grid.
 */
export function WeekStrip({ today, selected, markedDates, expanded, onSelect, onToggleExpanded }: Props) {
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(selected));

  const select = (date: ISODate) => {
    haptics.selection();
    onSelect(date);
  };

  const renderDay = (date: ISODate, dimmed = false) => {
    const isToday = date === today;
    const isSelected = date === selected && !isToday;
    return (
      <Pressable
        key={date}
        onPress={() => select(date)}
        accessibilityRole="button"
        accessibilityLabel={date}
        accessibilityState={{ selected: date === selected }}
        style={styles.dayCell}>
        <View style={[styles.dateCircle, isToday && styles.todayCircle, isSelected && styles.selectedCircle]}>
          <Text style={[styles.dateText, isToday && styles.todayText, dimmed && styles.dimmed]}>
            {dayOfMonth(date)}
          </Text>
        </View>
        <View style={[styles.marker, !markedDates.has(date) && styles.markerHidden]} />
      </Pressable>
    );
  };

  return (
    <View>
      <View style={styles.labels}>
        {WEEKDAYS_SHORT.map((label) => (
          <Text key={label} style={styles.label}>
            {label}
          </Text>
        ))}
      </View>

      {expanded ? (
        <View>
          <View style={styles.monthHeader}>
            <Pressable hitSlop={12} onPress={() => setVisibleMonth((m) => shiftMonth(m, -1))} accessibilityLabel="Previous month">
              <Ionicons name="chevron-back" size={20} color={Colors.textSubtle} />
            </Pressable>
            <Text style={styles.monthTitle}>
              {MONTHS[Number(visibleMonth.slice(5, 7)) - 1]} {visibleMonth.slice(0, 4)}
            </Text>
            <Pressable hitSlop={12} onPress={() => setVisibleMonth((m) => shiftMonth(m, 1))} accessibilityLabel="Next month">
              <Ionicons name="chevron-forward" size={20} color={Colors.textSubtle} />
            </Pressable>
          </View>
          {monthWeeks(visibleMonth).map((week) => (
            <View key={week[0]} style={styles.week}>
              {week.map((date) => renderDay(date, date.slice(0, 7) !== visibleMonth.slice(0, 7)))}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.week}>{weekDays(startOfWeek(selected)).map((date) => renderDay(date))}</View>
      )}

      <Pressable
        onPress={() => {
          haptics.light();
          setVisibleMonth(monthStart(selected));
          onToggleExpanded();
        }}
        hitSlop={{ top: 8, bottom: 16, left: 40, right: 40 }}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse calendar' : 'Expand calendar'}
        style={styles.handleTab}>
        <View style={styles.handleBar} />
      </Pressable>
    </View>
  );
}

const CIRCLE = 38;

const styles = StyleSheet.create({
  labels: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  label: {
    flex: 1,
    textAlign: 'center',
    color: Colors.textSubtle,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  week: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 6,
    gap: 6,
  },
  dateCircle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCircle: {
    backgroundColor: Colors.light,
  },
  selectedCircle: {
    borderWidth: 1.5,
    borderColor: Colors.light,
  },
  dateText: {
    color: Colors.textSubtle,
    fontSize: 19,
    fontWeight: '500',
  },
  todayText: {
    color: Colors.textOnLight,
    fontWeight: '600',
  },
  dimmed: {
    opacity: 0.35,
  },
  marker: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: Colors.marker,
  },
  markerHidden: {
    opacity: 0,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 2,
  },
  monthTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  handleTab: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: -12,
    width: 72,
    height: 14,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: Colors.header,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  handleBar: {
    width: 52,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.handle,
  },
});
