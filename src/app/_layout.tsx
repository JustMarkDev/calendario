import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { useColorScheme } from 'react-native';

import { migrate } from '@/lib/db';

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SQLiteProvider databaseName="calendario.db" onInit={migrate} options={{ enableChangeListener: true }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="day/[date]" options={{ headerShown: true, presentation: 'modal' }} />
        </Stack>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
