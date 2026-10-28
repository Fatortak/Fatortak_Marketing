# Product Hunt launch kit

Product Hunt has no legitimate launch API. This is copy to paste, plus a reply bank. Do not ask for upvotes, do not coordinate a voting ring, and do not create a new account for launch day.

## Listing fields

**Name:** Fatortak

**Tagline (60 characters max):**

```
Arabic-first business software you can self-host
```

Alternatives:

```
One ledger for invoicing, projects, HR and payroll
Open-source accounting and invoicing for MENA
```

**Short description (260 characters max):**

```
Fatortak is an open-source business OS for MENA SMBs: invoicing, double-entry accounting, projects, inventory, HR and payroll in one Arabic-first platform. Self-host with Docker under AGPL-3.0, or use managed cloud.
```

**Topics:** Open Source, Productivity, Accounting, Small Business, SaaS, Developer Tools, Arabic

**Pricing:** Free · Paid plans from 300 EGP/month

**Website:** https://fatortak.rabbeh.com/

**GitHub:** https://github.com/Fatortak/Fatortak_Software

## Gallery plan (use real screenshots, not mockups)

| # | Image | Caption |
| --- | --- | --- |
| 1 | Dashboard in Arabic (RTL) | One dashboard for sales, cash and project margin — in Arabic. |
| 2 | Invoice editor with VAT and installments | Cash or credit invoices, VAT, discounts, installments and partial payments. |
| 3 | Trial balance or P&L | Every invoice and expense posts to one double-entry ledger. |
| 4 | Project profitability | See revenue, costs and payroll against each project. |
| 5 | Docker Compose terminal | Self-host the full stack with Docker Compose. |

If real screenshots are not ready, launch with three: dashboard, invoice and accounting report. Do not use fake customer logos or invented testimonials.

## Maker's first comment

```text
Hi Product Hunt 👋

I'm Ahmed, and I built Fatortak because the finance stack in most MENA SMBs is a patchwork: Excel for the ledger, WhatsApp for invoices, a cloud tool that handles Arabic VAT awkwardly, and a project profitability number that nobody can defend.

Fatortak is one Arabic-first system for invoicing, double-entry accounting, projects, inventory, HR and payroll. The part I care about most is the ledger: invoices, expenses, payments and cheques post to the same books that produce the trial balance, P&L, balance sheet and cash-flow statement. Project costs include purchases, expenses and payroll, so "did this project make money?" has an answer.

It is open source under AGPL-3.0 and self-hostable with Docker. The commercial edition adds managed hosting, migration, support and a commercial license for teams that cannot use AGPL.

Honest status:
- Public alpha. No independent security audit yet.
- No Egypt ETA or Saudi ZATCA e-invoicing clearance yet. It is on the roadmap, not done.
- SQL Server only today.
- Test coverage is thin; contributors welcome.

I would love feedback from founders and accountants in MENA: what would stop you from running this in a 20-person company? And from self-hosters: is the Docker setup clear enough?

I will be here all day to answer questions.
```

## Reply bank

**"How is this different from Odoo / ERPNext?"**
> Odoo and ERPNext are more complete, and I respect them. The difference is the implementation project: Odoo often means a partner, a budget and months. Fatortak is narrower, Arabic-first, and opinionated for SMBs. Project profitability and RTL are first-class, and the Docker stack is small enough to self-host in an afternoon. If you already have an Odoo partner and a six-month budget, Odoo is a reasonable choice.

**"Is it really free?"**
> The community edition is free forever under AGPL-3.0, including invoicing, accounting, projects, inventory, HR and payroll. You pay for managed hosting, migration, support or a commercial license if AGPL does not fit your product. The free edition is not a demo with features removed.

**"Why AGPL?"**
> AGPL keeps the community edition open while preventing a cloud provider from hosting a modified version without sharing changes. Companies that cannot accept AGPL can buy a commercial license. We publish the reasoning in LICENSING.md.

**"Does it handle Arabic properly?"**
> Yes: full RTL layouts, Arabic invoices and PDF fonts, and a bilingual UI. Arabic is the primary language, not a translation layer added at the end. Native Arabic review is an ongoing contribution area.

**"Can I use it in Egypt/Saudi with e-invoicing?"**
> Not yet. ETA and ZATCA clearance are not implemented. I will not claim compliance we do not have. It is the top integration on the roadmap; tell me which provider or country you need and it helps prioritize.

**"What stack?"**
> .NET 8, EF Core, SQL Server, React 18, Vite, Tailwind, JWT and multi-tenant scoping. AI is Gemini/OpenRouter for the assistant and invoice OCR; accounting works without an AI key. Swagger is included.

**"Is it secure enough for production?"**
> It is alpha and has not had an independent audit. We have a security policy, no default admin password, tenant scoping and a hardening guide. I would start with a pilot behind HTTPS, with a strong JWT key and a restricted database user, not a public production rollout on day one.

**"Why not Postgres?"**
> It is what the original product used and what the team knows. Postgres support is a reasonable request, not a one-line change. I would rather be honest than promise it.

**"Do you have customers?"**
> The product is used by businesses, but the open-source edition is a first public release. I am not going to invent logos or testimonials. The first cohort gets close support and a direct line to the roadmap.

## Launch-day checklist

- [ ] Product Hunt page scheduled for 00:01 PT (09:00 Cairo).
- [ ] All gallery images are real screenshots and readable at mobile size.
- [ ] Repo README opens with what it is, a screenshot and a one-command self-host.
- [ ] Docker quickstart tested on a clean machine.
- [ ] GitHub issues enabled and a pinned "Start here" issue published.
- [ ] Reply bank open in a second window.
- [ ] Block 3 hours after launch to reply, not to refresh the leaderboard.
- [ ] Share the launch link on LinkedIn, X, Bluesky and relevant communities — without asking for upvotes.
- [ ] Thank every substantive comment, including critical ones.
- [ ] Publish a short "what we learned" post 48 hours later.
