import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import type { IconName } from '@/data/sports';
import { describeStep, type StepKind, type WorkoutPlan } from '@/data/workout';

const KIND_LABEL: Record<StepKind, string> = {
  warmup: 'Warm up',
  work: 'Work',
  recovery: 'Recover',
  cooldown: 'Cool down',
  rest: 'Rest',
};

/**
 * Read-only view of a structured workout: summary, then each block with its repeat count. Every step shows
 * the sport's icon (the app has one icon per sport) — in the session colour for work, muted otherwise.
 */
export function WorkoutDetails({ plan, color, icon }: { plan: WorkoutPlan; color: string; icon?: IconName }) {
  return (
    <View style={styles.container}>
      <Text style={styles.summary}>{plan.summary}</Text>
      {plan.blocks.map((block, b) => (
        <View key={b} style={[styles.block, block.repeat > 1 && styles.repeatBlock]}>
          {block.repeat > 1 && <Text style={styles.repeat}>{block.repeat} ×</Text>}
          {block.steps.map((step, i) => (
            <View key={i} style={styles.step}>
              {icon ? (
                <MaterialCommunityIcons
                  name={icon}
                  size={17}
                  color={step.kind === 'work' ? color : Colors.textSubtle}
                  style={styles.stepIcon}
                />
              ) : (
                <View style={[styles.stepIcon, styles.noIcon]} />
              )}
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{step.label ?? KIND_LABEL[step.kind]}</Text>
                {!!describeStep(step) && <Text style={styles.stepMeta}>{describeStep(step)}</Text>}
                {!!step.notes && <Text style={styles.stepNotes}>{step.notes}</Text>}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  summary: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  block: {
    gap: 8,
  },
  repeatBlock: {
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.surfaceBorder,
    padding: 10,
  },
  repeat: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  step: {
    flexDirection: 'row',
    gap: 10,
  },
  stepIcon: {
    width: 20,
    marginTop: 1,
  },
  noIcon: {
    height: 17,
  },
  stepBody: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  stepMeta: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  stepNotes: {
    color: Colors.textSubtle,
    fontSize: 12,
  },
});
