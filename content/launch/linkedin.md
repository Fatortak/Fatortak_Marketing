# LinkedIn launch posts

Three posts for launch week, then one practical post per week. Do not publish all three on the same day.

## Post 1 — Founder story (launch day)

**Hook:** Most MENA businesses do not have an accounting problem. They have a visibility problem.

```text
Most MENA businesses do not have an accounting problem. They have a visibility problem.

The invoices are in one tool. The supplier bills are in a WhatsApp thread. The project costs are in Excel. Payroll is somewhere else. At the end of the month, someone spends a week stitching it together, and the profit number still cannot be defended.

I built Fatortak to fix that.

It is an open-source business platform for MENA SMBs: invoicing, double-entry accounting, projects, inventory, HR and payroll in one Arabic-first system. Every invoice, expense, payment and cheque posts to the same ledger that produces the trial balance, P&L, balance sheet and cash-flow statement. Project costs include purchases, expenses and payroll, so you can answer "did this project make money?" without rebuilding a spreadsheet.

It is licensed AGPL-3.0 and self-hostable with Docker. The community edition is free. Managed cloud, migration and support are available for teams that want someone accountable.

What is deliberately honest:
• Public alpha, no independent security audit yet
• No ETA/ZATCA e-invoicing clearance yet
• SQL Server only today
• Test coverage is thin

I am looking for 10 agencies, contractors, distributors or accounting firms in Egypt and Saudi Arabia to run a pilot and tell me what breaks. Not a demo request: a real month-end close.

Repo: https://github.com/Fatortak/Fatortak_Software

#OpenSource #Accounting #MENA #Arabic #SMB #ERP #Invoicing
```

**First comment:** "If you want the 3-minute Docker quickstart, it is in the README. Happy to answer architecture or accounting questions here."

## Post 2 — The accountant's workflow (day 3)

**Hook:** Your accountant should not be a data-entry operator.

```text
Your accountant should not spend the week re-typing supplier invoices.

In a lot of SMBs, the process looks like this: the supplier sends a PDF or a photo, someone prints it, someone types it into the accounting tool, and then someone checks it against the bank. Three people, one invoice, zero time left for analysis.

Fatortak has two features aimed at that waste:

1. OCR on supplier invoices. Photograph a bill, review the extracted fields, and turn it into a draft purchase invoice. It is a draft on purpose — a human approves it before it touches the ledger.

2. Automatic journal posting. Sales invoices, purchase invoices, payments, expenses and cheques post to one double-entry ledger. The reports read the same ledger, so the trial balance and the P&L cannot quietly disagree.

It is not magic, and it is not a replacement for an accountant. It removes the typing so the accountant can do the review, the classification and the conversation with the owner.

The accounting core works without any AI key. The AI is optional.

If you run a finance team in MENA, what is the worst repetitive task in your close? I am collecting them — the top three shape the next release.

#Accounting #Finance #Automation #MENA #Arabic #SMB
```

## Post 3 — Why open source (day 7)

**Hook:** "Why would a business software company give away the code?"

```text
"Why would a business software company give away the code?"

Fair question. Here is the honest answer.

Fatortak is open source under AGPL-3.0 because business software is infrastructure. Companies should be able to audit how their invoices, payroll and ledger are handled, and they should be able to leave without rebuilding their data.

The community edition is not a demo. It includes invoicing, double-entry accounting, projects, inventory, HR and payroll. You can self-host it with Docker and pay nothing.

The commercial business is separate:
• Managed cloud with backups, updates and support
• Migration and data import
• Priority support and implementation
• A commercial license for companies that cannot accept AGPL

That is the model. The free edition creates trust and distribution; the paid services pay for the work. No fake feature gates, no "contact sales" for the trial.

We are early. The project is alpha, and I would rather say that than pretend otherwise. But the direction is clear: Arabic-first, one ledger, open code, and a real path to support when you need it.

If you have run an open-source business before, I would like to compare notes on the boundary between community and commercial.

#OpenSource #AGPL #BusinessSoftware #MENA #SaaS
```

## Arabic versions

Use the Arabic launch copy in `marketing/content/launch/arabic.md`. For LinkedIn, publish the Arabic version first if your audience is primarily Egyptian/Saudi, then the English version 48 hours later — not simultaneously in the same feed.

## Cadence after launch

| Week | Post | Goal |
| --- | --- | --- |
| 1 | Founder story | Awareness |
| 2 | Accountant workflow | Credibility |
| 3 | Project profitability walkthrough | Commercial intent |
| 4 | Open-source model | Developer/partner reach |
| 5 | Customer pilot lessons (with permission) | Social proof |
| 6 | Arabic invoice/VAT checklist | SEO and saves |

Rules:

- One post per week, maximum two. LinkedIn rewards consistency, not volume.
- No engagement pods, no "comment YES" bait, no fake client stories.
- Put the link in the first comment if reach matters; keep the post itself useful.
- Reply to every comment in the first two hours.
- Use real screenshots. A blurry dashboard is better than a stock photo.
