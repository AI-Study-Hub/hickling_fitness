import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { OutlineSession, OutlineWeek } from '@/coach/contract';
import { outlineTotals } from '@/coach/outline';
import { ReviewLine } from '@/components/coach/review-line';
import { Colors, Radius } from '@/constants/theme';
import { getWorkoutType } from '@/data/sports';
import { dayOfMonth, formatWeekRange, WEEKDAYS_SHORT, weekdayIndex } from '@/lib/dates';
import { formatDurationShort } from '@/lib/format';
import type { OutlineView } from '@/store/coach';

const INTENSITY_LABEL = { easy: 'Easy', moderate: 'Sub-threshold', hard: 'Hard' } as const;

function SessionRow({ session }: { session: OutlineSession }) {
  const type = getWorkoutType(session.workoutTypeId);
  const meta = [
    type?.name,
    session.distanceKm ? `${session.distanceKm} km` : null,
    session.durationMin ? formatDurationShort(session.durationMin * 60) : null,
    INTENSITY_LABEL[session.intensity],
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.row}>
      <View style={styles.dateCol}>
        <Text style={styles.dateDay}>{WEEKDAYS_SHORT[weekdayIndex(session.date)]}</Text>
        <Text style={styles.dateNum}>{dayOfMonth(session.date)}</Text>
      </View>
      <View style={[styles.iconBadge, { backgroundColor: type?.color ?? Colors.marker }]}>
        {type && <MaterialCommunityIcons name={type.icon} size={15} color="#fff" />}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {session.title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {meta}
        </Text>
        <Text style={styles.brief}>{session.brief}</Text>
      </View>
    </View>
  );
}

function WeekSection({ number, week, initiallyOpen }: { number: number; week: OutlineWeek; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const minutes = week.sessions.reduce((t, s) => t + (s.durationMin ?? 0), 0);
  const meta = [
    formatWeekRange(week.weekStart),
    `${week.sessions.length} session${week.sessions.length === 1 ? '' : 's'}`,
    minutes ? formatDurationShort(minutes * 60) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.weekHead}>
        <View style={styles.rowBody}>
          <Text style={styles.weekTitle}>
            Week {number}
            {week.label ? <Text style={styles.weekLabel}> · {week.label}</Text> : null}
          </Text>
          <Text style={styles.rowMeta}>{meta}</Text>
          {open && !!week.focus && <Text style={styles.focus}>{week.focus}</Text>}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSubtle} />
      </Pressable>
      {open && week.sessions.map((s) => <SessionRow key={s.id} session={s} />)}
    </View>
  );
}

interface Props {
  outline: OutlineView;
  disabled: boolean;
  onApprove: () => void;
  onDecline: () => void;
}

/**
 * The plan's structure for approval: weeks with their labels, sessions with their briefs, and what the reviewer
 * changed. Approving sends it to the session writers; the written sessions are saved to the calendar.
 */
export function OutlineCard({ outline, disabled, onApprove, onDecline }: Props) {
  const { weeks, sessions } = outlineTotals(outline);
  const old = outline.status === 'superseded' || outline.status === 'declined';

  return (
    <View style={[styles.card, old && styles.old]}>
      <View style={styles.header}>
        <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
        <Text style={styles.kicker}>
          Plan outline · {weeks} week{weeks === 1 ? '' : 's'} · {sessions} session{sessions === 1 ? '' : 's'}
        </Text>
      </View>
      <Text style={styles.summary}>{outline.summary}</Text>
      {outline.review && !old && <ReviewLine summary={outline.review.summary} changes={outline.review.changes} />}

      {!old && (
        <View style={styles.rows}>
          {outline.weeks.map((week, i) => (
            <WeekSection key={week.weekStart} number={i + 1} week={week} initiallyOpen={i === 0} />
          ))}
        </View>
      )}

      {outline.status === 'pending' && (
        <>
          <Text style={styles.hint}>Want changes? Just tell your coach. Workouts are written once you approve.</Text>
          <View style={styles.buttons}>
            <Pressable
              onPress={onDecline}
              disabled={disabled}
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, styles.decline, (pressed || disabled) && styles.dim]}>
              <Text style={styles.declineText}>Decline</Text>
            </Pressable>
            <Pressable
              onPress={onApprove}
              disabled={disabled}
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, styles.approve, (pressed || disabled) && styles.dim]}>
              <Text style={styles.approveText}>Approve</Text>
            </Pressable>
          </View>
        </>
      )}
      {outline.status === 'building' && (
        <View style={styles.status}>
          <ActivityIndicator size="small" color={Colors.textMuted} />
          <Text style={styles.statusText}>Writing your sessions…</Text>
        </View>
      )}
      {outline.status === 'built' && (
        <View style={styles.status}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.accent} />
          <Text style={styles.statusText}>Approved · {outline.saved ?? sessions} sessions in your calendar</Text>
        </View>
      )}
      {old && (
        <View style={styles.status}>
          <Ionicons name="close-circle" size={16} color={Colors.textSubtle} />
          <Text style={styles.statusText}>{outline.status === 'declined' ? 'Declined' : 'Replaced by a newer version'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.surfaceBorder,
    padding: 14,
    gap: 8,
  },
  old: {
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kicker: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  summary: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  rows: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
  },
  weekHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  weekTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  weekLabel: {
    color: Colors.accent,
    fontWeight: '600',
  },
  focus: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  dateCol: {
    width: 32,
    alignItems: 'center',
  },
  dateDay: {
    color: Colors.textSubtle,
    fontSize: 10,
    fontWeight: '600',
  },
  dateNum: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  rowMeta: {
    color: Colors.textSubtle,
    fontSize: 12,
  },
  brief: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  hint: {
    color: Colors.textSubtle,
    fontSize: 12,
    marginTop: 4,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  button: {
    flex: 1,
    height: 42,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decline: {
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  approve: {
    backgroundColor: Colors.light,
  },
  dim: {
    opacity: 0.6,
  },
  declineText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  approveText: {
    color: Colors.textOnLight,
    fontSize: 15,
    fontWeight: '700',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
