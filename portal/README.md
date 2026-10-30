# Fatortak marketing portal

A local-first control room for scheduling, publishing, monitoring and reporting across Fatortak's social channels.

It is intentionally one service with no build step:

- Node.js HTTP server + JSON store.
- Static dashboard with no frontend framework.
- Reuses the existing automation channel adapters.
- Dry-run by default; live publishing is locked behind an environment flag.
- Media is required by default: every post must carry an image or video.
- Secrets stay in `.env` outside the API; the portal never returns them.

> The portal can save and test credentials, but it cannot create social accounts, accept platform terms, pass app review or enter an OTP for you. That one-time identity step belongs to the account owner; after it, posting is automated.

## Run it

```powershell
cd marketing/portal
Copy-Item .env.example .env   # optional; fill only the channels you have
npm start
```

Open <http://127.0.0.1:4180>.

The portal seeds itself from `marketing/content/queue.json` on first run. State is stored in `marketing/portal/data/portal.json`, which is gitignored.

## What the portal does

| View | What it shows |
| --- | --- |
| **Overview** | Publishing pipeline, followers, traffic, channel health, upcoming posts and activity |
| **Calendar** | Month view of scheduled and published posts |
| **Content** | Search/filter every post; edit, dry-run, publish, delete |
| **Composer** | Create a post, attach an image/video from the library or upload, select channels, see per-channel character limits, schedule |
| **Connections** | Click Connect, open the official console, paste credentials, save and test; see which channels are API-ready, need review, or are monitoring-only |
| **Analytics** | Traffic, traffic by source, followers, reach, engagement, clicks and last sync |
| **Reports** | Rule-based recommendations, channel mix, CSV/JSON export, latest automation report |
| **Settings** | Dry-run, auto-approve, require media, live-site guard, timezone, queue import |

## Channel automation matrix

### Fully automated posting

These have adapters in the portal. They publish when the corresponding API credentials exist and `MARKETING_LIVE=true`.

| Channel | Posting | Media | Monitoring | Credentials |
| --- | --- | --- | --- | --- |
| X | API v2 | Text via OAuth 1.0a; image upload | Partial (elevated access may be required) | `X_API_KEY`, `X_API_SECRET`, `X_OAUTH1_ACCESS_TOKEN`, `X_OAUTH1_ACCESS_TOKEN_SECRET`; optional `X_ACCESS_TOKEN` for OAuth 2.0 text |
| LinkedIn company page | API | Image upload | Organization statistics need app review | `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_AUTHOR_URN` |
| Facebook Page | Graph API | Image and video upload | Page Insights need app review | `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN` |
| Instagram Business | Graph API | Public image URL; video as Reels | Insights need app review | `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN` |
| Threads | Threads API | Public image/video URL | Insights need app review | `THREADS_USER_ID`, `THREADS_ACCESS_TOKEN` |
| Bluesky | AT Protocol | Image upload | Public profile; post metrics later | `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD` |
| Mastodon | API | Image and video upload | Public account metrics | `MASTODON_INSTANCE`, `MASTODON_ACCESS_TOKEN`, `MASTODON_ACCOUNT` |
| Telegram | Bot API | Image and video upload | Member count only | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| Discord | Webhook | Image and video upload | No native message analytics | `DISCORD_WEBHOOK_URL` |
| Dev.to | Forem API | Public cover image URL | Article views/reactions via API | `DEVTO_API_KEY` |

### Requires app review, audit or a media asset

| Channel | Reality |
| --- | --- |
| TikTok | Content Posting API requires an approved developer app audit and a video asset. The portal blocks it until then; it does not fake success. |
| YouTube | Needs OAuth, a video asset and API quota/audit. Text-only posts are not a YouTube format. |
| Instagram | Needs a public image/video URL for every post; text-only posts are blocked. |
| Threads | Needs a Threads API app and access token; image posts need a public URL. |
| WhatsApp | Opt-in template messages only. It is not a broadcast channel and cannot be fully automated for marketing. |

### Monitoring only, not automated posting

| Channel | Why |
| --- | --- |
| Hacker News | No posting API; automated self-promotion is against community norms. |
| Reddit | Subreddit rules prohibit unattended self-promotion; automation gets accounts banned. |
| Product Hunt | No public launch-posting API. |
| GitHub | Repository/release monitoring, not a social post channel. |

> **The honest answer to “nothing manual”:** every channel that allows API posting can be fully automated after a one-time OAuth/app connection. Hacker News, Reddit and Product Hunt do not allow compliant unattended posting. Automating them would risk the accounts. The portal monitors where possible and blocks the rest instead of pretending.

## Connect from the dashboard

1. Open **Connections**.
2. Click **Connect** on a channel.
3. Click **Open developer console** and create the app/token there.
4. Paste the values into the form and click **Save & test**.
5. The portal writes the values to `marketing/portal/.env`, reloads them in memory and verifies the connection. It never returns the secret.

This removes the manual file editing, but it cannot remove the platform's one-time identity step. Creating accounts, accepting terms, app review and OTP verification cannot be performed by the portal.

## Media

Text-only publishing is disabled by default (`mediaRequired: true`). The composer will not schedule or publish a post without an image or video.

- **Media library**: ten real Fatortak screenshots plus nine branded 1200×630 social cards generated from them. Queue posts are automatically matched to a relevant card or screenshot by pillar and language.
- **Upload**: images and videos up to 100 MB are stored in `marketing/portal/data/media/` (gitignored) and served from `/media/...`.
- **Native upload**: Facebook, LinkedIn, Mastodon, Telegram, Discord and Bluesky accept the file directly.
- **Image only**: X (OAuth 1.0a media keys) and Bluesky.
- **Public URL required**: Instagram, Threads and Dev.to. Set **Public media host** in Settings or `PORTAL_PUBLIC_URL` to the public address of the portal, or attach a CDN URL. Local `127.0.0.1` URLs cannot be fetched by Meta.
- **Video**: Facebook, Instagram (Reels), Threads, Mastodon, Telegram and Discord. LinkedIn, X and Bluesky video uploads are not implemented yet; the portal blocks those combinations instead of silently posting text.
- **Alt text** is stored with every post and passed to channels that support it.

The real screenshots use `https://fatortak.rabbeh.com/assets/screenshots/...` as their public URL. Until the landing page is uploaded, Instagram/Threads/Dev.to cannot fetch them; native-upload channels can use the local copy.

## Connect the live profiles

| Profile | URL |
| --- | --- |
| Facebook | <https://www.facebook.com/people/Fatortak-%D9%81%D8%A7%D8%AA%D9%88%D8%B1%D8%AA%D9%83/61578152019660/> |
| Instagram | <https://www.instagram.com/fatortak.app/> |
| TikTok | <https://www.tiktok.com/@fatortak.app> |
| LinkedIn | <https://www.linkedin.com/company/fatortak/posts/> |

### Facebook Page

1. Create a Meta developer app at <https://developers.facebook.com/>.
2. Add the **Facebook Login** and **Pages API** products.
3. Request `pages_manage_posts`, `pages_read_engagement` and `read_insights`.
4. Generate a Page access token for the Fatortak page.
5. Set `FACEBOOK_PAGE_ID` and `FACEBOOK_PAGE_ACCESS_TOKEN`.

### Instagram Business

1. Convert the Instagram account to a Business or Creator account.
2. Link it to the Fatortak Facebook Page.
3. Request `instagram_basic`, `instagram_content_publish` and `instagram_manage_insights`.
4. Set `INSTAGRAM_USER_ID` and `INSTAGRAM_ACCESS_TOKEN` in the Connections wizard.
5. Every post needs a public image URL; videos are published as Reels.

### Threads

1. Create a Threads API app through Meta.
2. Request `threads_basic`, `threads_content_publish` and `threads_manage_insights`.
3. Set `THREADS_USER_ID` and `THREADS_ACCESS_TOKEN`.
4. Media must be a public https image or video URL.

### LinkedIn company page

1. Create a LinkedIn developer app.
2. Request `w_organization_social`, `r_organization_social` and `r_organization_admin`.
3. Authorize the Fatortak company page admin.
4. Set `LINKEDIN_ACCESS_TOKEN` and `LINKEDIN_AUTHOR_URN=urn:li:organization:<id>`.
5. Images upload natively; LinkedIn video is blocked until the video upload flow is added.

### X

1. Create an X developer app and set **Read and write** permissions.
2. Generate the **OAuth 1.0a** consumer key/secret and access token/secret for the Fatortak account.
3. Set `X_API_KEY`, `X_API_SECRET`, `X_OAUTH1_ACCESS_TOKEN` and `X_OAUTH1_ACCESS_TOKEN_SECRET`.
4. `X_ACCESS_TOKEN` is optional and only used for OAuth 2.0 text posts.
5. Add X API credits before enabling live posting; the API is pay-per-use.

### Bluesky

1. Open Bluesky **Settings → App passwords**.
2. Create an app password.
3. Set `BLUESKY_HANDLE` and `BLUESKY_APP_PASSWORD`.

### Mastodon

1. Create an access token in your Mastodon instance.
2. Set `MASTODON_INSTANCE`, `MASTODON_ACCESS_TOKEN` and `MASTODON_ACCOUNT`.

### Telegram and Discord

- Telegram: create a bot with @BotFather, add it to the channel as admin, set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
- Discord: create a webhook in the channel and set `DISCORD_WEBHOOK_URL`.

### Dev.to

1. Create an API key in Dev.to **Settings → Extensions → DEV Community API Keys**.
2. Set `DEVTO_API_KEY`.

## Publishing safety

- The portal starts in **dry run**. No live API is called.
- `MARKETING_LIVE=true` unlocks live publishing.
- `PORTAL_AUTO_PUBLISH=true` enables the local scheduler. It only runs while the portal process is running.
- The scheduler publishes posts with status `scheduled` when their time is due.
- If `requireLiveSite` is on, posts containing `{{site}}` are blocked until `https://fatortak.rabbeh.com/` responds.
- If `mediaRequired` is on (default), posts without an image or video are blocked before any channel API is called.
- A post can be published manually with **Publish live** after confirmation.
- The portal never deletes a published platform post; deleting in the portal removes only the local record.

## Metrics and traffic

- Landing traffic: a cookie-less first-party counter (`track.php` + `stats.php`) records aggregate daily pageviews, referrer source and a daily visitor hash in `App_Data/traffic.json`. The portal reads it automatically. Raw IP addresses are not stored in the analytics file.
- Plausible is optional: set `PLAUSIBLE_SITE_ID` and `PLAUSIBLE_API_KEY` to use Plausible aggregate and a 30-day source breakdown instead.
- GitHub: stars/forks/open issues from the public API.
- Bluesky: followers/posts from the public profile.
- Mastodon: followers/statuses from the instance API.
- X, LinkedIn, Facebook, Instagram, Threads, TikTok and YouTube metrics require their respective APIs and app permissions. Until those are connected, the portal shows **needs setup** instead of a fake number.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/overview` | Dashboard payload |
| GET | `/api/posts` | List/filter posts |
| POST | `/api/posts` | Create post |
| PUT | `/api/posts/:id` | Update post |
| POST | `/api/posts/:id/status` | Change status |
| POST | `/api/posts/:id/publish` | Publish now (dry-run by default) |
| POST | `/api/posts/:id/duplicate` | Copy post |
| DELETE | `/api/posts/:id` | Delete local post |
| GET | `/api/calendar?month=YYYY-MM` | Calendar posts |
| GET | `/api/connections` | Channel modes, setup links, media support and verification |
| PUT | `/api/connections/:channel/credentials` | Save whitelisted credentials to `.env` |
| POST | `/api/connections/:channel/test` | Verify the saved credentials |
| GET | `/api/media` | Uploaded files + screenshot library |
| GET | `/api/media/library` | Screenshot library only |
| POST | `/api/media` | Upload image/video (raw body, `X-File-Name` header) |
| DELETE | `/api/media/:id` | Delete an uploaded file |
| GET | `/api/metrics` | Metrics + traffic |
| POST | `/api/metrics/sync` | Sync available metrics |
| GET | `/api/reports/summary` | Report payload |
| GET | `/api/reports/export?format=csv\|json` | Export |
| GET/PUT | `/api/settings` | Safe settings |
| POST | `/api/import-queue` | Import the 90-day queue |

## Security

- Binds to `127.0.0.1` by default.
- Set `PORTAL_ADMIN_TOKEN` before exposing it behind a reverse proxy. The API requires `Authorization: Bearer <token>`.
- Mutating API calls reject cross-origin requests (`Origin` must match the host), which blocks drive-by CSRF against localhost.
- Tokens are read from `marketing/automation/.env` and `marketing/portal/.env`; existing environment variables win.
- The Connections wizard writes only whitelisted keys to `marketing/portal/.env` (mode `0600`) and updates the running process without a restart.
- The portal never stores tokens in `portal.json` and never returns them from an API.
- Media uploads are stored in `data/media/` (gitignored) and served with `nosniff`, `SAMEORIGIN` and path-traversal protection.
- `data/`, `.env`, `export/` and `backups/` are gitignored.

## Extending

Add a channel adapter in `marketing/portal/adapters.mjs`:

1. Add a `post<Channel>` function.
2. Add the channel to `LIMITS`.
3. Route it in `publishToChannel`.
4. Add its credential checks in `connectionState`.
5. Add it to `CHANNEL_DEFS` in `server.mjs`.

Do not add an adapter for a platform that prohibits unattended posting. Use monitoring instead.
