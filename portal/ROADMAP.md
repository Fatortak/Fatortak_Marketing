# Fatortak Marketing OS — competitive gap review and implementation plan

_Plan only. Written 4 November 2026 after the comments inbox, comment → DM rules and light redesign shipped._

## 1. What we compared against

| Product | Known for |
| --- | --- |
| Hootsuite | Enterprise suite: listening, ads, AI assistant (OwlyGPT) over analytics, approvals, MCP server |
| Sprout Social | Deepest analytics and social listening, smart inbox, team workflows |
| Agorapulse | Unified inbox with assignment, inbox rules, CRM-like contact history |
| Buffer | Simplicity: posting slots/queue, Start Page (link in bio), AI assistant, low price |
| Later | Visual planner for Instagram/TikTok, Link in Bio, best-time suggestions |
| Metricool | Analytics + competitors + ads in one, value pricing |
| Planable | Client/teammate approval on a post preview with comments, like a doc |
| SocialBee / Publer | Content categories and evergreen recycling, bulk scheduling, RSS |
| ContentStudio | Content discovery, AI assistant, public API and MCP server |
| ManyChat (and InstantDM, LinkDM) | Instagram comment → DM flows, follow-gates, lead capture, DM keyword triggers |

## 2. Where Fatortak Marketing OS already matches or leads

- Scheduling across 10 API channels with dry run, per-channel copy, platform-accurate character counting and live previews.
- Content health audit (repeats, volume per channel, Instagram links, hashtags) — most tools don't audit the queue at all.
- Automations: Stories, teasers, follow-ups and offer announcements around posts.
- Comments inbox for Facebook, Instagram, Bluesky and Mastodon, with comment → DM rules that understand Arabic.
- Calendar drag-and-drop, bulk actions, revisions, trash, templates, media library, honest analytics windows.
- Arabic-first: RTL copy, Arabic keyword normalisation, bilingual queue. Competitors treat Arabic as an afterthought.

## 3. Gaps, ranked

Scoring: **Impact** for a small MENA marketing team (H/M/L), **Effort** (S ≤ 2 days, M ≤ 1 week, L > 1 week), and blockers.

| # | Gap | Who has it | Impact | Effort | Blocker |
| --- | --- | --- | --- | --- | --- |
| 1 | Team accounts, roles and approval workflow | All | H | L | none |
| 2 | AI writing assistant (draft, rewrite per channel, translate AR↔EN, hashtags); provider chosen in Settings, enabled only after its key is verified | All | H | M | user's own API key |
| 3 | Posting slots + evergreen categories ("queue" mode) | Buffer, SocialBee | H | M | none |
| 4 | Best time to post (from our own results) | Later, Sprout, Metricool | H | S | needs post metrics |
| 5 | Incoming DM inbox (not only comments), assignment, internal notes | Agorapulse, Sprout | H | M | Meta messaging review |
| 6 | Advanced DM flows: follow-gate, buttons, lead capture | ManyChat | H | L | Meta messaging review |
| 7 | Link-in-bio page | Later, Buffer | M | S | none |
| 8 | Scheduled PDF/email reports, custom date ranges | Sprout, Metricool | M | M | none |
| 9 | Notifications (Telegram/email/Slack) for failures, approvals, new comments | All | M | S | none |
| 10 | Instagram first comment, carousels, Reels covers, collaborators | Later, Publer | M | M | IG API limits |
| 11 | Competitor benchmarking | Metricool, Sprout | M | M | public data only |
| 12 | Social listening (mentions, keywords, sentiment) | Hootsuite, Sprout | M | L | X paid tier |
| 13 | Content ideas board (Kanban) and campaigns with goals | Planable, Loomly | M | M | none |
| 14 | Integrations: Canva, Google Drive, Unsplash; webhooks/Zapier | All | M | M | app approvals |
| 15 | Public API + MCP server (let AI agents run the portal safely) | Hootsuite, ContentStudio | M | M | auth design |
| 16 | More channels: TikTok, YouTube Shorts, Pinterest, Google Business Profile | All | M | L | platform audits |
| 17 | PWA with push notifications and mobile approvals | Hootsuite, Buffer | M | M | none |
| 18 | Security: per-user login, 2FA, sessions list | Enterprise tools | M | M | ties to #1 |
| 19 | Ads: boost posts, ad performance | Metricool, Hootsuite | L | L | ad account review |

## 4. Implementation plan

### Phase 1 — Team and trust (weeks 1–3)

**1. Team accounts, roles, approvals** (#1, #18)
- Data: `users[]` (name, email, role, password hash via the PHP login, 2FA secret), `post.assignee`, `post.approvals[]`, `post.comments[]` (internal thread).
- Roles: Owner (connections, settings), Editor (create, schedule), Reviewer (approve/request changes), Viewer.
- UX: approval panel in the editor's side tabs ("Review": approve / request changes / comment, with @mentions); "Needs my review" filter and a badge; approval required before Scheduled when a setting is on; who changed what in Activity.
- Production login already runs in PHP; extend it to multiple users and pass the user id to Node in a signed header.
- Done when: a reviewer can approve from a phone, an editor cannot schedule an unapproved post, every change shows its author.

**2. Notifications** (#9)
- Channels: Telegram bot (already an adapter), email, Slack webhook. Events: publish failed, connection test failed, approval requested, new comment matching a rule, daily digest.
- UX: Settings → Notifications with per-event toggles and a "send test" button.

**3. Best time to post** (#4)
- From `post.metrics` (engagement per post, per channel, per hour and weekday) build a heatmap; fall back to platform guidance until 20+ posts are measured.
- UX: heatmap on Analytics; "Best time" quick pick next to "Next free slot" in the editor; calendar cells tinted by score.

### Phase 2 — Create faster (weeks 3–6)

**4. AI assistant** (#2) — owner decision 4 Nov 2026: AI is **off by default and switched on in Settings**, with the user's own provider and key.
- **Settings → AI assistant**, in three steps:
  1. **Choose a provider.** Gateways: Command Code, OpenCode Zen, OpenRouter. Model labs: Claude (Anthropic), ChatGPT (OpenAI), Gemini, DeepSeek, Mistral, Grok (xAI), Qwen, Kimi (Moonshot), Cohere, Perplexity. Fast/open: Groq, Together. Local/custom: Ollama, any OpenAI-compatible URL.
  2. **Paste the API key** (stored in the portal env file as `AI_KEY_<PROVIDER>`, never returned to the browser or written to `portal.json`) and pick a model (suggestions + "Load models" from the provider).
  3. **Check key.** A real call to that provider with that model must succeed.
- **AI can be enabled only after the key check passes.** The server refuses `enabled: true` otherwise; changing provider, model, base URL or key turns AI off until it is checked again.
- One server module (`ai.mjs`, no dependencies): Claude through the native Messages API (default `claude-opus-5-5`, server-side refusal fallback), every other provider through its OpenAI-compatible endpoint.
- Actions in the editor: Draft from an idea, Improve, Shorten, Make it a question, Suggest hashtags, Translate (Egyptian Arabic / MSA / English), Alt text, and "Adapt with AI" per channel within its character limit. Inbox: "Suggest reply". Analytics: "Ask AI about your results".
- UX: a "✨ AI" menu next to the copy box; results appear as a suggestion card with Replace / Insert below / Copy / Discard — never applied or published automatically. Controls are hidden while AI is off.
- Guardrails: brand voice, banned terms (warned when they appear in output), no invented customers, numbers, ratings or "#1" claims, daily request limit and usage counter in Settings.

**5. Posting slots and evergreen categories** (#3)
- Data: `slots[]` per weekday/time/channel set; `categories[]` (Product, Tips, Offers…) each with a share of slots; posts can be `evergreen` with a minimum gap (e.g. 30 days) before reuse.
- UX: Settings → Schedule shows a weekly grid of slots; "Add to queue" button in the editor drops the post in the next free slot of its category; calendar shows empty slots as dashed placeholders you can click to fill.
- This also solves the repetition and over-posting the content audit found.

**6. Instagram depth** (#10)
- First comment (post a comment from the account right after publishing — hashtags or link), carousels (multi-media posts), Reels cover selection, collaborator invites where the API allows.
- UX: media box becomes a sortable strip of up to 10 items; Instagram card in the preview shows a "First comment" field.

**7. Link-in-bio page** (#7)
- A static, fast page on the landing domain (`/links`) generated from published posts plus pinned links, with UTM per button; edited from a new "Link in bio" view with live phone preview.
- Pairs with the Instagram "link in bio" channel rule we already have.

### Phase 3 — Engage and convert (weeks 6–10)

**8. Full inbox** (#5)
- Add incoming DMs (Messenger, Instagram, Bluesky chat, Mastodon direct) via webhooks where available, polling otherwise.
- Conversation view: thread on the left, contact card on the right (name, channels, past comments, tags, notes), assignment to a teammate, status (open/pending/closed), first-response time.
- Inbox rules beyond DMs: auto-hide spam/profanity, auto-tag by keyword, auto-assign by channel or language, sentiment label.
- UX: keyboard-first (J/K to move, R reply, E close), saved replies with variables (exists), Arabic/English auto-translate toggle on each message.

**9. ManyChat-style flows** (#6)
- Flow builder for DM conversations started by a comment or a DM keyword: message → quick-reply buttons → branch; follow-gate ("follow us to get the link" with a re-check button); collect email/phone into a contacts list; tag contacts; send to a webhook/CRM.
- Respect platform rules: only reply to people who wrote first, within the 24-hour messaging window, opt-out keyword (STOP / إلغاء) honoured automatically.
- UX: a vertical step editor (not a free canvas) with live chat-bubble preview in Arabic or English, plus a test mode that runs the flow in the browser.

**10. Reports that send themselves** (#8)
- Custom date ranges and comparisons (this month vs last), per-campaign/tag reports, PDF export with logo, scheduled email every Monday.
- UX: Reports → "Schedule this report"; a print-friendly layout.

### Phase 4 — Grow the platform (weeks 10+)

**11. Competitors and listening** (#11, #12)
- Track 3–5 competitor public profiles (followers, posting frequency, top posts) on Bluesky, Mastodon, Facebook Pages (public fields), Instagram (Business Discovery API).
- Listening for brand and keywords: Reddit, Hacker News, Bluesky and Mastodon search (free), X when a paid tier exists; mentions feed into the inbox as "Mentions".

**12. Ideas board and campaigns** (#13)
- Kanban (Idea → Draft → Review → Scheduled) using existing statuses; campaigns group posts with a goal (visits, sign-ups) measured through UTM + landing stats.

**13. Integrations and API** (#14, #15)
- Media: Canva "Design" button (Canva Connect API), Google Drive and Unsplash pickers in the media library.
- Outbound webhooks on publish/comment/lead; Zapier-compatible.
- Public REST API with per-user tokens and an MCP server exposing safe tools (list posts, draft post, dry run, read analytics), so AI agents can work through the same permission model as people.

**14. More channels** (#16)
- Google Business Profile posts (good for local MENA SMBs), Pinterest, TikTok (after Content Posting API audit), YouTube Shorts (OAuth + quota).

**15. Mobile** (#17)
- PWA manifest + service worker, push notifications for approvals, failures and new comments; the redesigned UI is already responsive.

## 5. UX principles to keep while building

- One clear primary action per screen (`#0099CC` button); everything destructive is red, confirmed, and undoable where possible (trash, revisions).
- Plain-language sentences for anything automated ("When someone comments “price” on Instagram, send them a DM").
- Always show what a channel can and cannot do before the user spends effort (capability chips, notes).
- Dry run / test for every automation, and nothing sends while the portal is in dry run.
- Arabic is first-class: RTL, Arabic keyword matching, translations, Egyptian and MSA tone options.
- Honest numbers: every metric states its window; no fake zeros.

## 6. Sources (for the competitive scan)

- [Hootsuite — new features, March 2026](https://blog.hootsuite.com/new-features-mar-2026/) and [April 2026](https://blog.hootsuite.com/new-features-apr-2026/)
- [Agorapulse — new features](https://www.agorapulse.com/blog/agorapulse-news/new-agorapulse-features-2025/)
- [Metricool — comparison](https://metricool.com/compare-metricool/)
- [Best social media management tools 2026 (Dupple)](https://dupple.com/learn/best-social-media-management-tools), [Folk](https://www.folk.app/articles/best-social-media-management-tools), [La Fabrique du Net](https://www.lafabriquedunet.fr/top-outils-social-media-management)
- [Approval software for teams 2026 (SocialPilot)](https://www.socialpilot.co/?p=744604)
- [Instagram comment-to-DM tools 2026 (DMChamp)](https://dmchamp.com/best/best-instagram-comment-to-dm-tools-2026/), [ManyChat alternatives (InstantDM)](https://instantdm.com/blog/top-15-manychat-alternatives-for-instagram-automation-in-2026), [Comment-to-DM guide (SetSmart)](https://setsmart.io/blog/instagram-comment-to-dm-automation)

Most of these are vendor blogs or affiliate roundups; prices and plan limits change often, so verify on each vendor's site before using them in decisions.
