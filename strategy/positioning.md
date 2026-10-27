# Positioning

## One line

**English:** Fatortak is the open-source business operating system for MENA — invoicing, accounting, projects, HR and payroll in one Arabic-first platform you can self-host.

**Arabic:** فاتورتك هو نظام إدارة الأعمال مفتوح المصدر للشرق الأوسط — فواتير ومحاسبة ومشاريع وموارد بشرية ورواتب في منصة عربية واحدة يمكنك استضافتها بنفسك.

## Category

We are not "another invoicing app". We create the category **open-source business OS for MENA**:

- accounting depth of a finance system
- operational breadth of an ERP-lite (projects, inventory, HR)
- Arabic-first experience
- open-source trust and self-hosting

The closest mental models: **Odoo's scope at SMB prices**, **QuickBooks' familiarity with Arabic-first execution**, **Cal.com's open-source model applied to business software**.

## Ideal customer profile

### Primary — MENA SMBs with operational complexity (5–50 employees)

| Segment | Why they buy | Trigger |
| --- | --- | --- |
| Marketing/creative agencies | Project margin is invisible; invoices, expenses and freelancer costs live in separate tools | A losing project, a new retainer, a profitability question from an investor |
| Contracting and construction | Contract value is known; actual project cost is not | A new contract, a cost overrun, a bank asking for statements |
| Trading and distribution | Purchases, item costs, supplier balances, cheques and VAT are spread across Excel | Stock growth, a VAT inspection, a new branch |
| Professional services / consulting | Utilization and project profitability are guesses | Hiring, a new partner, a pricing decision |
| Accounting and bookkeeping firms | Re-keying client data into multiple platforms | A new client cohort, a capacity ceiling |

**Geography:** Egypt first (Arabic + EGP + local payment rails), then Saudi Arabia and UAE, then wider MENA and Arabic-speaking diaspora.

**Buying committee:** owner/GM (economic buyer), accountant/finance manager (champion or blocker), operations manager (user), IT/agency (self-hosting or security review).

### Secondary — developers and self-hosters

People who want a real business app they can run, audit and extend. They generate stars, issues, translations and credibility. They are not the primary revenue segment, but they are the distribution engine.

### Not our customer (yet)

- Enterprises above ~200 employees with complex consolidation, SSO and audit requirements.
- Businesses that need country-specific payroll tax filing or e-invoicing clearance today.
- Micro-freelancers with no willingness to pay and no accounting complexity.
- Companies that want a fully managed US SaaS and will never self-host or buy from a MENA vendor.

Being explicit about this prevents wasted sales cycles.

## The problem, in the customer's words

- "أنا مش عارف المشروع ده كسب ولا خسر." — *I don't know whether this project made or lost money.*
- "كل شهر بقعد أسبوع أجمع ملفات الإكسل." — *Every month I spend a week consolidating Excel files.*
- "المحاسب بيعيد كتابة فواتير الموردين." — *The accountant re-types supplier invoices.*
- "QuickBooks مش مظبوط مع الفاتورة العربية والضريبة." — *QuickBooks doesn't handle the Arabic invoice and VAT properly.*
- "Odoo قوي بس محتاج شهور ومستشار." — *Odoo is powerful but needs months and a consultant.*
- "بياناتنا لازم تفضل على سيرفرنا." — *Our data has to stay on our server.*

## The promise

**One system, one ledger, one truth — in Arabic, on your terms.**

Customers get:

1. **A close that takes hours, not a week** — invoices, expenses, payments and cheques post to the same ledger the reports read.
2. **A profit number they can defend** — project costs include invoices, purchases, expenses and payroll.
3. **An Arabic experience that does not feel translated** — RTL, Arabic PDFs, Arabic support.
4. **Data ownership** — export, self-host, audit the code.
5. **Less data entry** — OCR for supplier invoices, AI for questions.

## Differentiators

| Differentiator | Why it matters | Proof |
| --- | --- | --- |
| Arabic-first, RTL-native | Most competitors treat Arabic as a translation layer | Full RTL UI, Arabic PDF fonts, bilingual product |
| One ledger behind every module | Prevents "two versions of the truth" | Invoices/expenses/payments post journal entries; reports read the ledger |
| Project profitability built in | Agencies and contractors cannot answer "which project made money?" | Link invoices, expenses, payroll and purchases to projects |
| Open source (AGPL-3.0) | Auditability, customization, no lock-in | Public repo, license, self-hosting docs |
| Self-hostable with Docker | Data residency and cost control | Docker Compose stack |
| AI that removes entry work | The accountant's time is the expensive part | Invoice OCR to draft purchase invoice; assistant with charts |
| MENA pricing | USD subscriptions are painful before USD revenue | EGP plans, local payment options |

## Competitive landscape

Verify current pricing and features before repeating any claim publicly. This table is for internal positioning, not for attack ads.

| Alternative | Strength | Typical limitation for our ICP | Our angle |
| --- | --- | --- | --- |
| **Excel / Google Sheets** | Free, familiar, flexible | No audit trail, no reconciliation, breaks with growth | "Keep the flexibility, lose the spreadsheet risk" |
| **QuickBooks Online** | Brand trust, ecosystem, familiar workflows | Arabic/RTL and MENA VAT localization are uneven; cloud-only | "Arabic-first, project-aware, self-hostable" |
| **Odoo** | Huge module catalogue, customization | Implementation cost and time; needs a partner; heavier than an SMB needs | "Odoo-class scope without a six-month project" |
| **Zoho Books** | Broad suite, affordable | Localization varies; Arabic experience is secondary | "Built for Arabic workflows from day one" |
| **Wafeq / Qoyod / Daftra** | Regional compliance focus, local support | Closed source, cloud-only, limited self-hosting or deep customization | "Open source + self-host + full accounting" |
| **Build in-house** | Exact fit | Cost, maintenance, accounting edge cases, key-person risk | "Own the code without owning the payroll of a dev team" |

## Objection handling

**"Open source is less secure."**
Open source is auditable, not automatically secure. We publish a security policy, minimize secrets, and support self-hosting so you control the perimeter. We are also honest: the project is alpha and has not had an independent audit. For regulated buyers, that is a reason to start with a pilot, not a reason to lie.

**"Who supports it if we have a problem?"**
Commercial support and managed cloud are available. The community edition is free; the paid tier exists precisely so someone is accountable.

**"Is it compliant with Egyptian/Saudi e-invoicing?"**
Not yet. E-invoicing integration (ETA/ZATCA) is on the roadmap and is being researched. We do not claim compliance we do not have. If clearance is a hard requirement today, we are not the right choice yet — tell us anyway, it prioritizes the roadmap.

**"We already use QuickBooks."**
Keep it if it works. Fatortak is for teams where Arabic invoices, project profitability, self-hosting or customization are the blocker. We can import customers, suppliers, open invoices and the chart of accounts.

**"It looks cheap. Is it serious?"**
Launch pricing is intentionally accessible for MENA SMBs. The code, roadmap and support model are public. Start with a pilot on one company or one branch, with a clear exit and export path.

**"Can it handle our size?"**
It handles multi-company, branches and role-based access. If you need consolidation across 20 entities, SSO and a formal audit log today, we are not there yet. We will tell you.

**"Why not just use Odoo?"**
If you have an Odoo partner, a budget and six months, Odoo is a reasonable choice. Fatortak is for teams that want the operational scope without the implementation project — and want the option to own the code.

## Messaging matrix

| Audience | Lead message | Proof point | CTA |
| --- | --- | --- | --- |
| Owner/GM | "Know which project and which customer actually makes money." | Project profitability + one ledger | Book a 20-min demo |
| Accountant | "Stop re-keying. Close from one ledger." | Auto journal posting, OCR, reports | See the accounting workflow |
| Operations | "Invoices, projects and payroll stop fighting each other." | Shared projects, branches, roles | Start a pilot |
| Developer/self-hoster | "A real business app you can audit and run." | AGPL, Docker, .NET/React, Swagger | Star the repo / self-host |
| Accountant partner | "Earn recurring revenue from clients you already advise." | Multi-tenant, partner margin | Partner call |

## Voice and tone

- **Specific over dramatic.** "Close in hours, not a week" beats "revolutionary accounting."
- **Bilingual, not translated.** Write Arabic that an Egyptian or Saudi finance manager would actually use.
- **Admit limits.** "Not yet" builds more trust than a vague "coming soon."
- **Numbers over adjectives.** Mention 6 templates, 3 reports, 30/60/90 aging, 20 minutes.
- **No hype words.** No "revolutionary", "game-changing", "guaranteed", "10x".
- **Respect the accountant.** They are the user who decides whether the product survives.

## Boilerplate

**50 words**
Fatortak is an open-source business platform for MENA: invoicing, double-entry accounting, projects, inventory, HR and payroll in one Arabic-first system. It is self-hostable with Docker, licensed AGPL-3.0, and available as a managed cloud for teams that want support and backups.

**100 words**
Fatortak (فاتورتك) is the open-source business operating system for MENA SMBs. It combines VAT-ready invoicing, double-entry accounting, project profitability, inventory, payroll and attendance in one Arabic-first platform with full RTL support. Unlike closed SaaS tools, Fatortak can be self-hosted with Docker, audited under AGPL-3.0, and extended through a documented API. The commercial edition adds managed hosting, migration, priority support and a commercial license for teams that cannot use AGPL. It is built for agencies, contractors, distributors and accounting firms that have outgrown Excel but do not want a six-month ERP implementation.

**250 words**
Fatortak (فاتورتك, "your invoice") is an open-source business operating system built for how companies in the Middle East and North Africa actually work. It brings invoicing, purchases, double-entry accounting, project profitability, inventory, payroll and attendance into one Arabic-first platform with full RTL support and Arabic PDF output.

Most SMBs in the region run finance on a patchwork of Excel files, WhatsApp invoices and a cloud tool that was not designed for Arabic VAT workflows. The result is a month-end close that takes days, a profit number nobody trusts, and project costs reconstructed after the fact. Fatortak replaces that patchwork with one ledger: every invoice, expense, payment and cheque posts to the same books that generate the trial balance, P&L, balance sheet and cash-flow statement.

Fatortak is licensed AGPL-3.0 and can be self-hosted with Docker, so companies with data-residency or customization requirements can own the stack. The commercial edition adds managed cloud hosting, migration, priority support and a commercial license for organizations that cannot use AGPL.

It is built for marketing agencies, contractors, distributors, professional-services firms and accounting practices with 5–50 employees — companies that have outgrown spreadsheets but do not want a six-month ERP implementation. The roadmap is public, the code is auditable, and the community edition is free forever.

## Pricing architecture

**Current in-app pricing:** Starter 300 EGP/mo, Professional 600 EGP/mo, Enterprise 900 EGP/mo.

**Recommendation:** keep launch pricing for the first cohort, then move to value-based tiers. Do not compete on being the cheapest; compete on being the one that makes project margin visible.

| Tier | Price (recommended, after launch) | Who it is for | Includes |
| --- | --- | --- | --- |
| Community | Free (self-host) | Developers, cost-sensitive SMBs | Full product, AGPL, community support |
| Cloud Starter | 900 EGP/mo | 1 company, up to 3 users | Managed hosting, backups, updates, email support |
| Cloud Growth | 2,400 EGP/mo | 5–10 users, multi-branch | Everything + onboarding, priority support |
| Business | 4,900 EGP/mo | 10–25 users | Everything + migration, training, SLA |
| Enterprise | Custom | 25+ users, on-prem | Commercial license, SSO, audit, dedicated support |

**Rules:**
- Never discount the community edition; it is free.
- Grandfather early customers for 12 months, then migrate with notice.
- Charge for migration and training separately; they are real work.
- Publish that prices are in EGP and that international pricing is available on request.
