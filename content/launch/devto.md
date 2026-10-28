---
title: "Why we built an Arabic-first ERP for MENA — and open-sourced it under AGPL"
published: false
description: "Arabic-first is an architecture decision, not a translation layer. Notes from building an open-source invoicing, accounting and payroll platform for MENA SMBs."
tags: opensource, accounting, dotnet, react
canonical_url: https://fatortak.github.io/Fatortak_Software/blog/arabic-first-erp
---

Most business software for the Middle East is built in English first and translated later. The translation is usually the easy part. The hard part is everything underneath: right-to-left layouts, Arabic PDF fonts, invoice numbering that finance teams recognize, and workflows that match how an Egyptian or Saudi SMB actually closes a month.

Fatortak is an open-source business platform for MENA SMBs: invoicing, double-entry accounting, projects, inventory, HR and payroll. We opened the source under AGPL-3.0 and added a commercial license for companies that cannot use it. This is a short write-up of the technical decisions behind it, including the ones that are still incomplete.

## Arabic-first is not a locale file

The first version looked like a normal React app with an `ar.json` translation file. It was not enough.

Arabic-first forced changes at every layer:

- **Layout direction.** RTL is not a CSS class at the root. Tables, charts, invoice templates, date pickers and PDF layouts all need to be checked in both directions. A dashboard that looks fine in English can put the most important number off-screen in Arabic.
- **Typography.** Arabic PDFs need embedded fonts and correct shaping. A browser preview that renders with a system font can produce a PDF with missing glyphs.
- **Content.** Invoice terms, VAT labels, project statuses and payroll fields are not one-to-one translations. "Installment" and "partial payment" have different accounting meanings; the UI has to make the distinction clear in both languages.
- **Numbers and dates.** Arabic-speaking users do not all want Arabic-Indic digits. Finance teams often prefer Latin digits in tables and reports. We keep the interface bilingual while keeping numeric columns consistent.

The lesson: if Arabic is a first-class requirement, it belongs in the definition of done for every feature, not in a translation sprint at the end.

## One ledger, not five modules

The core design constraint is simple: every financial event should post to the same double-entry ledger that the reports read.

An invoice is not just a document with a total. It creates a receivable, a revenue line and a VAT liability. A purchase invoice creates a payable and an expense or inventory asset. A payment changes cash and clears a receivable. A cheque is not cash until it clears.

If each module keeps its own totals, the month-end close becomes a reconciliation project. The trial balance disagrees with the P&L, the P&L disagrees with the project report, and nobody trusts any of them.

The model we use:

```text
Invoice ──► Journal entry ──► Ledger ──► Trial balance
   │                            │
   ├── Project allocation       ├── P&L
   ├── Cost center              ├── Balance sheet
   └── Customer/supplier        └── Cash flow
```

Project profitability is a view over the same postings, not a separate spreadsheet. Invoices, purchases, expenses and payroll can be linked to a project. The report sums revenue and costs against that project. If a cost is not linked, it does not magically appear in the project margin — and the UI should make that visible instead of hiding it.

This is also why "we will add accounting later" is a dangerous plan for an invoicing product. Retrofitting double-entry posting into a document-centric schema is a rewrite.

## Multi-tenancy without a second database per customer

Fatortak is multi-tenant at the company level. A user can belong to more than one company, and every business record is scoped to a company.

The important part is not the tenant column. It is making the scoping hard to forget:

- Tenant resolution happens in middleware, not in every controller.
- Queries are filtered by the resolved company.
- Role checks are applied at the company boundary, not only at the UI.
- Background jobs and exports use the same scoping rules as interactive requests.

This is an area where open source helps. A security reviewer can see the filter, the middleware and the tests. It is also an area where we are honest: the project is alpha, test coverage is thin, and there has not been an independent audit. Multi-tenancy is a design goal, not a claim of certification.

## The stack and the trade-offs

- **Backend:** ASP.NET Core 8, EF Core 8, SQL Server, JWT auth.
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Query, i18next.
- **AI:** Google Gemini and OpenRouter for the assistant and supplier-invoice OCR. Optional by design.
- **Deployment:** Docker Compose for the API, web app and SQL Server.

Why SQL Server? It is what the original product used and what the team knows. It is not the cheapest or most fashionable choice for self-hosting. Postgres support is a reasonable request, but it is not a one-line change: migrations, types, collation and SQL syntax all need work. We would rather say that than pretend the port is trivial.

Why .NET and React? The backend needs mature accounting libraries, background jobs and a type system that survives a large domain. The frontend needs a large component ecosystem and good RTL support. Both are defensible; neither is the point of the product.

## AI where it removes typing, not where it makes decisions

The useful AI feature is not a chatbot that writes poetry about your balance sheet. It is OCR on a supplier invoice: take a photo, extract the vendor, date, line items and totals, and create a **draft** purchase invoice. A human reviews it before it posts.

The assistant can answer questions over the ledger, but it does not post entries on its own. Accounting is a domain where a confident wrong answer is expensive. The accounting core works without any AI key; if the API is down, invoicing and reporting still work.

This is also a product decision: we do not want an SMB to be unable to close its books because a model provider changed a price or deprecated an endpoint.

## Licensing: AGPL plus a commercial path

The community edition is licensed AGPL-3.0. It includes the modules that make the product useful: invoicing, accounting, projects, inventory, HR and payroll. It is not a feature-limited trial.

AGPL is a deliberate choice:

- It keeps the community edition genuinely open.
- It prevents a cloud provider from hosting a modified version without sharing changes.
- It gives companies that cannot accept AGPL a reason to buy a commercial license.

The commercial business is managed cloud, migration, priority support and a commercial license. That is the boundary: we charge for operational work and legal flexibility, not for holding the accounting module hostage.

## What is missing

The honest list:

- No Egypt ETA or Saudi ZATCA e-invoicing clearance. It is on the roadmap and under research.
- SQL Server only.
- Test coverage is thin, especially around accounting edge cases: partial payments, installments, credit notes, multi-currency and cheque clearing.
- No independent security audit.
- No public demo dataset yet.
- Country-specific payroll tax filing is not implemented.

These are not footnotes to hide. They are the reasons the project is labeled alpha.

## What we want from the open-source community

The most useful contributions are not more features. They are:

1. **Accounting tests.** Invoice totals, VAT rounding, installment schedules, partial payments, journal balancing.
2. **Arabic review.** Real finance vocabulary, RTL edge cases, PDF font rendering.
3. **Self-hosting reports.** What broke on Ubuntu, Windows, a Synology NAS, a small VPS.
4. **Security review.** Tenant scoping, auth flows, file uploads, PDF generation.
5. **Migration guides.** Excel to Fatortak, QuickBooks to Fatortak, what data survives and what does not.

If you run a 5–50 person company in MENA and want to try it, the Docker quickstart is in the README. If you are an accountant and want to tell us where the model is wrong, open an issue. That is more valuable than a star.

Repo: [github.com/Fatortak/Fatortak_Software](https://github.com/Fatortak/Fatortak_Software)

---

*Fatortak is alpha software. Do not expose an instance to the public internet without reading the security and self-hosting guides, using HTTPS, and restricting database access.*
