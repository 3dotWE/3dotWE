#!/usr/bin/env python3
"""Build files-launcher/manifest.json from 3dotWE/3.we-files on GitHub (no local clone)."""
import json
import urllib.request

OWN_REPO = "3dotWE/3.we-files"
API = f"https://api.github.com/repos/{OWN_REPO}/contents/"
OUT = "files-launcher/manifest.json"


def list_games():
    req = urllib.request.Request(API, headers={"Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(req, timeout=60) as res:
        data = json.load(res)
    games = []
    for item in data:
        if item.get("type") != "dir":
            continue
        name = item.get("name", "")
        if name in ("js", ".github") or name.startswith("."):
            continue
        games.append(name)
    games.sort(key=str.lower)
    return games


def main():
    games = list_games()
    payload = {"games": games, "count": len(games), "source": f"github:{OWN_REPO}"}
    path = __file__
    import os

    root = os.path.join(os.path.dirname(path), "..")
    out = os.path.join(root, OUT)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    print(f"Wrote {len(games)} games to {out}")


if __name__ == "__main__":
    main()
