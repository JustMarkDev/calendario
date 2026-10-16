import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'calendario.db';

export type CalEvent = {
  id: string;
  date: string;
  time: string | null; // 'HH:MM'
  title: string;
  color: string | null;
  remind: number | null; // minutes before time
};
export type EventFields = Omit<CalEvent, 'id' | 'date'>;

const DATABASE_VERSION = 2;

// updated_at, deleted (soft delete) and dirty (changed since last sync) drive the server sync.
export async function migrate(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= DATABASE_VERSION) return;
  if (current === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';
      CREATE TABLE events (
        id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        color TEXT,
        updated_at INTEGER NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX events_date ON events (date);
    `);
  }
  if (current < 2) {
    await db.execAsync(`
      ALTER TABLE events ADD COLUMN time TEXT;
      ALTER TABLE events ADD COLUMN remind INTEGER;
      ALTER TABLE events ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1;
      CREATE TABLE meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    `);
  }
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

let headless: Promise<SQLiteDatabase> | undefined;

// For code that runs outside React (widget, background task); screens use useSQLiteContext.
export const openDb = () =>
  (headless ??= openDatabaseAsync(DATABASE_NAME).then(async (db) => {
    await migrate(db);
    return db;
  }));

const COLUMNS = 'id, date, time, title, color, remind';

// prefix is 'YYYY-MM' for a month or 'YYYY-MM-DD' for a day. Notes without a time come first.
export const listEvents = (db: SQLiteDatabase, prefix: string) =>
  db.getAllAsync<CalEvent>(
    `SELECT ${COLUMNS} FROM events WHERE date LIKE ? AND deleted = 0 ORDER BY date, time, rowid`,
    [`${prefix}%`],
  );

export const listBetween = (db: SQLiteDatabase, from: string, to: string) =>
  db.getAllAsync<CalEvent>(
    `SELECT ${COLUMNS} FROM events WHERE date BETWEEN ? AND ? AND deleted = 0 ORDER BY date, time, rowid`,
    [from, to],
  );

export const addEvent = (db: SQLiteDatabase, date: string, e: EventFields) =>
  db.runAsync('INSERT INTO events (date, time, title, color, remind, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
    date,
    e.time,
    e.title,
    e.color,
    e.remind,
    Date.now(),
  ]);

export const updateEvent = (db: SQLiteDatabase, id: string, e: EventFields) =>
  db.runAsync(
    'UPDATE events SET time = ?, title = ?, color = ?, remind = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    [e.time, e.title, e.color, e.remind, Date.now(), id],
  );

export const deleteEvent = (db: SQLiteDatabase, id: string) =>
  db.runAsync('UPDATE events SET deleted = 1, updated_at = ?, dirty = 1 WHERE id = ?', [Date.now(), id]);

export const getMeta = async (db: SQLiteDatabase, key: string) =>
  (await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]))?.value ?? null;
