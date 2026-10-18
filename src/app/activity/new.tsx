import { useLocalSearchParams } from 'expo-router';

import { ActivityEditor } from '@/components/activity-editor';
import { todayISO } from '@/lib/dates';

/** Params: `date` (YYYY-MM-DD), `type` (workout type id), `record` ("1" when logging a finished workout). */
export default function NewActivityScreen() {
  const { date, type, record } = useLocalSearchParams<{ date?: string; type?: string; record?: string }>();
  return <ActivityEditor defaultDate={date ?? todayISO()} defaultTypeId={type} record={record === '1'} />;
}
