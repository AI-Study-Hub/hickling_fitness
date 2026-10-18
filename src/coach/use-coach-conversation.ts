import { useRef, useState } from 'react';

import { todayISO } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { useActivities } from '@/store/activities';
import { newMessageId, useCoach } from '@/store/coach';

import { planApplication } from './apply';
import { CoachUnavailableError, sendTurn } from './client';
import type { TurnEvent } from './contract';
import { buildSnapshot } from './snapshot';

export interface LiveReply {
  text: string;
  working: string | null;
}

/**
 * Drives the coach conversation: sends turns, streams the reply into `live`, then commits it to the
 * persisted thread. Accepting a proposal applies it to the calendar and tells the coach.
 */
export function useCoachConversation() {
  const [live, setLive] = useState<LiveReply | null>(null);
  const [failed, setFailed] = useState<TurnEvent | null>(null);
  const abort = useRef<AbortController | null>(null);

  const runTurn = async (event: TurnEvent) => {
    const coach = useCoach.getState();
    setFailed(null);
    setLive({ text: '', working: null });
    abort.current = new AbortController();
    const today = todayISO();
    let text = '';
    try {
      await sendTurn(
        {
          previousResponseId: coach.lastResponseId,
          event,
          snapshot: buildSnapshot(useActivities.getState().activities, coach.profile, today),
        },
        (line) => {
          if (line.type === 'delta') {
            text += line.text;
            setLive({ text, working: null });
          } else if (line.type === 'working') {
            setLive({ text, working: line.label });
          } else if (line.type === 'done') {
            const state = useCoach.getState();
            state.mergeProfile(line.profile);
            state.setLastResponseId(line.responseId);
            state.addMessage({
              id: newMessageId(),
              role: 'coach',
              text: line.text || text,
              at: Date.now(),
              choices: line.choices,
              proposals: line.proposals.map((p) => ({ ...p, status: 'pending' })),
            });
            if (line.proposals.length) haptics.success();
          } else if (line.type === 'error') {
            if (line.resetThread) useCoach.getState().setLastResponseId(null);
            throw new Error(line.message);
          }
        },
        abort.current.signal,
      );
    } catch (error) {
      setFailed(event);
      useCoach.getState().addMessage({
        id: newMessageId(),
        role: 'coach',
        text,
        at: Date.now(),
        error:
          error instanceof CoachUnavailableError
            ? `${error.message} Make sure \`npm run dev\` is running on your Mac and you're on the same Wi-Fi.`
            : `Something went wrong: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setLive(null);
      abort.current = null;
    }
  };

  const busy = live !== null;

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const { messages, addMessage, updateMessage } = useCoach.getState();
    // Answering by typing also closes any open choices.
    const last = messages.at(-1);
    if (last?.role === 'coach' && last.choices && !last.answered) updateMessage(last.id, { answered: true });
    addMessage({ id: newMessageId(), role: 'user', text: trimmed, at: Date.now() });
    void runTurn({ kind: 'message', text: trimmed });
  };

  return {
    live,
    busy,
    canRetry: !busy && failed !== null,
    send,

    retry() {
      if (failed && !busy) void runTurn(failed);
    },

    stop() {
      abort.current?.abort();
    },

    accept(messageId: string, proposalId: string) {
      if (busy) return;
      const coach = useCoach.getState();
      const message = coach.messages.find((m) => m.id === messageId);
      const proposal = message?.role === 'coach' ? message.proposals?.find((p) => p.id === proposalId) : undefined;
      if (!proposal || proposal.status !== 'pending') return;

      const store = useActivities.getState();
      const plan = planApplication(proposal, store.activities, todayISO());
      plan.creates.forEach((a) => store.addActivity(a));
      plan.updates.forEach(({ id, changes }) => store.updateActivity(id, changes));
      plan.deletes.forEach((id) => store.removeActivity(id));
      const applied = plan.creates.length + plan.updates.length + plan.deletes.length;

      coach.updateProposal(messageId, proposalId, { status: 'accepted', applied });
      coach.addMessage({
        id: newMessageId(),
        role: 'note',
        text: `Saved ${applied} change${applied === 1 ? '' : 's'} to your calendar${
          plan.skipped.length ? ` · skipped ${plan.skipped.length} (calendar had changed)` : ''
        }`,
        at: Date.now(),
      });
      haptics.success();
      void runTurn({ kind: 'proposal_decision', proposalId, decision: 'accepted', applied });
    },

    decline(messageId: string, proposalId: string) {
      if (busy) return;
      const coach = useCoach.getState();
      coach.updateProposal(messageId, proposalId, { status: 'declined' });
      coach.addMessage({ id: newMessageId(), role: 'note', text: 'Plan declined', at: Date.now() });
      void runTurn({ kind: 'proposal_decision', proposalId, decision: 'declined' });
    },

    choose(messageId: string, answer: string) {
      if (busy) return;
      useCoach.getState().updateMessage(messageId, { answered: true });
      send(answer);
    },
  };
}
