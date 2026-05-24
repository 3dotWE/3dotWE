#!/usr/bin/env python3
"""Scan files/ for game folders and write manifest.json for launchers."""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..")
FILES_DIR = os.path.join(ROOT, "files")
MANIFEST_PATHS = [
    os.path.join(ROOT, "files-launcher", "manifest.json"),
    os.path.join(FILES_DIR, "manifest.json"),
]
LAUNCHER_FILES = {"index.html", "manifest.json", "js"}

def main():
    if not os.path.isdir(FILES_DIR):
        print("Missing files/ — clone: git clone https://github.com/ShadowDevLabs/files.git files")
        raise SystemExit(1)

    games = []
    for name in os.listdir(FILES_DIR):
        if name in LAUNCHER_FILES or name.startswith("."):
            continue
        path = os.path.join(FILES_DIR, name)
        if os.path.isdir(path) and os.path.isfile(os.path.join(path, "index.html")):
            games.append(name)

    games.sort(key=str.lower)
    payload = {"games": games, "count": len(games)}

    for manifest in MANIFEST_PATHS:
        os.makedirs(os.path.dirname(manifest), exist_ok=True)
        with open(manifest, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        print(f"Wrote {len(games)} games to {manifest}")

if __name__ == "__main__":
    main()
