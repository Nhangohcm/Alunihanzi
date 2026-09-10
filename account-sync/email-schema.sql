CREATE TABLE IF NOT EXISTS sync_email_tokens (
 token_hash TEXT PRIMARY KEY,
 account_id INTEGER NOT NULL REFERENCES sync_accounts(id),
 purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset')),
 auth_version INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sync_email_tokens_owner ON sync_email_tokens(account_id);
