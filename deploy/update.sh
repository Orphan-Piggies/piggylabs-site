#!/usr/bin/env bash
# Publishes the newest commit on main. Run by piggylabs-update.timer as the piggylabs-deploy user every 2 minutes:
#   1. fetch origin/main; nothing to do if that commit is already live
#   2. unpack its site/ folder into releases/<commit> and check it has an index.html
#   3. point the "current" symlink at it (atomically); Caddy serves current/ and picks it up on the next request
#   4. keep the newest KEEP_RELEASES releases
# Rolling back = pointing current at an older release folder, or reverting the commit on main.
# Everything below can be overridden from the environment (the tests use that).
set -euo pipefail

REPO_DIR=${REPO_DIR:-/opt/piggylabs/repo}           # a clone of the public repo, only used to fetch
RELEASES_DIR=${RELEASES_DIR:-/opt/piggylabs/releases}
BRANCH=${BRANCH:-main}
KEEP_RELEASES=${KEEP_RELEASES:-5}

log() { echo "piggylabs-update: $*"; }
current() { [ -L "$RELEASES_DIR/current" ] && basename "$(readlink "$RELEASES_DIR/current")" || true; }
# rename() replaces the symlink in one step, so a visitor never hits a missing "current"
point_current_at() {
  ln -sfn "$RELEASES_DIR/$1" "$RELEASES_DIR/.current.tmp"
  python3 -c 'import os, sys; os.replace(sys.argv[1], sys.argv[2])' "$RELEASES_DIR/.current.tmp" "$RELEASES_DIR/current"
}

mkdir -p "$RELEASES_DIR"
if ! mkdir "$RELEASES_DIR/.lock" 2>/dev/null; then # one run at a time; a lock older than an hour is left over from a crash
  if [ -n "$(find "$RELEASES_DIR/.lock" -maxdepth 0 -mmin +60 2>/dev/null)" ]; then rmdir "$RELEASES_DIR/.lock"; mkdir "$RELEASES_DIR/.lock"; else log "another update is running"; exit 0; fi
fi
trap 'rmdir "$RELEASES_DIR/.lock" 2>/dev/null || true' EXIT

git -C "$REPO_DIR" fetch --quiet origin "$BRANCH"
# Keep the clone's files on main too, so changes to this script reach the next run. Safe while it runs: git writes new
# files, and bash keeps reading the old one it opened.
git -C "$REPO_DIR" reset --quiet --hard FETCH_HEAD
SHA=$(git -C "$REPO_DIR" rev-parse --short=12 HEAD)
[ "$SHA" = "$(current)" ] && exit 0

log "publishing $SHA (live: $(current || true))"
DIR="$RELEASES_DIR/$SHA"
rm -rf "$DIR.tmp" && mkdir -p "$DIR.tmp"
git -C "$REPO_DIR" archive "$SHA" site | tar -x -C "$DIR.tmp" --strip-components=1
if [ ! -s "$DIR.tmp/index.html" ]; then
  rm -rf "$DIR.tmp"; log "$SHA has no site/index.html; nothing changed"; exit 1
fi
rm -rf "$DIR" && mv "$DIR.tmp" "$DIR"
point_current_at "$SHA"
log "$SHA is live"

LIVE=$(current)
ls -1t "$RELEASES_DIR" | grep -v '^current$' | tail -n +"$((KEEP_RELEASES + 1))" | while read -r old; do
  [ "$old" = "$LIVE" ] || rm -rf "${RELEASES_DIR:?}/$old"
done
