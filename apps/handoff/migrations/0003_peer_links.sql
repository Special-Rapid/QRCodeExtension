-- v1 receivers/pairingsを保持し、相互承認された直接の端末関係だけ追加する。
CREATE TABLE IF NOT EXISTS peer_links (
  id TEXT PRIMARY KEY,
  first_id TEXT NOT NULL REFERENCES receivers(id),
  second_id TEXT NOT NULL REFERENCES receivers(id),
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  CHECK (first_id <> second_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_peer_links_active
 ON peer_links(first_id, second_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_peer_links_second ON peer_links(second_id, revoked_at);
