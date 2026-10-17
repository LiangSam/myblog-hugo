#!/usr/bin/env python3
"""Convert an existing Twikoo D1 export into idempotent simple_comments inserts."""

import argparse
import json
import pathlib
import re
import sqlite3


def sql_string(value):
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=pathlib.Path, help="Existing Twikoo D1 SQL export")
    parser.add_argument("output", type=pathlib.Path, help="Ignored output SQL file")
    args = parser.parse_args()
    if args.output.exists():
        parser.error("The output file already exists; choose a new path.")

    github_profiles = {}
    original_giscus = args.source.with_name("giscus-comments.json")
    if original_giscus.exists():
        records = json.loads(original_giscus.read_text(encoding="utf-8"))["records"]
        github_profiles = {record["id"]: record["authorUrl"] for record in records}

    db = sqlite3.connect(":memory:")
    db.executescript(args.source.read_text(encoding="utf-8"))
    rows = db.execute(
        "SELECT _id, url, pid, nick, link, avatar, mailMd5, comment, created, master "
        "FROM comment WHERE isSpam = 0 ORDER BY created"
    ).fetchall()
    statements = []
    linked = 0
    for old_id, page, parent_id, nickname, old_link, avatar, mail_hash, body, created, master in rows:
        if not old_id or not page or not page.startswith('/blog/') or not body:
            continue
        avatar_url = avatar if avatar and avatar.startswith("https://") else ""
        if not avatar_url and mail_hash:
            avatar_url = f"https://www.gravatar.com/avatar/{mail_hash}?d=identicon&s=80"
        author_url = github_profiles.get(old_id) or old_link or ""
        if not re.fullmatch(r"https://github\.com/[A-Za-z0-9-]+/?", author_url):
            author_url = ""
        linked += bool(author_url)
        values = (
            old_id, page, parent_id or None, nickname or "访客", author_url, avatar_url,
            body, created, "", 1 if master else 0,
        )
        statements.append(
            "INSERT INTO simple_comments "
            "(id, page_path, parent_id, nickname, author_url, avatar_url, body, created_at, ip_key, is_author) "
            "VALUES (" + ", ".join(sql_string(value) for value in values) + ") "
            "ON CONFLICT(id) DO UPDATE SET author_url = excluded.author_url "
            "WHERE excluded.author_url <> '';"
        )
    args.output.write_text("\n".join(statements) + "\n", encoding="utf-8")
    args.output.chmod(0o600)
    print(f"Prepared {len(statements)} comments ({linked} GitHub profile links) in {args.output}")


if __name__ == "__main__":
    main()
