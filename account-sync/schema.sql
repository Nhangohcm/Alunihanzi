-- Apply only to the staging D1 database first. No existing tables are modified.
CREATE TABLE IF NOT EXISTS saved_libraries (
  code_id INTEGER PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  words_json TEXT NOT NULL DEFAULT '[]',
  sentences_json TEXT NOT NULL DEFAULT '[]',
  commit_id TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS saved_library_commits (
  code_id INTEGER NOT NULL,
  commit_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (code_id, commit_id)
);
