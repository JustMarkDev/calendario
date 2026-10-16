import { afterAll, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';

import { addEvent, sync, updateEvent } from './events';

// A throwaway local D1 (miniflare), separate from the one `wrangler dev` uses.
const proxy = await getPlatformProxy<Env>({ persist: { path: `/tmp/calendario-test-${Date.now()}` } });
const db = proxy.env.DB;
const schema = readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8').replace(/--.*$/gm, '');
await db.batch(schema.split(';').filter((s) => s.trim()).map((s) => db.prepare(s)));
afterAll(() => proxy.dispose());

const row = (id: string, title: string, updated_at: number) => ({
  id: id.repeat(32),
  date: '2026-10-20',
  time: null,
  title,
  color: null,
  remind: null,
  updated_at,
  deleted: 0 as const,
});

test('sync: last write wins and the cursor only moves forward', async () => {
  const first = await sync(db, { since: 0, changes: [row('a', 'phone', 100)] });
  expect(first.changes.map((r) => r.title)).toEqual(['phone']);

  // An older edit loses, and the server answers with the version it kept.
  const stale = await sync(db, { since: first.cursor, changes: [row('a', 'stale', 50)] });
  expect(stale.changes.map((r) => r.title)).toEqual(['phone']);
  expect(stale.cursor).toBe(first.cursor);

  // An agent edit is always newer, even against a phone clock far in the future.
  await sync(db, { since: first.cursor, changes: [row('b', 'future', Date.now() + 1e9)] });
  const edited = await updateEvent(db, 'b'.repeat(32), { title: 'agent' });
  expect(edited?.title).toBe('agent');
  const pulled = await sync(db, { since: first.cursor, changes: [] });
  expect(pulled.changes.map((r) => r.title)).toEqual(['agent']);
  expect(pulled.cursor).toBeGreaterThan(first.cursor);
});

test('agents cannot set a reminder without a time', async () => {
  await expect(addEvent(db, { date: '2026-10-20', title: 'x', remind_minutes: 5 })).rejects.toThrow('needs a time');
});
