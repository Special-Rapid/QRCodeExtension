import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PreferencesProvider, usePreferences } from '../lib/preferences';
import { getPalette } from '../lib/theme';

export default function RootLayout() {
  return <PreferencesProvider><RootNavigator /></PreferencesProvider>;
}
function RootNavigator() {
  const { resolvedTheme } = usePreferences();
  const isDark = resolvedTheme === 'dark';
  const palette = getPalette(resolvedTheme);
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.pairScreenBg },
          headerTintColor: palette.pairTitle,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: palette.pairScreenBg },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="scan" options={{ headerShown: false }} />
        <Stack.Screen name="pair" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
