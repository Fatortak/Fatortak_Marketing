# Fatortak marketing OS

This folder is the marketing department for the open-source project. It is designed to run on autopilot, but it is honest about the one thing no software can do for you: create verified accounts and accept platform terms on your behalf.

## Strategy references

- [`strategy/social-media-plan.md`](strategy/social-media-plan.md) - all-channel strategy, 90-day phases, first-14-days calendar, AI/OCR sprint, platform playbooks and guardrails.
- [`strategy/positioning.md`](strategy/positioning.md) - ICP, messaging, objections and pricing architecture.
- [`strategy/launch-90-days.md`](strategy/launch-90-days.md) - launch phases and manual channel playbooks.
- [`strategy/metrics.md`](strategy/metrics.md) - funnel, events, UTM and weekly dashboard.
- [`strategy/commercial-funnel.md`](strategy/commercial-funnel.md) - demos, proposals and partner program.
- [`strategy/contributor-growth.md`](strategy/contributor-growth.md) - GitHub and contributor plan.

## What is automated

| Job | How | Human effort |
| --- | --- | --- |
| 90-day content calendar | `content/queue.json` generated from a curated copy bank | none |
| Daily social posting | GitHub Actions → X, LinkedIn, Bluesky, Mastodon (Telegram/Discord optional) | one-time API keys |
| UTM tagging | every link is tagged per channel and campaign | none |
| Weekly growth report | GitHub Actions → stars, forks, traffic, contributors, queue | none |
| Repo metadata | `npm run repo` sets description, homepage, topics | one-time token |
| Contributor welcome | GitHub Action comments on first issue/PR | none |
| CI | build backend and frontend on every PR | none |
| Landing page deploy | InterServer FTPS workflow, or GitHub Pages mirror | one-time FTP secrets / Pages setup |
| Control room dashboard | `marketing/portal` local Node service: calendar, composer, dry-run/live publish, metrics, reports and CSV/JSON export | one-time API credentials per channel |
| Email sequences | ready-to-paste copy for your email tool | one-time import |
| Launch copy | Show HN, Product Hunt, Reddit, LinkedIn, X, Dev.to, Arabic | one-time posting where APIs do not exist |

## What still needs a human (honestly)

1. **Create the accounts once.** X developer app, LinkedIn app, Bluesky app password, Mastodon token, GitHub, Product Hunt, Hacker News. No tool can bypass identity checks.
2. **Approve the first live run.** Read the dry-run output, then set `MARKETING_LIVE=true`.
3. **Hacker News, Product Hunt and Reddit.** None of these have a legitimate "post this for me" API for launches. Auto-posting there gets accounts banned and the launch killed. The copy is ready; posting takes minutes.
4. **Reply to comments.** Automation can post; it cannot build trust in a thread. Budget 30 minutes on launch day and 15 minutes/day for the first two weeks.
5. **Commercial conversations.** Demos and contracts are human. The system fills the top of the funnel and removes the busywork.

> If someone sells you "fully automated" Hacker News and Reddit posting, they are selling you a ban.

## Marketing portal

[`marketing/portal`](portal/README.md) is a local-first control room for every channel. It seeds itself from `content/queue.json`, shows the calendar, composer, connection matrix, analytics and reports, and keeps dry-run on by default.

```powershell
cd marketing/portal
Copy-Item .env.example .env   # optional: fill only the channels you have
npm start                     # http://127.0.0.1:4180
```

The portal publishes through channel APIs where the platform allows it. It marks Hacker News, Reddit and Product Hunt as monitoring-only, and blocks TikTok/YouTube/WhatsApp until their app review, media and opt-in requirements are met. It never pretends a restricted channel succeeded.

## Deployment targets

- **InterServer Plesk** - the primary target. The landing page target is `https://fatortak.rabbeh.com/`; the existing app stays on `fatortakEpic.rabbeh.com` and `apiFatortakEpic.rabbeh.com`. The subdomain and SSL are created; the first upload is pending. See [`deploy/INTERSERVER-PLESK.md`](deploy/INTERSERVER-PLESK.md) for the verified host, least-privilege access, FTPS setup and rollback.
- **Automatic deployment** - `.github/workflows/deploy-interserver.yml` deploys `marketing/landing/**` over FTPS on pushes to `main` when the repository variable `INTERSERVER_AUTODEPLOY=true`. It can also be run manually with a dry-run input. Setup and troubleshooting: [`deploy/INTERSERVER-AUTODEPLOY.md`](deploy/INTERSERVER-AUTODEPLOY.md).
- **Static deploy script** - [`deploy/deploy-static.ps1`](deploy/deploy-static.ps1) is dry-run by default, reads credentials from `%USERPROFILE%\.config\fatortak\plesk.env`, backs up the current remote root files and verifies the public page.
- **GitHub Pages** - optional mirror via `.github/workflows/pages.yml`. If used, update the canonical and social URLs to the live hostname.

## One-time setup

### 1. Configure the project

```bash
cd marketing/automation
cp ../config.example.json ../config.json   # optional: edit links and handles
cp .env.example .env                       # local testing only
npm run validate
npm run post:dry -- --date 2026-11-02
```

`config.json` is gitignored only if you add it; the committed source of truth is `config.example.json`. If `config.json` is missing, the system uses the example.

### 2. Add GitHub Actions secrets

Repository → **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
| --- | --- |
| `X_ACCESS_TOKEN` | X API v2 OAuth 2.0 user token with `tweet.write` |
| `LINKEDIN_ACCESS_TOKEN` | LinkedIn token with `w_member_social` or `w_organization_social` |
| `LINKEDIN_AUTHOR_URN` | `urn:li:person:...` or `urn:li:organization:...` |
| `BLUESKY_HANDLE` | e.g. `fatortak.bsky.social` |
| `BLUESKY_APP_PASSWORD` | Bluesky app password, not your main password |
| `MASTODON_ACCESS_TOKEN` | only if you enable Mastodon |
| `MASTODON_INSTANCE` | e.g. `https://mastodon.social` |
| `PLAUSIBLE_API_KEY` | optional analytics |
| `PLAUSIBLE_SITE_ID` | optional analytics |
| `MARKETING_LIVE` | set to `true` only when you are ready to publish |

`GITHUB_TOKEN` is provided automatically. For repo metadata, add `REPO_ADMIN_TOKEN` (fine-grained PAT with **Administration: write**).

### 3. Enable the workflows

- **Actions → Marketing daily → Run workflow** with `dry_run: true`. Check the log.
- When the output looks right, run it with `dry_run: false`.
- The schedule takes over: daily at 09:00 UTC, weekly report on Monday at 07:00 UTC.
- **Actions → Marketing growth report → Run workflow** to create the first issue immediately.
- **Actions → Repository metadata** with `apply: false` to preview the repo description/topics, then `apply: true` (needs `REPO_ADMIN_TOKEN`).
- **Settings → Pages → Source: GitHub Actions** only if you want the optional GitHub Pages mirror. The primary deploy is the InterServer FTPS workflow.
- The landing page deploys automatically on pushes to `main` that change `marketing/landing/**` when `INTERSERVER_AUTODEPLOY=true`.

Posting state is kept in the GitHub Actions cache (`marketing/automation/.state`), not committed to the repository. The cache is enough to prevent duplicate posts; it is not an audit log. If the cache is evicted, the 36-hour stale window still prevents a backlog from being posted all at once.

### 4. Create the commercial rails

- A calendar link (Cal.com is free) and put it in `config.example.json` → `links.demo`.
- A payment link or bank instructions for cloud plans.
- A shared inbox (`info@fatortak.net`).
- Optional: Plausible/Umami for the landing page.

## Daily loop (automatic)

```text
09:00 UTC  marketing-daily workflow
           → load queue.json
           → pick items due now (max 4)
           → render per channel + UTM
           → post to configured channels
           → write .state/state.json
           → log to .state/post.log

Monday     growth-report workflow
           → pull GitHub + Plausible metrics
           → write reports/YYYY-MM-DD.md
           → open a "Growth report" issue
```

Missed items older than 36 hours are skipped, not dumped. This prevents a backlog from becoming a spam burst after downtime. Use `--include-stale` deliberately if you want to catch up.

## Commands

```bash
cd marketing/automation

npm run validate                  # schema, lengths, duplicates, banned phrases
npm run schedule -- --days 14     # what will post next
npm run stats                     # posted / upcoming / overdue
npm run post:dry                  # preview everything due
npm run post:dry -- --date 2026-11-07
npm run post:live                 # publish now
npm run generate -- --days 90 --start 2026-11-02 --force
npm run report                    # write marketing/reports/latest.md
npm run report:issue              # also open a GitHub issue
npm run repo:dry                  # preview repo description/topics
npm run repo                      # apply (needs REPO_ADMIN_TOKEN)
```

## File map

```
marketing/
  README.md                  this file
  config.example.json        links, channels, cadence
  strategy/
    social-media-plan.md     all-channel plan, 90-day phases, platform playbooks
    positioning.md           ICP, messaging, competitors, pricing
    launch-90-days.md        week-by-week launch plan
    commercial-funnel.md     open-core offers, demos, outbound, partners
    contributor-growth.md    good first issues, review SLAs, programs
    metrics.md               north star, dashboard, targets
  content/
    queue.json               90-day generated calendar
    ai-ocr-sprint.md         10 ready-to-post AI + OCR launch items
    github-listing.md        repo description, topics, pinned issue
    launch/                  Show HN, Product Hunt, Reddit, LinkedIn, X, Arabic, Dev.to
    email/sequences.md       welcome, activation, upgrade, win-back
    seo/keyword-map.md       keywords, article briefs, schema
    blog/                    long-form SEO articles (EN + AR)
  automation/
    src/cli.mjs              command entry point
    src/channels.mjs         X, LinkedIn, Bluesky, Mastodon, Telegram, Discord
    src/generate-queue.mjs   deterministic calendar generator
    src/report.mjs           growth report + GitHub issue
    src/repo.mjs             repo metadata sync
  landing/                   bilingual static landing page
  portal/                    local control room: calendar, composer, publishing, metrics, reports
  deploy/                    InterServer Plesk + auto-deploy references, dry-run FTPS script
  reports/                   generated weekly reports
```

Related workflows live in `.github/workflows/`:

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `marketing-daily.yml` | Daily 09:00 UTC + manual | Post due queue items; dry-run by default |
| `marketing-report.yml` | Monday 07:00 UTC + manual | Growth report + GitHub issue |
| `deploy-interserver.yml` | Push to `marketing/landing/**` when `INTERSERVER_AUTODEPLOY=true` + manual | Deploy the landing page to `fatortak.rabbeh.com` over FTPS |
| `pages.yml` | Push to `marketing/landing/**` + manual | Optional GitHub Pages mirror |
| `repo-metadata.yml` | Manual | Preview/apply repo description and topics |
| `ci.yml` | Push/PR | Build backend/frontend and validate the queue |

## Guardrails

- **Dry-run by default.** Live posting requires both `MARKETING_LIVE=true` and a live config.
- **No fake claims.** The validator rejects "revolutionary", "guaranteed", "100% accurate" and similar.
- **Channel limits.** Posts that exceed X/Bluesky/Mastodon limits are skipped, not truncated at send time.
- **Duplicate protection.** Exact duplicate copy fails validation.
- **Missing keys never fail a run.** A channel with no credentials is skipped and logged.
- **No auto-DMs, no engagement bait, no follow-for-follow.**
- **One post per platform per day, maximum.** Quality beats volume.
- **UTM only on owned domains.** GitHub links stay clean.

## The honest growth thesis

Stars and customers do not come from posting volume. They come from:

1. **A credible artifact** — a README that explains the product in 30 seconds, a working Docker setup, screenshots, a license.
2. **Distribution in the places where the audience already is** — Hacker News, self-hosted communities, Arabic business groups, accountant networks.
3. **Useful content** — migration guides, invoice templates, VAT explainers, honest comparisons.
4. **Responsiveness** — a reply within one business day beats a week of scheduled posts.
5. **A commercial offer that is easy to say yes to** — managed cloud, migration, support, commercial license.

The automation buys you consistency so you can spend your time on 3–5.

## Targets for the first 90 days

These are realistic for a well-executed launch, not guarantees:

| Metric | 30 days | 90 days |
| --- | ---: | ---: |
| GitHub stars | 150 | 600 |
| Unique repo visitors (14d) | 400 | 1,500 |
| Contributors (non-maintainer) | 3 | 12 |
| Landing page visitors | 500 | 2,500 |
| Demos booked | 5 | 25 |
| Paying cloud customers | 2 | 12 |
| MRR | 1,200 EGP | 9,000 EGP |

If the numbers are far below, fix the offer or the channel, not the posting frequency.
