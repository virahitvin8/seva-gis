#!/usr/bin/env bash
# ==============================================================================
# SEVA GIS - 1-Click Automated Deployment Setup via Firebase CLI
# Works on any account without requiring GCP IAM admin privileges!
# ==============================================================================
set -e

PROJECT_ID="seva-gis-backend-e724a"
REPO="virahitvin8/seva-gis"

echo "=========================================================="
echo "  SEVA GIS: Automated Deployment Pipeline via Firebase CI"
echo "  Target Project: ${PROJECT_ID}"
echo "  GitHub Repo:    ${REPO}"
echo "=========================================================="
echo ""
echo "Generating CI Deployment Token from Firebase..."
echo "Please visit the URL shown below in your browser, sign in with"
echo "the Google account that owns ${PROJECT_ID}, and paste the code back here:"
echo ""

# Generate the CI token
CI_TOKEN=$(npx -y firebase-tools login:ci --no-localhost | grep -o '1//[a-zA-Z0-9_-]*' | head -n 1)

if [ -z "$CI_TOKEN" ]; then
  echo ""
  echo "To get your token directly, run:"
  echo "  npx firebase-tools login:ci"
  echo "Then copy the token starting with 1//..."
  exit 1
fi

echo ""
echo "✔ Token generated successfully!"

# Check if GitHub CLI is logged in
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "Uploading FIREBASE_TOKEN directly to GitHub repository ${REPO}..."
  echo "$CI_TOKEN" | gh secret set FIREBASE_TOKEN --repo "$REPO"
  echo "✔ SUCCESS! Secret FIREBASE_TOKEN has been saved to GitHub."
else
  echo ""
  echo "=========================================================="
  echo "  FINAL STEP: Paste into GitHub Secrets (30 seconds)"
  echo "=========================================================="
  echo "1. Open: https://github.com/${REPO}/settings/secrets/actions/new"
  echo "2. Name:  FIREBASE_TOKEN"
  echo "3. Value:"
  echo "$CI_TOKEN"
  echo "=========================================================="
fi

echo ""
echo "✔ Automated deployment is ready! All future pushes to main"
echo "  will automatically build and deploy to ${PROJECT_ID}.web.app"
