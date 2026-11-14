CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    created_at REAL NOT NULL,
    expires_at REAL NOT NULL,
    revoked_at REAL
);
CREATE TABLE IF NOT EXISTS science_bundles (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES sessions(id),
    bundle_id TEXT NOT NULL REFERENCES science_bundles(id),
    version INTEGER NOT NULL CHECK (version >= 1),
    status TEXT NOT NULL,
    updated_at REAL NOT NULL,
    payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS missions_owner ON missions(owner_id, updated_at DESC, id);
CREATE TABLE IF NOT EXISTS command_receipts (
    owner_id TEXT NOT NULL REFERENCES sessions(id),
    scope TEXT NOT NULL,
    command_key TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (owner_id, scope, command_key)
);
CREATE TABLE IF NOT EXISTS mission_events (
    mission_id TEXT NOT NULL REFERENCES missions(id),
    sequence INTEGER NOT NULL,
    mission_version INTEGER NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (mission_id, sequence)
);
CREATE TABLE IF NOT EXISTS rate_limits (
    namespace TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    bucket INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    counter INTEGER NOT NULL,
    PRIMARY KEY (namespace, key_hash, bucket)
);
CREATE INDEX IF NOT EXISTS rate_limits_expiry ON rate_limits(expires_at);
PRAGMA user_version = 1;
