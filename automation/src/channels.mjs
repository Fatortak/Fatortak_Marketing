import { env } from "./config.mjs";

export const LIMITS = {
  x: 280,
  linkedin: 3000,
  bluesky: 300,
  mastodon: 500,
  telegram: 4096,
  discord: 2000,
};

const encoder = new TextEncoder();
const bytes = (value) => encoder.encode(value).length;

async function http(url, { method = "GET", headers = {}, body, timeout = 25_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json", ...headers } : headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const raw = await response.text();
    let data = raw;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      /* keep text */
    }
    if (!response.ok) {
      const detail = typeof data === "string" ? data : JSON.stringify(data);
      throw new Error(`HTTP ${response.status}: ${detail.slice(0, 400)}`);
    }
    return { data, headers: response.headers };
  } finally {
    clearTimeout(timer);
  }
}

function blueskyFacets(text) {
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

const missing = (reason) => ({ ok: false, skipped: true, reason });

async function postX(text) {
  const token = env("X_ACCESS_TOKEN") || env("X_BEARER_TOKEN");
  if (!token) return missing("X_ACCESS_TOKEN not set");
  const { data } = await http("https://api.x.com/2/tweets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { text },
  });
  return { ok: true, id: data?.data?.id, url: data?.data?.id ? `https://x.com/i/web/status/${data.data.id}` : undefined };
}

async function postLinkedIn(text) {
  const token = env("LINKEDIN_ACCESS_TOKEN");
  const author = env("LINKEDIN_AUTHOR_URN");
  if (!token || !author) return missing("LINKEDIN_ACCESS_TOKEN or LINKEDIN_AUTHOR_URN not set");

  const { headers } = await http("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": env("LINKEDIN_VERSION", "202507"),
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: {
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
    },
  });
  return { ok: true, id: headers.get("x-restli-id") || undefined };
}

async function postBluesky(text) {
  const identifier = env("BLUESKY_HANDLE");
  const password = env("BLUESKY_APP_PASSWORD");
  if (!identifier || !password) return missing("BLUESKY_HANDLE or BLUESKY_APP_PASSWORD not set");
  const service = env("BLUESKY_SERVICE", "https://bsky.social").replace(/\/$/, "");

  const session = await http(`${service}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    body: { identifier, password },
  });
  const { accessJwt, did } = session.data;

  const record = {
    $type: "app.bsky.feed.post",
    text,
    createdAt: new Date().toISOString(),
    facets: blueskyFacets(text),
  };
  const created = await http(`${service}/xrpc/com.atproto.repo.createRecord`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessJwt}` },
    body: { repo: did, collection: "app.bsky.feed.post", record },
  });
  const uri = created.data?.uri;
  const rkey = uri?.split("/").pop();
  return { ok: true, id: uri, url: rkey && did ? `https://bsky.app/profile/${did}/post/${rkey}` : undefined };
}

async function postMastodon(text, config) {
  const token = env("MASTODON_ACCESS_TOKEN");
  const instance = env("MASTODON_INSTANCE", config.channels?.mastodon?.instance || "https://mastodon.social").replace(/\/$/, "");
  if (!token) return missing("MASTODON_ACCESS_TOKEN not set");
  const { data } = await http(`${instance}/api/v1/statuses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: { status: text, visibility: "public" },
  });
  return { ok: true, id: data?.id, url: data?.url };
}

async function postTelegram(text) {
  const token = env("TELEGRAM_BOT_TOKEN");
  const chatId = env("TELEGRAM_CHAT_ID");
  if (!token || !chatId) return missing("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set");
  const { data } = await http(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    body: { chat_id: chatId, text, disable_web_page_preview: false },
  });
  return { ok: true, id: data?.result?.message_id };
}

async function postDiscord(text) {
  const webhook = env("DISCORD_WEBHOOK_URL");
  if (!webhook) return missing("DISCORD_WEBHOOK_URL not set");
  const { data } = await http(webhook, { method: "POST", body: { content: text } });
  return { ok: true, id: data?.id };
}

const ADAPTERS = {
  x: postX,
  linkedin: postLinkedIn,
  bluesky: postBluesky,
  mastodon: (text, config) => postMastodon(text, config),
  telegram: postTelegram,
  discord: postDiscord,
};

export async function postToChannel(channel, text, config) {
  const adapter = ADAPTERS[channel];
  if (!adapter) return { ok: false, skipped: true, reason: `unknown channel: ${channel}` };
  if (config.channels?.[channel]?.enabled === false) return missing("disabled in config");

  const limit = LIMITS[channel];
  if (limit && text.length > limit) {
    return { ok: false, skipped: true, reason: `text is ${text.length} chars; ${channel} allows ${limit}` };
  }

  try {
    const result = await adapter(text, config);
    return result;
  } catch (error) {
    return { ok: false, skipped: false, error: error.message };
  }
}

export function summarizeResults(results) {
  const posted = results.filter((r) => r.ok);
  const skipped = results.filter((r) => r.skipped);
  const failed = results.filter((r) => !r.ok && !r.skipped);
  return { posted: posted.length, skipped: skipped.length, failed: failed.length, results };
}
