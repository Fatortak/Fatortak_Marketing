# Notes for coding agents working in this repository

Two agents share this checkout (`main`). Read this before editing.

## Ownership

- **Portal (`portal/server.mjs`, `portal/adapters.mjs`, `portal/public/*`, `portal/test-*.mjs`,
  `portal/README.md`, `portal/ROADMAP.md`): free to edit again.** Claude Code finished the comments
  inbox, comment → DM rules and the light redesign. Run `npm test` in `portal/` before committing.
- Content, queue builders (`portal/scripts/*`), landing assets and deployment: yours (the content agent's).
  Claude Code will not touch `portal/scripts/*`.

## Rules for both agents

- Commit small and often on `main`; never rewrite or force-push history.
- Before editing a file, run `git status` and `git diff <file>`; do not overwrite someone else's
  uncommitted work.
- Production publishes for real. Never call live platform APIs from tests; use dry run.
- **Never point a test or local server at the real credentials.** `portal/.env` holds production
  tokens. Tests set `PORTAL_ENV_FILE` to a temp file and `PORTAL_ISOLATED=1`; keep it that way.

## What changed in the portal (for deploy)

- New data in `portal.json` (created automatically on load): `automations`, `automationRuns`,
  `trash`, `metricsHistory`, `settings.channelRules`, per-post `overrides`, `metrics`, `automationRuns`.
- More new data: `comments`, `commentRules`, `commentRuleSent`, `savedReplies`, `commentsSyncedAt`.
- Deploy copies `server.mjs`, `adapters.mjs` and `public/*` as before; no new files are needed at runtime.
- Asset cache keys bumped to `?v=20261104-4`.
- The dashboard is now a **light theme with primary `#0099CC`**; all colours are tokens in
  `public/styles.css`.
- On the live server the portal now **reads comments every 5 minutes** (read-only). No comment rule
  exists by default, so no DM is sent until someone creates one and live mode is on.
- For DMs on Facebook/Instagram the Meta app needs `pages_messaging` / `instagram_manage_messages`
  (app review). Comment reading needs `pages_read_user_content` / `instagram_manage_comments`.
  Optional env `INSTAGRAM_USERNAME` lets the inbox skip the account's own Instagram replies.
- Nothing else changes until someone turns it on: no channel rules, automations or comment rules
  exist by default. Deleting moves posts to Trash.

## Requests for the content agent

From a content audit of the 12/day queue (`build-daily-10.mjs`), score 42/100:

1. **Volume per channel.** Every post goes to all six channels, so Facebook, Instagram and LinkedIn get
   12 posts/day (platform guidance: Facebook/Instagram ~2, LinkedIn ~1). Either target those three
   channels on 1–2 chosen slots per day in the builder, or let the user apply recommended daily caps
   in Connections. If caps are used, tag the daily video posts `priority` so they are never capped.
2. **Repetition.** 360 posts use ~60–70 distinct messages; 55 repeat within 3 days. Add new angles
   or space repeats ≥ 7 days apart.
3. **Instagram captions** contain `{{site}}` links that can't be clicked. Turn on the Instagram
   "link in bio" rule, or write Instagram `overrides` without links.
4. **Hashtags:** none on Instagram/LinkedIn. Use channel rules (3–5 tags) or add them per post.
5. **Engagement prompts:** only 10/360 posts ask a question. Aim for ~1 in 5.
6. **Pillar mix:** 46% product, no insight posts. Add insight/tip/use-case posts.
7. Tag offers with `offer` and launches with `launch` so the automation recipes can pick them up.
8. **Upgrade videos and photos to high quality** — see the media brief below.

## Media brief: high-quality videos and photos

The owner wants professional, scroll-stopping media. Current state to replace:

- `landing/scripts/generate-videos.mjs` turns each 1200×630 `social-v3-*` card into an 8 s 9:16 MP4:
  the landscape card sits small on a blurred copy of itself, nothing moves, the audio track is
  silent, and there are no captions. It reads as a static image, not a Reel.
- Photo cards (`generate-social-v2/v3.mjs`) are 1200×630 only. Instagram's feed favours 4:5 and
  Stories need 9:16, so the same card is cropped or letterboxed everywhere.

### Videos (Reels, TikTok-style, Facebook video, Stories)

- **Format:** 1080×1920 (9:16), H.264 High, `yuv420p`, 30 fps, AAC 48 kHz stereo,
  `-movflags +faststart`, CRF ≈ 18–20, under 50 MB. Length 15–30 s (stories ≤ 15 s per clip).
- **Designed for vertical**, not a landscape card on blur: full-bleed layout, large type, the app UI
  cropped to the part that matters and scaled up so it is readable on a phone.
- **Real motion:** screen recordings of the real app with demo data (`scripts/seed-demo.mjs`) —
  cursor moving, clicks, an invoice being created, a report filtering — or at minimum smooth
  pan/zoom (Ken Burns) on high-resolution screenshots plus animated text. No frozen frames > 2 s.
- **Hook in the first 1.5 s:** a bold question or result ("Month-end close in 5 minutes?",
  "فاتورتك بتحسب الضريبة لوحدها"). No logo intro first.
- **Burned-in captions** in the post's language (Arabic right-to-left, correct shaping; English
  sentence case), inside the safe zone. Most people watch muted.
- **Safe zones:** keep text and key UI out of the top 250 px and bottom 340 px (platform UI covers them).
- **Audio:** royalty-free music you are licensed to use (or none), loudness about −14 LUFS; no
  copyrighted tracks. Optional voice-over in Arabic and English.
- **End card (last 2 s):** logo, one call to action ("Try it free — link in bio"), no URL soup.
- **Poster:** a 1080×1920 JPEG of the strongest frame (not a fade-in frame) with the same base name.
- **One video per theme in each language**: render Arabic and English separately; don't just swap a caption.

### Photos (feed and stories)

Make every card in three sizes from the same design source, same base name with a suffix:

| Use | Size | File |
| --- | --- | --- |
| Instagram / Facebook feed | 1080×1350 (4:5) | `<name>-4x5.jpg` |
| X, LinkedIn, Bluesky, Mastodon, link previews | 1200×675 (16:9) | `<name>-16x9.jpg` |
| Stories (used by the portal's Story automations) | 1080×1920 (9:16), text inside the safe zone | `<name>-9x16.jpg` |

- Render at 2× and downscale for sharp text; export sRGB JPEG quality 88–92, under 1 MB
  (Instagram accepts JPEG only for photos).
- One message per card, at most ~12 words of on-image text, headline readable at thumbnail size.
- Brand: Fatortak logo, purple/cyan palette from the existing cards, consistent type; Arabic cards
  use a proper Arabic typeface and are laid out right-to-left, not mirrored English.
- Real product UI with demo data only — never real customer names, amounts or tax numbers. No fake
  testimonials, ratings or "#1" claims (the builder's banned-terms check must still pass).
- Write an `alt` text for every image (what it shows, not "image of").

### Wiring and checks

- Put files in `landing/assets/videos/` and `landing/assets/screenshots/` (or a new
  `landing/assets/stories/` for 9:16 stills), keeping the public URL pattern
  `https://fatortak.rabbeh.com/assets/...` so Instagram/Threads can fetch them.
- In `build-daily-10.mjs`, use the 4:5 image for Instagram/Facebook posts and the 16:9 image for the
  others. The portal supports per-channel copy, but media is per post today. If you need per-channel
  media, add a request below for the portal instead of hacking it.
- Set `posterUrl`/`posterPublicUrl`/`posterName` on video posts (X and LinkedIn publish the poster).
- Before committing, check every new file: `ffprobe` shows the expected size, codec, duration and
  audio stream; images open, have the right dimensions and stay under the size limits; then preview
  a few on a phone-sized screen. Regenerate the Instagram JPEG variants
  (`landing/scripts/convert-instagram-jpegs.ps1`) if you add PNGs.
- Keep the old `v3` files until the new ones are deployed and the queue points at them.

## Requests

- **For the deployment owner:** the production login and "Portal is starting" pages in
  `portal/deploy/index.php` still use the old dark colours inline. Restyle them to the new light
  theme (white card on `#f4f7fa`, text `#0f1d2a`, primary button `#0099CC`, focus ring
  `rgba(0,153,204,.22)`) so sign-in matches the dashboard. Claude Code did not touch `deploy/`.
- **Roadmap:** `portal/ROADMAP.md` has the competitive review and the phased plan. Pick items only
  after the owner chooses them.
- **Per-channel feed media and story media.** The queue now has 4:5 launch cards, 16:9 cards and
  9:16 video posters, but the portal still publishes one media file per post. Add `channelMedia`
  (Facebook/Instagram 4:5, X/LinkedIn/Bluesky/Mastodon 16:9) and `storyMedia` (9:16) so the sizes can
  be used without splitting a post into channel-specific copies. The 7 video themes already have
  9:16 JPEG posters; the remaining 48 feed images still need 4:5 and 9:16 renders.
