import { expect, test } from 'bun:test';

import { eventColorsFor } from './colors';

const names = (accent: string) => eventColorsFor(accent).map((c) => c.name);

test('event colors close to the accent are hidden', () => {
  expect(names('#8a6a00')).toEqual(['Nessun colore', 'Rosso', 'Verde', 'Blu', 'Viola']); // amber: nothing close
  expect(names('#3f5f90')).not.toContain('Blu'); // Material You blue
  expect(names('#9c4146')).not.toContain('Rosso'); // reddish, near the 0/360 wrap
  expect(names('#777777')).toHaveLength(5); // grey accent hides nothing
});
