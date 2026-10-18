import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { type SQLiteDatabase, SQLiteProvider } from 'expo-sqlite';
import { useColorScheme } from 'react-native';

import { useBackgroundWork } from '@/lib/background';
import { DATABASE_NAME, migrate } from '@/lib/db';
import { loadPrefs, useColors } from '@/lib/theme';

function BackgroundWork() {
  useBackgroundWork();
  return null;
}

async function init(db: SQLiteDatabase) {
  await migrate(db);
  await loadPrefs(db);
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = useColors();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, primary: c.accent, background: c.bg, card: c.bg, text: c.fg, border: c.line },
  };
  return (
    <ThemeProvider value={theme}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={init} options={{ enableChangeListener: true }}>
        <BackgroundWork />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="day/[date]" options={{ headerShown: true, presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ headerShown: true, title: 'Impostazioni' }} />
        </Stack>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
