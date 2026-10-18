import type { SQLiteDatabase } from 'expo-sqlite';
import { useSyncExternalStore } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { getMaterialColors } from '../../modules/material-you';

type Hex = `#${string}`;
// One accent drives everything highlighted: arrows, today, Sunday labels, buttons. Weekends are tinted with it.
export type Palette = Record<'bg' | 'fg' | 'muted' | 'line' | 'saturday' | 'sunday' | 'accent' | 'onAccent', Hex>;

export const light: Palette = {
  bg: '#ffffff',
  fg: '#1a1a1a',
  muted: '#6b6b6b',
  line: '#e6e6e6',
  saturday: '#fdf6d6',
  sunday: '#faecae',
  accent: '#8a6a00',
  onAccent: '#ffffff',
};

export const dark: Palette = {
  bg: '#121212',
  fg: '#f2f2f2',
  muted: '#9a9a9a',
  line: '#2a2a2a',
  saturday: '#29250f',
  sunday: '#3a3313',
  accent: '#e8c547',
  onAccent: '#1a1a1a',
};

// ponytail: read once per launch, so a new wallpaper shows up after the app restarts.
const material = getMaterialColors();
export const materialAvailable = material !== null;

function materialPalette(isDark: boolean): Palette | null {
  if (!material) return null;
  const m = (key: string) => material[key];
  return isDark
    ? {
        bg: m('neutral1_900'),
        fg: m('neutral1_50'),
        muted: m('neutral2_400'),
        line: m('neutral1_800'),
        saturday: m('accent1_900'),
        sunday: m('accent1_800'),
        accent: m('accent1_200'),
        onAccent: m('accent1_800'),
      }
    : {
        bg: m('neutral1_10'),
        fg: m('neutral1_900'),
        muted: m('neutral2_600'),
        line: m('neutral2_100'),
        saturday: m('accent1_50'),
        sunday: m('accent1_100'),
        accent: m('accent1_600'),
        onAccent: m('accent1_0'),
      };
}

export const palette = (isDark: boolean, materialYou: boolean) =>
  (materialYou && materialPalette(isDark)) || (isDark ? dark : light);

// Appearance prefs live in the meta table so the headless widget sees them too.
export type ThemeMode = 'system' | 'light' | 'dark';
export type Prefs = { mode: ThemeMode; materialYou: boolean };

let prefs: Prefs = { mode: 'system', materialYou: false };
const listeners = new Set<() => void>();

function apply(next: Prefs) {
  prefs = next;
  Appearance.setColorScheme(next.mode === 'system' ? 'unspecified' : next.mode);
  listeners.forEach((l) => l());
}

export async function readPrefs(db: SQLiteDatabase): Promise<Prefs> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM meta WHERE key IN ('theme', 'material_you')",
  );
  const get = (key: string) => rows.find((r) => r.key === key)?.value;
  return { mode: (get('theme') as ThemeMode) ?? 'system', materialYou: get('material_you') === '1' };
}

export const loadPrefs = async (db: SQLiteDatabase) => apply(await readPrefs(db));

export async function savePrefs(db: SQLiteDatabase, next: Prefs) {
  apply(next);
  await db.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES ('theme', ?), ('material_you', ?)", [
    next.mode,
    next.materialYou ? '1' : '0',
  ]);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const usePrefs = () => useSyncExternalStore(subscribe, () => prefs);

export function useColors() {
  const scheme = useColorScheme();
  return palette(scheme === 'dark', usePrefs().materialYou);
}
