import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityCard } from '@/components/activity-card';
import { HeroBadge } from '@/components/hero-badge';
import { PillButton } from '@/components/pill-button';
import { ScreenHeader, Wordmark } from '@/components/screen-header';
import { SportChips } from '@/components/sport-chips';
import { WeekStrip } from '@/components/week-strip';
import { WorkoutGrid } from '@/components/workout-grid';
import { Profile } from '@/constants/profile';
import { Colors, Radius, TodayGradient, Type } from '@/constants/theme';
import { getSport, SPORTS } from '@/data/sports';
import { formatRelativeDate, greeting, todayISO } from '@/lib/dates';
import { useActivities, useActivitiesByDate } from '@/store/activities';

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const today = todayISO();
  const [selected, setSelected] = useState(today);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [tilesCollapsed, setTilesCollapsed] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);

  const byDate = useActivitiesByDate();
  const markedDates = useMemo(() => new Set(byDate.keys()), [byDate]);
  const lastSportId = useActivities((s) => s.lastSportId);
  const setLastSportId = useActivities((s) => s.setLastSportId);
  const toggleCompleted = useActivities((s) => s.toggleCompleted);

  const sport = getSport(lastSportId) ?? SPORTS[0];
  const dayActivities = byDate.get(selected) ?? [];
  const isToday = selected === today;

  const count = `${dayActivities.length} session${dayActivities.length === 1 ? '' : 's'}`;
  let subtitle = 'Start a workout or create a plan';
  if (isToday && dayActivities.length > 0) subtitle = `You have ${count} today`;
  else if (!isToday) {
    subtitle = `${formatRelativeDate(selected, today)} · ${dayActivities.length > 0 ? count : 'Nothing planned yet'}`;
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={TodayGradient} locations={[0, 0.35, 0.7, 1]} style={StyleSheet.absoluteFill} />

      <ScrollView
        contentContainerStyle={{ paddingTop: headerHeight + 28, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <HeroBadge />
          <Text style={styles.greeting}>
            {greeting()}, {Profile.firstName}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {dayActivities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{isToday ? "Today's sessions" : formatRelativeDate(selected, today)}</Text>
            <View style={styles.cards}>
              {dayActivities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}
                  onToggleCompleted={() => toggleCompleted(activity.id)}
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.addHeader}>
          <Text style={styles.sectionTitle}>{sport.addLabel}</Text>
          <Pressable
            hitSlop={10}
            onPress={() => setTilesCollapsed((c) => !c)}
            accessibilityRole="button"
            style={styles.collapse}>
            <Text style={styles.collapseText}>{tilesCollapsed ? 'Expand' : 'Collapse'}</Text>
            <Ionicons name={tilesCollapsed ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textSubtle} />
          </Pressable>
        </View>

        {!tilesCollapsed && (
          <View style={styles.picker}>
            <SportChips selectedId={sport.id} onSelect={(s) => setLastSportId(s.id)} inset={12} />
            <WorkoutGrid
              workouts={sport.workouts}
              onSelect={(workout) =>
                router.push({ pathname: '/activity/new', params: { type: workout.id, date: selected } })
              }
            />
          </View>
        )}
      </ScrollView>

      {calendarExpanded && (
        <Pressable
          style={styles.backdrop}
          onPress={() => setCalendarExpanded(false)}
          accessibilityLabel="Close calendar"
        />
      )}

      <View
        style={[styles.header, { paddingTop: insets.top }]}
        onLayout={(e) => {
          if (!calendarExpanded) setHeaderHeight(e.nativeEvent.layout.height);
        }}>
        <ScreenHeader
          title={<Wordmark />}
          right={
            <Pressable hitSlop={10} accessibilityLabel="Notifications">
              <Ionicons name="notifications-outline" size={30} color={Colors.text} />
            </Pressable>
          }
        />
        <WeekStrip
          today={today}
          selected={selected}
          markedDates={markedDates}
          expanded={calendarExpanded}
          onSelect={(date) => {
            setSelected(date);
            setCalendarExpanded(false);
          }}
          onToggleExpanded={() => setCalendarExpanded((e) => !e)}
        />
      </View>

      <PillButton
        label="Record workout"
        icon="play"
        style={styles.record}
        onPress={() => router.push({ pathname: '/activity/new', params: { date: today, record: '1' } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.header,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
    paddingBottom: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
  greeting: {
    ...Type.hero,
    color: Colors.text,
    textAlign: 'center',
    marginTop: 36,
  },
  subtitle: {
    ...Type.body,
    color: Colors.textSubtle,
    textAlign: 'center',
    marginTop: 12,
  },
  section: {
    paddingHorizontal: 12,
    marginBottom: 32,
  },
  sectionTitle: {
    ...Type.title,
    color: Colors.text,
  },
  cards: {
    marginTop: 14,
    gap: 8,
  },
  addHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  collapse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapseText: {
    ...Type.caps,
    fontSize: 15,
    color: Colors.textSubtle,
  },
  picker: {
    gap: 14,
  },
  record: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
  },
});
