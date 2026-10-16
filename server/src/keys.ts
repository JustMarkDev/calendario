export type Access = 'read' | 'write' | 'owner';
// What every protected handler receives as ctx.props, from an API key or an OAuth grant.
export type Props = { access: Access; name: string };

const hex = (bytes: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

async function isOwnerKey(token: string, ownerKey: string | undefined) {
  if (!ownerKey) return false;
  const [a, b] = await Promise.all([sha256(token), sha256(ownerKey)]);
  return crypto.subtle.timingSafeEqual(new TextEncoder().encode(a), new TextEncoder().encode(b));
}

export async function keyAccess(db: D1Database, ownerKey: string | undefined, token: string): Promise<Props | null> {
  if (await isOwnerKey(token, ownerKey)) return { access: 'owner', name: 'Proprietario' };
  const row = await db
    .prepare('UPDATE keys SET last_used_at = ? WHERE hash = ? RETURNING name, scope')
    .bind(Date.now(), await sha256(token))
    .first<{ name: string; scope: 'read' | 'write' }>();
  return row && { access: row.scope, name: row.name };
}

export async function createKey(db: D1Database, name: string, scope: 'read' | 'write') {
  const key = `cal_${hex(crypto.getRandomValues(new Uint8Array(24)))}`;
  const row = { id: crypto.randomUUID(), name, scope, created_at: Date.now(), last_used_at: null };
  await db
    .prepare('INSERT INTO keys (id, name, scope, hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(row.id, name, scope, await sha256(key), row.created_at)
    .run();
  return { ...row, key };
}

export const listKeys = async (db: D1Database) =>
  (await db.prepare('SELECT id, name, scope, created_at, last_used_at FROM keys ORDER BY created_at').all()).results;

export const deleteKey = async (db: D1Database, id: string) =>
  (await db.prepare('DELETE FROM keys WHERE id = ?').bind(id).run()).meta.changes > 0;
