import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { toWorkoutPlan } from '@/coach/apply';
import { askWorkoutQuestions, buildWorkout } from '@/coach/client';
import type { BuiltWorkout, WorkoutQuestion, WorkoutRequest } from '@/coach/contract';
import { WorkoutDetails } from '@/components/workout-details';
import { Colors, Radius } from '@/constants/theme';
import type { DistanceUnit, IconName } from '@/data/sports';
import { formatDistance, formatDurationShort } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useCoach } from '@/store/coach';

interface Props {
  workoutTypeId: string;
  sportName: string;
  date: string;
  title: string;
  durationMin?: number;
  distanceKm?: number;
  notes: string;
  color: string;
  icon: IconName;
  distanceUnit?: DistanceUnit;
  /** The session already has a workout ("Rebuild with AI"). */
  hasWorkout: boolean;
  onUse: (built: BuiltWorkout) => void;
}

type Step =
  | { kind: 'idle' }
  | { kind: 'working'; label: string }
  | { kind: 'questions'; questions: WorkoutQuestion[] }
  | { kind: 'result'; built: BuiltWorkout }
  | { kind: 'error'; message: string; retry: () => void };

interface Answer {
  picked: string[];
  other: string;
}

/**
 * "Build workout with AI": asks a few questions specific to the sport, then the sport's specialist writes the
 * workout (it can search the web). The athlete previews it, asks for changes, and uses it for this session.
 */
export function AiWorkoutBuilder(props: Props) {
  const { workoutTypeId, sportName, date, title, durationMin, distanceKm, notes, color, icon, distanceUnit, hasWorkout, onUse } = props;
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [change, setChange] = useState('');
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  const request = (questions: WorkoutQuestion[] = [], extra: Partial<WorkoutRequest> = {}): WorkoutRequest => ({
    workoutTypeId,
    date,
    title: title.trim() || null,
    durationMin: durationMin || null,
    distanceKm: distanceKm || null,
    notes: notes.trim() || null,
    profile: useCoach.getState().profile,
    answers: questions
      .map((q, i) => ({ question: q.question, answer: [...(answers[i]?.picked ?? []), answers[i]?.other.trim()].filter(Boolean).join(', ') }))
      .filter((a) => a.answer),
    ...extra,
  });

  const run = async <T,>(label: string, task: (signal: AbortSignal) => Promise<T>, retry: () => void): Promise<T | null> => {
    abort.current?.abort();
    abort.current = new AbortController();
    setStep({ kind: 'working', label });
    try {
      return await task(abort.current.signal);
    } catch (error) {
      if (abort.current?.signal.aborted) return null;
      setStep({ kind: 'error', message: error instanceof Error ? error.message : String(error), retry });
      return null;
    }
  };

  const build = async (questions: WorkoutQuestion[], current?: BuiltWorkout, changeText?: string) => {
    const req = request(questions, { current: current ?? null, change: changeText ?? null });
    const built = await run(`Building your ${sportName.toLowerCase()} workout…`, (signal) => buildWorkout(req, signal), () =>
      void build(questions, current, changeText),
    );
    if (built) {
      setChange('');
      setStep({ kind: 'result', built });
      haptics.success();
    }
  };

  const start = async () => {
    setAnswers([]);
    const questions = await run('Thinking of a few questions…', (signal) => askWorkoutQuestions(request(), signal), () => void start());
    if (!questions) return;
    if (questions.length === 0) return void build([]);
    setAnswers(questions.map(() => ({ picked: [], other: '' })));
    setStep({ kind: 'questions', questions });
  };

  const toggle = (qi: number, option: string, multi: boolean) => {
    haptics.selection();
    setAnswers((all) =>
      all.map((a, i) => {
        if (i !== qi) return a;
        const on = a.picked.includes(option);
        return { ...a, picked: on ? a.picked.filter((o) => o !== option) : multi ? [...a.picked, option] : [option] };
      }),
    );
  };

  // Questions of the last round, kept for changes after the first build.
  const lastQuestions = useRef<WorkoutQuestion[]>([]);

  if (step.kind === 'idle') {
    return (
      <Pressable onPress={start} accessibilityRole="button" style={({ pressed }) => [styles.panel, styles.entry, pressed && styles.pressed]}>
        <Ionicons name="sparkles" size={20} color={Colors.accent} />
        <View style={styles.entryText}>
          <Text style={styles.entryTitle}>{hasWorkout ? 'Rebuild with AI' : 'Build workout with AI'}</Text>
          <Text style={styles.entrySub}>A few questions, then the full session</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textSubtle} />
      </Pressable>
    );
  }

  if (step.kind === 'working') {
    return (
      <View style={[styles.panel, styles.entry]}>
        <ActivityIndicator size="small" color={Colors.textMuted} />
        <Text style={styles.working}>{step.label}</Text>
      </View>
    );
  }

  if (step.kind === 'error') {
    return (
      <View style={styles.panel}>
        <Text style={styles.error}>{step.message}</Text>
        <View style={styles.links}>
          <Pressable onPress={step.retry} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>Try again</Text>
          </Pressable>
          <Pressable onPress={() => setStep({ kind: 'idle' })} hitSlop={8} accessibilityRole="button">
            <Text style={styles.linkMuted}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (step.kind === 'questions') {
    return (
      <View style={styles.panel}>
        <Text style={styles.heading}>A few questions</Text>
        {step.questions.map((q, qi) => (
          <View key={qi} style={styles.question}>
            <Text style={styles.questionText}>{q.question}</Text>
            <View style={styles.chips}>
              {q.options.map((option) => {
                const on = answers[qi]?.picked.includes(option);
                return (
                  <Pressable
                    key={option}
                    onPress={() => toggle(qi, option, q.multiSelect)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.chip, on && styles.chipOn]}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={answers[qi]?.other ?? ''}
              onChangeText={(other) => setAnswers((all) => all.map((a, i) => (i === qi ? { ...a, other } : a)))}
              placeholder="Or type your own"
              placeholderTextColor={Colors.textSubtle}
              style={styles.other}
            />
          </View>
        ))}
        <Pressable
          onPress={() => {
            lastQuestions.current = step.questions;
            void build(step.questions);
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>Build workout</Text>
        </Pressable>
        <Pressable onPress={() => setStep({ kind: 'idle' })} hitSlop={8} accessibilityRole="button" style={styles.center}>
          <Text style={styles.linkMuted}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  const { built } = step;
  const meta = [built.durationSec ? formatDurationShort(built.durationSec) : null, built.distanceKm ? formatDistance(built.distanceKm, distanceUnit) : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.panel}>
      <View style={styles.resultHead}>
        <Ionicons name="sparkles" size={16} color={Colors.accent} />
        <Text style={styles.resultTitle} numberOfLines={1}>
          {built.title}
        </Text>
        {!!meta && <Text style={styles.resultMeta}>{meta}</Text>}
      </View>
      <WorkoutDetails plan={toWorkoutPlan(built.workout)} color={color} icon={icon} />
      {!!built.notes && <Text style={styles.notes}>{built.notes}</Text>}
      <View style={styles.changeRow}>
        <TextInput
          value={change}
          onChangeText={setChange}
          placeholder="Change something, e.g. longer reps"
          placeholderTextColor={Colors.textSubtle}
          style={[styles.other, styles.changeInput]}
          returnKeyType="send"
          onSubmitEditing={() => change.trim() && void build(lastQuestions.current, built, change.trim())}
        />
        <Pressable
          onPress={() => change.trim() && void build(lastQuestions.current, built, change.trim())}
          disabled={!change.trim()}
          accessibilityRole="button"
          accessibilityLabel="Apply change"
          style={[styles.send, !change.trim() && styles.dim]}>
          <Ionicons name="arrow-up" size={18} color={Colors.textOnLight} />
        </Pressable>
      </View>
      <Pressable
        onPress={() => {
          onUse(built);
          setStep({ kind: 'idle' });
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>Use this workout</Text>
      </Pressable>
      <Pressable onPress={start} hitSlop={8} accessibilityRole="button" style={styles.center}>
        <Text style={styles.linkMuted}>Start over</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: {
    opacity: 0.8,
  },
  entryText: {
    flex: 1,
    gap: 2,
  },
  entryTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  entrySub: {
    color: Colors.textSubtle,
    fontSize: 12,
  },
  working: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: Colors.danger,
    fontSize: 14,
  },
  links: {
    flexDirection: 'row',
    gap: 20,
  },
  link: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  linkMuted: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  center: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  heading: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  question: {
    gap: 8,
  },
  questionText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  chipOn: {
    backgroundColor: Colors.light,
    borderColor: Colors.light,
  },
  chipText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextOn: {
    color: Colors.textOnLight,
  },
  other: {
    color: Colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.backgroundAlt,
  },
  primary: {
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: Colors.textOnLight,
    fontSize: 15,
    fontWeight: '700',
  },
  resultHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  resultMeta: {
    color: Colors.textSubtle,
    fontSize: 12,
    fontWeight: '600',
  },
  notes: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  changeInput: {
    flex: 1,
    minWidth: 0,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: {
    opacity: 0.4,
  },
});
