CREATE TABLE IF NOT EXISTS handwriting_profiles (
 owner_id TEXT PRIMARY KEY NOT NULL,
 payload TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS google_oauth_states (
 state_hash TEXT PRIMARY KEY NOT NULL,
 browser_hash TEXT NOT NULL,
 verifier TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_expiry ON google_oauth_states(expires_at);
CREATE TABLE IF NOT EXISTS google_sessions (
 token_hash TEXT PRIMARY KEY NOT NULL,
 owner_id TEXT NOT NULL,
 email TEXT NOT NULL,
 name TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expiry ON google_sessions(expires_at);
CREATE TABLE IF NOT EXISTS ai_daily_usage (
 owner_id TEXT NOT NULL,
 day TEXT NOT NULL,
 requests INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(owner_id,day)
);
