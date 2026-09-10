CREATE TABLE IF NOT EXISTS sync_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, login_hash TEXT NOT NULL, recovery_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', auth_version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, last_login_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sync_account_sessions (token_hash TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES sync_accounts(id), expires_at INTEGER NOT NULL, auth_version INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sync_account_sessions_owner ON sync_account_sessions(account_id);
CREATE TABLE IF NOT EXISTS sync_account_limits (key TEXT PRIMARY KEY, bucket INTEGER NOT NULL, hits INTEGER NOT NULL);
