# 🌐 SEVA·GIS Subdomains & DNS Automation Guide

This repository contains the configuration files and automated pipeline for hosting SEVA·GIS across free developer subdomains:
- **`sevagis.stusite.me`** (via [dash.stusite.me](https://dash.stusite.me/domains/03b9b883-c3dd-440b-8a98-54c794872395/))
- **`sevagis.is-a.bot`** (via [free-domains/is-a.bot](https://github.com/free-domains/is-a.bot))
- **`sevagis.is-a.dev`** (via [is-a-dev/register](https://github.com/is-a-dev/register))
- **`sevagis.dpdns.org`** (active baseline fallback)

---

## 1. Setting up DNS for `sevagis.stusite.me` (StuSite Dashboard)

Open your domain dashboard at:
👉 **[dash.stusite.me/domains/03b9b883-c3dd-440b-8a98-54c794872395/](https://dash.stusite.me/domains/03b9b883-c3dd-440b-8a98-54c794872395/)**

Navigate to the **DNS Management / DNS Records** section and add the following:

### Primary Method (Recommended: CNAME Record)
| Field | Value | Notes |
|---|---|---|
| **Type** | `CNAME` | Standard alias |
| **Name / Host** | `@` (or leave empty if root) | Represents `sevagis.stusite.me` |
| **Value / Target** | `virahitvin8.github.io` | Your GitHub Pages host |
| **TTL** | `3600` (or `Automatic`) | 1 hour |

### Alternative Method (If dashboard requires A records for the root domain)
If your StuSite dashboard does not allow a CNAME at the root/apex, add these 4 **A** records instead:

| Type | Name / Host | Value / IP | TTL |
|---|---|---|---|
| `A` | `@` | `185.199.108.153` | `3600` |
| `A` | `@` | `185.199.109.153` | `3600` |
| `A` | `@` | `185.199.110.153` | `3600` |
| `A` | `@` | `185.199.111.153` | `3600` |

*(Optional IPv6 AAAA records: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`)*

---

## 2. Active Registration: `sevagis.is-a.bot`
- **Active Pull Request**: [free-domains/is-a.bot#555](https://github.com/free-domains/is-a.bot/pull/555)
- **Branch**: `virahitvin8:update-sevagis-cname`
- **Target Subdomain**: `sevagis.is-a.bot`
- **Record**:
  ```json
  {
    "owner": {
      "username": "virahitvin8",
      "email": "akshitvinay4636@gmail.com"
    },
    "records": {
      "CNAME": "sevagis.dpdns.org"
    }
  }
  ```
- **Validation**: Schema verified against `free-domains/is-a.bot` domain specification (`records.CNAME`).

---

## 3. Active Registration: `sevagis.is-a.dev`
- **Active Pull Request**: [is-a-dev/register#57108](https://github.com/is-a-dev/register/pull/57108)
- **Branch**: `virahitvin8:patch-1`
- **Target Subdomain**: `sevagis.is-a.dev`
- **Record**:
  ```json
  {
    "owner": {
      "username": "virahitvin8",
      "email": "akshitvinay4636@gmail.com"
    },
    "records": {
      "CNAME": "sevagis.dpdns.org"
    }
  }
  ```
- **Automated CI Status**: Passed (`Template: success`, `Label: success`, label `domain` assigned). Once merged, DNS activates automatically within 15 minutes.

---

## 4. Making Deployments 100% Automated on Git Push

GitHub Pages uses the `.github/workflows/pages.yml` workflow. Whenever you push to the `main` branch:
1. GitHub Actions checks out the repository.
2. Runs `npm run build` with Vite.
3. Vite copies `public/CNAME` into `dist/CNAME`.
4. GitHub Pages immediately activates the domain and provisions/renews SSL certificates via Let's Encrypt.

To switch which domain is actively bound by GitHub Pages, run:
```bash
npm run set-domain sevagis.stusite.me
git add public/CNAME CNAME
git commit -m "chore: bind custom domain sevagis.stusite.me"
git push origin main
```

---

## 5. Google Earth Engine (GEE) API Verification

The backend GEE tile proxy is deployed on Google Cloud Run:
- **Base URL:** `https://seva-gis-backend-419602015618.us-central1.run.app`
- **Health Probe:** `/health` (`status: 200 OK`, `engineReady: true`)
- **Map Tile Endpoint:** `/api/earth-engine/map` (`status: 200 OK`)
- **CORS Configuration:** `allow_origins=["*"]` allows requests originating from `sevagis.stusite.me`, `sevagis.is-a.bot`, `sevagis.is-a.dev`, and `sevagis.dpdns.org`.
