import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import { SPORTS, type Sport } from '@/data/sports';
import { haptics } from '@/lib/haptics';

interface Props {
  selectedId: string;
  onSelect: (sport: Sport) => void;
  /** Horizontal padding so chips line up with the content edge but scroll to the screen edge. */
  inset?: number;
}

export function SportChips({ selectedId, onSelect, inset = 16 }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, { paddingHorizontal: inset }]}>
      {SPORTS.map((sport) => {
        const selected = sport.id === selectedId;
        return (
          <Pressable
            key={sport.id}
            onPress={() => {
              haptics.selection();
              onSelect(sport);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.chip, selected && styles.chipSelected]}>
            <MaterialCommunityIcons
              name={sport.icon}
              size={18}
              color={selected ? Colors.textOnLight : Colors.textMuted}
            />
            <Text style={[styles.label, selected && styles.labelSelected]}>{sport.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  chipSelected: {
    backgroundColor: Colors.light,
    borderColor: Colors.light,
  },
  label: {
    color: Colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  labelSelected: {
    color: Colors.textOnLight,
  },
});
