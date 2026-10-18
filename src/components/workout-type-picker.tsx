import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { SportChips } from '@/components/sport-chips';
import { WorkoutGrid } from '@/components/workout-grid';
import { Colors, Radius } from '@/constants/theme';
import { ALL_WORKOUT_TYPES, getSport, searchWorkoutTypes, SPORTS, type WorkoutType } from '@/data/sports';
import { useActivities } from '@/store/activities';

interface Props {
  onSelect: (workout: WorkoutType) => void;
}

/** Search box, sport chips and tiles — the first step of adding an activity. */
export function WorkoutTypePicker({ onSelect }: Props) {
  const lastSportId = useActivities((s) => s.lastSportId);
  const [sportId, setSportId] = useState(lastSportId);
  const [query, setQuery] = useState('');
  const sport = getSport(sportId) ?? SPORTS[0];
  const results = searchWorkoutTypes(query);

  return (
    <View style={styles.container}>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={Colors.textSubtle} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${ALL_WORKOUT_TYPES.length} activities`}
          placeholderTextColor={Colors.textSubtle}
          style={styles.searchInput}
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {query.trim() ? (
        results.length > 0 ? (
          <WorkoutGrid workouts={results} onSelect={onSelect} inset={16} />
        ) : (
          <Text style={styles.empty}>No matches — try another word, or pick Other → Custom.</Text>
        )
      ) : (
        <>
          <SportChips selectedId={sport.id} onSelect={(s) => setSportId(s.id)} />
          <WorkoutGrid workouts={sport.workouts} onSelect={onSelect} inset={16} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  search: {
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    height: '100%',
  },
  empty: {
    color: Colors.textSubtle,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
  },
});
