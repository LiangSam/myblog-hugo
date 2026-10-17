CREATE TABLE IF NOT EXISTS simple_comment_votes (
  comment_id TEXT NOT NULL,
  voter_key TEXT NOT NULL,
  value INTEGER NOT NULL CHECK(value IN (-1, 1)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (comment_id, voter_key),
  FOREIGN KEY (comment_id) REFERENCES simple_comments(id)
);
