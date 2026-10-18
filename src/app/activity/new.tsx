import { useLocalSearchParams } from 'expo-router';

import { ActivityEditor } from '@/components/activity-editor';
import { todayISO } from '@/lib/dates';

/** Params: `date` (YYYY-MM-DD) and optionally `type` (workout type id) to skip the picker. */
export default function NewActivityScreen() {
  const { date, type } = useLocalSearchParams<{ date?: string; type?: string }>();
  return <ActivityEditor defaultDate={date ?? todayISO()} defaultTypeId={type} />;
}
