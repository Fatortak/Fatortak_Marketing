import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT_DIR = path.join(ROOT, "assets/screenshots");
const TEMPLATE = "file:///" + path.join(ROOT, ".social-card-v2.html").replace(/\\/g, "/");

const cards = [
  [
    "ui",
    "New UI",
    "The new interface.",
    "Same ledger.",
    "A light canvas, clear hierarchy and Arabic-first typography across reports, invoices and projects.",
    "New UI|Arabic + English|Dark mode|Open source",
    "screens-reports.png",
    "purple",
    "en",
  ],
  [
    "reports",
    "Reports",
    "13 reports.",
    "One ledger.",
    "A new reports hub for financial, receivables, sales, cash and tax reports. Every report exports to CSV or PDF.",
    "Reports|CSV + PDF|VAT|Accounting",
    "screens-reports.png",
    "green",
    "en",
  ],
  [
    "import",
    "Data import",
    "Bring your Excel data.",
    "Map. Validate. Import.",
    "Customers, suppliers and items from CSV or Excel, with Arabic header aliases and validation before anything is saved.",
    "Excel + CSV|Import|Validation|Migration",
    "screens-import.png",
    "amber",
    "en",
  ],
  [
    "platform",
    "Platform",
    "Every company.",
    "One console.",
    "Tenants, users, invoices, collections and activity across the whole installation in one platform console.",
    "Multi-tenant|Platform console|Users|Activity",
    "screens-platform.png",
    "cyan",
    "en",
  ],
  [
    "onboarding",
    "Getting started",
    "From zero",
    "to first invoice.",
    "A guided checklist covers company profile, chart of accounts, first customer, item, quotation and invoice. Demo data is one click away.",
    "Onboarding|Checklist|Demo data|Arabic",
    "screens-onboarding.png",
    "purple",
    "en",
  ],
  [
    "templates",
    "Invoices",
    "Six invoices.",
    "Your identity.",
    "Choose sales and purchase templates, set your logo and brand colour, and preview print and the public link before saving. Arabic and RTL included.",
    "Invoice templates|Branding|Arabic + RTL|Print",
    "screens-templates.png",
    "amber",
    "en",
  ],
  [
    "ui-ar",
    "واجهة جديدة",
    "واجهة جديدة.",
    "نفس الدفتر.",
    "خلفية فاتحة وتسلسل واضح وتنسيق عربي أولاً عبر التقارير والفواتير والمشاريع.",
    "واجهة جديدة|عربي + إنجليزي|الوضع الليلي|مفتوح المصدر",
    "screens-reports-ar.png",
    "purple",
    "ar",
  ],
  [
    "reports-ar",
    "تقارير",
    "13 تقريرًا.",
    "دفتر واحد.",
    "مركز تقارير جديد للمالية والعملاء والمبيعات والنقد والضرائب. كل تقرير يُصدَّر إلى CSV أو PDF.",
    "تقارير|CSV + PDF|ضريبة|محاسبة",
    "screens-reports-ar.png",
    "green",
    "ar",
  ],
  [
    "import-ar",
    "استيراد",
    "انقل بياناتك",
    "من إكسل.",
    "العملاء والموردون والأصناف من CSV أو Excel، مع ربط الأعمدة والأسماء العربية والتحقق قبل الحفظ.",
    "Excel + CSV|استيراد|تحقق|ترحيل",
    "screens-import.png",
    "amber",
    "ar",
  ],
  [
    "platform-ar",
    "المنصة",
    "كل شركة.",
    "لوحة واحدة.",
    "الشركات والمستخدمون والفواتير والتحصيل والنشاط لكل التثبيت في لوحة منصة واحدة.",
    "تعدد الشركات|لوحة المنصة|مستخدمون|نشاط",
    "screens-platform.png",
    "cyan",
    "ar",
  ],
  [
    "onboarding-ar",
    "البدء",
    "من الصفر",
    "إلى أول فاتورة.",
    "قائمة بدء مُوجّهة تغطي بيانات الشركة ودليل الحسابات وأول عميل وصنف وعرض سعر وفاتورة. وبيانات تجريبية بضغطة.",
    "بدء الاستخدام|قائمة مهام|بيانات تجريبية|عربي",
    "screens-onboarding.png",
    "purple",
    "ar",
  ],
  [
    "templates-ar",
    "الفواتير",
    "ستة قوالب.",
    "هويتك.",
    "اختر قالب المبيعات والمشتريات، وحدد شعارك ولون علامتك، وعاين الطباعة والرابط العام قبل الحفظ. بدعم العربية وRTL.",
    "قوالب فواتير|هوية|عربي + RTL|طباعة",
    "screens-templates.png",
    "amber",
    "ar",
  ],
];

function shot(card, index) {
  return new Promise((resolve) => {
    const [id, badge, l1, l2, sub, chips, screen, theme, lang] = card;
    const out = path.join(OUT_DIR, `social-v3-${String(index + 1).padStart(2, "0")}-${id}.png`);
    if (fs.existsSync(out) && fs.statSync(out).size > 20000) {
      resolve(out);
      return;
    }
    const params = new URLSearchParams({ badge, l1, l2, sub, chips, screen, theme, lang, url: `fatortak / ${screen.replace(/^screens-/, "").replace(/\.png$/, "")}` });
    const profile = path.join(os.tmpdir(), `fatortak-card-v3-${process.pid}-${index}`);
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--window-size=1200,630",
      "--virtual-time-budget=3000",
      `--user-data-dir=${profile}`,
      `--screenshot=${out}`,
      `${TEMPLATE}?${params.toString()}`,
    ];
    const child = spawn(CHROME, args, { windowsHide: true, stdio: "ignore" });
    const started = Date.now();
    const timer = setInterval(() => {
      if (fs.existsSync(out) && fs.statSync(out).size > 20000) {
        clearInterval(timer);
        setTimeout(() => {
          try { child.kill(); } catch {}
          resolve(out);
        }, 500);
      } else if (Date.now() - started > 25000) {
        clearInterval(timer);
        try { child.kill(); } catch {}
        resolve(null);
      }
    }, 500);
  });
}

const results = [];
for (let i = 0; i < cards.length; i += 1) {
  const file = await shot(cards[i], i);
  results.push({ file: file ? path.basename(file) : null, ok: Boolean(file), id: cards[i][0] });
  console.log(`${i + 1}/${cards.length} ${results[i].ok ? "ok" : "failed"} ${results[i].file || ""}`);
}
console.log(JSON.stringify({ generated: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results }, null, 2));
