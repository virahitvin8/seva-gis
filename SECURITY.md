# Security Policy

## Reporting a Vulnerability

Please do **not** open public GitHub issues with live tokens, credentials, or exploitable endpoint details.
Report security findings privately via GitHub Security Advisories (`github.com/virahitvin8/seva-gis/security/advisories/new`).

## Privacy & Secret Hygiene

1. **Local-First Spatial Data**: Farm boundaries, GNSS tracklogs, waypoints, and voice memos remain in browser storage (`IndexedDB` / `localStorage`) on the user's device unless exported or shared.
2. **Client Keys**: Optional API keys (`Gemini`, `Groq`, `OpenRouter`, `SMTP`, `OpenSMS`) entered in UI drawers stay in local browser storage and are never committed to source control.
3. **CI Enforcement**: Every PR runs `gitleaks` secret scanning in `.github/workflows/ci.yml`. Never commit `.env` files, PATs, or private keystores.
4. **Domain TLS**: Ensure custom domain DNS records point to an endpoint configured with a matching TLS Subject Alternative Name (`sevagis.dpdns.org` on GitHub Pages; `sevagis.is-a.bot` via Cloudflare SSL; configure `sevagis.is-a.dev` via Vercel Domains or Cloudflare proxy when using multiple domains).

