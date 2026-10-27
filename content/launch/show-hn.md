# Show HN

Post manually. Hacker News has no legitimate posting API, and automation gets accounts banned.

## Before posting

- The demo must work without signup, or the README must make self-hosting trivial.
- The repo must have a license, screenshots and a clear "what is it".
- Be ready to sit in the thread for 6 hours.
- Use your real account, not a new one. Mention you are the author.
- Post Tuesday–Thursday, 08:00–10:00 ET.

## Title

```
Show HN: Fatortak – Open-source business software for MENA
```

Alternatives:

```
Show HN: An open-source, Arabic-first alternative to spreadsheets and Odoo
Show HN: Self-hosted invoicing, accounting and payroll for MENA businesses
```

Do not use "revolutionary", "AI-powered" or "10x". HN punishes hype.

## First comment (post immediately)

```text
Author here. Fatortak is an open-source business management system for MENA SMBs — invoicing, double-entry accounting, projects, inventory, HR and payroll in one Arabic-first platform.

I built it because the tools I kept seeing in Egyptian and Saudi SMBs were either spreadsheets, a US SaaS that handled Arabic VAT invoices poorly, or an Odoo implementation that took months and a consultant. The gap was not "another invoice app"; it was one ledger that could answer "which project actually made money?" in Arabic.

Stack: .NET 8 + EF Core + SQL Server, React 18 + Vite + Tailwind, JWT, multi-tenant. AI is Gemini/OpenRouter for the assistant and invoice OCR. License is AGPL-3.0, and the whole stack runs with Docker Compose.

What is deliberately honest:
- It is alpha. No independent security audit yet.
- No Egypt ETA / Saudi ZATCA e-invoicing clearance yet. It is on the roadmap, not done.
- Test coverage is thin. I am actively looking for contributors who care about accounting edge cases.
- SQL Server only. Postgres is not supported today.

What I would love feedback on:
1. Is the README enough to run it without asking me a question?
2. Does the accounting model make sense to an accountant?
3. What would block you from self-hosting this at a 20-person company?

Happy to answer anything about the architecture, the MENA accounting workflow, or why AGPL.
```

## Replies to likely questions

**"Why not use Odoo / ERPNext?"**
> Odoo and ERPNext are excellent and far more complete. The difference is the implementation project: Odoo usually means a partner, a budget and months. Fatortak is narrower and opinionated for SMBs in MENA, with Arabic/RTL and project profitability as first-class, and it can be self-hosted in minutes. If you have an Odoo partner and a six-month budget, Odoo is a reasonable choice.

**"Why AGPL? Isn't that a turn-off?"**
> AGPL keeps the community edition genuinely open while preventing a cloud provider from hosting a modified version without sharing changes. Companies that cannot accept AGPL can buy a commercial license. The free edition is not crippled.

**"How is this different from QuickBooks/Zoho?"**
> Arabic-first RTL, Arabic PDFs, project profitability tied to the ledger, and self-hosting. QuickBooks has a much bigger ecosystem and is more mature. We are earlier and narrower.

**"Is it secure?"**
> It is alpha and has not had an independent audit. We have a security policy, no default admin password, JWT auth, tenant scoping and a hardening guide. I would not expose it to the internet without HTTPS, a strong JWT key and a restricted database. A pilot is the right way to evaluate it.

**"Why SQL Server?"**
> It is what the original product used and what the team knows. Postgres support is a reasonable request; it is not implemented. I would rather say that than pretend it is a one-line change.

**"Does it support Arabic?"**
> Yes: full RTL, Arabic PDF fonts, and an Arabic UI. It is not a machine translation layer. Native Arabic review is an ongoing contribution area.

**"How do you make money?"**
> Managed cloud, commercial licensing for companies that cannot use AGPL, migration/support, and a partner program for accountants. The community edition stays free.

**"AI? Sounds like a gimmick."**
> The useful part is OCR on supplier invoices: photograph a bill, get a draft purchase invoice instead of re-typing it. The assistant answers questions over the ledger. Both are optional; accounting works without an API key.

**"No e-invoicing? That's a dealbreaker in Egypt/Saudi."**
> Fair. It is not implemented and I will not claim otherwise. It is the top integration on the roadmap. If clearance is a hard requirement today, do not buy; tell me your provider and it helps prioritize.

## Rules

- Do not ask for upvotes, in the post or in DMs.
- Do not create a voting ring.
- Do not delete and repost if it does not gain traction.
- Reply to every substantive comment, especially criticism.
- If you get a "this looks like an ad" comment, answer with specifics, not defensiveness.
- Link to the repo, not a gated demo.
