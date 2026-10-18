import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { toWorkoutPlan } from '@/coach/apply';
import type { PlanAction } from '@/coach/contract';
import { WorkoutDetails } from '@/components/workout-details';
import { Colors, Radius } from '@/constants/theme';
import { getWorkoutType } from '@/data/sports';
import { dayOfMonth, formatWeekRange, startOfWeek, WEEKDAYS_SHORT, weekdayIndex } from '@/lib/dates';
import { formatDistance, formatDurationShort } from '@/lib/format';
import type { Activity } from '@/store/activities';
import type { ProposalView } from '@/store/coach';

const INTENSITY_LABEL = { easy: 'Easy', moderate: 'Sub-threshold', hard: 'Hard' } as const;
const OP_LABEL = { create: 'New', update: 'Change', delete: 'Remove' } as const;

interface Props {
  proposal: ProposalView;
  activities: Record<string, Activity>;
  disabled: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

function ActionRow({ action, existing }: { action: PlanAction; existing?: Activity }) {
  const [open, setOpen] = useState(false);
  const date = action.op === 'delete' ? existing?.date : action.date;
  const typeId = action.op === 'delete' ? existing?.workoutTypeId : action.workoutTypeId;
  const type = typeId ? getWorkoutType(typeId) : undefined;
  const title = action.op === 'delete' ? (existing?.title ?? 'Session') : action.title;
  const meta =
    action.op === 'delete'
      ? action.reason
      : [
          type?.name,
          action.distanceKm && type?.sport.distanceUnit ? formatDistance(action.distanceKm, type.sport.distanceUnit) : null,
          action.durationSec ? formatDurationShort(action.durationSec) : null,
          INTENSITY_LABEL[action.workout.intensity],
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
      <View style={styles.row}>
        <View style={styles.dateCol}>
          <Text style={styles.dateDay}>{date ? WEEKDAYS_SHORT[weekdayIndex(date)] : ''}</Text>
          <Text style={styles.dateNum}>{date ? dayOfMonth(date) : ''}</Text>
        </View>
        <View style={[styles.iconBadge, { backgroundColor: type?.color ?? Colors.marker }]}>
          <MaterialCommunityIcons name={type?.icon ?? 'help-circle-outline'} size={15} color="#fff" />
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, action.op === 'delete' && styles.struck]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={open ? undefined : 1}>
            {meta}
          </Text>
        </View>
        <View style={[styles.badge, action.op === 'delete' && styles.badgeRemove]}>
          <Text style={styles.badgeText}>{OP_LABEL[action.op]}</Text>
        </View>
      </View>
      {open && action.op !== 'delete' && (
        <View style={styles.details}>
          {action.op === 'update' && <Text style={styles.reason}>Why: {action.reason}</Text>}
          <WorkoutDetails plan={toWorkoutPlan(action.workout)} color={type?.color ?? Colors.marker} icon={type?.icon} />
        </View>
      )}
    </Pressable>
  );
}

function ReviewLine({ review }: { review: NonNullable<ProposalView['review']> }) {
  const [open, setOpen] = useState(false);
  const approved = review.verdict === 'approve';
  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      disabled={review.notes.length === 0}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={styles.review}>
      <View style={styles.reviewHead}>
        <Ionicons
          name={approved ? 'shield-checkmark' : 'alert-circle'}
          size={16}
          color={approved ? Colors.accent : Colors.chart}
        />
        <Text style={styles.reviewTitle}>{approved ? 'Checked by the reviewer' : 'Reviewer still has concerns'}</Text>
        {review.notes.length > 0 && (
          <Text style={styles.reviewToggle}>
            {open ? 'Hide' : `${review.notes.length} note${review.notes.length === 1 ? '' : 's'}`}
          </Text>
        )}
      </View>
      <Text style={styles.reviewSummary}>{review.summary}</Text>
      {open &&
        review.notes.map((note, i) => (
          <Text key={i} style={styles.reviewNote}>
            • {note}
          </Text>
        ))}
    </Pressable>
  );
}

interface Row {
  action: PlanAction;
  date: string;
  existing?: Activity;
}

/** One week of a multi-week plan: a tappable header with the week's label and totals, rows when open. */
function WeekSection({ number, weekStart, label, rows, initiallyOpen }: {
  number: number;
  weekStart: string;
  label?: string;
  rows: Row[];
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const sessions = rows.filter((r) => r.action.op !== 'delete');
  const seconds = sessions.reduce((t, r) => t + (r.action.op === 'delete' ? 0 : (r.action.durationSec ?? 0)), 0);
  const meta = [
    formatWeekRange(weekStart),
    `${sessions.length} session${sessions.length === 1 ? '' : 's'}`,
    seconds ? formatDurationShort(seconds) : null,
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
            {label ? <Text style={styles.weekLabel}> · {label}</Text> : null}
          </Text>
          <Text style={styles.rowMeta}>{meta}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSubtle} />
      </Pressable>
      {open && rows.map((r, i) => <ActionRow key={i} action={r.action} existing={r.existing} />)}
    </View>
  );
}

/**
 * The coach's proposed calendar changes, with Accept / Decline. A plan spanning several weeks is grouped by
 * week (tap a week to open it); tap a row to see the full workout.
 */
export function ProposalCard({ proposal, activities, disabled, onAccept, onDecline }: Props) {
  const rows: Row[] = proposal.actions
    .map((action) => {
      const existing = action.op === 'create' ? undefined : activities[action.id];
      return { action, existing, date: action.op === 'delete' ? (existing?.date ?? '') : action.date };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const weeks = [...new Set(rows.map((r) => (r.date ? startOfWeek(r.date) : '')))];
  const labels = new Map((proposal.weeks ?? []).map((w) => [w.weekStart, w.label]));
  const count = proposal.actions.length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
        <Text style={styles.kicker}>
          Plan update{weeks.length > 1 ? ` · ${weeks.length} weeks` : ''} · {count} change{count === 1 ? '' : 's'}
        </Text>
      </View>
      <Text style={styles.summary}>{proposal.summary}</Text>
      {proposal.review && <ReviewLine review={proposal.review} />}

      <View style={styles.rows}>
        {weeks.length > 1
          ? weeks.map((week, i) => (
              <WeekSection
                key={week}
                number={i + 1}
                weekStart={week}
                label={labels.get(week)}
                rows={rows.filter((r) => (r.date ? startOfWeek(r.date) : '') === week)}
                initiallyOpen={i === 0}
              />
            ))
          : rows.map((r, i) => <ActionRow key={i} action={r.action} existing={r.existing} />)}
      </View>

      {proposal.status === 'pending' ? (
        <View style={styles.buttons}>
          <Pressable
            onPress={onDecline}
            disabled={disabled}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, styles.decline, (pressed || disabled) && styles.dim]}>
            <Text style={styles.declineText}>Decline</Text>
          </Pressable>
          <Pressable
            onPress={onAccept}
            disabled={disabled}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, styles.accept, (pressed || disabled) && styles.dim]}>
            <Text style={styles.acceptText}>{count > 1 ? 'Accept all' : 'Accept'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.status}>
          <Ionicons
            name={proposal.status === 'accepted' ? 'checkmark-circle' : 'close-circle'}
            size={16}
            color={proposal.status === 'accepted' ? Colors.accent : Colors.textSubtle}
          />
          <Text style={styles.statusText}>
            {proposal.status === 'accepted' ? `Added to your calendar · ${proposal.applied ?? 0} saved` : 'Declined'}
          </Text>
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
  review: {
    gap: 3,
    padding: 10,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  reviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  reviewToggle: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  reviewSummary: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  reviewNote: {
    color: Colors.textSubtle,
    fontSize: 12,
    lineHeight: 17,
  },
  rows: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
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
  struck: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  rowMeta: {
    color: Colors.textSubtle,
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
  },
  badgeRemove: {
    backgroundColor: '#3A2326',
  },
  badgeText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  details: {
    paddingVertical: 10,
    paddingLeft: 42,
    gap: 6,
  },
  reason: {
    color: Colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
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
  accept: {
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
  acceptText: {
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
