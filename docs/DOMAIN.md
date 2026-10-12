# SEVA.GIS Domain and Deployment Notes

This document records deployment guidance only. It does not claim that any public domain, backend, or email integration is currently verified.

## Supported release model

SEVA.GIS has two runtime pieces:

1. A Vite-built React frontend served as static assets.
2. An optional FastAPI Earth Engine proxy deployed separately when cloud analysis is enabled.

Choose and document one production hosting path before release. Firebase Hosting, GitHub Pages, the root Docker/Node server, nginx, and Cloud Run configurations currently coexist in the repository and must not be treated as interchangeable without API proxy and SPA-rewrite verification.

## Domain checklist

Before attaching a custom domain:

1. Confirm the selected frontend host and deployment branch.
2. Create the DNS record required by that host.
3. Verify DNS resolution with the provider's documented command.
4. Configure the custom domain in the hosting dashboard.
5. Enable HTTPS only after DNS ownership is verified.
6. Confirm SPA fallback routes and asset paths.
7. Confirm frontend API requests reach the intended Earth Engine service.
8. Test `/health`, the frontend, map loading, reports, and downloads from the final domain.

Example DNS inspection:

```powershell
Resolve-DnsName example.sevagis-domain.example -Type CNAME
```

Replace the example hostname with a domain controlled by the project owner. Do not add personal email addresses, private DNS credentials, or access tokens to repository files.

## Release verification

A public URL may be described as active only after:

- frontend build and typecheck pass;
- backend health and API contract checks pass;
- CORS allows only intended origins;
- no secret appears in source or built assets;
- AOI maps, clipping, reports, language switching, and exports pass browser checks;
- the selected domain serves the same build that was verified locally.

## Contact and email delivery

Email delivery providers require server-side credentials, sender verification, rate limits, and delivery confirmation. The browser must not send provider API keys or claim that a message was dispatched merely because a request was accepted locally.
