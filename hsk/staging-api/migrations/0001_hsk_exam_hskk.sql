-- STAGING ONLY. Apply to the D1 database bound to aluni-tts-staging first.
-- This migration does not change courses, lessons, shared vocabulary, or grammar tables.

CREATE TABLE IF NOT EXISTS hsk_exam_sets (
  id TEXT PRIMARY KEY,
  version TEXT NOT NULL CHECK (version IN ('hsk20','hsk30')),
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 6),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  instructions TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','hidden')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS hsk_exam_questions (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES hsk_exam_sets(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('listening','reading','writing')),
  question_no INTEGER NOT NULL CHECK (question_no > 0),
  question_type TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  passage TEXT NOT NULL DEFAULT '',
  audio_url TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  options_json TEXT NOT NULL DEFAULT '[]',
  correct_answer TEXT NOT NULL DEFAULT '',
  explanation TEXT NOT NULL DEFAULT '',
  points REAL NOT NULL DEFAULT 1 CHECK (points >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(exam_id, question_no)
);

CREATE INDEX IF NOT EXISTS idx_hsk_exam_public ON hsk_exam_sets(version, level, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_hsk_exam_questions ON hsk_exam_questions(exam_id, question_no);

CREATE TABLE IF NOT EXISTS hskk_sets (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('primary','intermediate','advanced')),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  instructions TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','hidden')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS hskk_prompts (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES hskk_sets(id) ON DELETE CASCADE,
  item_no INTEGER NOT NULL CHECK (item_no > 0),
  task_type TEXT NOT NULL CHECK (task_type IN ('repeat','picture','answer','read','present')),
  prompt_hanzi TEXT NOT NULL DEFAULT '',
  prompt_pinyin TEXT NOT NULL DEFAULT '',
  prompt_vi TEXT NOT NULL DEFAULT '',
  audio_url TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  preparation_seconds INTEGER NOT NULL DEFAULT 0 CHECK (preparation_seconds >= 0),
  response_seconds INTEGER NOT NULL DEFAULT 0 CHECK (response_seconds >= 0),
  sample_answer TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(set_id, item_no)
);

CREATE TABLE IF NOT EXISTS hskk_criteria (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES hskk_sets(id) ON DELETE CASCADE,
  criterion_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  max_score REAL NOT NULL DEFAULT 0 CHECK (max_score >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(set_id, criterion_code)
);

CREATE INDEX IF NOT EXISTS idx_hskk_public ON hskk_sets(level, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_hskk_prompts ON hskk_prompts(set_id, item_no);

CREATE TABLE IF NOT EXISTS hsk_import_audit (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('exam','hskk')),
  source_filename TEXT NOT NULL DEFAULT '',
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create','update','hide','publish','delete','restore')),
  actor TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  details_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_hsk_audit_record ON hsk_import_audit(content_type, record_id, created_at);
