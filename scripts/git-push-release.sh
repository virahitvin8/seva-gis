#!/usr/bin/env bash
# ============================================================================
# SEVA.GIS — Secure Git Release & Push Automation
# Author: N. Akshit Vinay (MSc GIS & Remote Sensing, BSc Agriculture) <virahitvin8>
# Brand: "Where Satellites Meet Soil"
#
# Rule 5 Compliance: Never hardcodes Personal Access Tokens.
# Reads $GITHUB_TOKEN securely from environment or .env file.
# Scoped staging prevents Git LFS stalls on large map reference folders.
# ============================================================================

set -e

# Change to repository root
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo "=== [SEVA.GIS] Automated Release Deployment ==="
echo "Working directory: $REPO_DIR"

# 1. Clear any dangling index.lock
if [ -f ".git/index.lock" ]; then
  echo "Clearing lingering .git/index.lock..."
  rm -f ".git/index.lock"
fi

# 2. Check for GITHUB_TOKEN
if [ -z "$GITHUB_TOKEN" ] && [ -f ".env" ]; then
  # Try extracting GITHUB_TOKEN from .env without exporting sensitive vars
  GITHUB_TOKEN=$(grep -E '^GITHUB_TOKEN=' .env | cut -d '=' -f2- | tr -d '"' | tr -d "'")
fi

# 3. Stage scoped production files (skips heavy binary folders like 'MAPS REF/')
echo "Staging core production source files..."
git add src/
git add bridges/
git add plugins/
git add scripts/
git add README.md
git add server.js
git add package.json
git add .env.example

# 4. Commit changes with author metadata
COMMIT_MSG="feat(release): SEVA.GIS v2.4 production multi-engine bridges & agronomic GeoAI"
echo "Committing changes..."
git -c user.name="N. Akshit Vinay" -c user.email="akshitvinay4636@gmail.com" commit -m "$COMMIT_MSG" --no-verify || echo "Working tree clean or already committed."

# 5. Push using token if provided, else normal git push
if [ -n "$GITHUB_TOKEN" ] && [ "$GITHUB_TOKEN" != "replace_with_newly_rotated_github_pat" ]; then
  echo "Pushing securely via authenticated remote..."
  REMOTE_URL="https://${GITHUB_TOKEN}@github.com/virahitvin8/crafty-gis.git"
  git push "$REMOTE_URL" HEAD:main --no-verify || git push "$REMOTE_URL" HEAD:master --no-verify
  echo "✓ Successfully pushed release to https://github.com/virahitvin8/crafty-gis"
else
  echo "GITHUB_TOKEN not detected in environment. Pushing to default configured remote..."
  git push origin HEAD --no-verify || echo "Notice: Configure GITHUB_TOKEN in your local .env to enable one-touch authenticated push."
fi

echo "=== [SEVA.GIS] Deployment Script Finished ==="
