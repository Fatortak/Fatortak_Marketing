# Deploying Fatortak on InterServer Plesk

Status: **Plesk access verified. The new `fatortak.rabbeh.com` subdomain is created with Let's Encrypt. The landing page is built and tested locally. The opt-in automatic FTPS workflow is documented and ready; it activates once the scoped FTP account and GitHub secrets exist. Existing app domains were not changed.**

| Item | Value |
| --- | --- |
| Hosting provider | InterServer |
| Plan | Windows ASP.NET Web Hosting (Plesk-managed) |
| Plesk URL | `https://<your-plesk-host>:8443` |
| Plesk version | Obsidian 18.0.81 |
| Application stack | ASP.NET Core 8 API + React/Vite SPA + Microsoft SQL Server |

This document is the deployment reference for this host. It contains no passwords or private keys.

For automatic landing-page deployment through GitHub Actions, see [`INTERSERVER-AUTODEPLOY.md`](INTERSERVER-AUTODEPLOY.md).

## Current hosting inventory (verified 2026-10-27)

| Item | Value |
| --- | --- |
| Plesk subscription | A single subscription containing multiple domains |
| System user | `<system-user>` (not shared publicly) |
| Server IP | `<server-ip>` (not shared publicly) |
| DNS | Plesk manages DNS for the subscription |
| New landing page | `https://fatortak.rabbeh.com` - domain ID 915, created 2026-10-28, Let's Encrypt active, HTTPS redirect enabled; default Plesk page still in place |
| Existing frontend | `https://fatortakEpic.rabbeh.com` - static React build, SPA rewrite in `web.config`, Let's Encrypt certificate |
| Existing API | `https://apiFatortakEpic.rabbeh.com` - .NET 8, IIS in-process, `dotnet .\fatortak.dll` |
| API docs | `https://apiFatortakEpic.rabbeh.com/swagger/index.html` responds |
| Database | Microsoft SQL Server `<app-database>` on `<server-ip>` |
| FTP | Existing broad account with home `/`; no scoped deployment account yet |
| `fatortak.net` | Does not resolve in DNS as of 2026-10-27 |
| Main hosting domain | Live customer portal, not the Fatortak app |

The existing frontend and API are separate IIS sites. The frontend points to `https://apifatortakepic.rabbeh.com` (confirmed in the production JS bundle).

### Security note

Review the deployed API configuration for plaintext production secrets. Move database, mail, AI-provider and JWT settings to Plesk environment variables or IIS configuration. Rotate any credential that may have been exposed. Do not put secrets back into `appsettings.json` or any public file.

## What can be hosted here

- **Static landing page** (`marketing/landing/`) - yes. Plain HTML/CSS/JS, no build step.
- **Full Fatortak app** - yes, if the subscription provides the **ASP.NET Core 8** runtime and a **Microsoft SQL Server** database. Both are advertised for InterServer Windows hosting, but confirm them in Plesk before deploying.
- Docker is **not** required here. Plesk on Windows uses IIS and the ASP.NET Core Module.

## InterServer client area note

The Plesk auto-login URL (`my.interserver.net/auto_plesk_login?uuid=...`) only works from an **authenticated InterServer client-area session**. Opening the URL without that session redirects to the client-area login page. The auto-login link is not a substitute for a Plesk user.

Do not paste client-area HTML, CSRF tokens, or 2FA backup codes into chat, tickets, or repository files. Use the dedicated Plesk user for deployment access.

## Access model (least privilege)

Do **not** share the main Plesk administrator or InterServer billing password.

Create a dedicated Plesk user assigned to the Fatortak subscription:

1. In Plesk, go to **Users > User Roles > Create User Role**.
2. Name it `Fatortak Deploy`.
3. Grant only:
   - Create and manage sites
   - Manage files / File Manager
   - Create and manage databases
   - Manage SSL/TLS certificates
   - Manage DNS (only if DNS is hosted in Plesk)
   - Manage applications / ASP.NET settings (if the role exposes it)
4. Deny:
   - Manage users and roles
   - Manage subscriptions and hosting plans
   - Server administration
   - Access to Plesk API (unless a separate automation decision is made)
5. Go to **Users > Create User Account**, assign the `Fatortak Deploy` role, and give it access to the Fatortak subscription only.

Create a separate **FTPS account** scoped to the site's `httpdocs` directory:

- Plesk: **Websites & Domains > FTP Access > Add FTP Account**
- Home directory: the target domain root, e.g. `/fatortak.rabbeh.com` (not the whole subscription)
- Use **explicit FTPS** if available.
- When the account is scoped to the domain root, set `FTP_TARGET=/` in `plesk.env`.

Store credentials outside the repository, for example:

```text
C:\Users\<you>\.config\fatortak\plesk.env
```

A template is at `%USERPROFILE%\.config\fatortak\plesk.env.example`. This file is outside the repo and must never be committed.

## Current and proposed site layout

Current:

| Hostname | Content |
| --- | --- |
| `fatortakEpic.rabbeh.com` | Existing React SPA |
| `apiFatortakEpic.rabbeh.com` | Existing ASP.NET Core 8 API |
| `<app-database>` on `<server-ip>` | Existing Microsoft SQL Server database |

Proposed for the new marketing site:

| Hostname | Content |
| --- | --- |
| `fatortak.rabbeh.com` | New static landing page (`marketing/landing/`) - subdomain and SSL created; upload pending |
| `fatortakEpic.rabbeh.com` | Keep the existing app live during the landing page launch |
| `apiFatortakEpic.rabbeh.com` | Keep the existing API live |

A later cleanup can move the app to `app.fatortak.rabbeh.com` and the API to `api.fatortak.rabbeh.com`, but that requires a frontend rebuild, new SSL certificates, and DNS changes. Do not combine that migration with the landing page launch.

`fatortak.net` is not usable until its DNS is configured. Do not use it in the landing page canonical URLs or email links until it resolves.

## Landing page deployment (fatortak.rabbeh.com)

- Created from the main hosting domain as domain ID **915**.
- Document root: the domain root shown as `fatortak.rabbeh.com` in Plesk File Manager.
- SSL: Let's Encrypt certificate for `fatortak.rabbeh.com`; HTTP-to-HTTPS redirect is enabled.
- The page is static; no ASP.NET, PHP, database or SPA rewrite is needed.
- Automatic deploy: `.github/workflows/deploy-interserver.yml`; setup in [`INTERSERVER-AUTODEPLOY.md`](INTERSERVER-AUTODEPLOY.md).
- Upload these files to the domain root:
  - `index.html`
  - `styles.css`
  - `app.js`
  - `site.webmanifest`
  - `robots.txt`
  - `sitemap.xml`
  - `assets/` (logo, favicon, OG image, screenshots)
- Do **not** upload `.og-card.html`, README files, local scripts or `.env` files.
- Do **not** change any existing domain in the subscription. The landing page is isolated on `fatortak.rabbeh.com`.

## Plesk setup checklist

### 1. Confirm the runtime

Plesk Obsidian 18.0.81 supports ASP.NET Core 8.0. Verify under:

**Websites & Domains > domain > ASP.NET Settings** (or the **.NET Toolkit** extension).

If .NET 8 is not listed, stop and ask InterServer support to enable the `Microsoft ASP.NET Core 8.0` hosting feature.

### 2. Create the SQL Server database

In Plesk:

1. **Databases > Add Database**.
2. Type: **Microsoft SQL Server**.
3. Create the database and a database user.
4. Grant the user `db_owner` on that database.

Record the host, database name, username, and password. Plesk normally uses `localhost` or a local SQL Server instance. Do not reuse the existing production database or its credentials.

### 3. Enable write permissions

The API writes invoice attachments and Data Protection keys. Enable **Additional write/modify permissions** for the site, or set permissions on:

- `wwwroot/uploads`
- `App_Data`

### 4. Enable HTTPS

**Websites & Domains > SSL/TLS Certificates > Install a free Let's Encrypt certificate**, then force HTTPS.

### 5. Configure the backend

Publish the API and upload it to the API site's `httpdocs` (currently `apiFatortakEpic.rabbeh.com`):

```powershell
dotnet publish fatortak_backend/fatortak/fatortak.csproj -c Release -o deploy/api
```

In Plesk, set:

- ASP.NET Core version: **8.0**
- Application root: the folder containing `fatortak.dll` and `web.config`
- Environment: `Production`

Set these as Plesk environment variables (never commit them):

```text
ConnectionStrings__DefaultConnection=Server=localhost;Database=<db>;User Id=<user>;Password=<password>;Encrypt=False;TrustServerCertificate=True;
Jwt__Key=<long-random-secret>
Jwt__Issuer=https://fatortakEpic.rabbeh.com
Jwt__Audience=https://fatortakEpic.rabbeh.com
SeedAdmin__Email=<admin-email>
SeedAdmin__UserName=<admin-user>
SeedAdmin__Password=<strong-temporary-password>
GeminiApiKey=<optional>
OpenRouterApiKey=<optional>
EmailSetting__Host=<smtp-host>
EmailSetting__Port=587
EmailSetting__Email=<smtp-email>
EmailSetting__Password=<smtp-password>
EmailSetting__DisplayName=Fatortak
```

The API applies EF Core migrations on startup through `SeedingAdminUser.Seed`, creates the chart of accounts, and seeds the first admin user. The first request after deployment may take longer.

Do **not** upload `appsettings.json` from the repository as-is: it contains production credentials. Use environment variables or a sanitized `appsettings.Production.json`.

### 6. Build and upload the frontend

```powershell
$env:VITE_API_URL = "https://apiFatortakEpic.rabbeh.com"
npm ci --prefix fatortak_frontend
npm run build --prefix fatortak_frontend
```

Upload the contents of `fatortak_frontend/dist/` to the SPA site's `httpdocs` (currently `fatortakEpic.rabbeh.com`). If the API and SPA share one site, copy `dist/*` into the API's `wwwroot` and add the SPA fallback route before publishing.

### 7. Smoke test

- `https://fatortakEpic.rabbeh.com/` loads the login page.
- `https://apiFatortakEpic.rabbeh.com/api/auth/login` responds.
- Dashboard loads with the seeded demo/production tenant.
- Arabic UI and RTL layout work.
- AI chat loads (if API keys were configured).
- OCR upload loads (if the Gemini key was configured).
- HTTPS certificate is valid and HTTP redirects to HTTPS.

## Deployment methods

### Option A - FTPS (recommended for this Plesk plan)

Use the included dry-run-first script:

```powershell
# Preview only
.\marketing\deploy\deploy-static.ps1

# Upload, with a local backup of the current remote root files
.\marketing\deploy\deploy-static.ps1 -Live
```

The script reads `%USERPROFILE%\.config\fatortak\plesk.env`, refuses to run against `fatortak.net`, backs up the current `index.html` and `web.config`, creates the asset folders, uploads the landing files, and verifies the public page.

1. Create an FTPS account scoped to `httpdocs`.
2. Back up the current live folder with a timestamp.
3. Upload a zip or mirror the new files.
4. Keep the previous release folder for rollback.
5. Test the site before deleting the backup.

### Option B - Plesk File Manager

Suitable only for small static changes. Not practical for a full .NET publish or a large SPA build.

### Option C - GitHub Actions

The landing page has a concrete, opt-in workflow:

- File: `.github/workflows/deploy-interserver.yml`
- Reference: [`INTERSERVER-AUTODEPLOY.md`](INTERSERVER-AUTODEPLOY.md)
- Secrets: `INTERSERVER_FTP_HOST`, `INTERSERVER_FTP_PORT` (optional), `INTERSERVER_FTP_USER`, `INTERSERVER_FTP_PASSWORD`, `INTERSERVER_FTP_DIR`
- Variable: `INTERSERVER_AUTODEPLOY=true` enables push deployments; without it, pushes skip and manual runs still work.

Use `workflow_dispatch` with `dry_run: true` first, then run live once, then enable the variable. The workflow backs up the live root files as an artifact, deploys only `marketing/landing/`, and smoke-tests `https://fatortak.rabbeh.com/`.

### Option D - Plesk Git

Only if the **Git** extension is installed. This deploys source, not built artifacts, so it is not recommended for this project unless a dedicated build branch is maintained.

## Build commands

```powershell
# Backend
dotnet publish fatortak_backend/fatortak/fatortak.csproj -c Release -o deploy/api

# Frontend
$env:VITE_API_URL = "https://apiFatortakEpic.rabbeh.com"
npm ci --prefix fatortak_frontend
npm run build --prefix fatortak_frontend
```

## Landing page only

No build step is required:

```powershell
# Upload the contents of marketing/landing/ to the fatortak.rabbeh.com domain root
```

Files: `index.html`, `styles.css`, `app.js`, `assets/`, `site.webmanifest`, `robots.txt`, `sitemap.xml`.

## Safety rules

- Back up before every deploy.
- Use a staging subdomain first when possible.
- Keep the previous release for rollback.
- Never commit `.env`, `appsettings.json` secrets, or the `plesk.env` file.
- Do not enable directory browsing.
- Set `ASPNETCORE_ENVIRONMENT=Production`.
- Restrict CORS to the real domain; the current `AllowAll` policy is too broad for production.
- Rotate database, JWT, SMTP, Gemini, and OpenRouter secrets after initial setup if they were shared during configuration.
- Do not deploy the marketing automation live-posting flags as part of this site. Marketing runs separately in GitHub Actions and is dry-run by default.

## Open items

- [x] Confirm the subscription, primary domain, and docroot.
- [x] Confirm ASP.NET Core 8 and Microsoft SQL Server are available.
- [x] Confirm the existing frontend, API, and database are live.
- [x] Finish the new `marketing/landing/` page (3D design, real screenshots, AI chat and OCR sections).
- [x] Create `fatortak.rabbeh.com` and issue a Let's Encrypt certificate.
- [ ] Upload the landing page to `fatortak.rabbeh.com`.
- [ ] Create a dedicated FTPS account scoped to `fatortak.rabbeh.com` for repeatable deployments.
- [ ] Decide: landing page only, or also update the existing app.
- [x] Add the dry-run manual deployment script and the opt-in GitHub Actions workflow.
- [x] Document automatic deployment in [`INTERSERVER-AUTODEPLOY.md`](INTERSERVER-AUTODEPLOY.md).
- [ ] Add the GitHub FTP secrets and set `INTERSERVER_AUTODEPLOY=true`.
- [ ] Rotate the exposed SQL, SMTP, OpenRouter, and JWT secrets; move them out of `appsettings.json`.
- [x] Update `marketing/README.md` with the chosen deploy command.
