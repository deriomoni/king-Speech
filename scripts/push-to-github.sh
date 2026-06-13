#!/usr/bin/env bash
#
# Push the current branch to GitHub (origin: deriomoni/king-Speech).
#
# CONSENT GATE: per the project policy in replit.md ("GitHub sync"), this is
# only run AFTER the user has explicitly approved pushing for the session.
# Replit's checkpoint system already creates the commits; this script only
# uploads the already-committed history to GitHub — it never commits for you.
#
# Usage:  bash scripts/push-to-github.sh

set -euo pipefail

branch="$(git rev-parse --abbrev-ref HEAD)"

echo "Repository : $(git config --get remote.origin.url)"
echo "Branch     : ${branch}"

pending="$(git --no-optional-locks log --oneline "origin/${branch}..HEAD" 2>/dev/null || true)"
if [ -z "${pending}" ]; then
  echo "Nothing to push — GitHub is already up to date."
  exit 0
fi

echo "Commits to push:"
echo "${pending}"
echo "-----------------------------------------"

git push origin "HEAD:${branch}"

echo "-----------------------------------------"
echo "Done. View it at: https://github.com/deriomoni/king-Speech"
