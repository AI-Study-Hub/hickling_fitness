import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BuiltWorkout } from '@/coach/contract';
import { toWorkoutPlan } from '@/coach/apply';
import { AiWorkoutBuilder } from '@/components/ai-workout-builder';
import { PillButton } from '@/components/pill-button';
import { WorkoutDetails } from '@/components/workout-details';
import { WorkoutTypePicker } from '@/components/workout-type-picker';
import { Colors, Radius, Type } from '@/constants/theme';
import { getWorkoutType, type WorkoutType } from '@/data/sports';
import { addDays, formatLongDate, formatRelativeDate, todayISO, type ISODate } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { type Activity, useActivities } from '@/store/activities';

interface Props {
  /** Present when editing an existing activity. */
  activity?: Activity;
  defaultDate: ISODate;
  defaultTypeId?: string;
}

const digits = (text: string) => text.replace(/[^0-9]/g, '');
const decimal = (text: string) => text.replace(',', '.').replace(/[^0-9.]/g, '');

export function ActivityEditor({ activity, defaultDate, defaultTypeId }: Props) {
  const insets = useSafeAreaInsets();
  const today = todayISO();
  const addActivity = useActivities((s) => s.addActivity);
  const updateActivity = useActivities((s) => s.updateActivity);
  const removeActivity = useActivities((s) => s.removeActivity);
  const setLastSportId = useActivities((s) => s.setLastSportId);

  const [typeId, setTypeId] = useState(activity?.workoutTypeId ?? defaultTypeId);
  const type = typeId ? getWorkoutType(typeId) : undefined;
  const unit = type?.sport.distanceUnit;

  // Time is entered in minutes for every sport.
  const initialMinutes = activity?.durationSec ? String(Math.round(activity.durationSec / 60)) : '';
  const [title, setTitle] = useState(activity?.title ?? type?.name ?? '');
  const [date, setDate] = useState(activity?.date ?? defaultDate);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [distance, setDistance] = useState(() => {
    if (!activity?.distanceKm) return '';
    return unit === 'm' ? String(Math.round(activity.distanceKm * 1000)) : String(activity.distanceKm);
  });
  const [notes, setNotes] = useState(activity?.notes ?? '');
  const [workout, setWorkout] = useState(activity?.workout);
  const [completed, setCompleted] = useState(activity?.completed ?? defaultDate < today);

  const heading = activity ? 'Edit session' : 'Add session';

  const chooseType = (workout: WorkoutType) => {
    const previous = type;
    setTypeId(workout.id);
    // Keep a custom title, but follow the type if the title was still the default.
    if (!title.trim() || title === previous?.name) setTitle(workout.name);
    const resolved = getWorkoutType(workout.id);
    if (resolved) setLastSportId(resolved.sport.id);
  };

  const distanceKm = () => {
    const value = Number(distance || 0);
    return unit && value > 0 ? (unit === 'm' ? value / 1000 : value) : undefined;
  };

  /** A workout from the AI builder: fills in whatever the athlete left empty. */
  const applyBuilt = (built: BuiltWorkout) => {
    setWorkout(toWorkoutPlan(built.workout));
    if (!title.trim() || title === type?.name) setTitle(built.title);
    if (!minutes && built.durationSec) setMinutes(String(Math.round(built.durationSec / 60)));
    if (unit && !distance && built.distanceKm) {
      setDistance(unit === 'm' ? String(Math.round(built.distanceKm * 1000)) : String(built.distanceKm));
    }
    if (!notes.trim() && built.notes) setNotes(built.notes);
  };

  const save = () => {
    if (!type) return;
    // Keep seconds from a recorded time unless the minutes were changed.
    const durationSec = activity && minutes === initialMinutes ? activity.durationSec : Number(minutes || 0) * 60;
    const input = {
      workoutTypeId: type.id,
      title: title.trim() || type.name,
      date,
      durationSec: durationSec && durationSec > 0 ? durationSec : undefined,
      distanceKm: distanceKm(),
      notes: notes.trim() || undefined,
      completed,
      workout,
    };
    if (activity) updateActivity(activity.id, input);
    else addActivity(input);
    haptics.success();
    router.back();
  };

  const confirmDelete = () => {
    if (!activity) return;
    Alert.alert('Delete session?', `"${activity.title}" will be removed from your calendar.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeActivity(activity.id);
          router.back();
        },
      },
    ]);
  };

  const topBar = (
    <View style={styles.topBar}>
      <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
        <Text style={styles.topBarButton}>Cancel</Text>
      </Pressable>
      <Text style={styles.topBarTitle}>{heading}</Text>
      <View style={styles.topBarSpacer} />
    </View>
  );

  if (!type) {
    return (
      <View style={styles.container}>
        {topBar}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <Text style={styles.pickTitle}>What are you doing?</Text>
          <Text style={styles.pickSubtitle}>{formatLongDate(date)}</Text>
          <WorkoutTypePicker onSelect={chooseType} />
        </ScrollView>
      </View>
    );
  }

  const relative = formatRelativeDate(date, today);

  return (
    <View style={styles.container}>
      {topBar}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 32 }]}>
        <LinearGradient colors={type.gradient} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.banner}>
          <MaterialCommunityIcons name={type.icon} size={120} color="rgba(255,255,255,0.25)" style={styles.bannerWatermark} />
          <View style={styles.bannerText}>
            <Text style={styles.bannerSport}>{type.sport.name}</Text>
            <Text style={styles.bannerName}>{type.name}</Text>
          </View>
          {!activity && (
            <Pressable onPress={() => setTypeId(undefined)} hitSlop={8} style={styles.changeButton}>
              <Text style={styles.changeText}>Change</Text>
            </Pressable>
          )}
        </LinearGradient>

        <Field label="Title">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={type.name}
            placeholderTextColor={Colors.textSubtle}
            style={styles.input}
            returnKeyType="done"
          />
        </Field>

        <Field label="Date">
          <View style={styles.dateRow}>
            <Pressable onPress={() => setDate((d) => addDays(d, -1))} hitSlop={10} accessibilityLabel="Previous day">
              <Ionicons name="chevron-back" size={24} color={Colors.text} />
            </Pressable>
            <View style={styles.dateLabel}>
              <Text style={styles.dateMain}>{relative}</Text>
              {relative !== formatLongDate(date) && <Text style={styles.dateSub}>{formatLongDate(date)}</Text>}
            </View>
            <Pressable onPress={() => setDate((d) => addDays(d, 1))} hitSlop={10} accessibilityLabel="Next day">
              <Ionicons name="chevron-forward" size={24} color={Colors.text} />
            </Pressable>
          </View>
        </Field>

        <Field label="Time">
          <View style={styles.inline}>
            <NumberBox value={minutes} onChange={(t) => setMinutes(digits(t))} suffix="min" wide />
          </View>
        </Field>

        {unit && (
          <Field label="Distance">
            <View style={styles.inline}>
              <NumberBox
                value={distance}
                onChange={(t) => setDistance(unit === 'm' ? digits(t) : decimal(t))}
                suffix={unit}
                wide
                decimalPad={unit === 'km'}
              />
            </View>
          </Field>
        )}

        {workout && (
          <Field label="Workout">
            <WorkoutDetails plan={workout} color={type.color} icon={type.icon} />
            <Pressable onPress={() => setWorkout(undefined)} hitSlop={8} accessibilityRole="button" style={styles.removeWorkout}>
              <Text style={styles.removeText}>Remove workout</Text>
            </Pressable>
          </Field>
        )}

        <AiWorkoutBuilder
          workoutTypeId={type.id}
          sportName={type.sport.name}
          date={date}
          title={title}
          durationMin={Number(minutes) || undefined}
          distanceKm={distanceKm()}
          notes={notes}
          color={type.color}
          icon={type.icon}
          distanceUnit={unit}
          hasWorkout={!!workout}
          onUse={applyBuilt}
        />

        <Field label="Notes">
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="How did it feel? Targets, sets, splits…"
            placeholderTextColor={Colors.textSubtle}
            style={[styles.input, styles.notes]}
            multiline
          />
        </Field>

        <View style={[styles.field, styles.switchRow]}>
          <Text style={styles.switchLabel}>Completed</Text>
          <Switch
            value={completed}
            onValueChange={setCompleted}
            trackColor={{ true: Colors.accent, false: Colors.surfaceBorder }}
          />
        </View>

        <PillButton
          label={activity ? 'Save changes' : 'Add to calendar'}
          onPress={save}
          style={styles.save}
        />

        {activity && (
          <Pressable onPress={confirmDelete} style={styles.delete} accessibilityRole="button">
            <Text style={styles.deleteText}>Delete session</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function NumberBox({
  value,
  onChange,
  suffix,
  wide,
  decimalPad,
}: {
  value: string;
  onChange: (text: string) => void;
  suffix: string;
  wide?: boolean;
  decimalPad?: boolean;
}) {
  return (
    <View style={[styles.numberBox, wide && styles.numberBoxWide]}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={Colors.textSubtle}
        keyboardType={decimalPad ? 'decimal-pad' : 'number-pad'}
        style={styles.numberInput}
        maxLength={wide ? 7 : 3}
      />
      <Text style={styles.numberSuffix}>{suffix}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundAlt,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  topBarButton: {
    color: Colors.textMuted,
    fontSize: 16,
    width: 70,
  },
  topBarTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  topBarSpacer: {
    width: 70,
  },
  pickTitle: {
    ...Type.title,
    color: Colors.text,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  pickSubtitle: {
    ...Type.body,
    color: Colors.textSubtle,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
  },
  form: {
    paddingHorizontal: 16,
    gap: 12,
  },
  banner: {
    height: 110,
    borderRadius: Radius.md,
    overflow: 'hidden',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bannerWatermark: {
    position: 'absolute',
    right: -10,
    bottom: -24,
  },
  bannerText: {
    flex: 1,
  },
  bannerSport: {
    ...Type.caps,
    color: 'rgba(255,255,255,0.85)',
  },
  bannerName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  changeButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  changeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  field: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  fieldLabel: {
    ...Type.caps,
    fontSize: 11,
    color: Colors.textSubtle,
  },
  input: {
    color: Colors.text,
    fontSize: 16,
    paddingVertical: 4,
  },
  notes: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateLabel: {
    alignItems: 'center',
  },
  dateMain: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  dateSub: {
    color: Colors.textSubtle,
    fontSize: 12,
    marginTop: 2,
  },
  inline: {
    flexDirection: 'row',
    gap: 10,
  },
  numberBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundAlt,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    height: 44,
    gap: 6,
  },
  numberBoxWide: {
    flexGrow: 0,
    flexBasis: 170,
  },
  numberInput: {
    flex: 1,
    minWidth: 0,
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'right',
    height: '100%',
  },
  numberSuffix: {
    color: Colors.textSubtle,
    fontSize: 14,
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  save: {
    marginTop: 8,
  },
  removeWorkout: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  removeText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  delete: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  deleteText: {
    color: Colors.danger,
    fontSize: 15,
    fontWeight: '600',
  },
});
