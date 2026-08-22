CREATE TABLE IF NOT EXISTS receivers (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('web', 'mobile', 'extension')),
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS pairings (
  id TEXT PRIMARY KEY,
  web_receiver_id TEXT NOT NULL REFERENCES receivers(id),
  mobile_receiver_id TEXT NOT NULL REFERENCES receivers(id),
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_pairings_web_receiver ON pairings(web_receiver_id);
CREATE INDEX IF NOT EXISTS idx_pairings_mobile_receiver ON pairings(mobile_receiver_id);
