# Self-Hosted & Serverless Mail Stacks for SEVA.GIS

Static CDN hosts (`https://sevagis.dpdns.org` on GitHub Pages) cannot terminate `POST` SMTP sockets in-browser, and `http://127.0.0.1:9292/sms/` only answers when **OpenSMS** is running locally on the Android device. SEVA.GIS connects cleanly to any of the open-source stacks below:

| Stack | License | Hosting Footprint | SEVA.GIS Transport | Compose / Worker |
|---|---|---|---|---|
| **Stalwart Mail Server** (`stalwartlabs/mail-server`) | AGPL-3.0 upstream container | Low-memory single Rust binary / Docker | **RFC 8620 JMAP** over HTTPS + SMTP | [`docker-compose.stalwart.yml`](docker-compose.stalwart.yml) |
| **Cloudflare Edge Mail Worker** (inspired by `hieunc229/mailflare`) | Apache-2.0 worker template | Zero-server Cloudflare Workers free tier | **HTTPS JSON Worker** + CORS allow-list | [`cloudflare-mail-worker/`](cloudflare-mail-worker/worker.js) |
| **docker-mailserver** (`docker-mailserver/docker-mailserver`) | MIT | Minimalist single Docker container (SMTP + DKIM/DMARC) | **SMTP STARTTLS 587 / SSL 465** | [`docker-compose.dms.yml`](docker-compose.dms.yml) |
| **Mailcow** (`mailcow/mailcow-dockerized`) | GPL-3.0 upstream container | Full Linux VPS Docker Compose + SOGo webmail | **SMTP Relay Bridge** | [`docker-compose.mailcow.yml`](docker-compose.mailcow.yml) |
| **Eigen** (`eigen-is/eigen`) | MIT | Bun + SQLite workspace + IMAP/SMTP | **SMTP / HTTP API Bridge** | [`docker-compose.eigen.yml`](docker-compose.eigen.yml) |

## Quick Deploy: Cloudflare Worker (Free Tier)

```bash
cd deploy/mail/cloudflare-mail-worker
npx wrangler secret put RESEND_API_KEY
npx wrangler deploy
```

Paste your deployed `https://seva-gis-mail-worker.<account>.workers.dev` URL into **Report Panel -> Direct Dispatch -> Gateway Settings -> Mail Backend: Mailflare / Cloudflare Worker**. Reports dispatched from GitHub Pages (`sevagis.dpdns.org`) and the Android APK send directly via HTTPS without touching `/api/send-report`.

