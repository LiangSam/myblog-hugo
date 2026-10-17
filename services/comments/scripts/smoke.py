#!/usr/bin/env python3
"""Exercise the local comments API without touching existing comments."""

import json
import pathlib
import urllib.error
import urllib.parse
import urllib.request


BASE = "http://127.0.0.1:8788"
PATH = "/blog/comment-smoke/"
SECRETS = {}
for line in (pathlib.Path(__file__).resolve().parents[1] / ".dev.vars").read_text().splitlines():
    key, value = line.split("=", 1)
    SECRETS[key] = value


def request(method, route, data=None, token=None, ip="198.51.100.23", voter=None):
    headers = {"Origin": "http://127.0.0.1:8766", "CF-Connecting-IP": ip}
    if voter:
        headers["X-Comment-Voter"] = voter
    if data is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = "Bearer " + token
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(BASE + route, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as result:
            return result.status, json.load(result)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


def expect(condition, label):
    if not condition:
        raise AssertionError(label)
    print("PASS", label)


status, data = request("GET", "/api/health")
expect(status == 200 and data["ok"], "health")
status, data = request("GET", "/api/comments?path=/blog/the-remains-of-the-day-review/")
expect(status == 200 and any(c["id"].startswith("DC_") for c in data["comments"]), "legacy comments and IDs")
status, data = request("POST", "/api/admin/login", {"password": SECRETS["ADMIN_PASSWORD"]})
expect(status == 200 and bool(data.get("token")), "admin login")
token = data["token"]
payload = {"path": PATH, "nickname": "Preview", "email": "preview@example.test", "body": "Local test comment"}
status, data = request("POST", "/api/comments", payload)
expect(status == 201 and data["comment"]["nickname"] == "Preview", "post comment")
first_id = data["comment"]["id"]
voter_one = "3e76cf8b-210e-4d14-a248-59aaf43b7c01"
voter_two = "5c8d01a2-d9e7-48e0-aa62-4d67042198b2"
vote_route = "/api/comments/vote"
status, data = request("POST", vote_route, {"id": first_id, "voterId": voter_one, "value": 1}, ip="198.51.100.30")
expect(status == 200 and data == {"voteScore": 1, "viewerVote": 1}, "upvote")
status, data = request("GET", "/api/comments?path=" + urllib.parse.quote(PATH), voter=voter_one)
voted = next(c for c in data["comments"] if c["id"] == first_id)
expect(status == 200 and voted["voteScore"] == 1 and voted["viewerVote"] == 1, "vote restored on reload")
status, data = request("POST", vote_route, {"id": first_id, "voterId": voter_one, "value": 1}, ip="198.51.100.31")
expect(status == 200 and data["voteScore"] == 1, "duplicate vote stays single")
status, data = request("POST", vote_route, {"id": first_id, "voterId": voter_two, "value": -1}, ip="198.51.100.32")
expect(status == 200 and data["voteScore"] == 0, "downvote offsets upvote")
status, data = request("POST", vote_route, {"id": first_id, "voterId": voter_one, "value": -1}, ip="198.51.100.33")
expect(status == 200 and data["voteScore"] == -2, "switch vote")
status, data = request("POST", vote_route, {"id": first_id, "voterId": voter_one, "value": 0}, ip="198.51.100.34")
expect(status == 200 and data["voteScore"] == -1 and data["viewerVote"] == 0, "cancel vote")
status, data = request("POST", "/api/comments", payload)
expect(status == 429, "posting frequency limit")
status, data = request("POST", "/api/comments", {"path": PATH, "parentId": first_id, "body": "Local test reply"}, token=token, ip="198.51.100.24")
expect(status == 201 and data["comment"]["parentId"] == first_id and data["comment"]["isAuthor"] and not data["comment"]["avatarUrl"], "author reply without avatar")
reply_id = data["comment"]["id"]
status, data = request("GET", "/api/admin/comments", token=token)
expect(status == 200 and any(c["id"] == first_id for c in data["comments"]), "admin list")
ip_key = next(c["ip_key"] for c in data["comments"] if c["id"] == first_id)
status, data = request("GET", "/api/admin/nicknames?ipKey=" + ip_key, token=token)
expect(status == 200 and any(n["nickname"] == "Preview" for n in data["nicknames"]), "same-network nicknames")
status, data = request("POST", "/api/admin/action", {"action": "delete", "id": first_id}, token=token)
expect(status == 200 and data["ok"], "delete")
status, data = request("POST", vote_route, {"id": first_id, "voterId": voter_one, "value": 1}, ip="198.51.100.35")
expect(status == 404, "deleted comment cannot receive votes")
status, data = request("GET", "/api/comments?path=" + urllib.parse.quote(PATH))
expect(status == 200 and all(c["id"] != first_id for c in data["comments"]), "deleted comment hidden")
status, data = request("POST", "/api/admin/action", {"action": "restore", "id": first_id}, token=token)
expect(status == 200 and data["ok"], "restore")
status, data = request("POST", "/api/admin/action", {"action": "ban", "ipKey": ip_key}, token=token)
expect(status == 200 and data["ok"], "ban IP")
status, data = request("POST", "/api/comments", payload, ip="198.51.100.23")
expect(status == 403, "banned IP refused")
status, data = request("POST", vote_route, {"id": first_id, "voterId": voter_one, "value": 1})
expect(status == 403, "banned IP cannot vote")
status, data = request("POST", "/api/admin/action", {"action": "unban", "ipKey": ip_key}, token=token)
expect(status == 200 and data["ok"], "unban IP")
print("TEST_IDS", first_id, reply_id)
