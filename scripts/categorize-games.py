#!/usr/bin/env python3
"""Scan files/ and write game profile manifest for the cloak launcher."""
import json
import os
import re

ROOT = os.path.join(os.path.dirname(__file__), "..")
FILES = os.path.join(ROOT, "files")
OUT_JSON = os.path.join(ROOT, "files-launcher", "game-profiles.json")
OUT_JS = os.path.join(ROOT, "files-launcher", "game-profiles.js")

SKIP = {".git", "js", "index.html", "manifest.json"}


def categorize(name: str, html: str) -> tuple[str, list[str]]:
    low = html.lower()
    ext = list({m.group(0).rstrip(".,;)") for m in re.finditer(r"https?://[^\s\"'<>\\]+", html, re.I)})[:12]

    if re.search(r"unityloader|createunityinstance|\.unityweb|webgl\.json", low):
        remote_hosts = (
            "digitaloceanspaces",
            "storage.y8",
            "tbt.mx",
            "justfall",
            "smashkarts",
            "onebigstatic",
        )
        if any(h in "\n".join(ext).lower() for h in remote_hosts):
            return "unity-remote", ext
        return "unity", ext

    if re.search(r'<iframe[^>]+src=["\']https?://', html, re.I):
        return "iframe-embed", ext

    if "ruffle" in low or re.search(r"\.swf", low):
        return "ruffle", ext

    if "c3runtime" in low or ("construct" in low and "c3_" in low):
        return "construct", ext

    if "phaser" in low:
        return "phaser", ext

    ignore = (
        "fonts.googleapis",
        "googletagmanager",
        "schema.org",
        "w3.org",
        "creativecommons",
        "ogp.me",
        "whatbrowser",
    )
    real_ext = [u for u in ext if not any(i in u.lower() for i in ignore)]
    if real_ext:
        return "external-cdn", ext

    return "static", ext


def main():
    if not os.path.isdir(FILES):
        print("Missing files/ directory")
        raise SystemExit(1)

    games = {}
    for name in sorted(os.listdir(FILES)):
        if name in SKIP or name.startswith("."):
            continue
        path = os.path.join(FILES, name)
        if not os.path.isdir(path):
            continue
        idx = os.path.join(path, "index.html")
        if not os.path.isfile(idx):
            continue
        with open(idx, "r", errors="ignore") as f:
            html = f.read(120000)
        cat, ext = categorize(name, html)
        games[name] = {"category": cat, "external": ext[:6]}

    payload = {
        "version": 2,
        "categories": {
            "static": "Local HTML/JS — standard cloak",
            "phaser": "Phaser engine — standard cloak",
            "construct": "Construct 3 — cloak + wasm",
            "ruffle": "Flash via Ruffle — cloak swf/wasm",
            "unity": "Unity WebGL — local build assets",
            "unity-remote": "Unity with remote CDN build (needs fetch patch)",
            "iframe-embed": "Embedded external iframe — proxy embed URL",
            "external-cdn": "Extra CDN scripts/fonts — broad proxy",
        },
        "games": games,
    }

    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    mapping = {k: v["category"] for k, v in games.items()}
    with open(OUT_JS, "w", encoding="utf-8") as f:
        f.write("/** Auto-generated — run: python3 scripts/categorize-games.py */\n")
        f.write("const GAME_PROFILES = ")
        json.dump(mapping, f, separators=(",", ":"))
        f.write(";\n")

    from collections import Counter

    counts = Counter(v["category"] for v in games.values())
    print(f"Wrote {len(games)} profiles")
    for cat, n in sorted(counts.items()):
        print(f"  {cat}: {n}")


if __name__ == "__main__":
    main()
