# Fatortak marketing status — 1 November 2026

## Live

- Landing page: <https://fatortak.rabbeh.com>
- Privacy policy: <https://fatortak.rabbeh.com/privacy.html>
- Product demo: <https://fatortak.rabbeh.com/demo.mp4>
- First-party traffic stats: <https://fatortak.rabbeh.com/stats.php>
- **Production portal: <https://fatortak.rabbeh.com/portal/>** (password login, HTTPS only)
- Local portal (development): <http://127.0.0.1:4180>

The landing page has the real product screenshots, the 20-second demo video, full English/Arabic RTL, the current pricing, the privacy link and the cookie-less first-party pageview counter.

## New assets created 31 October 2026

- Facebook Page: **Fatortak Software Solutions**, ID `1338665946004849` (public profile id `61596116458880`), Software Company category, owned by the Fatortak business portfolio.
- Instagram: **@fatortak.software**, ID `17841429322066567`, professional (Business) profile, profile image live.
- Threads: **@fatortak.software**, bio and profile image live.
- Mastodon: **@fatortaksoftware@mastodon.social**, confirmed and branded; avatar, header and bio set; connected to the portal.
- X `@Fatortakk` and Bluesky `@fatortak.bsky.social` profile images were updated through their APIs.

Prepared upload assets:

- `marketing/landing/assets/social/avatar.png`
- `marketing/landing/assets/social/facebook-cover.png`
- `marketing/landing/assets/social/youtube-banner.png`

The new Facebook Page and Instagram account are both connected to the portal and passed their connection tests (`Page: Fatortak Software Solutions`, `@fatortak.software`). Instagram remains verified through the durable Fatortak Automation system-user token, so it does not depend on the Page link. The Page and Instagram profile are now linked in Meta: the Page Home shows **Edit Instagram profile** instead of **Connect Instagram**, the cover is set, and the Page avatar is the real Fatortak logo. Facebook now uses a **non-expiring Page token** (`expires_at: 0`), so no refresh schedule is needed unless it is revoked. The duplicate orange **Fatortak Software** Page still needs manual unpublish/delete.

## Channels

| Channel | Account | State |
| --- | --- | --- |
| X | @Fatortakk | Connected and verified through OAuth 1.0a. Posting needs X API credits. |
| Bluesky | @fatortak.bsky.social | Connected and verified with an app password. |
| Facebook Page | Fatortak Software Solutions | Connected and verified with a **non-expiring Page token**. App secret and long-lived user token stored privately. |
| Instagram | @fatortak.software | Connected and verified with the durable Fatortak Automation system-user token. Profile image set. |
| LinkedIn | Fatortak company page | App and company page verified; Community Management API access needs the registered legal entity form. |
| Threads | @fatortak.software | OAuth token generated and saved, but the Threads API is blocked pending App Review or a Threads Tester. Portal test currently fails. |
| Mastodon | @fatortaksoftware@mastodon.social | Connected and verified. Avatar, header and bio set. |
| Telegram, Discord, Dev.to | — | Need one-time tokens/webhooks. |
| TikTok, YouTube | — | Need platform audit/OAuth and video assets. |
| Reddit, Hacker News, Product Hunt | — | Monitoring only; unattended posting violates their rules. |

## Publishing safety

The portal is deliberately still in **dry run** with live publishing locked and the scheduler off. This prevents partial posts while the Facebook Page token is short-lived and X has no credits.

### Facebook Page token refresh

The Page token came from **Graph API Explorer → Fatortak → Generate Access Token** with
`pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `read_insights`,
`business_management`, `instagram_basic`, `instagram_content_publish` and
`instagram_manage_insights`. Select only **Fatortak Software Solutions** on the asset
screen. Then run `GET /me/accounts?fields=id,name,access_token` and store the returned
Page token as `FACEBOOK_PAGE_ACCESS_TOKEN` (`FACEBOOK_PAGE_ID=1338665946004849`).
The Page token is non-expiring; repeat these steps only if it is revoked.

### Facebook token

Facebook now uses a **non-expiring Page token**: `debug_token` reports `expires_at: 0`.
It was created by exchanging a fresh user token with the app secret, then reading the Page
token from `/me/accounts`. The app secret and long-lived user token are stored in the
private `%USERPROFILE%\.config\fatortak\meta.md`, never in the repository. The portal test
passes: `Page: Fatortak Software Solutions`.

No scheduled refresh is required. If the token is ever revoked, re-run the Graph API
Explorer flow above, exchange the fresh user token with the stored app secret, and save the
new Page token.

### Threads blocker

The Threads OAuth flow completed and the token was saved, but `graph.threads.net` returns:
“This action requires the threads_basic permission. You must submit for app review, or your
user must be in the list of Threads testers.” Adding the Threads profile as a tester failed
because it has no Facebook Developer Account; the app roles input expects a valid Facebook
user ID. Next: submit the Threads API use case for App Review, or add a Threads account
backed by a Facebook Developer Account as a tester.

### Meta Pages and the Instagram link

- The new Page is owned by the Fatortak portfolio; `GET /1256906939088063/owned_pages`
  returns `1338665946004849`. The three Pages in the personal Page switcher are older
  personal Pages — business-owned Pages do not appear there.
- The Instagram profile was given Page access, then connected successfully. The Page Home
  now shows **Edit Instagram profile** and **Instagram followers** instead of
  **Connect Instagram**, which confirms the Page–Instagram link.
- The Page cover photo and avatar are both set: the cover is the branded gradient artwork
  and the avatar is the real Fatortak logo.
- The duplicate **Fatortak Software** Page (orange “F”, 0 followers) is under
  **Your Account**, not the Fatortak portfolio. Delete or unpublish it manually; do not
  delete the green **Fatortak Software Solutions** Page.
- The Instagram profile’s Business Suite tool-access request is separate from the Page
  role. The Page-side management works; the IG-side Business Suite home may still ask for
  access. This does not affect the link or API publishing.

To enable live automatic publishing after fixing the connections:

```powershell
$env:MARKETING_LIVE="true"
$env:PORTAL_AUTO_PUBLISH="true"
npm start
```

Then turn off dry run in **Settings**. The scheduler will publish due posts, skip channels that are unconfigured or whose last connection test failed, and record per-channel results.

The queue is **90 posts at 3 per day** (09:00, 13:00, 19:00 Cairo) from 2 November to 1 December 2026. Every post has an image; the library now has **37 unique visuals** — 30 new `social-v2` cards plus the original social cards. Repeated hooks were varied and the queue includes a full pricing post (Starter 300 / Professional 600 / Enterprise 900 EGP/month).

## Deployment

- Production URL: <https://fatortak.rabbeh.com/portal/>
- The portal is a PHP front controller (`marketing/portal/deploy/index.php`) in `/portal/` plus the Node service in `App_Data/portal-app/`.
- PHP handles the password login, signed HttpOnly session cookie, rate limiting, security headers, Node process supervision and the HTTPS-only reverse proxy.
- The Node service binds `127.0.0.1:4318` and requires a private bearer token (`App_Data/portal-app/node.token`) that PHP injects on every proxied request.
- State, `.env`, uploaded media and backups live under `App_Data/portal-app/`, which IIS does not serve (verified `403`).
- Node restarts automatically from the PHP supervisor. Authenticated operators can restart it with `/portal/?restart=1`.
- Deploy with `marketing/portal/scripts/build-production.ps1` and `marketing/portal/scripts/deploy-production.ps1`. Re-deploys keep the remote data and `.env` unless `-ForceData` / `-ForceEnv` is used.
- Production credentials live in `%USERPROFILE%\.config\fatortak\portal-production.txt` (outside the repo). Plesk admin is not required for this deployment path.
- Static landing deployment still uses the scoped FTPS account in `%USERPROFILE%\.config\fatortak\plesk.env`.
- Portal `.env` and runtime data are gitignored. A private backup lives in `%USERPROFILE%\.config\fatortak\portal-backup`; the server also rotates 40 snapshots in `App_Data/portal-app/data/backups`.

## Current publishing state

- The queue is **90 posts at 3 per day** (09:00, 13:00, 19:00 Cairo) from 2 November to 1 December 2026.
- Every post has an image; the library has **37 unique visuals** — 30 new `social-v2` cards plus the original social cards.
- The production portal is **live and armed**: dry run is off, `MARKETING_LIVE=true` and `PORTAL_AUTO_PUBLISH=true`. The first scheduled post is **2 November 2026 at 09:00 Cairo**.
- X posting still needs API credits; Threads API is still blocked by Meta App Review/tester access. The scheduler records those results per channel and continues with the channels that are ready.
- Keep the Node service warm. The GitHub Actions keepalive pings `/portal/?ping=1` every 10 minutes; if IIS recycles the app pool, the next ping restarts Node and the scheduler catches overdue posts on startup.

## Repository

- Branch: `marketing/social-plan-clean`
- Latest work: branded social cards and first-party analytics.
- The main `D:\Courses\fatortakProject_Version` worktree has unrelated uncommitted UI changes and was not modified.
