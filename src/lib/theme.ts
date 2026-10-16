import { useColorScheme } from 'react-native';

type Hex = `#${string}`;
export type Palette = Record<'bg' | 'fg' | 'muted' | 'line' | 'saturday' | 'sunday' | 'accent', Hex>;

export const light: Palette = {
  bg: '#ffffff',
  fg: '#1a1a1a',
  muted: '#6b6b6b',
  line: '#e6e6e6',
  saturday: '#eef1fb',
  sunday: '#dfe5f7',
  accent: '#1f5fd1',
};

export const dark: Palette = {
  bg: '#121212',
  fg: '#f2f2f2',
  muted: '#9a9a9a',
  line: '#2a2a2a',
  saturday: '#1c2133',
  sunday: '#252c45',
  accent: '#7aa7ff',
};

export const useColors = () => (useColorScheme() === 'dark' ? dark : light);

// Event highlight colors; null means plain text.
export const EVENT_COLORS = [
  { value: null, name: 'Nessun colore' },
  { value: '#d32f2f', name: 'Rosso' },
  { value: '#ef6c00', name: 'Arancione' },
  { value: '#2e7d32', name: 'Verde' },
  { value: '#1565c0', name: 'Blu' },
  { value: '#6a1b9a', name: 'Viola' },
  { value: '#5d4037', name: 'Marrone' },
];
