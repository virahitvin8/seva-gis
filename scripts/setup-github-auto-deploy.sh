#!/usr/bin/env bash
# ==============================================================================
# SEVA GIS - 1-Click Automated Deployment Setup
# Run this ONCE in Google Cloud Shell to make all GitHub pushes auto-deploy!
# ==============================================================================
set -e

PROJECT_ID="seva-gis-backend-e724a"
REPO="virahitvin8/seva-gis"
SA_NAME="github-actions-deployer"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
KEY_FILE="${HOME}/github-firebase-sa-key.json"

echo "=========================================================="
echo "  SEVA GIS: Configuring 100% Automated Deployment Pipeline"
echo "  Target Project: ${PROJECT_ID}"
echo "  GitHub Repo:    ${REPO}"
echo "=========================================================="

# 1. Ensure GCP project is set
gcloud config set project "$PROJECT_ID" --quiet

# 2. Create Service Account if not already created
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Creating service account ${SA_NAME}..."
  gcloud iam service-accounts create "$SA_NAME" \
    --description="Automated Deployer for GitHub Actions" \
    --display-name="GitHub Actions Deployer" \
    --project="$PROJECT_ID"
else
  echo "Service account ${SA_NAME} already exists."
fi

# 3. Grant Firebase Hosting Admin and Service Account User roles
echo "Granting Firebase Hosting Admin permissions..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/firebasehosting.admin" \
  --quiet >/dev/null

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser" \
  --quiet >/dev/null

# 4. Generate JSON key
echo "Generating secure service account key..."
rm -f "$KEY_FILE"
gcloud iam service-accounts keys create "$KEY_FILE" \
  --iam-account="$SA_EMAIL" \
  --project="$PROJECT_ID"

# 5. Check if GitHub CLI is logged in
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI detected and authenticated!"
  echo "Uploading secret directly to repository ${REPO}..."
  gh secret set FIREBASE_SERVICE_ACCOUNT_SEVA_GIS_BACKEND_E724A --repo "$REPO" < "$KEY_FILE"
  echo "SUCCESS! Secret FIREBASE_SERVICE_ACCOUNT_SEVA_GIS_BACKEND_E724A has been saved to GitHub."
else
  echo ""
  echo "=========================================================="
  echo "  FINAL STEP: Link to GitHub Actions (Takes 30 seconds)"
  echo "=========================================================="
  echo "Option A (Instant CLI):"
  echo "  gh auth login"
  echo "  gh secret set FIREBASE_SERVICE_ACCOUNT_SEVA_GIS_BACKEND_E724A --repo ${REPO} < ${KEY_FILE}"
  echo ""
  echo "Option B (Browser):"
  echo "  1. Open: https://github.com/${REPO}/settings/secrets/actions/new"
  echo "  2. Name:  FIREBASE_SERVICE_ACCOUNT_SEVA_GIS_BACKEND_E724A"
  echo "  3. Value: Copy and paste the JSON below:"
  echo "----------------------------------------------------------"
  cat "$KEY_FILE"
  echo "----------------------------------------------------------"
fi

echo ""
echo "From now on, whenever you push to main, GitHub Actions will automatically"
echo "build and deploy the app with ZERO manual commands needed!"
