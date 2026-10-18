import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { SPORTS } from '@/data/sports';
import type { ISODate } from '@/lib/dates';

export interface Activity {
  id: string;
  workoutTypeId: string;
  title: string;
  date: ISODate;
  durationSec?: number;
  distanceKm?: number;
  notes?: string;
  completed: boolean;
  createdAt: number;
}

export type NewActivity = Omit<Activity, 'id' | 'createdAt'>;

interface ActivitiesState {
  activities: Record<string, Activity>;
  /** Sport shown first in the "Add" pickers — the last one used. */
  lastSportId: string;
  addActivity: (input: NewActivity) => Activity;
  updateActivity: (id: string, changes: Partial<NewActivity>) => void;
  removeActivity: (id: string) => void;
  toggleCompleted: (id: string) => void;
  setLastSportId: (sportId: string) => void;
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const useActivities = create<ActivitiesState>()(
  persist(
    (set) => ({
      activities: {},
      lastSportId: SPORTS[0].id,
      addActivity: (input) => {
        const activity: Activity = { ...input, id: newId(), createdAt: Date.now() };
        set((state) => ({ activities: { ...state.activities, [activity.id]: activity } }));
        return activity;
      },
      updateActivity: (id, changes) =>
        set((state) => {
          const existing = state.activities[id];
          if (!existing) return state;
          return { activities: { ...state.activities, [id]: { ...existing, ...changes } } };
        }),
      removeActivity: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.activities;
          return { activities: rest };
        }),
      toggleCompleted: (id) =>
        set((state) => {
          const existing = state.activities[id];
          if (!existing) return state;
          return {
            activities: { ...state.activities, [id]: { ...existing, completed: !existing.completed } },
          };
        }),
      setLastSportId: (sportId) => set({ lastSportId: sportId }),
    }),
    {
      name: 'hickling.activities',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Groups activities by day, each day sorted by creation order. */
export function groupByDate(activities: Record<string, Activity>): Map<ISODate, Activity[]> {
  const byDate = new Map<ISODate, Activity[]>();
  for (const activity of Object.values(activities)) {
    const list = byDate.get(activity.date);
    if (list) list.push(activity);
    else byDate.set(activity.date, [activity]);
  }
  for (const list of byDate.values()) list.sort((a, b) => a.createdAt - b.createdAt);
  return byDate;
}

export function useActivitiesByDate(): Map<ISODate, Activity[]> {
  const activities = useActivities((state) => state.activities);
  return useMemo(() => groupByDate(activities), [activities]);
}
