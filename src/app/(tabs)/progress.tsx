import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressChart } from '@/components/progress-chart';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, Radius, Type } from '@/constants/theme';
import { getSport, getWorkoutType, SPORTS, type DistanceUnit, type IconName } from '@/data/sports';
import {
  addDays,
  formatWeekRange,
  parseISODate,
  startOfWeek,
  todayISO,
  WEEKDAYS_SHORT,
  weekdayIndex,
} from '@/lib/dates';
import { formatDistance, formatDurationShort, formatPace } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import {
  ALL_SPORTS,
  completedFor,
  sumActivities,
  weeklySeries,
  weeklyStreak,
  type SportFilter,
  type Totals,
} from '@/lib/progress';
import { type Activity, useActivities } from '@/store/activities';

const WEEKS = 12;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Metric = 'distance' | 'time' | 'count';

/** Sport tabs show their sport's icon; "All" is text only (icons are reserved for the five sports). */
const TABS: { id: SportFilter; label: string; icon?: IconName }[] = [
  { id: ALL_SPORTS, label: 'All' },
  ...SPORTS.map((s) => ({ id: s.id, label: s.name, icon: s.icon })),
];

const METRIC_LABELS: Record<Metric, string> = { distance: 'Distance', time: 'Time', count: 'Sessions' };

/** Chart value for a week in display units: km or m, hours, or session count. */
function metricValue(totals: Totals, metric: Metric, unit?: DistanceUnit): number {
  if (metric === 'distance') return unit === 'm' ? totals.distanceKm * 1000 : totals.distanceKm;
  if (metric === 'time') return totals.durationSec / 3600;
  return totals.count;
}

function tickLabel(value: number, metric: Metric, unit?: DistanceUnit): string {
  const n = Number(value.toFixed(1)).toLocaleString('en-GB');
  if (metric === 'distance') return `${n} ${unit ?? 'km'}`;
  if (metric === 'time') return `${n}h`;
  return n;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

/** The three headline numbers for a period: distance/time/sessions, or time/sessions/average. */
function StatRow({ totals, unit }: { totals: Totals; unit?: DistanceUnit }) {
  return (
    <View style={styles.statRow}>
      {unit ? (
        <>
          <Stat label="Distance" value={formatDistance(totals.distanceKm, unit)} />
          <Stat label="Time" value={formatDurationShort(totals.durationSec)} />
          <Stat label="Sessions" value={String(totals.count)} />
        </>
      ) : (
        <>
          <Stat label="Time" value={formatDurationShort(totals.durationSec)} />
          <Stat label="Sessions" value={String(totals.count)} />
          <Stat
            label="Avg session"
            value={totals.count ? formatDurationShort(totals.durationSec / totals.count) : '–'}
          />
        </>
      )}
    </View>
  );
}

function SessionRow({ activity }: { activity: Activity }) {
  const type = getWorkoutType(activity.workoutTypeId);
  const date = parseISODate(activity.date);
  const day = WEEKDAYS_SHORT[weekdayIndex(activity.date)];
  const pace = type ? formatPace(activity, type.sport.id) : undefined;
  const parts = [
    type?.sport.distanceUnit && activity.distanceKm ? formatDistance(activity.distanceKm, type.sport.distanceUnit) : null,
    activity.durationSec ? formatDurationShort(activity.durationSec) : null,
    pace ?? null,
  ].filter(Boolean);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id } })}
      style={({ pressed }) => [styles.listRow, pressed && styles.listRowPressed]}>
      <View style={[styles.listIcon, { backgroundColor: type?.color ?? Colors.marker }]}>
        {type && <MaterialCommunityIcons name={type.icon} size={18} color="#fff" />}
      </View>
      <View style={styles.listBody}>
        <Text style={styles.listTitle} numberOfLines={1}>
          {activity.title}
        </Text>
        <Text style={styles.listMeta} numberOfLines={1}>
          {day.charAt(0) + day.slice(1).toLowerCase()} {date.getDate()} {MONTHS[date.getMonth()]}
          {parts.length ? `  ·  ${parts.join('  ·  ')}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

export default function ProgressScreen() {
  const activities = useActivities((s) => s.activities);
  const lastSportId = useActivities((s) => s.lastSportId);
  const [filter, setFilter] = useState<SportFilter>(() => (getSport(lastSportId) ? lastSportId : 'run'));
  const [metricChoice, setMetricChoice] = useState<Metric>('distance');
  const [selected, setSelected] = useState(WEEKS - 1);

  const today = todayISO();
  const sport = filter === ALL_SPORTS ? undefined : getSport(filter);
  const unit = sport?.distanceUnit;
  const metrics: Metric[] = unit ? ['distance', 'time', 'count'] : ['time', 'count'];
  const metric = metrics.includes(metricChoice) ? metricChoice : metrics[0];

  const completed = useMemo(() => completedFor(Object.values(activities), filter), [activities, filter]);
  const series = useMemo(() => weeklySeries(completed, startOfWeek(today), WEEKS), [completed, today]);
  const year = today.slice(0, 4);
  const yearTotals = useMemo(() => sumActivities(completed.filter((a) => a.date.startsWith(year))), [completed, year]);
  const allTimeTotals = useMemo(() => sumActivities(completed), [completed]);
  const streak = useMemo(() => weeklyStreak(completed, startOfWeek(today)), [completed, today]);

  const week = series[selected];
  const weekSessions = completed
    .filter((a) => a.date >= week.weekStart && a.date <= addDays(week.weekStart, 6))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const weekLabel =
    selected === WEEKS - 1 ? 'This week' : selected === WEEKS - 2 ? 'Last week' : formatWeekRange(week.weekStart);

  const chooseTab = (id: SportFilter) => {
    if (id === filter) return;
    haptics.selection();
    setFilter(id);
    setSelected(WEEKS - 1);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader title="Progress" />

      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((tab) => {
          const active = tab.id === filter;
          return (
            <Pressable
              key={tab.id}
              onPress={() => chooseTab(tab.id)}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: active }}
              style={styles.tab}>
              {tab.icon ? (
                <MaterialCommunityIcons name={tab.icon} size={22} color={active ? Colors.text : Colors.tabInactive} />
              ) : (
                <Text style={[styles.tabAll, active && styles.tabLabelActive]}>All</Text>
              )}
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
                {tab.icon ? tab.label : ' '}
              </Text>
              <View style={[styles.tabUnderline, active && styles.tabUnderlineActive]} />
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.periodLabel}>{weekLabel}</Text>
        <StatRow totals={week.totals} unit={unit} />

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Past {WEEKS} weeks</Text>
            <View style={styles.metricSwitch}>
              {metrics.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMetricChoice(m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: m === metric }}
                  style={[styles.metricOption, m === metric && styles.metricOptionActive]}>
                  <Text style={[styles.metricText, m === metric && styles.metricTextActive]}>{METRIC_LABELS[m]}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <ProgressChart
            values={series.map((w) => metricValue(w.totals, metric, unit))}
            weekStarts={series.map((w) => w.weekStart)}
            selectedIndex={selected}
            onSelect={setSelected}
            formatTick={(v) => tickLabel(v, metric, unit)}
          />
          {completed.length === 0 && (
            <Text style={styles.empty}>
              No completed {sport ? sport.name.toLowerCase() : ''} sessions yet — tick one off in your calendar and it
              shows up here.
            </Text>
          )}
        </View>

        <View style={styles.streak}>
          <Ionicons name="calendar-outline" size={22} color={streak ? Colors.chart : Colors.textSubtle} />
          <View>
            <Text style={styles.streakValue}>
              {streak} week{streak === 1 ? '' : 's'}
            </Text>
            <Text style={styles.streakLabel}>Weekly streak · at least one session each week</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          {weekLabel} · {weekSessions.length} session{weekSessions.length === 1 ? '' : 's'}
        </Text>
        {weekSessions.length > 0 ? (
          <View style={styles.list}>
            {weekSessions.map((a) => (
              <SessionRow key={a.id} activity={a} />
            ))}
          </View>
        ) : (
          <Text style={styles.weekEmpty}>Nothing completed — tap another week on the chart.</Text>
        )}

        <Text style={styles.sectionTitle}>{year}</Text>
        <StatRow totals={yearTotals} unit={unit} />

        <Text style={styles.sectionTitle}>All time</Text>
        <StatRow totals={allTimeTotals} unit={unit} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 6,
    gap: 3,
  },
  tabLabel: {
    color: Colors.tabInactive,
    fontSize: 11,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: Colors.text,
  },
  tabAll: {
    height: 22,
    color: Colors.tabInactive,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  tabUnderline: {
    marginTop: 6,
    height: 2,
    alignSelf: 'stretch',
    marginHorizontal: 8,
    borderRadius: 1,
  },
  tabUnderlineActive: {
    backgroundColor: Colors.chart,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 32,
  },
  periodLabel: {
    ...Type.heading,
    color: Colors.text,
  },
  statRow: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 6,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  statLabel: {
    color: Colors.textSubtle,
    fontSize: 12,
    fontWeight: '500',
  },
  statValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  chartCard: {
    marginTop: 14,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundAlt,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  chartTitle: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  metricSwitch: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    padding: 2,
  },
  metricOption: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  metricOptionActive: {
    backgroundColor: Colors.light,
  },
  metricText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  metricTextActive: {
    color: Colors.textOnLight,
  },
  empty: {
    color: Colors.textSubtle,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundAlt,
  },
  streakValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  streakLabel: {
    color: Colors.textSubtle,
    fontSize: 12,
  },
  weekEmpty: {
    color: Colors.textSubtle,
    fontSize: 14,
    marginTop: 8,
  },
  sectionTitle: {
    ...Type.heading,
    color: Colors.text,
    marginTop: 24,
  },
  list: {
    marginTop: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundAlt,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  listRowPressed: {
    backgroundColor: Colors.surface,
  },
  listIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listBody: {
    flex: 1,
    gap: 2,
  },
  listTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  listMeta: {
    color: Colors.textSubtle,
    fontSize: 12,
  },
});
