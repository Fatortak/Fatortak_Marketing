// Unified channel adapters for the marketing portal.
// API posting is used where the platform allows it. Channels that require
// app review, media assets or opt-in approval return a clear blocked result
// instead of pretending to publish.

import { postToChannel } from "../automation/src/channels.mjs";
import { env } from "../automation/src/config.mjs";

const missing = (reason) => ({ ok: false, skipped: true, reason });

async function parseJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

async function formPost(url, fields) {
  const response = await fetch(url, {
    method: "POST",
    body: new URLSearchParams(fields),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data).slice(0, 400)}`);
  }
  return data;
}

async function jsonPost(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data).slice(0, 400)}`);
  }
  return data;
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

async function postFacebook(text) {
  const pageId = env("FACEBOOK_PAGE_ID");
  const token = env("FACEBOOK_PAGE_ACCESS_TOKEN");
  if (!pageId || !token) return missing("FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN not set");
  const data = await formPost(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
    message: text,
    access_token: token,
  });
  return { ok: true, id: data.id, url: data.id ? `https://www.facebook.com/${data.id}` : undefined };
}

async function postInstagram(text, mediaUrl) {
  const userId = env("INSTAGRAM_USER_ID");
  const token = env("INSTAGRAM_ACCESS_TOKEN");
  if (!userId || !token) return missing("INSTAGRAM_USER_ID or INSTAGRAM_ACCESS_TOKEN not set");
  if (!mediaUrl) return missing("Instagram requires a public image URL (mediaUrl)");

  const container = await formPost(`https://graph.facebook.com/v21.0/${userId}/media`, {
    image_url: mediaUrl,
    caption: text,
    access_token: token,
  });
  if (!container.id) return { ok: false, error: "Instagram did not return a media container id" };
  const published = await formPost(`https://graph.facebook.com/v21.0/${userId}/media_publish`, {
    creation_id: container.id,
    access_token: token,
  });
  return { ok: true, id: published.id };
}

async function postThreads(text, mediaUrl) {
  const userId = env("THREADS_USER_ID");
  const token = env("THREADS_ACCESS_TOKEN");
  if (!userId || !token) return missing("THREADS_USER_ID or THREADS_ACCESS_TOKEN not set");

  const fields = {
    media_type: mediaUrl ? "IMAGE" : "TEXT",
    text,
    access_token: token,
  };
  if (mediaUrl) fields.image_url = mediaUrl;
  const container = await formPost(`https://graph.threads.net/v1.0/${userId}/threads`, fields);
  if (!container.id) return { ok: false, error: "Threads did not return a container id" };
  const published = await formPost(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
    creation_id: container.id,
    access_token: token,
  });
  return { ok: true, id: published.id };
}

async function postDevTo(text) {
  const key = env("DEVTO_API_KEY");
  if (!key) return missing("DEVTO_API_KEY not set");
  const lines = text.split("\n");
  const title = (lines[0] || "Fatortak update").replace(/^#+\s*/, "").slice(0, 100);
  const body = lines.slice(1).join("\n").trim() || text;
  const data = await jsonPost(
    "https://dev.to/api/articles",
    {
      article: {
        title,
        body_markdown: body,
        published: true,
        tags: ["opensource", "accounting", "mena"],
      },
    },
    { "api-key": key }
  );
  return { ok: true, id: data.id, url: data.url };
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
  if (["x", "linkedin", "bluesky", "mastodon", "telegram", "discord"].includes(channel)) return "api";
  if (["facebook", "instagram", "threads", "devto"].includes(channel)) return "api";
  return "restricted";
}

export async function publishToChannel(channel, text, { config, mediaUrl } = {}) {
  if (channel === "facebook") {
    try { return await postFacebook(text); } catch (error) { return { ok: false, error: error.message }; }
  }
  if (channel === "instagram") {
    try { return await postInstagram(text, mediaUrl); } catch (error) { return { ok: false, error: error.message }; }
  }
  if (channel === "threads") {
    try { return await postThreads(text, mediaUrl); } catch (error) { return { ok: false, error: error.message }; }
  }
  if (channel === "devto") {
    try { return await postDevTo(text); } catch (error) { return { ok: false, error: error.message }; }
  }
  if (MANUAL[channel]) return missing(MANUAL[channel]);

  try {
    return await postToChannel(channel, text, config);
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function connectionState(channel) {
  const checks = {
    x: ["X_ACCESS_TOKEN"],
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
  return {
    mode: "api",
    configured: keys.every((key) => Boolean(env(key))),
    env: keys,
  };
}
