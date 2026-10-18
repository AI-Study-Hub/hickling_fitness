import { groupByDate, useActivities } from '@/store/activities';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const base = { workoutTypeId: 'run.easy', title: 'Easy Run', date: '2026-10-18', completed: false };

describe('activities store', () => {
  beforeEach(() => useActivities.setState({ activities: {} }));

  it('adds, updates, completes and removes activities', () => {
    const { addActivity, updateActivity, toggleCompleted, removeActivity } = useActivities.getState();
    const a = addActivity({ ...base, distanceKm: 5 });
    expect(useActivities.getState().activities[a.id]).toMatchObject({ title: 'Easy Run', distanceKm: 5 });

    updateActivity(a.id, { date: '2026-10-19', title: 'Moved run' });
    expect(useActivities.getState().activities[a.id]).toMatchObject({ date: '2026-10-19', title: 'Moved run' });

    toggleCompleted(a.id);
    expect(useActivities.getState().activities[a.id].completed).toBe(true);

    removeActivity(a.id);
    expect(useActivities.getState().activities[a.id]).toBeUndefined();
  });

  it('ignores updates to missing activities', () => {
    useActivities.getState().updateActivity('missing', { title: 'x' });
    useActivities.getState().toggleCompleted('missing');
    expect(useActivities.getState().activities).toEqual({});
  });

  it('groups by date in creation order', () => {
    const grouped = groupByDate({
      b: { ...base, id: 'b', createdAt: 2 },
      a: { ...base, id: 'a', createdAt: 1 },
      c: { ...base, id: 'c', date: '2026-10-20', createdAt: 3 },
    });
    expect(grouped.get('2026-10-18')?.map((x) => x.id)).toEqual(['a', 'b']);
    expect(grouped.get('2026-10-20')?.map((x) => x.id)).toEqual(['c']);
  });
});
