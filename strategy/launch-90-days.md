# 90-day launch playbook

The goal is not "go viral". It is to reach the right 5,000 people, convert 25 into demos, and turn 10 into paying customers while building a contributor base that outlasts the launch.

Dates are relative: **T** = public launch day.

> The all-channel operating plan is in [`social-media-plan.md`](social-media-plan.md). It contains the channel matrix, weekly rhythm, first-14-days calendar, AI/OCR sprint and platform-specific playbooks.

---

## Phase 0 — Foundation (T-21 to T-8)

Nothing below works if the artifact is weak. Do these in order.

### Week -3: publish the artifact

- [ ] Push the sanitized repository (no `appsettings.json`, no `.env`, no `bin/obj`).
- [ ] Add `LICENSE` (AGPL-3.0), README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT.
- [ ] Set repository description, homepage and 15 topics (`npm run repo`).
- [ ] Upload a 1280×640 social preview image.
- [ ] Enable Discussions, Issues, and private vulnerability reporting.
- [ ] Verify CI is green on `main`.
- [ ] Test `docker compose up --build` from a clean clone.
- [ ] Capture 10 real screenshots: dashboard, sales invoices, clients, projects, project profitability, income statement, AI chat, AI chart, OCR invoice, OCR chart.
- [ ] Record a 90-second demo: create invoice → send link → record payment → show P&L.
- [ ] Deploy the landing page to `https://fatortak.rabbeh.com/` over FTPS (or use the optional GitHub Pages mirror).
- [ ] Add Plausible/Umami and verify events.

**Exit criteria:** a stranger can understand the product, start it, and see a real screenshot in under 3 minutes.

### Week -2: make it contributable

- [ ] Create 10 real `good first issue` tasks (see `contributor-growth.md`).
- [ ] Add labels: `good first issue`, `help wanted`, `documentation`, `translation`, `bug`, `enhancement`, `growth`.
- [ ] Write a pinned "Start here" discussion with architecture, setup and ways to help.
- [ ] Add a demo dataset or seed script so contributors do not need your data.
- [ ] Add a `docs/` index and fix every broken link.
- [ ] Run a "fresh clone" test with someone who has never seen the repo.

### Week -1: build the launch list

- [ ] List 50 warm contacts: former colleagues, accountants, agency owners, developers, MENA founders.
- [ ] Join 10 communities and participate for a week before posting anything promotional.
- [ ] Prepare a waitlist/demo link (Cal.com + a simple form).
- [ ] Draft and schedule launch copy (this folder).
- [ ] Prepare Product Hunt gallery (5 images + 1 GIF) and a 60-second video.
- [ ] Prepare 3 customer-proof assets: a pilot quote, a before/after workflow, a migration story.
- [ ] Set up a shared inbox and a response template.
- [ ] Put a launch checklist in the calendar with owners (even if the owner is you).

**Exit criteria:** the launch can run for 7 days without writing anything new from scratch.

---

## Phase 1 — Soft launch (T-7 to T-1)

The purpose is to find the embarrassing bugs before 5,000 people do.

### Day -7: private beta

- Invite 20–30 people personally. Not a mass email.
- Ask for one specific thing: "Run this workflow and tell me where it breaks."
- Offer a 20-minute onboarding call. Watch them use it. Do not demo.
- Fix the top 3 friction points immediately.

### Day -5: contributor preview

- Post in 2 developer communities: "We are opening the code before launch; looking for .NET/React reviewers."
- Ask for code review, not stars. Stars follow.
- Open 3 issues based on their feedback and credit them.

### Day -3: press/newsletter outreach

- Email 15 newsletters and 5 podcasts with a 4-sentence pitch, a demo link, and a specific angle. Not a press release.
- Angle options: "open-source alternative to Odoo for MENA", "Arabic-first accounting", "self-hosted business software for data residency".
- Follow up once, 48 hours later. Never more.

### Day -1: freeze

- No deploys after 18:00.
- Verify signup, login, invoice creation, payment recording, export, and email.
- Pin the launch tweet, publish the landing page, check mobile.
- Write the HN first comment, the Product Hunt maker comment and the LinkedIn post.
- Sleep. Seriously.

---

## Phase 2 — Launch week

### Monday (T-3): GitHub launch

- Publish the first release tag (`v0.1.0`) with notes.
- Publish the pinned discussion and the roadmap.
- Post on LinkedIn: personal story + the problem + the repo. No feature list.
- Post on X: short thread (5 posts) with screenshots and the repo link.
- Ask 10 friends to **use** it and give feedback, not to upvote.

### Tuesday (T-2): Hacker News + Arabic

- **Show HN** at 08:00–10:00 ET. Title: `Show HN: Fatortak – Open-source business software for MENA`.
- First comment: why you built it, what is hard, what is missing, what feedback you want. Be present for 6 hours.
- Do **not** ask for upvotes. Do **not** repost if it does not take off.
- Arabic LinkedIn post at 10:00 Cairo time. Arabic X post at 20:00.
- Reply to every comment within 30 minutes during the first 4 hours.

### Wednesday (T-1): Product Hunt

- Launch at 12:01 AM PT.
- Maker comment: the story, the ICP, the honest limitation (alpha, no e-invoicing yet), the offer (free self-host + cloud).
- Reply to every comment within 15 minutes for the first 6 hours.
- Do not ask for upvotes; ask for feedback and a try.
- Cross-post a "We're live on Product Hunt" update on LinkedIn and X, once.

### Thursday (T): Reddit + Dev.to

- Post in **one** subreddit first — choose the best fit, read the rules, use the right flair.
- Lead with value: "We open-sourced our accounting platform; here is the architecture and what we learned." Link in the comments if required.
- Publish the Dev.to article: "Why we built an open-source business OS for MENA".
- Answer every comment; do not argue with criticism.
- Send the launch newsletter to the waitlist.

### Friday (T+1): recap + community

- Publish a transparent recap: traffic, stars, signups, what broke, what you learned.
- Thank contributors by name.
- Open 5 issues from launch feedback and label them.
- Rest. Do not start a new channel.

### Weekend (T+2, T+3)

- Reply to remaining comments.
- Ship one small fix requested by the community.
- Write the first "build in public" update for next week.

**Launch week success looks like:** 500–2,000 repo visitors, 100–400 stars, 50–150 signups, 3–8 demos, 1–2 paying customers, 5+ meaningful conversations. A front-page HN hit is a bonus, not the plan.

---

## Phase 3 — Amplification (weeks 2–4)

The launch spike fades in 72 hours. This phase converts attention into compounding assets.

### Content engine (2 pieces/week)

| Week | Asset | Channel | Purpose |
| --- | --- | --- | --- |
| 2 | "QuickBooks vs Odoo vs Fatortak for MENA SMBs" | Blog + LinkedIn + Dev.to | High-intent comparison traffic |
| 2 | "How to self-host Fatortak with Docker in 10 minutes" | Blog + YouTube + README | Developer adoption |
| 2 | "From supplier PDF to purchase invoice: the OCR flow" | Blog + LinkedIn + Instagram/TikTok | AI/OCR proof and saves |
| 3 | "The real cost of Excel accounting" | LinkedIn + newsletter | Pain awareness |
| 3 | "Arabic invoice template pack (free)" | Landing page + lead magnet | Email capture |
| 4 | "Project profitability for agencies" | Webinar + blog | Commercial intent |
| 4 | "What we learned from our first 100 users" | LinkedIn + X + HN comment | Trust and transparency |

### Distribution (weekly, not daily)

- **Directories:** submit to Awesome Selfhosted, selfh.st, OpenAlternative, AlternativeTo, LibHunt, SaaSHub, StackShare. One per day; read each submission guide.
- **Newsletters:** 5 pitches per week. Track opens and replies.
- **Podcasts:** 2 pitches per week. Offer a specific segment, not "come talk about my product".
- **Communities:** 3 helpful answers per week in communities where you are a member. Link only when directly relevant.
- **Partners:** 5 accountant/bookkeeper conversations per week. Offer a revenue share, not a "partnership".

### Conversion work

- Add a demo booking link to the README, landing page and every blog post.
- Publish transparent pricing.
- Add a "migrate from Excel/QuickBooks" page.
- Record 3 short customer workflow videos.
- Start a weekly onboarding webinar (30 minutes, recorded).

---

## Phase 4 — Compounding (weeks 5–12)

### SEO and content moat

Publish one substantial article per week. Target bottom-of-funnel keywords first:

- "open source accounting software"
- "Arabic invoice template"
- "VAT invoice Egypt"
- "QuickBooks alternative MENA"
- "Odoo alternative small business"
- "self-hosted invoicing software"
- "project profitability software for agencies"
- "payroll and attendance software Egypt"

Each article: a real answer, a downloadable template, an internal link to the product, and a clear CTA. Do not publish AI-generated filler; it will not rank and it damages trust.

### Community and contributors

- Run a monthly "contributor office hours" call.
- Label and mentor 5 new `good first issue` tasks per month.
- Ship a release every 2 weeks with contributor credits.
- Recognize the top 5 contributors in the README and release notes.
- Apply to Hacktoberfest, GSSoC and similar programs **only if** you can mentor properly.

### Commercial engine

- 10 outbound conversations per week with warm leads (not cold spam).
- 1 webinar per month with a real customer or accountant.
- 1 case study per month.
- Partner program with accountants: 20% recurring for 12 months.
- Annual plans with 2 months free to improve cash flow.

---

## Channel playbooks

### Hacker News

- **One shot.** Show HN is for something people can try. Have a live demo and a clear README.
- Title format: `Show HN: Fatortak – Open-source business software for MENA`.
- Post Tue–Thu, 08:00–10:00 ET.
- First comment must include: why, stack, what is hard, what is missing, what feedback you want. No marketing language.
- Reply to criticism with facts and gratitude. Never argue.
- Do not ask for upvotes, do not use bots, do not delete and repost.
- If it flops, write a post-mortem and move on.

### Reddit

- Read the rules of each subreddit. Some ban self-promotion entirely; respect it.
- Participate for at least a week before posting.
- Use the correct flair (`Show and Tell`, `I made this`, `Open Source`).
- Title should describe the artifact, not sell it: "I open-sourced an Arabic-first accounting platform (AGPL, .NET/React)".
- Put the long story in the post, the link at the end.
- Answer every technical question. Do not DM people who did not ask.
- Best-fit subreddits: r/selfhosted, r/opensource, r/Accounting (check rules), r/smallbusiness (check rules), r/egypt, r/SaudiArabia, r/UAE.

### Product Hunt

- Launch Tuesday–Thursday. Assets: 5 gallery images, 1 GIF, 1 video, 240-character tagline, 260-character description.
- First comment: founder story, who it is for, honest limitation, special launch offer.
- Reply to every comment within 15 minutes for 6 hours.
- Do not ask for upvotes. Ask for feedback and a try.
- A "#1 Product of the Day" is nice; 20 qualified signups are better.

### LinkedIn

- Personal profile outperforms the company page for early-stage products. Use both: founder story on personal, product updates on company.
- 3 posts/week: one story, one insight, one proof (screenshot/customer).
- Hook in the first 2 lines; no "I'm thrilled to announce".
- No engagement pods, no fake comments, no "agree?" bait.
- Arabic posts get strong reach in MENA; write them natively.

### X

- 4 posts/week from the queue, plus replies.
- Build in public: numbers, decisions, mistakes, screenshots.
- One thread per launch or major release.
- Reply to 10 relevant accounts per day with something useful, not "great post".
- Do not mass-follow/unfollow.

### Arabic channels

- LinkedIn Arabic (founder and company).
- X Arabic.
- Facebook groups for Egyptian/Saudi SMB owners and accountants (ask admins first).
- WhatsApp: only personal, relevant messages. Never mass-broadcast.
- Local accountant associations and training centers: offer a free workshop.

---

## Asset checklist

- [ ] 1280×640 GitHub social preview
- [ ] 10 real product screenshots (PNG, 2x), including AI chat and OCR
- [ ] 90-second demo video (MP4 + GIF)
- [ ] 5 Product Hunt images + 1 GIF
- [ ] Logo (SVG + PNG)
- [ ] One-paragraph boilerplate (EN/AR)
- [ ] Founder headshot and bio
- [ ] Pricing page
- [ ] Demo booking link
- [ ] Waitlist/CRM
- [ ] Analytics + UTM taxonomy
- [ ] Response templates for common questions
- [ ] Security/limitations page (honesty builds trust)

---

## What not to do

- Do not buy stars, followers, upvotes or reviews.
- Do not auto-post to Hacker News or Reddit.
- Do not launch on all channels on the same day; you cannot reply everywhere.
- Do not claim e-invoicing compliance you do not have.
- Do not use fake testimonials or invented customer logos.
- Do not spam Arabic Facebook groups or WhatsApp.
- Do not argue with criticism in public. Answer once, with facts, then move on.
- Do not optimize for stars at the expense of activation. A star is not a customer.
