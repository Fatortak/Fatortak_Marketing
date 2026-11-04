import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  features,
  useCases,
  tips,
  oss,
  commercial,
  arabic,
} from "../../automation/src/content-bank.mjs";
import { renderText } from "../../automation/src/render.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MARKETING_ROOT = path.resolve(HERE, "../..");
const SCREENSHOTS = path.join(MARKETING_ROOT, "landing/assets/screenshots");
const VIDEOS = path.join(MARKETING_ROOT, "landing/assets/videos");
const CONFIG = JSON.parse(fs.readFileSync(path.join(MARKETING_ROOT, "config.example.json"), "utf8"));
const INPUT = process.argv[2];
const OUTPUT = process.argv[3] || path.join(MARKETING_ROOT, "portal/data/portal-daily-10.json");
const CUTOFF = process.argv[4] || "9999-12-31T23:59:59";
if (!INPUT) throw new Error("Usage: node build-daily-10.mjs <input-portal.json> [output.json] [cutoff-local-iso]");

const START = "2026-11-04T00:00:00";
const TIMES = ["08:00", "09:30", "11:00", "12:30", "14:00", "15:30", "17:00", "18:30", "20:00", "21:30"];
const LANGUAGES = ["en", "ar", "en", "ar", "en", "ar", "en", "ar", "en", "ar"];
const CHANNELS = ["x", "bluesky", "mastodon", "facebook", "instagram", "linkedin"];
const PRICING_EN = "Pricing: Starter 300 EGP/month, Professional 600 EGP/month, Enterprise 900 EGP/month. Managed hosting, backups and updates.";
const PRICING_AR = "الأسعار: Starter 300 جنيه/شهر، Professional 600 جنيه/شهر، Enterprise 900 جنيه/شهر. استضافة مُدارة ونسخ احتياطي وتحديثات ودعم.";

const firstLine = (value) => String(value || "").split("\n")[0].replace(/^#+\s*/, "").slice(0, 90);

const NEW_THEMES_EN = [
  {
    key: "ui",
    title: "The new interface.",
    core: "The new Fatortak interface uses a light canvas, clear hierarchy and Arabic-first typography across reports, invoices and projects.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-01-ui.png",
    video: "video-v4-01-ui.mp4",
    videoPoster: "video-v4-01-ui.jpg",
  },
  {
    key: "reports",
    title: "13 reports. One ledger.",
    core: "A new reports hub for financial, receivables, sales, cash and tax reports. Every report exports to CSV or PDF.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-02-reports.png",
    video: "video-v4-02-reports.mp4",
    videoPoster: "video-v4-02-reports.jpg",
  },
  {
    key: "import",
    title: "Bring your Excel data.",
    core: "Import customers, suppliers or items from CSV or Excel, with Arabic header aliases, column mapping and validation before anything is saved.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-03-import.png",
    video: "video-v4-03-import.mp4",
    videoPoster: "video-v4-03-import.jpg",
  },
  {
    key: "platform",
    title: "Every company. One console.",
    core: "Run multiple workspaces from one installation: tenants, users, invoices, collections and activity in one platform console.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-04-platform.png",
    video: "video-v4-04-platform.mp4",
    videoPoster: "video-v4-04-platform.jpg",
  },
  {
    key: "onboarding",
    title: "From zero to first invoice.",
    core: "A guided checklist covers company profile, chart of accounts, first customer, item, quotation and invoice. Demo data is one click away.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-05-onboarding.png",
    video: "video-v4-05-onboarding.mp4",
    videoPoster: "video-v4-05-onboarding.jpg",
  },
  {
    key: "templates",
    title: "Six invoices. Your identity.",
    core: "Choose sales and purchase templates, set your logo and brand colour, and preview print and the public link before saving. Arabic and RTL included.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-06-templates.png",
    video: "video-v4-06-templates.mp4",
    videoPoster: "video-v4-06-templates.jpg",
  },
  {
    key: "arabic-first",
    title: "Arabic-first, not translated later.",
    core: "RTL layouts, Arabic invoices and Arabic reports are designed together, not mirrored from an English product.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v2-11-arabic.png",
    video: "video-v4-07-arabic-first.mp4",
    videoPoster: "video-v4-07-arabic-first.jpg",
  },
];

const NEW_THEMES_AR = [
  {
    key: "ui",
    title: "واجهة جديدة.",
    core: "واجهة فاتورتك الجديدة بخلفية فاتحة وتسلسل واضح وتنسيق عربي أولاً عبر التقارير والفواتير والمشاريع.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-07-ui-ar.png",
    video: "video-v4-11-ui-ar.mp4",
    videoPoster: "video-v4-11-ui-ar.jpg",
  },
  {
    key: "reports",
    title: "13 تقريرًا. دفتر واحد.",
    core: "مركز تقارير جديد للمالية والعملاء والمبيعات والنقد والضرائب. كل تقرير يُصدَّر إلى CSV أو PDF.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-08-reports-ar.png",
    video: "video-v4-12-reports-ar.mp4",
    videoPoster: "video-v4-12-reports-ar.jpg",
  },
  {
    key: "import",
    title: "انقل بياناتك من إكسل.",
    core: "استورد العملاء أو الموردين أو الأصناف من CSV أو Excel، مع ربط الأعمدة والأسماء العربية والتحقق قبل الحفظ.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-09-import-ar.png",
    video: "video-v4-13-import-ar.mp4",
    videoPoster: "video-v4-13-import-ar.jpg",
  },
  {
    key: "platform",
    title: "كل شركة. لوحة واحدة.",
    core: "أدر عدة مساحات عمل من تثبيت واحد: الشركات والمستخدمون والفواتير والتحصيل والنشاط في لوحة منصة واحدة.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-10-platform-ar.png",
    video: "video-v4-14-platform-ar.mp4",
    videoPoster: "video-v4-14-platform-ar.jpg",
  },
  {
    key: "onboarding",
    title: "من الصفر إلى أول فاتورة.",
    core: "قائمة بدء مُوجّهة تغطي بيانات الشركة ودليل الحسابات وأول عميل وصنف وعرض سعر وفاتورة. وبيانات تجريبية بضغطة.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-11-onboarding-ar.png",
    video: "video-v4-15-onboarding-ar.mp4",
    videoPoster: "video-v4-15-onboarding-ar.jpg",
  },
  {
    key: "templates",
    title: "ستة قوالب فواتير. هويتك.",
    core: "اختر قالب المبيعات والمشتريات، وحدد شعارك ولون علامتك، وعاين الطباعة والرابط العام قبل الحفظ. بدعم العربية وRTL.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-12-templates-ar.png",
    video: "video-v4-16-templates-ar.mp4",
    videoPoster: "video-v4-16-templates-ar.jpg",
  },
  {
    key: "arabic-first",
    title: "عربي أولاً، لا ترجمة لاحقة.",
    core: "تخطيط RTL وفواتير وتقارير عربية مصممة معًا، لا نسخ معكوس من منتج إنجليزي.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v2-28-arabicreports.png",
    video: "video-v4-17-arabic-first-ar.mp4",
    videoPoster: "video-v4-17-arabic-first-ar.jpg",
  },
];

const VIDEO_COPY = {
  en: {
    ui: {
      title: "See the new interface.",
      core: "A calmer workspace, the same ledger. Reports, invoices and projects in one place.",
    },
    reports: {
      title: "13 reports. 30 seconds.",
      core: "Filter a report, export CSV or PDF, and trace every number to the same ledger.",
    },
    import: {
      title: "Your Excel file, mapped.",
      core: "Upload customers, suppliers or items, review the suggested columns, and validate before anything is saved.",
    },
    platform: {
      title: "Every company. One console.",
      core: "Tenants, users, invoices and collections across the installation in one view.",
    },
    onboarding: {
      title: "Zero to first invoice.",
      core: "A guided checklist for your company, accounts, customer, item and first invoice.",
    },
    templates: {
      title: "Six invoices. Your brand.",
      core: "Pick a template, set your logo and colour, preview print and the public link.",
    },
    "arabic-first": {
      title: "Arabic-first, not translated later.",
      core: "RTL invoices, reports and a properly shaped Arabic UI, designed together.",
    },
  },
  ar: {
    ui: {
      title: "شاهد الواجهة الجديدة.",
      core: "مساحة أهدأ ونفس الدفتر. التقارير والفواتير والمشاريع في مكان واحد.",
    },
    reports: {
      title: "13 تقريرًا في 30 ثانية.",
      core: "صفِّ التقرير وصدّره CSV أو PDF وتتبّع كل رقم إلى نفس الدفتر.",
    },
    import: {
      title: "ملف إكسل مربوط.",
      core: "ارفع العملاء أو الموردين أو الأصناف، راجع الأعمدة المقترحة، وتحقق قبل الحفظ.",
    },
    platform: {
      title: "كل شركة. لوحة واحدة.",
      core: "الشركات والمستخدمون والفواتير والتحصيل لكل التثبيت في نظرة واحدة.",
    },
    onboarding: {
      title: "من الصفر إلى أول فاتورة.",
      core: "قائمة بدء للشركة والحسابات والعميل والصنف وأول فاتورة.",
    },
    templates: {
      title: "ستة قوالب. هويتك.",
      core: "اختر القالب، حدد الشعار واللون، وعاين الطباعة والرابط العام.",
    },
    "arabic-first": {
      title: "عربي أولاً، لا ترجمة لاحقة.",
      core: "واجهة RTL وفواتير وتقارير عربية مصممة معًا.",
    },
  },
};

const ANGLES_EN = [
  {
    key: "angle-month-end",
    title: "Month-end close should not take a week.",
    core: "Invoices, payments, expenses and payroll post to the same ledger, so the trial balance and P&L are ready when the month ends.",
    pillar: "insight",
    link: "{{site}}",
    media: "income-statement.png",
  },
  {
    key: "angle-receivables",
    title: "Who owes you right now?",
    core: "A receivables view with invoice dates, partial payments and aging. Follow up before the cash gets tight.",
    pillar: "insight",
    link: "{{site}}",
    media: "social-v2-06-receivables.png",
  },
  {
    key: "angle-project-margin",
    title: "Project margin is a ledger number.",
    core: "Link invoices, expenses, purchases and payroll to the project. The margin comes from the same books, not a side spreadsheet.",
    pillar: "insight",
    link: "{{site}}",
    media: "project-profitability.png",
  },
  {
    key: "angle-invoice-language",
    title: "Invoice in the customer's language.",
    core: "Arabic and English invoices, with the same totals and VAT, reduce payment friction.",
    pillar: "tip",
    link: "{{site}}",
    media: "social-v2-01-vat.png",
  },
  {
    key: "angle-reconcile-weekly",
    title: "Reconcile weekly, not monthly.",
    core: "Thirty-day-old surprises are harder to fix. Match receipts and payments while the details are fresh.",
    pillar: "tip",
    link: "{{site}}",
    media: "social-v2-19-cashflow.png",
  },
  {
    key: "angle-excel-database",
    title: "Excel is not a database.",
    core: "A shared file breaks when two people edit it. One ledger with roles and an audit trail keeps the numbers consistent.",
    pillar: "insight",
    link: "{{site}}",
    media: "social-v2-18-spreadsheet.png",
  },
  {
    key: "angle-agencies",
    title: "Agencies: know client profit.",
    core: "Retainers, project fees, freelance costs and expenses in one place. See which client is profitable before the quarterly review.",
    pillar: "use-case",
    link: "{{site}}",
    media: "social-v2-13-agencies.png",
  },
  {
    key: "angle-retail",
    title: "Retail: stock and VAT together.",
    core: "Items, purchase costs, sales invoices and VAT in one system. Know the margin per SKU and per customer.",
    pillar: "use-case",
    link: "{{site}}",
    media: "social-v2-14-retail.png",
  },
  {
    key: "angle-contracting",
    title: "Contracting: variations and progress bills.",
    core: "Contract value, variations, project costs and progress invoices. Stop rebuilding project cost from WhatsApp threads.",
    pillar: "use-case",
    link: "{{site}}",
    media: "social-v2-23-projects.png",
  },
  {
    key: "angle-accounting-firms",
    title: "Accounting firms: one workspace per client.",
    core: "Separate books, consolidated access for your team, and reports from the same ledger. Less re-keying, more advisory work.",
    pillar: "use-case",
    link: "{{site}}",
    media: "social-v2-07-clients.png",
  },
  {
    key: "angle-payroll-ledger",
    title: "Payroll belongs in the same ledger.",
    core: "Salaries, deductions and attendance post to the books. Payroll reports and the P&L agree.",
    pillar: "insight",
    link: "{{site}}",
    media: "social-payroll.png",
  },
  {
    key: "angle-arabic-first",
    title: "Arabic-first, not translated later.",
    core: "RTL layouts, Arabic invoices and Arabic reports are designed together, not mirrored from an English product.",
    pillar: "insight",
    link: "{{site}}",
    media: "social-v2-11-arabic.png",
  },
];

const ANGLES_AR = [
  {
    key: "angle-month-end",
    title: "إغلاق الشهر لا يحتاج أسبوعًا.",
    core: "الفواتير والمدفوعات والمصروفات والرواتب ترحّل إلى نفس الدفتر، فيكون ميزان المراجعة وقائمة الأرباح جاهزين بنهاية الشهر.",
    pillar: "insight",
    link: "{{site}}",
    media: "income-statement.png",
  },
  {
    key: "angle-receivables",
    title: "من عليه المبلغ الآن؟",
    core: "نظرة على المستحقات بتواريخ الفواتير والمدفوعات الجزئية والأعمار. تابع قبل أن يضيق النقد.",
    pillar: "insight",
    link: "{{site}}",
    media: "social-v2-06-receivables.png",
  },
  {
    key: "angle-project-margin",
    title: "هامش المشروع رقم من الدفتر.",
    core: "اربط الفواتير والمصروفات والمشتريات والرواتب بالمشروع. الهامش يأتي من نفس الدفاتر لا من ملف جانبي.",
    pillar: "insight",
    link: "{{site}}",
    media: "project-profitability.png",
  },
  {
    key: "angle-invoice-language",
    title: "أصدر الفاتورة بلغة العميل.",
    core: "فواتير عربية وإنجليزية بنفس الإجماليات والضريبة، لتقليل احتكاك الدفع.",
    pillar: "tip",
    link: "{{site}}",
    media: "social-v2-01-vat.png",
  },
  {
    key: "angle-reconcile-weekly",
    title: "طابق الحسابات أسبوعيًا، لا شهريًا.",
    core: "المفاجآت بعد ثلاثين يومًا أصعب في الإصلاح. طابق المقبوضات والمدفوعات والتفاصيل طازجة.",
    pillar: "tip",
    link: "{{site}}",
    media: "social-v2-19-cashflow.png",
  },
  {
    key: "angle-excel-database",
    title: "إكسل ليس قاعدة بيانات.",
    core: "الملف المشترك يتعارض عند تعديل شخصين. دفتر واحد بأدوار وسجل تدقيق يحافظ على اتساق الأرقام.",
    pillar: "insight",
    link: "{{site}}",
    media: "social-v2-18-spreadsheet.png",
  },
  {
    key: "angle-agencies",
    title: "الوكالات: اعرف ربح كل عميل.",
    core: "الاشتراكات وأتعاب المشاريع وتكاليف المستقلين والمصروفات في مكان واحد. اعرف العميل المربح قبل المراجعة الربعية.",
    pillar: "use-case",
    link: "{{site}}",
    media: "social-v2-13-agencies.png",
  },
  {
    key: "angle-retail",
    title: "التجزئة: المخزون والضريبة معًا.",
    core: "الأصناف وتكاليف الشراء وفواتير البيع والضريبة في نظام واحد. اعرف الهامش لكل صنف ولكل عميل.",
    pillar: "use-case",
    link: "{{site}}",
    media: "social-v2-14-retail.png",
  },
  {
    key: "angle-contracting",
    title: "المقاولات: التغييرات والفواتير المرحلية.",
    core: "قيمة العقد والتغييرات وتكاليف المشروع والفواتير المرحلية. لا تعِد بناء تكلفة المشروع من محادثات واتساب.",
    pillar: "use-case",
    link: "{{site}}",
    media: "social-v2-23-projects.png",
  },
  {
    key: "angle-accounting-firms",
    title: "مكاتب المحاسبة: مساحة لكل عميل.",
    core: "دفاتر منفصلة ووصول موحّد لفريقك وتقارير من نفس الدفتر. إدخال أقل وعمل استشاري أكثر.",
    pillar: "use-case",
    link: "{{site}}",
    media: "social-v2-07-clients.png",
  },
  {
    key: "angle-payroll-ledger",
    title: "الرواتب جزء من نفس الدفتر.",
    core: "الرواتب والخصومات والحضور ترحّل إلى الدفاتر. تقارير الرواتب وقائمة الأرباح تتفقان.",
    pillar: "insight",
    link: "{{site}}",
    media: "social-payroll.png",
  },
  {
    key: "angle-arabic-first",
    title: "عربي أولاً، لا ترجمة لاحقة.",
    core: "تخطيط RTL وفواتير وتقارير عربية مصممة معًا، لا نسخ معكوس من منتج إنجليزي.",
    pillar: "insight",
    link: "{{site}}",
    media: "social-v2-28-arabicreports.png",
  },
];

const enThemes = [...ANGLES_EN];
for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
  const feature = features[i];
  enThemes.push({ key: `feature-${i}`, title: feature.title, core: feature.detail, pillar: "product", link: "{{site}}" });
}
for (const i of [0, 1, 2, 3, 4]) {
  const item = useCases[i];
  enThemes.push({ key: `use-${i}`, title: item.title, core: `${item.title}.\n\n${item.body}`, pillar: "use-case", link: "{{site}}", allowHook: false, useCtaVariants: true });
}
for (const i of [0, 1, 2, 3, 4]) {
  const tip = tips[i];
  enThemes.push({ key: `tip-${i}`, title: firstLine(tip), core: tip, pillar: "tip", link: "{{site}}" });
}
for (const i of [0, 1, 2]) {
  const item = oss[i];
  enThemes.push({ key: `oss-${i}`, title: firstLine(item), core: item, pillar: "open-source", link: "{{repo}}" });
}
enThemes.push({ key: "commercial-0", title: firstLine(commercial[0]), core: commercial[0], pillar: "commercial", link: "{{site}}", tags: ["offer"] });
enThemes.push({ key: "pricing", title: "Pricing", core: PRICING_EN, pillar: "commercial", link: "{{site}}", tags: ["offer"] });

const arThemes = [...ANGLES_AR];
for (let i = 0; i < 14; i += 1) {
  const feature = features[i];
  arThemes.push({ key: `feature-${i}`, title: firstLine(feature.ar), core: feature.ar, pillar: "arabic", link: "{{site}}" });
}
for (let i = 0; i < 9; i += 1) {
  const text = arabic[i];
  arThemes.push({ key: `arabic-${i}`, title: firstLine(text), core: text, pillar: "arabic", link: "{{site}}" });
}
arThemes.push({ key: "pricing", title: "الأسعار", core: PRICING_AR, pillar: "commercial", link: "{{site}}", tags: ["offer"] });

if (enThemes.length !== 36 || arThemes.length !== 36) {
  throw new Error(`Theme count mismatch: en=${enThemes.length}, ar=${arThemes.length}`);
}

const EN_HOOKS = ["", "One system: ", "No spreadsheets: ", "For real numbers: ", "Built for MENA: "];
const AR_HOOKS = ["", "نظام واحد: ", "بدون إكسل: ", "للأرقام الحقيقية: ", "بالعربي: "];
const PROMPTS_EN = [
  "Which one would save your team the most time?",
  "What would you fix first?",
  "How does your team handle this today?",
  "Would this work for your business?",
  "What is the hardest part of this for you?",
];
const PROMPTS_AR = [
  "أي واحدة ستوفر وقت فريقك أكثر؟",
  "ما أول شيء ستصلحه؟",
  "كيف يتعامل فريقك مع هذا اليوم؟",
  "هل يناسب هذا عملك؟",
  "ما أصعب جزء في هذا بالنسبة لك؟",
];

function withPrompt(content, language, index) {
  if (index % 5 !== 0) return content;
  const prompts = language === "ar" ? PROMPTS_AR : PROMPTS_EN;
  return `${content}\n\n${prompts[Math.floor(index / 5) % prompts.length]}`;
}
const CTA_VARIANTS = ["{{site}}", "{{repo}}", "{{demo}}", "{{site}}", "{{repo}}"];
const USE_CASE_CTAS = [
  "https://fatortak.rabbeh.com/",
  "https://github.com/Fatortak/Fatortak_Software",
  "https://fatortak.rabbeh.com/",
  "https://github.com/Fatortak/Fatortak_Software",
  "https://fatortak.rabbeh.com/",
];

const PILLAR_FILES = {
  product: [
    "social-v2-01-vat.png", "social-v2-02-ai-chat.png", "social-v2-03-ocr.png", "social-v2-04-dashboard.png",
    "social-v2-09-operations.png", "social-v2-20-vatline.png", "social-v2-21-aichart.png", "social-v2-22-aibusiness.png",
    "social-v2-24-ocrreview.png", "social-run.png", "social-ai.png", "social-ocr.png", "dashboard.png", "ai-chat.png", "ocr-invoice.png",
  ],
  insight: [
    "social-v2-05-profit.png", "social-v2-08-income.png", "social-v2-16-monthend.png", "social-v2-17-dataentry.png",
    "social-v2-18-spreadsheet.png", "social-v2-19-cashflow.png", "social-profit.png", "social-receivables.png",
    "project-profitability.png", "income-statement.png", "ai-chat-receivables.png",
  ],
  "open-source": ["social-v2-10-open.png", "social-open.png"],
  "use-case": [
    "social-v2-13-agencies.png", "social-v2-14-retail.png", "social-v2-15-family.png", "social-v2-23-projects.png",
    "social-payroll.png", "projects.png", "clients.png",
  ],
  commercial: ["social-v2-12-pricing.png", "social-v2-25-cloud.png", "social-v2-26-migration.png", "social-v2-27-onprem.png", "social-vat.png"],
  tip: ["social-v2-06-receivables.png", "social-v2-19-cashflow.png", "social-receivables.png", "ai-chat-receivables.png"],
  arabic: [
    "social-v2-11-arabic.png", "social-v2-28-arabicreports.png", "social-v2-29-arabicprojects.png", "social-v2-30-arabicai.png",
    "social-arabic.png", "dashboard.png", "income-statement.png", "projects.png", "ai-chat.png", "clients.png", "sell-invoices.png", "project-profitability.png",
  ],
};

const existing = new Set(fs.readdirSync(SCREENSHOTS).filter((file) => file.endsWith(".png")));
const videoExisting = new Set(
  fs.existsSync(VIDEOS)
    ? fs.readdirSync(VIDEOS).filter((file) => /\.(mp4|jpe?g|png)$/i.test(file))
    : []
);
function mediaFor(language, pillar, used, offset) {
  const preferred = (PILLAR_FILES[pillar] || []).filter((file) => existing.has(file));
  const languagePool = language === "ar"
    ? [...new Set([...PILLAR_FILES.arabic, ...preferred])]
    : [...existing];
  const candidates = (preferred.length ? preferred : languagePool).filter((file) => existing.has(file));
  const available = candidates.filter((file) => !used.has(file));
  const pool = available.length ? available : candidates.length ? candidates : [...existing];
  const file = pool[offset % pool.length];
  used.add(file);
  return file;
}

let data;
try {
  data = JSON.parse(fs.readFileSync(INPUT, "utf8"));
} catch (error) {
  throw new Error(`Cannot read portal data at ${INPUT}: ${error.message}`);
}
const history = (Array.isArray(data.posts) ? data.posts : []).filter(
  (post) => String(post.scheduledAt || "") < START || String(post.scheduledAt || "") <= CUTOFF
);
const usedTitles = new Set(history.map((post) => post.title));
const posts = [];
const xLengths = [];
let adjustedForX = 0;

function uniqueTitle(base) {
  let title = String(base || "Untitled").slice(0, 90);
  if (!usedTitles.has(title)) {
    usedTitles.add(title);
    return title;
  }
  let n = 2;
  while (usedTitles.has(`${title} · ${n}`)) n += 1;
  title = `${title} · ${n}`;
  usedTitles.add(title);
  return title;
}

function makeContent(theme, language, variantIndex) {
  const hooks = language === "ar" ? AR_HOOKS : EN_HOOKS;
  const hook = theme.allowHook === false ? "" : hooks[variantIndex];
  const cta = theme.useCtaVariants ? USE_CASE_CTAS[variantIndex] : theme.link;
  let content = `${hook}${theme.core}`.trim();
  if (cta) content = `${content}\n\n${cta}`;
  return content;
}

function fitForX(content, id) {
  let candidate = content;
  try {
    const rendered = renderText(candidate, { channel: "x", links: CONFIG.links, utm: { campaign: "daily-10", content: id } });
    if (rendered.length <= 280) return { content: candidate, length: rendered.length };
  } catch {
    // fall through with a conservative length check
  }
  const withoutCta = candidate.split("\n\n").slice(0, -1).join("\n\n").trim();
  candidate = withoutCta || candidate;
  try {
    const rendered = renderText(candidate, { channel: "x", links: CONFIG.links, utm: { campaign: "daily-10", content: id } });
    if (rendered.length <= 280) return { content: candidate, length: rendered.length, adjusted: true };
  } catch {
    // fall through
  }
  const limit = Math.max(120, 240 - String(candidate.split("\n")[0] || "").length);
  candidate = `${candidate.slice(0, limit)}…`;
  let length = candidate.length;
  try {
    length = renderText(candidate, { channel: "x", links: CONFIG.links, utm: { campaign: "daily-10", content: id } }).length;
  } catch {}
  return { content: candidate, length, adjusted: true };
}

const start = new Date(Date.UTC(2026, 10, 4));
let videoCursor = 0;
for (let day = 0; day < 30; day += 1) {
  const date = new Date(start);
  date.setUTCDate(start.getUTCDate() + day);
  const dayIso = date.toISOString().slice(0, 10);
  const usedMedia = new Set();
  const variantIndex = Math.floor(day / 6);
  for (let slot = 0; slot < 10; slot += 1) {
    const language = LANGUAGES[slot];
    const languageThemes = language === "ar" ? arThemes : enThemes;
    const themeIndex = (day * 5 + Math.floor(slot / 2)) % languageThemes.length;
    const theme = languageThemes[themeIndex];
    const scheduledAt = `${dayIso}T${TIMES[slot]}:00`;
    if (scheduledAt <= CUTOFF) continue;
    const id = `queue-${dayIso.replace(/-/g, "")}-${String(slot + 1).padStart(2, "0")}`;
    const rawContent = withPrompt(makeContent(theme, language, variantIndex), language, posts.length);
    const fitted = fitForX(rawContent, id);
    if (fitted.adjusted) adjustedForX += 1;
    xLengths.push(fitted.length);
    const title = uniqueTitle(firstLine(rawContent));
    let mediaFile;
    if (theme.media && existing.has(theme.media) && !usedMedia.has(theme.media)) {
      mediaFile = theme.media;
      usedMedia.add(mediaFile);
    } else {
      mediaFile = mediaFor(language, theme.pillar, usedMedia, day * 7 + slot * 3);
    }
    const mediaBase = mediaFile.replace(/\.png$/i, "");
    posts.push({
      id,
      queueId: id,
      source: "queue",
      title,
      content: fitted.content,
      channels: CHANNELS,
      language,
      pillar: theme.pillar,
      tags: [...(theme.tags || [])],
      scheduledAt,
      status: "scheduled",
      mediaUrl: `/portal/index.php/media/landing/${mediaFile}`,
      mediaPublicUrl: `https://fatortak.rabbeh.com/assets/screenshots/${mediaBase}.jpg`,
      mediaKind: "image",
      mediaAlt: title,
      mediaName: mediaFile,
      mediaSource: `library:${mediaBase}`,
      utm: { campaign: "daily-10", content: id },
      notes: "",
      results: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: null,
      lastAttemptAt: null,
    });
  }

  const videoThemeIndex = videoCursor;
  videoCursor = (videoCursor + 1) % 7;
  const videoSlots = [
    { language: "en", theme: NEW_THEMES_EN[videoThemeIndex], time: "10:15", suffix: "v1" },
    { language: "ar", theme: NEW_THEMES_AR[videoThemeIndex], time: "16:15", suffix: "v2" },
  ];
  for (const slot of videoSlots) {
    const { language, theme, time, suffix } = slot;
    const scheduledAt = `${dayIso}T${time}:00`;
    if (scheduledAt <= CUTOFF) continue;
    const id = `queue-${dayIso.replace(/-/g, "")}-${suffix}`;
    const videoTheme = { ...theme, ...(VIDEO_COPY[language]?.[theme.key] || {}) };
    const rawContent = withPrompt(makeContent(videoTheme, language, variantIndex), language, posts.length);
    const fitted = fitForX(rawContent, id);
    if (fitted.adjusted) adjustedForX += 1;
    xLengths.push(fitted.length);
    const title = uniqueTitle(firstLine(rawContent));
    const videoFile = theme.video;
    const posterFile = theme.videoPoster;
    const videoBase = videoFile.replace(/\.mp4$/i, "");
    const videoUrl = `https://fatortak.rabbeh.com/assets/videos/${videoFile}`;
    const posterUrl = `https://fatortak.rabbeh.com/assets/videos/${posterFile}`;
    posts.push({
      id,
      queueId: id,
      source: "queue",
      title,
      content: fitted.content,
      channels: CHANNELS,
      language,
      pillar: "product",
      tags: [...new Set(["priority", "launch", ...(theme.tags || [])])],
      scheduledAt,
      status: "scheduled",
      mediaUrl: videoUrl,
      mediaPublicUrl: videoUrl,
      mediaKind: "video",
      mediaAlt: title,
      mediaName: videoFile,
      mediaSource: `library:${videoBase}`,
      posterUrl,
      posterPublicUrl: posterUrl,
      posterName: posterFile,
      utm: { campaign: "daily-10-video", content: id },
      notes: "",
      results: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: null,
      lastAttemptAt: null,
    });
  }
}

const banned = /\bZATCA\b|\bETA\b|100%|\bguarantee|\bcertified\b|\bfake\b|testimonial|trusted by|#1|best in/i;
const bannedHits = posts.filter((post) => banned.test(`${post.title}\n${post.content}`));
if (bannedHits.length) {
  throw new Error(`Banned terms found in ${bannedHits.length} posts: ${bannedHits.slice(0, 3).map((post) => post.id).join(", ")}`);
}
const pricingPosts = posts.filter((post) => /Starter 300/.test(post.content));
if (!pricingPosts.some((post) => post.language === "en") || !pricingPosts.some((post) => post.language === "ar")) {
  throw new Error("Pricing posts are missing");
}
const missingMedia = posts.filter((post) => {
  if (post.mediaKind === "video") {
    return (
      !post.mediaPublicUrl ||
      !videoExisting.has(post.mediaName) ||
      !post.posterName ||
      !videoExisting.has(post.posterName)
    );
  }
  return !post.mediaPublicUrl || !existing.has(post.mediaName);
});
if (missingMedia.length) throw new Error(`${missingMedia.length} posts have missing media`);
const byDay = {};
for (const post of posts) {
  const day = post.scheduledAt.slice(0, 10);
  byDay[day] = byDay[day] || { total: 0, en: 0, ar: 0, video: 0 };
  byDay[day].total += 1;
  byDay[day][post.language] += 1;
  if (post.mediaKind === "video") byDay[day].video += 1;
}
const today = CUTOFF.slice(0, 10);
const badDays = Object.entries(byDay).filter(([day, value]) => {
  if (day === today) return value.total > 12 || value.en > 6 || value.ar > 6 || value.video > 2;
  return value.total !== 12 || value.en !== 6 || value.ar !== 6 || value.video !== 2;
});
if (badDays.length) throw new Error(`Day balance failed: ${JSON.stringify(badDays.slice(0, 3))}`);
const scheduleKeys = [...history, ...posts].map((post) => post.scheduledAt);
const duplicateSlots = scheduleKeys.filter((slot, index) => scheduleKeys.indexOf(slot) !== index);
if (duplicateSlots.length) throw new Error(`Duplicate scheduled slots: ${[...new Set(duplicateSlots)].slice(0, 5).join(", ")}`);

data.settings = data.settings || {};
data.settings.channelRules = {
  ...(data.settings.channelRules || {}),
  facebook: { ...(data.settings.channelRules?.facebook || {}), dailyCap: 2 },
  instagram: {
    ...(data.settings.channelRules?.instagram || {}),
    dailyCap: 2,
    linkInBio: true,
    hashtags: "#Fatortak #Accounting #Invoicing #ERP",
  },
  linkedin: {
    ...(data.settings.channelRules?.linkedin || {}),
    dailyCap: 1,
    hashtags: "#Fatortak #Accounting #ERP #MENA",
  },
  x: { ...(data.settings.channelRules?.x || {}), dailyCap: 6 },
  bluesky: { ...(data.settings.channelRules?.bluesky || {}), dailyCap: 6 },
  mastodon: { ...(data.settings.channelRules?.mastodon || {}), dailyCap: 4 },
};

data.posts = [...history, ...posts].sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
data.activity = Array.isArray(data.activity) ? data.activity : [];
data.activity.unshift({
  at: new Date().toISOString(),
  type: "queue",
  message: `Rebuilt queue: ${posts.length} posts, 12/day, 6 Arabic + 6 English, including 2 videos/day. All short-form channels.`,
  postId: null,
});
data.activity = data.activity.slice(0, 200);
data.updatedAt = new Date().toISOString();
fs.writeFileSync(OUTPUT, `${JSON.stringify(data, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  output: OUTPUT,
  cutoff: CUTOFF,
  totalPosts: data.posts.length,
  newPosts: posts.length,
  history: history.length,
  days: Object.keys(byDay).length,
  first: posts.map((post) => post.scheduledAt).sort()[0],
  last: posts.map((post) => post.scheduledAt).sort().at(-1),
  languages: { en: posts.filter((post) => post.language === "en").length, ar: posts.filter((post) => post.language === "ar").length },
  channels: CHANNELS,
  pricing: pricingPosts.length,
  xMaxLength: Math.max(...xLengths),
  xAdjusted: adjustedForX,
  mediaUnique: new Set(posts.map((post) => post.mediaName)).size,
  videoPosts: posts.filter((post) => post.mediaKind === "video").length,
  videosUnique: new Set(
    posts.filter((post) => post.mediaKind === "video").map((post) => post.mediaName)
  ).size,
  dayBalance: badDays.length === 0,
}, null, 2));
