// Offline adapter tests: stub fetch and verify that every media path returns ok
// without calling a real social platform. Run with `npm test`.

import assert from "node:assert/strict";
import { publishToChannel } from "./adapters.mjs";

const json = (data, status = 200, headers = {}) => ({
  ok: status < 400,
  status,
  headers: new Headers(headers),
  async text() {
    return JSON.stringify(data);
  },
  async json() {
    return data;
  },
});

const calls = [];
globalThis.fetch = async (url, init = {}) => {
  const target = String(url);
  const method = init.method || "GET";
  calls.push({ url: target, method });
  if (target.includes("/photos")) return json({ id: "photo-1", post_id: "post-1" });
  if (target.includes("/videos")) return json({ id: "video-1" });
  if (target.includes("media_publish")) return json({ id: "ig-1" });
  if (target.includes("fields=status_code")) return json({ status_code: "FINISHED" });
  if (target.includes("fields=status")) return json({ status: "FINISHED" });
  if (target.includes("graph.facebook.com") && target.includes("/media")) return json({ id: "container-1" });
  if (target.includes("threads_publish")) return json({ id: "thread-1" });
  if (target.includes("graph.threads.net") && target.includes("/threads")) return json({ id: "thread-container" });
  if (target.includes("dev.to/api/articles")) return json({ id: 1, url: "https://dev.to/fatortak/test" });
  if (target.includes("linkedin.com/rest/images")) {
    return json({ value: { uploadUrl: "https://upload.linkedin.test/1", image: "urn:li:image:1" } });
  }
  if (target.includes("upload.linkedin.test")) return json({});
  if (target.includes("linkedin.com/rest/posts")) return json({}, 200, { "x-restli-id": "li-1" });
  if (target.includes("upload.twitter.com")) return json({ media_id_string: "x-media-1" });
  if (target.includes("api.x.com/2/tweets")) return json({ data: { id: "x-1" } });
  if (target.includes("createSession")) return json({ accessJwt: "jwt", did: "did:plc:test" });
  if (target.includes("uploadBlob")) return json({ blob: { ref: "blob-1" } });
  if (target.includes("createRecord")) return json({ uri: "at://did:plc:test/app.bsky.feed.post/1" });
  if (target.includes("/api/v2/media")) return json({ id: "mast-media-1", url: "https://m.example/media/1" });
  if (target.includes("/api/v1/media/")) return json({ id: "mast-media-1", url: "https://m.example/media/1" });
  if (target.includes("/api/v1/statuses")) return json({ id: "mast-1", url: "https://m.example/status/1" });
  if (target.includes("api.telegram.org")) return json({ result: { message_id: 1 } });
  if (target.includes("discord.example")) return json({ id: "discord-1" });
  return json({ ok: true });
};

const env = {
  FACEBOOK_PAGE_ID: "page-1",
  FACEBOOK_PAGE_ACCESS_TOKEN: "fb-token",
  INSTAGRAM_USER_ID: "ig-user",
  INSTAGRAM_ACCESS_TOKEN: "ig-token",
  THREADS_USER_ID: "thread-user",
  THREADS_ACCESS_TOKEN: "thread-token",
  DEVTO_API_KEY: "dev-key",
  LINKEDIN_ACCESS_TOKEN: "li-token",
  LINKEDIN_AUTHOR_URN: "urn:li:organization:1",
  LINKEDIN_VERSION: "202507",
  X_ACCESS_TOKEN: "x-token",
  X_API_KEY: "x-key",
  X_API_SECRET: "x-secret",
  X_OAUTH1_ACCESS_TOKEN: "x-oauth1-token",
  X_OAUTH1_ACCESS_TOKEN_SECRET: "x-oauth1-secret",
  BLUESKY_HANDLE: "fatortak.bsky.social",
  BLUESKY_APP_PASSWORD: "app-password",
  BLUESKY_SERVICE: "https://bsky.social",
  MASTODON_INSTANCE: "https://m.example",
  MASTODON_ACCESS_TOKEN: "mast-token",
  TELEGRAM_BOT_TOKEN: "tg-token",
  TELEGRAM_CHAT_ID: "-100123",
  DISCORD_WEBHOOK_URL: "https://discord.example/webhook",
};
for (const [key, value] of Object.entries(env)) process.env[key] = value;

const media = {
  buffer: Buffer.from("fake-image-bytes"),
  contentType: "image/png",
  kind: "image",
  name: "test.png",
  alt: "Test image",
  publicUrl: "https://fatortak.test/test.png",
};
const config = { channels: { mastodon: { instance: "https://m.example" } } };

const video = {
  buffer: Buffer.from("fake-video-bytes"),
  contentType: "video/mp4",
  kind: "video",
  name: "test.mp4",
  alt: "Test video",
  publicUrl: "https://fatortak.test/test.mp4",
};

const cases = [
  ["facebook", "Facebook photo", media],
  ["instagram", "Instagram image", media],
  ["threads", "Threads image", media],
  ["devto", "Dev.to cover", media],
  ["linkedin", "LinkedIn image", media],
  ["x", "X image", media],
  ["bluesky", "Bluesky image", media],
  ["mastodon", "Mastodon image", media],
  ["telegram", "Telegram image", media],
  ["discord", "Discord image", media],
  ["facebook", "Facebook video", video],
  ["instagram", "Instagram Reel", video],
  ["threads", "Threads video", video],
  ["mastodon", "Mastodon video", video],
  ["telegram", "Telegram video", video],
  ["discord", "Discord video", video],
];

const expectedBlocked = [
  ["linkedin", "LinkedIn video", video],
  ["x", "X video", video],
  ["bluesky", "Bluesky video", video],
];

const failures = [];
for (const [channel, label, attachment] of cases) {
  const result = await publishToChannel(channel, `Test post for ${label}`, { config, media: attachment });
  if (!result.ok) failures.push(`${label}: ${result.reason || result.error}`);
  else console.log(`ok  ${label} -> ${result.id || "published"}`);
}
for (const [channel, label, attachment] of expectedBlocked) {
  const result = await publishToChannel(channel, `Test post for ${label}`, { config, media: attachment });
  if (result.ok) failures.push(`${label}: expected a clear block, got success`);
  else console.log(`ok  ${label} blocked -> ${result.reason || result.error}`);
}

console.log(`\n${calls.length} mocked HTTP calls`);
if (failures.length) {
  console.error("\nFailures:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("All media adapters passed.");
