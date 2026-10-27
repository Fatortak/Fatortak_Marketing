# Commercial funnel

The open-source project is the top of the funnel. This document is the path from a GitHub star to a paying customer without turning the project into an ad.

## The model

| Layer | Offer | Price | Purpose |
| --- | --- | --- | --- |
| Community | Self-hosted, AGPL-3.0 | Free | Adoption, trust, contributors, distribution |
| Cloud | Managed hosting, backups, updates | 300–900 EGP/mo (launch) | Recurring revenue from teams that do not want to run SQL Server |
| Commercial license | Use in closed-source/hosted products | Custom | Companies whose legal/procurement cannot accept AGPL |
| Services | Migration, onboarding, training, custom modules | 5,000–50,000 EGP | Cash now, deep customer knowledge |
| Partner | Accountants/implementers resell and onboard | 20% recurring | Leverage without hiring a sales team |

**Rule:** the free edition must be genuinely useful. A crippled community edition generates resentment, not customers.

## Funnel and targets

```
Awareness          GitHub, HN, LinkedIn, X, Arabic communities, SEO
   ↓ 2–5%
Visit              README → landing page → demo video
   ↓ 15–25%
Signup / trial     Cloud account or self-host download
   ↓ 30–40%
Activated          Creates an invoice, records a payment, sees a report
   ↓ 15–25%
Demo               ......
```

| Stage | Metric | 90-day target |
| --- | --- | ---: |
| Awareness | Repo unique visitors (14d) | 1,500 |
| Interest | Landing visitors | 2,500 |
| Signup | Cloud trials + self-host downloads | 300 |
| Activation | Accounts that create an invoice + payment | 100 |
| Demo | Booked calls | 25 |
| Closed won | Paying customers | 12 |
| Expansion | Customers with >1 branch or >5 users | 4 |

## Lead sources, ranked by intent

1. **Warm network** — former colleagues, accountants, agency owners, founders. Highest close rate. Start here.
2. **Accountant partners** — one accountant brings 5–20 SMB clients. Highest leverage.
3. **Comparison and migration content** — "QuickBooks alternative MENA", "Odoo alternative for small business", "Excel to accounting migration". High intent.
4. **GitHub/self-hosted communities** — high trust, low budget. Good for stars and contributors, slower for cloud revenue.
5. **LinkedIn (Arabic + English)** — best for MENA owners and finance managers.
6. **Hacker News / Product Hunt** — spike, credibility, backlinks. Not a repeatable channel.
7. **Cold outbound** — lowest response rate. Use only with a specific, researched reason.

## Lead magnets

Create these once; they feed the email sequences and SEO.

- **Arabic invoice template pack** (Excel + PDF + Fatortak template) — highest-volume lead magnet in MENA.
- **Month-end close checklist** (Arabic/English PDF).
- **Excel-to-accounting migration checklist**.
- **Project profitability calculator** (simple web tool).
- **"Open-source vs SaaS accounting" decision guide**.
- **VAT invoice requirements by country** (Egypt, Saudi, UAE) — research carefully, date-stamp it, add a disclaimer.

Every magnet: landing page, thank-you page with a demo CTA, 5-email nurture sequence.

## Qualification

Use a lightweight BANT + fit:

| Question | Good sign | Red flag |
| --- | --- | --- |
| **Budget** | Already pays for accounting/ERP or a bookkeeper | "We want everything free forever" |
| **Authority** | Owner, GM, finance manager, managing partner | "I'm just researching for a friend" |
| **Need** | A specific broken workflow (close, project margin, Arabic invoices) | "Just curious" |
| **Timeline** | Next 30–90 days, tied to a trigger | "Someday" |
| **Fit** | 5–50 employees, MENA, project/inventory complexity | 200+ employees needing consolidation/SSO today |

If two or more are red, send a helpful resource and do not book a demo. Protect your calendar.

## Demo script (20 minutes)

**0–3 min — context**
"Before I show anything, tell me how invoices, expenses and project costs work today. What breaks first?"

**3–8 min — their workflow, not your tour**
Share your screen and build *their* scenario: their customer, their VAT rate, their project, their payment terms. Ask them to drive if possible.

**8–14 min — the three moments**
1. Create/send an invoice → public link.
2. Record a partial payment → show aging and P&L impact.
3. Open the project profitability report → show the number they cannot get today.

**14–17 min — the honest fit**
"We are alpha. We do not have ETA/ZATCA clearance yet, SSO, or a formal audit log. If those are blockers, tell me now. If not, here is what a pilot looks like."

**17–20 min — next step**
Offer one of:
- a 14-day pilot on one company/branch with their data (paid or free, time-boxed)
- a migration call with their accountant
- a written proposal with scope, price and timeline

Never end with "let me know". End with a date.

## Discovery questions by segment

### Agencies
- How do you price retainers vs projects?
- Which costs land on a project: freelancers, media, software, payroll?
- When did you last kill a service line because it was unprofitable?
- Who updates project costs today, and how often?

### Contracting
- How do you track contract variations and approvals?
- How do you calculate cost-to-complete?
- How many active projects and subcontractors?
- What does the bank ask for at each drawdown?

### Trading/distribution
- How many SKUs and suppliers?
- How do you track landed cost and supplier balances?
- Do you use post-dated cheques? How are they tracked?
- What happens at VAT inspection today?

### Accounting firms
- How many clients, and how many tools do you log into?
- What is the re-keying cost per client per month?
- Do clients send invoices as PDFs, photos or WhatsApp?
- Would you resell a platform under your own brand?

## Objections and responses

See `positioning.md` for the full list. The short version:

| Objection | Response |
| --- | --- |
| "Open source is not secure." | Auditable, self-hostable, security policy. Alpha, no independent audit yet. Start with a pilot. |
| "No e-invoicing compliance." | True today. On the roadmap. Do not promise a date. |
| "Too cheap / not serious." | Launch pricing for MENA. Code, roadmap and support are public. Pilot with an exit. |
| "We already have QuickBooks." | Keep it if it works. We are for Arabic invoices, project margin and self-hosting. |
| "Odoo does more." | It does. It also takes months and a partner. We are the 80% without the implementation project. |
| "We need SSO/audit." | Not yet. We will tell you when it lands. If it is a hard blocker, do not buy. |

## Proposal structure (one page)

1. **Their situation** — 3 sentences in their words.
2. **Outcome** — the number or workflow that changes (close time, project margin visibility, Arabic invoice acceptance).
3. **Scope** — modules, users, branches, migration, training.
4. **Timeline** — kickoff, migration, go-live, review.
5. **Price** — setup + subscription, annual option, what is not included.
6. **Exit** — data export, notice period, no lock-in.
7. **Next step** — signature or pilot start date.

## Partner program (accountants and implementers)

This is the highest-leverage channel in MENA. Accountants already own the trust relationship.

**Offer:**
- 20% recurring commission for 12 months, then 10% for the life of the customer.
- A partner dashboard (later) or a shared spreadsheet (now).
- Free internal-use license for their own firm.
- Co-branded onboarding and priority support.
- Lead sharing: they bring clients, you bring implementation.

**Qualification:** 10+ SMB clients, bookkeeping/accounting practice, willingness to learn the product, no competing ERP resale.

**Enablement:**
- 60-minute certification.
- Demo tenant + sample data.
- One-page proposal template.
- Commission agreement.
- Quarterly partner call.

**Rule:** do not sign 50 partners before you can support 5. Partner churn is expensive.

## Activation (first 14 days)

The biggest leak is signup → first real invoice. Design for it.

| Day | Trigger | Message/action |
| --- | --- | --- |
| 0 | Signup | Welcome email + 3-step checklist + demo video |
| 1 | No company created | "Need help setting up your company?" |
| 3 | Company but no invoice | Offer to import a customer + create the first invoice on a 15-min call |
| 7 | Invoice but no payment | Show how to record a payment and read aging |
| 10 | No report opened | Send a 2-minute P&L video |
| 14 | Active | Ask for a testimonial or a referral |
| 14 | Inactive | "Should I close your trial?" (reply rate is high) |

Track: company created, first customer, first invoice, first payment, first report. These five events predict retention better than logins.

## Retention and expansion

- **Monthly value email:** "Your month in numbers" — invoices, collections, top overdue, project margins.
- **Quarterly business review** for customers above 2,400 EGP/mo.
- **Expansion triggers:** new branch, new user, hitting invoice quota, hiring a finance person.
- **Save play:** if a customer downgrades, ask why. Offer a pause or a service credit, not an immediate discount.
- **Churn review:** every lost customer gets a 15-minute call. The reason is roadmap input.

## Metrics that matter

| Metric | Formula | Target |
| --- | --- | --- |
| Activation rate | Activated signups / signups | 30% |
| Demo rate | Demos / activated | 20% |
| Close rate | Won / demos | 30–40% |
| CAC | Sales + marketing spend / new customers | < 3 months of gross margin |
| Gross margin | (Revenue − hosting/support) / revenue | 75%+ |
| Net revenue retention | MRR from cohort this month / last month | 100%+ |
| Payback | CAC / monthly gross margin | < 6 months |
| Logo churn | Lost customers / starting customers | < 3%/month |

Do not track vanity metrics in the weekly report without a decision attached.

## First 30 days, founder-led

1. **Week 1:** list 50 warm contacts. Send 20 personal messages. Book 8 calls. Offer 3 free pilots.
2. **Week 2:** run 8 demos. Watch 3 users onboard themselves. Fix the top 3 friction points.
3. **Week 3:** convert 2 pilots to paid. Ask for 2 referrals each. Publish the first case study.
4. **Week 4:** sign 2 accountant partners. Run the first webinar. Review pricing and activation data.

## CRM

A CSV is enough to start: `marketing/crm/pipeline.csv`. Move to a real CRM when you have more than 50 active opportunities or two people touching the pipeline.

Columns: company, contact, role, segment, country, source, stage, next step, next date, estimated value, notes, owner.

Stages: `new → contacted → replied → demo booked → demo done → pilot → proposal → won / lost`.

Review every Monday. If a deal has no next step and no date, it is not a deal.
