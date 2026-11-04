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
  publishStory,
  STORY_CHANNELS,
  COMMENT_CHANNELS,
  DM_CHANNELS,
  fetchComments,
  replyToComment,
  sendDirectMessage,
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

// PORTAL_ISOLATED=1 (used by tests) ignores the shared automation credentials entirely.
if (process.env.PORTAL_ISOLATED !== "1") loadDotEnv(path.join(MARKETING_ROOT, "automation", ".env"));
// The same file is read at startup and written by the Connections wizard.
const ENV_FILE = process.env.PORTAL_ENV_FILE ? path.resolve(process.env.PORTAL_ENV_FILE) : path.join(HERE, ".env");
loadDotEnv(ENV_FILE);

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

// Plain-language connection guides: what each field is, where to find it, and how to check it
// before saving. `optional` fields are not needed to post.
const FIELD_META = {
  X_API_KEY: { label: "API key (consumer key)", help: "developer.x.com → your app → Keys and tokens → Consumer keys.", secret: true },
  X_API_SECRET: { label: "API key secret", help: "Shown next to the API key. Regenerate it if you lost it.", secret: true },
  X_OAUTH1_ACCESS_TOKEN: { label: "Access token", help: "Keys and tokens → Authentication tokens → Access token. Generate it after setting Read and write permission.", secret: true, pattern: "^\\d+-[A-Za-z0-9]+$", example: "1234567890-AbCdEf…" },
  X_OAUTH1_ACCESS_TOKEN_SECRET: { label: "Access token secret", help: "Shown once together with the access token.", secret: true },
  X_ACCESS_TOKEN: { label: "OAuth 2.0 user token", help: "Only needed if you do not use the four OAuth 1.0a keys above. Text posts only.", secret: true, optional: true },
  LINKEDIN_ACCESS_TOKEN: { label: "Access token", help: "LinkedIn developer portal → your app → Auth → OAuth token tools, with w_organization_social.", secret: true },
  LINKEDIN_AUTHOR_URN: { label: "Company page ID (URN)", help: "The number in your page admin link linkedin.com/company/<number>/admin.", pattern: "^urn:li:(organization|person):\\d+$", example: "urn:li:organization:109974822" },
  LINKEDIN_VERSION: { label: "API version", help: "Year and month, e.g. 202601. Leave empty to use the default.", pattern: "^\\d{6}$", example: "202601", optional: true },
  FACEBOOK_PAGE_ID: { label: "Page ID", help: "Facebook Page → About → Page transparency, or Meta Business Suite → Settings.", pattern: "^\\d{5,}$", example: "1338665946004849" },
  FACEBOOK_PAGE_ACCESS_TOKEN: { label: "Page access token", help: "Graph API Explorer → your app → Get Page access token (pages_manage_posts). Exchange it for a long-lived token.", secret: true },
  INSTAGRAM_USER_ID: { label: "Instagram business account ID", help: "Graph API Explorer: GET /<page-id>?fields=instagram_business_account.", pattern: "^\\d{5,}$", example: "17841429322066567" },
  INSTAGRAM_ACCESS_TOKEN: { label: "Access token", help: "A token with instagram_basic and instagram_content_publish. The Page token works when the account is linked.", secret: true },
  THREADS_USER_ID: { label: "Threads user ID", help: "Returned by GET graph.threads.net/v1.0/me after you sign in to the Threads API.", pattern: "^\\d+$" },
  THREADS_ACCESS_TOKEN: { label: "Threads access token", help: "Needs threads_basic and threads_content_publish.", secret: true },
  BLUESKY_HANDLE: { label: "Handle", help: "Your handle without @, e.g. fatortak.bsky.social.", pattern: "^[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$", example: "fatortak.bsky.social" },
  BLUESKY_APP_PASSWORD: { label: "App password", help: "Bluesky → Settings → Privacy and security → App passwords → Add. Not your login password.", secret: true, pattern: "^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$", example: "abcd-efgh-ijkl-mnop" },
  BLUESKY_SERVICE: { label: "Server", help: "Leave empty unless you self-host.", pattern: "^https://", example: "https://bsky.social", optional: true },
  MASTODON_INSTANCE: { label: "Server address", help: "The server your account lives on.", pattern: "^https://", example: "https://mastodon.social", optional: true },
  MASTODON_ACCESS_TOKEN: { label: "Access token", help: "Preferences → Development → New application (write:statuses, write:media) → Your access token.", secret: true },
  MASTODON_ACCOUNT: { label: "Account", help: "Used for follower metrics, e.g. fatortaksoftware@mastodon.social.", optional: true },
  TELEGRAM_BOT_TOKEN: { label: "Bot token", help: "Open @BotFather → /newbot → copy the token.", secret: true, pattern: "^\\d+:[A-Za-z0-9_-]{30,}$", example: "123456789:AA…" },
  TELEGRAM_CHAT_ID: { label: "Channel ID", help: "Add the bot as an admin of your channel, then use the channel's @username or its -100… ID.", pattern: "^(-100\\d+|@[A-Za-z0-9_]{5,})$", example: "-1001234567890 or @fatortak" },
  DISCORD_WEBHOOK_URL: { label: "Webhook URL", help: "Channel settings → Integrations → Webhooks → New webhook → Copy URL.", secret: true, pattern: "^https://(discord|discordapp)\\.com/api/webhooks/", example: "https://discord.com/api/webhooks/…" },
  DEVTO_API_KEY: { label: "API key", help: "dev.to → Settings → Extensions → DEV Community API keys → Generate.", secret: true },
};

const CHANNEL_GUIDES = {
  facebook: { effort: "15 min", difficulty: "medium", steps: ["Make sure you are an admin of the Facebook Page.", "Create a Meta app (type Business) and add Facebook Login for Business.", "In Graph API Explorer, pick the app and Page, grant pages_manage_posts and pages_read_engagement, and copy the Page token.", "Paste the Page ID and token here and press Save & test."] },
  instagram: { effort: "15 min", difficulty: "medium", steps: ["Switch the Instagram account to Business or Creator.", "Link it to your Facebook Page (Page settings → Linked accounts).", "Grant instagram_basic and instagram_content_publish to your Meta app and copy the token.", "Find the Instagram business account ID and paste both here."] },
  x: { effort: "10 min", difficulty: "medium", steps: ["Sign in to developer.x.com with the brand account and create a project and app.", "Set app permissions to Read and write.", "Generate the API key/secret and the access token/secret.", "Paste all four here. Posting needs X API credits on the account."] },
  linkedin: { effort: "Needs approval", difficulty: "hard", steps: ["Create an app at linkedin.com/developers and verify it with your company page.", "Request the Community Management API (LinkedIn reviews this).", "After approval, generate a token with w_organization_social.", "Paste the token and your company URN here."] },
  bluesky: { effort: "2 min", difficulty: "easy", steps: ["Open Bluesky → Settings → Privacy and security → App passwords.", "Create an app password named Fatortak portal.", "Paste your handle and the app password here."] },
  mastodon: { effort: "3 min", difficulty: "easy", steps: ["On your Mastodon server open Preferences → Development → New application.", "Tick write:statuses and write:media, then save.", "Open the application and copy Your access token here."] },
  threads: { effort: "Needs approval", difficulty: "hard", steps: ["Add the Threads API use case to your Meta app.", "Add your Threads account as a tester (or pass App Review).", "Sign in through the Threads API and copy the user ID and token."] },
  telegram: { effort: "3 min", difficulty: "easy", steps: ["Message @BotFather, send /newbot and copy the token.", "Add the bot to your channel as an administrator who can post.", "Paste the token and your channel @username here."] },
  discord: { effort: "1 min", difficulty: "easy", steps: ["Open the Discord channel settings → Integrations → Webhooks.", "Create a webhook and copy its URL here."] },
  devto: { effort: "1 min", difficulty: "easy", steps: ["Open dev.to → Settings → Extensions.", "Generate a DEV Community API key and paste it here. Dev.to receives articles, not short posts."] },
};

const CHANNEL_CAPABILITIES = {
  facebook: { text: true, image: true, video: true, story: true, comments: true, dm: true, metrics: true },
  instagram: { text: false, image: true, video: true, story: true, comments: true, dm: true, metrics: true },
  x: { text: true, image: true, video: false, story: false, comments: false, dm: false, metrics: true },
  linkedin: { text: true, image: true, video: false, story: false, comments: false, dm: false, metrics: false },
  bluesky: { text: true, image: true, video: true, story: false, comments: true, dm: true, metrics: true },
  mastodon: { text: true, image: true, video: true, story: false, comments: true, dm: true, metrics: true },
  threads: { text: true, image: true, video: true, story: false, comments: false, dm: false, metrics: false },
  telegram: { text: true, image: true, video: true, story: false, comments: false, dm: false, metrics: false },
  discord: { text: true, image: true, video: true, story: false, comments: false, dm: false, metrics: false },
  devto: { text: true, image: true, video: false, story: false, comments: false, dm: false, metrics: true },
};

// What each channel needs before comments and DMs work, shown in the inbox and rule builder.
const ENGAGE_NOTES = {
  facebook: "Comments need pages_read_engagement + pages_read_user_content. DMs are “private replies” and need pages_messaging (Meta app review), one per comment, within 7 days.",
  instagram: "Comments need instagram_manage_comments. DMs are “private replies” and need instagram_manage_messages (Meta app review), one per comment, within 7 days.",
  bluesky: "Replies are public. DMs need an app password created with “Allow access to your direct messages”, and the person must accept messages from you.",
  mastodon: "DMs are posts with direct visibility that mention the person.",
  x: "Reading replies and sending DMs need a paid X API tier.",
  linkedin: "Comments need the Community Management API; LinkedIn has no DM API for pages.",
  threads: "Replies need threads_read_replies (app review); Threads has no DM API.",
};

// What platforms typically reward for a brand account. Used by the content audit and as
// one-click defaults for per-channel daily caps.
const RECOMMENDED_DAILY = { facebook: 2, instagram: 2, linkedin: 1, threads: 4, x: 8, bluesky: 8, mastodon: 6, telegram: 4, discord: 4, devto: 1 };

function credentialFields(key) {
  const required = new Set(connectionState(key).env || []);
  return (CREDENTIAL_KEYS[key] || []).map((name) => {
    const meta = FIELD_META[name] || {};
    return {
      key: name,
      label: meta.label || name,
      help: meta.help || "",
      secret: Boolean(meta.secret),
      pattern: meta.pattern || "",
      example: meta.example || "",
      required: required.has(name) && !meta.optional,
      saved: Boolean(env(name)),
      // Show non-secret values so people can see what is configured; secrets stay hidden.
      value: meta.secret ? "" : String(env(name) || ""),
    };
  });
}

function validateCredentials(channel, values) {
  const errors = [];
  for (const [key, value] of Object.entries(values)) {
    const meta = FIELD_META[key];
    if (meta?.pattern && value && !new RegExp(meta.pattern).test(value)) {
      errors.push(`${meta.label}: that doesn't look right${meta.example ? ` (expected something like ${meta.example})` : ""}.`);
    }
  }
  return errors;
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
    fields: credentialFields(key),
    guide: CHANNEL_GUIDES[key] || null,
    capabilities: CHANNEL_CAPABILITIES[key] || { text: false, image: false, video: false, story: false, metrics: false },
    recommendedDaily: RECOMMENDED_DAILY[key] || 0,
    rule: DATA.settings.channelRules?.[key] || null,
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
    // Per-channel publishing rules: { [channel]: { dailyCap, hashtags, linkInBio, linkText } }
    channelRules: {},
  };
}

function cleanChannelRules(input) {
  const rules = {};
  const known = new Set(CHANNEL_DEFS.map((channel) => channel.key));
  for (const [key, raw] of Object.entries(input && typeof input === "object" ? input : {})) {
    if (!known.has(key) || !raw || typeof raw !== "object") continue;
    const dailyCap = Number(raw.dailyCap || 0);
    if (!Number.isInteger(dailyCap) || dailyCap < 0 || dailyCap > 100) throw new Error(`${key}: daily cap must be a whole number from 0 (no cap) to 100.`);
    const hashtags = String(raw.hashtags || "")
      .split(/[\s,]+/)
      .map((tag) => tag.trim().replace(/^#*/, ""))
      .filter(Boolean)
      .slice(0, 15)
      .map((tag) => `#${tag}`)
      .join(" ");
    const rule = {
      dailyCap,
      hashtags,
      linkInBio: Boolean(raw.linkInBio),
      linkText: String(raw.linkText || "").trim().slice(0, 60),
    };
    if (rule.dailyCap || rule.hashtags || rule.linkInBio) rules[key] = rule;
  }
  return rules;
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
    overrides: { ...(post.overrides || {}) },
    channelMedia: JSON.parse(JSON.stringify(post.channelMedia || {})),
    storyMedia: post.storyMedia ? { ...post.storyMedia } : null,
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
  data.automations = Array.isArray(data.automations) ? data.automations : [];
  data.automationRuns = Array.isArray(data.automationRuns) ? data.automationRuns.slice(0, 500) : [];
  data.comments = Array.isArray(data.comments) ? data.comments.slice(0, 5000) : [];
  data.commentRules = Array.isArray(data.commentRules) ? data.commentRules : [];
  data.commentRuleSent = data.commentRuleSent && typeof data.commentRuleSent === "object" ? data.commentRuleSent : {};
  data.savedReplies = Array.isArray(data.savedReplies) ? data.savedReplies : [];
  data.commentsSyncedAt = data.commentsSyncedAt || null;
  data.metricsHistory = Array.isArray(data.metricsHistory) ? data.metricsHistory.slice(-180) : [];
  // Deleted posts stay restorable for 30 days.
  const trashCutoff = Date.now() - 30 * 86_400_000;
  data.trash = (Array.isArray(data.trash) ? data.trash : []).filter((item) => item?.post && Date.parse(item.deletedAt) > trashCutoff);
  if (!data.settings.channelRules || typeof data.settings.channelRules !== "object") data.settings.channelRules = {};
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
  const file = ENV_FILE;
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
      engagement = 0;
      for (const item of feed.feed || []) {
        const likes = Number(item.post?.likeCount || 0);
        const reposts = Number(item.post?.repostCount || 0);
        const replies = Number(item.post?.replyCount || 0);
        engagement += likes + reposts + replies;
        recordPostMetric("bluesky", item.post?.uri, { likes, reposts, replies, engagement: likes + reposts + replies });
      }
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
    windows: { engagement: "likes + reposts + replies on the latest 30 posts", posts: "all-time account posts" },
    note: `@${handle}`,
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
      engagement = 0;
      for (const status of statuses || []) {
        const likes = Number(status.favourites_count || 0);
        const reposts = Number(status.reblogs_count || 0);
        const replies = Number(status.replies_count || 0);
        engagement += likes + reposts + replies;
        recordPostMetric("mastodon", status.id, { likes, reposts, replies, engagement: likes + reposts + replies });
      }
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
    windows: { engagement: "favourites + boosts + replies on the latest 20 posts", posts: "all-time account posts" },
    note: `@${account}`,
  };
  return { channel: "mastodon", followers: data.followers_count || 0 };
}

// Attach platform numbers to the portal post that produced them (matched by the id the
// platform returned when we published), so Reports can rank posts by real engagement.
function recordPostMetric(channel, platformId, values) {
  if (!platformId) return;
  const id = String(platformId);
  for (const post of DATA.posts) {
    if (!(post.results || []).some((result) => result.channel === channel && result.ok && String(result.id) === id)) continue;
    post.metrics = post.metrics && typeof post.metrics === "object" ? post.metrics : {};
    post.metrics[channel] = { ...values, at: new Date().toISOString() };
    return;
  }
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
  // Newest first: the old code took the first 20 ids in queue order, i.e. the oldest posts,
  // so anything published after the 20th post was never measured.
  const published = DATA.posts
    .flatMap((post) =>
      (post.results || [])
        .filter((result) => result.channel === "facebook" && result.ok && !result.dryRun && result.id)
        .map((result) => ({ id: String(result.id), at: result.at || post.publishedAt || "" }))
    )
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const postIds = [...new Set(published.map((item) => item.id))];
  const cutoff = Date.now() - 28 * 86_400_000;
  const recent = published.filter((item) => Date.parse(item.at) >= cutoff).map((item) => item.id);
  const sample = [...new Set(recent.length ? recent : postIds)].slice(0, 30);
  let reach = null;
  let views = null;
  let reactions = 0;
  let clicks = 0;
  let counted = 0;
  const notes = [];
  for (const postId of sample) {
    try {
      const insights = await graphGet(
        `${postId}/insights`,
        { metric: "post_reactions_by_type_total,post_clicks,post_media_view,post_total_media_view_unique" },
        token
      );
      const postReactions = insightNumeric(insights, "post_reactions_by_type_total") || 0;
      const postClicks = insightNumeric(insights, "post_clicks") || 0;
      const postViews = insightNumeric(insights, "post_media_view") || 0;
      const postReach = insightNumeric(insights, "post_total_media_view_unique") || 0;
      reactions += postReactions;
      clicks += postClicks;
      views = (views || 0) + postViews;
      reach = (reach || 0) + postReach;
      counted += 1;
      recordPostMetric("facebook", postId, { reach: postReach, views: postViews, reactions: postReactions, clicks: postClicks, engagement: postReactions + postClicks });
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
    windows: {
      reach: `sum of per-post unique viewers across ${counted} portal posts from the last 28 days (people who saw several posts count once per post)`,
      engagement: `reactions + clicks on the same ${counted} posts`,
      clicks: `link and media clicks on the same ${counted} posts`,
      posts: "posts published by the portal",
    },
    note: `Page: ${profile.name || pageId}${views !== null ? ` · ${views} media views` : ""}${notes.length ? ` · ${notes[0]}` : ""}`,
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
  // Without since/until, period=day returns only the latest day. Ask for an explicit 28-day window.
  const until = Math.floor(Date.now() / 1000);
  const since = until - 28 * 86_400;
  let reachWindow = "unique accounts reached in the last 28 days";
  try {
    const insights = await graphGet(
      `${userId}/insights`,
      { metric: "reach,views", period: "day", metric_type: "total_value", since, until },
      token
    );
    reach = insightTotal(insights, "reach");
    views = insightTotal(insights, "views");
  } catch (error) {
    notes.push(`insights: ${error.message}`);
    try {
      const insights = await graphGet(`${userId}/insights`, { metric: "reach", period: "days_28" }, token);
      reach = insightNumeric(insights, "reach");
    } catch (fallbackError) {
      reachWindow = "not available";
      notes.push(`fallback: ${fallbackError.message}`);
    }
  }
  try {
    const media = await graphGet(`${userId}/media`, { fields: "id,like_count,comments_count", limit: "50" }, token);
    engagement = 0;
    for (const item of media.data || []) {
      const likes = Number(item.like_count || 0);
      const comments = Number(item.comments_count || 0);
      engagement += likes + comments;
      recordPostMetric("instagram", item.id, { likes, comments, engagement: likes + comments });
    }
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
    windows: { reach: reachWindow, engagement: "likes + comments on the latest 50 posts", posts: "all-time account posts" },
    note: `@${profile.username || userId}${views !== null ? ` · ${views} views (28 days)` : ""}${notes.length ? ` · ${notes[0]}` : ""}`,
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
    windows: { posts: "all-time account posts" },
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
    windows: { reach: "lifetime page views of published articles", engagement: "lifetime reactions + comments", posts: "published articles" },
    note: `@${profile.username || "fatortak"} · ${articles.length} published article${
      articles.length === 1 ? "" : "s"
    }${articles.length ? "" : " · no articles yet"}`,
  };
  return { channel: "devto", posts: articles.length };
}

// One follower snapshot per day (the latest sync wins) so analytics can show real growth.
function snapshotFollowers() {
  const date = nowInTimezone(DATA.settings.timezone).slice(0, 10);
  const followers = {};
  for (const [channel, value] of Object.entries(DATA.metrics)) {
    if (value?.lastUpdated && Number.isFinite(Number(value.followers)) && value.followers !== null) followers[channel] = Number(value.followers);
  }
  if (!Object.keys(followers).length) return;
  DATA.metricsHistory = (DATA.metricsHistory || []).filter((entry) => entry.date !== date);
  DATA.metricsHistory.push({ date, followers });
  DATA.metricsHistory = DATA.metricsHistory.sort((a, b) => a.date.localeCompare(b.date)).slice(-180);
}

function followerGrowth() {
  const history = DATA.metricsHistory || [];
  const latest = history.at(-1);
  if (!latest) return { days: 0, channels: {} };
  const pick = (days) => {
    const target = new Date(Date.parse(`${latest.date}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
    return [...history].reverse().find((entry) => entry.date <= target) || null;
  };
  const week = pick(7);
  const month = pick(30);
  const channels = {};
  for (const [channel, value] of Object.entries(latest.followers)) {
    channels[channel] = {
      now: value,
      d7: week && Number.isFinite(week.followers[channel]) ? value - week.followers[channel] : null,
      d30: month && Number.isFinite(month.followers[channel]) ? value - month.followers[channel] : null,
    };
  }
  return { days: history.length, since: history[0].date, series: history.slice(-60), channels };
}

// What actually happened per channel, from publish results (not what posts merely targeted).
function deliveryStats(days = 30) {
  const cutoff = Date.now() - days * 86_400_000;
  const stats = {};
  for (const post of DATA.posts) {
    for (const result of post.results || []) {
      if (!result.channel || result.dryRun) continue;
      const at = Date.parse(result.at || post.lastAttemptAt || post.publishedAt || "");
      if (!at || at < cutoff) continue;
      const row = (stats[result.channel] = stats[result.channel] || { published: 0, failed: 0, skipped: 0, capped: 0 });
      if (result.ok) row.published += 1;
      else if (result.capped) row.capped += 1;
      else if (result.skipped) row.skipped += 1;
      else row.failed += 1;
    }
  }
  for (const row of Object.values(stats)) {
    const attempted = row.published + row.failed;
    row.successRate = attempted ? Math.round((row.published / attempted) * 100) : null;
  }
  return stats;
}

function topPosts(limit = 10) {
  return DATA.posts
    .filter((post) => post.metrics && Object.keys(post.metrics).length)
    .map((post) => {
      const engagement = Object.values(post.metrics).reduce((sum, value) => sum + Number(value.engagement || 0), 0);
      const reach = Object.values(post.metrics).reduce((sum, value) => sum + Number(value.reach || 0), 0);
      return { id: post.id, title: post.title, language: post.language, pillar: post.pillar, publishedAt: post.publishedAt, engagement, reach, byChannel: post.metrics };
    })
    .sort((a, b) => b.engagement - a.engagement || b.reach - a.reach)
    .slice(0, limit);
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
  snapshotFollowers();
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
    overrides: cleanOverrides(body.overrides ?? existing?.overrides, channels),
    channelMedia: cleanChannelMedia(body.channelMedia ?? existing?.channelMedia, channels),
    storyMedia: cleanMediaVariant("storyMedia" in body ? body.storyMedia : existing?.storyMedia, "Story media"),
    utm: body.utm || existing?.utm || null,
  };
}

// A media variant: the same post, a different file (e.g. 4:5 for Instagram, 9:16 for Stories).
// Accepts both the post field names (mediaUrl…) and the media-library names (url, publicUrl…).
function cleanMediaVariant(raw, label) {
  if (!raw || typeof raw !== "object") return null;
  const mediaUrl = String(raw.mediaUrl || raw.url || "").trim();
  if (!mediaUrl) return null;
  const portalPath = mediaUrl.startsWith("/media/") || (PUBLIC_BASE && mediaUrl.startsWith(`${PUBLIC_BASE}/media/`));
  if (!/^https?:\/\//i.test(mediaUrl) && !portalPath) throw new Error(`${label}: media URL must be an https URL or a portal /media path`);
  const publicRaw = String(raw.mediaPublicUrl || raw.publicUrl || "").trim();
  const name = String(raw.mediaName || raw.name || "").trim().slice(0, 200);
  const kind = raw.mediaKind || raw.kind;
  return {
    mediaUrl: mediaUrl.slice(0, 2000),
    mediaPublicUrl: (/^https?:\/\//i.test(publicRaw) ? publicRaw : /^https?:\/\//i.test(mediaUrl) ? mediaUrl : "").slice(0, 2000),
    mediaKind: kind === "video" || kind === "image" ? kind : mediaTypeFromName(name || mediaUrl, "image"),
    mediaName: name,
    mediaAlt: String(raw.mediaAlt || raw.alt || "").slice(0, 1000),
  };
}

// Per-channel media. Only channels the post targets keep a variant; the rest use the main media.
function cleanChannelMedia(value, channels) {
  const result = {};
  if (!value || typeof value !== "object") return result;
  for (const channel of channels) {
    const variant = cleanMediaVariant(value[channel], `${channel} media`);
    if (variant) result[channel] = variant;
  }
  return result;
}

// The post as seen by one channel (or by Stories): same copy, the variant's media.
function withMediaVariant(post, variant) {
  if (!variant) return post;
  return {
    ...post,
    mediaUrl: variant.mediaUrl,
    mediaPublicUrl: variant.mediaPublicUrl,
    mediaKind: variant.mediaKind,
    mediaName: variant.mediaName,
    mediaAlt: variant.mediaAlt || post.mediaAlt,
  };
}

// Per-channel copy. Only channels the post targets keep an override; empty text means "use the main copy".
function cleanOverrides(value, channels) {
  const result = {};
  if (!value || typeof value !== "object") return result;
  for (const channel of channels) {
    const text = String(value[channel] ?? "").replace(/\r\n/g, "\n");
    if (text.trim()) result[channel] = text.slice(0, 5000);
  }
  return result;
}

// The exact text a channel receives: the per-channel override (or main copy), tracked links,
// then the channel's rules ("link in bio" for Instagram, standard hashtags).
function renderForChannel(post, channel, rules = DATA.settings.channelRules || {}) {
  const source = String(post.overrides?.[channel] || post.content || "");
  let text = renderText(source, {
    channel,
    links: CONFIG.links,
    utm: { ...(post.utm || {}), content: post.id || "preview" },
  });
  const rule = rules[channel];
  if (rule?.linkInBio) {
    const label = rule.linkText || (post.language === "ar" ? "الرابط في البايو" : "Link in bio");
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(URL_PATTERN, label).replace(new RegExp(`(${escaped}\\s*){2,}`, "g"), `${label} `).trim();
  }
  if (rule?.hashtags) {
    const missing = rule.hashtags.split(" ").filter((tag) => tag && !text.toLowerCase().includes(tag.toLowerCase()));
    if (missing.length) text = `${text}\n\n${missing.join(" ")}`;
  }
  return text.trim();
}

function previewPost(post, media = null) {
  return (post.channels || []).map((channel) => {
    const text = renderForChannel(post, channel);
    const limit = LIMITS[channel] || 0;
    const length = channelTextLength(channel, text);
    const rule = DATA.settings.channelRules?.[channel];
    const variant = post.channelMedia?.[channel] || null;
    const channelMediaInfo = variant ? { kind: variant.mediaKind, publicUrl: variant.mediaPublicUrl, posterUrl: post.posterUrl } : media;
    return {
      media: {
        url: variant?.mediaUrl || post.mediaUrl || "",
        kind: variant?.mediaKind || post.mediaKind || "",
        name: variant?.mediaName || post.mediaName || "",
        custom: Boolean(variant),
      },
      channel,
      label: CHANNEL_DEFS.find((def) => def.key === channel)?.label || channel,
      text,
      length,
      limit,
      over: Boolean(limit && length > limit),
      custom: Boolean(post.overrides?.[channel]),
      rules: rule ? [rule.linkInBio ? "link in bio" : "", rule.hashtags ? "hashtags" : "", rule.dailyCap ? `max ${rule.dailyCap}/day` : ""].filter(Boolean) : [],
      mode: MONITORING.has(channel) ? "monitoring" : channelMode(channel),
      configured: connectionState(channel).configured,
      notes: channelTextNotes(channel, text, channelMediaInfo),
    };
  });
}

// How many posts a channel already received today (portal timezone), for daily caps.
function publishedTodayCount(channel) {
  const tz = DATA.settings.timezone || "Africa/Cairo";
  const today = nowInTimezone(tz).slice(0, 10);
  let count = 0;
  for (const post of DATA.posts) {
    for (const result of post.results || []) {
      if (result.channel !== channel || !result.ok || result.dryRun) continue;
      const at = result.at || post.publishedAt;
      if (at && wallClock(new Date(at), tz).startsWith(today)) count += 1;
    }
  }
  return count;
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
  const hostedOnSite = (item) => {
    try {
      return Boolean(siteHost && item?.publicUrl && new URL(item.publicUrl).hostname === siteHost);
    } catch {
      return false;
    }
  };
  for (const channel of channels) {
    const rendered = renderForChannel(post, channel);
    const limit = LIMITS[channel];
    const length = channelTextLength(channel, rendered);
    if (limit && length > limit) {
      results.push({ channel, ok: false, skipped: true, reason: `Text is ${length} characters; ${channel} allows ${limit}.` });
      continue;
    }
    // Per-channel media (e.g. 4:5 for Instagram/Facebook) replaces the main file for this channel only.
    const variant = post.channelMedia?.[channel] || null;
    const baseMedia = variant ? (await resolvePostMedia(withMediaVariant(post, variant))) || media : media;
    if (hostedOnSite(baseMedia) && ["instagram", "threads", "devto"].includes(channel) && DATA.settings.requireLiveSite && !(await getSiteLive())) {
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
    // Daily caps protect reach on feeds that punish over-posting. They limit the scheduler only;
    // a person pressing Publish now always goes through.
    // Posts tagged #priority (e.g. the daily videos) always go out and do not wait for a free slot.
    const cap = (post.tags || []).includes("priority") ? 0 : Number(DATA.settings.channelRules?.[channel]?.dailyCap || 0);
    const capReached = cap > 0 && publishedTodayCount(channel) >= cap;
    if (!dryRun && automatic && capReached) {
      results.push({ channel, ok: false, skipped: true, capped: true, reason: `Daily cap reached (${cap}/day) for ${channel}. Raise it in Connections → channel rules.` });
      continue;
    }
    const usePoster = Boolean(baseMedia?.kind === "video" && poster && VIDEO_POSTER_CHANNELS.has(channel));
    const channelMedia = usePoster ? poster : baseMedia;
    if (dryRun) {
      const state = connectionState(channel);
      results.push({
        channel,
        ok: true,
        dryRun: true,
        media: channelMedia?.kind || null,
        mediaName: channelMedia?.name || "",
        ...(variant ? { mediaVariant: "channel" } : {}),
        ...(usePoster ? { mediaNote: "Would publish the video cover image." } : {}),
        ...(capReached ? { mediaNote: `Daily cap of ${cap} already reached today; the scheduler would skip this channel.` } : {}),
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
    if (result.ok && usePoster) {
      result.mediaNote = "Video cover published; video upload is not enabled for this channel yet.";
    }
    if (result.ok && variant) result.mediaVariant = variant.mediaName || "channel media";
    results.push({ channel, at: new Date().toISOString(), ...result });
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
    const reasons = [...new Set(skipped.map((result) => (result.capped ? "daily cap" : /needs setup/i.test(result.reason || "") ? "not connected" : "skipped")))];
    addActivity(DATA, "blocked", `Blocked “${post.title}”: every channel was skipped (${reasons.join(", ")}).`, post.id);
  } else {
    post.status = "failed";
    addActivity(DATA, "failed", `Publish failed for “${post.title}” (${failures.length + skipped.length} channel issues).`, post.id);
  }
  saveData();
  return { results, published: attemptOk, mergedPublished: ok, failures: failures.length, skipped: skipped.length, dryRun, channels };
}

/* ------------------------------------------------------------------ *
 * Automations
 *
 * A rule watches posts and, when its trigger fires, shares extra content:
 *  - "story": a Facebook / Instagram Story with the post's image or video
 *    (the only platforms with a Stories API);
 *  - "post": a teaser, announcement or follow-up on any connected channel,
 *    written from a short template.
 * Triggers: N minutes before a post publishes, N minutes after it publishes,
 * or as soon as a matching post is scheduled (e.g. a new offer).
 * Rules only run live when live publishing is on; otherwise use Test.
 * ------------------------------------------------------------------ */

const AUTOMATION_EVENTS = ["before", "published", "scheduled"];
const POST_ACTION_CHANNELS = ["x", "linkedin", "facebook", "instagram", "threads", "bluesky", "mastodon", "telegram", "discord"];

function cleanAutomation(body, existing = null) {
  const name = String(body.name ?? existing?.name ?? "").trim().slice(0, 80);
  if (!name) throw new Error("Give the automation a name.");
  const triggerIn = body.trigger || existing?.trigger || {};
  const event = String(triggerIn.event || "");
  if (!AUTOMATION_EVENTS.includes(event)) throw new Error("Choose when the automation runs.");
  const minutes = Number(triggerIn.minutes || 0);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 10080) throw new Error("Timing must be a whole number of minutes between 0 and 10,080 (7 days).");
  if (event === "before" && minutes < 5) throw new Error("Run at least 5 minutes before the post.");
  const filterIn = body.filter || existing?.filter || {};
  const filter = {
    tags: cleanTags(filterIn.tags || []),
    pillars: (Array.isArray(filterIn.pillars) ? filterIn.pillars : []).map(String).filter(Boolean).slice(0, 10),
    language: ["en", "ar"].includes(filterIn.language) ? filterIn.language : "",
    channels: (Array.isArray(filterIn.channels) ? filterIn.channels : []).filter((key) => CHANNEL_DEFS.some((def) => def.key === key)),
    keyword: String(filterIn.keyword || "").trim().slice(0, 60),
  };
  const actionsIn = Array.isArray(body.actions) ? body.actions : existing?.actions || [];
  if (!actionsIn.length) throw new Error("Add at least one action.");
  const actions = actionsIn.slice(0, 6).map((action, index) => {
    const type = action.type === "story" ? "story" : action.type === "post" ? "post" : "";
    if (!type) throw new Error(`Action ${index + 1}: choose Story or Post.`);
    const allowed = type === "story" ? STORY_CHANNELS : POST_ACTION_CHANNELS;
    const channels = [...new Set((Array.isArray(action.channels) ? action.channels : []).filter((key) => allowed.includes(key)))];
    if (!channels.length) {
      throw new Error(
        type === "story"
          ? `Action ${index + 1}: stories can go to Facebook and Instagram only. Use a Post action for other channels.`
          : `Action ${index + 1}: pick at least one channel.`
      );
    }
    const media = ["post", "poster", "none"].includes(action.media) ? action.media : "post";
    if (type === "story" && media === "none") throw new Error(`Action ${index + 1}: a story needs the post's image or video.`);
    const text = String(action.text || "").slice(0, 3000);
    if (type === "post" && !text.trim()) throw new Error(`Action ${index + 1}: write the text to post (you can use {{title}}, {{time}} and {{site}}).`);
    return { type, channels, media, text };
  });
  return {
    id: existing?.id || `auto-${Date.now()}-${randomUUID().slice(0, 6)}`,
    name,
    enabled: body.enabled ?? existing?.enabled ?? true,
    trigger: { event, minutes },
    filter,
    actions,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastRunAt: existing?.lastRunAt || null,
    runCount: existing?.runCount || 0,
  };
}

function automationMatches(rule, post) {
  const f = rule.filter || {};
  if (f.tags?.length && !f.tags.some((tag) => (post.tags || []).includes(tag))) return false;
  if (f.pillars?.length && !f.pillars.includes(post.pillar)) return false;
  if (f.language && post.language !== f.language) return false;
  if (f.channels?.length && !f.channels.some((channel) => (post.channels || []).includes(channel))) return false;
  if (f.keyword && !`${post.title} ${post.content}`.toLowerCase().includes(f.keyword.toLowerCase())) return false;
  return true;
}

function automationTemplateText(template, post) {
  const at = String(post.scheduledAt || "");
  const excerpt = String(post.content || "").replace(/\{\{\w+\}\}|https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  return String(template)
    .replaceAll("{{title}}", post.title || "")
    .replaceAll("{{time}}", at.slice(11, 16))
    .replaceAll("{{date}}", at.slice(0, 10))
    .replaceAll("{{excerpt}}", excerpt.length > 140 ? `${excerpt.slice(0, 139)}…` : excerpt)
    .replaceAll("{{content}}", String(post.content || ""));
}

// Media for an automation action. Stories prefer the post's 9:16 story media; posts prefer the
// channel's own media (e.g. 4:5 on Instagram) before the main file.
async function automationMedia(post, mode, { story = false, channel = "" } = {}) {
  if (mode === "none") return null;
  if (story && post.storyMedia && mode !== "poster") return resolvePostMedia(withMediaVariant(post, post.storyMedia));
  const source = !story && channel && post.channelMedia?.[channel] ? withMediaVariant(post, post.channelMedia[channel]) : post;
  const media = await resolvePostMedia(source);
  if (mode === "poster" && media?.kind === "video" && post.posterUrl) {
    return resolvePostMedia({ ...post, mediaUrl: post.posterUrl, mediaPublicUrl: post.posterPublicUrl || post.posterUrl, mediaKind: "image", mediaName: post.posterName || path.basename(post.posterUrl) });
  }
  return media;
}

// Plans (and, unless dryRun, performs) every action of a rule for one post.
async function runAutomation(rule, post, { dryRun = true, source = "scheduler" } = {}) {
  CONFIG = loadConfig();
  const outcomes = [];
  for (const action of rule.actions) {
    for (const channel of action.channels) {
      const media = await automationMedia(post, action.media, { story: action.type === "story", channel });
      const state = connectionState(channel);
      const base = { channel, type: action.type, media: media?.kind || null, mediaName: media?.name || "" };
      if (action.type === "story") {
        if (!media) {
          outcomes.push({ ...base, ok: false, skipped: true, reason: "The post has no image or video for a story." });
          continue;
        }
        if (channel === "instagram" && !/^https:\/\//i.test(media.publicUrl || "")) {
          outcomes.push({ ...base, ok: false, skipped: true, reason: "Instagram stories need a public https image or video URL." });
          continue;
        }
        if (dryRun) {
          outcomes.push({ ...base, ok: state.configured, dryRun: true, reason: state.configured ? `Would share a ${channel} story (${media.kind}).` : `Would skip: ${channel} is not connected.` });
          continue;
        }
        if (!state.configured) {
          outcomes.push({ ...base, ok: false, skipped: true, reason: `${channel} is not connected.` });
          continue;
        }
        outcomes.push({ ...base, ...(await publishStory(channel, { media })) });
        continue;
      }
      const draft = { ...post, content: automationTemplateText(action.text, post), overrides: {}, utm: { ...(post.utm || {}), campaign: post.utm?.campaign || "automation" } };
      draft.id = `${post.id}-auto`;
      const text = renderForChannel(draft, channel);
      const limit = LIMITS[channel] || 0;
      const length = channelTextLength(channel, text);
      if (limit && length > limit) {
        outcomes.push({ ...base, ok: false, skipped: true, text, reason: `Text is ${length} characters; ${channel} allows ${limit}.` });
        continue;
      }
      if (channel === "instagram" && !media) {
        outcomes.push({ ...base, ok: false, skipped: true, text, reason: "Instagram posts need an image or video." });
        continue;
      }
      if (dryRun) {
        outcomes.push({ ...base, ok: state.configured, dryRun: true, text, reason: state.configured ? "Would post." : `Would skip: ${channel} is not connected.` });
        continue;
      }
      if (!state.configured) {
        outcomes.push({ ...base, ok: false, skipped: true, text, reason: `${channel} is not connected.` });
        continue;
      }
      let result;
      try {
        result = await publishToChannel(channel, text, { config: CONFIG, media });
      } catch (error) {
        result = { ok: false, error: error.message };
      }
      outcomes.push({ ...base, text, ...result });
    }
  }
  const at = new Date().toISOString();
  if (!dryRun) {
    post.automationRuns = post.automationRuns && typeof post.automationRuns === "object" ? post.automationRuns : {};
    post.automationRuns[rule.id] = { at, ok: outcomes.filter((o) => o.ok).length, total: outcomes.length };
    rule.lastRunAt = at;
    rule.runCount = (rule.runCount || 0) + 1;
    const okCount = outcomes.filter((o) => o.ok).length;
    DATA.automationRuns.unshift({
      at,
      ruleId: rule.id,
      ruleName: rule.name,
      postId: post.id,
      postTitle: post.title,
      source,
      ok: okCount,
      total: outcomes.length,
      outcomes: outcomes.map(({ text, ...rest }) => ({ ...rest, text: text ? String(text).slice(0, 280) : undefined })),
    });
    DATA.automationRuns = DATA.automationRuns.slice(0, 500);
    addActivity(DATA, "automation", `Automation “${rule.name}” on “${post.title}”: ${okCount} of ${outcomes.length} actions succeeded.`, post.id);
    saveData();
  }
  return outcomes;
}

// Which posts a rule should act on right now. Each rule acts on a post at most once, and only
// for events that happen after the rule was created (so a new rule never floods old posts).
function dueAutomations(nowWall) {
  const due = [];
  const nowMs = Date.now();
  for (const rule of DATA.automations) {
    if (!rule.enabled) continue;
    const created = Date.parse(rule.createdAt) || 0;
    for (const post of DATA.posts) {
      if (post.automationRuns?.[rule.id]) continue;
      if (!automationMatches(rule, post)) continue;
      const minutes = Number(rule.trigger.minutes || 0);
      if (rule.trigger.event === "before") {
        if (post.status !== "scheduled") continue;
        const at = String(post.scheduledAt);
        const startMs = Date.parse(`${at}Z`) - minutes * 60_000;
        const nowWallMs = Date.parse(`${nowWall}Z`);
        if (at > nowWall && nowWallMs >= startMs && Date.now() >= created) due.push({ rule, post });
      } else if (rule.trigger.event === "published") {
        const publishedMs = Date.parse(post.publishedAt || "");
        if (post.status !== "published" || !publishedMs || publishedMs < created) continue;
        if (nowMs >= publishedMs + minutes * 60_000 && nowMs - publishedMs < 24 * 3_600_000 + minutes * 60_000) due.push({ rule, post });
      } else if (rule.trigger.event === "scheduled") {
        const updatedMs = Date.parse(post.updatedAt || post.createdAt || "");
        if (post.status !== "scheduled" || String(post.scheduledAt) <= nowWall || !updatedMs || updatedMs < created) continue;
        if (nowMs >= updatedMs + minutes * 60_000) due.push({ rule, post });
      }
    }
  }
  return due;
}

let automationBusy = false;
async function automationTick() {
  if (automationBusy || !AUTO_PUBLISH || !LIVE || DATA.settings.dryRun) return;
  automationBusy = true;
  try {
    const due = dueAutomations(nowInTimezone(DATA.settings.timezone)).slice(0, 10);
    for (const { rule, post } of due) {
      try {
        await runAutomation(rule, post, { dryRun: false, source: "scheduler" });
      } catch (error) {
        console.error(`Automation ${rule.id} failed: ${error.message}`);
      }
    }
  } finally {
    automationBusy = false;
  }
}

/* ------------------------------------------------------------------ *
 * Comments inbox and comment → DM rules
 * ------------------------------------------------------------------ */

const COMMENT_STATUSES = ["new", "read", "replied", "archived"];
const DM_WINDOW_MS = 7 * 86_400_000;

// Lowercase, drop Arabic diacritics and tatweel, unify alef/yaa/taa marbuta and Arabic digits,
// so "السعر", "الســعر" and "السِّعر" all match the keyword "السعر".
function normalizeForMatch(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[^\p{L}\p{N}#@]+/gu, " ")
    .trim();
}

function commentRuleMatch(rule, comment) {
  const f = rule.filter || {};
  if (rule.channels?.length && !rule.channels.includes(comment.channel)) return null;
  const post = DATA.posts.find((item) => item.id === comment.postId) || null;
  if (f.postIds?.length && !f.postIds.includes(comment.postId)) return null;
  if (f.tags?.length && !(post?.tags || []).some((tag) => f.tags.includes(tag))) return null;
  const text = ` ${normalizeForMatch(comment.text)} `;
  const keywords = (rule.keywords || []).map(normalizeForMatch).filter(Boolean);
  if (!keywords.length) return rule.matchAll ? { keyword: "" } : null;
  const hit = (keyword) => text.includes(` ${keyword} `) || (/[؀-ۿ]/.test(keyword) && text.includes(keyword));
  if (rule.mode === "exact") {
    const found = keywords.find((keyword) => normalizeForMatch(comment.text) === keyword);
    return found ? { keyword: found } : null;
  }
  if (rule.mode === "all") return keywords.every(hit) ? { keyword: keywords.join(" + ") } : null;
  const found = keywords.find(hit);
  return found ? { keyword: found } : null;
}

function cleanCommentRule(body, existing = null) {
  const name = String(body.name ?? existing?.name ?? "").trim().slice(0, 80);
  if (!name) throw new Error("Give the rule a name.");
  const channels = [...new Set((Array.isArray(body.channels) ? body.channels : existing?.channels || []).filter((key) => COMMENT_CHANNELS.includes(key)))];
  if (!channels.length) throw new Error("Pick at least one channel that supports comments (Facebook, Instagram, Bluesky or Mastodon).");
  const keywords = [...new Set((Array.isArray(body.keywords) ? body.keywords : String(body.keywords ?? (existing?.keywords || []).join(",")).split(","))
    .map((keyword) => String(keyword).trim())
    .filter(Boolean))].slice(0, 30);
  const matchAll = Boolean(body.matchAll ?? existing?.matchAll);
  if (!keywords.length && !matchAll) throw new Error("Add at least one keyword, or choose “every comment”.");
  const mode = ["any", "all", "exact"].includes(body.mode) ? body.mode : existing?.mode || "any";
  const dm = String(body.dm ?? existing?.dm ?? "").slice(0, 1000);
  const reply = String(body.reply ?? existing?.reply ?? "").slice(0, 500);
  if (!dm.trim() && !reply.trim()) throw new Error("Write the DM, a public reply, or both.");
  const dmChannels = channels.filter((channel) => DM_CHANNELS.includes(channel));
  if (dm.trim() && !dmChannels.length) throw new Error("None of the chosen channels can send DMs.");
  const filterIn = body.filter || existing?.filter || {};
  return {
    id: existing?.id || `crule-${Date.now()}-${randomUUID().slice(0, 6)}`,
    name,
    enabled: body.enabled ?? existing?.enabled ?? true,
    channels,
    keywords,
    mode,
    matchAll,
    filter: {
      tags: cleanTags(filterIn.tags || []),
      postIds: (Array.isArray(filterIn.postIds) ? filterIn.postIds : []).map(String).filter((id) => DATA.posts.some((post) => post.id === id)).slice(0, 50),
    },
    dm,
    reply,
    oncePerPerson: body.oncePerPerson ?? existing?.oncePerPerson ?? true,
    markReplied: body.markReplied ?? existing?.markReplied ?? true,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stats: existing?.stats || { matched: 0, sent: 0, failed: 0 },
  };
}

function renderEngageText(template, comment, extra = {}) {
  const post = DATA.posts.find((item) => item.id === comment.postId) || {};
  const name = String(comment.author?.name || "").trim();
  const text = String(template || "")
    .replaceAll("{{name}}", name || "there")
    .replaceAll("{{first_name}}", (name.split(/\s+/)[0] || "there"))
    .replaceAll("{{keyword}}", extra.keyword || "")
    .replaceAll("{{post}}", post.title || "");
  return renderText(text, {
    channel: comment.channel,
    links: CONFIG.links,
    utm: { campaign: "comment-dm", content: comment.postId || "comment", medium: "dm" },
  });
}

function publicComment(comment) {
  const post = DATA.posts.find((item) => item.id === comment.postId);
  const matches = DATA.commentRules
    .filter((rule) => rule.enabled)
    .map((rule) => ({ rule, match: commentRuleMatch(rule, comment) }))
    .filter((item) => item.match)
    .map(({ rule, match }) => ({ id: rule.id, name: rule.name, keyword: match.keyword, ran: comment.ruleRuns?.[rule.id] || null }));
  const ageMs = Date.now() - Date.parse(comment.createdAt);
  return {
    ...comment,
    postTitle: post?.title || comment.postTitle || "",
    matches,
    dmAllowed: DM_CHANNELS.includes(comment.channel) && !comment.dm && (!["facebook", "instagram"].includes(comment.channel) || ageMs < DM_WINDOW_MS),
    dmWindowEndsAt: ["facebook", "instagram"].includes(comment.channel) ? new Date(Date.parse(comment.createdAt) + DM_WINDOW_MS).toISOString() : null,
  };
}

// Run every enabled rule on one comment. Real sends only in live mode; rules never touch comments
// written before the rule existed, never DM the same person twice for a rule, and respect the
// 7-day private-reply window on Facebook and Instagram.
async function applyCommentRules(comment, { live }) {
  const outcomes = [];
  for (const rule of DATA.commentRules) {
    if (!rule.enabled || comment.ruleRuns?.[rule.id]) continue;
    if (Date.parse(comment.createdAt) < Date.parse(rule.createdAt)) continue;
    const match = commentRuleMatch(rule, comment);
    if (!match) continue;
    const personKey = `${rule.id}:${comment.channel}:${comment.author?.id || comment.author?.handle || comment.platformId}`;
    if (rule.oncePerPerson && DATA.commentRuleSent[personKey]) continue;
    if (!live) {
      outcomes.push({ rule: rule.name, dryRun: true });
      continue;
    }
    const run = { at: new Date().toISOString(), keyword: match.keyword };
    rule.stats = rule.stats || { matched: 0, sent: 0, failed: 0 };
    rule.stats.matched += 1;
    if (rule.dm.trim() && DM_CHANNELS.includes(comment.channel)) {
      if (["facebook", "instagram"].includes(comment.channel) && Date.now() - Date.parse(comment.createdAt) > DM_WINDOW_MS) {
        run.dm = { ok: false, skipped: true, reason: "Older than 7 days; Meta no longer allows a private reply." };
      } else {
        const text = renderEngageText(rule.dm, comment, match);
        run.dm = { ...(await sendDirectMessage(comment.channel, comment, text)), text };
        if (run.dm.ok) comment.dm = { at: run.at, text, ruleId: rule.id };
      }
    }
    if (rule.reply.trim()) {
      const text = renderEngageText(rule.reply, comment, match);
      run.reply = { ...(await replyToComment(comment.channel, comment, text)), text };
      if (run.reply.ok) comment.replies = [...(comment.replies || []), { at: run.at, text, by: `rule:${rule.name}` }];
    }
    const ok = (run.dm?.ok ?? true) && (run.reply?.ok ?? true);
    if (ok) {
      rule.stats.sent += 1;
      DATA.commentRuleSent[personKey] = run.at;
      if (rule.markReplied && comment.status === "new") comment.status = "replied";
    } else {
      rule.stats.failed += 1;
    }
    comment.ruleRuns = { ...(comment.ruleRuns || {}), [rule.id]: run };
    addActivity(DATA, "engage", `Rule “${rule.name}” on a ${comment.channel} comment by ${comment.author?.name || "someone"}: ${ok ? "sent" : "failed"}.`, comment.postId);
    outcomes.push({ rule: rule.name, ok, run });
  }
  return outcomes;
}

function commentFixture() {
  const file = process.env.PORTAL_COMMENTS_FIXTURE;
  if (!file) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

let commentSyncBusy = false;
async function syncComments({ source = "manual" } = {}) {
  if (commentSyncBusy) return { busy: true };
  commentSyncBusy = true;
  try {
    const known = new Map(DATA.comments.map((comment) => [comment.id, comment]));
    const fresh = [];
    const warnings = [];
    let checkedPosts = 0;
    const ingest = (channel, post, item) => {
      const id = `${channel}:${item.platformId}`;
      const existing = known.get(id);
      if (existing) {
        existing.text = item.text;
        return;
      }
      const comment = {
        id,
        channel,
        platformId: String(item.platformId),
        postId: post?.id || item.postId || "",
        postTitle: post?.title || "",
        author: item.author || { name: "Unknown" },
        text: String(item.text || "").slice(0, 5000),
        createdAt: item.createdAt || new Date().toISOString(),
        parentId: item.parentId || "",
        url: item.url || "",
        raw: item.raw || null,
        status: "new",
        replies: [],
        dm: null,
        ruleRuns: {},
        syncedAt: new Date().toISOString(),
      };
      DATA.comments.unshift(comment);
      known.set(id, comment);
      fresh.push(comment);
    };

    const fixture = commentFixture();
    if (fixture) {
      for (const item of fixture) ingest(item.channel, DATA.posts.find((post) => post.id === item.postId), item);
    } else {
      const cutoff = Date.now() - 30 * 86_400_000;
      const targets = [];
      for (const post of DATA.posts) {
        for (const result of post.results || []) {
          if (!COMMENT_CHANNELS.includes(result.channel) || !result.ok || result.dryRun || !result.id) continue;
          const at = Date.parse(result.at || post.publishedAt || "");
          if (at && at < cutoff) continue;
          if (!connectionState(result.channel).configured) continue;
          targets.push({ post, channel: result.channel, platformPostId: String(result.id) });
        }
      }
      for (const target of targets.slice(0, 120)) {
        checkedPosts += 1;
        const fetched = await fetchComments(target.channel, target.platformPostId);
        if (!fetched.ok) {
          if (!fetched.skipped) warnings.push(`${target.channel}: ${fetched.error || fetched.reason}`);
          continue;
        }
        for (const item of fetched.comments) ingest(target.channel, target.post, item);
      }
    }
    DATA.comments = DATA.comments.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 5000);

    const live = LIVE && !DATA.settings.dryRun;
    let sent = 0;
    let pending = 0;
    // Recent comments (7 days) that no rule has handled yet, including ones that arrived while the
    // portal was in dry run, so going live does not skip them. Oldest first.
    const candidates = DATA.comments
      .filter((comment) => comment.status !== "archived" && Date.now() - Date.parse(comment.createdAt) < DM_WINDOW_MS)
      .reverse();
    for (const comment of candidates) {
      const outcomes = await applyCommentRules(comment, { live });
      sent += outcomes.filter((o) => o.ok).length;
      pending += outcomes.filter((o) => o.dryRun).length;
    }
    DATA.commentsSyncedAt = new Date().toISOString();
    if (fresh.length || sent) addActivity(DATA, "engage", `Comments synced (${source}): ${fresh.length} new, ${sent} rule replies sent${pending ? `, ${pending} waiting for live mode` : ""}.`);
    saveData();
    return { new: fresh.length, checkedPosts, sent, pendingDryRun: pending, warnings: [...new Set(warnings)].slice(0, 10) };
  } finally {
    commentSyncBusy = false;
  }
}

function commentCounts() {
  const counts = { new: 0, read: 0, replied: 0, archived: 0, total: DATA.comments.length };
  for (const comment of DATA.comments) counts[comment.status] = (counts[comment.status] || 0) + 1;
  return counts;
}

/* ------------------------------------------------------------------ *
 * Content audit
 * ------------------------------------------------------------------ */

function normalizedMessage(text) {
  return String(text || "")
    .replace(/\{\{\w+\}\}|https?:\/\/\S+/g, "")
    .replace(/^[^:\n]{2,24}:\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function contentAudit() {
  const nowWall = nowInTimezone(DATA.settings.timezone);
  const rules = DATA.settings.channelRules || {};
  const upcoming = DATA.posts.filter((post) => ["scheduled", "approved", "needs_review", "draft"].includes(post.status) && String(post.scheduledAt) >= nowWall.slice(0, 10));
  const issues = {};
  const add = (post, level, code, message) => (issues[post.id] = issues[post.id] || []).push({ level, code, message });

  const lastSeen = new Map();
  const repeats = new Map();
  for (const post of [...DATA.posts].sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)))) {
    const key = normalizedMessage(post.content);
    if (!key) continue;
    repeats.set(key, (repeats.get(key) || 0) + 1);
    const prev = lastSeen.get(key);
    const at = Date.parse(`${String(post.scheduledAt).slice(0, 19)}Z`);
    if (prev && at - prev.at < 3 * 86_400_000 && upcoming.includes(post)) {
      add(post, "warn", "repeat", `Same message as “${prev.title}” less than 3 days earlier. Audiences notice repeats; vary the copy or space them out.`);
    }
    lastSeen.set(key, { at, title: post.title });
  }

  for (const post of upcoming) {
    const preview = previewPost(post, post.mediaUrl ? { kind: post.mediaKind, publicUrl: post.mediaPublicUrl, posterUrl: post.posterUrl } : null);
    for (const item of preview) {
      if (item.over) add(post, "error", "too-long", `${item.label}: ${item.length}/${item.limit} characters — will be skipped.`);
      if (item.channel === "instagram" && /https?:\/\//.test(item.text)) add(post, "warn", "ig-link", "Instagram captions can't open links. Turn on “link in bio” for Instagram or edit its copy.");
      if (["instagram", "linkedin"].includes(item.channel) && !/#[\p{L}\d_]+/u.test(item.text)) add(post, "info", "no-hashtags", `${item.label}: no hashtags. 3–5 relevant hashtags help discovery.`);
    }
    if (!post.mediaUrl) add(post, DATA.settings.mediaRequired ? "error" : "info", "no-media", "No image or video.");
    else if (!post.mediaAlt) add(post, "info", "no-alt", "No alt text for the media.");
    if (!/\{\{\w+\}\}|https?:\/\//.test(post.content) && !Object.values(post.overrides || {}).some((text) => /\{\{\w+\}\}|https?:\/\//.test(text))) {
      add(post, "info", "no-cta", "No link or call to action.");
    }
  }
  // Collapse duplicate issue codes per post.
  for (const id of Object.keys(issues)) {
    const seen = new Set();
    issues[id] = issues[id].filter((issue) => (seen.has(issue.code + issue.message) ? false : seen.add(issue.code + issue.message)));
  }

  const perDay = {};
  for (const post of upcoming) {
    if (post.status !== "scheduled") continue;
    const day = String(post.scheduledAt).slice(0, 10);
    for (const channel of post.channels || []) {
      perDay[channel] = perDay[channel] || {};
      perDay[channel][day] = (perDay[channel][day] || 0) + 1;
    }
  }
  const volume = Object.entries(perDay).map(([channel, days]) => {
    const counts = Object.values(days);
    const max = Math.max(...counts);
    const avg = counts.reduce((sum, n) => sum + n, 0) / counts.length;
    const cap = Number(rules[channel]?.dailyCap || 0);
    const recommended = RECOMMENDED_DAILY[channel] || 0;
    return {
      channel,
      label: CHANNEL_DEFS.find((def) => def.key === channel)?.label || channel,
      avgPerDay: Math.round(avg * 10) / 10,
      maxPerDay: max,
      recommended,
      cap,
      effectiveMax: cap ? Math.min(cap, max) : max,
      over: Boolean(recommended && (cap ? Math.min(cap, max) : max) > recommended),
    };
  }).sort((a, b) => b.maxPerDay - a.maxPerDay);

  const counts = { error: 0, warn: 0, info: 0 };
  const byCode = {};
  for (const list of Object.values(issues)) {
    for (const issue of list) {
      counts[issue.level] += 1;
      byCode[issue.code] = (byCode[issue.code] || 0) + 1;
    }
  }
  const messages = [...repeats.values()];
  const pillarMix = {};
  const languageMix = {};
  for (const post of upcoming) {
    pillarMix[post.pillar] = (pillarMix[post.pillar] || 0) + 1;
    languageMix[post.language] = (languageMix[post.language] || 0) + 1;
  }
  const questions = upcoming.filter((post) => /[?؟]/.test(post.content)).length;
  const score = upcoming.length
    ? Math.max(0, Math.round(100 - (counts.error * 8 + counts.warn * 2 + counts.info * 0.25) / Math.max(1, upcoming.length) * 10 - volume.filter((v) => v.over).length * 5))
    : 100;

  const suggestions = [];
  if (volume.some((v) => v.over)) suggestions.push({ code: "caps", text: `${volume.filter((v) => v.over).map((v) => `${v.label} gets up to ${v.effectiveMax}/day (recommended ${v.recommended})`).join("; ")}. Apply recommended daily caps so the busiest feeds don't lose reach.` });
  if (byCode["ig-link"]) suggestions.push({ code: "link-in-bio", text: `${byCode["ig-link"]} Instagram captions contain links nobody can click. Turn on “link in bio” for Instagram.` });
  if (byCode.repeat) suggestions.push({ code: "repeat", text: `${byCode.repeat} upcoming posts repeat a message from the previous 3 days. ${repeats.size} unique messages cover ${DATA.posts.length} posts (up to ${Math.max(0, ...messages)} uses of one message).` });
  if (byCode["no-hashtags"]) {
    const lacking = [...new Set(Object.values(issues).flat().filter((issue) => issue.code === "no-hashtags").map((issue) => issue.message.split(":")[0]))];
    suggestions.push({ code: "hashtags", channels: lacking, text: `${lacking.join(" and ")} copy has no hashtags. Add 3–5 standard hashtags in that channel's rules.` });
  }
  if (upcoming.length && questions / upcoming.length < 0.1) suggestions.push({ code: "questions", text: `Only ${questions} of ${upcoming.length} upcoming posts ask a question. Questions invite replies, which most feeds reward.` });
  if (byCode["too-long"]) suggestions.push({ code: "too-long", text: `${byCode["too-long"]} posts are too long for at least one channel and will be skipped there. Add a shorter per-channel version.` });

  return {
    generatedAt: new Date().toISOString(),
    score,
    upcoming: upcoming.length,
    counts,
    byCode,
    volume,
    uniqueMessages: repeats.size,
    maxRepeats: Math.max(0, ...messages),
    questions,
    pillarMix,
    languageMix,
    suggestions,
    issues,
  };
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
    metrics: { totals: metricsTotals(), channels: DATA.metrics, growth: followerGrowth() },
    delivery: deliveryStats(30),
    automations: { total: DATA.automations.length, enabled: DATA.automations.filter((rule) => rule.enabled).length },
    trash: DATA.trash.length,
    comments: { ...commentCounts(), rules: DATA.commentRules.filter((rule) => rule.enabled).length, syncedAt: DATA.commentsSyncedAt },
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
  // Only connected posting channels are expected to report metrics; restricted ones never do.
  const unavailable = channelSummary()
    .filter((channel) => channel.configured && CHANNEL_CAPABILITIES[channel.key]?.metrics && !channel.metrics?.lastUpdated)
    .map((channel) => ({
      channel: channel.label,
      note: channel.metrics?.note || "Connected, but no metrics received yet. Run Sync metrics.",
    }));
  const recommendations = [];
  if (!siteLiveCache.value) recommendations.push("Deploy the landing page before publishing posts that use {{site}} links.");
  if (!connected.length) recommendations.push("Connect at least one posting API in the portal environment.");
  if (blocked) recommendations.push(`${blocked} post${blocked === 1 ? "" : "s"} blocked by the live-site or channel check.`);
  const wallNow = nowInTimezone(DATA.settings.timezone);
  const igNoPublic = DATA.posts.filter(
    (post) => post.status === "scheduled" && String(post.scheduledAt) >= wallNow && post.channels?.includes("instagram") && !/^https:\/\//i.test(post.mediaPublicUrl || post.mediaUrl || "")
  ).length;
  if (igNoPublic) recommendations.push(`${igNoPublic} upcoming Instagram post${igNoPublic === 1 ? " has" : "s have"} no public https media URL and will be skipped on Instagram.`);
  const delivery = deliveryStats(30);
  for (const [channel, row] of Object.entries(delivery)) {
    if (row.failed >= 3 && row.successRate !== null && row.successRate < 50) {
      recommendations.push(`${CHANNEL_DEFS.find((def) => def.key === channel)?.label || channel} failed ${row.failed} times in 30 days (${row.successRate}% success). Check its connection.`);
    }
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
    delivery,
    topPosts: topPosts(10),
    growth: followerGrowth(),
    automationRuns: DATA.automationRuns.slice(0, 20),
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
    // Main media plus per-channel and story variants: a file in use anywhere can't be deleted by accident.
    const urls = new Set([post.mediaUrl, ...Object.values(post.channelMedia || {}).map((variant) => variant?.mediaUrl), post.storyMedia?.mediaUrl].map((value) => String(value || "")).filter(Boolean));
    for (const url of urls) {
      const match = /\/media\/(?!landing\/)([^/?#]+)$/.exec(url);
      const key = match ? decodeURIComponentSafe(match[1]) : url.includes("/media/landing/") ? `landing:${path.basename(url)}` : "";
      if (!key) continue;
      usage[key] = usage[key] || { total: 0, pending: 0 };
      usage[key].total += 1;
      if (["scheduled", "approved", "needs_review", "draft", "publishing"].includes(post.status)) usage[key].pending += 1;
    }
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
      moveToTrash(post);
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
        language: body.language || existing?.language || "en",
        utm: existing?.utm || null,
      };
      draft.overrides = cleanOverrides(body.overrides ?? existing?.overrides, draft.channels);
      draft.channelMedia = cleanChannelMedia(body.channelMedia ?? existing?.channelMedia, draft.channels);
      draft.mediaUrl = body.mediaUrl ?? existing?.mediaUrl ?? "";
      draft.mediaKind = body.mediaKind ?? existing?.mediaKind ?? "";
      draft.mediaName = body.mediaName ?? existing?.mediaName ?? "";
      draft.posterUrl = body.posterUrl ?? existing?.posterUrl ?? "";
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
        const problems = validateCredentials(channel, clean);
        if (problems.length) return json(res, 400, { error: problems.join(" "), problems });
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
    if (action === "credentials" && method === "DELETE") {
      const allowed = CREDENTIAL_KEYS[channel];
      if (!allowed) return json(res, 400, { error: "This channel has no API credentials to remove." });
      // Writing empty values removes them from portal/.env and from the running process.
      writeEnvValues(Object.fromEntries(allowed.map((key) => [key, ""])));
      DATA.connectionChecks[channel] = null;
      addActivity(DATA, "connection", `Disconnected ${channel}: removed its saved credentials.`);
      saveData();
      return json(res, 200, { channel: channelInfo(channel) });
    }
  }

  if (method === "GET" && pathname === "/api/content/audit") {
    return json(res, 200, contentAudit());
  }

  if (pathname === "/api/automations" || pathname.startsWith("/api/automations/")) {
    const rest = pathname.slice("/api/automations".length).replace(/^\//, "");
    const [rawId, verb] = rest.split("/");
    const id = rawId ? decodeURIComponentSafe(rawId) : "";
    const rule = id ? DATA.automations.find((item) => item.id === id) : null;
    if (id && !rule) return json(res, 404, { error: "Automation not found" });
    try {
      if (method === "GET" && !id) {
        return json(res, 200, {
          automations: DATA.automations,
          runs: DATA.automationRuns.slice(0, 100),
          storyChannels: STORY_CHANNELS,
          postChannels: POST_ACTION_CHANNELS,
          live: LIVE && AUTO_PUBLISH && !DATA.settings.dryRun,
        });
      }
      if (method === "POST" && !id) {
        const created = cleanAutomation(await readBody(req));
        DATA.automations.push(created);
        addActivity(DATA, "automation", `Created automation “${created.name}”.`);
        saveData();
        return json(res, 201, { automation: created });
      }
      if (method === "PUT" && rule && !verb) {
        const updated = cleanAutomation(await readBody(req), rule);
        Object.assign(rule, updated);
        addActivity(DATA, "automation", `Updated automation “${rule.name}”${updated.enabled ? "" : " (paused)"}.`);
        saveData();
        return json(res, 200, { automation: rule });
      }
      if (method === "DELETE" && rule && !verb) {
        DATA.automations = DATA.automations.filter((item) => item !== rule);
        addActivity(DATA, "automation", `Deleted automation “${rule.name}”.`);
        saveData();
        return json(res, 200, { ok: true });
      }
      if (method === "POST" && rule && (verb === "test" || verb === "run")) {
        const body = await readBody(req);
        const candidates = DATA.posts
          .filter((post) => automationMatches(rule, post))
          .sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
        const nowWall = nowInTimezone(DATA.settings.timezone);
        const post = body.postId
          ? DATA.posts.find((item) => item.id === body.postId)
          : candidates.find((item) => String(item.scheduledAt) >= nowWall) || candidates.at(-1);
        if (!post) throw new Error("No post matches this automation's filters yet.");
        if (verb === "run" && !LIVE) return json(res, 403, { error: "Live publishing is locked. Set MARKETING_LIVE=true on the portal server." });
        const outcomes = await runAutomation(rule, post, { dryRun: verb === "test", source: "manual" });
        return json(res, 200, { post: { id: post.id, title: post.title, scheduledAt: post.scheduledAt }, outcomes, matching: candidates.length });
      }
      return json(res, 405, { error: "Method not allowed" });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  if (pathname === "/api/comments" && method === "GET") {
    const status = url.searchParams.get("status");
    const channel = url.searchParams.get("channel");
    const postId = url.searchParams.get("postId");
    const q = normalizeForMatch(url.searchParams.get("q") || "");
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    let items = DATA.comments;
    if (status === "open") items = items.filter((comment) => comment.status === "new" || comment.status === "read");
    else if (status) items = items.filter((comment) => comment.status === status);
    if (channel) items = items.filter((comment) => comment.channel === channel);
    if (postId) items = items.filter((comment) => comment.postId === postId);
    if (q) items = items.filter((comment) => normalizeForMatch(`${comment.text} ${comment.author?.name} ${comment.author?.handle}`).includes(q));
    return json(res, 200, {
      items: items.slice(offset, offset + limit).map(publicComment),
      total: items.length,
      offset,
      limit,
      counts: commentCounts(),
      syncedAt: DATA.commentsSyncedAt,
      channels: COMMENT_CHANNELS.map((key) => ({ key, configured: connectionState(key).configured, dm: DM_CHANNELS.includes(key), note: ENGAGE_NOTES[key] || "" })),
      unsupported: ["x", "linkedin", "threads"].map((key) => ({ key, note: ENGAGE_NOTES[key] })),
      live: LIVE && !DATA.settings.dryRun,
    });
  }

  if (pathname === "/api/comments/sync" && method === "POST") {
    try {
      return json(res, 200, await syncComments({ source: "manual" }));
    } catch (error) {
      return json(res, 500, { error: error.message });
    }
  }

  if (pathname === "/api/comments/bulk" && method === "POST") {
    try {
      const body = await readBody(req);
      if (!COMMENT_STATUSES.includes(body.status)) throw new Error("Invalid status");
      const ids = new Set((Array.isArray(body.ids) ? body.ids : []).map(String));
      let updated = 0;
      for (const comment of DATA.comments) {
        if (!ids.has(comment.id) || comment.status === body.status) continue;
        comment.status = body.status;
        updated += 1;
      }
      saveData();
      return json(res, 200, { updated, counts: commentCounts() });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  const commentMatch = pathname.match(/^\/api\/comments\/([^/]+)(?:\/(reply|dm))?$/);
  if (commentMatch && !["sync", "bulk"].includes(commentMatch[1])) {
    const comment = DATA.comments.find((item) => item.id === decodeURIComponentSafe(commentMatch[1]));
    if (!comment) return json(res, 404, { error: "Comment not found" });
    const action = commentMatch[2];
    try {
      if (method === "PUT" && !action) {
        const body = await readBody(req);
        if (!COMMENT_STATUSES.includes(body.status)) throw new Error("Invalid status");
        comment.status = body.status;
        saveData();
        return json(res, 200, { comment: publicComment(comment), counts: commentCounts() });
      }
      if (method === "POST" && (action === "reply" || action === "dm")) {
        const body = await readBody(req);
        const raw = String(body.text || "").trim();
        if (!raw) throw new Error("Write a message first.");
        if (!LIVE) return json(res, 403, { error: "Sending is locked. Set MARKETING_LIVE=true on the portal server." });
        const text = renderEngageText(raw, comment);
        let result;
        if (action === "dm") {
          if (!DM_CHANNELS.includes(comment.channel)) throw new Error(`${comment.channel} has no API for DMs to commenters.`);
          if (comment.dm) throw new Error("This person already got a DM for this comment.");
          if (["facebook", "instagram"].includes(comment.channel) && Date.now() - Date.parse(comment.createdAt) > DM_WINDOW_MS) {
            throw new Error("This comment is older than 7 days; Meta no longer allows a private reply to it.");
          }
          result = await sendDirectMessage(comment.channel, comment, text);
          if (result.ok) comment.dm = { at: new Date().toISOString(), text, by: "manual" };
        } else {
          result = await replyToComment(comment.channel, comment, text);
          if (result.ok) comment.replies = [...(comment.replies || []), { at: new Date().toISOString(), text, by: "manual" }];
        }
        if (result.ok) comment.status = "replied";
        addActivity(DATA, "engage", `${action === "dm" ? "DM" : "Reply"} to ${comment.author?.name || "a commenter"} on ${comment.channel}: ${result.ok ? "sent" : "failed"}.`, comment.postId);
        saveData();
        if (!result.ok) return json(res, 502, { error: result.reason || result.error || "The platform refused the message.", result });
        return json(res, 200, { comment: publicComment(comment), result, counts: commentCounts() });
      }
      return json(res, 405, { error: "Method not allowed" });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  if (pathname === "/api/comment-rules" || pathname.startsWith("/api/comment-rules/")) {
    const rest = pathname.slice("/api/comment-rules".length).replace(/^\//, "");
    const [rawId, verb] = rest.split("/");
    const id = rawId ? decodeURIComponentSafe(rawId) : "";
    const rule = id ? DATA.commentRules.find((item) => item.id === id) : null;
    if (id && !rule) return json(res, 404, { error: "Rule not found" });
    try {
      if (method === "GET" && !id) return json(res, 200, { rules: DATA.commentRules, channels: COMMENT_CHANNELS, dmChannels: DM_CHANNELS, notes: ENGAGE_NOTES });
      if (method === "POST" && !id) {
        const created = cleanCommentRule(await readBody(req));
        DATA.commentRules.push(created);
        addActivity(DATA, "engage", `Created comment rule “${created.name}”.`);
        saveData();
        return json(res, 201, { rule: created });
      }
      if (method === "PUT" && rule && !verb) {
        Object.assign(rule, cleanCommentRule(await readBody(req), rule));
        addActivity(DATA, "engage", `Updated comment rule “${rule.name}”${rule.enabled ? "" : " (paused)"}.`);
        saveData();
        return json(res, 200, { rule });
      }
      if (method === "DELETE" && rule && !verb) {
        DATA.commentRules = DATA.commentRules.filter((item) => item !== rule);
        addActivity(DATA, "engage", `Deleted comment rule “${rule.name}”.`);
        saveData();
        return json(res, 200, { ok: true });
      }
      if (method === "POST" && rule && verb === "test") {
        const body = await readBody(req);
        const sample = {
          id: "test",
          channel: COMMENT_CHANNELS.includes(body.channel) ? body.channel : rule.channels[0],
          text: String(body.text || ""),
          author: { name: String(body.name || "Sara Ahmed") },
          postId: String(body.postId || ""),
          createdAt: new Date().toISOString(),
        };
        const match = commentRuleMatch(rule, sample);
        return json(res, 200, {
          match: Boolean(match),
          keyword: match?.keyword || "",
          dm: match && rule.dm.trim() && DM_CHANNELS.includes(sample.channel) ? renderEngageText(rule.dm, sample, match) : "",
          reply: match && rule.reply.trim() ? renderEngageText(rule.reply, sample, match) : "",
          channel: sample.channel,
        });
      }
      return json(res, 405, { error: "Method not allowed" });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  if (pathname === "/api/saved-replies" || pathname.startsWith("/api/saved-replies/")) {
    const id = decodeURIComponentSafe(pathname.slice("/api/saved-replies".length).replace(/^\//, ""));
    try {
      if (method === "GET" && !id) return json(res, 200, { items: DATA.savedReplies });
      if (method === "POST" && !id) {
        const body = await readBody(req);
        const text = String(body.text || "").trim().slice(0, 1000);
        const title = String(body.title || text.slice(0, 40)).trim().slice(0, 60);
        if (!text) throw new Error("Write the reply text.");
        const item = { id: `reply-${Date.now()}-${randomUUID().slice(0, 4)}`, title, text, createdAt: new Date().toISOString() };
        DATA.savedReplies.unshift(item);
        saveData();
        return json(res, 201, { item });
      }
      if (method === "DELETE" && id) {
        DATA.savedReplies = DATA.savedReplies.filter((item) => item.id !== id);
        saveData();
        return json(res, 200, { ok: true });
      }
      return json(res, 405, { error: "Method not allowed" });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  if (pathname === "/api/trash" || pathname.startsWith("/api/trash/")) {
    const rest = pathname.slice("/api/trash".length).replace(/^\//, "");
    const [rawId, verb] = rest.split("/");
    const id = rawId ? decodeURIComponentSafe(rawId) : "";
    if (method === "GET" && !id) {
      return json(res, 200, { items: DATA.trash.map((item) => ({ deletedAt: item.deletedAt, post: listPost(item.post) })) });
    }
    if (method === "DELETE" && !id) {
      const count = DATA.trash.length;
      DATA.trash = [];
      addActivity(DATA, "deleted", `Emptied trash (${count} post${count === 1 ? "" : "s"} permanently deleted).`);
      saveData();
      return json(res, 200, { removed: count });
    }
    const index = DATA.trash.findIndex((item) => item.post.id === id);
    if (index < 0) return json(res, 404, { error: "Not in trash" });
    if (method === "POST" && verb === "restore") {
      const [item] = DATA.trash.splice(index, 1);
      const post = item.post;
      // A restored post never goes straight back to auto-publishing.
      if (post.status === "scheduled" || post.status === "publishing") post.status = "draft";
      if (DATA.posts.some((existing) => existing.id === post.id)) post.id = `${post.id}-restored`;
      DATA.posts.push(post);
      addActivity(DATA, "restored", `Restored “${post.title}” from trash as ${post.status.replace(/_/g, " ")}.`, post.id);
      saveData();
      return json(res, 200, { post: listPost(post) });
    }
    if (method === "DELETE" && !verb) {
      const [item] = DATA.trash.splice(index, 1);
      addActivity(DATA, "deleted", `Permanently deleted “${item.post.title}”.`);
      saveData();
      return json(res, 200, { ok: true });
    }
    return json(res, 405, { error: "Method not allowed" });
  }

  if (method === "GET" && pathname === "/api/overview") {
    const [traffic, siteLive] = await Promise.all([trafficForView(), siteLiveForView()]);
    const payload = overview();
    payload.traffic = traffic;
    payload.siteLive = siteLive;
    return json(res, 200, payload);
  }

  if (method === "GET" && pathname === "/api/posts") {
    const audit = contentAudit();
    return json(res, 200, {
      posts: filterPosts(url.searchParams).map((post) => {
        const issues = audit.issues[post.id] || [];
        return {
          ...listPost(post),
          health: issues.length ? { error: issues.filter((i) => i.level === "error").length, warn: issues.filter((i) => i.level === "warn").length, info: issues.filter((i) => i.level === "info").length } : null,
        };
      }),
    });
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
      return json(res, 200, {
        post,
        preview: previewPost(post, media ? { ...media, posterUrl: post.posterUrl || "" } : null),
        issues: contentAudit().issues[post.id] || [],
        automations: DATA.automations
          .filter((rule) => automationMatches(rule, post))
          .map((rule) => ({ id: rule.id, name: rule.name, enabled: rule.enabled, event: rule.trigger.event, minutes: rule.trigger.minutes, ran: post.automationRuns?.[rule.id] || null })),
      });
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
      moveToTrash(post);
      addActivity(DATA, "deleted", `Moved “${post.title}” to trash.`, post.id);
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
      if ("channelRules" in body) {
        // Merge: a request may update only some channels.
        const merged = { ...(DATA.settings.channelRules || {}) };
        for (const key of Object.keys(body.channelRules || {})) delete merged[key];
        next.channelRules = { ...merged, ...cleanChannelRules(body.channelRules) };
      }
      const changed = Object.keys(next).filter((key) => JSON.stringify(DATA.settings[key]) !== JSON.stringify(next[key]));
      Object.assign(DATA.settings, next);
      if ("publicUrl" in next) publicBaseOverride = next.publicUrl;
      if (changed.length) {
        const summary = changed
          .map((key) =>
            key === "channelRules"
              ? `channel rules → ${Object.entries(next.channelRules).map(([channel, rule]) => `${channel}${rule.dailyCap ? ` max ${rule.dailyCap}/day` : ""}${rule.linkInBio ? " link-in-bio" : ""}${rule.hashtags ? " hashtags" : ""}`).join(", ") || "none"}`
              : typeof next[key] === "boolean"
                ? `${key} ${next[key] ? "on" : "off"}`
                : `${key} → ${next[key] || "(empty)"}`
          )
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
  // Stories, teasers and follow-ups run after the posts of this tick went out.
  await automationTick().catch((error) => console.error(`Automation tick failed: ${error.message}`));
}

function moveToTrash(post) {
  const { revisions, ...rest } = post;
  DATA.trash.unshift({ deletedAt: new Date().toISOString(), post: { ...rest, revisions: (revisions || []).slice(0, 5) } });
  DATA.trash = DATA.trash.slice(0, 500);
}

setInterval(schedulerTick, 60_000);
setTimeout(schedulerTick, 5_000);
// Comments are read every 5 minutes on the live server (reading is safe even in dry run;
// rule DMs are only sent when dry run is off). Locally, use the Sync button.
setInterval(() => {
  if (!LIVE || !AUTO_PUBLISH) return;
  syncComments({ source: "scheduler" }).catch((error) => console.error(`Comment sync failed: ${error.message}`));
}, 5 * 60 * 1000);
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
