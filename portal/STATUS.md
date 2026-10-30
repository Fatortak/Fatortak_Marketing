# Fatortak marketing status — 30 October 2026

## Live

- Landing page: <https://fatortak.rabbeh.com>
- Privacy policy: <https://fatortak.rabbeh.com/privacy.html>
- Product demo: <https://fatortak.rabbeh.com/demo.mp4>
- First-party traffic stats: <https://fatortak.rabbeh.com/stats.php>
- Portal: <http://127.0.0.1:4180> (local-first, not exposed publicly)

The landing page has the real product screenshots, the 20-second demo video, full English/Arabic RTL, the current pricing, the privacy link and the cookie-less first-party pageview counter.

## Channels

| Channel | Account | State |
| --- | --- | --- |
| X | @Fatortakk | Connected and verified through OAuth 1.0a. Posting needs X API credits. |
| Bluesky | @fatortak.bsky.social | Connected and verified with an app password. |
| Facebook Page | Fatortak-فاتورتك | Credentials saved, but the Meta token expired on 28 Oct 2026. Regenerate a long-lived Page token. |
| Instagram | @fatortak.app | Credentials saved, but the Meta token expired on 28 Oct 2026. Regenerate with the Facebook Page token. |
| LinkedIn | Fatortak company page | App and company page verified; Community Management API access needs the registered legal entity form. |
| Threads | — | Needs a Threads app secret, HTTPS redirect URI and access token. |
| Mastodon, Telegram, Discord, Dev.to | — | Need one-time tokens/webhooks. |
| TikTok, YouTube | — | Need platform audit/OAuth and video assets. |
| Reddit, Hacker News, Product Hunt | — | Monitoring only; unattended posting violates their rules. |

## Publishing safety

The portal is deliberately still in **dry run** with live publishing locked and the scheduler off. This prevents partial posts while the Facebook/Instagram tokens are expired and X has no credits.

To enable live automatic publishing after fixing the connections:

```powershell
$env:MARKETING_LIVE="true"
$env:PORTAL_AUTO_PUBLISH="true"
npm start
```

Then turn off dry run in **Settings**. The scheduler will publish due posts, skip channels that are unconfigured or whose last connection test failed, and record per-channel results.

The 90-day queue is scheduled from 2 November 2026. Every post has an image, including nine branded 1200×630 social cards and one Arabic RTL card.

## Deployment

- Static deployment works with the scoped FTPS account in `%USERPROFILE%\.config\fatortak\plesk.env`.
- Plesk presents a self-signed certificate, so use the deployment script with `-Insecure` or `curl -k`.
- GitHub Actions deployment still needs repository secrets/variables and GitHub sign-in.
- Portal `.env` and runtime data are gitignored. A private backup lives in `%USERPROFILE%\.config\fatortak\portal-backup`.

## Repository

- Branch: `marketing/social-plan-clean`
- Latest work: branded social cards and first-party analytics.
- The main `D:\Courses\fatortakProject_Version` worktree has unrelated uncommitted UI changes and was not modified.
