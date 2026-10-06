import { View, Text, Pressable } from 'react-native';
import { PeerInboxProvider, usePeerInbox } from '../lib/peer-inbox';
import { getStrings } from '../lib/strings';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PreferencesProvider, usePreferences } from '../lib/preferences';
import { getPalette } from '../lib/theme';

export default function RootLayout() {
  return <PreferencesProvider><PeerInboxProvider><RootNavigator /></PeerInboxProvider></PreferencesProvider>;
}
function RootNavigator() {
  const { resolvedTheme, locale } = usePreferences();
  const incoming=usePeerInbox();const t=getStrings(locale);
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
        <Stack.Screen name="devices" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="image-scan" options={{ headerShown: false }} />
      </Stack>
      {incoming.length>0 && <View style={{ backgroundColor: palette.pairScreenBg }}><Pressable accessibilityRole="button" accessibilityLabel={t.peerIncoming} onPress={()=>router.push("/devices")} style={{minHeight:48,padding:12}}><Text accessibilityLiveRegion="polite" style={{color:palette.pairTitle}}>{t.peerIncoming}: {incoming[0].senderLabel}</Text></Pressable></View>}
    </>
  );
}
