#!/usr/bin/env python3
"""Manage the Room's Desk News feed (public/room/news.json).

Player-facing "what shipped" one-liners, newest-first, rendered live on the
Front Desk with NO rebuild (the desk fetches news.json at runtime). Two modes:

  news.py add "<tag>" "<title>" [--date YYYY-MM-DD]   # prepend/refresh an entry
  news.py suggest [N]                                  # candidate ships from recent commits

Keeps the newest CAP entries, dedups by title, always writes valid JSON in the
existing one-object-per-line shape. `add` is the automation hook — call it at a
ship moment (same spirit as a cortex signal) instead of hand-editing the JSON.
Deliberately NOT auto-scraping raw commit subjects into the feed: this is
player-facing copy, so `suggest` proposes and a human (or a curated `add`) picks.
"""
import json, os, subprocess, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
NEWS = os.path.join(HERE, "..", "public", "room", "news.json")
CAP = 14


def load():
    try:
        return json.load(open(NEWS))
    except Exception:
        return []


def save(items):
    items = items[:CAP]
    with open(NEWS, "w") as f:
        f.write("[\n")
        f.write(",\n".join("  " + json.dumps(it, ensure_ascii=False) for it in items))
        f.write("\n]\n")


def add(tag, title, date=None):
    date = date or datetime.date.today().isoformat()
    items = [it for it in load() if it.get("title") != title]  # dedup by title
    items.append({"date": date, "tag": tag, "title": title})
    items.sort(key=lambda it: it.get("date", ""), reverse=True)
    save(items)
    print(f"added: [{date}] {tag} — {title}  ({min(len(items), CAP)} shown, cap {CAP})")


def suggest(n=25):
    log = subprocess.run(
        ["git", "log", f"-{n}", "--pretty=%ad|%s", "--date=short"],
        cwd=os.path.join(HERE, ".."), capture_output=True, text=True,
    ).stdout
    print("# candidate player-facing ships (feat/art commits) — pick + reword, then `news.py add`:")
    for line in log.splitlines():
        date, _, subj = line.partition("|")
        if subj.startswith(("feat", "art")):
            print(f"{date}  {subj}")


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    if a[0] == "add":
        date = None
        if "--date" in a:
            i = a.index("--date"); date = a[i + 1]; a = a[:i] + a[i + 2:]
        if len(a) < 3:
            sys.exit('usage: news.py add "<tag>" "<title>" [--date YYYY-MM-DD]')
        add(a[1], a[2], date)
    elif a[0] == "suggest":
        suggest(int(a[1]) if len(a) > 1 else 25)
    else:
        sys.exit(__doc__)
