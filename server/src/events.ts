import { z } from 'zod';

// Same palette as the app (src/lib/theme.ts). Agents use the Italian names, the database stores hex.
export const COLORS = {
  rosso: '#d32f2f',
  arancione: '#ef6c00',
  verde: '#2e7d32',
  blu: '#1565c0',
  viola: '#6a1b9a',
  marrone: '#5d4037',
} as const;
type ColorName = keyof typeof COLORS;
const COLOR_NAMES = Object.keys(COLORS) as [ColorName, ...ColorName[]];

export type Row = {
  id: string;
  date: string;
  time: string | null;
  title: string;
  color: string | null;
  remind: number | null;
  updated_at: number;
  deleted: number;
  rev: number;
};

const validDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
};
export const DateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine(validDate, 'Not a real date');
const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24h)');
const Remind = z.number().int().min(0).max(7 * 24 * 60);

const fields = {
  date: DateStr.describe('Day of the note, YYYY-MM-DD'),
  title: z.string().trim().min(1).max(500).describe('The note text'),
  time: Time.nullable().optional().describe('Optional time, HH:MM 24h local time'),
  color: z.enum(COLOR_NAMES).nullable().optional().describe('Optional highlight colour'),
  remind_minutes: Remind.nullable()
    .optional()
    .describe('Phone reminder this many minutes before `time` (0 = at the time). Needs `time`.'),
};
export const NewEvent = z.object(fields);
export const EventPatch = z.object(fields).partial();
export type NewEvent = z.infer<typeof NewEvent>;
export type EventPatch = z.infer<typeof EventPatch>;

export const publicEvent = (r: Row) => ({
  id: r.id,
  date: r.date,
  time: r.time,
  title: r.title,
  color: COLOR_NAMES.find((name) => COLORS[name] === r.color) ?? null,
  remind_minutes: r.remind,
});
export type PublicEvent = ReturnType<typeof publicEvent>;

const NEXT_REV = '(SELECT coalesce(max(rev), 0) + 1 FROM events)';

// Last write wins: an incoming row only replaces a stored one if it is newer.
const put = (db: D1Database, e: Omit<Row, 'rev'>) =>
  db
    .prepare(
      `INSERT INTO events (id, date, time, title, color, remind, updated_at, deleted, rev)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${NEXT_REV})
       ON CONFLICT (id) DO UPDATE SET date = excluded.date, time = excluded.time, title = excluded.title,
         color = excluded.color, remind = excluded.remind, updated_at = excluded.updated_at,
         deleted = excluded.deleted, rev = excluded.rev
       WHERE excluded.updated_at > events.updated_at`,
    )
    .bind(e.id, e.date, e.time, e.title, e.color, e.remind, e.updated_at, e.deleted);

const get = (db: D1Database, id: string) =>
  db.prepare('SELECT * FROM events WHERE id = ? AND deleted = 0').bind(id).first<Row>();

// ponytail: capped at 1000 rows, add paging if an agent ever needs more than that in one range.
export async function listRange(db: D1Database, from: string, to: string) {
  const { results } = await db
    .prepare('SELECT * FROM events WHERE date BETWEEN ? AND ? AND deleted = 0 ORDER BY date, time LIMIT 1000')
    .bind(from, to)
    .all<Row>();
  return results.map(publicEvent);
}

export async function search(db: D1Database, query: string) {
  const { results } = await db
    .prepare('SELECT * FROM events WHERE instr(lower(title), lower(?)) > 0 AND deleted = 0 ORDER BY date DESC, time LIMIT 100')
    .bind(query)
    .all<Row>();
  return results.map(publicEvent);
}

const needsTime = (e: { time?: string | null; remind_minutes?: number | null }) =>
  e.remind_minutes != null && !e.time ? 'remind_minutes needs a time' : null;

export async function addEvent(db: D1Database, input: NewEvent) {
  const problem = needsTime(input);
  if (problem) throw new InputError(problem);
  const row = {
    id: crypto.randomUUID().replaceAll('-', ''),
    date: input.date,
    time: input.time ?? null,
    title: input.title,
    color: input.color ? COLORS[input.color] : null,
    remind: input.remind_minutes ?? null,
    updated_at: Date.now(),
    deleted: 0,
  };
  await put(db, row).run();
  return publicEvent({ ...row, rev: 0 });
}

export async function updateEvent(db: D1Database, id: string, patch: EventPatch) {
  const old = await get(db, id);
  if (!old) return null;
  const merged = { ...publicEvent(old), ...patch };
  const problem = needsTime(merged);
  if (problem) throw new InputError(problem);
  const row = {
    ...old,
    date: merged.date,
    time: merged.time ?? null,
    title: merged.title,
    color: merged.color ? COLORS[merged.color] : null,
    remind: merged.remind_minutes ?? null,
    // Always newer than the stored row, even if a phone clock runs ahead.
    updated_at: Math.max(Date.now(), old.updated_at + 1),
  };
  await put(db, row).run();
  return publicEvent(row);
}

export async function deleteEvent(db: D1Database, id: string) {
  const old = await get(db, id);
  if (!old) return false;
  await put(db, { ...old, deleted: 1, updated_at: Math.max(Date.now(), old.updated_at + 1) }).run();
  return true;
}

export const SyncBody = z.object({
  since: z.number().int().min(0),
  changes: z
    .array(
      z.object({
        id: z.string().regex(/^[0-9a-f]{32}$/),
        date: DateStr,
        time: Time.nullable(),
        title: z.string().max(500),
        color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable(),
        remind: Remind.nullable(),
        updated_at: z.number().int().min(0),
        deleted: z.union([z.literal(0), z.literal(1)]),
      }),
    )
    .max(500),
});

export async function sync(db: D1Database, { since, changes }: z.infer<typeof SyncBody>) {
  if (changes.length) await db.batch(changes.map((c) => put(db, c)));
  // Everything past the cursor, plus pushed rows where the server kept a newer version.
  const { results } = await db
    .prepare('SELECT * FROM events WHERE rev > ? OR id IN (SELECT value FROM json_each(?)) ORDER BY rev')
    .bind(since, JSON.stringify(changes.map((c) => c.id)))
    .all<Row>();
  return { cursor: results.reduce((max, r) => Math.max(max, r.rev), since), changes: results };
}

export class InputError extends Error {}
