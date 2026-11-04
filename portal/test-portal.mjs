// End-to-end API tests for the portal server. Boots server.mjs on a free port with a
// throwaway data directory and no credentials, so nothing can reach a real platform.
// Run with `npm run test:portal` (or `npm test` for every suite).

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "fatortak-portal-test-"));
// Comments the "platforms" return during sync (no real API is called in tests).
const commentsFixture = path.join(dataDir, "comments.json");
const recent = new Date(Date.now() + 60_000).toISOString();
fs.writeFileSync(
  commentsFixture,
  JSON.stringify([
    { channel: "instagram", platformId: "ig-c1", author: { id: "u1", name: "Sara Ahmed", handle: "sara" }, text: "What's the PRICE please?", createdAt: recent },
    { channel: "facebook", platformId: "fb-c1", author: { id: "u2", name: "محمد علي" }, text: "بكام السِّعر؟", createdAt: recent },
    { channel: "mastodon", platformId: "m-c1", author: { id: "u3", name: "Bob", handle: "bob@m.example" }, text: "Nice update!", createdAt: recent },
  ])
);

const port = await new Promise((resolve) => {
  const probe = net.createServer().listen(0, "127.0.0.1", () => {
    const { port: free } = probe.address();
    probe.close(() => resolve(free));
  });
});

const child = spawn(process.execPath, [path.join(HERE, "server.mjs")], {
  env: {
    PATH: process.env.PATH,
    SYSTEMROOT: process.env.SYSTEMROOT || "",
    PORTAL_PORT: String(port),
    PORTAL_HOST: "127.0.0.1",
    PORTAL_DATA_DIR: dataDir,
    // Never read or write the real credentials: portal/.env and automation/.env stay untouched.
    PORTAL_ENV_FILE: path.join(dataDir, "test.env"),
    PORTAL_ISOLATED: "1",
    PORTAL_COMMENTS_FIXTURE: commentsFixture,
    MARKETING_LIVE: "false",
    PORTAL_AUTO_PUBLISH: "false",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
child.stdout.on("data", (chunk) => (serverLog += chunk));
child.stderr.on("data", (chunk) => (serverLog += chunk));

const base = `http://127.0.0.1:${port}`;

async function api(pathname, { method = "GET", body, headers = {} } = {}) {
  const response = await fetch(base + pathname, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { status: response.status, data, headers: response.headers, text };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const { status } = await api("/api/health");
      if (status === 200) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start.\n${serverLog}`);
}

const media = {
  mediaUrl: "/media/landing/dashboard.png",
  mediaKind: "image",
  mediaName: "dashboard.png",
  mediaAlt: "Dashboard",
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("health and meta respond", async () => {
  const health = await api("/api/health");
  assert.equal(health.data.ok, true);
  const meta = await api("/api/meta");
  assert.equal(meta.status, 200);
  assert.ok(meta.data.statuses.includes("scheduled"));
  assert.ok(!meta.data.statuses.includes("publishing"), "publishing is internal and must not be user-settable");
  assert.equal(meta.data.limits.x, 280);
  assert.match(meta.data.now, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
});

test("create normalizes the schedule and keeps tags", async () => {
  const created = await api("/api/posts", {
    method: "POST",
    body: { content: "Hello {{site}}", channels: ["x"], scheduledAt: "2030-01-02T09:30", status: "draft", tags: ["Launch Week", "launch week"], ...media },
  });
  assert.equal(created.status, 201, created.text);
  assert.equal(created.data.post.scheduledAt, "2030-01-02T09:30:00");
  assert.deepEqual(created.data.post.tags, ["launch-week"]);
  assert.equal(created.data.post.title, "Hello {{site}}", "title falls back to the first line");
  assert.equal(created.data.post.revisionCount, 0);
});

test("invalid dates and statuses are rejected", async () => {
  const badDate = await api("/api/posts", { method: "POST", body: { content: "x", channels: ["x"], scheduledAt: "2030-02-31T09:00" } });
  assert.equal(badDate.status, 400);
  const badStatus = await api("/api/posts", { method: "POST", body: { content: "x", channels: ["x"], status: "publishing" } });
  assert.equal(badStatus.status, 400);
});

test("media is required before scheduling", async () => {
  const response = await api("/api/posts", { method: "POST", body: { content: "No media", channels: ["x"], status: "scheduled" } });
  assert.equal(response.status, 400);
  assert.match(response.data.error, /image or video/i);
});

test("PUT keeps unspecified fields, can clear notes and switch video back to image", async () => {
  const created = await api("/api/posts", {
    method: "POST",
    body: { content: "Video post", channels: ["facebook"], notes: "check copy", mediaUrl: "/media/clip.mp4", mediaKind: "video", mediaName: "clip.mp4" },
  });
  const id = created.data.post.id;
  const updated = await api(`/api/posts/${id}`, { method: "PUT", body: { notes: "", ...media } });
  assert.equal(updated.status, 200, updated.text);
  assert.equal(updated.data.post.notes, "");
  assert.equal(updated.data.post.mediaKind, "image");
  assert.equal(updated.data.post.content, "Video post");
  assert.equal(updated.data.post.revisionCount, 1);
});

test("PUT and DELETE tunneled through POST (X-Portal-Method) work like the PHP proxy", async () => {
  const created = await api("/api/posts", { method: "POST", body: { content: "Tunnel", channels: ["x"], ...media } });
  const id = created.data.post.id;
  const updated = await api(`/api/posts/${id}`, { method: "POST", body: { content: "Tunneled edit" }, headers: { "X-Portal-Method": "PUT" } });
  assert.equal(updated.status, 200, updated.text);
  assert.equal(updated.data.post.content, "Tunneled edit");
  const deleted = await api(`/api/posts/${id}`, { method: "POST", headers: { "X-Portal-Method": "DELETE" } });
  assert.equal(deleted.status, 200, deleted.text);
  assert.equal((await api(`/api/posts/${id}`)).status, 404);
});

test("stale edits are refused with 409", async () => {
  const created = await api("/api/posts", { method: "POST", body: { content: "Concurrency", channels: ["x"], ...media } });
  const { id, updatedAt } = created.data.post;
  const first = await api(`/api/posts/${id}`, { method: "PUT", body: { content: "Edit one", updatedAt } });
  assert.equal(first.status, 200);
  const second = await api(`/api/posts/${id}`, { method: "PUT", body: { content: "Edit two", updatedAt } });
  assert.equal(second.status, 409);
});

test("revisions can be restored", async () => {
  const created = await api("/api/posts", { method: "POST", body: { content: "Version one", channels: ["x"], ...media } });
  const id = created.data.post.id;
  await api(`/api/posts/${id}`, { method: "PUT", body: { content: "Version two" } });
  const full = await api(`/api/posts/${id}`);
  assert.equal(full.data.post.revisions[0].content, "Version one");
  assert.ok(Array.isArray(full.data.preview));
  const restored = await api(`/api/posts/${id}/restore`, { method: "POST", body: { index: 0 } });
  assert.equal(restored.status, 200, restored.text);
  assert.equal(restored.data.post.content, "Version one");
  assert.equal(restored.data.post.revisions.length, 2);
});

test("dry run reports without changing a scheduled post's status", async () => {
  const created = await api("/api/posts", {
    method: "POST",
    body: { content: "Scheduled copy", channels: ["x", "bluesky"], status: "scheduled", scheduledAt: "2031-05-01T10:00", ...media },
  });
  const id = created.data.post.id;
  const dry = await api(`/api/posts/${id}/publish`, { method: "POST", body: { dryRun: true } });
  assert.equal(dry.status, 200, dry.text);
  assert.equal(dry.data.post.status, "scheduled", "dry run must not pull the post out of the schedule");
  assert.equal(dry.data.result.dryRun, true);
  assert.ok(dry.data.result.results.every((result) => result.ready === false && /needs/i.test(result.reason)));
  assert.ok(dry.data.post.preview?.at);
});

test("video posts send the poster to X/LinkedIn and keep video elsewhere", async () => {
  const created = await api("/api/posts", {
    method: "POST",
    body: {
      content: "Video post",
      channels: ["x", "facebook"],
      mediaUrl: "/media/clip.mp4",
      mediaKind: "video",
      mediaName: "clip.mp4",
      posterUrl: "/media/landing/dashboard.png",
      posterName: "dashboard.png",
    },
  });
  assert.equal(created.status, 201, created.text);
  assert.equal(created.data.post.posterUrl, "/media/landing/dashboard.png");
  const dry = await api(`/api/posts/${created.data.post.id}/publish`, { method: "POST", body: { dryRun: true } });
  const byChannel = Object.fromEntries(dry.data.result.results.map((result) => [result.channel, result]));
  assert.equal(byChannel.x.media, "image");
  assert.match(byChannel.x.mediaNote, /cover/i);
  assert.equal(byChannel.facebook.media, "video");
  const full = await api(`/api/posts/${created.data.post.id}`);
  assert.match(full.data.preview.find((item) => item.channel === "x").notes.join(" "), /cover image is published/i);
  const toImage = await api(`/api/posts/${created.data.post.id}`, { method: "PUT", body: { ...media } });
  assert.equal(toImage.data.post.posterUrl, "", "switching to an image clears the video poster");
});

test("per-channel media and story media reach the right channels", async () => {
  const bad = await api("/api/posts", {
    method: "POST",
    body: { content: "Bad variant", channels: ["instagram"], channelMedia: { instagram: { mediaUrl: "ftp://nope/x.jpg" } }, ...media },
  });
  assert.equal(bad.status, 400);

  const created = await api("/api/posts", {
    method: "POST",
    body: {
      content: "Feed sizes",
      channels: ["instagram", "facebook", "x"],
      tags: ["launch-sizes"],
      ...media,
      channelMedia: {
        instagram: { url: "https://cdn.example/card-4x5.jpg", name: "card-4x5.jpg" },
        facebook: { mediaUrl: "https://cdn.example/card-4x5.jpg", mediaName: "card-4x5.jpg" },
        bluesky: { mediaUrl: "https://cdn.example/ignored.jpg" },
      },
      storyMedia: { mediaUrl: "https://cdn.example/card-9x16.jpg", mediaName: "card-9x16.jpg" },
    },
  });
  assert.equal(created.status, 201, created.text);
  const post = created.data.post;
  assert.deepEqual(Object.keys(post.channelMedia).sort(), ["facebook", "instagram"], "only targeted channels keep a variant");
  assert.equal(post.channelMedia.instagram.mediaPublicUrl, "https://cdn.example/card-4x5.jpg");
  assert.equal(post.channelMedia.instagram.mediaKind, "image");
  assert.equal(post.storyMedia.mediaName, "card-9x16.jpg");

  const dry = await api(`/api/posts/${post.id}/publish`, { method: "POST", body: { dryRun: true } });
  const byChannel = Object.fromEntries(dry.data.result.results.map((result) => [result.channel, result]));
  assert.equal(byChannel.instagram.mediaName, "card-4x5.jpg");
  assert.equal(byChannel.instagram.mediaVariant, "channel");
  assert.equal(byChannel.x.mediaName, "dashboard.png", "other channels keep the main media");
  assert.equal(byChannel.instagram.mediaNote, undefined, "a per-channel image is not mistaken for a video cover");

  const full = await api(`/api/posts/${post.id}`);
  const previews = Object.fromEntries(full.data.preview.map((item) => [item.channel, item]));
  assert.equal(previews.instagram.media.custom, true);
  assert.equal(previews.instagram.media.url, "https://cdn.example/card-4x5.jpg");
  assert.equal(previews.x.media.custom, false);

  const rule = await api("/api/automations", {
    method: "POST",
    body: {
      name: "Sizes story",
      trigger: { event: "published", minutes: 0 },
      filter: { tags: ["launch-sizes"] },
      actions: [
        { type: "story", channels: ["facebook"], media: "post" },
        { type: "post", channels: ["instagram", "x"], media: "post", text: "Out now: {{title}}" },
      ],
    },
  });
  const tested = await api(`/api/automations/${rule.data.automation.id}/test`, { method: "POST", body: { postId: post.id } });
  const outcomes = tested.data.outcomes;
  assert.equal(outcomes.find((o) => o.type === "story").mediaName, "card-9x16.jpg", "stories use the 9:16 story media");
  assert.equal(outcomes.find((o) => o.type === "post" && o.channel === "instagram").mediaName, "card-4x5.jpg");
  assert.equal(outcomes.find((o) => o.type === "post" && o.channel === "x").mediaName, "dashboard.png");
  await api(`/api/automations/${rule.data.automation.id}`, { method: "DELETE" });

  const cleared = await api(`/api/posts/${post.id}`, { method: "PUT", body: { storyMedia: null, channelMedia: { instagram: post.channelMedia.instagram } } });
  assert.equal(cleared.data.post.storyMedia, null);
  assert.deepEqual(Object.keys(cleared.data.post.channelMedia), ["instagram"]);
  const kept = await api(`/api/posts/${post.id}`, { method: "PUT", body: { content: "Feed sizes v2" } });
  assert.deepEqual(Object.keys(kept.data.post.channelMedia), ["instagram"], "edits that don't mention media keep the variants");
});

test("live publish is locked without MARKETING_LIVE", async () => {
  const created = await api("/api/posts", { method: "POST", body: { content: "Live?", channels: ["x"], ...media } });
  const live = await api(`/api/posts/${created.data.post.id}/publish`, { method: "POST", body: { dryRun: false } });
  assert.equal(live.status, 403);
});

test("preview counts links the way X and Mastodon do", async () => {
  const longUrl = `https://example.com/${"a".repeat(200)}`;
  const preview = await api("/api/preview", { method: "POST", body: { content: `Read this ${longUrl}`, channels: ["x", "mastodon", "linkedin"] } });
  assert.equal(preview.status, 200);
  const byChannel = Object.fromEntries(preview.data.channels.map((item) => [item.channel, item]));
  assert.equal(byChannel.x.length, "Read this ".length + 23);
  assert.equal(byChannel.mastodon.length, "Read this ".length + 23);
  assert.equal(byChannel.linkedin.length, "Read this ".length + longUrl.length);
  assert.equal(byChannel.x.over, false);
  const site = await api("/api/preview", { method: "POST", body: { content: "{{site}}", channels: ["x"] } });
  assert.match(site.data.channels[0].text, /utm_source=x/);
});

test("bulk actions validate first and apply to the selection", async () => {
  const ids = [];
  for (const scheduledAt of ["2032-03-01T08:00", "2032-03-02T08:00"]) {
    const created = await api("/api/posts", { method: "POST", body: { content: `Bulk ${scheduledAt}`, channels: ["x"], scheduledAt, ...media } });
    ids.push(created.data.post.id);
  }
  const bad = await api("/api/posts/bulk", { method: "POST", body: { ids, action: "shift", value: 1.5 } });
  assert.equal(bad.status, 400);

  const shifted = await api("/api/posts/bulk", { method: "POST", body: { ids, action: "shift", value: 2 } });
  assert.equal(shifted.data.updated, 2);
  const tagged = await api("/api/posts/bulk", { method: "POST", body: { ids, action: "addTag", value: "Q1 Push" } });
  assert.equal(tagged.data.updated, 2);
  const channel = await api("/api/posts/bulk", { method: "POST", body: { ids, action: "addChannel", value: "linkedin" } });
  assert.equal(channel.data.updated, 2);
  const status = await api("/api/posts/bulk", { method: "POST", body: { ids, action: "status", value: "scheduled" } });
  assert.equal(status.data.updated, 2);

  const list = await api("/api/posts?tag=q1-push");
  assert.equal(list.data.posts.length, 2);
  assert.deepEqual(list.data.posts.map((post) => post.scheduledAt), ["2032-03-03T08:00:00", "2032-03-04T08:00:00"]);
  assert.ok(list.data.posts.every((post) => post.channels.includes("linkedin") && post.status === "scheduled"));
  assert.ok(list.data.posts.every((post) => post.revisions === undefined), "list payload excludes revision history");

  const removeLast = await api("/api/posts/bulk", { method: "POST", body: { ids: [ids[0]], action: "removeChannel", value: "x" } });
  assert.equal(removeLast.data.updated, 1);
  const removeOnly = await api("/api/posts/bulk", { method: "POST", body: { ids: [ids[0]], action: "removeChannel", value: "linkedin" } });
  assert.equal(removeOnly.data.updated, 0);
  assert.equal(removeOnly.data.skipped.length, 1, "a post keeps at least one channel");

  const deleted = await api("/api/posts/bulk", { method: "POST", body: { ids, action: "delete" } });
  assert.equal(deleted.data.updated, 2);
  const after = await api("/api/posts?tag=q1-push");
  assert.equal(after.data.posts.length, 0);
});

test("templates CRUD", async () => {
  const listed = await api("/api/templates");
  assert.ok(listed.data.templates.length >= 2, "default templates are seeded");
  const created = await api("/api/templates", { method: "POST", body: { name: "Weekly tip", content: "Tip: {{site}}", channels: ["x", "nope"] } });
  assert.equal(created.status, 201);
  assert.deepEqual(created.data.template.channels, ["x"]);
  const id = created.data.template.id;
  const updated = await api(`/api/templates/${id}`, { method: "PUT", body: { name: "Weekly tip v2" } });
  assert.equal(updated.data.template.name, "Weekly tip v2");
  assert.equal(updated.data.template.content, "Tip: {{site}}");
  const missingName = await api("/api/templates", { method: "POST", body: { content: "x" } });
  assert.equal(missingName.status, 400);
  const removed = await api(`/api/templates/${id}`, { method: "DELETE" });
  assert.equal(removed.status, 200);
  const gone = await api(`/api/templates/${id}`, { method: "DELETE" });
  assert.equal(gone.status, 404);
});

test("settings are type-checked and the timezone validated", async () => {
  const badZone = await api("/api/settings", { method: "PUT", body: { timezone: "Mars/Olympus" } });
  assert.equal(badZone.status, 400);
  const badBool = await api("/api/settings", { method: "PUT", body: { dryRun: "false" } });
  assert.equal(badBool.status, 400);
  const ok = await api("/api/settings", { method: "PUT", body: { timezone: "Africa/Cairo", autoApprove: false } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.settings.autoApprove, false);
  const activity = await api("/api/activity?type=settings");
  assert.match(activity.data.items[0].message, /autoApprove off/);
});

test("media upload rejects unsupported types and protects files in use", async () => {
  const exe = await api("/api/media", { method: "POST", body: "MZ", headers: { "Content-Type": "image/png", "X-File-Name": "evil.exe" } });
  assert.equal(exe.status, 400);
  const upload = await fetch(`${base}/api/media`, {
    method: "POST",
    headers: { "Content-Type": "image/png", "X-File-Name": "card.png" },
    body: Buffer.from([137, 80, 78, 71]),
  });
  const uploaded = (await upload.json()).media;
  assert.equal(upload.status, 201);
  // Without a public media host the upload's publicUrl is a relative path; saving must still work.
  const withUpload = await api("/api/posts", {
    method: "POST",
    body: { content: "Uses upload", channels: ["x"], status: "scheduled", mediaUrl: uploaded.url, mediaPublicUrl: uploaded.publicUrl, mediaKind: "image", mediaName: uploaded.name },
  });
  assert.equal(withUpload.status, 201, withUpload.text);
  assert.equal(withUpload.data.post.mediaPublicUrl, "");
  const listed = await api("/api/media");
  const item = listed.data.media.find((entry) => entry.id === uploaded.id);
  assert.equal(item.usage.pending, 1);
  const blocked = await api(`/api/media/${encodeURIComponent(uploaded.id)}`, { method: "DELETE" });
  assert.equal(blocked.status, 409);
  const forced = await api(`/api/media/${encodeURIComponent(uploaded.id)}?force=1`, { method: "DELETE" });
  assert.equal(forced.status, 200);
});

test("deleted posts go to trash and can be restored as drafts", async () => {
  const created = await api("/api/posts", { method: "POST", body: { content: "Trash me", channels: ["x"], status: "scheduled", scheduledAt: "2033-01-01T09:00", ...media } });
  const id = created.data.post.id;
  assert.equal((await api(`/api/posts/${id}`, { method: "DELETE" })).status, 200);
  const trash = await api("/api/trash");
  assert.ok(trash.data.items.some((item) => item.post.id === id));
  const restored = await api(`/api/trash/${id}/restore`, { method: "POST" });
  assert.equal(restored.status, 200, restored.text);
  assert.equal(restored.data.post.status, "draft", "restored posts never auto-publish");
  await api("/api/posts/bulk", { method: "POST", body: { ids: [id], action: "delete" } });
  assert.equal((await api(`/api/trash/${id}`, { method: "DELETE" })).status, 200);
  assert.ok(!(await api("/api/trash")).data.items.some((item) => item.post.id === id));
});

test("per-channel copy and channel rules shape what each channel receives", async () => {
  const rules = await api("/api/settings", {
    method: "PUT",
    body: { channelRules: { instagram: { linkInBio: true, hashtags: "fatortak, accounting #MENA", dailyCap: 2 } } },
  });
  assert.equal(rules.status, 200, rules.text);
  assert.equal(rules.data.settings.channelRules.instagram.hashtags, "#fatortak #accounting #MENA");
  const badCap = await api("/api/settings", { method: "PUT", body: { channelRules: { x: { dailyCap: -1 } } } });
  assert.equal(badCap.status, 400);

  const created = await api("/api/posts", {
    method: "POST",
    body: { content: "Read more {{site}}", channels: ["instagram", "x", "linkedin"], overrides: { linkedin: "A longer LinkedIn version {{site}}", bluesky: "ignored: not a target" }, ...media },
  });
  assert.equal(created.status, 201, created.text);
  assert.deepEqual(Object.keys(created.data.post.overrides), ["linkedin"]);
  const full = await api(`/api/posts/${created.data.post.id}`);
  const byChannel = Object.fromEntries(full.data.preview.map((item) => [item.channel, item]));
  assert.ok(!/https?:/.test(byChannel.instagram.text), "Instagram links become 'Link in bio'");
  assert.match(byChannel.instagram.text, /Link in bio/);
  assert.match(byChannel.instagram.text, /#fatortak #accounting #MENA$/);
  assert.match(byChannel.x.text, /utm_source=x/);
  assert.match(byChannel.linkedin.text, /^A longer LinkedIn version https:/);
  assert.equal(byChannel.linkedin.custom, true);
  await api("/api/settings", { method: "PUT", body: { channelRules: { instagram: {} } } });
});

test("daily caps are reported in dry runs and #priority posts bypass them", async () => {
  // Pretend Facebook already received a post today by planting a published result.
  const first = await api("/api/posts", { method: "POST", body: { content: "Cap seed", channels: ["facebook"], ...media } });
  await api("/api/settings", { method: "PUT", body: { channelRules: { facebook: { dailyCap: 1 } } } });
  // No live publishes are possible in tests, so the dry-run note is the observable signal.
  const plain = await api("/api/posts", { method: "POST", body: { content: "Plain", channels: ["facebook"], ...media } });
  const priority = await api("/api/posts", { method: "POST", body: { content: "Video", channels: ["facebook"], tags: ["priority"], ...media } });
  const dryPlain = await api(`/api/posts/${plain.data.post.id}/publish`, { method: "POST", body: { dryRun: true } });
  const dryPriority = await api(`/api/posts/${priority.data.post.id}/publish`, { method: "POST", body: { dryRun: true } });
  assert.equal(dryPlain.status, 200);
  assert.equal(dryPriority.status, 200);
  assert.ok(!/cap/i.test(dryPriority.data.result.results[0].mediaNote || ""), "priority posts are never capped");
  await api("/api/settings", { method: "PUT", body: { channelRules: { facebook: {} } } });
  assert.ok(first.data.post.id);
});

test("content audit flags repeats, Instagram links and over-posting", async () => {
  for (let i = 0; i < 4; i += 1) {
    await api("/api/posts", {
      method: "POST",
      body: { content: "Audit repeat message {{site}}", channels: ["instagram", "facebook"], status: "scheduled", scheduledAt: `2034-02-01T${String(9 + i).padStart(2, "0")}:00`, ...media },
    });
  }
  const audit = await api("/api/content/audit");
  assert.equal(audit.status, 200);
  assert.ok(audit.data.byCode.repeat >= 3);
  assert.ok(audit.data.byCode["ig-link"] >= 4);
  const facebook = audit.data.volume.find((row) => row.channel === "facebook");
  assert.ok(facebook.maxPerDay >= 4 && facebook.over, "4 Facebook posts in a day exceeds the recommended 2");
  assert.ok(audit.data.suggestions.some((item) => item.code === "caps"));
  const list = await api("/api/posts?q=audit%20repeat");
  assert.ok(list.data.posts.every((post) => post.health && post.health.warn >= 1));
});

test("automations validate input and dry-run their actions", async () => {
  const badStory = await api("/api/automations", {
    method: "POST",
    body: { name: "Bad", trigger: { event: "published" }, actions: [{ type: "story", channels: ["x"] }] },
  });
  assert.equal(badStory.status, 400);
  assert.match(badStory.data.error, /Facebook and Instagram/);
  const tooSoon = await api("/api/automations", {
    method: "POST",
    body: { name: "Soon", trigger: { event: "before", minutes: 1 }, actions: [{ type: "story", channels: ["facebook"] }] },
  });
  assert.equal(tooSoon.status, 400);

  await api("/api/posts", { method: "POST", body: { content: "Big offer {{site}}", channels: ["facebook"], tags: ["offer"], status: "scheduled", scheduledAt: "2035-03-01T10:00", ...media } });
  const created = await api("/api/automations", {
    method: "POST",
    body: {
      name: "Offer teaser",
      trigger: { event: "before", minutes: 60 },
      filter: { tags: ["offer"] },
      actions: [
        { type: "story", channels: ["facebook", "instagram"], media: "post" },
        { type: "post", channels: ["x", "bluesky"], media: "none", text: "In one hour: {{title}} at {{time}} → {{site}}" },
      ],
    },
  });
  assert.equal(created.status, 201, created.text);
  const id = created.data.automation.id;
  const tested = await api(`/api/automations/${id}/test`, { method: "POST", body: {} });
  assert.equal(tested.status, 200, tested.text);
  assert.equal(tested.data.post.title, "Big offer {{site}}");
  const outcomes = tested.data.outcomes;
  assert.equal(outcomes.length, 4);
  assert.ok(outcomes.every((o) => o.dryRun || o.skipped));
  const xPost = outcomes.find((o) => o.channel === "x");
  assert.match(xPost.text, /^In one hour: Big offer .* at 10:00 → https:\/\/.*utm_source=x/);
  const igStory = outcomes.find((o) => o.channel === "instagram");
  assert.ok(igStory.skipped, "local media has no public URL, so the Instagram story is skipped with a reason");
  const run = await api(`/api/automations/${id}/run`, { method: "POST", body: {} });
  assert.equal(run.status, 403, "live runs are locked without MARKETING_LIVE");
  const paused = await api(`/api/automations/${id}`, { method: "PUT", body: { enabled: false } });
  assert.equal(paused.data.automation.enabled, false);
  assert.equal(paused.data.automation.actions.length, 2);
  const listed = await api("/api/automations");
  assert.deepEqual(listed.data.storyChannels, ["facebook", "instagram"]);
  assert.equal((await api(`/api/automations/${id}`, { method: "DELETE" })).status, 200);
});

test("connection guides validate credential formats and can disconnect", async () => {
  const connections = await api("/api/connections");
  const telegram = connections.data.channels.find((channel) => channel.key === "telegram");
  assert.ok(telegram.guide.steps.length >= 2);
  assert.ok(telegram.fields.some((field) => field.key === "TELEGRAM_CHAT_ID" && field.pattern));
  const bad = await api("/api/connections/telegram/credentials", { method: "PUT", body: { values: { TELEGRAM_CHAT_ID: "12345" } } });
  assert.equal(bad.status, 400);
  assert.match(bad.data.error, /Channel ID/);
  const good = await api("/api/connections/telegram/credentials", { method: "PUT", body: { values: { TELEGRAM_BOT_TOKEN: `123456:${"A".repeat(35)}`, TELEGRAM_CHAT_ID: "@fatortak_test" } } });
  assert.equal(good.status, 200, good.text);
  assert.equal(good.data.channel.configured, true);
  assert.equal(good.data.channel.fields.find((field) => field.key === "TELEGRAM_CHAT_ID").value, "@fatortak_test");
  assert.equal(good.data.channel.fields.find((field) => field.key === "TELEGRAM_BOT_TOKEN").value, "", "secrets are never returned");
  const removed = await api("/api/connections/telegram/credentials", { method: "DELETE" });
  assert.equal(removed.data.channel.configured, false);
});

test("reports expose delivery per channel and follower growth", async () => {
  const report = await api("/api/reports/summary");
  assert.equal(report.status, 200);
  assert.equal(typeof report.data.delivery, "object");
  assert.ok(Array.isArray(report.data.topPosts));
  assert.equal(typeof report.data.growth, "object");
});

test("comment rules validate, match Arabic and English keywords, and wait for live mode", async () => {
  const noChannel = await api("/api/comment-rules", { method: "POST", body: { name: "X only", channels: ["x"], keywords: ["price"], dm: "hi" } });
  assert.equal(noChannel.status, 400);
  const noMessage = await api("/api/comment-rules", { method: "POST", body: { name: "Empty", channels: ["instagram"], keywords: ["price"] } });
  assert.equal(noMessage.status, 400);
  const created = await api("/api/comment-rules", {
    method: "POST",
    body: {
      name: "Price DM",
      channels: ["instagram", "facebook"],
      keywords: "price, السعر, بكام",
      dm: "Hi {{first_name}}! Our plans: {{pricing}}",
      reply: "Sent you a DM 📩",
    },
  });
  assert.equal(created.status, 201, created.text);
  const id = created.data.rule.id;
  assert.deepEqual(created.data.rule.keywords, ["price", "السعر", "بكام"]);

  const en = await api(`/api/comment-rules/${id}/test`, { method: "POST", body: { text: "how much is the Price?", channel: "instagram", name: "Sara Ahmed" } });
  assert.equal(en.data.match, true);
  assert.match(en.data.dm, /^Hi Sara! Our plans: https:\/\/fatortak\.rabbeh\.com\/\?utm_source=instagram&utm_medium=dm&utm_campaign=comment-dm/);
  assert.equal(en.data.reply, "Sent you a DM 📩");
  const ar = await api(`/api/comment-rules/${id}/test`, { method: "POST", body: { text: "الســعر كام؟", channel: "facebook" } });
  assert.equal(ar.data.match, true, "Arabic tatweel/diacritics are ignored");
  const miss = await api(`/api/comment-rules/${id}/test`, { method: "POST", body: { text: "priceless content", channel: "instagram" } });
  assert.equal(miss.data.match, false, "keywords match whole words only");

  const sync = await api("/api/comments/sync", { method: "POST" });
  assert.equal(sync.status, 200, sync.text);
  assert.equal(sync.data.new, 3);
  assert.equal(sync.data.sent, 0, "nothing is sent while live publishing is locked");
  assert.equal(sync.data.pendingDryRun, 2);
  const again = await api("/api/comments/sync", { method: "POST" });
  assert.equal(again.data.new, 0, "sync is idempotent");

  const inbox = await api("/api/comments?status=new");
  assert.equal(inbox.data.total, 3);
  assert.equal(inbox.data.counts.new, 3);
  const sara = inbox.data.items.find((item) => item.platformId === "ig-c1");
  assert.equal(sara.matches[0].name, "Price DM");
  assert.equal(sara.dmAllowed, true);
  const bob = inbox.data.items.find((item) => item.platformId === "m-c1");
  assert.equal(bob.matches.length, 0);
  const arabic = await api(`/api/comments?q=${encodeURIComponent("السعر")}`);
  assert.equal(arabic.data.total, 1, "search uses the same Arabic normalisation");

  const read = await api(`/api/comments/${encodeURIComponent(bob.id)}`, { method: "PUT", body: { status: "archived" } });
  assert.equal(read.data.comment.status, "archived");
  const bulk = await api("/api/comments/bulk", { method: "POST", body: { ids: [sara.id], status: "read" } });
  assert.equal(bulk.data.updated, 1);
  const locked = await api(`/api/comments/${encodeURIComponent(sara.id)}/dm`, { method: "POST", body: { text: "hello" } });
  assert.equal(locked.status, 403, "manual DMs need MARKETING_LIVE");

  const paused = await api(`/api/comment-rules/${id}`, { method: "PUT", body: { enabled: false } });
  assert.equal(paused.data.rule.enabled, false);
  assert.equal((await api(`/api/comment-rules/${id}`, { method: "DELETE" })).status, 200);
});

test("saved replies CRUD", async () => {
  const created = await api("/api/saved-replies", { method: "POST", body: { text: "Thanks! Check {{site}}" } });
  assert.equal(created.status, 201);
  assert.ok((await api("/api/saved-replies")).data.items.some((item) => item.id === created.data.item.id));
  assert.equal((await api(`/api/saved-replies/${created.data.item.id}`, { method: "DELETE" })).status, 200);
});

test("CSV export neutralizes formulas", async () => {
  await api("/api/posts", { method: "POST", body: { title: "=HYPERLINK(\"x\")", content: "csv", channels: ["x"], ...media } });
  const csv = await api("/api/reports/export?format=csv&q=csv");
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get("content-disposition"), /attachment; filename=fatortak-posts-/);
  assert.ok(csv.text.includes(`"'=HYPERLINK`), "formula-like cells are prefixed");
  assert.ok(!csv.text.includes(`"=HYPERLINK`));
});

test("activity endpoint paginates and filters", async () => {
  const page = await api("/api/activity?limit=3");
  assert.equal(page.data.items.length, 3);
  assert.ok(page.data.total >= 3);
  assert.ok(page.data.types.includes("created"));
});

test("cross-origin writes are blocked", async () => {
  const response = await api("/api/posts", { method: "POST", body: { content: "x", channels: ["x"] }, headers: { Origin: "https://evil.example" } });
  assert.equal(response.status, 403);
});

let failed = 0;
try {
  await waitForServer();
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok   ${name}`);
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${name}\n     ${error.stack?.split("\n").slice(0, 3).join("\n     ")}`);
    }
  }
} finally {
  child.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
if (failed) {
  console.error(`\n${failed} of ${tests.length} portal tests failed.`);
  if (process.env.PORTAL_TEST_LOG) console.error(serverLog);
  process.exit(1);
}
console.log(`\nAll ${tests.length} portal tests passed.`);
