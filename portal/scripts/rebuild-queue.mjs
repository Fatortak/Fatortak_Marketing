import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const DATA_FILE = path.join(ROOT, "data/portal.json");
const SHOTS = path.resolve(ROOT, "../landing/assets/screenshots");
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

const mediaPool = [
  { file: "social-v2-01-vat.png", kw: ["vat", "tax", "invoice", "line"], pillar: "product", lang: "en" },
  { file: "social-v2-02-ai-chat.png", kw: ["ai", "assistant", "chat", "ask", "question", "conversation"], pillar: "product", lang: "en" },
  { file: "social-v2-03-ocr.png", kw: ["ocr", "capture", "supplier", "scan", "extract"], pillar: "product", lang: "en" },
  { file: "social-v2-04-dashboard.png", kw: ["dashboard", "business", "one place", "run", "all"], pillar: "product", lang: "en" },
  { file: "social-v2-05-profit.png", kw: ["profit", "margin", "project", "profitability"], pillar: "use-case", lang: "en" },
  { file: "social-v2-06-receivables.png", kw: ["receivable", "owes", "cash", "payment", "collect"], pillar: "tip", lang: "en" },
  { file: "social-v2-07-clients.png", kw: ["client", "customer", "crm", "balance"], pillar: "use-case", lang: "en" },
  { file: "social-v2-08-income.png", kw: ["income", "statement", "report", "balance sheet", "month-end"], pillar: "insight", lang: "en" },
  { file: "social-v2-09-operations.png", kw: ["payroll", "inventory", "cheque", "operation"], pillar: "product", lang: "en" },
  { file: "social-v2-10-open.png", kw: ["open source", "agpl", "code", "github", "fork", "audit"], pillar: "open-source", lang: "en" },
  { file: "social-v2-11-arabic.png", kw: ["عربي", "فاتورة", "عربية", "ضريبة", "تقارير"], pillar: "arabic", lang: "ar" },
  { file: "social-v2-12-pricing.png", kw: ["pricing", "price", "egp", "starter", "professional", "enterprise", "cost", "cloud"], pillar: "commercial", lang: "en" },
  { file: "social-v2-13-agencies.png", kw: ["agency", "agencies", "retainer", "creative", "marketing"], pillar: "use-case", lang: "en" },
  { file: "social-v2-14-retail.png", kw: ["retail", "e-commerce", "ecommerce", "store", "stock", "inventory"], pillar: "use-case", lang: "en" },
  { file: "social-v2-15-family.png", kw: ["family", "approval", "role", "team"], pillar: "use-case", lang: "en" },
  { file: "social-v2-16-monthend.png", kw: ["month-end", "close", "reconcil", "spreadsheet", "excel"], pillar: "insight", lang: "en" },
  { file: "social-v2-17-dataentry.png", kw: ["data entry", "entry", "copy-paste", "spreadsheet"], pillar: "insight", lang: "en" },
  { file: "social-v2-18-spreadsheet.png", kw: ["spreadsheet", "excel", "remove", "ledger"], pillar: "insight", lang: "en" },
  { file: "social-v2-19-cashflow.png", kw: ["cash flow", "cash", "receivable", "cheque", "liquidity"], pillar: "insight", lang: "en" },
  { file: "social-v2-20-vatline.png", kw: ["vat", "tax", "line", "invoice"], pillar: "product", lang: "en" },
  { file: "social-v2-21-aichart.png", kw: ["chart", "graph", "insight", "report", "ai"], pillar: "product", lang: "en" },
  { file: "social-v2-22-aibusiness.png", kw: ["ai", "ask", "business", "conversation"], pillar: "product", lang: "en" },
  { file: "social-v2-23-projects.png", kw: ["project", "cost", "margin", "profit"], pillar: "use-case", lang: "en" },
  { file: "social-v2-24-ocrreview.png", kw: ["ocr", "review", "extract", "supplier"], pillar: "product", lang: "en" },
  { file: "social-v2-25-cloud.png", kw: ["cloud", "hosting", "backup", "support", "managed"], pillar: "commercial", lang: "en" },
  { file: "social-v2-26-migration.png", kw: ["migration", "migrate", "onboarding", "data", "import"], pillar: "commercial", lang: "en" },
  { file: "social-v2-27-onprem.png", kw: ["on-prem", "sso", "audit", "enterprise", "security"], pillar: "commercial", lang: "en" },
  { file: "social-v2-28-arabicreports.png", kw: ["تقارير", "محاسبة", "ضريبة", "دخل", "ميزانية"], pillar: "arabic", lang: "ar" },
  { file: "social-v2-29-arabicprojects.png", kw: ["مشاريع", "ربح", "فواتير", "مصروفات"], pillar: "arabic", lang: "ar" },
  { file: "social-v2-30-arabicai.png", kw: ["ذكاء", "عربي", "فواتير", "تقارير", "مساعد"], pillar: "arabic", lang: "ar" },
  { file: "social-run.png", kw: ["run", "business", "dashboard", "one place"], pillar: "product", lang: "en" },
  { file: "social-vat.png", kw: ["vat", "tax", "invoice"], pillar: "product", lang: "en" },
  { file: "social-ocr.png", kw: ["ocr", "invoice", "capture"], pillar: "product", lang: "en" },
  { file: "social-ai.png", kw: ["ai", "assistant", "chat"], pillar: "product", lang: "en" },
  { file: "social-profit.png", kw: ["profit", "margin", "project"], pillar: "insight", lang: "en" },
  { file: "social-open.png", kw: ["open source", "agpl", "code"], pillar: "open-source", lang: "en" },
  { file: "social-payroll.png", kw: ["payroll", "inventory", "cheque"], pillar: "use-case", lang: "en" },
  { file: "social-arabic.png", kw: ["عربي", "فاتورة", "تقارير"], pillar: "arabic", lang: "ar" },
  { file: "social-receivables.png", kw: ["receivable", "cash", "owes"], pillar: "tip", lang: "en" }
];

const hookVariants = new Map([
  ["A finance stack should answer one question: what is actually happening in the business?", [
    "A finance stack should answer one question: what is actually happening in the business?",
    "Odoo can do anything. That is also why it takes months to launch.",
    "Paying for accounting software in USD gets expensive before you have USD revenue.",
    "Your best customer is also your slowest payer."
  ]],
  ["Most SMBs do not have an accounting problem. They have a data-entry problem.", [
    "Most SMBs do not have an accounting problem. They have a data-entry problem.",
    "The real bottleneck is data entry.",
    "Accounting is not the problem. Data entry is."
  ]],
  ["Your books should be boring. Predictable, reconciled, and ready before the deadline.", [
    "Your books should be boring. Predictable, reconciled, and ready before the deadline.",
    "Boring books are good books.",
    "Predictable books beat exciting books."
  ]],
  ["The best accounting feature is the one that removes a spreadsheet.", [
    "The best accounting feature is the one that removes a spreadsheet.",
    "The best feature is the one you stop needing.",
    "Remove the spreadsheet, keep the ledger."
  ]]
]);

const pricingTitle = "Fatortak pricing: Starter 300, Professional 600, Enterprise 900 EGP/month.";
const pricingContent = "Fatortak pricing: Starter 300 EGP/month, Professional 600 EGP/month, Enterprise 900 EGP/month.\n\nManaged hosting, backups, updates and support. The community edition is free to self-host.\n\nSee the plans → https://fatortak.rabbeh.com/#pricing";

const posts = data.posts
  .slice()
  .sort((a, b) => String(a.scheduledAt || a.id).localeCompare(String(b.scheduledAt || b.id)));

// Content edits: vary repeated hooks and replace the pricing post.
const hookCount = new Map();
for (const post of posts) {
  const original = post.title;
  if (hookVariants.has(original)) {
    const n = hookCount.get(original) || 0;
    hookCount.set(original, n + 1);
    const variants = hookVariants.get(original);
    const next = variants[Math.min(n, variants.length - 1)];
    if (next !== original) {
      post.title = next;
      const firstLine = String(post.content || "").split("\n")[0];
      if (firstLine === original) {
        post.content = next + String(post.content || "").slice(original.length);
      }
    }
  }
  if (/^Transparent pricing:/i.test(post.title)) {
    post.title = pricingTitle;
    post.content = pricingContent;
    post.pillar = "commercial";
  }
}

const li = posts.filter(p => (p.channels || []).includes("linkedin"));
const x = posts.filter(p => !(p.channels || []).includes("linkedin"));

const start = new Date(Date.UTC(2026, 10, 2));
const allXDays = new Set([6, 13, 20, 27]);
const usage = Object.fromEntries(mediaPool.map(m => [m.file, 0]));
const lastDay = Object.fromEntries(mediaPool.map(m => [m.file, -99]));
const usedOnDay = new Map();
const recentTitles = [];
const recentPillars = [];

function pickNext(queue, day) {
  const hasTitle = new Set(recentTitles);
  const hasPillar = new Set(recentPillars);
  return (
    queue.find(p => !hasTitle.has(p.title) && !hasPillar.has(p.pillar)) ||
    queue.find(p => !hasTitle.has(p.title)) ||
    queue.shift()
  );
}

function dayKey(d) {
  return d.toISOString().slice(0, 10);
}

function scoreImage(img, post, day, dayFiles) {
  if (img.lang === "ar" && post.language !== "ar") return -1e9;
  if (post.language === "ar" && img.lang !== "ar") return -1e9;
  if (dayFiles.has(img.file)) return -1e9;
  let score = 0;
  const text = `${post.title}\n${post.content}`.toLowerCase();
  for (const kw of img.kw) if (text.includes(kw.toLowerCase())) score += 4;
  if (img.pillar === post.pillar) score += 8;
  if (img.pillar === "open-source" && post.pillar !== "open-source") score -= 30;
  if (img.pillar === "commercial" && post.pillar !== "commercial") score -= 15;
  if (post.pillar === "insight" || post.pillar === "tip") {
    if (img.pillar === "insight" || img.pillar === "tip") score += 5;
    if (img.pillar === "product") score += 1;
  }
  if (day - lastDay[img.file] < 2) score -= 18;
  else if (day - lastDay[img.file] < 4) score -= 6;
  score -= usage[img.file] * 0.8;
  return score;
}

const scheduled = [];
let dayIndex = 0;
for (let d = 0; d < 30; d++) {
  const date = new Date(start);
  date.setUTCDate(start.getUTCDate() + d);
  const dayIso = dayKey(date);
  const allX = allXDays.has(d);
  const slots = allX
    ? [{ time: "09:00", group: x, slot: "x1" }, { time: "13:00", group: x, slot: "x2" }, { time: "19:00", group: x, slot: "x3" }]
    : [{ time: "09:00", group: x, slot: "x1" }, { time: "13:00", group: li, slot: "li" }, { time: "19:00", group: x, slot: "x2" }];

  const dayPosts = [];
  for (const item of slots) {
    if (!item.group.length) continue;
    const post = pickNext(item.group, d);
    if (!post) continue;
    const idx = item.group.indexOf(post);
    if (idx >= 0) item.group.splice(idx, 1);
    post.scheduledAt = `${dayIso}T${item.time}:00`;
    post.id = `queue-${dayIso.replace(/-/g, "")}-${item.slot}`;
    post.queueId = `${dayIso.replace(/-/g, "")}-${item.slot}`;
    post.utm = { ...(post.utm || {}), content: `${dayIso.replace(/-/g, "")}-${item.slot}` };
    post.status = "scheduled";
    post.results = [];
    post.publishedAt = null;
    post.lastAttemptAt = null;
    dayPosts.push(post);
    scheduled.push(post);
    recentTitles.push(post.title);
    recentPillars.push(post.pillar);
    while (recentTitles.length > 6) recentTitles.shift();
    while (recentPillars.length > 6) recentPillars.shift();
  }

  const dayFiles = new Set();
  for (const post of dayPosts) {
    const candidates = mediaPool
      .filter(m => m.lang === post.language)
      .map(m => ({ m, score: scoreImage(m, post, d, dayFiles) }))
      .sort((a, b) => b.score - a.score);
    const chosen = candidates[0]?.m || mediaPool.find(m => m.lang === "en");
    dayFiles.add(chosen.file);
    usage[chosen.file]++;
    lastDay[chosen.file] = d;
    const stem = chosen.file.replace(/\.png$/, "");
    post.mediaUrl = `/media/landing/${chosen.file}`;
    post.mediaPublicUrl = `https://fatortak.rabbeh.com/assets/screenshots/${chosen.file.replace(/\.png$/i, ".jpg")}`;
    post.mediaKind = "image";
    post.mediaAlt = String(post.title || "Fatortak").slice(0, 120);
    post.mediaName = chosen.file;
    post.mediaSource = `library:${stem}`;
  }
  dayIndex++;
}

data.posts = scheduled;
fs.writeFileSync(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");

const byDay = {};
for (const p of scheduled) byDay[p.scheduledAt.slice(0, 10)] = (byDay[p.scheduledAt.slice(0, 10)] || 0) + 1;
const usageList = Object.entries(usage).sort((a, b) => b[1] - a[1]);
const usedFiles = new Set(scheduled.map(p => p.mediaName));
const missing = [...usedFiles].filter(f => !fs.existsSync(path.join(SHOTS, f)));
const bad = [];
for (const p of scheduled) {
  const text = `${p.title}\n${p.content}`;
  if (/\bZATCA\b/i.test(text) || /\bETA\b/.test(text) || /100%/.test(text) || /\bguarantee/i.test(text) || /\bcertified\b/i.test(text) || /\bfake\b/i.test(text)) bad.push(p.id);
}
console.log(JSON.stringify({
  scheduled: scheduled.length,
  days: Object.keys(byDay).length,
  perDay: Object.values(byDay).filter(n => n !== 3).length === 0 ? "all 3" : byDay,
  first: scheduled[0]?.scheduledAt,
  last: scheduled[scheduled.length - 1]?.scheduledAt,
  imagesUsed: usedFiles.size,
  topImages: usageList.slice(0, 6),
  missingFiles: missing,
  bannedTerms: bad
}, null, 2));
