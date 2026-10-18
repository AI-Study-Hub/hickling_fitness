import { DarkTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '@/constants/theme';

const theme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.background,
    card: Colors.header,
    text: Colors.text,
    border: Colors.separator,
    primary: Colors.accent,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="activity/new"
          options={{ presentation: 'modal', contentStyle: { backgroundColor: Colors.backgroundAlt } }}
        />
        <Stack.Screen
          name="activity/[id]"
          options={{ presentation: 'modal', contentStyle: { backgroundColor: Colors.backgroundAlt } }}
        />
      </Stack>
    </ThemeProvider>
  );
}
