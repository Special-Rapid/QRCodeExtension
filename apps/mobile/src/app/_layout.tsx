import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#071B41' },
          headerTintColor: '#FFFFFF',
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#F7FAFF' },
        }}>
        <Stack.Screen name="index" options={{ title: 'QR Scan' }} />
      </Stack>
    </>
  );
}
