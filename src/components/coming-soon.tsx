import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Colors, Type } from '@/constants/theme';

interface Props {
  title: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  message: string;
}

/** Placeholder for tabs that aren't built yet. */
export function ComingSoon({ title, icon, message }: Props) {
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader title={title} />
      <View style={styles.body}>
        <Ionicons name={icon} size={48} color={Colors.textSubtle} />
        <Text style={styles.heading}>Coming soon</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  heading: {
    ...Type.title,
    color: Colors.text,
  },
  message: {
    ...Type.body,
    color: Colors.textSubtle,
    textAlign: 'center',
  },
});
