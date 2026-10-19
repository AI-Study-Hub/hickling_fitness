import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AthleteProfilePatch, Choices, PendingToolOutput, PlanOutline, Proposal } from '@/coach/contract';

export type ProposalStatus = 'pending' | 'accepted' | 'declined';

export interface ProposalView extends Proposal {
  status: ProposalStatus;
  /** How many changes were saved when accepted (some can be skipped if the calendar moved on). */
  applied?: number;
}

/** pending → building (writers at work) → built; or declined, or superseded by a revised outline. */
export type OutlineStatus = 'pending' | 'building' | 'built' | 'declined' | 'superseded';

export interface OutlineView extends PlanOutline {
  status: OutlineStatus;
  /** Sessions saved once built. */
  saved?: number;
}

export type CoachMessage =
  | { id: string; role: 'user'; text: string; at: number }
  | {
      id: string;
      role: 'coach';
      text: string;
      at: number;
      proposals?: ProposalView[];
      /** A plan outline waiting for approval (the workouts are written once it's approved). */
      outline?: OutlineView;
      choices?: Choices | null;
      /** Set once the athlete has answered the choices. */
      answered?: boolean;
      error?: string;
    }
  /** App notes in the thread, e.g. "6 sessions added to your calendar". */
  | { id: string; role: 'note'; text: string; at: number };

interface CoachState {
  profile: AthleteProfilePatch;
  /** OpenAI response id that continues the conversation; null starts a new one. */
  lastResponseId: string | null;
  /** Tool outputs OpenAI hasn't seen yet (after offer_choices); sent first on the next turn. */
  pendingToolOutputs: PendingToolOutput[];
  messages: CoachMessage[];
  addMessage: (message: CoachMessage) => void;
  updateMessage: (id: string, patch: Partial<CoachMessage>) => void;
  updateProposal: (messageId: string, proposalId: string, patch: Partial<ProposalView>) => void;
  /** Updates the outline with this id, wherever it is in the thread. */
  updateOutline: (outlineId: string, patch: Partial<OutlineView>) => void;
  setThread: (lastResponseId: string | null, pendingToolOutputs: PendingToolOutput[]) => void;
  mergeProfile: (patch: AthleteProfilePatch) => void;
  /** Replaces the profile (edited on the "Your details" screen). */
  setProfile: (profile: AthleteProfilePatch) => void;
  /** Starts a new conversation; the profile is kept. */
  newConversation: () => void;
}

export const newMessageId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const useCoach = create<CoachState>()(
  persist(
    (set) => ({
      profile: {},
      lastResponseId: null,
      pendingToolOutputs: [],
      messages: [],
      addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
      updateMessage: (id, patch) =>
        set((s) => ({
          messages: s.messages.map((m) => (m.id === id ? ({ ...m, ...patch } as CoachMessage) : m)),
        })),
      updateProposal: (messageId, proposalId, patch) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId && m.role === 'coach'
              ? { ...m, proposals: m.proposals?.map((p) => (p.id === proposalId ? { ...p, ...patch } : p)) }
              : m,
          ),
        })),
      updateOutline: (outlineId, patch) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.role === 'coach' && m.outline?.id === outlineId ? { ...m, outline: { ...m.outline, ...patch } } : m,
          ),
        })),
      setThread: (lastResponseId, pendingToolOutputs) => set({ lastResponseId, pendingToolOutputs }),
      mergeProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      setProfile: (profile) => set({ profile }),
      newConversation: () => set({ messages: [], lastResponseId: null, pendingToolOutputs: [] }),
    }),
    {
      name: 'hickling.coach',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** The newest outline still waiting for approval (or being written), if any. */
export function pendingOutline(messages: CoachMessage[]): OutlineView | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'coach' && m.outline) return m.outline.status === 'pending' || m.outline.status === 'building' ? m.outline : null;
  }
  return null;
}

