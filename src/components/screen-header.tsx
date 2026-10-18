import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Type } from '@/constants/theme';
import { Profile } from '@/constants/profile';

export function Avatar({ size = 44 }: { size?: number }) {
  return (
    <LinearGradient
      colors={[Colors.brand, '#7A3E4F']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>{Profile.firstName.charAt(0)}</Text>
    </LinearGradient>
  );
}

export function Wordmark() {
  return <Text style={styles.wordmark}>hickling</Text>;
}

/** Avatar on the left, title in the centre, action icons on the right. */
export function ScreenHeader({ title, right }: { title: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        <Avatar />
      </View>
      <View style={styles.center}>
        {typeof title === 'string' ? <Text style={styles.title}>{title}</Text> : title}
      </View>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 64,
  },
  side: {
    width: 96,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideRight: {
    justifyContent: 'flex-end',
    gap: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...Type.heading,
    color: Colors.text,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarText: {
    color: Colors.text,
    fontWeight: '700',
  },
  wordmark: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
});
