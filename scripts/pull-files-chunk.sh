#!/bin/bash
# Download game folders from ShadowDevLabs/files in chunks (not the full ~4GB repo).
# Usage from repo root:
#   chmod +x scripts/pull-files-chunk.sh
#   ./scripts/pull-files-chunk.sh 2048 among-us slope

set -euo pipefail

REPO="https://github.com/ShadowDevLabs/files.git"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/Files/games"
MANIFEST="$DEST/manifest.json"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <game-folder> [game-folder ...]"
  echo "Example: $0 2048 among-us 1v1lol"
  exit 1
fi

command -v git >/dev/null || { echo "git is required"; exit 1; }

mkdir -p "$DEST"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "Cloning sparse checkout into temp dir..."
git clone --depth 1 --filter=blob:none --sparse "$REPO" "$WORKDIR/repo"
cd "$WORKDIR/repo"
git sparse-checkout set "$@"

INSTALLED=()
for game in "$@"; do
  if [ ! -d "$game" ]; then
    echo "Skip (not found): $game"
    continue
  fi
  echo "Installing $game ..."
  rm -rf "$DEST/$game"
  cp -R "$game" "$DEST/$game"
  INSTALLED+=("$game")
done

cd "$ROOT"

# Merge into manifest.json
python3 - "$MANIFEST" "${INSTALLED[@]}" <<'PY'
import json, sys, os
manifest_path = sys.argv[1]
new_games = sys.argv[2:]
data = {"games": []}
if os.path.isfile(manifest_path):
    with open(manifest_path) as f:
        data = json.load(f)
games = set(data.get("games", []))
games.update(new_games)
data["games"] = sorted(games)
os.makedirs(os.path.dirname(manifest_path), exist_ok=True)
with open(manifest_path, "w") as f:
    json.dump(data, f, indent=2)
print("manifest:", len(data["games"]), "local games")
PY

echo "Done. Local games in Files/games/"
echo "Commit only the games you need (repo size limits apply)."
