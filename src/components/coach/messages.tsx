import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Choices } from '@/coach/contract';
import type { LiveReply } from '@/coach/use-coach-conversation';
import { Colors, Radius } from '@/constants/theme';

/** Coach text with **bold** support (the model sometimes emphasises a key session). */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={styles.coachText}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <Text key={i} style={styles.bold}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

export function UserBubble({ text }: { text: string }) {
  return (
    <View style={styles.userBubble}>
      <Text style={styles.userText}>{text}</Text>
    </View>
  );
}

export function CoachBubble({ text, error }: { text: string; error?: string }) {
  return (
    <View style={styles.coachBubble}>
      {!!text && <RichText text={text} />}
      {!!error && (
        <View style={styles.errorRow}>
          <Ionicons name="warning-outline" size={16} color={Colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

export function NoteLine({ text }: { text: string }) {
  return (
    <View style={styles.note}>
      <Ionicons name="checkmark-done" size={14} color={Colors.textSubtle} />
      <Text style={styles.noteText}>{text}</Text>
    </View>
  );
}

function TypingDots() {
  const [opacity] = useState(() => new Animated.Value(0.3));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.Text style={[styles.dots, { opacity }]}>●●●</Animated.Text>;
}

export function LiveBubble({ live }: { live: LiveReply }) {
  return (
    <View style={styles.coachBubble}>
      {!!live.text && <RichText text={live.text} />}
      <View style={styles.workingRow}>
        <TypingDots />
        {!!live.working && <Text style={styles.workingText}>{live.working}…</Text>}
      </View>
    </View>
  );
}

/** Tappable answers for a coach question. Single-select sends on tap; multi-select has a Send button. */
export function ChoiceChips({
  choices,
  disabled,
  onAnswer,
}: {
  choices: Choices;
  disabled: boolean;
  onAnswer: (answer: string) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (option: string) =>
    setPicked((p) => (p.includes(option) ? p.filter((o) => o !== option) : [...p, option]));

  return (
    <View style={styles.choices}>
      <Text style={styles.question}>{choices.question}</Text>
      <View style={styles.chipWrap}>
        {choices.options.map((option) => {
          const selected = picked.includes(option);
          return (
            <Pressable
              key={option}
              disabled={disabled}
              onPress={() => (choices.multiSelect ? toggle(option) : onAnswer(option))}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              style={({ pressed }) => [styles.chip, selected && styles.chipSelected, (pressed || disabled) && styles.dim]}>
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      {choices.multiSelect && (
        <Pressable
          disabled={disabled || picked.length === 0}
          onPress={() => onAnswer(picked.join(', '))}
          accessibilityRole="button"
          style={({ pressed }) => [styles.sendChoices, (pressed || disabled || !picked.length) && styles.dim]}>
          <Text style={styles.sendChoicesText}>Send</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    backgroundColor: Colors.light,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  userText: {
    color: Colors.textOnLight,
    fontSize: 15,
    lineHeight: 20,
  },
  coachBubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: Colors.backgroundAlt,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 13,
    paddingVertical: 10,
    gap: 6,
  },
  coachText: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  bold: {
    fontWeight: '700',
  },
  errorRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  errorText: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 19,
  },
  note: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  noteText: {
    color: Colors.textSubtle,
    fontSize: 12,
    fontWeight: '600',
  },
  workingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dots: {
    color: Colors.textMuted,
    fontSize: 10,
    letterSpacing: 2,
  },
  workingText: {
    color: Colors.textSubtle,
    fontSize: 13,
    fontStyle: 'italic',
  },
  choices: {
    gap: 8,
  },
  question: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
  },
  chipSelected: {
    backgroundColor: Colors.light,
    borderColor: Colors.light,
  },
  chipText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: Colors.textOnLight,
  },
  sendChoices: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.light,
  },
  sendChoicesText: {
    color: Colors.textOnLight,
    fontSize: 14,
    fontWeight: '700',
  },
  dim: {
    opacity: 0.55,
  },
});
