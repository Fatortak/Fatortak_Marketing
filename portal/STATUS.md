# Fatortak marketing status — 31 October 2026

## Live

- Landing page: <https://fatortak.rabbeh.com>
- Privacy policy: <https://fatortak.rabbeh.com/privacy.html>
- Product demo: <https://fatortak.rabbeh.com/demo.mp4>
- First-party traffic stats: <https://fatortak.rabbeh.com/stats.php>
- Portal: <http://127.0.0.1:4180> (local-first, not exposed publicly)

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

The new Facebook Page and Instagram account were both connected to the portal and passed their connection tests (`Page: Fatortak Software Solutions`, `@fatortak.software`). Instagram remains verified through the durable Fatortak Automation system-user token, so it does not depend on the Page link. Facebook's Page token was short-lived and has now expired, and the automation browser's Meta session was logged out, so the Facebook channel needs one re-login before it can post again. Meta's desktop file picker still routes profile/cover uploads into the Reels composer, and the profile-picture endpoint rejects `pages_manage_metadata` as an invalid scope in the current API version; the Page profile picture and cover photo still need one manual upload from Business Suite or the mobile app.

## Channels

| Channel | Account | State |
| --- | --- | --- |
| X | @Fatortakk | Connected and verified through OAuth 1.0a. Posting needs X API credits. |
| Bluesky | @fatortak.bsky.social | Connected and verified with an app password. |
| Facebook Page | Fatortak Software Solutions | Page token expired; the automation browser session was logged out. Sign in to Facebook with the account phone number (private notes) and password, then mint a fresh Page token. |
| Instagram | @fatortak.software | Connected and verified with the durable Fatortak Automation system-user token. Profile image set. |
| LinkedIn | Fatortak company page | App and company page verified; Community Management API access needs the registered legal entity form. |
| Threads | @fatortak.software | Profile and bio set. Needs a Threads access token before the portal can publish. |
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
The token is valid for roughly an hour; refresh it before a long unattended run.

### Current blocker — Facebook

The automation browser's Meta session was reset during the long pause. `facebook.com`,
`business.facebook.com` and `developers.facebook.com` all show a logged-out state. The login
identifier is the account phone number (stored in the private notes); the stored Instagram
password is not the Facebook password, and no Facebook password is available in the private
notes. Facebook also requires the account password to reveal the app secret or extend a token.

To restore publishing: sign in to Facebook once with the phone number and password, then
repeat the Graph API Explorer steps above. Instagram is unaffected because it uses the
durable Fatortak Automation system-user token.

### Meta Pages and the Instagram link

- The new Page is owned by the Fatortak portfolio; `GET /1256906939088063/owned_pages`
  returns `1338665946004849`. The three Pages in the personal Page switcher are older
  personal Pages — business-owned Pages do not appear there.
- `@fatortak.software` is in the portfolio but is not linked to the Page. The Instagram-side
  "Connect Facebook Page" wizard was opened through Instagram SSO, but its Next step needs
  Settings access for the IG profile.
- A Business Suite access request was sent on 31 Oct 2026. After the full-control Facebook
  admin approves it, rerun the Instagram-side wizard or use
  Page → Connected assets → Connect assets → Instagram account.

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
