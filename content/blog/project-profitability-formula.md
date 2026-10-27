---
title: "Project profitability: the formula agencies and contractors get wrong"
description: "Revenue minus freelancer invoices is not project profit. A practical method for allocating payroll, overhead and expenses without lying to yourself."
date: 2026-10-27
author: Ahmed Nasser
tags: [project-profitability, agencies, accounting, mena]
canonical: https://ahmed-nasser99.github.io/Fatortak_Software/blog/project-profitability-formula
---

# Project profitability: the formula agencies and contractors get wrong

Ask an agency owner whether a project made money, and you will usually get one of two answers:

1. "Yes, we invoiced 200k and the freelancers cost 60k."
2. "I think so, but I need to check with the accountant."

Both answers describe cash, not profit. The project may have consumed 45k of payroll, 35k of materials, 15k of expenses and a month of the founder's attention. The invoice total is not the result.

This article gives a defensible formula, the allocation decisions behind it, and the mistakes that make project reports look precise while being wrong.

## The formula

```text
Project profit =
  Project revenue
  − direct freelancer and contractor costs
  − materials and subcontractors
  − directly attributable expenses
  − allocated payroll
  − allocated overhead (optional, but decide explicitly)
```

```text
Project margin % = project profit ÷ project revenue × 100
```

That is simple. The hard part is not the arithmetic; it is deciding what belongs in each line, and applying the rule consistently.

## Decide the boundary first

There are two legitimate views of project profitability:

**Contribution margin** — revenue minus costs that disappear if the project disappears. Freelancers, materials, subcontractors, travel. Payroll is included only if the person is hired specifically for the project or their hours are directly billable.

**Fully loaded margin** — contribution margin minus a share of payroll and overhead. This is closer to the true economic profit, but it requires allocation rules and discipline.

Neither is wrong. Mixing them is wrong. Pick one for management reporting, document it, and use it consistently. Most agencies should run contribution margin weekly and fully loaded margin monthly.

## Payroll is the number everyone avoids

Payroll is usually the largest project cost and the least visible, because salaries are paid monthly and projects are not.

Three defensible allocation methods:

### 1. Timesheets (most accurate, most friction)

Allocate salary cost by hours logged:

```text
Hourly cost = monthly salary + employer contributions ÷ productive hours in the month
Project payroll cost = hourly cost × hours logged on the project
```

Use **productive hours**, not 22 days × 8 hours. Subtract vacation, sick leave, internal meetings and admin. A common starting point is 120–140 productive hours per month, but measure your own.

The weakness is data quality. If people fill timesheets on Friday for the whole week, the allocation is fiction with a timestamp.

### 2. Fixed percentage (fastest, least accurate)

The team agrees that a person spends, say, 40% on Project A and 60% on Project B for the month. This works for stable retainers and small teams. It fails when the actual split changes week to week.

### 3. Capacity-based allocation (a middle ground)

Allocate payroll based on the role's capacity consumed by the project, estimated at kickoff and adjusted at close. For example, a designer at 60% capacity for six weeks. This is less precise than timesheets but more honest than a made-up percentage.

Pick one method per team. Do not let each project manager choose the method that makes their project look better.

## Overhead: include it, but do not hide it

Rent, software, accounting, admin salaries and sales costs are real. If you never allocate overhead, every project looks profitable and the company can still lose money.

A simple allocation:

```text
Overhead rate = total overhead for the period ÷ total direct project cost for the period
Allocated overhead = project direct cost × overhead rate
```

Or allocate by revenue share. Either is defensible if you apply it consistently and review the rate quarterly.

Do not allocate overhead into a project report used by the delivery team to make daily decisions; it will confuse them. Use contribution margin for delivery, fully loaded margin for pricing and company-level decisions.

## A worked example

A branding project for a 6-week engagement:

| Line | Amount (EGP) |
| --- | ---: |
| Contract revenue | 200,000 |
| Freelance designers | 60,000 |
| Photography and materials | 35,000 |
| Travel and direct expenses | 15,000 |
| Allocated payroll (designer + account manager) | 45,000 |
| **Contribution profit** | **45,000** |
| Allocated overhead (10% of direct costs) | 15,500 |
| **Fully loaded profit** | **29,500** |

Contribution margin: 22.5%. Fully loaded margin: 14.75%.

The owner saw "200k project" and assumed a healthy month. After payroll and overhead, the project barely covered the cost of the next sales cycle.

Now change one assumption: the project took 9 weeks instead of 6, but the fee stayed fixed. Payroll rises to 67,500 and overhead to 17,750. Fully loaded profit falls to 4,750 — a 2.4% margin. That is the scope-creep signature: revenue unchanged, cost creeping.

## The five mistakes that make the report lie

**1. Counting revenue when it is invoiced, not earned.**
An invoice is not profit. If you invoice 100% upfront but deliver over three months, the project can be cash-positive and profit-negative at the same time.

**2. Leaving payroll in a company bucket.**
If payroll is not allocated, every project looks better than it is, and the busiest team looks cheap.

**3. Treating freelancers as the only direct cost.**
Materials, software licenses, travel, payment fees and subcontractors belong to the project too.

**4. Allocating costs after the project closes.**
A late supplier bill can turn a profitable project into a loss. Close the project only when the costs are in, or mark it "provisional" and review at 30 days.

**5. Changing the allocation rule to win an argument.**
The fastest way to destroy trust in project reporting is to change the method when a partner does not like the answer. Publish the rule, apply it, review it quarterly.

## What to review every month

- Revenue, direct cost and margin per project.
- Projects with margin below the target, and why.
- Unbilled time and unlinked costs.
- Payroll allocation coverage: what percentage of payroll is assigned to projects?
- Change orders: did scope increase without a fee increase?
- Top five projects by profit and by loss.

One page, once a month, with the owner and the finance lead. Not a 40-page dashboard.

## How Fatortak handles it

Fatortak links invoices, purchase invoices, expenses and payroll to projects. The project report reads the same double-entry ledger as the trial balance and P&L, so the project margin is not a separate spreadsheet that can drift.

Two honest constraints:

- An unlinked cost does not appear in the project margin. The report should show unallocated costs rather than hide them.
- The allocation method is a business decision. The software can store the allocation; it cannot decide whether timesheets or fixed percentages are right for your team.

The community edition is free under AGPL-3.0 and self-hostable with Docker. If you want to see the project report on your own data, start here:

- [GitHub repository](https://github.com/Ahmed-Nasser99/Fatortak_Software)
- [Project profitability page](https://ahmed-nasser99.github.io/Fatortak_Software/#features)

*Example figures are illustrative. Tax treatment and payroll allocation rules vary by jurisdiction; confirm them with your accountant.*
