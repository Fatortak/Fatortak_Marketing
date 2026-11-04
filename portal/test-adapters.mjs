// Offline adapter tests: stub fetch and verify that every media path returns ok
// without calling a real social platform. Run with `npm test`.

import assert from "node:assert/strict";
import { publishToChannel, publishStory, fetchComments, replyToComment, sendDirectMessage, setHttpTransport } from "./adapters.mjs";

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
  if (target.includes("/comments") && method === "GET") {
    return json({
      data: [
        { id: "c1", from: { id: "u1", name: "Sara", username: "sara" }, username: "sara", message: "price?", text: "price?", created_time: "2026-11-04T10:00:00+0000", timestamp: "2026-11-04T10:00:00+0000" },
        { id: "c2", from: { id: "page-1", name: "Fatortak" }, message: "Thanks!", created_time: "2026-11-04T10:05:00+0000" },
      ],
    });
  }
  if (target.includes("/comments") && method === "POST") return json({ id: "fb-reply-1" });
  if (target.includes("/replies") && method === "POST") return json({ id: "ig-reply-1" });
  if (target.includes("/messages")) return json({ recipient_id: "u1", message_id: "m-1" });
  if (target.includes("getPostThread")) {
    return json({
      thread: {
        post: { uri: "at://did:plc:test/app.bsky.feed.post/1", cid: "root-cid" },
        replies: [{ post: { uri: "at://did:plc:ali/app.bsky.feed.post/9", cid: "c-cid", author: { did: "did:plc:ali", handle: "ali.bsky.social", displayName: "Ali" }, record: { text: "info please", createdAt: "2026-11-04T10:00:00Z" } } }],
      },
    });
  }
  if (target.includes("getConvoForMembers")) return json({ convo: { id: "convo-1" } });
  if (target.includes("chat.bsky.convo.sendMessage")) return json({ id: "chat-msg-1" });
  if (target.includes("/context")) {
    return json({ descendants: [{ id: "s1", account: { id: "a1", acct: "bob@m.example", display_name: "Bob" }, content: "<p>Link &amp; price?</p>", created_at: "2026-11-04T10:00:00Z", in_reply_to_id: "mast-1", url: "https://m.example/s1" }] });
  }
  if (target.includes("video_stories")) {
    return String(init.body || "").includes("upload_phase=finish")
      ? json({ post_id: "fb-video-story-1" })
      : json({ video_id: "vs-1", upload_url: "https://rupload.facebook.test/vs-1" });
  }
  if (target.includes("rupload.facebook.test")) return json({ success: true });
  if (target.includes("photo_stories")) return json({ post_id: "fb-photo-story-1" });
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

setHttpTransport(async (url, init = {}) => {
  const response = await fetch(url, init);
  return response.json();
});

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
  ["bluesky", "Bluesky video", video],
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

for (const [channel, label, attachment] of [
  ["facebook", "Facebook photo story", media],
  ["facebook", "Facebook video story", video],
  ["instagram", "Instagram image story", media],
  ["instagram", "Instagram video story", video],
]) {
  const result = await publishStory(channel, { media: attachment });
  if (!result.ok || result.kind !== "story") failures.push(`${label}: ${result.reason || result.error || "not a story"}`);
  else console.log(`ok  ${label} -> ${result.id}`);
}
{
  const result = await publishStory("linkedin", { media });
  if (result.ok || !result.skipped) failures.push("LinkedIn story: expected a clear 'no Stories API' skip");
  else console.log(`ok  LinkedIn story skipped -> ${result.reason}`);
  const noPublic = await publishStory("instagram", { media: { ...media, publicUrl: "" } });
  if (noPublic.ok) failures.push("Instagram story without public URL should be skipped");
  else console.log(`ok  Instagram story without public URL skipped`);
}

for (const [channel, postId, expectedText] of [
  ["facebook", "post-1", "price?"],
  ["instagram", "ig-media-1", "price?"],
  ["bluesky", "at://did:plc:test/app.bsky.feed.post/1", "info please"],
  ["mastodon", "mast-1", "Link & price?"],
]) {
  const fetched = await fetchComments(channel, postId);
  const first = fetched.comments?.[0];
  if (!fetched.ok || !first || first.text !== expectedText) {
    failures.push(`${channel} comments: ${fetched.error || fetched.reason || JSON.stringify(fetched.comments)}`);
    continue;
  }
  if (channel === "facebook" && fetched.comments.some((comment) => comment.author.id === "page-1")) failures.push("facebook comments: the page's own comments must be skipped");
  const reply = await replyToComment(channel, first, "Thanks — check your messages.");
  const dm = await sendDirectMessage(channel, first, "Here are the prices: https://fatortak.test");
  if (!reply.ok) failures.push(`${channel} reply: ${reply.error || reply.reason}`);
  else if (!dm.ok) failures.push(`${channel} DM: ${dm.error || dm.reason}`);
  else console.log(`ok  ${channel} comments → reply ${reply.id} → DM ${dm.id}`);
}
{
  const dm = await sendDirectMessage("linkedin", { platformId: "x" }, "hi");
  if (dm.ok || !dm.skipped) failures.push("LinkedIn DM should be a clear skip");
  else console.log(`ok  LinkedIn DM skipped -> ${dm.reason}`);
}

console.log(`\n${calls.length} mocked HTTP calls`);
if (failures.length) {
  console.error("\nFailures:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("All media adapters passed.");
