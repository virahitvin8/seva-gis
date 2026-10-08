# 🌐 SEVA.GIS — Free Custom Domain & FormSubmit Activation Guide

This document details the exact, step-by-step procedure to attach a **100% free, professional custom domain** to SEVA.GIS (`https://virahitvin8.github.io/seva-gis/`) and activate **FormSubmit** so contact, suggestions, and bug reports route directly to `akshitvinay4636@gmail.com`.

---

## Part 1: Free Custom Domain Options

GitHub Pages allows you to map any custom domain for free with automated SSL/TLS (Let's Encrypt). Below are the top verified free domain providers.

### Option A: `is-a.dev` (Recommended for Developers)
`is-a.dev` provides a clean, reputable developer domain (e.g., `sevagis.is-a.dev` or `seva-gis.is-a.dev`) registered directly through a GitHub Pull Request.

1. **Fork the Repository**:
   - Go to [https://github.com/is-a-dev/register](https://github.com/is-a-dev/register) and click **Fork**.
2. **Create Domain Record**:
   - In your fork, create a new file in the `domains/` folder named `sevagis.json` (or `seva-gis.json`).
   - Add the following content:
     ```json
     {
       "owner": {
         "username": "virahitvin8",
         "email": "akshitvinay4636@gmail.com"
       },
       "record": {
         "CNAME": "virahitvin8.github.io"
       }
     }
     ```
3. **Submit Pull Request**:
   - Commit the file and open a Pull Request against `is-a-dev/register:main`.
   - The automated CI bot will validate your JSON syntax in ~60 seconds.
   - Once merged by maintainers (typically within a few hours), DNS records propagate worldwide.

---

### Option B: DigitalPlat FreeDomain (`.dpdns.org` or `.qzz.io`)
DigitalPlat offers immediate DNS registration with web-based management.

1. **Register Name**:
   - Visit the DigitalPlat FreeDomain portal (or equivalent free DNS provider such as [FreeDNS / afraid.org](https://freedns.afraid.org/)).
   - Search for an available prefix (e.g., `sevagis.dpdns.org` or `sevagis.qzz.io`).
   - *Note*: Domain names are strictly first-come, first-served.
2. **Add CNAME Record**:
   - In the DNS Records table, add:
     - **Record Type**: `CNAME`
     - **Host / Subdomain**: `@` (or `www` or subdomain)
     - **Target / Destination**: `virahitvin8.github.io`
     - **TTL**: `300` (or `Automatic`)
   - Click **Save / Apply Changes**.

---

### Option C: `js.org` (Open-Source JavaScript / TypeScript GIS)
If SEVA.GIS is hosted publicly on GitHub as an open-source tool, you qualify for a free `sevagis.js.org` domain.

1. Fork [https://github.com/js-org/js.org](https://github.com/js-org/js.org).
2. Edit `cnames_active.js` and add:
   ```javascript
   "sevagis": "virahitvin8.github.io"
   ```
3. Submit a PR. Once merged, your site is available at `https://sevagis.js.org`.

---

## Part 2: Critical Execution Order (Avoid DNS Hijacking & Build Overwrite)

> [!IMPORTANT]
> **Strict Order of Operations**:
> 1. Register domain & add CNAME record at your DNS provider.
> 2. **WAIT** for DNS to resolve to GitHub before touching GitHub Pages.
> 3. Set Custom Domain in GitHub Pages Settings.
> 4. Commit the `CNAME` file to your Git repository.

### Step 1: Verify DNS Resolution
Before opening GitHub settings, verify that your new domain is pointing to GitHub Pages. In your terminal or PowerShell, run:

```powershell
Resolve-DnsName sevagis.is-a.dev -Type CNAME
```
Or check online via [DNSChecker.org](https://dnschecker.org/). It must resolve to `virahitvin8.github.io`.

### Step 2: Configure GitHub Pages
1. Go to your repository on GitHub:
   [https://github.com/virahitvin8/seva-gis/settings/pages](https://github.com/virahitvin8/seva-gis/settings/pages)
2. Scroll to the **Custom domain** section.
3. Enter your domain (e.g. `sevagis.is-a.dev` or `sevagis.dpdns.org`).
4. Click **Save**.
5. GitHub will verify the DNS record. Once verified:
   - Check the **Enforce HTTPS** box.
   - *Note*: Let's Encrypt TLS certificate provisioning takes 2–15 minutes.

### Step 3: Persist `CNAME` in Codebase
To prevent automated build or deployment pipelines from clearing your custom domain, create a `CNAME` file in your repository:

- Place a file named `CNAME` in the repository root and inside `public/CNAME`.
- Content should be solely the domain name (no `http://` or trailing slashes):
  ```text
  sevagis.is-a.dev
  ```
- Commit and push to `main`:
  ```powershell
  git add CNAME public/CNAME
  git commit -m "chore: persist custom domain CNAME"
  git push origin main
  ```

---

## Part 3: FormSubmit Activation (Inbox Routing)

SEVA.GIS routes contact form inquiries, suggestions, bug complaints, and Retro Assistant messages through [FormSubmit.co](https://formsubmit.co) to `akshitvinay4636@gmail.com`.

### Why Activation is Required
FormSubmit requires a **one-time email verification** for each recipient address to prevent spam and verify mailbox ownership. Until activated, FormSubmit holds submissions and replies with:
```json
{
  "success": "false",
  "message": "This form needs Activation. We've sent you an email containing an 'Activate Form' link."
}
```

### Action Required by Akshit:
1. An automated activation ping has already been triggered from SEVA.GIS to `akshitvinay4636@gmail.com`.
2. **Open your Gmail inbox**:
   - Check `akshitvinay4636@gmail.com` for an email from **FormSubmit** (Sender: `submissions@formsubmit.co`).
   - Subject: **"Action Required: Activate Form"**
   - *(If not visible in Primary, check Spam, Updates, or Promotions folders)*.
3. **Click the green "Activate Form" button** inside the email.
4. You will see a confirmation page: *"Form Activated!"*.
5. **From that moment onward**:
   - Every contact form submission from the landing page will instantly arrive in your Gmail.
   - Every Retro Assistant message (Feature Suggestion, Bug Complaint, or Direct Message) will be formatted into an executive table and delivered to your inbox.

---

## Summary Checklist

| Step | Action | Status |
|---|---|---|
| **1** | Trigger FormSubmit activation challenge | **Done** (Dispatched to `akshitvinay4636@gmail.com`) |
| **2** | Click "Activate Form" button in Gmail | **Awaiting User Click in Gmail** |
| **3** | Choose domain provider (`is-a.dev` / DigitalPlat) | Ready (choose name) |
| **4** | Point CNAME to `virahitvin8.github.io` | Provider DNS Dashboard |
| **5** | Wait for DNS propagation (~10–30 mins) | Verify via `Resolve-DnsName` |
| **6** | Set Custom Domain in GitHub Pages Settings | [Repo Settings](https://github.com/virahitvin8/seva-gis/settings/pages) |
| **7** | Enforce HTTPS in GitHub Pages | Automated TLS Certificate |
| **8** | Add `CNAME` file to `public/` and repo root | Commit & push to `main` |
