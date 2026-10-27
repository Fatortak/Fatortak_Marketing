---
title: "From Excel to accounting software: a 30-day migration plan for MENA SMBs"
description: "A practical, non-technical migration plan: clean your data, map the chart of accounts, set opening balances and cut over without losing a month."
date: 2026-10-27
author: Ahmed Nasser
tags: [accounting, excel, migration, mena, smb]
canonical: https://ahmed-nasser99.github.io/Fatortak_Software/blog/excel-to-accounting-migration
---

# From Excel to accounting software: a 30-day migration plan for MENA SMBs

Most failed accounting migrations do not fail because of the software. They fail because the business tries to move two years of messy history, clean it, reconcile it and go live in the same week.

This plan takes 30 days and does not require a consultant. It assumes a 5–50 person company, a spreadsheet-based workflow, and an accountant who is busy with the actual close. Adjust the calendar, not the order.

The rule for the first month: **migrate the opening balances, not the history.** You can keep the old files read-only for reference. A new ledger should start from a reconciled cut-off date.

## Week 1 — Decide what "done" means

Before touching software, write one page:

- **Cut-off date.** The first day the new system owns the books. Pick the first day of a month. Mid-month cut-offs double the reconciliation work.
- **Scope.** Which companies, branches, currencies and modules are in scope for day one? Do not migrate payroll and inventory at the same time as invoicing unless you have to.
- **Owner.** One person is accountable for the migration. The accountant reviews, but someone has to chase missing data.
- **Success criteria.** "The trial balance matches the old system at cut-off within 1 EGP" is a criterion. "Better reporting" is not.
- **Exit criteria.** What would make you stop and fix the data before going live? Write it down.

Then inventory your files:

| File | Owner | Rows | Used for | Keep / rebuild |
| --- | --- | --- | --- | --- |
| Sales invoices 2025–2026 | Sales | ? | Revenue, AR | Opening balances only |
| Supplier bills | Admin | ? | AP, expenses | Opening balances only |
| Customer list | Sales | ? | Invoicing | Import |
| Supplier list | Purchasing | ? | Purchasing | Import |
| Chart of accounts | Accountant | ? | Reports | Rebuild with review |
| Payroll sheet | HR | ? | Payroll | Rebuild |
| Bank statements | Accountant | ? | Reconciliation | Current month only |
| Fixed asset register | Accountant | ? | Depreciation | Opening balances |

Do not import every historical invoice. Import open receivables and payables at cut-off, plus the customer and supplier master data. Historical documents stay in the archive.

## Week 2 — Clean the master data

Bad master data is the most common cause of a messy first month. Fix it before import.

### Customers

- One customer, one record. Merge duplicates caused by spelling, Arabic/English names and phone-number variants.
- Decide the legal name and the invoice name. They are not always the same.
- Add tax registration numbers where required. Do not guess a number.
- Mark inactive customers. Do not delete them if they have balances.

### Suppliers

- Same deduplication rules.
- Separate suppliers from employees and from government entities.
- Record payment terms and currency. A supplier paid in USD is not the same as one paid in EGP.

### Items and services

- Separate inventory items from services.
- For inventory, decide the costing method with your accountant before import. Changing it later is not a checkbox.
- Remove items with no sales or purchases in the last 24 months. Archive, do not delete.

### Chart of accounts

Do not copy a 400-line template you found online. Build a chart that matches how the owner reads the business:

- Revenue by service line or project type, not one giant "Sales" account.
- Direct costs separated from overhead.
- Payroll accounts that can be allocated to projects.
- VAT output and input accounts that the accountant recognizes.
- Bank, cash and cheque accounts that match the actual accounts.

A chart of 40–80 accounts is usually enough for a small company. More accounts do not create more insight; they create more places to misclassify.

## Week 3 — Opening balances and a test month

### Opening balances

At the cut-off date, prepare:

1. **Trial balance** from the old system or spreadsheet.
2. **AR aging**: every open customer invoice, with date, amount, paid amount and currency.
3. **AP aging**: every open supplier bill.
4. **Bank and cash balances** reconciled to statements.
5. **Inventory count and valuation** if inventory is in scope.
6. **Fixed assets** and accumulated depreciation.
7. **Loans, cheques and other liabilities** with due dates.
8. **Equity**: share capital, retained earnings, owner drawings.

The opening trial balance must balance. If it does not, do not "plug" the difference into a suspense account and forget it. Find the missing item. A suspense balance that survives go-live becomes a permanent mystery.

### Test with one month of real transactions

Pick the most recent closed month. Enter a sample of real transactions into the new system — not all of them:

- 10 sales invoices, including one with a discount and one with an installment.
- 10 purchase bills, including one with VAT.
- 5 payments, including a partial payment.
- 2 expenses with receipts.
- 1 payroll run.
- 1 project with allocated costs.

Run the trial balance, P&L and project report. Compare to the old month. Differences are usually:

- A missing opening balance.
- VAT calculated on the wrong base.
- A payment applied to the wrong invoice.
- A payroll cost not allocated.
- Rounding.

Fix the process, not just the numbers. If the test month takes three days, the first real month will take five.

## Week 4 — Cut over and freeze the old system

### Cut-over checklist

- [ ] Opening balances imported and reconciled.
- [ ] Customer and supplier balances match the aging reports.
- [ ] Bank and cash balances match the statements.
- [ ] VAT opening position reviewed by the accountant.
- [ ] Invoice numbering configured and tested.
- [ ] Invoice templates checked in Arabic and English, including PDF fonts.
- [ ] Users created with the right roles; no shared admin account.
- [ ] Backups configured and a restore tested.
- [ ] Old system set to read-only for normal users.
- [ ] A one-page "how to do X" guide shared with the team.
- [ ] A named person handles questions for the first two weeks.

### Freeze, do not delete

Keep the old system available read-only for at least one year, or until the first audit is complete. Export the raw data to a secure archive. Deleting the old system in week one is how companies lose the only record of a payment.

### The first close

Do not change the process during the first close. Run the same reports, compare to the old month, and write down every difference. Only then optimize.

## Common mistakes (and how to avoid them)

**Importing two years of history.**
You will spend weeks cleaning data you will never query. Import opening balances and master data; archive the rest.

**Letting the accountant build the chart alone.**
The accountant knows the standards; the owner knows how the business makes money. Both need to agree on the revenue and cost dimensions.

**Using one "Miscellaneous" account.**
It becomes the largest account within six months. If a transaction does not fit, fix the chart or the process.

**Skipping the bank reconciliation.**
A beautiful P&L on top of an unreconciled bank account is fiction. Reconcile cash first.

**Migrating payroll and inventory in the same week.**
Each module has its own edge cases. Sequence them: invoicing and accounting first, then inventory, then payroll.

**No backup restore test.**
A backup that has never been restored is a hope, not a backup. Test the restore on a separate machine.

**Training by email.**
Record a 10-minute screen walkthrough for the three tasks each role does daily. Written documentation alone is not training.

## A note on e-invoicing

If you operate in Egypt or Saudi Arabia, e-invoicing clearance (ETA/ZATCA) may be a legal requirement for your business. Do not assume any accounting software handles it because it prints a VAT invoice. Ask specifically:

- Is the clearance integration live, or only a PDF template?
- Which document types are supported (standard, simplified, credit note, debit note)?
- What happens when the clearance API is down?
- Who is responsible for signing and submission?

Fatortak does **not** implement ETA or ZATCA clearance today. If that is a hard requirement, choose a compliant provider for that function and keep the accounting ledger separate, or wait until the integration ships. Do not let a sales demo blur the difference between "VAT-ready invoice" and "cleared e-invoice."

## Download the checklist

The migration checklist is in the repository under `marketing/content/seo/` and can be copied into your own project. No email gate.

If you want to see how Fatortak handles opening balances, multi-company scoping and project costs, the community edition is free under AGPL-3.0:

- [GitHub repository](https://github.com/Ahmed-Nasser99/Fatortak_Software)
- [Self-hosting guide](https://github.com/Ahmed-Nasser99/Fatortak_Software/blob/main/docs/self-hosting.md)

*This article is practical guidance, not legal, tax or audit advice. Confirm your chart of accounts, VAT treatment and e-invoicing obligations with a qualified accountant in your jurisdiction.*
