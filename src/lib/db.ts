import type { SQLiteDatabase } from 'expo-sqlite';

export type CalEvent = {
  id: string;
  date: string;
  title: string;
  color: string | null;
};

const DATABASE_VERSION = 1;

// updated_at and deleted (soft delete) are there for the upcoming server sync.
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
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

// prefix is 'YYYY-MM' for a month or 'YYYY-MM-DD' for a day.
export const listEvents = (db: SQLiteDatabase, prefix: string) =>
  db.getAllAsync<CalEvent>(
    'SELECT id, date, title, color FROM events WHERE date LIKE ? AND deleted = 0 ORDER BY date, rowid',
    [`${prefix}%`],
  );

export const addEvent = (db: SQLiteDatabase, date: string, title: string, color: string | null) =>
  db.runAsync('INSERT INTO events (date, title, color, updated_at) VALUES (?, ?, ?, ?)', [
    date,
    title,
    color,
    Date.now(),
  ]);

export const updateEvent = (db: SQLiteDatabase, id: string, title: string, color: string | null) =>
  db.runAsync('UPDATE events SET title = ?, color = ?, updated_at = ? WHERE id = ?', [
    title,
    color,
    Date.now(),
    id,
  ]);

export const deleteEvent = (db: SQLiteDatabase, id: string) =>
  db.runAsync('UPDATE events SET deleted = 1, updated_at = ? WHERE id = ?', [Date.now(), id]);
