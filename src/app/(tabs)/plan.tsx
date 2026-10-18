import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { upcomingCoachSessions } from '@/coach/apply';
import { knownDetails } from '@/coach/profile-fields';
import { useCoachConversation } from '@/coach/use-coach-conversation';
import { ChoiceChips, CoachBubble, LiveBubble, NoteLine, UserBubble } from '@/components/coach/messages';
import { ProposalCard } from '@/components/coach/proposal-card';
import { WeekBalance } from '@/components/coach/week-balance';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, Radius, Type } from '@/constants/theme';
import { todayISO } from '@/lib/dates';
import { useActivities } from '@/store/activities';
import { useCoach } from '@/store/coach';

const STARTERS = ['Build me a training plan', 'Plan my next week', 'Review my last week', "I'm feeling tired today"];

function Intro({ onPick }: { onPick: (text: string) => void }) {
  return (
    <View style={styles.intro}>
      <View style={styles.badge}>
        <Text style={styles.badgeGlyph}>h.</Text>
      </View>
      <Text style={styles.introTitle}>Your coach</Text>
      <Text style={styles.introText}>
        {'I build your training around the Norwegian method — mostly easy, with controlled sub-threshold ' +
          "sessions — across running, riding, swimming, strength and Hyrox. Tell me what you're aiming for and " +
          "I'll ask a few questions first. Nothing goes in your calendar until you accept it. Each chat starts " +
          'fresh, but I remember the key details about you — tap the person icon to see or edit them.'}
      </Text>
      <View style={styles.starters}>
        {STARTERS.map((s) => (
          <Pressable
            key={s}
            onPress={() => onPick(s)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.starter, pressed && styles.pressed]}>
            <Text style={styles.starterText}>{s}</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.textSubtle} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function PlanScreen() {
  const messages = useCoach((s) => s.messages);
  const newConversation = useCoach((s) => s.newConversation);
  const activities = useActivities((s) => s.activities);
  const conv = useCoachConversation();
  const [draft, setDraft] = useState('');
  const scroll = useRef<ScrollView>(null);

  const lastCoachIndex = messages.findLastIndex((m) => m.role === 'coach');

  const send = () => {
    if (!draft.trim() || conv.busy) return;
    conv.send(draft);
    setDraft('');
  };

  // Two ways to start fresh: a new chat on top of the current plan, or a new chat with the coach's upcoming
  // sessions cleared. Either way the athlete's details are kept.
  const confirmNew = () => {
    const known = knownDetails(useCoach.getState().profile);
    const planned = upcomingCoachSessions(useActivities.getState().activities, todayISO());
    const keeps = known.length
      ? `Your coach keeps your details (${known.slice(0, 4).join(', ').toLowerCase()}${known.length > 4 ? '…' : ''}).`
      : 'Your coach keeps your details as it learns them.';
    const clear = planned.length
      ? `\n\n“Clear plan” also removes the ${planned.length} upcoming session${planned.length === 1 ? '' : 's'} it planned, so you can start a new plan from scratch. Your own and completed sessions stay.`
      : '';
    Alert.alert('Start a new chat?', keeps + clear, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'New chat', onPress: newConversation },
      ...(planned.length
        ? [
            {
              text: 'New chat + clear plan',
              style: 'destructive' as const,
              onPress: () => {
                const { removeActivity } = useActivities.getState();
                planned.forEach(removeActivity);
                newConversation();
              },
            },
          ]
        : []),
    ]);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader
        title="Plan"
        right={
          <>
            <Pressable onPress={() => router.push('/coach-details')} hitSlop={10} accessibilityLabel="Your details">
              <Ionicons name="person-circle-outline" size={26} color={Colors.text} />
            </Pressable>
            {messages.length > 0 && (
              <Pressable onPress={confirmNew} hitSlop={10} accessibilityLabel="New chat" disabled={conv.busy}>
                <Ionicons name="create-outline" size={25} color={Colors.text} />
              </Pressable>
            )}
          </>
        }
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroll}
          style={styles.flex}
          contentContainerStyle={styles.thread}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
          <WeekBalance />

          {messages.length === 0 && !conv.live && <Intro onPick={conv.send} />}

          {messages.map((m, i) => {
            if (m.role === 'user') return <UserBubble key={m.id} text={m.text} />;
            if (m.role === 'note') return <NoteLine key={m.id} text={m.text} />;
            return (
              <View key={m.id} style={styles.coachTurn}>
                {(!!m.text || !!m.error) && <CoachBubble text={m.text} error={m.error} />}
                {m.proposals?.map((p) => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    activities={activities}
                    disabled={conv.busy}
                    onAccept={() => conv.accept(m.id, p.id)}
                    onDecline={() => conv.decline(m.id, p.id)}
                  />
                ))}
                {m.choices && !m.answered && i === lastCoachIndex && (
                  <ChoiceChips choices={m.choices} disabled={conv.busy} onAnswer={(a) => conv.choose(m.id, a)} />
                )}
              </View>
            );
          })}

          {conv.live && <LiveBubble live={conv.live} />}

          {conv.canRetry && (
            <Pressable onPress={conv.retry} accessibilityRole="button" style={styles.retry}>
              <Ionicons name="refresh" size={16} color={Colors.text} />
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          )}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={conv.busy ? 'Coach is replying…' : 'Message your coach'}
            placeholderTextColor={Colors.textSubtle}
            style={styles.input}
            multiline
            editable={!conv.busy}
            onSubmitEditing={send}
            submitBehavior="submit"
            returnKeyType="send"
          />
          {conv.busy ? (
            <Pressable onPress={conv.stop} hitSlop={8} accessibilityLabel="Stop" style={styles.sendButton}>
              <Ionicons name="stop" size={16} color={Colors.textOnLight} />
            </Pressable>
          ) : (
            <Pressable
              onPress={send}
              disabled={!draft.trim()}
              hitSlop={8}
              accessibilityLabel="Send"
              style={[styles.sendButton, !draft.trim() && styles.sendDisabled]}>
              <Ionicons name="arrow-up" size={20} color={Colors.textOnLight} />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  thread: {
    padding: 16,
    gap: 12,
  },
  coachTurn: {
    gap: 10,
  },
  intro: {
    alignItems: 'center',
    paddingTop: 24,
    gap: 10,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  badgeGlyph: {
    color: '#1B1416',
    fontSize: 24,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  introTitle: {
    ...Type.title,
    color: Colors.text,
    marginTop: 6,
  },
  introText: {
    ...Type.body,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 8,
  },
  starters: {
    alignSelf: 'stretch',
    gap: 8,
    marginTop: 10,
  },
  starter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: Radius.md,
    backgroundColor: Colors.backgroundAlt,
  },
  starterText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    backgroundColor: Colors.surface,
  },
  retry: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  retryText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    opacity: 0.35,
  },
});
