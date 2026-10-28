# SEO keyword map

This is a working map, not a promise of rankings. Search volumes change and most "monthly volume" numbers in SEO tools are estimates. Validate the priority keywords in Google Search Console, Ahrefs, Semrush or a free keyword tool before writing.

The strategy is narrow: own the intersection of **Arabic-first**, **accounting depth** and **open source/self-hosting**. Do not try to outrank QuickBooks or Odoo for broad English head terms in the first year.

## Page architecture

```text
/                                  Brand + category + pricing
/accounting-software-egypt         EN commercial pillar
/ar                                AR homepage
/ar/accounting-software            AR commercial pillar
/open-source-accounting            Developer / self-hoster pillar
/self-hosting                      Docs-intent, links to GitHub
/project-profitability             Agency/contractor pain pillar
/invoice-template-egypt            Lead magnet + template
/vat-invoice-guide-egypt           Informational guide
/payroll-software-egypt            HR/payroll commercial page
/compare/odoo-alternative          Comparison (honest, not attack)
/compare/quickbooks-alternative    Comparison (honest, not attack)
/blog/...                          Long-tail articles
```

Each page should have one primary keyword, 2–4 secondary keywords, a clear CTA and at least two internal links to product or docs pages.

## English keywords

| Priority | Keyword | Intent | Target page | Notes |
| --- | --- | --- | --- | --- |
| P0 | accounting software for small business Egypt | Commercial | `/accounting-software-egypt` | Local intent, high value, moderate competition |
| P0 | Arabic accounting software | Commercial | `/` and `/ar` | Differentiator; low volume but exact fit |
| P0 | open source accounting software | Commercial/informational | `/open-source-accounting` | Strong developer intent; compare with ERPNext/Odoo |
| P0 | self hosted invoicing software | Commercial | `/self-hosting` | Docker/self-host audience |
| P1 | invoicing software Egypt | Commercial | `/accounting-software-egypt` | Support with invoice template page |
| P1 | project profitability software | Commercial | `/project-profitability` | Agency/contractor high intent |
| P1 | VAT invoice template Egypt | Informational | `/invoice-template-egypt` | Lead magnet; do not give legal advice |
| P1 | payroll software Egypt | Commercial | `/payroll-software-egypt` | Payroll is a module, not a standalone product yet |
| P1 | Odoo alternative for small business | Commercial | `/compare/odoo-alternative` | Honest comparison; Odoo is more complete |
| P2 | QuickBooks alternative MENA | Commercial | `/compare/quickbooks-alternative` | Emphasize Arabic/RTL and self-hosting |
| P2 | ERP for small business MENA | Commercial | `/` | Broader category |
| P2 | multi-company accounting software | Commercial | `/accounting-software-egypt` | Feature-led |
| P2 | invoice OCR software | Commercial | `/` | Feature section, not a separate product |
| P2 | accounting software Saudi Arabia | Commercial | `/accounting-software-egypt` (or `/ar`) | High competition; localize carefully |
| P3 | ETA e-invoicing integration | Informational | `/blog/eta-einvoicing-status` | Be explicit: not implemented yet |
| P3 | ZATCA e-invoicing for SMEs | Informational | `/blog/zatca-status` | Same; capture demand without false claims |
| P3 | how to calculate project margin | Informational | `/blog/project-profitability-formula` | Top-of-funnel for project page |
| P3 | Excel to accounting software migration | Informational | `/blog/excel-to-accounting-migration` | Strong lead magnet |

## Arabic keywords

| Priority | Keyword | Intent | Target page |
| --- | --- | --- | --- |
| P0 | برنامج محاسبة | Commercial | `/ar` |
| P0 | برنامج فواتير | Commercial | `/ar` |
| P0 | برنامج محاسبة للشركات الصغيرة | Commercial | `/ar/accounting-software` |
| P0 | نظام محاسبة عربي | Commercial | `/ar` |
| P1 | برنامج حسابات ومخازن | Commercial | `/ar/accounting-software` |
| P1 | برنامج رواتب | Commercial | `/ar/payroll` |
| P1 | ربحية المشاريع | Informational/commercial | `/ar/project-profitability` |
| P1 | برنامج محاسبة مصري | Commercial | `/ar/accounting-software` |
| P1 | نموذج فاتورة ضريبية | Informational | `/ar/invoice-template` |
| P2 | بديل أودو | Commercial | `/ar/compare/odoo` |
| P2 | برنامج محاسبة سحابي | Commercial | `/ar` |
| P2 | إدارة الحسابات للشركات | Commercial | `/ar/accounting-software` |
| P2 | برنامج فواتير إلكترونية | Informational | `/ar/blog/einvoicing-status` (honest status) |
| P3 | كيفية حساب ربح المشروع | Informational | `/ar/blog/project-profitability` |
| P3 | ترحيل البيانات من Excel | Informational | `/ar/blog/excel-migration` |

Arabic search behavior includes transliteration and dialect. Add synonyms naturally in body copy: «برنامج حسابات»، «نظام فواتير»، «إدارة مالية»، «محاسبة الشركات». Do not keyword-stuff; write for a finance manager.

## Metadata

### Homepage (EN)

- **Title:** Fatortak — Open-source accounting and invoicing for MENA
- **Meta description:** Arabic-first invoicing, double-entry accounting, projects, inventory, HR and payroll. Self-host with Docker under AGPL-3.0, or use managed cloud.
- **H1:** Run your business in Arabic. Own your data.

### Homepage (AR)

- **Title:** فاتورتك — نظام محاسبة وفواتير مفتوح المصدر للشرق الأوسط
- **Meta description:** فواتير عربية، محاسبة بالقيد المزدوج، مشروعات ومخزون ورواتب في نظام واحد. استضافة ذاتية عبر Docker أو سحابة مُدارة.
- **H1:** أدر أعمالك بالعربية. وامتلك بياناتك.

### `/accounting-software-egypt`

- **Title:** Accounting software for small businesses in Egypt | Fatortak
- **Meta description:** An Arabic-first accounting system for Egyptian SMBs: VAT invoices, double-entry books, project profitability, inventory and payroll. Open source and self-hostable.
- **H1:** Accounting software built for Egyptian small businesses
- **Primary CTA:** Book a 20-minute demo
- **Secondary CTA:** Self-host the community edition

### `/open-source-accounting`

- **Title:** Open-source accounting software you can self-host | Fatortak
- **Meta description:** Audit the code, own the data. Fatortak is AGPL-3.0 invoicing, accounting, projects and payroll, with a Docker Compose stack and a commercial license option.
- **H1:** Open-source accounting without a feature hostage
- **Primary CTA:** Star on GitHub
- **Secondary CTA:** Docker quickstart

### `/project-profitability`

- **Title:** Project profitability software for agencies and contractors | Fatortak
- **Meta description:** Link invoices, purchases, expenses and payroll to a project. See revenue, cost and margin in one ledger, in Arabic or English.
- **H1:** Know which projects actually make money
- **Primary CTA:** See the project report
- **Secondary CTA:** Book a demo

### `/invoice-template-egypt`

- **Title:** Free VAT invoice template for Egypt (Excel + PDF) | Fatortak
- **Meta description:** A practical VAT invoice template for Egyptian small businesses, with the fields your accountant needs. Download it free, no email gate.
- **H1:** VAT invoice template for Egyptian businesses
- **Lead magnet:** Excel + printable PDF, no email required
- **Upsell:** Generate invoices automatically in Fatortak

### `/ar/accounting-software`

- **Title:** برنامج محاسبة للشركات الصغيرة في مصر | فاتورتك
- **Meta description:** نظام محاسبة عربي للشركات الصغيرة: فواتير ضريبية، قيد مزدوج، ربحية المشروعات، مخزون ورواتب. مفتوح المصدر وقابل للاستضافة الذاتية.
- **H1:** برنامج محاسبة مبني للشركات المصرية الصغيرة
- **CTA:** احجز عرضاً عملياً

## Content clusters

### Cluster 1 — Arabic-first accounting (commercial)

Pillar: `/accounting-software-egypt` + `/ar/accounting-software`

Supporting articles:

1. What Egyptian SMBs need from accounting software in 2026
2. Arabic invoice fields your accountant actually checks
3. VAT rounding in Egypt: a practical example
4. Chart of accounts for a small trading company
5. How to migrate opening balances without breaking the ledger
6. QuickBooks vs Zoho vs Fatortak for Arabic invoices (honest comparison)

Internal links: every article → pillar → demo CTA; pillar → invoice template + VAT guide.

### Cluster 2 — Project profitability (commercial)

Pillar: `/project-profitability`

Supporting articles:

1. The project profitability formula agencies get wrong
2. Should freelancer costs be direct costs or overhead?
3. Allocating payroll to projects: three defensible methods
4. Project margin vs company margin: why both matter
5. A project profitability template for contractors
6. Retainer profitability: the hidden cost of scope creep

### Cluster 3 — Open source and self-hosting (developer)

Pillar: `/open-source-accounting`

Supporting articles:

1. Self-hosting a .NET + React business app with Docker Compose
2. Multi-tenant data isolation in EF Core: what to check
3. AGPL for business software: a practical explainer
4. SQL Server on a small VPS: cost and tuning notes
5. Backup and restore for an accounting system (not just the database)
6. Why we do not have a public demo yet (and what we do instead)

### Cluster 4 — Move from Excel (lead generation)

Pillar: `/blog/excel-to-accounting-migration`

Supporting assets:

1. Excel to accounting migration checklist (download)
2. Opening balances worksheet
3. Customer and supplier import template
4. Chart of accounts template for MENA SMBs
5. Month-end close checklist

## 90-day publishing plan

| Week | Asset | Cluster | CTA |
| --- | --- | --- | --- |
| 1 | Homepage + pricing + `/open-source-accounting` | Brand | GitHub |
| 2 | `/accounting-software-egypt` + Arabic homepage | Arabic commercial | Demo |
| 3 | VAT invoice template (no gate) | Excel/lead gen | Download |
| 4 | "Project profitability formula" article | Project | Demo |
| 5 | `/project-profitability` page | Project | Demo |
| 6 | "ETA/ZATCA status" honest article | Trust | Demo |
| 7 | "Self-hosting with Docker" technical guide | Developer | GitHub |
| 8 | "Excel to accounting migration" guide | Lead gen | Checklist |
| 9 | Arabic accounting pillar | Arabic commercial | Demo |
| 10 | Comparison pages (Odoo, QuickBooks) | Commercial | Demo |
| 11 | Payroll page + article | Commercial | Demo |
| 12 | Case study from first pilot (with permission) | Trust | Demo |

Two assets per week maximum. A thin 500-word post published for the sake of a calendar is worse than one useful 1,500-word guide every two weeks.

## On-page checklist

- [ ] One H1, matching search intent, not the brand slogan alone.
- [ ] Primary keyword in the title, H1, first 100 words, one H2, and the URL.
- [ ] Meta description under ~160 characters, with a concrete benefit.
- [ ] At least three internal links: parent pillar, one sibling article, one product/docs page.
- [ ] At least one original asset: screenshot, diagram, template, calculation, or dataset.
- [ ] FAQ section with real questions from sales calls, marked up with `FAQPage` schema.
- [ ] `SoftwareApplication` schema on product pages, with EGP offers and `operatingSystem: Web`.
- [ ] `Article` schema on blog posts, with `author` and `datePublished`.
- [ ] `hreflang` between EN and AR pages (`en`, `ar`, `x-default`).
- [ ] Canonical URL on every page.
- [ ] Images compressed, descriptive alt text, no text baked into images unless necessary.
- [ ] Mobile check at 360px width, especially Arabic tables and invoice previews.
- [ ] No keyword stuffing, no AI-generated filler, no fake statistics.

## Technical SEO

- Submit `sitemap.xml` to Google Search Console and Bing Webmaster Tools.
- Add `robots.txt` that allows crawling and points to the sitemap.
- Use the live custom hostname (`fatortak.rabbeh.com`) rather than a GitHub Pages subpath for the commercial site. GitHub Pages can host an optional mirror, but a custom domain is better for brand searches and email trust.
- Ensure the Arabic pages are server-rendered or statically generated with `lang="ar"` and `dir="rtl"` in the HTML, not only set by JavaScript.
- Use clean URLs. No `?lang=ar` for indexable content; use `/ar/...`.
- Compress images to WebP/AVIF, but keep the invoice template PDFs as PDF.
- Measure Core Web Vitals in the field, not only Lighthouse.
- Avoid a JavaScript-only pricing table that hides prices from crawlers. Prices should be in the HTML.

## Backlink and distribution targets

Prioritize relevance over domain authority.

| Target | Angle | Effort |
| --- | --- | --- |
| GitHub topics and awesome lists (self-hosted, accounting, ERP) | Genuine open-source project | Low |
| Hacker News Show HN | Technical founder story | Medium |
| r/selfhosted, r/opensource | Docker + AGPL, no spam | Medium |
| Dev.to / Hashnode | Technical articles with canonical links | Low |
| Arabic tech communities and LinkedIn | Arabic-first angle | Medium |
| Accounting associations and chambers of commerce in Egypt | Workshop or checklist, not a link drop | High |
| Local startup directories and accelerators | Company profile | Low |
| Open-source directories (AlternativeTo, selfh.st, Awesome Selfhosted) | Product listing | Low |
| Podcasts for MENA founders/accountants | Founder interview | Medium |
| Guest posts on SME finance blogs | Practical guide, no thin content | High |

Do not buy links, do not use PBNs, and do not mass-submit to directories. A single mention in a relevant community beats 50 low-quality links.

## Measurement

Track weekly in the growth report:

- Impressions and average position for the P0/P1 keyword set (Search Console).
- Organic sessions to `/`, `/accounting-software-egypt`, `/ar`, `/project-profitability`.
- Demo requests and self-host clicks per page.
- GitHub referral traffic (repo traffic sources).
- Assisted conversions: landing page → GitHub → demo request.

Kill or rewrite a page if it has 0 clicks and < 100 impressions after 8 weeks. Do not keep publishing into a void.

## Claims guardrails

- Do not claim ETA/ZATCA compliance. Say "not implemented yet" and link the roadmap.
- Do not claim "100% accurate OCR". Say "draft invoice, human review required".
- Do not invent customer counts, ratings or testimonials.
- Do not use "best", "revolutionary" or "guaranteed" in titles.
- If you publish a comparison, verify the competitor's current pricing and features on the date of publication and add a "last verified" note.
