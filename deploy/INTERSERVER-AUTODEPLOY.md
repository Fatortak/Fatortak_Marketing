# Automatic InterServer deployment

Status: **workflow ready, not enabled until the FTP account and GitHub secrets exist.**

This is the reference for automatically deploying the Fatortak landing page to InterServer Plesk over FTPS.

## What it does

```text
push to main
  └─ marketing/landing/** changed
       └─ GitHub Actions: .github/workflows/deploy-interserver.yml
            ├─ validates the static files
            ├─ checks the FTP secrets
            ├─ backs up the live root files as an artifact
            ├─ uploads marketing/landing/ over FTPS
            └─ smoke-tests https://fatortak.rabbeh.com/
```

The workflow only deploys the landing page. It does **not** touch the existing application:

- `fatortakEpic.rabbeh.com` (frontend)
- `apiFatortakEpic.rabbeh.com` (API)
- any other domain in the Plesk subscription

## One-time setup

### 1. Create a scoped FTP account in Plesk

In Plesk:

1. **Websites & Domains > FTP Access > Add FTP Account**
2. Account name: `fatortak-deploy` (or another clear name).
3. Home directory: `/fatortak.rabbeh.com`
4. Enable **Read** and **Write**.
5. Use **explicit FTPS**.
6. Save the password somewhere secure.

Do **not** use the main Plesk account, the subscription's system user, or an account whose home is `/`. The goal is an FTP user that can only write to the new landing subdomain.

### 2. Add GitHub repository secrets

Repository → **Settings → Secrets and variables → Actions → Secrets**.

| Secret | Required | Example | Purpose |
| --- | --- | --- | --- |
| `INTERSERVER_FTP_HOST` | yes | `<plesk-ftp-host>` | FTPS host |
| `INTERSERVER_FTP_PORT` | no | `21` | Defaults to 21 |
| `INTERSERVER_FTP_USER` | yes | `fatortak-deploy` | Scoped FTP user |
| `INTERSERVER_FTP_PASSWORD` | yes | — | Scoped FTP password |
| `INTERSERVER_FTP_DIR` | yes | `/` | Remote directory; `/` because the FTP account is already scoped to the domain root |

Do not put any of these values in the repository, a workflow file, or a commit.

### 3. Add repository variables

Repository → **Settings → Secrets and variables → Actions → Variables**.

| Variable | Required | Value | Purpose |
| --- | --- | --- | --- |
| `INTERSERVER_AUTODEPLOY` | to enable push deploys | `true` | When missing or not `true`, pushes skip the deploy job. Manual runs still work. |
| `LANDING_URL` | no | `https://fatortak.rabbeh.com/` | Used by the backup, smoke test and environment URL |

This is intentionally opt-in. Adding secrets alone does not start deploying on every push.

### 4. Test manually first

1. GitHub → **Actions → Deploy landing page to InterServer → Run workflow**
2. Run with **dry_run = true**.
3. Inspect the log. The action connects, compares files and does not upload.
4. Run again with **dry_run = false**.
5. Confirm the smoke test passes and open `https://fatortak.rabbeh.com/`.

Only after the manual live run succeeds should you set `INTERSERVER_AUTODEPLOY=true`.

## Workflow behavior

| Event | Deploy? | Dry run? |
| --- | --- | --- |
| Push to `main` touching `marketing/landing/**` | Only when `INTERSERVER_AUTODEPLOY=true` | No |
| Manual `workflow_dispatch` | Yes, even when auto-deploy is disabled | Default **true**; uncheck to upload |
| Push to any other path | No | — |
| Pull request | No | — |

The workflow uses:

- **Explicit FTPS** with `security: strict`.
- **No remote deletion** (`dangerous-clean-slate: false`). Stale assets can remain; the deploy is additive and overwrites matching files.
- A **backup artifact** of the live `index.html`, `styles.css` and `app.js` before upload, retained for 14 days.
- A **smoke test** that checks the page title/brand and the stylesheet/logo responses.
- A **concurrency group** so two landing deploys cannot run at the same time.

## Safety rules

- The FTP account must be scoped to `/fatortak.rabbeh.com` only.
- Never store FTP credentials in the repository or in a workflow file.
- Never point this workflow at `fatortakEpic.rabbeh.com` or `apiFatortakEpic.rabbeh.com`.
- Keep `INTERSERVER_AUTODEPLOY` unset until the manual live deploy has been verified.
- Protect `main` with a pull-request requirement if the repository is public.
- Rotate the FTP password periodically and after any suspected exposure.
- If you need to remove stale files, do it deliberately with the manual script or a controlled `dangerous-clean-slate` change; do not enable it by default.

## Rollback

### Quick rollback from the artifact

1. Open the failed or previous GitHub Actions run.
2. Download the `landing-backup-<run_id>` artifact.
3. Upload the files with the manual script:

```powershell
.\marketing\deploy\deploy-static.ps1 -Live
```

The manual script also backs up the current root files before uploading.

### Roll back through git

Revert the landing change and push. If `INTERSERVER_AUTODEPLOY=true`, the workflow redeploys the previous version automatically:

```powershell
git revert <commit>
git push origin main
```

Because the landing page is static, a revert is usually the cleanest rollback.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Workflow skipped on push | `INTERSERVER_AUTODEPLOY` is not set to `true` |
| `530 Login authentication failed` | FTP username/password, account status, home directory |
| `550 Permission denied` | Read/write permission on the FTP account; target path |
| FTPS certificate error | `security: strict` is intentional; fix the server certificate. Do not switch to plain FTP. |
| Connection timeout / refused | Host, port, firewall, passive mode |
| Files land in the wrong folder | `INTERSERVER_FTP_DIR`; use `/` for a scoped account |
| Smoke test fails | DNS, certificate, cache, or a failed upload; inspect the live page and the action log |
| Workflow fails asking for secrets | Add all required secrets from the table above |

The workflow intentionally fails early with the missing secret name rather than silently deploying nothing.

## Manual fallback

The PowerShell script remains available:

```powershell
# Dry run — no remote changes
.\marketing\deploy\deploy-static.ps1

# Live upload
.\marketing\deploy\deploy-static.ps1 -Live
```

It reads `%USERPROFILE%\.config\fatortak\plesk.env` and uses the same scoped FTPS account.

## What this does not cover

The full application (ASP.NET Core 8 API, React frontend, SQL Server) needs a different deployment process:

- Staging slot or subdomain first.
- Database backup before migrations.
- API health check and smoke test.
- Frontend build with the correct `VITE_API_URL`.
- Separate secrets and rollback plan.

Do not reuse this landing-page workflow for the app. The project reference for the host is [`INTERSERVER-PLESK.md`](INTERSERVER-PLESK.md).

## Alternative: Plesk Git

Plesk has a Git extension, but it deploys repository contents and does not build a React app or filter a subfolder cleanly. It is not recommended for this repository. GitHub Actions + FTPS keeps the build/deploy scope explicit and auditable.

## Files

| File | Purpose |
| --- | --- |
| `.github/workflows/deploy-interserver.yml` | Automatic/manual FTPS deployment |
| `marketing/deploy/deploy-static.ps1` | Manual dry-run-first deployment |
| `marketing/deploy/INTERSERVER-PLESK.md` | Host, DNS, SSL, app and database reference |
| `marketing/landing/` | Static landing page |
