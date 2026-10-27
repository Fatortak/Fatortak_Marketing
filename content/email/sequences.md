# Email sequences

Ready-to-paste copy for any email tool (Brevo, MailerLite, Resend, HubSpot). Keep it plain text or a single-column layout. Every commercial email must have a real unsubscribe link and a physical address; that is a legal requirement in most jurisdictions, not a growth hack.

## Segmentation

| Segment | Source | Sequence |
| --- | --- | --- |
| `oss_download` | GitHub star, Docker quickstart, landing page "self-host" | Welcome → activation → contributor |
| `cloud_trial` | Demo request, pricing CTA, managed cloud signup | Welcome → activation → upgrade |
| `accountant_partner` | Partner form, accounting firm outreach | Partner intro → economics → onboarding |
| `launch_list` | Pre-launch waitlist | Launch → demo → nurture |
| `customer_cloud` | Paying cloud customer | Onboarding → adoption → renewal |
| `churn` | Cancelled or expired trial | Win-back → exit survey |

Never mix the open-source list with the commercial list without explicit consent. A GitHub star is not an email opt-in.

---

## Sequence 1 — Open-source welcome (3 emails)

**Trigger:** someone downloads, stars or joins the OSS list.

### Email 1.1 — immediately

**Subject:** Your Fatortak quickstart (and the honest caveats)

**Preview:** Docker, a demo tenant, and what is not ready yet.

```text
Hi {{first_name}},

Thanks for trying Fatortak. It is an open-source business platform for MENA SMBs: invoicing, double-entry accounting, projects, inventory, HR and payroll, with a full Arabic RTL interface.

The fastest path:

1. Clone the repo:
   git clone https://github.com/Ahmed-Nasser99/Fatortak_Software.git
2. Copy the Docker env file:
   cp .env.docker.example .env
3. Start the stack:
   docker compose up --build

Web: http://localhost:3000
API: http://localhost:5000
Swagger: http://localhost:5000/swagger

The self-hosting guide covers HTTPS, backups and production settings:
https://github.com/Ahmed-Nasser99/Fatortak_Software/blob/main/docs/self-hosting.md

Honest status: this is alpha. There is no independent security audit yet, no ETA/ZATCA e-invoicing clearance, and SQL Server is the only supported database. Please do not put real customer data into a public instance.

If the quickstart fails, reply with the error and your OS. A failed first run is a bug in our docs, and I want to fix it.

Ahmed
Fatortak

P.S. If you prefer a managed instance, reply "cloud" and I will send details. No pressure.
```

### Email 1.2 — day 3

**Subject:** The one report that tells you if a project made money

**Preview:** A 4-minute walkthrough of project profitability.

```text
Hi {{first_name}},

Most SMBs can tell you revenue per project. Few can tell you profit per project, because the costs live in different places: freelancer invoices, materials, expenses, payroll.

In Fatortak, you can link invoices, purchase invoices, expenses and payroll to a project. The project report then shows:

Revenue − direct costs − allocated payroll = project margin

Two things to check when you try it:
- Is every cost linked to a project? An unlinked cost will not appear in the margin.
- Is payroll allocated by person, by hours, or by a fixed percentage? Pick one policy and write it down.

Walkthrough with screenshots:
{{project_profitability_url}}

If you want, send me a anonymized project P&L and I will tell you where the model would classify the costs. I will not share it.

Ahmed
```

### Email 1.3 — day 10

**Subject:** What should we build next: ETA/ZATCA or Postgres?

**Preview:** Two roadmap decisions, one reply.

```text
Hi {{first_name}},

We are prioritizing the next two quarters. The two requests we hear most are:

1. Egypt ETA / Saudi ZATCA e-invoicing clearance
2. PostgreSQL support

Both are real work. Both are on the roadmap. Neither is done.

If you are evaluating Fatortak for a real deployment, reply with the one that blocks you and your country. I read every reply and it directly changes the order.

If neither blocks you, a more useful ask: what broke when you tried the quickstart?

Thanks,
Ahmed

P.S. Contributions are welcome, especially accounting tests and Arabic review. Start here:
https://github.com/Ahmed-Nasser99/Fatortak_Software/blob/main/CONTRIBUTING.md
```

---

## Sequence 2 — Managed cloud trial (4 emails)

**Trigger:** demo request, cloud pricing CTA or trial signup.

### Email 2.1 — immediately

**Subject:** Your Fatortak cloud trial: start here

**Preview:** Login, import, and the 20-minute setup.

```text
Hi {{first_name}},

Your Fatortak cloud trial is ready.

Login: {{login_url}}
Workspace: {{company_name}}
Trial ends: {{trial_end_date}}

Do these four things first (about 20 minutes):
1. Add your company logo and invoice footer.
2. Create one customer and one product/service.
3. Create a test invoice with VAT and send it to yourself.
4. Record a payment and open the trial balance.

If you want us to import your chart of accounts and customer list, reply with the file. We support CSV and Excel; we will confirm the mapping before importing.

One honest note: the cloud trial includes the full product, but it is not a substitute for an accounting review. Bring your accountant to the first close.

Ahmed
```

### Email 2.2 — day 2

**Subject:** The 20-minute close checklist

**Preview:** A simple month-end routine for a small company.

```text
Hi {{first_name}},

A close does not need to take a week. Here is the routine we recommend for a 5–50 person company:

Day 1
- Reconcile bank and cash accounts.
- Match open customer invoices to payments.
- Review supplier bills and enter missing ones.
- Check cheques: received, deposited, cleared, bounced.

Day 2
- Review VAT output and input.
- Post payroll and allocate salaries to projects.
- Review project costs for missing allocations.
- Run trial balance, P&L, balance sheet and cash flow.

Day 3
- Review with the owner.
- Lock the period.
- Archive the reports.

The checklist with links to each screen:
{{close_checklist_url}}

If you want to run this on a real month with us, book 30 minutes:
{{demo_url}}

Ahmed
```

### Email 2.3 — day 5

**Subject:** A 200k project that lost money

**Preview:** Why revenue is not margin.

```text
Hi {{first_name}},

A simple example:

Project revenue: 200,000 EGP
Freelancers: 60,000
Materials: 35,000
Allocated payroll: 45,000
Expenses: 15,000
Project margin: 45,000 (22.5%)

The invoice total looked healthy. The project was one bad week from breaking even.

This is the report that changes how owners price the next project. If your costs are not linked to projects, the number is a guess.

Want us to set up project profitability on your data during the trial? Reply with a time.

Ahmed
```

### Email 2.4 — day 12 (trial ending)

**Subject:** Your trial ends in 3 days — keep the data, decide later

**Preview:** Export, extend, or continue.

```text
Hi {{first_name}},

Your Fatortak trial ends on {{trial_end_date}}.

Three options:
1. Continue on Professional (600 EGP/month): {{upgrade_url}}
2. Export your data and self-host the community edition (free, AGPL-3.0): {{export_guide_url}}
3. Extend the trial by 14 days if you need more time with your accountant: reply "extend"

No auto-charge. No cancellation maze. If Fatortak is not the right fit, tell me why — it is more useful than a silent churn.

Ahmed
```

---

## Sequence 3 — Accountant partner (3 emails)

**Trigger:** accounting/bookkeeping firm expresses interest.

### Email 3.1 — day 0

**Subject:** A white-label option for your bookkeeping clients

**Preview:** Recurring revenue, one platform, your brand.

```text
Hi {{first_name}},

You already manage the books for several SMBs. Fatortak can give you a multi-company workspace and a partner margin, without forcing every client onto a US-first tool.

The model:
- You own the client relationship and the first-line support.
- We provide the platform, hosting and second-line support.
- You earn a recurring margin on each active client.
- Clients can self-host later if they want; their data is exportable.

There is no minimum in the first cohort. We are looking for 3–5 firms in Egypt or Saudi Arabia to shape the partner terms.

Worth a 20-minute call?
{{demo_url}}

Ahmed
```

### Email 3.2 — day 4

**Subject:** The numbers for a 10-client practice

**Preview:** A simple partner economics model.

```text
Hi {{first_name}},

A simple model, not a promise:

10 clients × 600 EGP/month = 6,000 EGP/month
Partner margin at 25% = 1,500 EGP/month recurring
Your work: onboarding, first-line support, monthly review

At 25 clients, the recurring margin is 3,750 EGP/month. The real value is not the margin; it is that you stop re-keying the same data into three platforms and you can offer a client portal without building one.

Want the full partner sheet with responsibilities and exit terms? Reply "partner sheet".

Ahmed
```

### Email 3.3 — day 10

**Subject:** What we will not do in the partner program

**Preview:** No lead poaching, no hidden fees, no lock-in.

```text
Hi {{first_name}},

A few commitments, because partner programs often fail on trust:

- We will not sell directly to your clients behind your back.
- We will not hide fees in the renewal.
- Client data can be exported at any time.
- If you leave, your clients can stay on the platform or self-host; we will help with the migration.
- We will publish the margin and the responsibilities before you sign.

If that sounds fair, the next step is a 20-minute call. If it does not, tell me what would make it fair.

Ahmed
```

---

## Sequence 4 — Launch waitlist (3 emails)

### Email 4.1 — launch day

**Subject:** Fatortak is open source

**Preview:** Invoicing, accounting, projects and payroll. Arabic-first. AGPL-3.0.

```text
Hi {{first_name}},

It is live.

Fatortak is now open source under AGPL-3.0: invoicing, double-entry accounting, projects, inventory, HR and payroll in one Arabic-first platform.

- GitHub: https://github.com/Ahmed-Nasser99/Fatortak_Software
- Self-host in minutes: https://github.com/Ahmed-Nasser99/Fatortak_Software#quickstart
- Managed cloud: reply "cloud"

What is honest: it is alpha, there is no independent security audit yet, and ETA/ZATCA e-invoicing is not implemented. The accounting core is real and the code is auditable.

If you try it, tell me what breaks. I am reading every reply this week.

Ahmed
```

### Email 4.2 — day 3

**Subject:** "Does it handle Arabic invoices?" Yes — here is proof

**Preview:** RTL, Arabic PDFs and the one limitation.

```text
Hi {{first_name}},

The most common question: does it really handle Arabic?

Yes:
- Full RTL interface, not a translated overlay
- Arabic invoice templates and Arabic PDF fonts
- Bilingual Arabic/English UI
- Arabic customer and supplier statements

The limitation: the Arabic review is ongoing. Some finance terms and PDF edge cases still need native review. If you spot one, open an issue with a screenshot.

See the Arabic walkthrough:
{{arabic_walkthrough_url}}

Ahmed
```

### Email 4.3 — day 7

**Subject:** 10 pilot slots for MENA companies

**Preview:** A real close, not a sales demo.

```text
Hi {{first_name}},

We are opening 10 pilot slots for companies in Egypt and Saudi Arabia.

What you get:
- Setup and data import help
- A review of your first close in Fatortak
- Direct access to me
- Founding-customer pricing if you continue on cloud

What we ask:
- A 20-minute workflow call
- One real (or anonymized) month of data
- Honest feedback, including "this is not for us"

Reply "pilot" and tell me your company size and the tool you use today.

Ahmed
```

---

## Sequence 5 — Cloud customer onboarding (4 emails)

### Email 5.1 — day 0

**Subject:** Welcome to Fatortak Cloud — your first 7 days

**Preview:** The setup path that avoids a messy first close.

```text
Hi {{first_name}},

Welcome. Here is the path we recommend for the first seven days:

Day 1: Company profile, logo, invoice template, VAT settings.
Day 2: Chart of accounts and opening balances.
Day 3: Customers, suppliers and opening invoices.
Day 4: Bank/cash accounts and cheques.
Day 5: First invoice and payment.
Day 6: Payroll and project allocations.
Day 7: First trial balance review with your accountant.

Onboarding guide: {{onboarding_url}}
Book a setup call: {{demo_url}}

If you are migrating from Excel, send the file and we will map it before import. Do not clean it manually first; we would rather see the real mess.

Ahmed
```

### Email 5.2 — day 7

**Subject:** Did the first invoice go out?

**Preview:** A quick check-in, not a newsletter.

```text
Hi {{first_name}},

One question: did you send your first real invoice in Fatortak?

If yes, reply with one thing that felt slower than your old process. That is the next thing we fix.

If no, what blocked you? Setup, data, Arabic PDF, or something else? Reply and I will help personally.

Ahmed
```

### Email 5.3 — day 21

**Subject:** Your first close: the three reports that matter

**Preview:** Trial balance, P&L, project margin.

```text
Hi {{first_name}},

By now you should be able to run three reports without help:

1. Trial balance — do debits equal credits, and are there unexplained balances?
2. P&L — does the profit match the owner's mental model?
3. Project margin — which projects made money after payroll and expenses?

If one of these is still unclear, book 20 minutes:
{{demo_url}}

We will not upsell you on the call. We will fix the setup.

Ahmed
```

### Email 5.4 — day 45

**Subject:** Renewal, referrals, and a favor

**Preview:** A short check-in before renewal.

```text
Hi {{first_name}},

Your plan renews on {{renewal_date}}. No action needed if everything is working.

Three things:
1. If you need more users, invoices or branches, reply and I will send the upgrade options.
2. If another company in your network needs this, an introduction is more valuable than a review.
3. If something is broken, tell me before renewal. I would rather fix it than lose a customer silently.

Thanks for trusting us with your books.

Ahmed
```

---

## Sequence 6 — Win-back (2 emails)

### Email 6.1 — day 7 after churn

**Subject:** What went wrong?

**Preview:** One question, no pitch.

```text
Hi {{first_name}},

You stopped using Fatortak. I am not writing to win you back in this email; I am writing to understand.

What was the main reason?
- Missing feature (which one?)
- Too hard to set up
- Arabic/PDF issue
- Price
- Switched to another tool
- Business closed or project ended

One line is enough. I read every reply.

Ahmed
```

### Email 6.2 — day 30 after churn

**Subject:** We fixed one of the things you mentioned

**Preview:** Only send if it is true.

```text
Hi {{first_name}},

You mentioned {{reason}} when you left. We shipped {{fix}} on {{date}}.

If you want to try again, your old data may still be exportable. Reply and I will check. If not, no hard feelings — the feedback still made the product better.

Ahmed
```

**Rule:** Never send email 6.2 unless the fix is real and shipped. "We are working on it" is not a win-back.

---

## Deliverability and compliance

- Use a custom domain and authenticate SPF, DKIM and DMARC before the first send.
- Warm up slowly: 20–50 emails/day for a new domain, not 5,000.
- Plain text or a single-column HTML layout. No image-only emails.
- Every commercial email needs a working unsubscribe link and a physical address.
- Honor unsubscribes within 24 hours. Do not re-add people from a "new" list.
- Do not email GitHub stargazers. A star is not consent.
- Do not buy lists. It destroys the domain and the brand.
- Track replies, not opens. Opens are unreliable after Apple Mail Privacy Protection.

## Metrics to watch

| Metric | Healthy range | Action if low |
| --- | --- | --- |
| Bounce rate | < 2% | Clean the list, verify the domain |
| Reply rate (OSS welcome) | 2–5% | Ask a sharper question |
| Trial → paid | 10–20% | Fix activation, not subject lines |
| Demo → pilot | 30–50% | Qualify harder before the call |
| Churn (monthly) | < 5% | Interview every churned customer |
