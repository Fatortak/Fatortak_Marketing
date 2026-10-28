# Metrics and measurement

If a number cannot change a decision, it does not belong on the weekly dashboard.

## North star

**Weekly active companies** — companies that created or recorded at least one financial document (invoice, payment, expense, journal entry) in the last 7 days.

For the open-source side, pair it with **weekly unique repo visitors** and **weekly unique clones**. Stars are a scoreboard, not a strategy.

## The funnel

| Stage | Definition | Source | 90-day target |
| --- | --- | --- | ---: |
| Reach | Unique repo visitors (14d) | GitHub traffic | 1,500 |
| Interest | Landing page visitors | Plausible | 2,500 |
| Intent | Demo clicks + pricing views | Plausible events | 250 |
| Signup | Cloud trials + self-host downloads | App + GitHub releases | 300 |
| Activation | First invoice **and** first payment recorded | App events | 100 |
| Demo | Booked and held | Calendar/CRM | 25 |
| Revenue | Paying cloud/license customers | Payment provider | 12 |
| Retention | Companies active in week 4 | App events | 60% |
| Referral | Customers who referred someone | CRM | 20% |

## Events to instrument

### Landing page (Plausible custom events)

- `cta_github_click`
- `cta_demo_click`
- `cta_pricing_click`
- `pricing_view`
- `faq_open`
- `lang_switch` (`en` / `ar`)
- `signup_start`
- `signup_complete`

### Product (server-side, eventually)

- `company_created`
- `customer_created`
- `invoice_created`
- `invoice_sent`
- `payment_recorded`
- `report_viewed` (`pl`, `balance_sheet`, `aging`, `project_profitability`)
- `ocr_invoice_created`
- `payroll_run`
- `user_invited`
- `subscription_started`
- `subscription_cancelled`

Do not send customer names, invoice amounts or personal data to analytics. Count events, not people's finances.

## UTM taxonomy

| Parameter | Values |
| --- | --- |
| `utm_source` | `x`, `linkedin`, `bluesky`, `mastodon`, `telegram`, `discord`, `facebook`, `instagram`, `tiktok`, `youtube`, `threads`, `whatsapp`, `newsletter`, `hn`, `producthunt`, `reddit`, `devto`, `partner`, `direct` |
| `utm_medium` | `social`, `email`, `community`, `referral`, `paid`, `launch` |
| `utm_campaign` | `oss-launch`, `oss-launch-ar`, `ai-ocr-sprint`, `selfhost-guide`, `comparison`, `webinar`, `partner-q1` |
| `utm_content` | item id or asset id (e.g. `20261102-x`) |

The automation adds these automatically to owned domains. Never tag links to GitHub; the referrer is enough and UTM params make the repo URL ugly.

## Weekly dashboard

The `growth-report` workflow writes `marketing/reports/YYYY-MM-DD.md` and opens an issue every Monday.

| Section | Metrics |
| --- | --- |
| Distribution | Stars, forks, contributors, unique visitors, unique clones |
| Website | Visitors, pageviews, bounce rate, top pages |
| Content | Posted / scheduled / overdue, top-performing post (manual note) |
| Commercial | Demos, trials, customers, MRR |
| Decision | One thing to change this week |

### The decision rule

Every weekly review ends with **one** decision:

- double down on a channel that produced 3+ qualified conversations
- kill a channel that produced none in 4 weeks
- fix the activation step with the biggest drop-off
- change the offer, not the ad

## Targets and guardrails

| Metric | 30 days | 90 days | Guardrail |
| --- | ---: | ---: | --- |
| Stars | 150 | 600 | Never bought |
| Unique repo visitors (14d) | 400 | 1,500 | — |
| New contributors | 3 | 12 | First response < 2 days |
| Landing visitors | 500 | 2,500 | Bounce < 70% |
| Activation rate | 20% | 30% | — |
| Demos | 5 | 25 | 20 min, qualified |
| Paying customers | 2 | 12 | Churn < 3%/mo |
| MRR (EGP) | 1,200 | 9,000 | Gross margin > 75% |

## Monthly deep dive

Once a month, answer:

1. Which channel produced the most **activated** companies, not the most clicks?
2. Which content produced demos, not just likes?
3. Where do users drop off in the first 14 days?
4. What did we ship that customers actually noticed?
5. What should we stop doing?
6. What is the biggest constraint: awareness, activation, conversion, or retention?

## Attribution honesty

Early-stage attribution is noisy. Use these rules:

- Ask every demo lead "how did you hear about us?" — one open text field.
- UTM is directional, not gospel. Dark social (WhatsApp, Slack, private groups) will not show up.
- Self-hosted users are mostly invisible. Track clones and release downloads, not installs.
- Do not spend on paid ads until organic activation is above 20%. Otherwise you are paying to leak.

## Reporting cadence

| Cadence | Artifact | Owner |
| --- | --- | --- |
| Daily | Automated posts + reply to comments | Automation + founder |
| Weekly | Growth report issue + one decision | Founder |
| Monthly | Deep dive + roadmap adjustment | Founder + contributors |
| Quarterly | Pricing, packaging, partner review | Founder |
