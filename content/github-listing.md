# GitHub listing

Everything here is ready to paste into GitHub. Keep claims accurate.

## About

**Description (350 char max):**

> Open-source business management for MENA: invoicing, double-entry accounting, projects, inventory, HR and payroll. Arabic-first with full RTL, self-hostable with Docker, AGPL-3.0. A modern alternative to spreadsheets and closed ERPs for SMBs.

**Website:**

```
https://fatortak.rabbeh.com/
```

**Topics (paste one per line in the GitHub UI):**

```
accounting
invoicing
erp
open-source
arabic
rtl
mena
self-hosted
react
dotnet
sql-server
payroll
project-management
small-business
saas
business-management
invoice-generator
double-entry-accounting
```

## Social preview

Upload a 1280×640 PNG. Use the banner concept: dark navy background, Arabic wordmark `فاتورتك`, English `Fatortak`, tagline "The open-source business OS for MENA", and four small labels: Invoicing · Accounting · Projects · Payroll. Do not put 12 features in the image; it will be unreadable at timeline size.

## Pinned issue — "Start here"

Title: **Start here: what Fatortak is, how to run it, and how to contribute**

```markdown
Welcome to Fatortak 👋

Fatortak is an open-source business platform for MENA: invoices, double-entry accounting, projects, inventory, HR and payroll in one Arabic-first system.

**Try it**
- 3-minute quickstart: README → Quickstart
- Docker: `cp .env.docker.example .env && docker compose up --build`
- Screenshots and demo: <landing page>

**Good first contributions**
- Tests for invoice totals, VAT and installments
- Arabic translation review
- Docker/demo seed data
- Accessibility on login/register
- Docs: migration from Excel

Browse [`good first issue`](https://github.com/Fatortak/Fatortak_Software/labels/good%20first%20issue).

**Rules**
- Be kind: CODE_OF_CONDUCT.md
- No secrets or customer data in issues
- Security issues: SECURITY.md, not public issues

**Roadmap**
docs/roadmap.md. Tell us which country and workflow you need; it shapes priorities.

If you run a business in MENA, I would love to hear what breaks in your current workflow — even if you never use Fatortak.
```

## First release notes — v0.1.0

```markdown
# Fatortak v0.1.0 — first public alpha

Fatortak is now open source under AGPL-3.0.

## What is included
- Sales and purchase invoices with VAT, discounts, installments and partial payments
- Six invoice templates, public invoice links, PDF export
- Double-entry accounting: chart of accounts, journal entries, trial balance, P&L, balance sheet, cash flow, AR/AP aging
- Projects, contracts, project lines and profitability
- Inventory, expenses, customers, suppliers, branches
- HR: employees, departments, attendance, payroll
- AI assistant and invoice OCR
- Arabic/English UI with RTL
- Docker Compose self-hosting

## Known limitations
- Alpha software; no independent security audit
- No ETA/ZATCA e-invoicing integration yet
- Test coverage is thin
- SQL Server only
- CORS defaults are development-friendly and must be restricted in production

## Thanks
Built in Egypt. Contributions, translations and brutal feedback are welcome.
```

## Repository settings checklist

- [ ] Description and website set
- [ ] 15 topics added
- [ ] Social preview uploaded
- [ ] Discussions enabled
- [ ] Private vulnerability reporting enabled
- [ ] Issues enabled with templates
- [ ] Wiki disabled (docs live in `docs/`)
- [ ] `main` protected: require CI, require PR review, no force push
- [ ] Releases tagged `v0.1.0`
- [ ] Dependabot enabled
- [ ] Sponsorship/Funding link set (if applicable)
