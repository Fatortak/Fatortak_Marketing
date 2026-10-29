// Unified channel adapters for the marketing portal.
// API posting is used where the platform allows it. Channels that require
// app review, media assets or opt-in approval return a clear blocked result
// instead of pretending to publish.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import https from "node:https";
import { postToChannel } from "../automation/src/channels.mjs";
import { env } from "../automation/src/config.mjs";

const missing = (reason) => ({ ok: false, skipped: true, reason });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function parseJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

async function expectOk(response) {
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data).slice(0, 400)}`);
  }
  return data;
}

async function formPost(url, fields) {
  const response = await fetch(url, { method: "POST", body: new URLSearchParams(fields) });
  return expectOk(response);
}

async function jsonPost(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return expectOk(response);
}

async function multipartPost(url, form, headers = {}) {
  const response = await fetch(url, { method: "POST", headers, body: form });
  return expectOk(response);
}

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  return expectOk(response);
}

let httpTransport = null;

export function setHttpTransport(transport) {
  httpTransport = transport;
}

function httpsRequest(url, { method = "GET", headers = {}, body } = {}) {
  if (httpTransport) return httpTransport(url, { method, headers, body });
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers, timeout: 20_000 }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let data;
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = { raw: text };
        }
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(data).slice(0, 400)}`));
          return;
        }
        resolve(data);
      });
    });
    req.on("timeout", () => req.destroy(new Error("X request timed out")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

export const LIMITS = {
  x: 280,
  linkedin: 3000,
  facebook: 63206,
  instagram: 2200,
  threads: 500,
  tiktok: 2200,
  youtube: 5000,
  bluesky: 300,
  mastodon: 500,
  telegram: 4096,
  discord: 2000,
  devto: 100000,
  reddit: 40000,
  hackernews: 10000,
  producthunt: 5000,
  whatsapp: 4096,
  github: 65536,
};

function isVideo(media) {
  return Boolean(media && (media.kind === "video" || String(media.contentType || "").startsWith("video/")));
}

function publicMediaUrl(media) {
  return media?.publicUrl && /^https:\/\//i.test(media.publicUrl) ? media.publicUrl : "";
}

async function mediaBuffer(media) {
  if (!media) return null;
  if (media.buffer) return media.buffer;
  if (media.path && fs.existsSync(media.path)) return fs.readFileSync(media.path);
  const url = media.url || media.publicUrl;
  if (/^https?:\/\//i.test(url || "")) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Could not download media: HTTP ${response.status}`);
    const size = Number(response.headers.get("content-length") || 0);
    if (size > 100 * 1024 * 1024) throw new Error("Media is larger than 100 MB");
    return Buffer.from(await response.arrayBuffer());
  }
  throw new Error("Media file is missing");
}

async function mediaBlob(media) {
  const buffer = await mediaBuffer(media);
  if (!buffer) return null;
  return new Blob([buffer], {
    type: media.contentType || (isVideo(media) ? "video/mp4" : "image/png"),
  });
}

function mediaName(media, fallback) {
  return media?.name || (isVideo(media) ? "video.mp4" : "image.png") || fallback;
}

async function waitForMetaContainer(url, token, field = "status_code", tries = 24) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const check = new URL(url);
    check.searchParams.set("fields", field);
    check.searchParams.set("access_token", token);
    const data = await fetchJson(check);
    const state = data[field] || data.status_code || data.status;
    if (state === "FINISHED" || state === "PUBLISHED") return data;
    if (state === "ERROR" || state === "EXPIRED") {
      throw new Error(`Media processing failed: ${JSON.stringify(data).slice(0, 300)}`);
    }
    await sleep(5000);
  }
  throw new Error("Media processing timed out");
}

async function postFacebook(text, media) {
  const pageId = env("FACEBOOK_PAGE_ID");
  const token = env("FACEBOOK_PAGE_ACCESS_TOKEN");
  if (!pageId || !token) return missing("FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN not set");

  if (media) {
    const form = new FormData();
    form.append("access_token", token);
    if (isVideo(media)) {
      form.append("description", text);
      form.append("source", await mediaBlob(media), mediaName(media, "video.mp4"));
      const data = await multipartPost(`https://graph.facebook.com/v21.0/${pageId}/videos`, form);
      return { ok: true, id: data.id, url: data.id ? `https://www.facebook.com/${data.id}` : undefined };
    }
    form.append("caption", text);
    form.append("source", await mediaBlob(media), mediaName(media, "image.png"));
    const data = await multipartPost(`https://graph.facebook.com/v21.0/${pageId}/photos`, form);
    return { ok: true, id: data.post_id || data.id, url: data.post_id ? `https://www.facebook.com/${data.post_id}` : undefined };
  }

  const data = await formPost(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
    message: text,
    access_token: token,
  });
  return { ok: true, id: data.id, url: data.id ? `https://www.facebook.com/${data.id}` : undefined };
}

async function postInstagram(text, media) {
  const userId = env("INSTAGRAM_USER_ID");
  const token = env("INSTAGRAM_ACCESS_TOKEN");
  if (!userId || !token) return missing("INSTAGRAM_USER_ID or INSTAGRAM_ACCESS_TOKEN not set");
  if (!media) return missing("Instagram requires an image or video.");
  const url = publicMediaUrl(media);
  if (!url) return missing("Instagram requires a public https media URL. Set PORTAL_PUBLIC_URL or use a CDN URL.");

  const video = isVideo(media);
  const fields = { caption: text, access_token: token };
  if (video) {
    fields.media_type = "REELS";
    fields.video_url = url;
  } else {
    fields.image_url = url;
  }
  const container = await formPost(`https://graph.facebook.com/v21.0/${userId}/media`, fields);
  if (!container.id) return { ok: false, error: "Instagram did not return a media container id" };
  if (video) await waitForMetaContainer(`https://graph.facebook.com/v21.0/${container.id}`, token);
  const published = await formPost(`https://graph.facebook.com/v21.0/${userId}/media_publish`, {
    creation_id: container.id,
    access_token: token,
  });
  return { ok: true, id: published.id };
}

async function postThreads(text, media) {
  const userId = env("THREADS_USER_ID");
  const token = env("THREADS_ACCESS_TOKEN");
  if (!userId || !token) return missing("THREADS_USER_ID or THREADS_ACCESS_TOKEN not set");

  const fields = { text, access_token: token };
  if (media) {
    const url = publicMediaUrl(media);
    if (!url) return missing("Threads requires a public https media URL. Set PORTAL_PUBLIC_URL or use a CDN URL.");
    const video = isVideo(media);
    fields.media_type = video ? "VIDEO" : "IMAGE";
    if (video) fields.video_url = url;
    else fields.image_url = url;
  } else {
    fields.media_type = "TEXT";
  }

  const container = await formPost(`https://graph.threads.net/v1.0/${userId}/threads`, fields);
  if (!container.id) return { ok: false, error: "Threads did not return a container id" };
  if (media && isVideo(media)) await waitForMetaContainer(`https://graph.threads.net/v1.0/${container.id}`, token, "status");
  const published = await formPost(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
    creation_id: container.id,
    access_token: token,
  });
  return { ok: true, id: published.id };
}

async function postDevTo(text, media) {
  const key = env("DEVTO_API_KEY");
  if (!key) return missing("DEVTO_API_KEY not set");
  const lines = text.split("\n");
  const title = (lines[0] || "Fatortak update").replace(/^#+\s*/, "").slice(0, 100);
  const body = lines.slice(1).join("\n").trim() || text;
  const article = {
    title,
    body_markdown: body,
    published: true,
    tags: ["opensource", "accounting", "mena"],
  };
  const cover = publicMediaUrl(media);
  if (media && !cover) return missing("Dev.to needs a public https cover image. Set PORTAL_PUBLIC_URL or attach a CDN URL.");
  if (cover) article.main_image = cover;
  const data = await jsonPost("https://dev.to/api/articles", { article }, { "api-key": key });
  return { ok: true, id: data.id, url: data.url };
}

function linkedInHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": env("LINKEDIN_VERSION", "202507"),
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

async function postLinkedIn(text, media) {
  const token = env("LINKEDIN_ACCESS_TOKEN");
  const author = env("LINKEDIN_AUTHOR_URN");
  if (!token || !author) return missing("LINKEDIN_ACCESS_TOKEN or LINKEDIN_AUTHOR_URN not set");

  let content;
  if (media) {
    if (isVideo(media)) return missing("LinkedIn video upload is not implemented yet; attach an image.");
    const initialize = await jsonPost(
      "https://api.linkedin.com/rest/images?action=initializeUpload",
      { initializeUploadRequest: { owner: author } },
      linkedInHeaders(token)
    );
    const uploadUrl = initialize.value?.uploadUrl;
    const imageUrn = initialize.value?.image;
    if (!uploadUrl || !imageUrn) throw new Error("LinkedIn did not return an image upload URL");
    const upload = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: await mediaBlob(media),
    });
    if (!upload.ok) throw new Error(`LinkedIn image upload HTTP ${upload.status}`);
    content = { media: { id: imageUrn } };
  }

  const body = {
    author,
    commentary: text,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
    ...(content || {}),
  };
  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: { ...linkedInHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await parseJson(response);
    throw new Error(`LinkedIn HTTP ${response.status}: ${JSON.stringify(data).slice(0, 400)}`);
  }
  return { ok: true, id: response.headers.get("x-restli-id") || undefined };
}

function percentEncode(value) {
  return encodeURIComponent(String(value)).replace(/[!*'()]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function oauth1Header(method, url) {
  const consumerKey = env("X_API_KEY");
  const consumerSecret = env("X_API_SECRET");
  const token = env("X_OAUTH1_ACCESS_TOKEN") || env("X_ACCESS_TOKEN");
  const tokenSecret = env("X_OAUTH1_ACCESS_TOKEN_SECRET") || env("X_ACCESS_TOKEN_SECRET");
  const oauth = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: token,
    oauth_version: "1.0",
  };
  const parameterString = Object.keys(oauth)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(oauth[key])}`)
    .join("&");
  const base = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(parameterString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  oauth.oauth_signature = crypto.createHmac("sha1", signingKey).update(base).digest("base64");
  return `OAuth ${Object.keys(oauth)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(oauth[key])}"`)
    .join(", ")}`;
}

async function postX(text, media) {
  const token = env("X_ACCESS_TOKEN");
  const oauth1Ready = Boolean(
    env("X_API_KEY") &&
    env("X_API_SECRET") &&
    (env("X_OAUTH1_ACCESS_TOKEN") || (env("X_ACCESS_TOKEN") && env("X_ACCESS_TOKEN_SECRET"))) &&
    (env("X_OAUTH1_ACCESS_TOKEN_SECRET") || env("X_ACCESS_TOKEN_SECRET"))
  );
  if (!token && !oauth1Ready) return missing("X_ACCESS_TOKEN or OAuth 1.0a keys not set");

  if (!media) {
    const url = "https://api.x.com/2/tweets";
    const headers = token
      ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
      : { Authorization: oauth1Header("POST", url), "Content-Type": "application/json" };
    const data = await httpsRequest(url, { method: "POST", headers, body: JSON.stringify({ text }) });
    return { ok: true, id: data?.data?.id, url: data?.data?.id ? `https://x.com/i/web/status/${data.data.id}` : undefined };
  }

  if (isVideo(media)) return missing("X video upload is not implemented yet; attach an image.");
  const hasOauth1Token = Boolean(env("X_OAUTH1_ACCESS_TOKEN") || (env("X_ACCESS_TOKEN") && env("X_ACCESS_TOKEN_SECRET")));
  if (!env("X_API_KEY") || !env("X_API_SECRET") || !hasOauth1Token) {
    return missing("X image posts need X_API_KEY, X_API_SECRET and an OAuth 1.0a user token (X_OAUTH1_ACCESS_TOKEN + X_OAUTH1_ACCESS_TOKEN_SECRET).");
  }

  const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";
  const buffer = await mediaBuffer(media);
  if (!buffer) throw new Error("Media file is missing");
  const boundary = `----fatortak${crypto.randomBytes(12).toString("hex")}`;
  const mediaType = media.contentType || "image/png";
  const multipart = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${mediaName(media, "image.png")}"\r\nContent-Type: ${mediaType}\r\n\r\n`
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const uploaded = await httpsRequest(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: oauth1Header("POST", uploadUrl),
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": String(multipart.length),
    },
    body: multipart,
  });
  const mediaId = uploaded.media_id_string || uploaded.media_id;
  if (!mediaId) throw new Error("X did not return a media id");

  const tweetUrl = "https://api.x.com/2/tweets";
  const data = await httpsRequest(tweetUrl, {
    method: "POST",
    headers: { Authorization: oauth1Header("POST", tweetUrl), "Content-Type": "application/json" },
    body: JSON.stringify({ text, media: { media_ids: [String(mediaId)] } }),
  });
  return { ok: true, id: data?.data?.id, url: data?.data?.id ? `https://x.com/i/web/status/${data.data.id}` : undefined };
}

async function postBluesky(text, media) {
  const identifier = env("BLUESKY_HANDLE");
  const password = env("BLUESKY_APP_PASSWORD");
  if (!identifier || !password) return missing("BLUESKY_HANDLE or BLUESKY_APP_PASSWORD not set");
  const service = env("BLUESKY_SERVICE", "https://bsky.social").replace(/\/$/, "");

  const session = await jsonPost(`${service}/xrpc/com.atproto.server.createSession`, { identifier, password });
  const { accessJwt, did } = session;

  let embed;
  if (media) {
    if (isVideo(media)) return missing("Bluesky does not support video upload; attach an image.");
    const upload = await fetch(`${service}/xrpc/com.atproto.repo.uploadBlob`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessJwt}`,
        "Content-Type": media.contentType || "image/png",
      },
      body: await mediaBuffer(media),
    });
    const blob = await expectOk(upload);
    embed = {
      $type: "app.bsky.embed.images",
      images: [{ alt: String(media.alt || "").slice(0, 1000), image: blob.blob }],
    };
  }

  const record = {
    $type: "app.bsky.feed.post",
    text,
    createdAt: new Date().toISOString(),
    facets: blueskyFacets(text),
    ...(embed ? { embed } : {}),
  };
  const created = await jsonPost(
    `${service}/xrpc/com.atproto.repo.createRecord`,
    { repo: did, collection: "app.bsky.feed.post", record },
    { Authorization: `Bearer ${accessJwt}` }
  );
  const uri = created?.uri;
  const rkey = uri?.split("/").pop();
  return { ok: true, id: uri, url: rkey && did ? `https://bsky.app/profile/${did}/post/${rkey}` : undefined };
}

function blueskyFacets(text) {
  const encoder = new TextEncoder();
  const bytes = (value) => encoder.encode(value).length;
  const facets = [];
  const urlRe = /https?:\/\/[^\s]+/g;
  let match;
  while ((match = urlRe.exec(text)) !== null) {
    const before = text.slice(0, match.index);
    facets.push({
      index: { byteStart: bytes(before), byteEnd: bytes(before + match[0]) },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: match[0] }],
    });
  }
  const tagRe = /(^|\s)#([A-Za-z0-9_\u0600-\u06FF]+)/g;
  while ((match = tagRe.exec(text)) !== null) {
    const tag = match[2];
    const start = match.index + match[1].length;
    const before = text.slice(0, start);
    facets.push({
      index: { byteStart: bytes(before), byteEnd: bytes(`${before}#${tag}`) },
      features: [{ $type: "app.bsky.richtext.facet#tag", tag }],
    });
  }
  return facets;
}

async function postMastodon(text, config, media) {
  const token = env("MASTODON_ACCESS_TOKEN");
  const instance = env("MASTODON_INSTANCE", config.channels?.mastodon?.instance || "https://mastodon.social").replace(/\/$/, "");
  if (!token) return missing("MASTODON_ACCESS_TOKEN not set");

  const mediaIds = [];
  if (media) {
    const form = new FormData();
    form.append("file", await mediaBlob(media), mediaName(media));
    if (media.alt) form.append("description", String(media.alt).slice(0, 1500));
    const uploaded = await multipartPost(`${instance}/api/v2/media`, form, { Authorization: `Bearer ${token}` });
    let id = uploaded.id;
    if (isVideo(media) || !uploaded.url) {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const info = await fetchJson(`${instance}/api/v1/media/${id}`, { Authorization: `Bearer ${token}` });
        if (info.url) break;
        await sleep(3000);
      }
    }
    mediaIds.push(id);
  }

  const body = {
    status: text,
    visibility: "public",
    ...(mediaIds.length ? { media_ids: mediaIds } : {}),
  };
  const data = await jsonPost(`${instance}/api/v1/statuses`, body, { Authorization: `Bearer ${token}` });
  return { ok: true, id: data?.id, url: data?.url };
}

async function postTelegram(text, media) {
  const token = env("TELEGRAM_BOT_TOKEN");
  const chatId = env("TELEGRAM_CHAT_ID");
  if (!token || !chatId) return missing("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set");

  if (media) {
    const video = isVideo(media);
    const endpoint = video ? "sendVideo" : "sendPhoto";
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", text.length > 1024 ? `${text.slice(0, 1023)}…` : text);
    form.append(video ? "video" : "photo", await mediaBlob(media), mediaName(media));
    const data = await multipartPost(`https://api.telegram.org/bot${token}/${endpoint}`, form);
    return { ok: true, id: data?.result?.message_id };
  }

  const data = await jsonPost(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId,
    text,
    disable_web_page_preview: false,
  });
  return { ok: true, id: data?.result?.message_id };
}

async function postDiscord(text, media) {
  const webhook = env("DISCORD_WEBHOOK_URL");
  if (!webhook) return missing("DISCORD_WEBHOOK_URL not set");
  if (!media) {
    const data = await jsonPost(webhook, { content: text });
    return { ok: true, id: data?.id };
  }
  const form = new FormData();
  form.append("payload_json", JSON.stringify({ content: text }));
  form.append("files[0]", await mediaBlob(media), mediaName(media));
  const data = await multipartPost(webhook, form);
  return { ok: true, id: data?.id };
}

const MANUAL = {
  tiktok: "TikTok Content Posting API requires a developer app audit and a video asset.",
  youtube: "YouTube publishing requires OAuth, a video asset and API quota/audit.",
  reddit: "Reddit does not allow unattended self-promotion. Monitoring only.",
  hackernews: "Hacker News has no posting API and automation is against community norms.",
  producthunt: "Product Hunt has no public launch-posting API.",
  whatsapp: "WhatsApp requires opt-in template approval; not a broadcast channel.",
  github: "GitHub is used for repo monitoring, not social posting.",
};

export function channelMode(channel) {
  if (["x", "linkedin", "facebook", "instagram", "threads", "bluesky", "mastodon", "telegram", "discord", "devto"].includes(channel)) {
    return "api";
  }
  return "restricted";
}

export async function publishToChannel(channel, text, { config, media } = {}) {
  try {
    if (channel === "facebook") return await postFacebook(text, media);
    if (channel === "instagram") return await postInstagram(text, media);
    if (channel === "threads") return await postThreads(text, media);
    if (channel === "devto") return await postDevTo(text, media);
    if (channel === "linkedin") return await postLinkedIn(text, media);
    if (channel === "x") return await postX(text, media);
    if (channel === "bluesky") return await postBluesky(text, media);
    if (channel === "mastodon") return await postMastodon(text, config, media);
    if (channel === "telegram") return await postTelegram(text, media);
    if (channel === "discord") return await postDiscord(text, media);
    if (MANUAL[channel]) return missing(MANUAL[channel]);
    return await postToChannel(channel, text, config);
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function connectionState(channel) {
  const checks = {
    x: ["X_API_KEY", "X_API_SECRET", "X_OAUTH1_ACCESS_TOKEN", "X_OAUTH1_ACCESS_TOKEN_SECRET"],
    linkedin: ["LINKEDIN_ACCESS_TOKEN", "LINKEDIN_AUTHOR_URN"],
    bluesky: ["BLUESKY_HANDLE", "BLUESKY_APP_PASSWORD"],
    mastodon: ["MASTODON_ACCESS_TOKEN"],
    telegram: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
    discord: ["DISCORD_WEBHOOK_URL"],
    facebook: ["FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_ACCESS_TOKEN"],
    instagram: ["INSTAGRAM_USER_ID", "INSTAGRAM_ACCESS_TOKEN"],
    threads: ["THREADS_USER_ID", "THREADS_ACCESS_TOKEN"],
    devto: ["DEVTO_API_KEY"],
  };
  const keys = checks[channel];
  if (!keys) return { mode: "restricted", configured: false, env: [] };
  let configured = keys.every((key) => Boolean(env(key)));
  if (channel === "x") {
    configured = configured || Boolean(env("X_ACCESS_TOKEN"));
  }
  return {
    mode: "api",
    configured,
    env: keys,
  };
}

export async function testConnection(channel) {
  try {
    if (channel === "facebook") {
      const pageId = env("FACEBOOK_PAGE_ID");
      const token = env("FACEBOOK_PAGE_ACCESS_TOKEN");
      if (!pageId || !token) return { ok: false, detail: "Page ID and Page access token are required." };
      const data = await fetchJson(`https://graph.facebook.com/v21.0/${pageId}?fields=id,name&access_token=${encodeURIComponent(token)}`);
      return { ok: true, detail: `Page: ${data.name || data.id}` };
    }
    if (channel === "instagram") {
      const userId = env("INSTAGRAM_USER_ID");
      const token = env("INSTAGRAM_ACCESS_TOKEN");
      if (!userId || !token) return { ok: false, detail: "Instagram user ID and access token are required." };
      const data = await fetchJson(`https://graph.facebook.com/v21.0/${userId}?fields=username&access_token=${encodeURIComponent(token)}`);
      return { ok: true, detail: `@${data.username || userId}` };
    }
    if (channel === "threads") {
      const userId = env("THREADS_USER_ID");
      const token = env("THREADS_ACCESS_TOKEN");
      if (!userId || !token) return { ok: false, detail: "Threads user ID and access token are required." };
      const data = await fetchJson(`https://graph.threads.net/v1.0/${userId}?fields=username&access_token=${encodeURIComponent(token)}`);
      return { ok: true, detail: `@${data.username || userId}` };
    }
    if (channel === "linkedin") {
      const token = env("LINKEDIN_ACCESS_TOKEN");
      const author = env("LINKEDIN_AUTHOR_URN");
      if (!token || !author) return { ok: false, detail: "Access token and author URN are required." };
      const organization = String(author).replace("urn:li:organization:", "");
      const data = await fetchJson(`https://api.linkedin.com/rest/organizations/${organization}`, linkedInHeaders(token));
      return { ok: true, detail: `Organization: ${data.localizedName || organization}` };
    }
    if (channel === "x") {
      const token = env("X_ACCESS_TOKEN");
      const oauth1Ready = Boolean(env("X_API_KEY") && env("X_API_SECRET") && env("X_OAUTH1_ACCESS_TOKEN") && env("X_OAUTH1_ACCESS_TOKEN_SECRET"));
      if (!token && !oauth1Ready) return { ok: false, detail: "X access token or OAuth 1.0a keys are required." };
      const url = "https://api.x.com/2/users/me";
      const headers = token ? { Authorization: `Bearer ${token}` } : { Authorization: oauth1Header("GET", url) };
      const data = await httpsRequest(url, { headers });
      return { ok: true, detail: `@${data.data?.username || "connected"}` };
    }
    if (channel === "bluesky") {
      const identifier = env("BLUESKY_HANDLE");
      const password = env("BLUESKY_APP_PASSWORD");
      if (!identifier || !password) return { ok: false, detail: "Bluesky handle and app password are required." };
      const service = env("BLUESKY_SERVICE", "https://bsky.social").replace(/\/$/, "");
      const data = await jsonPost(`${service}/xrpc/com.atproto.server.createSession`, { identifier, password });
      return { ok: true, detail: `@${data.handle || identifier}` };
    }
    if (channel === "mastodon") {
      const token = env("MASTODON_ACCESS_TOKEN");
      if (!token) return { ok: false, detail: "Mastodon access token is required." };
      const instance = env("MASTODON_INSTANCE", "https://mastodon.social").replace(/\/$/, "");
      const data = await fetchJson(`${instance}/api/v1/accounts/verify_credentials`, { Authorization: `Bearer ${token}` });
      return { ok: true, detail: `@${data.acct || data.username || "connected"}` };
    }
    if (channel === "telegram") {
      const token = env("TELEGRAM_BOT_TOKEN");
      if (!token) return { ok: false, detail: "Telegram bot token is required." };
      const data = await fetchJson(`https://api.telegram.org/bot${token}/getMe`);
      return { ok: true, detail: `@${data.result?.username || "bot"}` };
    }
    if (channel === "discord") {
      const webhook = env("DISCORD_WEBHOOK_URL");
      if (!webhook) return { ok: false, detail: "Discord webhook URL is required." };
      const data = await fetchJson(webhook);
      return { ok: true, detail: `Webhook: ${data.name || "connected"}` };
    }
    if (channel === "devto") {
      const key = env("DEVTO_API_KEY");
      if (!key) return { ok: false, detail: "Dev.to API key is required." };
      const data = await fetchJson("https://dev.to/api/users/me", { "api-key": key });
      return { ok: true, detail: `@${data.username || "connected"}` };
    }
    return { ok: false, detail: MANUAL[channel] || "This channel is monitoring-only." };
  } catch (error) {
    return { ok: false, detail: error.message };
  }
}
