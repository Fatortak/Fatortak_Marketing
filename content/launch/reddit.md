# Reddit playbook

Reddit is not a broadcast channel. One promotional post in the wrong subreddit can get the domain banned and poison the launch. Read each community's rules, participate for at least a week, and post only where the project is genuinely relevant.

Do not use the same title and body across subreddits. Do not ask for upvotes. Reply to criticism with specifics.

## r/selfhosted

**Rules to check before posting:** self-hosted projects are welcome, but the post must explain what is hosted, the stack, and the license. No SaaS-only links.

**Title:**

```
I open-sourced an Arabic-first business management stack (invoicing, accounting, HR) — .NET 8 + React + SQL Server
```

**Body:**

```text
I have been building Fatortak, a business management system for small companies in the Middle East and North Africa, and I have opened the source under AGPL-3.0.

The problem I kept seeing: an Egyptian or Saudi SMB runs invoicing in Excel, sends PDFs on WhatsApp, keeps project costs in another sheet, and the accountant re-types supplier bills. The tools that exist are either closed cloud SaaS with uneven Arabic support, or an Odoo implementation that needs a consultant and months.

What is in the box:
- Sales and purchase invoices: VAT, discounts, installments, partial payments, six templates, Arabic/English PDFs
- Double-entry accounting: chart of accounts, journal entries, trial balance, P&L, balance sheet, cash flow, AR/AP aging
- Projects and contracts with revenue, costs and payroll tied to project profitability
- Inventory, expenses, suppliers, customers, branches, cheques
- HR: employees, departments, attendance, payroll
- Arabic/English UI with full RTL
- AI assistant and supplier-invoice OCR (optional; no API key required for the accounting core)
- Multi-tenant companies and role-based access

Stack: ASP.NET Core 8 + EF Core + SQL Server, React 18 + Vite + Tailwind. Docker Compose runs the web app, API and SQL Server.

Honest limitations:
- Public alpha; no independent security audit yet
- SQL Server only, no Postgres today
- No Egypt ETA or Saudi ZATCA e-invoicing clearance yet
- Test coverage is thin
- CORS defaults are development-friendly and must be tightened for production

Repo: https://github.com/Fatortak/Fatortak_Software
Self-hosting guide: https://github.com/Fatortak/Fatortak_Software/blob/main/docs/self-hosting.md

I am not posting this as a finished product. I would genuinely value feedback on the Docker setup and the security defaults. If you self-host business software, what would you check before trusting it with real invoices?
```

**Likely questions:** Why SQL Server? Why AGPL? Is it multi-tenant? How do backups work? Answer with links to docs, not a sales pitch.

## r/opensource

**Title:**

```
Why we chose AGPL-3.0 for an Arabic-first business platform (and added a commercial license)
```

**Body:**

```text
We are open-sourcing Fatortak, a business management platform for MENA SMBs: invoicing, double-entry accounting, projects, inventory, HR and payroll. The code is .NET 8 + React, and the repo includes a Docker Compose stack.

The license decision took longer than the first module. We considered MIT, Apache-2.0 and AGPL-3.0.

We chose AGPL because:
1. The community edition should be genuinely useful, not a feature-limited demo.
2. If a cloud provider hosts a modified version, users should be able to get those modifications.
3. A commercial license gives companies that cannot accept AGPL a legitimate path, and funds the work.

What we are trying to avoid:
- "Open core" where the useful parts are closed. The community edition includes the accounting, invoicing, projects, inventory, HR and payroll modules.
- A license that sounds open but restricts commercial use. AGPL is a recognized OSI license.
- Pretending the project is production-ready. It is alpha, and the README says so.

Repo: https://github.com/Fatortak/Fatortak_Software
Licensing notes: https://github.com/Fatortak/Fatortak_Software/blob/main/LICENSING.md

For maintainers who have done this before: what would you change about the boundary between the community edition and the commercial services? I am especially interested in avoiding the "open source until it hurts" trap.
```

## r/egypt / r/saudiarabia / country subs

Only post in a business or tech thread, or with moderator permission. Use a local, practical angle, not a repo dump.

**Title:**

```
I built an Arabic-first invoicing and accounting system for small businesses — looking for honest feedback
```

**Body:**

```text
I am Egyptian, and I built Fatortak after watching small companies run their finances across Excel, WhatsApp and a cloud accounting tool that does not handle Arabic invoices well.

It covers sales and purchase invoices, VAT, installments, double-entry accounting, project profitability, inventory, HR and payroll — with a full Arabic RTL interface and Arabic PDFs. It can be self-hosted, and the source is open under AGPL-3.0.

I am looking for 10 businesses in Egypt or Saudi Arabia to try it and tell me what breaks. Not a sales call: I want to watch a real month-end close and fix the gaps. If you are an accountant or run a 5–50 person company, comment or DM me.

The honest caveats: it is alpha, it does not have ETA/ZATCA e-invoicing clearance yet, and it needs SQL Server.

Repo: https://github.com/Fatortak/Fatortak_Software
```

Do not DM people who did not ask. Do not post the same message in five country subs on the same day.

## r/smallbusiness / r/accounting

These communities are hostile to drive-by promotion, and they are right to be. Do not post a launch. Participate as a person, answer questions about Arabic VAT, project costing or month-end close, and mention the project only when someone asks what you use.

Useful contribution angles:

- "How do you allocate freelancer costs to a project?"
- "What does your month-end close checklist look like?"
- "How do you handle partial payments and installments in your books?"
- "What breaks when you move from Excel to accounting software?"

If you build a genuinely useful checklist or template, share it without a gate. The repo link in your profile is enough.

## Arabic Facebook and WhatsApp groups

These are often higher-intent than Reddit for Egyptian SMBs, but they are moderated and allergic to links. Join, answer questions for two weeks, then ask the admin for permission to share a free tool. Use the Arabic copy in `marketing/content/launch/arabic.md`.

## Posting schedule

| Day | Community | Format |
| --- | --- | --- |
| Day 1 | r/selfhosted | Technical launch post |
| Day 2 | r/opensource | License and architecture discussion |
| Day 3 | LinkedIn / X | Founder story and demo |
| Day 5 | Country sub or Facebook group | Feedback request, local angle |
| Day 7 | r/selfhosted | Follow-up: what changed after feedback (only if substantive) |

Never post the same link to more than two subreddits in 24 hours. Never argue about removals in modmail; ask what would make it acceptable.
