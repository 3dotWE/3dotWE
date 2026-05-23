#!/usr/bin/env python3
"""Scan files/ for game folders and write Files/manifest.json."""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..")
FILES_DIR = os.path.join(ROOT, "Files")
MANIFEST = os.path.join(ROOT, "files-launcher", "manifest.json")
LAUNCHER_FILES = {"index.html", "manifest.json"}

def main():
    if not os.path.isdir(FILES_DIR):
        print("Missing Files/ — clone: git clone https://github.com/ShadowDevLabs/files.git Files")
        raise SystemExit(1)

    games = []
    for name in os.listdir(FILES_DIR):
        if name in LAUNCHER_FILES or name.startswith("."):
            continue
        path = os.path.join(FILES_DIR, name)
        if os.path.isdir(path) and os.path.isfile(os.path.join(path, "index.html")):
            games.append(name)

    games.sort(key=str.lower)
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)

    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump({"games": games, "count": len(games)}, f, indent=2)

    print(f"Wrote {len(games)} games to Files/manifest.json")

if __name__ == "__main__":
    main()
