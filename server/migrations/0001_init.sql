-- rev is a server-wide change counter: clients pull everything with rev > their cursor.
CREATE TABLE events (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  title TEXT NOT NULL,
  color TEXT,
  remind INTEGER,
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  rev INTEGER NOT NULL
);
CREATE INDEX events_date ON events (date);
CREATE UNIQUE INDEX events_rev ON events (rev);

-- Personal API keys for agents and scripts. Only the SHA-256 of the key is stored.
CREATE TABLE keys (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('read', 'write')),
  hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
