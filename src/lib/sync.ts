import * as SecureStore from 'expo-secure-store';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getMeta } from './db';

export type SyncConfig = { url: string; key: string };
type Row = {
  id: string;
  date: string;
  time: string | null;
  title: string;
  color: string | null;
  remind: number | null;
  updated_at: number;
  deleted: number;
};

const CONFIG = 'sync-config';
const BATCH = 500; // server limit per request

export async function getConfig(): Promise<SyncConfig | null> {
  const saved = await SecureStore.getItemAsync(CONFIG);
  return saved ? JSON.parse(saved) : null;
}

export async function connect(db: SQLiteDatabase, input: SyncConfig) {
  const url = input.url.replace(/\/+$/, '');
  const config = { key: input.key, url: /^https?:\/\//.test(url) ? url : `https://${url}` };
  const me = await api(config, '/api/me');
  if (me.access !== 'owner') throw new Error('Serve la chiave proprietario, non una chiave agente');
  await SecureStore.setItemAsync(CONFIG, JSON.stringify(config));
  await sync(db);
}

// Local notes stay; everything is marked unsynced so a later connect pushes it all.
export async function disconnect(db: SQLiteDatabase) {
  await SecureStore.deleteItemAsync(CONFIG);
  await db.execAsync("UPDATE events SET dirty = 1; DELETE FROM meta WHERE key IN ('cursor', 'synced_at');");
}

export async function api(config: SyncConfig, path: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(config.url + path, {
      ...init,
      headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
    });
  } catch {
    throw new Error('Server non raggiungibile');
  }
  if (res.status === 401) throw new Error('Chiave non valida');
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Errore del server (${res.status})`);
  return res.status === 204 ? null : res.json();
}

let running: Promise<void> | null = null;
let again = false;

// Push dirty rows, pull everything past the cursor. Calls during a run queue one more run.
export function sync(db: SQLiteDatabase): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await run(db);
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function run(db: SQLiteDatabase) {
  const config = await getConfig();
  if (!config) return;
  let full: boolean;
  do {
    const since = Number((await getMeta(db, 'cursor')) ?? 0);
    const dirty = await db.getAllAsync<Row>(
      `SELECT id, date, time, title, color, remind, updated_at, deleted FROM events WHERE dirty = 1 LIMIT ${BATCH}`,
    );
    const res: { cursor: number; changes: Row[] } = await api(config, '/api/sync', {
      method: 'POST',
      body: JSON.stringify({ since, changes: dirty }),
    });
    // Same connection as the screens, so their change listeners (and the reminder refresh) fire.
    await db.withTransactionAsync(async () => {
      // Only clear rows not edited again while the request was in flight.
      for (const r of dirty) {
        await db.runAsync('UPDATE events SET dirty = 0 WHERE id = ? AND updated_at = ?', [r.id, r.updated_at]);
      }
      // The server already resolved conflicts; a local edit made meanwhile is newer and stays.
      for (const r of res.changes) {
        await db.runAsync(
          `INSERT INTO events (id, date, time, title, color, remind, updated_at, deleted, dirty)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
           ON CONFLICT (id) DO UPDATE SET date = excluded.date, time = excluded.time, title = excluded.title,
             color = excluded.color, remind = excluded.remind, updated_at = excluded.updated_at,
             deleted = excluded.deleted, dirty = 0
           WHERE excluded.updated_at >= events.updated_at`,
          [r.id, r.date, r.time, r.title, r.color, r.remind, r.updated_at, r.deleted],
        );
      }
      await db.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES ('cursor', ?), ('synced_at', ?)", [
        String(res.cursor),
        String(Date.now()),
      ]);
    });
    full = dirty.length === BATCH;
  } while (full);
}

let timer: ReturnType<typeof setTimeout> | undefined;

// After a local edit: wait for a quiet moment, then sync. Offline is fine, the next sync catches up.
export function syncSoon(db: SQLiteDatabase) {
  clearTimeout(timer);
  timer = setTimeout(() => sync(db).catch(() => {}), 1500);
}
