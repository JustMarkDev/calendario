// Event highlight colors; null means plain text.
export const EVENT_COLORS = [
  { value: null, name: 'Nessun colore' },
  { value: '#d32f2f', name: 'Rosso' },
  { value: '#2e7d32', name: 'Verde' },
  { value: '#1565c0', name: 'Blu' },
  { value: '#6a1b9a', name: 'Viola' },
];

function hueSat(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return { hue: 0, sat: 0 };
  const hue = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { hue: hue * 60, sat: d / max };
}

// Weekends are tinted with the accent, so hide event colors too close to it (a grey accent clashes with none).
export function eventColorsFor(accent: string) {
  const a = hueSat(accent);
  if (a.sat < 0.25) return EVENT_COLORS;
  return EVENT_COLORS.filter(({ value }) => {
    if (!value) return true;
    const diff = Math.abs(hueSat(value).hue - a.hue);
    return Math.min(diff, 360 - diff) >= 30;
  });
}
