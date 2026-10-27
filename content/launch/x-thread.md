# X / Twitter launch thread

Post the thread as a reply chain from your own account. Attach a real dashboard screenshot to tweet 1 and a project-profitability screenshot to tweet 3. Add alt text to every image. Do not ask for reposts or likes.

## Thread

**1/9**

```text
Most MENA SMBs don't have an accounting problem. They have a visibility problem.

Invoices in one app, supplier bills in WhatsApp, project costs in Excel. I built Fatortak to put it in one Arabic-first ledger.

Open source, AGPL-3.0. 🧵
```

**2/9**

```text
The core: every invoice, expense, payment and cheque posts to one double-entry ledger.

Trial balance, P&L, balance sheet and cash flow read the same books. No second version of the truth.
```

**3/9**

```text
Projects: link invoices, purchases, expenses and payroll to a project.

See revenue, cost and margin per project. Answer "did this project make money?" without rebuilding a spreadsheet.
```

**4/9**

```text
Arabic-first means RTL layouts, Arabic invoices and Arabic PDF fonts.

Not a translation layer added at the end. English is there too.
```

**5/9**

```text
Self-host the full stack with Docker Compose: React web app + .NET 8 API + SQL Server.

AGPL-3.0. Or use managed cloud if you want backups and someone to call.
```

**6/9**

```text
AI is optional: OCR a supplier bill into a draft purchase invoice, or ask the assistant questions over the ledger.

The accounting core runs without an API key.
```

**7/9**

```text
Honest limits:

• Public alpha
• No independent security audit yet
• No ETA/ZATCA e-invoicing yet
• SQL Server only

I won't claim compliance we don't have.
```

**8/9**

```text
Built in Egypt for 5–50 person agencies, contractors, distributors and accounting firms.

Looking for 10 pilots in Egypt and Saudi Arabia to watch a real month-end close.
```

**9/9**

```text
Repo + Docker quickstart:
https://github.com/Ahmed-Nasser99/Fatortak_Software

If you run an SMB in MENA, tell me what breaks in your current workflow. Even if you never use Fatortak.
```

## Standalone posts

Use these on other days. Each is under 280 characters.

**Arabic-first**

```text
Your accounting software should not make you translate your business into English.

Fatortak is Arabic-first: RTL, Arabic invoices, Arabic PDFs, and a full English UI when you need it.

Open source. Self-hostable. Built for MENA.
```

**Project margin**

```text
Revenue is not profit.

A 200k EGP project can lose money after freelancers, materials, payroll and expenses.

Fatortak links all of them to the project, so the margin is a ledger number — not a guess.
```

**Self-hosting**

```text
docker compose up --build

That is the whole self-host story: React frontend, .NET 8 API, SQL Server.

AGPL-3.0. Your data, your server, no per-invoice tax.
```

**Open source**

```text
We open-sourced the accounting core, not a demo.

Invoicing, double-entry accounting, projects, inventory, HR and payroll. AGPL-3.0.

The commercial edition is hosting, migration and support — not a feature hostage.
```

**Honest limit**

```text
No ETA/ZATCA e-invoicing clearance in Fatortak yet.

It is on the roadmap, not done. I would rather tell you that than sell you a compliance claim that fails an audit.

Everything else: invoicing, accounting, projects, HR, payroll.
```

## Reply bank

**"Why not Odoo?"**

```text
Odoo is more complete. It also often means a partner, a budget and months of implementation.

Fatortak is narrower, Arabic-first and self-hostable in an afternoon. Different trade-off, not a better Odoo.
```

**"Is the free version crippled?"**

```text
No. The community edition includes invoicing, accounting, projects, inventory, HR and payroll under AGPL-3.0.

We charge for managed hosting, migration, support and a commercial license.
```

**"Why SQL Server?"**

```text
It is what the original product used and what the team knows.

Postgres is a reasonable request, not a one-line change. I would rather say that than pretend.
```

**"AI gimmick?"**

```text
The useful part is OCR on supplier bills: photo → draft purchase invoice → human review.

The assistant is optional. Accounting works without an API key.
```

**"Is it secure?"**

```text
Alpha, no independent audit yet. No default admin password, JWT auth, tenant scoping, hardening guide.

Start with a pilot behind HTTPS and a restricted DB user, not a public rollout on day one.
```

## Rules

- One thread per launch, not one per day.
- No "like + repost to win" mechanics.
- No DM automation.
- Quote-tweet customer questions only with permission.
- If a thread gets criticism, answer with the specific limitation. Do not delete it.
- Pin the thread for launch week, then unpin it.
