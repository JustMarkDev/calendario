import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { useColorScheme } from 'react-native';

import { useBackgroundWork } from '@/lib/background';
import { DATABASE_NAME, migrate } from '@/lib/db';

function BackgroundWork() {
  useBackgroundWork();
  return null;
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate} options={{ enableChangeListener: true }}>
        <BackgroundWork />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="day/[date]" options={{ headerShown: true, presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ headerShown: true, title: 'Impostazioni' }} />
        </Stack>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
