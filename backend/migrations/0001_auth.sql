CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  google_sub TEXT NOT NULL,
  verifier TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS google_grants (
  uid TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL,
  refresh_cipher TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
