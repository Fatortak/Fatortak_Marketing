# Production portal deployment

The portal runs at <https://fatortak.rabbeh.com/portal/> on the existing
InterServer Windows/Plesk subscription. No Plesk admin or SSH access is needed.

## Layout

```
/portal/                              public front controller + UI assets
  index.php                           login, session, Node supervisor, proxy
  app.js, styles.css, favicon.png      public UI assets
  icons/                               channel icons

/App_Data/portal-app/                 private, not served by IIS
  auth.json                           login hash + session secret
  node.token                          bearer token for the local Node API
  marketing/portal/                   server.mjs, adapters.mjs, .env, public/
  marketing/automation/src/           channel adapters and render helpers
  marketing/config.example.json       public link/profile config
  data/portal.json                    live queue and settings
  data/media/                         uploaded media
  data/backups/                       40 rotating JSON snapshots
  data/server.log                     Node stdout/stderr
```

## Request flow

1. IIS serves `/portal/` with `index.php` as the default document.
2. PHP requires a valid signed session cookie; unauthenticated requests get the
   login page. Login failures are rate limited per IP.
3. After login, PHP ensures the Node process is listening on
   `127.0.0.1:4318`, then proxies `/portal/index.php/api/...` and
   `/portal/index.php/media/...` to it.
4. PHP forwards the private bearer token. Node binds localhost only, so the
   API is not reachable directly.
5. Node publishes due posts when `PORTAL_AUTO_PUBLISH=true`,
   `MARKETING_LIVE=true`, and **dry run is off** in Settings.

The `?ping=1` endpoint is unauthenticated. It returns only
`{ ok, service, at }`, starts Node if needed, and is used by the GitHub Actions
keepalive workflow every 10 minutes.

## Build and deploy

```powershell
cd marketing/portal
powershell -ExecutionPolicy Bypass -File scripts/build-production.ps1
powershell -ExecutionPolicy Bypass -File scripts/deploy-production.ps1 -SkipProvision -Restart
```

- The first deploy runs a one-time provisioning file and creates `auth.json`.
- Later deploys keep the remote `data/portal.json` and `.env` unless
  `-ForceData` or `-ForceEnv` is passed.
- `-Restart` kills and restarts the Node process so new server code is loaded.
- Credentials are written to
  `%USERPROFILE%\.config\fatortak\portal-production.txt`, outside the repo.

## Operations

- Restart Node: sign in, then open `/portal/?restart=1`.
- Health: `/portal/index.php/api/health` after login, or `/portal/?ping=1`.
- Logs: `App_Data/portal-app/data/server.log`.
- Backups: `App_Data/portal-app/data/backups/`.
- Keepalive: `.github/workflows/portal-keepalive.yml` on `main`.

## Security notes

- HTTPS is enforced by the site; HTTP redirects with 301.
- Session cookies are `Secure`, `HttpOnly`, `SameSite=Lax`, 12-hour expiry.
- `App_Data` returns 403/404 for direct requests.
- The portal sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex`.
- Rotate the portal password by changing `auth.json` with a fresh
  `password_hash()` and restarting Node; sessions are invalidated when the
  `secret` changes.
