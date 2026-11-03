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
const CONFIG = JSON.parse(fs.readFileSync(path.join(MARKETING_ROOT, "config.example.json"), "utf8"));
const INPUT = process.argv[2];
const OUTPUT = process.argv[3] || path.join(MARKETING_ROOT, "portal/data/portal-daily-10.json");
if (!INPUT) throw new Error("Usage: node build-daily-10.mjs <input-portal.json> [output.json]");

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
  },
  {
    key: "reports",
    title: "13 reports. One ledger.",
    core: "A new reports hub for financial, receivables, sales, cash and tax reports. Every report exports to CSV or PDF.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-02-reports.png",
  },
  {
    key: "import",
    title: "Bring your Excel data.",
    core: "Import customers, suppliers or items from CSV or Excel, with Arabic header aliases, column mapping and validation before anything is saved.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-03-import.png",
  },
  {
    key: "platform",
    title: "Every company. One console.",
    core: "Run multiple workspaces from one installation: tenants, users, invoices, collections and activity in one platform console.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-04-platform.png",
  },
  {
    key: "onboarding",
    title: "From zero to first invoice.",
    core: "A guided checklist covers company profile, chart of accounts, first customer, item, quotation and invoice. Demo data is one click away.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-05-onboarding.png",
  },
  {
    key: "templates",
    title: "Six invoices. Your identity.",
    core: "Choose sales and purchase templates, set your logo and brand colour, and preview print and the public link before saving. Arabic and RTL included.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-06-templates.png",
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
  },
  {
    key: "reports",
    title: "13 تقريرًا. دفتر واحد.",
    core: "مركز تقارير جديد للمالية والعملاء والمبيعات والنقد والضرائب. كل تقرير يُصدَّر إلى CSV أو PDF.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-08-reports-ar.png",
  },
  {
    key: "import",
    title: "انقل بياناتك من إكسل.",
    core: "استورد العملاء أو الموردين أو الأصناف من CSV أو Excel، مع ربط الأعمدة والأسماء العربية والتحقق قبل الحفظ.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-09-import-ar.png",
  },
  {
    key: "platform",
    title: "كل شركة. لوحة واحدة.",
    core: "أدر عدة مساحات عمل من تثبيت واحد: الشركات والمستخدمون والفواتير والتحصيل والنشاط في لوحة منصة واحدة.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-10-platform-ar.png",
  },
  {
    key: "onboarding",
    title: "من الصفر إلى أول فاتورة.",
    core: "قائمة بدء مُوجّهة تغطي بيانات الشركة ودليل الحسابات وأول عميل وصنف وعرض سعر وفاتورة. وبيانات تجريبية بضغطة.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-11-onboarding-ar.png",
  },
  {
    key: "templates",
    title: "ستة قوالب فواتير. هويتك.",
    core: "اختر قالب المبيعات والمشتريات، وحدد شعارك ولون علامتك، وعاين الطباعة والرابط العام قبل الحفظ. بدعم العربية وRTL.",
    pillar: "product",
    link: "{{site}}",
    media: "social-v3-12-templates-ar.png",
  },
];

const enThemes = [...NEW_THEMES_EN];
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
enThemes.push({ key: "commercial-0", title: firstLine(commercial[0]), core: commercial[0], pillar: "commercial", link: "{{site}}" });
enThemes.push({ key: "pricing", title: "Pricing", core: PRICING_EN, pillar: "commercial", link: "{{site}}" });

const arThemes = [...NEW_THEMES_AR];
for (let i = 0; i < 14; i += 1) {
  const feature = features[i];
  arThemes.push({ key: `feature-${i}`, title: firstLine(feature.ar), core: feature.ar, pillar: "arabic", link: "{{site}}" });
}
for (let i = 0; i < 9; i += 1) {
  const text = arabic[i];
  arThemes.push({ key: `arabic-${i}`, title: firstLine(text), core: text, pillar: "arabic", link: "{{site}}" });
}
arThemes.push({ key: "pricing", title: "الأسعار", core: PRICING_AR, pillar: "commercial", link: "{{site}}" });

if (enThemes.length !== 30 || arThemes.length !== 30) {
  throw new Error(`Theme count mismatch: en=${enThemes.length}, ar=${arThemes.length}`);
}

const EN_HOOKS = ["", "One system: ", "No spreadsheets: ", "For real numbers: ", "Built for MENA: "];
const AR_HOOKS = ["", "نظام واحد: ", "بدون إكسل: ", "للأرقام الحقيقية: ", "بالعربي: "];
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
const history = (Array.isArray(data.posts) ? data.posts : []).filter((post) => String(post.scheduledAt || "") < START);
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
for (let day = 0; day < 30; day += 1) {
  const date = new Date(start);
  date.setUTCDate(start.getUTCDate() + day);
  const dayIso = date.toISOString().slice(0, 10);
  const usedMedia = new Set();
  const variantIndex = Math.floor(day / 6);
  for (let slot = 0; slot < 10; slot += 1) {
    const language = LANGUAGES[slot];
    const themeIndex = (day * 5 + Math.floor(slot / 2)) % 30;
    const theme = language === "ar" ? arThemes[themeIndex] : enThemes[themeIndex];
    const id = `queue-${dayIso.replace(/-/g, "")}-${String(slot + 1).padStart(2, "0")}`;
    const rawContent = makeContent(theme, language, variantIndex);
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
      scheduledAt: `${dayIso}T${TIMES[slot]}:00`,
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
const missingMedia = posts.filter((post) => !post.mediaPublicUrl || !existing.has(post.mediaName));
if (missingMedia.length) throw new Error(`${missingMedia.length} posts have missing media`);
const byDay = {};
for (const post of posts) {
  const day = post.scheduledAt.slice(0, 10);
  byDay[day] = byDay[day] || { total: 0, en: 0, ar: 0 };
  byDay[day].total += 1;
  byDay[day][post.language] += 1;
}
const badDays = Object.entries(byDay).filter(([, value]) => value.total !== 10 || value.en !== 5 || value.ar !== 5);
if (badDays.length) throw new Error(`Day balance failed: ${JSON.stringify(badDays.slice(0, 3))}`);

data.posts = [...history, ...posts].sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
data.activity = Array.isArray(data.activity) ? data.activity : [];
data.activity.unshift({
  at: new Date().toISOString(),
  type: "queue",
  message: `Rebuilt queue: ${posts.length} posts, 10/day, 5 Arabic + 5 English. All short-form channels.`,
  postId: null,
});
data.activity = data.activity.slice(0, 200);
data.updatedAt = new Date().toISOString();
fs.writeFileSync(OUTPUT, `${JSON.stringify(data, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  output: OUTPUT,
  totalPosts: data.posts.length,
  newPosts: posts.length,
  history: history.length,
  days: Object.keys(byDay).length,
  first: posts[0]?.scheduledAt,
  last: posts[posts.length - 1]?.scheduledAt,
  languages: { en: posts.filter((post) => post.language === "en").length, ar: posts.filter((post) => post.language === "ar").length },
  channels: CHANNELS,
  pricing: pricingPosts.length,
  xMaxLength: Math.max(...xLengths),
  xAdjusted: adjustedForX,
  mediaUnique: new Set(posts.map((post) => post.mediaName)).size,
  dayBalance: badDays.length === 0,
}, null, 2));
