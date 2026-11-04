import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  MARKETING_ROOT,
  REPORTS_DIR,
  loadConfig,
  env,
  readJson,
  writeJson,
} from "../automation/src/config.mjs";
import { loadQueue, loadState, queueStats } from "../automation/src/queue.mjs";
import { renderText } from "../automation/src/render.mjs";
import {
  LIMITS,
  publishToChannel,
  connectionState,
  channelMode,
  testConnection,
  oauth1Header,
} from "./adapters.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.PORTAL_DATA_DIR ? path.resolve(process.env.PORTAL_DATA_DIR) : path.join(HERE, "data");
const DATA_FILE = path.join(DATA_DIR, "portal.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const PUBLIC_DIR = process.env.PORTAL_PUBLIC_DIR ? path.resolve(process.env.PORTAL_PUBLIC_DIR) : path.join(HERE, "public");
const MEDIA_DIR = path.join(DATA_DIR, "media");
const LANDING_ASSETS = path.join(MARKETING_ROOT, "landing", "assets");
const SCREENSHOTS_DIR = process.env.PORTAL_SCREENSHOTS_DIR
  ? path.resolve(process.env.PORTAL_SCREENSHOTS_DIR)
  : path.join(LANDING_ASSETS, "screenshots");
const QUEUE_FILE = path.join(MARKETING_ROOT, "content", "queue.json");
fs.mkdirSync(MEDIA_DIR, { recursive: true });
function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv(path.join(MARKETING_ROOT, "automation", ".env"));
loadDotEnv(process.env.PORTAL_ENV_FILE ? path.resolve(process.env.PORTAL_ENV_FILE) : path.join(HERE, ".env"));

const HOST = process.env.PORTAL_HOST || "127.0.0.1";
const PORT = Number(process.env.PORTAL_PORT || 4180);
const ADMIN_TOKEN = process.env.PORTAL_ADMIN_TOKEN || "";
const AUTO_PUBLISH = process.env.PORTAL_AUTO_PUBLISH === "true";
const LIVE = process.env.MARKETING_LIVE === "true";

const CHANNEL_DEFS = [
  { key: "linkedin", label: "LinkedIn", profileKey: "linkedin", slot: "linkedin" },
  { key: "x", label: "X", profileKey: "", slot: "x" },
  { key: "facebook", label: "Facebook", profileKey: "facebook", slot: "facebook" },
  { key: "instagram", label: "Instagram", profileKey: "instagram", slot: "instagram" },
  { key: "tiktok", label: "TikTok", profileKey: "tiktok", slot: "tiktok" },
  { key: "bluesky", label: "Bluesky", profileKey: "", slot: "bluesky" },
  { key: "mastodon", label: "Mastodon", profileKey: "", slot: "mastodon" },
  { key: "threads", label: "Threads", profileKey: "", slot: "threads" },
  { key: "youtube", label: "YouTube", profileKey: "", slot: "youtube" },
  { key: "telegram", label: "Telegram", profileKey: "", slot: "telegram" },
  { key: "discord", label: "Discord", profileKey: "", slot: "discord" },
  { key: "devto", label: "Dev.to", profileKey: "", slot: "devto" },
  { key: "reddit", label: "Reddit", profileKey: "", slot: "reddit" },
  { key: "hackernews", label: "Hacker News", profileKey: "", slot: "hackernews" },
  { key: "producthunt", label: "Product Hunt", profileKey: "", slot: "producthunt" },
  { key: "whatsapp", label: "WhatsApp", profileKey: "", slot: "whatsapp" },
  { key: "github", label: "GitHub", profileKey: "", slot: "github" },
];

const RESTRICTED_REASONS = {
  tiktok: "Content Posting API requires a developer app audit and a video asset.",
  youtube: "Requires OAuth, a video asset and API quota/audit.",
  reddit: "Monitoring only. Unattended self-promotion gets accounts banned.",
  hackernews: "No posting API. Automation is against community norms.",
  producthunt: "No public launch-posting API.",
  whatsapp: "Opt-in template approval only; not a broadcast channel.",
  github: "Repository monitoring only.",
};

const MONITORING = new Set(["github", "reddit", "hackernews", "producthunt"]);

const CREDENTIAL_KEYS = {
  x: ["X_ACCESS_TOKEN", "X_API_KEY", "X_API_SECRET", "X_OAUTH1_ACCESS_TOKEN", "X_OAUTH1_ACCESS_TOKEN_SECRET"],
  linkedin: ["LINKEDIN_ACCESS_TOKEN", "LINKEDIN_AUTHOR_URN", "LINKEDIN_VERSION"],
  facebook: ["FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN"],
  instagram: ["INSTAGRAM_USER_ID", "INSTAGRAM_ACCESS_TOKEN"],
  threads: ["THREADS_USER_ID", "THREADS_ACCESS_TOKEN"],
  bluesky: ["BLUESKY_HANDLE", "BLUESKY_APP_PASSWORD", "BLUESKY_SERVICE"],
  mastodon: ["MASTODON_INSTANCE", "MASTODON_ACCESS_TOKEN", "MASTODON_ACCOUNT"],
  telegram: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
  discord: ["DISCORD_WEBHOOK_URL"],
  devto: ["DEVTO_API_KEY"],
};

const CHANNEL_SETUP = {
  linkedin: {
    docs: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api",
    console: "https://www.linkedin.com/developers/apps",
    media: "image",
    note: "Create a LinkedIn app, verify the Fatortak company page, request w_organization_social and r_organization_admin, then paste the organization token and URN.",
  },
  x: {
    docs: "https://docs.x.com/x-api/posts/create-post",
    console: "https://developer.x.com/en/portal/dashboard",
    media: "image",
    note: "Create an X app with Read and write, then paste the OAuth 1.0a consumer key/secret and access token/secret. An OAuth 2.0 user token also works for text posts. Add API credits before live posting.",
  },
  facebook: {
    docs: "https://developers.facebook.com/docs/pages-api/posts",
    console: "https://developers.facebook.com/apps/",
    media: "image/video",
    note: "Create a Meta app, add the Pages API, request pages_manage_posts and read_insights, then generate a Page access token.",
  },
  instagram: {
    docs: "https://developers.facebook.com/docs/instagram-platform/content-publishing",
    console: "https://developers.facebook.com/apps/",
    media: "public-url",
    note: "Convert the Instagram account to Business, link it to the Fatortak Page, request instagram_content_publish. Media must be a public https URL.",
  },
  threads: {
    docs: "https://developers.facebook.com/docs/threads",
    console: "https://developers.facebook.com/apps/",
    media: "public-url",
    note: "Create a Threads app, request threads_content_publish, then paste the Threads user ID and token. Media must be a public https URL.",
  },
  bluesky: {
    docs: "https://docs.bsky.app/docs/advanced-guides/posts",
    console: "https://bsky.app/settings/app-passwords",
    media: "image",
    note: "Create an app password in Bluesky settings. Use the handle, not the email.",
  },
  mastodon: {
    docs: "https://docs.joinmastodon.org/methods/statuses/",
    console: "https://mastodon.social/settings/applications",
    media: "image/video",
    note: "Create an application token with write:statuses and write:media.",
  },
  telegram: {
    docs: "https://core.telegram.org/bots/api",
    console: "https://t.me/BotFather",
    media: "image/video",
    note: "Create a bot with BotFather, add it to the channel as an administrator, then use the channel ID (starts with -100).",
  },
  discord: {
    docs: "https://discord.com/developers/docs/resources/webhook",
    console: "https://support.discord.com/hc/en-us/articles/228383668",
    media: "image/video",
    note: "Create a channel webhook and paste the webhook URL.",
  },
  devto: {
    docs: "https://developers.forem.com/api/v1",
    console: "https://dev.to/settings/extensions",
    media: "public-url",
    note: "Create a DEV Community API key. The article cover image must be a public https URL.",
  },
  tiktok: {
    docs: "https://developers.tiktok.com/doc/content-posting-api-get-started",
    console: "https://developers.tiktok.com/",
    media: "video",
    note: "TikTok requires an approved Content Posting API app and a video asset. The portal blocks posting until the app passes audit.",
  },
  youtube: {
    docs: "https://developers.google.com/youtube/v3/docs/videos/insert",
    console: "https://console.cloud.google.com/apis/credentials",
    media: "video",
    note: "YouTube requires Google OAuth, a video asset and API quota/audit. It is not a text or image feed.",
  },
  whatsapp: {
    docs: "https://developers.facebook.com/docs/whatsapp",
    console: "https://business.facebook.com/",
    media: "image/video",
    note: "WhatsApp Business is opt-in template messaging, not a broadcast channel.",
  },
  reddit: {
    docs: "https://www.reddit.com/dev/api/",
    console: "https://www.reddit.com/prefs/apps",
    media: "none",
    note: "Monitoring only. Unattended self-promotion violates most subreddit rules and gets accounts banned.",
  },
  hackernews: {
    docs: "https://github.com/HackerNews/API",
    console: "https://news.ycombinator.com/",
    media: "none",
    note: "No posting API. Automation is against community norms.",
  },
  producthunt: {
    docs: "https://api.producthunt.com/v2/docs",
    console: "https://www.producthunt.com/",
    media: "image",
    note: "No public launch-posting API. Monitoring only.",
  },
  github: {
    docs: "https://docs.github.com/en/rest",
    console: "https://github.com/settings/tokens",
    media: "none",
    note: "Repository and release monitoring only.",
  },
};

const CHANNEL_SIGNUP = {
  linkedin: "https://www.linkedin.com/signup",
  x: "https://x.com/i/flow/signup",
  facebook: "https://www.facebook.com/reg/",
  instagram: "https://www.instagram.com/accounts/emailsignup/",
  threads: "https://www.threads.net/",
  bluesky: "https://bsky.app/",
  mastodon: "https://mastodon.social/auth/sign_up",
  telegram: "https://telegram.org/",
  discord: "https://discord.com/register",
  devto: "https://dev.to/enter",
  tiktok: "https://www.tiktok.com/signup",
  youtube: "https://www.youtube.com/",
  whatsapp: "https://business.whatsapp.com/",
  reddit: "https://www.reddit.com/register/",
  hackernews: "https://news.ycombinator.com/login",
  producthunt: "https://www.producthunt.com/",
  github: "https://github.com/signup",
};

const MEDIA_LIBRARY = [
  { id: "dashboard", label: "Dashboard", file: "dashboard.png", kind: "image", pillars: ["product", "commercial", "tip", "arabic"], alt: "Fatortak dashboard with revenue, expenses and profit KPIs." },
  { id: "invoices", label: "Sales invoices", file: "sell-invoices.png", kind: "image", pillars: ["product", "commercial", "use-case"], alt: "Fatortak sales invoice list with VAT and payment status." },
  { id: "clients", label: "Clients", file: "clients.png", kind: "image", pillars: ["use-case", "commercial"], alt: "Fatortak client list with balances and contact details." },
  { id: "projects", label: "Projects", file: "projects.png", kind: "image", pillars: ["use-case", "product"], alt: "Fatortak projects with budget, cost and progress." },
  { id: "profitability", label: "Project profitability", file: "project-profitability.png", kind: "image", pillars: ["insight", "commercial"], alt: "Fatortak project profitability report." },
  { id: "income", label: "Income statement", file: "income-statement.png", kind: "image", pillars: ["insight", "commercial", "product"], alt: "Fatortak income statement with revenue and expense lines." },
  { id: "ai-chat", label: "AI chat", file: "ai-chat.png", kind: "image", pillars: ["ai-ocr", "insight", "product"], alt: "Fatortak AI assistant answering a finance question from the ledger." },
  { id: "ai-chart", label: "AI chart", file: "ai-chat-chart.png", kind: "image", pillars: ["ai-ocr", "insight"], alt: "Fatortak AI assistant returning a chart and KPI cards." },
  { id: "ai-receivables", label: "AI receivables", file: "ai-chat-receivables.png", kind: "image", pillars: ["ai-ocr", "insight"], alt: "Fatortak AI assistant listing overdue receivables." },
  { id: "ocr", label: "OCR invoice", file: "ocr-invoice.png", kind: "image", pillars: ["ai-ocr", "product", "use-case"], alt: "Fatortak OCR invoice capture with extracted fields." },
  { id: "social-run", label: "Social card — run the business", file: "social-run.png", kind: "image", pillars: ["product", "tip", "commercial"], alt: "Fatortak social card: run the whole business in one place." },
  { id: "social-ai", label: "Social card — AI assistant", file: "social-ai.png", kind: "image", pillars: ["ai-ocr", "insight", "product"], alt: "Fatortak social card: ask your business anything." },
  { id: "social-ocr", label: "Social card — OCR invoice", file: "social-ocr.png", kind: "image", pillars: ["ai-ocr", "product", "use-case"], alt: "Fatortak social card: snap a supplier invoice, review and post." },
  { id: "social-profit", label: "Social card — project profit", file: "social-profit.png", kind: "image", pillars: ["insight", "commercial"], alt: "Fatortak social card: know profit per project." },
  { id: "social-vat", label: "Social card — VAT invoicing", file: "social-vat.png", kind: "image", pillars: ["commercial", "product", "use-case"], alt: "Fatortak social card: VAT-ready invoices that post to the same ledger." },
  { id: "social-open", label: "Social card — open source", file: "social-open.png", kind: "image", pillars: ["open-source"], alt: "Fatortak social card: open source AGPL-3.0." },
  { id: "social-payroll", label: "Social card — payroll and inventory", file: "social-payroll.png", kind: "image", pillars: ["use-case", "product", "commercial"], alt: "Fatortak social card: payroll, inventory and cheques in one ledger." },
  { id: "social-receivables", label: "Social card — receivables", file: "social-receivables.png", kind: "image", pillars: ["insight", "ai-ocr", "tip"], alt: "Fatortak social card: know who owes you before it hurts." },
  { id: "social-arabic", label: "Social card — Arabic", file: "social-arabic.png", kind: "image", pillars: ["arabic"], alt: "Fatortak Arabic social card: run the whole business in one place." },
];

const PILLAR_MEDIA = {
  product: "social-run",
  insight: "social-profit",
  "open-source": "social-open",
  "use-case": "social-payroll",
  arabic: "social-arabic",
  "ai-ocr": "social-ocr",
  commercial: "social-vat",
  tip: "social-receivables",
};

function siteBase() {
  return String(CONFIG?.links?.site || "").replace(/\/$/, "");
}

const PUBLIC_BASE = String(process.env.PORTAL_PUBLIC_BASE || "").replace(/\/$/, "");

function libraryItem(id) {
  return MEDIA_LIBRARY.find((item) => item.id === id) || null;
}

function mediaFromLibrary(id) {
  const item = libraryItem(id) || libraryItem("dashboard");
  if (!item) return {};
  return {
    mediaUrl: `${PUBLIC_BASE}/media/landing/${item.file}`,
    mediaPublicUrl: siteBase() ? `${siteBase()}/assets/screenshots/${item.file.replace(/\.png$/i, ".jpg")}` : "",
    mediaKind: item.kind,
    mediaAlt: item.alt,
    mediaName: item.file,
    mediaSource: `library:${item.id}`,
  };
}

function defaultMediaForPillar(pillar) {
  return mediaFromLibrary(PILLAR_MEDIA[pillar] || "dashboard");
}

function mediaTypeFromName(name, fallback = "") {
  const ext = path.extname(String(name || "")).toLowerCase();
  if ([".mp4", ".mov", ".webm", ".m4v"].includes(ext)) return "video";
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"].includes(ext)) return "image";
  return fallback;
}

function mediaContentType(name, fallback = "") {
  const ext = path.extname(String(name || "")).toLowerCase();
  const types = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".avif": "image/avif",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".m4v": "video/x-m4v",
  };
  return types[ext] || fallback || "application/octet-stream";
}

const ALLOWED_MEDIA_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".mp4", ".mov", ".webm", ".m4v"]);
const POST_STATUSES = ["draft", "needs_review", "approved", "scheduled", "published", "failed", "blocked", "dry_run"];
const PILLARS = ["product", "insight", "open-source", "use-case", "arabic", "ai-ocr", "commercial", "tip"];
const MEDIA_REQUIRED_STATUSES = ["scheduled", "approved", "published"];
const MAX_REVISIONS = 20;
const MAX_ACTIVITY = 1000;

function isValidTimezone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: String(value) });
    return Boolean(value);
  } catch {
    return false;
  }
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

// Posts are scheduled as naive wall-clock strings ("YYYY-MM-DDTHH:mm:ss") in the portal timezone.
// The scheduler compares them as strings, so every write must use exactly this shape.
function normalizeScheduledAt(value, timeZone) {
  const text = String(value || "").trim();
  if (!text) return "";
  const naive = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/.exec(text);
  if (naive) {
    const [, y, mo, d, h, mi, s] = naive;
    const probe = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0)));
    if (Number.isNaN(probe.getTime()) || probe.getUTCMonth() !== +mo - 1 || probe.getUTCDate() !== +d) return null;
    return `${y}-${mo}-${d}T${h}:${mi}:${s || "00"}`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return wallClock(date, timeZone);
}

function wallClock(date, timeZone = "Africa/Cairo") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: isValidTimezone(timeZone) ? timeZone : "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value || "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}:${pick("second")}`;
}

function shiftScheduledAt(value, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(String(value || ""));
  if (!match) return value;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d + days, h, mi, s));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}T${pad2(h)}:${pad2(mi)}:${pad2(s)}`;
}

const URL_PATTERN = /https?:\/\/[^\s]+/gi;

// Length as each platform counts it. X and Mastodon count every link as 23 characters;
// X also weighs characters outside the Latin/Arabic ranges (emoji, CJK) as 2.
function channelTextLength(channel, text) {
  const value = String(text || "");
  if (channel === "x" || channel === "mastodon") {
    const withoutUrls = value.replace(URL_PATTERN, "");
    const urlCount = (value.match(URL_PATTERN) || []).length;
    if (channel === "mastodon") return [...withoutUrls].length + urlCount * 23;
    let weighted = 0;
    for (const char of withoutUrls) {
      const code = char.codePointAt(0);
      const light =
        (code >= 0 && code <= 4351) ||
        (code >= 8192 && code <= 8205) ||
        (code >= 8208 && code <= 8223) ||
        (code >= 8242 && code <= 8247);
      weighted += light ? 1 : 2;
    }
    return weighted + urlCount * 23;
  }
  if (channel === "bluesky" && typeof Intl.Segmenter === "function") {
    return [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(value)].length;
  }
  return [...value].length;
}

function channelTextNotes(channel, text, media) {
  const notes = [];
  if (channel === "telegram" && media && String(text).length > 1024) {
    notes.push("Telegram captions are cut at 1,024 characters when media is attached.");
  }
  if (["instagram", "threads", "devto"].includes(channel) && media && !/^https?:\/\//i.test(media.publicUrl || "")) {
    notes.push("Needs a public https media URL.");
  }
  if (VIDEO_POSTER_CHANNELS.has(channel) && media?.kind === "video") {
    notes.push(
      media.posterUrl
        ? "Video upload is not enabled here yet; the video's cover image is published instead."
        : "Video upload is not enabled here yet. Add a cover image (poster) or this channel will fail."
    );
  }
  return notes;
}

// Channels that cannot upload video yet receive the video's poster image instead.
const VIDEO_POSTER_CHANNELS = new Set(["x", "linkedin"]);

function cleanTags(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(list.map((tag) => String(tag).trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40)).filter(Boolean))].slice(0, 12);
}

function publicMediaBase() {
  return String(publicBaseOverride || process.env.PORTAL_PUBLIC_URL || "").replace(/\/$/, "");
}

function absoluteMediaUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const base = publicMediaBase();
  return base ? `${base}${url.startsWith("/") ? url : `/${url}`}` : url;
}

function channelSetup(key) {
  return CHANNEL_SETUP[key] || { docs: "", console: "", media: "none", note: "" };
}

function channelInfo(key) {
  const def = CHANNEL_DEFS.find((item) => item.key === key) || { key, label: key };
  const state = connectionState(key);
  const mode = MONITORING.has(key) ? "monitoring" : channelMode(key);
  const setup = channelSetup(key);
  const profile = key === "github"
    ? `https://github.com/${CONFIG.repo}`
    : def.profileKey
      ? (CONFIG.profiles?.[def.profileKey] || "")
      : "";
  return {
    key,
    label: def.label,
    profile,
    mode,
    configured: state.configured,
    env: state.env,
    credentialKeys: CREDENTIAL_KEYS[key] || [],
    verified: DATA.connectionChecks?.[key] || null,
    media: setup.media,
    docs: setup.docs,
    console: setup.console,
    signup: CHANNEL_SIGNUP[key] || "",
    note: setup.note,
    requirements:
      RESTRICTED_REASONS[key] ||
      setup.note ||
      (state.configured
        ? "Connected through environment credentials."
        : `Set ${state.env.join(", ") || "the required credentials"} in the portal environment.`),
  };
}

function defaultMetrics() {
  const metrics = {};
  for (const channel of CHANNEL_DEFS) {
    metrics[channel.key] = {
      followers: 0,
      reach: 0,
      engagement: 0,
      clicks: 0,
      posts: 0,
      lastUpdated: null,
      note: "",
    };
  }
  return metrics;
}

function defaultSettings() {
  return {
    brand: "Fatortak",
    timezone: "Africa/Cairo",
    dryRun: true,
    autoApprove: true,
    requireLiveSite: true,
    mediaRequired: true,
    publicUrl: process.env.PORTAL_PUBLIC_URL || "",
    siteUrl: CONFIG.links.site,
    repo: CONFIG.repo,
    profiles: CONFIG.profiles || {},
  };
}

function addActivity(data, type, message, postId = null) {
  data.activity = Array.isArray(data.activity) ? data.activity : [];
  data.activity.unshift({
    at: new Date().toISOString(),
    type,
    message,
    postId,
  });
  data.activity = data.activity.slice(0, MAX_ACTIVITY);
}

function defaultTemplates() {
  const now = new Date().toISOString();
  return [
    {
      id: "tpl-product-proof",
      name: "Product proof",
      language: "en",
      pillar: "product",
      channels: ["x", "linkedin", "facebook", "instagram"],
      content: 'Ask your ledger: "How did October compare with September?"\n\nThe assistant answers with the numbers and KPI cards from your own data.\n\nSee it → {{site}}',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "tpl-ocr-flow",
      name: "OCR flow",
      language: "en",
      pillar: "ai-ocr",
      channels: ["x", "linkedin", "facebook", "instagram"],
      content: "Upload a supplier invoice. Preview it. Review the extracted fields. Create the purchase invoice.\n\nOCR invoice capture is built into Fatortak.\n\n{{site}}",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function revisionSnapshot(post) {
  return {
    at: post.updatedAt || post.createdAt || new Date().toISOString(),
    title: post.title,
    content: post.content,
    channels: [...(post.channels || [])],
    language: post.language,
    pillar: post.pillar,
    tags: [...(post.tags || [])],
    scheduledAt: post.scheduledAt,
    status: post.status,
    mediaUrl: post.mediaUrl || "",
    mediaPublicUrl: post.mediaPublicUrl || "",
    mediaKind: post.mediaKind || "",
    mediaAlt: post.mediaAlt || "",
    mediaName: post.mediaName || "",
    mediaSource: post.mediaSource || "",
    posterUrl: post.posterUrl || "",
    posterPublicUrl: post.posterPublicUrl || "",
    posterName: post.posterName || "",
    notes: post.notes || "",
  };
}

function pushRevision(post) {
  post.revisions = Array.isArray(post.revisions) ? post.revisions : [];
  post.revisions.unshift(revisionSnapshot(post));
  post.revisions = post.revisions.slice(0, MAX_REVISIONS);
}

// The list endpoints send a light post object; the full revision history is served by GET /api/posts/:id.
function listPost(post) {
  const { revisions, ...rest } = post;
  return { ...rest, revisionCount: Array.isArray(revisions) ? revisions.length : 0 };
}

function seedQueue(data) {
  let imported = 0;
  let queue;
  try {
    queue = loadQueue();
  } catch {
    return imported;
  }
  const existing = new Set(data.posts.map((post) => post.queueId).filter(Boolean));
  for (const item of queue.items) {
    if (existing.has(item.id)) continue;
    const title = (item.text || "").split("\n")[0].replace(/^#+\s*/, "").slice(0, 90) || item.id;
    data.posts.push({
      id: `queue-${item.id}`,
      queueId: item.id,
      source: "queue",
      title,
      content: item.text,
      channels: item.channels || [],
      language: item.lang || "en",
      pillar: item.pillar || "product",
      scheduledAt: `${item.date}T${item.time || "09:00"}:00`,
      status: data.settings.autoApprove ? "scheduled" : "needs_review",
      ...defaultMediaForPillar(item.pillar || "product"),
      utm: item.utm || null,
      tags: [],
      notes: "",
      results: [],
      revisions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: null,
      lastAttemptAt: null,
    });
    imported += 1;
  }
  return imported;
}

function ensureDataShape(data) {
  data.version = data.version || 1;
  delete data._trafficCache;
  data.settings = { ...defaultSettings(), ...(data.settings || {}) };
  data.posts = Array.isArray(data.posts) ? data.posts : [];
  data.metrics = { ...defaultMetrics(), ...(data.metrics || {}) };
  data.connectionChecks = data.connectionChecks && typeof data.connectionChecks === "object" ? data.connectionChecks : {};
  for (const key of Object.keys(defaultMetrics())) {
    data.metrics[key] = { ...defaultMetrics()[key], ...(data.metrics[key] || {}) };
  }
  data.activity = Array.isArray(data.activity) ? data.activity : [];
  data.templates = Array.isArray(data.templates) ? data.templates : defaultTemplates();
  if (!isValidTimezone(data.settings.timezone)) data.settings.timezone = "Africa/Cairo";
  for (const post of data.posts) {
    post.tags = cleanTags(post.tags);
    // A post left in "publishing" means the process stopped mid-publish. Do not re-publish it
    // automatically (some channels may already have it); flag it for a human to check.
    if (post.status === "publishing") {
      post.status = "failed";
      post.results = (Array.isArray(post.results) ? post.results : []).concat({
        ok: false,
        error: "Publishing was interrupted by a restart. Check each channel before retrying.",
      });
      data.activity.unshift({
        at: new Date().toISOString(),
        type: "failed",
        message: `Publishing of “${post.title}” was interrupted; marked failed for review.`,
        postId: post.id,
      });
    }
    if (!post.mediaUrl) {
      Object.assign(post, defaultMediaForPillar(post.pillar || "product"));
    }
    if (PUBLIC_BASE && post.mediaUrl && post.mediaUrl.startsWith("/media/")) {
      post.mediaUrl = `${PUBLIC_BASE}${post.mediaUrl}`;
    }
    if (!post.mediaKind && post.mediaUrl) {
      post.mediaKind = mediaTypeFromName(post.mediaName || post.mediaUrl, "image");
    }
  }
  return data;
}

function loadData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  let data;
  if (fs.existsSync(DATA_FILE)) {
    data = readJson(DATA_FILE);
    data = ensureDataShape(data);
  } else {
    data = ensureDataShape({
      version: 1,
      settings: defaultSettings(),
      posts: [],
      metrics: defaultMetrics(),
      activity: [],
    });
    const imported = seedQueue(data);
    addActivity(data, "system", `Portal initialized with ${imported} queue posts.`);
    writeJson(DATA_FILE, data);
  }
  return data;
}

let CONFIG = loadConfig();
let DATA = loadData();
let siteLiveCache = { at: 0, value: false };
let trafficCache = { at: 0, value: null };
let publicBaseOverride = DATA.settings.publicUrl || process.env.PORTAL_PUBLIC_URL || "";

let lastBackupAt = 0;

function saveData() {
  DATA.updatedAt = new Date().toISOString();
  backupData();
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(DATA, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, DATA_FILE);
}

function backupData(force = false) {
  if (!fs.existsSync(DATA_FILE)) return null;
  const now = Date.now();
  if (!force && now - lastBackupAt < 10 * 60 * 1000) return null;
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date(now).toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
    const target = path.join(BACKUP_DIR, `portal-${stamp}.json`);
    fs.copyFileSync(DATA_FILE, target);
    lastBackupAt = now;
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((file) => /^portal-\d{8}-\d{6}\.json$/.test(file))
      .sort();
    while (files.length > 40) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
    return target;
  } catch (error) {
    console.error(`Backup failed: ${error.message}`);
    return null;
  }
}

backupData(true);

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_500_000) {
        reject(new Error("Request body is too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function isAuthorized(req, url) {
  if (!ADMIN_TOKEN) return true;
  const header = req.headers.authorization || "";
  if (header === `Bearer ${ADMIN_TOKEN}`) return true;
  return url.searchParams.get("token") === ADMIN_TOKEN;
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function readBinary(req, limit = 100 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks = [];
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
      req.destroy();
    };
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        fail(new Error(`File is larger than ${Math.round(limit / 1024 / 1024)} MB`));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });
    req.on("error", fail);
  });
}

function writeEnvValues(values) {
  const file = path.join(HERE, ".env");
  const header = "# Fatortak portal credentials. Written by the portal; never commit this file.";
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/) : [header];
  const pending = new Map();
  for (const [key, raw] of Object.entries(values)) {
    pending.set(key, String(raw ?? "").replace(/[\r\n]/g, " ").trim());
  }
  const updated = lines.map((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (!match || !pending.has(match[1])) return line;
    const value = pending.get(match[1]);
    pending.delete(match[1]);
    return `${match[1]}=${value}`;
  });
  for (const [key, value] of pending) updated.push(`${key}=${value}`);
  while (updated.length && updated[updated.length - 1] === "") updated.pop();
  fs.writeFileSync(file, `${updated.join("\r\n")}\r\n`, { mode: 0o600 });
  for (const [key, value] of Object.entries(values)) {
    const clean = String(value ?? "").replace(/[\r\n]/g, " ").trim();
    if (clean) process.env[key] = clean;
    else delete process.env[key];
  }
}

function serveMedia(req, res, pathname) {
  let relative;
  try {
    relative = decodeURIComponent(pathname.slice("/media/".length));
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }
  const fromLanding = relative.startsWith("landing/");
  const root = fromLanding ? SCREENSHOTS_DIR : MEDIA_DIR;
  const clean = fromLanding ? relative.slice("landing/".length) : relative;
  const file = path.resolve(root, clean);
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const stat = fs.statSync(file);
  const type = mediaContentType(file, "application/octet-stream");
  const headers = {
    "Content-Type": type,
    "Cache-Control": "public, max-age=3600",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  };
  const range = req.headers.range;
  const match = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (match) {
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
    if (start > end || start >= stat.size) {
      res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      ...headers,
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Content-Length": end - start + 1,
    });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, "Content-Length": stat.size });
  fs.createReadStream(file).pipe(res);
}

function listUploadedMedia() {
  if (!fs.existsSync(MEDIA_DIR)) return [];
  return fs.readdirSync(MEDIA_DIR)
    .filter((name) => !name.startsWith("."))
    .map((name) => {
      const file = path.join(MEDIA_DIR, name);
      const stat = fs.statSync(file);
      const url = `${PUBLIC_BASE}/media/${encodeURIComponent(name)}`;
      return {
        id: name,
        name,
        url,
        publicUrl: absoluteMediaUrl(url),
        kind: mediaTypeFromName(name, "image"),
        contentType: mediaContentType(name),
        size: stat.size,
        uploadedAt: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

async function getSiteLive(force = false) {
  const url = DATA.settings.siteUrl || CONFIG.links.site;
  if (!url) return false;
  const now = Date.now();
  const maxAge = siteLiveCache.value ? 5 * 60_000 : 30_000;
  if (!force && now - siteLiveCache.at < maxAge) return siteLiveCache.value;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
      const body = await response.text();
      const isOurPage = /Fatortak/i.test(body) && /fatortak-logo|Arabic-first business management/i.test(body);
      if (response.ok && isOurPage) {
        siteLiveCache = { at: now, value: true };
        return true;
      }
    } catch {
      // Retry once; a transient timeout should not block Instagram for five minutes.
    }
  }
  siteLiveCache = { at: now, value: false };
  return false;
}

// Dashboard reads should never wait on a slow remote check once we have an answer.
// Serve the cached value and refresh it in the background when it is stale.
let siteRefresh = null;
let trafficRefresh = null;

async function siteLiveForView() {
  if (!siteLiveCache.at) return getSiteLive();
  const maxAge = siteLiveCache.value ? 5 * 60_000 : 60_000;
  if (Date.now() - siteLiveCache.at > maxAge && !siteRefresh) {
    siteRefresh = getSiteLive(true).catch(() => false).finally(() => (siteRefresh = null));
  }
  return siteLiveCache.value;
}

async function trafficForView() {
  if (!trafficCache.value) return getTraffic();
  if (Date.now() - trafficCache.at > 5 * 60_000 && !trafficRefresh) {
    trafficRefresh = getTraffic(true).catch(() => null).finally(() => (trafficRefresh = null));
  }
  return trafficCache.value;
}

function channelSummary() {
  return CHANNEL_DEFS.map((def) => {
    const info = channelInfo(def.key);
    return {
      ...info,
      metrics: DATA.metrics[def.key],
    };
  });
}

function postSummary() {
  const counts = {};
  for (const post of DATA.posts) counts[post.status] = (counts[post.status] || 0) + 1;
  const now = new Date();
  const published30 = DATA.posts.filter((post) => {
    if (!post.publishedAt) return false;
    return now - new Date(post.publishedAt) <= 30 * 86_400_000;
  }).length;
  const wallNow = nowInTimezone(DATA.settings.timezone || "Africa/Cairo");
  const scheduled = DATA.posts.filter((post) => post.status === "scheduled");
  const upcoming = scheduled
    .filter((post) => String(post.scheduledAt) >= wallNow)
    .sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)))
    .slice(0, 8)
    .map(listPost);
  const today = wallNow.slice(0, 10);
  return {
    total: DATA.posts.length,
    counts,
    needsReview: counts.needs_review || 0,
    drafts: counts.draft || 0,
    approved: counts.approved || 0,
    scheduled: scheduled.length,
    overdue: scheduled.filter((post) => String(post.scheduledAt) < wallNow).length,
    today: scheduled.filter((post) => String(post.scheduledAt).startsWith(today)).length,
    published: counts.published || 0,
    published30,
    failed: counts.failed || 0,
    blocked: counts.blocked || 0,
    dryRun: counts.dry_run || 0,
    upcoming,
  };
}

function queueSnapshot() {
  const now = nowInTimezone(DATA.settings.timezone || "Africa/Cairo");
  const scheduled = DATA.posts.filter((post) => post.status === "scheduled");
  const posted = DATA.posts.filter((post) => post.status === "published").length;
  const next = scheduled
    .filter((post) => String(post.scheduledAt) >= now)
    .sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)))[0];
  return {
    total: DATA.posts.length,
    posted,
    upcoming: scheduled.length,
    overdue: scheduled.filter((post) => String(post.scheduledAt) < now).length,
    remaining: DATA.posts.length - posted,
    next: next
      ? { id: next.id, date: String(next.scheduledAt).slice(0, 10), time: String(next.scheduledAt).slice(11, 16) }
      : null,
  };
}

function metricsTotals() {
  const totals = {
    followers: 0,
    reach: 0,
    engagement: 0,
    clicks: 0,
    posts: 0,
    channels: 0,
    available: { followers: 0, reach: 0, engagement: 0, clicks: 0, posts: 0 },
  };
  for (const value of Object.values(DATA.metrics)) {
    if (!value?.lastUpdated) continue;
    totals.channels += 1;
    for (const key of ["followers", "reach", "engagement", "clicks", "posts"]) {
      const raw = value[key];
      if (raw === null || raw === undefined || raw === "") continue;
      const number = Number(raw);
      if (Number.isFinite(number)) {
        totals[key] += number;
        totals.available[key] += 1;
      }
    }
  }
  return totals;
}

async function getFirstPartyTraffic() {
  const base = DATA.settings.siteUrl || CONFIG.links.site;
  if (!base) return { configured: false, provider: "first-party" };
  try {
    const response = await fetch(new URL("stats.php", base), {
      headers: { "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`First-party stats HTTP ${response.status}`);
    const data = await response.json();
    return {
      configured: true,
      provider: "first-party",
      period: data.period || "30d",
      visitors: Number(data.visitors) || 0,
      pageviews: Number(data.pageviews) || 0,
      bounceRate: 0,
      sources: Array.isArray(data.sources) ? data.sources : [],
      paths: Array.isArray(data.paths) ? data.paths : [],
      updatedAt: data.updatedAt || null,
    };
  } catch (error) {
    return { configured: false, provider: "first-party", error: error.message };
  }
}

async function getTraffic(force = false) {
  const siteId = env("PLAUSIBLE_SITE_ID");
  const apiKey = env("PLAUSIBLE_API_KEY");
  if (!siteId || !apiKey) {
    if (!force && trafficCache.value && Date.now() - trafficCache.at < 5 * 60_000) {
      return trafficCache.value;
    }
    const value = await getFirstPartyTraffic();
    trafficCache = { at: Date.now(), value };
    return value;
  }
  if (!force && trafficCache.value && Date.now() - trafficCache.at < 5 * 60_000) {
    return trafficCache.value;
  }
  try {
    const url = new URL("https://plausible.io/api/v1/stats/aggregate");
    url.searchParams.set("site_id", siteId);
    url.searchParams.set("period", "30d");
    url.searchParams.append("metrics", "visitors");
    url.searchParams.append("metrics", "pageviews");
    url.searchParams.append("metrics", "bounce_rate");
    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`Plausible HTTP ${response.status}`);
    const data = await response.json();
    let sources = [];
    try {
      const breakdown = new URL("https://plausible.io/api/v1/stats/breakdown");
      breakdown.searchParams.set("site_id", siteId);
      breakdown.searchParams.set("period", "30d");
      breakdown.searchParams.set("property", "visit:source");
      breakdown.searchParams.append("metrics", "visitors");
      breakdown.searchParams.append("metrics", "pageviews");
      breakdown.searchParams.set("limit", "12");
      const breakdownResponse = await fetch(breakdown, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(12000),
      });
      if (breakdownResponse.ok) {
        const breakdownData = await breakdownResponse.json();
        sources = (breakdownData.results || []).map((row) => ({
          source: row.source || "direct",
          visitors: row.visitors || 0,
          pageviews: row.pageviews || 0,
        }));
      }
    } catch {
      sources = [];
    }
    const value = {
      configured: true,
      period: "30d",
      visitors: data.results?.visitors?.value ?? 0,
      pageviews: data.results?.pageviews?.value ?? 0,
      bounceRate: data.results?.bounce_rate?.value ?? 0,
      sources,
    };
    trafficCache = { at: Date.now(), value };
    return value;
  } catch (error) {
    const value = { configured: true, provider: "plausible", error: error.message };
    trafficCache = { at: Date.now(), value };
    return value;
  }
}

async function syncGithub() {
  const repo = DATA.settings.repo || CONFIG.repo;
  const token = env("GITHUB_TOKEN");
  const response = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "fatortak-portal",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
  const data = await response.json();
  DATA.metrics.github = {
    ...DATA.metrics.github,
    followers: null,
    reach: null,
    engagement: null,
    clicks: null,
    posts: null,
    lastUpdated: new Date().toISOString(),
    note: `${data.full_name} · ${data.stargazers_count || 0} stars · ${data.forks_count || 0} forks · ${
      data.open_issues_count || 0
    } open issues`,
  };
  return { channel: "github", stars: data.stargazers_count || 0, forks: data.forks_count || 0 };
}

async function syncBluesky() {
  const handle = env("BLUESKY_HANDLE");
  if (!handle) return null;
  const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`, {
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Bluesky HTTP ${response.status}`);
  const data = await response.json();
  let engagement = null;
  try {
    const feedResponse = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=30`,
      { signal: AbortSignal.timeout(12000) }
    );
    if (feedResponse.ok) {
      const feed = await feedResponse.json();
      engagement = (feed.feed || []).reduce(
        (sum, item) =>
          sum + Number(item.post?.likeCount || 0) + Number(item.post?.repostCount || 0) + Number(item.post?.replyCount || 0),
        0
      );
    }
  } catch {
    engagement = null;
  }
  DATA.metrics.bluesky = {
    ...DATA.metrics.bluesky,
    followers: data.followersCount || 0,
    reach: null,
    engagement,
    clicks: null,
    posts: data.postsCount || 0,
    lastUpdated: new Date().toISOString(),
    note: `@${handle} · engagement from the latest 30 posts`,
  };
  return { channel: "bluesky", followers: data.followersCount || 0 };
}

async function syncMastodon() {
  const instance = env("MASTODON_INSTANCE");
  const account = env("MASTODON_ACCOUNT");
  if (!instance || !account) return null;
  const response = await fetch(`${instance.replace(/\/$/, "")}/api/v1/accounts/lookup?acct=${encodeURIComponent(account)}`, {
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Mastodon HTTP ${response.status}`);
  const data = await response.json();
  let engagement = null;
  try {
    const statusesResponse = await fetch(
      `${instance.replace(/\/$/, "")}/api/v1/accounts/${data.id}/statuses?limit=20`,
      { signal: AbortSignal.timeout(12000) }
    );
    if (statusesResponse.ok) {
      const statuses = await statusesResponse.json();
      engagement = (statuses || []).reduce(
        (sum, status) =>
          sum + Number(status.favourites_count || 0) + Number(status.reblogs_count || 0) + Number(status.replies_count || 0),
        0
      );
    }
  } catch {
    engagement = null;
  }
  DATA.metrics.mastodon = {
    ...DATA.metrics.mastodon,
    followers: data.followers_count || 0,
    reach: null,
    engagement,
    clicks: null,
    posts: data.statuses_count || 0,
    lastUpdated: new Date().toISOString(),
    note: `@${account} · engagement from the latest 20 posts`,
  };
  return { channel: "mastodon", followers: data.followers_count || 0 };
}

function insightTotal(data, name) {
  const item = (data?.data || []).find((entry) => entry.name === name);
  if (!item) return null;
  if (item.total_value && typeof item.total_value.value === "number") return item.total_value.value;
  if (!Array.isArray(item.values)) return null;
  return item.values.reduce((sum, entry) => sum + Number(entry.value || 0), 0);
}

function insightNumeric(data, name) {
  const item = (data?.data || []).find((entry) => entry.name === name);
  if (!item || !Array.isArray(item.values) || !item.values.length) return null;
  const value = item.values[0]?.value;
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    return Object.values(value).reduce((sum, entry) => sum + Number(entry || 0), 0);
  }
  return null;
}

async function graphGet(pathname, params, token) {
  const url = new URL(`https://graph.facebook.com/v21.0/${String(pathname).replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error?.message || `Graph HTTP ${response.status}`);
  return data;
}

async function syncFacebook() {
  const pageId = env("FACEBOOK_PAGE_ID");
  const token = env("FACEBOOK_PAGE_ACCESS_TOKEN");
  if (!pageId || !token) return null;
  const profile = await graphGet(pageId, { fields: "name,followers_count,fan_count" }, token);
  const postIds = [
    ...new Set(
      DATA.posts.flatMap((post) =>
        (post.results || [])
          .filter((result) => result.channel === "facebook" && result.ok && result.id)
          .map((result) => String(result.id))
      )
    ),
  ];
  let reach = null;
  let views = null;
  let reactions = 0;
  let clicks = 0;
  let counted = 0;
  const notes = [];
  for (const postId of postIds.slice(0, 20)) {
    try {
      const insights = await graphGet(
        `${postId}/insights`,
        { metric: "post_reactions_by_type_total,post_clicks,post_media_view,post_total_media_view_unique" },
        token
      );
      reactions += insightNumeric(insights, "post_reactions_by_type_total") || 0;
      clicks += insightNumeric(insights, "post_clicks") || 0;
      views = (views || 0) + (insightNumeric(insights, "post_media_view") || 0);
      reach = (reach || 0) + (insightNumeric(insights, "post_total_media_view_unique") || 0);
      counted += 1;
    } catch (error) {
      notes.push(`post insights: ${error.message}`);
    }
  }
  DATA.metrics.facebook = {
    followers: Number(profile.followers_count ?? profile.fan_count ?? 0),
    reach: counted ? reach : null,
    engagement: counted ? reactions + clicks : null,
    clicks: counted ? clicks : null,
    posts: postIds.length,
    lastUpdated: new Date().toISOString(),
    note: `Page: ${profile.name || pageId} · portaled posts${views !== null ? ` · views: ${views}` : ""}${
      notes.length ? ` · ${notes[0]}` : ""
    }`,
  };
  return {
    channel: "facebook",
    followers: DATA.metrics.facebook.followers,
    reach: DATA.metrics.facebook.reach,
    engagement: DATA.metrics.facebook.engagement,
  };
}

async function syncInstagram() {
  const userId = env("INSTAGRAM_USER_ID");
  const token = env("INSTAGRAM_ACCESS_TOKEN");
  if (!userId || !token) return null;
  const profile = await graphGet(userId, { fields: "username,followers_count,follows_count,media_count" }, token);
  let reach = null;
  let views = null;
  let engagement = null;
  const notes = [];
  try {
    const insights = await graphGet(
      `${userId}/insights`,
      { metric: "reach,views,profile_views", period: "day", metric_type: "total_value" },
      token
    );
    reach = insightTotal(insights, "reach");
    views = insightTotal(insights, "views");
  } catch (error) {
    notes.push(`insights: ${error.message}`);
    try {
      const insights = await graphGet(`${userId}/insights`, { metric: "impressions,reach", period: "day" }, token);
      reach = insightTotal(insights, "reach");
      views = insightTotal(insights, "impressions");
    } catch (fallbackError) {
      notes.push(`fallback: ${fallbackError.message}`);
    }
  }
  try {
    const media = await graphGet(`${userId}/media`, { fields: "like_count,comments_count", limit: "50" }, token);
    engagement = (media.data || []).reduce(
      (sum, item) => sum + Number(item.like_count || 0) + Number(item.comments_count || 0),
      0
    );
  } catch (error) {
    notes.push(`media: ${error.message}`);
  }
  DATA.metrics.instagram = {
    followers: Number(profile.followers_count || 0),
    reach,
    engagement,
    clicks: null,
    posts: Number(profile.media_count || 0),
    lastUpdated: new Date().toISOString(),
    note: `@${profile.username || userId}${views !== null ? ` · views: ${views}` : ""}${
      notes.length ? ` · ${notes[0]}` : ""
    }`,
  };
  return { channel: "instagram", followers: DATA.metrics.instagram.followers, reach, engagement };
}

async function syncX() {
  const token = env("X_ACCESS_TOKEN");
  const oauth1Ready = Boolean(
    env("X_API_KEY") &&
      env("X_API_SECRET") &&
      (env("X_OAUTH1_ACCESS_TOKEN") || (env("X_ACCESS_TOKEN") && env("X_ACCESS_TOKEN_SECRET"))) &&
      (env("X_OAUTH1_ACCESS_TOKEN_SECRET") || env("X_ACCESS_TOKEN_SECRET"))
  );
  if (!token && !oauth1Ready) return null;
  const url = "https://api.x.com/2/users/me?user.fields=public_metrics";
  const headers = token ? { Authorization: `Bearer ${token}` } : { Authorization: oauth1Header("GET", url) };
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.errors) throw new Error(data.errors?.[0]?.message || `X HTTP ${response.status}`);
  const publicMetrics = data.data?.public_metrics || {};
  DATA.metrics.x = {
    followers: Number(publicMetrics.followers_count || 0),
    reach: null,
    engagement: null,
    clicks: null,
    posts: Number(publicMetrics.tweet_count || 0),
    lastUpdated: new Date().toISOString(),
    note: `@${data.data?.username || "connected"} · reach/engagement need paid owned-read access`,
  };
  return { channel: "x", followers: DATA.metrics.x.followers };
}

async function syncDevTo() {
  const key = env("DEVTO_API_KEY");
  if (!key) return null;
  const headers = { "api-key": key };
  const profileResponse = await fetch("https://dev.to/api/users/me", {
    headers,
    signal: AbortSignal.timeout(12000),
  });
  const profile = await profileResponse.json().catch(() => ({}));
  if (!profileResponse.ok) throw new Error(`Dev.to HTTP ${profileResponse.status}`);
  const articlesResponse = await fetch("https://dev.to/api/articles/me/published?per_page=100", {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  const articles = articlesResponse.ok ? await articlesResponse.json().catch(() => []) : [];
  const engagement = (articles || []).reduce(
    (sum, article) => sum + Number(article.public_reactions_count || 0) + Number(article.comments_count || 0),
    0
  );
  const views = (articles || []).reduce(
    (sum, article) => sum + (Number.isFinite(Number(article.page_views_count)) ? Number(article.page_views_count) : 0),
    0
  );
  DATA.metrics.devto = {
    followers: null,
    reach: articles.length ? views : null,
    engagement: articles.length ? engagement : null,
    clicks: null,
    posts: articles.length,
    lastUpdated: new Date().toISOString(),
    note: `@${profile.username || "fatortak"} · ${articles.length} published article${
      articles.length === 1 ? "" : "s"
    }${articles.length ? "" : " · no articles yet"}`,
  };
  return { channel: "devto", posts: articles.length };
}

async function syncMetrics() {
  const results = [];
  const warnings = [];
  const tested = [];
  try { results.push(await syncGithub()); } catch (error) { warnings.push(`GitHub: ${error.message}`); }
  try { const value = await syncBluesky(); if (value) results.push(value); } catch (error) { warnings.push(`Bluesky: ${error.message}`); }
  try { const value = await syncMastodon(); if (value) results.push(value); } catch (error) { warnings.push(`Mastodon: ${error.message}`); }
  try { const value = await syncFacebook(); if (value) results.push(value); } catch (error) { warnings.push(`Facebook: ${error.message}`); }
  try { const value = await syncInstagram(); if (value) results.push(value); } catch (error) { warnings.push(`Instagram: ${error.message}`); }
  try { const value = await syncX(); if (value) results.push(value); } catch (error) { warnings.push(`X: ${error.message}`); }
  try { const value = await syncDevTo(); if (value) results.push(value); } catch (error) { warnings.push(`Dev.to: ${error.message}`); }
  for (const channel of CHANNEL_DEFS) {
    if (!channelInfo(channel.key).configured) continue;
    try {
      const check = await testConnection(channel.key);
      DATA.connectionChecks[channel.key] = {
        at: new Date().toISOString(),
        ok: Boolean(check.ok),
        detail: String(check.detail || ""),
      };
      tested.push({ channel: channel.key, ok: Boolean(check.ok) });
    } catch (error) {
      DATA.connectionChecks[channel.key] = {
        at: new Date().toISOString(),
        ok: false,
        detail: error.message,
      };
      tested.push({ channel: channel.key, ok: false });
      warnings.push(`${channel.label} test: ${error.message}`);
    }
  }
  const traffic = await getTraffic(true);
  if (traffic.error) warnings.push(`Traffic: ${traffic.error}`);
  for (const channel of CHANNEL_DEFS) {
    if (
      ["linkedin", "threads", "tiktok", "youtube", "telegram", "discord"].includes(channel.key) &&
      !channelInfo(channel.key).configured
    ) {
      warnings.push(`${channel.label}: connect credentials to ingest metrics.`);
    }
  }
  addActivity(
    DATA,
    "metrics",
    `Metrics sync completed (${results.length} channel${results.length === 1 ? "" : "s"}, ${tested.length} connection test${tested.length === 1 ? "" : "s"}).`
  );
  saveData();
  return { synced: results, warnings, traffic, tested };
}

function validatePostInput(body, existing = null) {
  const channels = [...new Set(Array.isArray(body.channels) ? body.channels.map(String) : existing?.channels || [])];
  const known = new Set(CHANNEL_DEFS.map((channel) => channel.key));
  const invalid = channels.filter((channel) => !known.has(channel));
  if (invalid.length) throw new Error(`Unknown channels: ${invalid.join(", ")}`);
  const content = String(body.content ?? existing?.content ?? "");
  if (!content.trim()) throw new Error("Post content is required");
  if (!channels.length) throw new Error("Select at least one channel");
  const status = body.status || existing?.status || "draft";
  if (!POST_STATUSES.includes(status)) throw new Error("Invalid status");
  const timeZone = DATA.settings.timezone || "Africa/Cairo";
  const rawSchedule = body.scheduledAt ?? existing?.scheduledAt;
  const scheduledAt = rawSchedule ? normalizeScheduledAt(rawSchedule, timeZone) : wallClock(new Date(), timeZone);
  if (scheduledAt === null) throw new Error("Invalid schedule date");

  const pick = (key) => String(body[key] ?? existing?.[key] ?? "").trim();
  const mediaUrl = pick("mediaUrl");
  // The public URL is only a hint for channels that fetch media remotely. Without a public
  // media host it can be a relative portal path; keep absolute URLs and drop the rest.
  const rawPublicUrl = pick("mediaPublicUrl");
  const mediaPublicUrl = /^https?:\/\//i.test(rawPublicUrl) ? rawPublicUrl : "";
  const mediaName = pick("mediaName").slice(0, 200);
  const requestedKind = body.mediaKind ?? existing?.mediaKind;
  const mediaKind = !mediaUrl
    ? ""
    : requestedKind === "video" || requestedKind === "image"
      ? requestedKind
      : mediaTypeFromName(mediaName || mediaUrl, "image");
  const portalMediaPath = mediaUrl.startsWith("/media/") || (PUBLIC_BASE && mediaUrl.startsWith(`${PUBLIC_BASE}/media/`));
  if (mediaUrl && !/^https?:\/\//i.test(mediaUrl) && !portalMediaPath) {
    throw new Error("Media URL must be an https URL or a portal /media path");
  }
  if (DATA.settings.mediaRequired && !mediaUrl && MEDIA_REQUIRED_STATUSES.includes(status)) {
    throw new Error("Attach an image or video before scheduling or publishing. Text-only posts are disabled.");
  }

  return {
    title: (String(body.title ?? existing?.title ?? "").trim() || content.trim().split("\n")[0] || "Untitled post").slice(0, 140),
    content,
    channels,
    language: body.language === "ar" || body.language === "en" ? body.language : existing?.language || "en",
    pillar: String(body.pillar || existing?.pillar || "product").slice(0, 40),
    tags: cleanTags(body.tags ?? existing?.tags ?? []),
    scheduledAt,
    status,
    mediaUrl: mediaUrl.slice(0, 2000),
    mediaPublicUrl: mediaPublicUrl.slice(0, 2000),
    mediaKind,
    mediaAlt: pick("mediaAlt").slice(0, 1000),
    mediaName,
    mediaSource: pick("mediaSource").slice(0, 200),
    // Video cover image. Clearing posterUrl (or switching to non-video media) clears the rest.
    ...(() => {
      const posterUrl = mediaKind === "video" ? pick("posterUrl").slice(0, 500) : "";
      return {
        posterUrl,
        posterPublicUrl: posterUrl ? pick("posterPublicUrl").slice(0, 500) : "",
        posterName: posterUrl ? pick("posterName").slice(0, 200) : "",
      };
    })(),
    notes: String(body.notes ?? existing?.notes ?? "").slice(0, 4000),
    utm: body.utm || existing?.utm || null,
  };
}

function renderForChannel(post, channel) {
  return renderText(String(post.content || ""), {
    channel,
    links: CONFIG.links,
    utm: { ...(post.utm || {}), content: post.id || "preview" },
  });
}

function previewPost(post, media = null) {
  return (post.channels || []).map((channel) => {
    const text = renderForChannel(post, channel);
    const limit = LIMITS[channel] || 0;
    const length = channelTextLength(channel, text);
    return {
      channel,
      label: CHANNEL_DEFS.find((def) => def.key === channel)?.label || channel,
      text,
      length,
      limit,
      over: Boolean(limit && length > limit),
      mode: MONITORING.has(channel) ? "monitoring" : channelMode(channel),
      configured: connectionState(channel).configured,
      notes: channelTextNotes(channel, text, media),
    };
  });
}

async function resolvePostMedia(post) {
  if (!post.mediaUrl) return null;
  const rawUrl = String(post.mediaUrl);
  const url = PUBLIC_BASE && rawUrl.startsWith(PUBLIC_BASE) ? rawUrl.slice(PUBLIC_BASE.length) : rawUrl;
  let file = null;
  if (url.startsWith("/media/landing/")) {
    file = path.join(SCREENSHOTS_DIR, path.basename(url));
  } else if (url.startsWith("/media/")) {
    file = path.join(MEDIA_DIR, path.basename(url));
  }
  const exists = Boolean(file && fs.existsSync(file));
  const name = post.mediaName || (file ? path.basename(file) : path.basename(url));
  const publicUrl = post.mediaPublicUrl || (/^https?:\/\//i.test(rawUrl) ? rawUrl : absoluteMediaUrl(url));
  return {
    url,
    publicUrl: /^https?:\/\//i.test(publicUrl) ? publicUrl : "",
    path: exists ? file : null,
    name,
    kind: post.mediaKind === "video" ? "video" : mediaTypeFromName(name || url, "image"),
    contentType: mediaContentType(name || url),
    alt: post.mediaAlt || "",
  };
}

async function publishPost(post, { dryRun = true, automatic = false, channels: requestedChannels = null } = {}) {
  CONFIG = loadConfig();
  const validChannels = post.channels.filter((channel) => CHANNEL_DEFS.some((def) => def.key === channel));
  const requested = Array.isArray(requestedChannels) && requestedChannels.length
    ? validChannels.filter((channel) => requestedChannels.includes(channel))
    : null;
  const channels = requested || validChannels;
  if (!channels.length) throw new Error("No valid channels selected");
  const subset = Boolean(requested);
  const media = await resolvePostMedia(post);
  const poster = media?.kind === "video" && post.posterUrl
    ? await resolvePostMedia({
        ...post,
        mediaUrl: post.posterUrl,
        mediaPublicUrl: post.posterPublicUrl || post.posterUrl,
        mediaKind: "image",
        mediaName: post.posterName || path.basename(post.posterUrl),
        mediaAlt: post.mediaAlt,
      })
    : null;
  const block = (reason, message) => {
    const results = [{ ok: false, blocked: true, reason }];
    if (dryRun) {
      // A dry run only reports; it never changes the post's place in the schedule.
      post.preview = { at: new Date().toISOString(), blocked: true, results };
      saveData();
      return { blocked: true, dryRun: true, results };
    }
    post.status = "blocked";
    post.results = results;
    post.lastAttemptAt = new Date().toISOString();
    addActivity(DATA, "blocked", message, post.id);
    saveData();
    return { blocked: true, results };
  };
  if (DATA.settings.mediaRequired && !media) {
    return block("Text-only posts are disabled. Attach an image or video before publishing.", `Blocked “${post.title}”: no image or video attached.`);
  }
  const needsSite = post.content.includes("{{site}}") || post.content.includes(CONFIG.links.site);
  if (needsSite && DATA.settings.requireLiveSite && !(await getSiteLive())) {
    return block("Landing page is not live. Deploy it before publishing this post.", `Blocked “${post.title}”: landing page is not live.`);
  }

  const results = [];
  let siteHost = "";
  try {
    siteHost = new URL(CONFIG.links.site).hostname;
  } catch {
    siteHost = "";
  }
  let mediaHost = "";
  try {
    mediaHost = media?.publicUrl ? new URL(media.publicUrl).hostname : "";
  } catch {
    mediaHost = "";
  }
  const mediaOnSite = Boolean(siteHost && mediaHost && siteHost === mediaHost);
  for (const channel of channels) {
    const rendered = renderForChannel(post, channel);
    const limit = LIMITS[channel];
    const length = channelTextLength(channel, rendered);
    if (limit && length > limit) {
      results.push({ channel, ok: false, skipped: true, reason: `Text is ${length} characters; ${channel} allows ${limit}.` });
      continue;
    }
    if (mediaOnSite && ["instagram", "threads", "devto"].includes(channel) && DATA.settings.requireLiveSite && !(await getSiteLive())) {
      results.push({ channel, ok: false, skipped: true, reason: "Media is hosted on the landing page, which is not live yet." });
      continue;
    }
    if (!dryRun) {
      const state = connectionState(channel);
      if (!state.configured) {
        results.push({
          channel,
          ok: false,
          skipped: true,
          reason: state.mode === "restricted" ? "Channel is blocked or monitoring-only." : `Needs setup: ${state.env.join(", ") || "credentials"}.`,
        });
        continue;
      }
      const check = DATA.connectionChecks?.[channel];
      if (automatic && check && !check.ok) {
        results.push({
          channel,
          ok: false,
          skipped: true,
          reason: `Automatic publish skipped: last connection test failed (${String(check.detail || "unknown").slice(0, 140)}).`,
        });
        continue;
      }
    }
    const channelMedia = media?.kind === "video" && poster && VIDEO_POSTER_CHANNELS.has(channel) ? poster : media;
    if (dryRun) {
      const state = connectionState(channel);
      results.push({
        channel,
        ok: true,
        dryRun: true,
        media: channelMedia?.kind || null,
        ...(channelMedia !== media ? { mediaNote: "Would publish the video cover image." } : {}),
        length,
        ready: state.configured,
        reason: state.configured
          ? "Would publish."
          : state.mode === "restricted"
            ? "Would skip: channel is blocked or monitoring-only."
            : `Would skip: needs ${state.env.join(", ") || "credentials"}.`,
      });
      continue;
    }
    let result;
    try {
      result = await publishToChannel(channel, rendered, { config: CONFIG, media: channelMedia });
    } catch (error) {
      result = { ok: false, error: error.message };
    }
    if (result.ok && channelMedia !== media) {
      result.mediaNote = "Video cover published; video upload is not enabled for this channel yet.";
    }
    results.push({ channel, ...result });
  }

  if (dryRun) {
    post.preview = { at: new Date().toISOString(), results };
    addActivity(DATA, "dry_run", `Dry run “${post.title}” across ${channels.length} channel${channels.length === 1 ? "" : "s"}.`, post.id);
    saveData();
    const issues = results.filter((result) => !result.ok);
    return { results, published: 0, failures: issues.filter((r) => !r.skipped).length, skipped: issues.filter((r) => r.skipped).length, dryRun, channels };
  }

  const previous = Array.isArray(post.results) ? post.results.filter((result) => result.channel) : [];
  const merged = subset
    ? previous.filter((result) => !channels.includes(result.channel)).concat(results)
    : results;
  post.results = merged;
  post.lastAttemptAt = new Date().toISOString();
  const attemptOk = results.filter((result) => result.ok && !result.dryRun).length;
  const ok = merged.filter((result) => result.ok && !result.dryRun).length;
  const failures = merged.filter((result) => !result.ok && !result.skipped);
  const skipped = merged.filter((result) => result.skipped);
  if (ok > 0) {
    post.status = "published";
    if (!post.publishedAt) post.publishedAt = new Date().toISOString();
    addActivity(
      DATA,
      subset ? "retry" : "published",
      subset
        ? `Retried “${post.title}” on ${channels.length} channel${channels.length === 1 ? "" : "s"}: ${attemptOk} succeeded.`
        : `Published “${post.title}” to ${ok} channel${ok === 1 ? "" : "s"}.`,
      post.id
    );
  } else if (failures.length === 0 && skipped.length > 0) {
    post.status = "blocked";
    addActivity(DATA, "blocked", `Blocked “${post.title}”: no selected channel is connected yet.`, post.id);
  } else {
    post.status = "failed";
    addActivity(DATA, "failed", `Publish failed for “${post.title}” (${failures.length + skipped.length} channel issues).`, post.id);
  }
  saveData();
  return { results, published: attemptOk, mergedPublished: ok, failures: failures.length, skipped: skipped.length, dryRun, channels };
}

function overview() {
  const posts = postSummary();
  return {
    generatedAt: new Date().toISOString(),
    live: LIVE,
    autoPublish: AUTO_PUBLISH,
    dryRun: DATA.settings.dryRun,
    siteUrl: DATA.settings.siteUrl,
    siteLive: siteLiveCache.value,
    settings: DATA.settings,
    posts,
    queue: queueSnapshot(),
    channels: channelSummary(),
    metrics: { totals: metricsTotals(), channels: DATA.metrics },
    activity: DATA.activity.slice(0, 12),
  };
}

function calendar(month) {
  const posts = DATA.posts.filter((post) => {
    if (!month) return true;
    return (post.scheduledAt || "").startsWith(month);
  });
  return { month, posts: posts.map(listPost) };
}

function reportsSummary() {
  const channelCounts = {};
  for (const post of DATA.posts) {
    for (const channel of post.channels || []) channelCounts[channel] = (channelCounts[channel] || 0) + 1;
  }
  const connected = channelSummary().filter((channel) => channel.configured);
  const blocked = DATA.posts.filter((post) => post.status === "blocked").length;
  const totals = metricsTotals();
  const unavailable = channelSummary()
    .filter((channel) => !channel.metrics?.lastUpdated)
    .map((channel) => ({
      channel: channel.label,
      note: channel.metrics?.note || (channel.configured ? "No metrics received yet." : "Channel is not configured."),
    }));
  const recommendations = [];
  if (!siteLiveCache.value) recommendations.push("Deploy the landing page before publishing posts that use {{site}} links.");
  if (!connected.length) recommendations.push("Connect at least one posting API in the portal environment.");
  if (blocked) recommendations.push(`${blocked} post${blocked === 1 ? "" : "s"} blocked by the live-site or channel check.`);
  if (DATA.posts.some((post) => post.channels?.includes("instagram") && !post.mediaUrl)) {
    recommendations.push("Instagram posts need a public media URL before they can publish.");
  }
  if (DATA.settings.mediaRequired && DATA.posts.some((post) => !post.mediaUrl)) {
    recommendations.push("Some posts have no image or video. Attach media before scheduling or publishing.");
  }
  if (!totals.channels) {
    recommendations.push("No live channel metrics yet. Run Sync metrics and check each channel's API permissions.");
  } else if (unavailable.length) {
    recommendations.push(
      `No live metrics yet for ${unavailable
        .slice(0, 5)
        .map((item) => item.channel)
        .join(", ")}${unavailable.length > 5 ? ` and ${unavailable.length - 5} more` : ""}.`
    );
  }
  return {
    generatedAt: new Date().toISOString(),
    posts: postSummary(),
    channelCounts,
    metrics: {
      totals,
      channels: DATA.metrics,
      channelsWithData: totals.channels,
      unavailable,
    },
    connected: connected.map((channel) => channel.label),
    recommendations,
    latestReport: readLatestReport(),
  };
}

function readLatestReport() {
  if (!fs.existsSync(REPORTS_DIR)) return null;
  const files = fs.readdirSync(REPORTS_DIR)
    .filter((name) => name.endsWith(".md"))
    .map((name) => path.join(REPORTS_DIR, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!files.length) return null;
  return fs.readFileSync(files[0], "utf8").slice(0, 5000);
}

function csvEscape(value) {
  let text = String(value ?? "");
  // Stop spreadsheet apps from evaluating cell text as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function resultSummary(results, predicate) {
  return (results || []).filter((result) => result.channel && predicate(result)).map((result) => result.channel).join("|");
}

function exportCsv(posts = DATA.posts) {
  const rows = [
    ["id", "title", "status", "language", "pillar", "tags", "channels", "scheduledAt", "publishedAt", "published", "failed", "skipped", "media", "content"],
    ...posts.map((post) => [
      post.id,
      post.title,
      post.status,
      post.language,
      post.pillar,
      (post.tags || []).join("|"),
      (post.channels || []).join("|"),
      post.scheduledAt,
      post.publishedAt || "",
      resultSummary(post.results, (result) => result.ok && !result.dryRun),
      resultSummary(post.results, (result) => !result.ok && !result.skipped),
      resultSummary(post.results, (result) => result.skipped),
      post.mediaName || post.mediaUrl || "",
      post.content,
    ]),
  ];
  return `﻿${rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")}`;
}

function filterPosts(params) {
  const status = params.get("status");
  const channel = params.get("channel");
  const lang = params.get("lang");
  const tag = params.get("tag");
  const pillar = params.get("pillar");
  const q = (params.get("q") || "").toLowerCase();
  let posts = [...DATA.posts];
  if (status) posts = posts.filter((post) => post.status === status);
  if (channel) posts = posts.filter((post) => (post.channels || []).includes(channel));
  if (lang) posts = posts.filter((post) => post.language === lang);
  if (tag) posts = posts.filter((post) => (post.tags || []).includes(tag));
  if (pillar) posts = posts.filter((post) => post.pillar === pillar);
  if (q) posts = posts.filter((post) => `${post.title} ${post.content} ${(post.tags || []).join(" ")} ${post.notes || ""}`.toLowerCase().includes(q));
  return posts.sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
}

function mediaUsage() {
  const usage = {};
  for (const post of DATA.posts) {
    const url = String(post.mediaUrl || "");
    const match = /\/media\/(?!landing\/)([^/?#]+)$/.exec(url);
    const key = match ? decodeURIComponentSafe(match[1]) : url.includes("/media/landing/") ? `landing:${path.basename(url)}` : "";
    if (!key) continue;
    usage[key] = usage[key] || { total: 0, pending: 0 };
    usage[key].total += 1;
    if (["scheduled", "approved", "needs_review", "draft", "publishing"].includes(post.status)) usage[key].pending += 1;
  }
  return usage;
}

function decodeURIComponentSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function libraryPayload() {
  const usage = mediaUsage();
  return MEDIA_LIBRARY.map((item) => ({
    ...item,
    url: `${PUBLIC_BASE}/media/landing/${item.file}`,
    publicUrl: siteBase() ? `${siteBase()}/assets/screenshots/${item.file.replace(/\.png$/i, ".jpg")}` : "",
    usage: usage[`landing:${item.file}`] || { total: 0, pending: 0 },
  }));
}

function meta() {
  return {
    statuses: POST_STATUSES,
    pillars: PILLARS,
    limits: LIMITS,
    placeholders: Object.keys(CONFIG.links || {}).filter((key) => /^https?:|^mailto:/i.test(String(CONFIG.links[key] || ""))),
    timezone: DATA.settings.timezone,
    now: nowInTimezone(DATA.settings.timezone),
    tags: [...new Set(DATA.posts.flatMap((post) => post.tags || []))].sort(),
  };
}

function applyBulk(action, ids, value) {
  const targets = DATA.posts.filter((post) => ids.includes(post.id));
  const skipped = [];
  let updated = 0;
  const created = [];
  const known = new Set(CHANNEL_DEFS.map((channel) => channel.key));
  // Validate once up front so a bad value never leaves the selection half-applied.
  if (!["delete", "duplicate", "status", "shift", "addChannel", "removeChannel", "addTag", "removeTag"].includes(action)) {
    throw new Error("Unknown bulk action");
  }
  if (action === "status" && !POST_STATUSES.includes(value)) throw new Error("Invalid status");
  if (action === "shift" && (!Number.isInteger(Number(value)) || Number(value) === 0 || Math.abs(Number(value)) > 365)) {
    throw new Error("Shift must be a whole number of days between -365 and 365.");
  }
  if ((action === "addChannel" || action === "removeChannel") && !known.has(value)) throw new Error("Unknown channel");
  if ((action === "addTag" || action === "removeTag") && !cleanTags([value]).length) throw new Error("Enter a tag");
  for (const post of targets) {
    if (post.status === "publishing") {
      skipped.push({ id: post.id, reason: "Currently publishing." });
      continue;
    }
    if (action === "delete") {
      DATA.posts = DATA.posts.filter((item) => item !== post);
      updated += 1;
      continue;
    }
    if (action === "duplicate") {
      const copy = duplicatePost(post);
      DATA.posts.push(copy);
      created.push(copy.id);
      updated += 1;
      continue;
    }
    pushRevision(post);
    if (action === "status") {
      if (!POST_STATUSES.includes(value)) throw new Error("Invalid status");
      if (DATA.settings.mediaRequired && MEDIA_REQUIRED_STATUSES.includes(value) && !post.mediaUrl) {
        post.revisions.shift();
        skipped.push({ id: post.id, reason: "No image or video attached." });
        continue;
      }
      post.status = value;
      if (value === "published" && !post.publishedAt) post.publishedAt = new Date().toISOString();
    } else if (action === "shift") {
      const days = Number(value);
      if (!Number.isInteger(days) || Math.abs(days) > 365) throw new Error("Shift must be a whole number of days (±365).");
      post.scheduledAt = shiftScheduledAt(post.scheduledAt, days);
    } else if (action === "addChannel" || action === "removeChannel") {
      if (!known.has(value)) throw new Error("Unknown channel");
      const next = action === "addChannel"
        ? [...new Set([...(post.channels || []), value])]
        : (post.channels || []).filter((channel) => channel !== value);
      if (!next.length) {
        post.revisions.shift();
        skipped.push({ id: post.id, reason: "A post needs at least one channel." });
        continue;
      }
      post.channels = next;
    } else if (action === "addTag" || action === "removeTag") {
      const [tag] = cleanTags([value]);
      if (!tag) throw new Error("Enter a tag");
      post.tags = action === "addTag" ? cleanTags([...(post.tags || []), tag]) : (post.tags || []).filter((item) => item !== tag);
    } else {
      throw new Error("Unknown bulk action");
    }
    post.updatedAt = new Date().toISOString();
    updated += 1;
  }
  return { updated, skipped, created };
}

function duplicatePost(post) {
  const now = new Date().toISOString();
  const { revisions, preview, ...rest } = post;
  return {
    ...rest,
    id: `portal-${Date.now()}-${randomUUID().slice(0, 6)}`,
    source: "portal",
    queueId: null,
    title: `${post.title} (copy)`.slice(0, 140),
    status: "draft",
    results: [],
    revisions: [],
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    lastAttemptAt: null,
  };
}

function serveStatic(req, res, pathname) {
  let relative = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  const file = path.resolve(PUBLIC_DIR, `.${relative}`);
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
  };
  res.writeHead(200, {
    "Content-Type": types[ext] || "application/octet-stream",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "SAMEORIGIN",
  });
  fs.createReadStream(file).pipe(res);
}

async function handleApi(req, res, url) {
  // The production PHP proxy tunnels PUT/DELETE through POST (IIS blocks them) and restores the
  // method itself; honor the same header here so direct requests behave identically.
  const override = String(req.headers["x-portal-method"] || "").toUpperCase();
  const method = req.method === "POST" && ["PUT", "PATCH", "DELETE"].includes(override) ? override : req.method || "GET";
  const pathname = url.pathname;

  if (pathname === "/api/health") {
    const now = nowInTimezone(DATA.settings.timezone || "Africa/Cairo");
    const upcoming = DATA.posts
      .filter((post) => post.status === "scheduled" && String(post.scheduledAt) >= now)
      .sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)))[0];
    return json(res, 200, {
      ok: true,
      name: "fatortak-marketing-portal",
      version: 2,
      uptime: Math.round(process.uptime()),
      posts: DATA.posts.length,
      nextPostAt: upcoming?.scheduledAt || null,
      dryRun: Boolean(DATA.settings.dryRun),
      live: LIVE,
      autoPublish: AUTO_PUBLISH,
      schedulerLastTick: lastSchedulerTick,
    });
  }
  if (!isSameOrigin(req)) return json(res, 403, { error: "Cross-origin request blocked." });
  if (!isAuthorized(req, url)) return json(res, 401, { error: "Unauthorized. Set the portal token." });

  if (method === "GET" && pathname === "/api/media/library") {
    return json(res, 200, { library: libraryPayload() });
  }

  if (method === "GET" && pathname === "/api/media") {
    const usage = mediaUsage();
    const media = listUploadedMedia().map((item) => ({ ...item, usage: usage[item.id] || { total: 0, pending: 0 } }));
    return json(res, 200, { media, library: libraryPayload() });
  }

  if (method === "GET" && pathname === "/api/meta") {
    return json(res, 200, meta());
  }

  if (method === "POST" && pathname === "/api/preview") {
    try {
      const body = await readBody(req);
      const existing = body.id ? DATA.posts.find((item) => item.id === body.id) : null;
      const known = new Set(CHANNEL_DEFS.map((channel) => channel.key));
      const draft = {
        id: existing?.id || "preview",
        content: String(body.content ?? existing?.content ?? ""),
        channels: (Array.isArray(body.channels) ? body.channels : existing?.channels || []).filter((key) => known.has(key)),
        utm: existing?.utm || null,
      };
      const mediaUrl = body.mediaUrl ?? existing?.mediaUrl;
      const media = mediaUrl
        ? {
            kind: (body.mediaKind ?? existing?.mediaKind) === "video" ? "video" : "image",
            publicUrl: String(body.mediaPublicUrl ?? existing?.mediaPublicUrl ?? "") || (/^https?:/i.test(mediaUrl) ? mediaUrl : ""),
            posterUrl: String(body.posterUrl ?? existing?.posterUrl ?? ""),
          }
        : null;
      return json(res, 200, { channels: previewPost(draft, media) });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  if (method === "GET" && pathname === "/api/activity") {
    const type = url.searchParams.get("type");
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const postId = url.searchParams.get("postId");
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    let items = DATA.activity;
    if (type) items = items.filter((item) => item.type === type);
    if (postId) items = items.filter((item) => item.postId === postId);
    if (q) items = items.filter((item) => String(item.message).toLowerCase().includes(q));
    const types = [...new Set(DATA.activity.map((item) => item.type))].sort();
    return json(res, 200, { items: items.slice(offset, offset + limit), total: items.length, offset, limit, types });
  }

  if (pathname === "/api/templates" || pathname.startsWith("/api/templates/")) {
    const id = pathname === "/api/templates" ? "" : decodeURIComponentSafe(pathname.slice("/api/templates/".length));
    const index = id ? DATA.templates.findIndex((item) => item.id === id) : -1;
    if (id && index < 0) return json(res, 404, { error: "Template not found" });
    try {
      if (method === "GET" && !id) return json(res, 200, { templates: DATA.templates });
      if ((method === "POST" && !id) || (method === "PUT" && id)) {
        const body = await readBody(req);
        const current = id ? DATA.templates[index] : null;
        const name = String(body.name ?? current?.name ?? "").trim().slice(0, 80);
        const content = String(body.content ?? current?.content ?? "");
        if (!name) throw new Error("Template name is required");
        if (!content.trim()) throw new Error("Template content is required");
        const known = new Set(CHANNEL_DEFS.map((channel) => channel.key));
        const template = {
          id: current?.id || `tpl-${Date.now()}-${randomUUID().slice(0, 6)}`,
          name,
          content,
          language: body.language === "ar" ? "ar" : body.language === "en" ? "en" : current?.language || "en",
          pillar: String(body.pillar || current?.pillar || "product").slice(0, 40),
          channels: (Array.isArray(body.channels) ? body.channels : current?.channels || []).filter((key) => known.has(key)),
          createdAt: current?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (current) DATA.templates[index] = template;
        else DATA.templates.unshift(template);
        addActivity(DATA, "template", `${current ? "Updated" : "Created"} template “${template.name}”.`);
        saveData();
        return json(res, current ? 200 : 201, { template });
      }
      if (method === "DELETE" && id) {
        const [removed] = DATA.templates.splice(index, 1);
        addActivity(DATA, "template", `Deleted template “${removed.name}”.`);
        saveData();
        return json(res, 200, { ok: true });
      }
      return json(res, 405, { error: "Method not allowed" });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  if (method === "POST" && pathname === "/api/media") {
    try {
      const rawName = req.headers["x-file-name"] || "upload";
      let original = "upload";
      try {
        original = decodeURIComponent(String(rawName));
      } catch {
        original = String(rawName);
      }
      original = path.basename(original).slice(0, 160);
      const headerType = String(req.headers["content-type"] || "");
      const kind = mediaTypeFromName(original, headerType.startsWith("video/") ? "video" : headerType.startsWith("image/") ? "image" : "");
      if (!kind) return json(res, 400, { error: "Only image and video files are allowed." });
      const ext = path.extname(original).toLowerCase() || (kind === "video" ? ".mp4" : ".png");
      if (!ALLOWED_MEDIA_EXT.has(ext)) {
        return json(res, 400, { error: `Unsupported file type ${ext}. Use PNG, JPG, WebP, GIF, AVIF, MP4, MOV, WebM or M4V.` });
      }
      const buffer = await readBinary(req);
      if (!buffer.length) return json(res, 400, { error: "The uploaded file is empty." });
      const base = path.basename(original, path.extname(original)).replace(/[^\w\- ]+/g, "_").slice(0, 60) || "upload";
      const filename = `${Date.now()}-${randomUUID().slice(0, 6)}-${base}${ext}`;
      const file = path.join(MEDIA_DIR, filename);
      fs.writeFileSync(file, buffer);
      const media = {
        id: filename,
        name: original,
        url: `${PUBLIC_BASE}/media/${encodeURIComponent(filename)}`,
        publicUrl: absoluteMediaUrl(`/media/${encodeURIComponent(filename)}`),
        kind,
        contentType: headerType || mediaContentType(filename),
        size: buffer.length,
      };
      addActivity(DATA, "media", `Uploaded ${original} (${Math.round(buffer.length / 1024)} KB).`);
      saveData();
      return json(res, 201, { media });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  const mediaMatch = pathname.match(/^\/api\/media\/([^/]+)$/);
  if (method === "DELETE" && mediaMatch) {
    const id = path.basename(decodeURIComponent(mediaMatch[1]));
    const file = path.join(MEDIA_DIR, id);
    if (!fs.existsSync(file)) return json(res, 404, { error: "Media not found" });
    const usage = mediaUsage()[id];
    if (usage?.pending && url.searchParams.get("force") !== "1") {
      return json(res, 409, {
        error: `${usage.pending} unpublished post${usage.pending === 1 ? " uses" : "s use"} this file. Replace it there first.`,
        usage,
      });
    }
    fs.unlinkSync(file);
    addActivity(DATA, "media", `Deleted media ${id}.`);
    saveData();
    return json(res, 200, { ok: true });
  }

  const connectionMatch = pathname.match(/^\/api\/connections\/([^/]+)\/(credentials|test)$/);
  if (connectionMatch) {
    const channel = decodeURIComponent(connectionMatch[1]);
    const action = connectionMatch[2];
    if (!CHANNEL_DEFS.some((item) => item.key === channel)) return json(res, 404, { error: "Unknown channel" });
    if (action === "credentials" && method === "PUT") {
      try {
        const body = await readBody(req);
        const values = body.values && typeof body.values === "object" ? body.values : {};
        const allowed = CREDENTIAL_KEYS[channel];
        if (!allowed) return json(res, 400, { error: "This channel has no API credentials to connect." });
        const clean = {};
        for (const [key, value] of Object.entries(values)) {
          if (!allowed.includes(key)) throw new Error(`Unknown credential field: ${key}`);
          const text = String(value ?? "").replace(/[\r\n]/g, " ").trim();
          if (text) clean[key] = text;
        }
        if (!Object.keys(clean).length) throw new Error("Enter at least one credential value.");
        writeEnvValues(clean);
        DATA.connectionChecks[channel] = null;
        addActivity(DATA, "connection", `Saved ${Object.keys(clean).length} credential${Object.keys(clean).length === 1 ? "" : "s"} for ${channel}.`);
        saveData();
        return json(res, 200, { channel: channelInfo(channel) });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }
    if (action === "test" && method === "POST") {
      try {
        const result = await testConnection(channel);
        DATA.connectionChecks[channel] = { at: new Date().toISOString(), ...result };
        addActivity(DATA, "connection", `${channel} connection test: ${result.ok ? "ok" : "failed"}.`);
        saveData();
        return json(res, 200, { channel: channelInfo(channel), result });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }
  }

  if (method === "GET" && pathname === "/api/overview") {
    const [traffic, siteLive] = await Promise.all([trafficForView(), siteLiveForView()]);
    const payload = overview();
    payload.traffic = traffic;
    payload.siteLive = siteLive;
    return json(res, 200, payload);
  }

  if (method === "GET" && pathname === "/api/posts") {
    return json(res, 200, { posts: filterPosts(url.searchParams).map(listPost) });
  }

  if (method === "POST" && pathname === "/api/posts/bulk") {
    try {
      const body = await readBody(req);
      const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 2000) : [];
      if (!ids.length) throw new Error("Select at least one post");
      const result = applyBulk(String(body.action || ""), ids, body.value);
      const labels = {
        delete: "Deleted",
        duplicate: "Duplicated",
        status: `Set status ${String(body.value).replace(/_/g, " ")} on`,
        shift: `Moved ${Number(body.value) > 0 ? "+" : ""}${body.value} day(s):`,
        addChannel: `Added ${body.value} to`,
        removeChannel: `Removed ${body.value} from`,
        addTag: `Tagged #${body.value}:`,
        removeTag: `Untagged #${body.value}:`,
      };
      if (result.updated) {
        addActivity(DATA, "bulk", `${labels[body.action] || "Updated"} ${result.updated} post${result.updated === 1 ? "" : "s"}${result.skipped.length ? ` (${result.skipped.length} skipped)` : ""}.`);
        saveData();
      }
      return json(res, 200, result);
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  if (method === "POST" && pathname === "/api/posts") {
    try {
      const body = await readBody(req);
      const input = validatePostInput(body);
      const now = new Date().toISOString();
      const post = {
        id: `portal-${Date.now()}-${randomUUID().slice(0, 6)}`,
        source: "portal",
        queueId: null,
        ...input,
        results: [],
        revisions: [],
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
        lastAttemptAt: null,
      };
      DATA.posts.push(post);
      addActivity(DATA, "created", `Created “${post.title}”.`, post.id);
      saveData();
      return json(res, 201, { post: listPost(post) });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  const postMatch = pathname.match(/^\/api\/posts\/([^/]+)(?:\/(publish|status|duplicate|restore))?$/);
  if (postMatch) {
    const id = decodeURIComponentSafe(postMatch[1]);
    const action = postMatch[2];
    const post = DATA.posts.find((item) => item.id === id);
    if (!post) return json(res, 404, { error: "Post not found" });
    const busy = post.status === "publishing" && method !== "GET";
    if (busy) return json(res, 409, { error: "This post is publishing right now. Try again in a moment." });

    if (method === "GET" && !action) {
      const media = await resolvePostMedia(post);
      return json(res, 200, { post, preview: previewPost(post, media ? { ...media, posterUrl: post.posterUrl || "" } : null) });
    }

    if (method === "PUT" && !action) {
      try {
        const body = await readBody(req);
        if (body.updatedAt && post.updatedAt && body.updatedAt !== post.updatedAt) {
          return json(res, 409, { error: "This post was changed elsewhere since you opened it. Reload it to see the latest version.", post: listPost(post) });
        }
        const input = validatePostInput(body, post);
        pushRevision(post);
        Object.assign(post, input, { updatedAt: new Date().toISOString() });
        addActivity(DATA, "updated", `Updated “${post.title}”.`, post.id);
        saveData();
        return json(res, 200, { post: listPost(post) });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (method === "POST" && action === "restore") {
      try {
        const body = await readBody(req);
        const revisions = Array.isArray(post.revisions) ? post.revisions : [];
        const revision = revisions[Number(body.index)];
        if (!revision) throw new Error("Revision not found");
        const { at, ...fields } = revision;
        // Restore the content; keep the current status unless the old one is still valid without media.
        const input = validatePostInput({ ...fields, status: post.status }, post);
        pushRevision(post);
        Object.assign(post, input, { updatedAt: new Date().toISOString() });
        addActivity(DATA, "updated", `Restored “${post.title}” to the version from ${String(at).slice(0, 16).replace("T", " ")}.`, post.id);
        saveData();
        return json(res, 200, { post });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (method === "DELETE" && !action) {
      DATA.posts = DATA.posts.filter((item) => item.id !== id);
      addActivity(DATA, "deleted", `Deleted “${post.title}”.`, post.id);
      saveData();
      return json(res, 200, { ok: true });
    }

    if (method === "POST" && action === "status") {
      try {
        const body = await readBody(req);
        if (!POST_STATUSES.includes(body.status)) throw new Error("Invalid status");
        if (DATA.settings.mediaRequired && MEDIA_REQUIRED_STATUSES.includes(body.status) && !post.mediaUrl) {
          throw new Error("Attach an image or video before scheduling or publishing.");
        }
        if (post.status !== body.status) pushRevision(post);
        post.status = body.status;
        post.updatedAt = new Date().toISOString();
        if (body.status === "published" && !post.publishedAt) post.publishedAt = new Date().toISOString();
        addActivity(DATA, "status", `Status “${post.title}” → ${body.status.replace(/_/g, " ")}.`, post.id);
        saveData();
        return json(res, 200, { post: listPost(post) });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (method === "POST" && action === "duplicate") {
      const copy = duplicatePost(post);
      DATA.posts.push(copy);
      addActivity(DATA, "created", `Duplicated “${post.title}”.`, copy.id);
      saveData();
      return json(res, 201, { post: listPost(copy) });
    }

    if (method === "POST" && action === "publish") {
      try {
        const body = await readBody(req);
        const dryRun = body.dryRun !== false;
        if (!dryRun && !LIVE) {
          return json(res, 403, { error: "Live publishing is locked. Set MARKETING_LIVE=true on the portal server." });
        }
        const channels = Array.isArray(body.channels) ? body.channels.map(String) : null;
        if (!dryRun && post.status === "published" && !channels?.length && body.force !== true) {
          return json(res, 409, {
            error: "This post is already published. Re-publishing would duplicate it on every channel; retry specific channels from Channel status instead.",
          });
        }
        const previousStatus = post.status;
        if (!dryRun) post.status = "publishing";
        let result;
        try {
          result = await publishPost(post, { dryRun, automatic: false, channels });
        } catch (error) {
          if (post.status === "publishing") post.status = previousStatus;
          throw error;
        }
        return json(res, 200, { post: listPost(post), result });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }
  }

  if (method === "GET" && pathname === "/api/calendar") {
    return json(res, 200, calendar(url.searchParams.get("month")));
  }

  if (method === "GET" && pathname === "/api/connections") {
    return json(res, 200, { channels: channelSummary() });
  }

  if (method === "GET" && pathname === "/api/metrics") {
    const traffic = await trafficForView();
    return json(res, 200, { metrics: DATA.metrics, totals: metricsTotals(), traffic });
  }

  if (method === "POST" && pathname === "/api/metrics/sync") {
    try {
      const result = await syncMetrics();
      return json(res, 200, result);
    } catch (error) {
      return json(res, 500, { error: error.message });
    }
  }

  if (method === "GET" && pathname === "/api/reports/summary") {
    const [traffic] = await Promise.all([trafficForView(), siteLiveForView()]);
    return json(res, 200, { ...reportsSummary(), traffic });
  }

  if (method === "GET" && pathname === "/api/reports/export") {
    const stamp = nowInTimezone(DATA.settings.timezone).slice(0, 10);
    const filtered = [...url.searchParams.keys()].some((key) => ["status", "channel", "lang", "tag", "pillar", "q"].includes(key));
    if (url.searchParams.get("format") === "json") {
      const payload = JSON.stringify(
        { exportedAt: new Date().toISOString(), posts: filtered ? filterPosts(url.searchParams) : DATA.posts, templates: DATA.templates, metrics: DATA.metrics, reports: reportsSummary() },
        null,
        2
      );
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename=fatortak-portal-${stamp}.json`,
        "Cache-Control": "no-store",
      });
      res.end(payload);
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=fatortak-posts-${stamp}.csv`,
      "Cache-Control": "no-store",
    });
    res.end(exportCsv(filtered ? filterPosts(url.searchParams) : DATA.posts));
    return;
  }

  if (method === "GET" && pathname === "/api/settings") {
    return json(res, 200, {
      settings: DATA.settings,
      live: LIVE,
      autoPublish: AUTO_PUBLISH,
      dryRun: DATA.settings.dryRun,
    });
  }

  if (method === "PUT" && pathname === "/api/settings") {
    try {
      const body = await readBody(req);
      const next = {};
      for (const key of ["dryRun", "autoApprove", "requireLiveSite", "mediaRequired"]) {
        if (key in body) {
          if (typeof body[key] !== "boolean") throw new Error(`${key} must be true or false.`);
          next[key] = body[key];
        }
      }
      if ("timezone" in body) {
        const zone = String(body.timezone || "").trim();
        if (!isValidTimezone(zone)) throw new Error(`Unknown timezone “${zone}”. Use an IANA name such as Africa/Cairo.`);
        next.timezone = zone;
      }
      if ("publicUrl" in body) {
        const value = String(body.publicUrl || "").trim().replace(/\/$/, "");
        if (value && !/^https?:\/\/[^/]+/i.test(value)) throw new Error("Public media host must be an http(s) URL.");
        next.publicUrl = value;
      }
      const changed = Object.keys(next).filter((key) => DATA.settings[key] !== next[key]);
      Object.assign(DATA.settings, next);
      if ("publicUrl" in next) publicBaseOverride = next.publicUrl;
      if (changed.length) {
        const summary = changed
          .map((key) => (typeof next[key] === "boolean" ? `${key} ${next[key] ? "on" : "off"}` : `${key} → ${next[key] || "(empty)"}`))
          .join(", ");
        addActivity(DATA, "settings", `Settings changed: ${summary}.`);
      }
      saveData();
      return json(res, 200, { settings: DATA.settings, changed });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  if (method === "POST" && pathname === "/api/import-queue") {
    const imported = seedQueue(DATA);
    if (imported) addActivity(DATA, "import", `Imported ${imported} queue posts.`);
    saveData();
    return json(res, 200, { imported });
  }

  return json(res, 404, { error: "Not found" });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    if (url.pathname.startsWith("/media/")) {
      serveMedia(req, res, url.pathname);
      return;
    }
    serveStatic(req, res, url.pathname);
  } catch (error) {
    if (!res.headersSent) json(res, 500, { error: error.message });
    else res.end();
  }
});

let schedulerBusy = false;
let lastSchedulerTick = null;

function nowInTimezone(timeZone = "Africa/Cairo") {
  return wallClock(new Date(), timeZone);
}

async function schedulerTick() {
  lastSchedulerTick = new Date().toISOString();
  if (schedulerBusy || !AUTO_PUBLISH || !LIVE || DATA.settings.dryRun) return;
  schedulerBusy = true;
  try {
    const now = nowInTimezone(DATA.settings.timezone || "Africa/Cairo");
    const due = DATA.posts
      .filter((post) => post.status === "scheduled" && String(post.scheduledAt) <= now)
      .sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
    for (const post of due) {
      // Earlier publishes in this tick can take a while; skip posts edited, paused or deleted meanwhile.
      if (DATA.settings.dryRun || post.status !== "scheduled" || !DATA.posts.includes(post)) continue;
      post.status = "publishing";
      saveData();
      try {
        await publishPost(post, { dryRun: false, automatic: true });
      } catch (error) {
        post.status = "failed";
        post.lastAttemptAt = new Date().toISOString();
        post.results = [{ ok: false, error: error.message }];
        addActivity(DATA, "failed", `Publish crashed for “${post.title}”: ${error.message}`, post.id);
        saveData();
      }
    }
  } finally {
    schedulerBusy = false;
  }
}

setInterval(schedulerTick, 60_000);
setTimeout(schedulerTick, 5_000);
setInterval(() => {
  syncMetrics().catch((error) => console.error(`Metrics sync failed: ${error.message}`));
}, 6 * 60 * 60 * 1000);
setTimeout(() => {
  syncMetrics().catch((error) => console.error(`Initial metrics sync failed: ${error.message}`));
}, 30_000);

process.on("uncaughtException", (error) => {
  console.error(`Uncaught exception: ${error?.stack || error}`);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error(`Unhandled rejection: ${reason?.stack || reason}`);
});

server.listen(PORT, HOST, () => {
  console.log(`Fatortak marketing portal: http://${HOST}:${PORT}`);
  console.log(`Data: ${DATA_FILE}`);
  console.log(`Media: ${MEDIA_DIR}`);
  console.log(`Screenshots: ${SCREENSHOTS_DIR}`);
  console.log(`Live publishing: ${LIVE ? "enabled" : "locked (set MARKETING_LIVE=true)"}`);
  console.log(`Auto-publish scheduler: ${AUTO_PUBLISH ? "enabled" : "disabled (set PORTAL_AUTO_PUBLISH=true)"}`);
  console.log(`Dry run: ${DATA.settings.dryRun ? "on" : "off"}`);
});
