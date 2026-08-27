CREATE TABLE IF NOT EXISTS receiver_connectors (
  id TEXT PRIMARY KEY,
  receiver_id TEXT NOT NULL REFERENCES receivers(id),
  token_hash TEXT NOT NULL,
  extension_id TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_receiver_connectors_receiver ON receiver_connectors(receiver_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_receiver_connectors_active_extension
  ON receiver_connectors(receiver_id, extension_id) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS receiver_delivery_channels (
  id TEXT PRIMARY KEY,
  receiver_id TEXT NOT NULL REFERENCES receivers(id),
  connector_id TEXT REFERENCES receiver_connectors(id),
  kind TEXT NOT NULL CHECK (kind IN ('web_push', 'extension_push')),
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_channels_active_endpoint
  ON receiver_delivery_channels(endpoint) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_delivery_channels_receiver
  ON receiver_delivery_channels(receiver_id, kind, revoked_at);

CREATE TABLE IF NOT EXISTS connector_link_tokens (
  token_hash TEXT PRIMARY KEY,
  receiver_id TEXT NOT NULL REFERENCES receivers(id),
  pairing_id TEXT NOT NULL REFERENCES pairings(id),
  extension_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_connector_link_tokens_expiry ON connector_link_tokens(expires_at);
