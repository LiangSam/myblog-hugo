CREATE TABLE IF NOT EXISTS simple_comments (
  id TEXT PRIMARY KEY,
  page_path TEXT NOT NULL,
  parent_id TEXT,
  nickname TEXT NOT NULL,
  author_url TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  ip_key TEXT NOT NULL DEFAULT '',
  is_author INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_simple_comments_page ON simple_comments(page_path, created_at);
CREATE INDEX IF NOT EXISTS idx_simple_comments_ip ON simple_comments(ip_key, created_at);

CREATE TABLE IF NOT EXISTS simple_comment_votes (
  comment_id TEXT NOT NULL,
  voter_key TEXT NOT NULL,
  value INTEGER NOT NULL CHECK(value IN (-1, 1)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (comment_id, voter_key),
  FOREIGN KEY (comment_id) REFERENCES simple_comments(id)
);

CREATE TABLE IF NOT EXISTS simple_banned_ips (
  ip_key TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS simple_post_limits (
  ip_key TEXT PRIMARY KEY,
  last_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS simple_telegram_messages (
  message_id INTEGER PRIMARY KEY,
  comment_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
