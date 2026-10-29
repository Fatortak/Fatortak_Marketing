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
} from "./adapters.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(HERE, "data");
const DATA_FILE = path.join(DATA_DIR, "portal.json");
const PUBLIC_DIR = path.join(HERE, "public");
const MEDIA_DIR = path.join(DATA_DIR, "media");
const LANDING_ASSETS = path.join(MARKETING_ROOT, "landing", "assets");
const SCREENSHOTS_DIR = path.join(LANDING_ASSETS, "screenshots");
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
loadDotEnv(path.join(HERE, ".env"));

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
];

const PILLAR_MEDIA = {
  product: "dashboard",
  insight: "income",
  "open-source": "ai-chart",
  "use-case": "projects",
  arabic: "dashboard",
  "ai-ocr": "ocr",
  commercial: "profitability",
  tip: "dashboard",
};

function siteBase() {
  return String(CONFIG?.links?.site || "").replace(/\/$/, "");
}

function libraryItem(id) {
  return MEDIA_LIBRARY.find((item) => item.id === id) || null;
}

function mediaFromLibrary(id) {
  const item = libraryItem(id) || libraryItem("dashboard");
  if (!item) return {};
  return {
    mediaUrl: `/media/landing/${item.file}`,
    mediaPublicUrl: siteBase() ? `${siteBase()}/assets/screenshots/${item.file}` : "",
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
  data.activity = data.activity.slice(0, 200);
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
      notes: "",
      results: [],
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
  for (const post of data.posts) {
    if (!post.mediaUrl) {
      Object.assign(post, defaultMediaForPillar(post.pillar || "product"));
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

function saveData() {
  DATA.updatedAt = new Date().toISOString();
  writeJson(DATA_FILE, DATA);
}

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
      const url = `/media/${encodeURIComponent(name)}`;
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
  if (!force && now - siteLiveCache.at < 5 * 60_000) return siteLiveCache.value;
  try {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(7000) });
    const body = await response.text();
    const isOurPage = /fatortak-logo-white\.png|Arabic-first business management/i.test(body);
    siteLiveCache = { at: now, value: response.ok && isOurPage };
  } catch {
    siteLiveCache = { at: now, value: false };
  }
  return siteLiveCache.value;
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
  const upcoming = DATA.posts
    .filter((post) => ["scheduled", "approved"].includes(post.status))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .slice(0, 8);
  return {
    total: DATA.posts.length,
    counts,
    needsReview: counts.needs_review || 0,
    scheduled: (counts.scheduled || 0) + (counts.approved || 0),
    published: counts.published || 0,
    published30,
    failed: counts.failed || 0,
    blocked: counts.blocked || 0,
    dryRun: counts.dry_run || 0,
    upcoming,
  };
}

function queueSnapshot() {
  try {
    const queue = loadQueue();
    const state = loadState();
    const stats = queueStats(queue, state);
    const next = queue.items
      .filter((item) => !state.posted?.[item.id])
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0];
    return { ...stats, next: next ? { id: next.id, date: next.date, time: next.time } : null };
  } catch (error) {
    return { total: 0, posted: 0, upcoming: 0, overdue: 0, remaining: 0, next: null, error: error.message };
  }
}

function metricsTotals() {
  const totals = { followers: 0, reach: 0, engagement: 0, clicks: 0, posts: 0 };
  for (const value of Object.values(DATA.metrics)) {
    for (const key of Object.keys(totals)) totals[key] += Number(value[key] || 0);
  }
  return totals;
}

async function getTraffic(force = false) {
  const siteId = env("PLAUSIBLE_SITE_ID");
  const apiKey = env("PLAUSIBLE_API_KEY");
  if (!siteId || !apiKey) return { configured: false };
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
    return { configured: true, error: error.message };
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
    followers: data.stargazers_count || 0,
    engagement: data.forks_count || 0,
    posts: data.open_issues_count || 0,
    lastUpdated: new Date().toISOString(),
    note: `${data.full_name} · stars / forks / open issues`,
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
  DATA.metrics.bluesky = {
    ...DATA.metrics.bluesky,
    followers: data.followersCount || 0,
    posts: data.postsCount || 0,
    lastUpdated: new Date().toISOString(),
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
  DATA.metrics.mastodon = {
    ...DATA.metrics.mastodon,
    followers: data.followers_count || 0,
    posts: data.statuses_count || 0,
    lastUpdated: new Date().toISOString(),
    note: `@${account}`,
  };
  return { channel: "mastodon", followers: data.followers_count || 0 };
}

async function syncMetrics() {
  const results = [];
  const warnings = [];
  try { results.push(await syncGithub()); } catch (error) { warnings.push(`GitHub: ${error.message}`); }
  try { const b = await syncBluesky(); if (b) results.push(b); } catch (error) { warnings.push(`Bluesky: ${error.message}`); }
  try { const m = await syncMastodon(); if (m) results.push(m); } catch (error) { warnings.push(`Mastodon: ${error.message}`); }
  const traffic = await getTraffic(true);
  if (traffic.error) warnings.push(`Plausible: ${traffic.error}`);
  for (const channel of CHANNEL_DEFS) {
    if (["x", "linkedin", "facebook", "instagram", "threads", "tiktok", "youtube", "telegram", "discord", "devto"].includes(channel.key)) {
      const info = channelInfo(channel.key);
      if (!info.configured) warnings.push(`${channel.label}: connect API credentials to ingest metrics.`);
    }
  }
  addActivity(DATA, "metrics", `Metrics sync completed (${results.length} channel${results.length === 1 ? "" : "s"}).`);
  saveData();
  return { synced: results, warnings, traffic };
}

function validatePostInput(body, existing = null) {
  const channels = Array.isArray(body.channels) ? body.channels : existing?.channels || [];
  const known = new Set(CHANNEL_DEFS.map((channel) => channel.key));
  const invalid = channels.filter((channel) => !known.has(channel));
  if (invalid.length) throw new Error(`Unknown channels: ${invalid.join(", ")}`);
  if (!body.content && !existing?.content) throw new Error("Post content is required");
  if (!channels.length) throw new Error("Select at least one channel");
  const statuses = ["draft", "needs_review", "approved", "scheduled", "published", "failed", "blocked", "dry_run", "publishing"];
  const status = body.status || existing?.status || "draft";
  if (!statuses.includes(status)) throw new Error("Invalid status");
  const scheduledAt = body.scheduledAt || existing?.scheduledAt;
  if (scheduledAt && Number.isNaN(new Date(scheduledAt).getTime())) throw new Error("Invalid scheduledAt");

  const mediaUrl = String(body.mediaUrl ?? existing?.mediaUrl ?? "").trim();
  const mediaPublicUrl = String(body.mediaPublicUrl ?? existing?.mediaPublicUrl ?? "").trim();
  const mediaKind = body.mediaKind === "video" || existing?.mediaKind === "video" ? "video" : mediaUrl ? "image" : "";
  const mediaAlt = String(body.mediaAlt ?? existing?.mediaAlt ?? "").slice(0, 1000);
  const mediaName = String(body.mediaName ?? existing?.mediaName ?? "").slice(0, 200);
  const mediaSource = String(body.mediaSource ?? existing?.mediaSource ?? "").slice(0, 200);
  if (mediaUrl && !/^(https?:\/\/|\/media\/)/i.test(mediaUrl)) throw new Error("Media URL must be an https URL or a portal /media path");
  if (DATA.settings.mediaRequired && !mediaUrl && ["scheduled", "approved", "published"].includes(status)) {
    throw new Error("Attach an image or video before scheduling or publishing. Text-only posts are disabled.");
  }

  return {
    title: String(body.title || existing?.title || "Untitled post").slice(0, 140),
    content: String(body.content || existing?.content || ""),
    channels,
    language: body.language === "ar" ? "ar" : body.language === "en" ? "en" : existing?.language || "en",
    pillar: String(body.pillar || existing?.pillar || "product").slice(0, 40),
    scheduledAt: scheduledAt || new Date().toISOString().slice(0, 16),
    status,
    mediaUrl,
    mediaPublicUrl,
    mediaKind,
    mediaAlt,
    mediaName,
    mediaSource,
    notes: String(body.notes || existing?.notes || ""),
    utm: body.utm || existing?.utm || null,
  };
}

async function resolvePostMedia(post) {
  if (!post.mediaUrl) return null;
  const url = String(post.mediaUrl);
  let file = null;
  if (url.startsWith("/media/landing/")) {
    file = path.join(SCREENSHOTS_DIR, path.basename(url));
  } else if (url.startsWith("/media/")) {
    file = path.join(MEDIA_DIR, path.basename(url));
  }
  const exists = Boolean(file && fs.existsSync(file));
  const name = post.mediaName || (file ? path.basename(file) : path.basename(url));
  const publicUrl = post.mediaPublicUrl || (/^https?:\/\//i.test(url) ? url : absoluteMediaUrl(url));
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

async function publishPost(post, { dryRun = true, automatic = false } = {}) {
  CONFIG = loadConfig();
  const channels = post.channels.filter((channel) => CHANNEL_DEFS.some((def) => def.key === channel));
  if (!channels.length) throw new Error("No valid channels selected");
  const media = await resolvePostMedia(post);
  if (DATA.settings.mediaRequired && !media) {
    post.status = "blocked";
    post.results = [{ ok: false, blocked: true, reason: "Text-only posts are disabled. Attach an image or video before publishing." }];
    post.lastAttemptAt = new Date().toISOString();
    addActivity(DATA, "blocked", `Blocked “${post.title}”: no image or video attached.`, post.id);
    saveData();
    return { blocked: true, results: post.results };
  }
  const needsSite = post.content.includes("{{site}}") || post.content.includes(CONFIG.links.site);
  if (needsSite && DATA.settings.requireLiveSite && !(await getSiteLive())) {
    post.status = "blocked";
    post.results = [{ ok: false, blocked: true, reason: "Landing page is not live. Deploy it before publishing this post." }];
    post.lastAttemptAt = new Date().toISOString();
    addActivity(DATA, "blocked", `Blocked “${post.title}”: landing page is not live.`, post.id);
    saveData();
    return { blocked: true, results: post.results };
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
    const rendered = renderText(post.content, {
      channel,
      links: CONFIG.links,
      utm: { ...(post.utm || {}), content: post.id },
    });
    const limit = LIMITS[channel];
    if (limit && rendered.length > limit) {
      results.push({ channel, ok: false, skipped: true, reason: `Text is ${rendered.length} chars; ${channel} allows ${limit}.` });
      continue;
    }
    if (mediaOnSite && ["instagram", "threads", "devto"].includes(channel) && DATA.settings.requireLiveSite && !(await getSiteLive())) {
      results.push({ channel, ok: false, skipped: true, reason: "Media is hosted on the landing page, which is not live yet." });
      continue;
    }
    if (dryRun) {
      results.push({ channel, ok: true, dryRun: true, media: media?.kind || null });
      continue;
    }
    const result = await publishToChannel(channel, rendered, { config: CONFIG, media });
    results.push({ channel, ...result });
  }

  const ok = results.filter((result) => result.ok && !result.dryRun).length;
  const failures = results.filter((result) => !result.ok && !result.skipped);
  const skipped = results.filter((result) => result.skipped);
  post.results = results;
  post.lastAttemptAt = new Date().toISOString();
  if (dryRun) {
    post.status = "dry_run";
    addActivity(DATA, "dry_run", `Dry run “${post.title}” across ${channels.length} channel${channels.length === 1 ? "" : "s"}.`, post.id);
  } else if (ok > 0) {
    post.status = "published";
    post.publishedAt = new Date().toISOString();
    addActivity(DATA, "published", `Published “${post.title}” to ${ok} channel${ok === 1 ? "" : "s"}.`, post.id);
  } else {
    post.status = "failed";
    addActivity(DATA, "failed", `Publish failed for “${post.title}” (${failures.length + skipped.length} channel issues).`, post.id);
  }
  saveData();
  return { results, published: ok, failures: failures.length, skipped: skipped.length, dryRun };
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
  return { month, posts };
}

function reportsSummary() {
  const channelCounts = {};
  for (const post of DATA.posts) {
    for (const channel of post.channels || []) channelCounts[channel] = (channelCounts[channel] || 0) + 1;
  }
  const connected = channelSummary().filter((channel) => channel.configured);
  const blocked = DATA.posts.filter((post) => post.status === "blocked").length;
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
  if (!DATA.metrics.github.lastUpdated) recommendations.push("Run a metrics sync to ingest GitHub and traffic data.");
  return {
    generatedAt: new Date().toISOString(),
    posts: postSummary(),
    channelCounts,
    metrics: { totals: metricsTotals(), channels: DATA.metrics },
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
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv() {
  const rows = [
    ["id", "title", "channels", "language", "status", "scheduledAt", "publishedAt", "results"],
    ...DATA.posts.map((post) => [
      post.id,
      post.title,
      (post.channels || []).join("|"),
      post.language,
      post.status,
      post.scheduledAt,
      post.publishedAt || "",
      JSON.stringify(post.results || []),
    ]),
  ];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
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
  const method = req.method || "GET";
  const pathname = url.pathname;

  if (pathname === "/api/health") return json(res, 200, { ok: true, name: "fatortak-marketing-portal" });
  if (!isSameOrigin(req)) return json(res, 403, { error: "Cross-origin request blocked." });
  if (!isAuthorized(req, url)) return json(res, 401, { error: "Unauthorized. Set the portal token." });

  if (method === "GET" && pathname === "/api/media/library") {
    return json(res, 200, {
      library: MEDIA_LIBRARY.map((item) => ({
        ...item,
        url: `/media/landing/${item.file}`,
        publicUrl: siteBase() ? `${siteBase()}/assets/screenshots/${item.file}` : "",
      })),
    });
  }

  if (method === "GET" && pathname === "/api/media") {
    return json(res, 200, { media: listUploadedMedia(), library: MEDIA_LIBRARY.map((item) => ({
      ...item,
      url: `/media/landing/${item.file}`,
      publicUrl: siteBase() ? `${siteBase()}/assets/screenshots/${item.file}` : "",
    })) });
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
      const buffer = await readBinary(req);
      if (!buffer.length) return json(res, 400, { error: "The uploaded file is empty." });
      const ext = path.extname(original).toLowerCase() || (kind === "video" ? ".mp4" : ".png");
      const base = path.basename(original, path.extname(original)).replace(/[^\w\- ]+/g, "_").slice(0, 60) || "upload";
      const filename = `${Date.now()}-${randomUUID().slice(0, 6)}-${base}${ext}`;
      const file = path.join(MEDIA_DIR, filename);
      fs.writeFileSync(file, buffer);
      const media = {
        id: filename,
        name: original,
        url: `/media/${encodeURIComponent(filename)}`,
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
    const traffic = await getTraffic();
    const siteLive = await getSiteLive();
    const payload = overview();
    payload.traffic = traffic;
    payload.siteLive = siteLive;
    return json(res, 200, payload);
  }

  if (method === "GET" && pathname === "/api/posts") {
    const status = url.searchParams.get("status");
    const channel = url.searchParams.get("channel");
    const lang = url.searchParams.get("lang");
    const q = (url.searchParams.get("q") || "").toLowerCase();
    let posts = [...DATA.posts];
    if (status) posts = posts.filter((post) => post.status === status);
    if (channel) posts = posts.filter((post) => (post.channels || []).includes(channel));
    if (lang) posts = posts.filter((post) => post.language === lang);
    if (q) posts = posts.filter((post) => `${post.title} ${post.content}`.toLowerCase().includes(q));
    posts.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    return json(res, 200, { posts });
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
        createdAt: now,
        updatedAt: now,
        publishedAt: null,
        lastAttemptAt: null,
      };
      DATA.posts.push(post);
      addActivity(DATA, "created", `Created “${post.title}”.`, post.id);
      saveData();
      return json(res, 201, { post });
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
  }

  const postMatch = pathname.match(/^\/api\/posts\/([^/]+)(?:\/(publish|status|duplicate))?$/);
  if (postMatch) {
    const id = decodeURIComponent(postMatch[1]);
    const action = postMatch[2];
    const post = DATA.posts.find((item) => item.id === id);
    if (!post) return json(res, 404, { error: "Post not found" });

    if (method === "PUT" && !action) {
      try {
        const body = await readBody(req);
        Object.assign(post, validatePostInput(body, post), { updatedAt: new Date().toISOString() });
        addActivity(DATA, "updated", `Updated “${post.title}”.`, post.id);
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
        const allowed = ["draft", "needs_review", "approved", "scheduled", "published", "failed", "blocked", "dry_run"];
        if (!allowed.includes(body.status)) throw new Error("Invalid status");
        if (DATA.settings.mediaRequired && ["scheduled", "approved", "published"].includes(body.status) && !post.mediaUrl) {
          throw new Error("Attach an image or video before scheduling or publishing.");
        }
        post.status = body.status;
        post.updatedAt = new Date().toISOString();
        if (body.status === "published" && !post.publishedAt) post.publishedAt = new Date().toISOString();
        addActivity(DATA, "status", `Status “${post.title}” → ${body.status}.`, post.id);
        saveData();
        return json(res, 200, { post });
      } catch (error) {
        return json(res, 400, { error: error.message });
      }
    }

    if (method === "POST" && action === "duplicate") {
      const copy = {
        ...post,
        id: `portal-${Date.now()}-${randomUUID().slice(0, 6)}`,
        title: `${post.title} (copy)`,
        status: "draft",
        results: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: null,
        lastAttemptAt: null,
      };
      DATA.posts.push(copy);
      addActivity(DATA, "created", `Duplicated “${post.title}”.`, copy.id);
      saveData();
      return json(res, 201, { post: copy });
    }

    if (method === "POST" && action === "publish") {
      try {
        const body = await readBody(req);
        const dryRun = body.dryRun !== false;
        if (!dryRun && !LIVE) {
          return json(res, 403, { error: "Live publishing is locked. Set MARKETING_LIVE=true on the portal server." });
        }
        const result = await publishPost(post, { dryRun, automatic: false });
        return json(res, 200, { post, result });
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
    const traffic = await getTraffic();
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
    const traffic = await getTraffic();
    await getSiteLive();
    return json(res, 200, { ...reportsSummary(), traffic });
  }

  if (method === "GET" && pathname === "/api/reports/export") {
    if (url.searchParams.get("format") === "json") {
      return json(res, 200, { posts: DATA.posts, metrics: DATA.metrics, reports: reportsSummary() });
    }
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=fatortak-social-report.csv",
    });
    res.end(exportCsv());
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
      const allowed = ["dryRun", "autoApprove", "requireLiveSite", "mediaRequired", "timezone", "publicUrl"];
      for (const key of allowed) {
        if (key in body) DATA.settings[key] = body[key];
      }
      if ("publicUrl" in body) {
        const value = String(body.publicUrl || "").trim().replace(/\/$/, "");
        if (value && !/^https?:\/\/[^/]+/i.test(value)) throw new Error("Public media host must be an http(s) URL.");
        DATA.settings.publicUrl = value;
        publicBaseOverride = value;
      }
      saveData();
      addActivity(DATA, "settings", "Portal settings updated.");
      return json(res, 200, { settings: DATA.settings });
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
async function schedulerTick() {
  if (schedulerBusy || !AUTO_PUBLISH || !LIVE || DATA.settings.dryRun) return;
  schedulerBusy = true;
  try {
    const due = DATA.posts
      .filter((post) => post.status === "scheduled" && new Date(post.scheduledAt) <= new Date())
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    for (const post of due) {
      post.status = "publishing";
      saveData();
      await publishPost(post, { dryRun: false, automatic: true });
    }
  } finally {
    schedulerBusy = false;
  }
}

setInterval(schedulerTick, 60_000);

server.listen(PORT, HOST, () => {
  console.log(`Fatortak marketing portal: http://${HOST}:${PORT}`);
  console.log(`Live publishing: ${LIVE ? "enabled" : "locked (set MARKETING_LIVE=true)"}`);
  console.log(`Auto-publish scheduler: ${AUTO_PUBLISH ? "enabled" : "disabled (set PORTAL_AUTO_PUBLISH=true)"}`);
  console.log(`Dry run: ${DATA.settings.dryRun ? "on" : "off"}`);
});
