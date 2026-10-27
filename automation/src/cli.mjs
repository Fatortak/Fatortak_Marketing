#!/usr/bin/env node
import fs from "node:fs";
import { loadConfig, writeJson, REPORTS_DIR, ensureDir } from "./config.mjs";
import { QUEUE_FILE, dueItems, loadQueue, loadState, recordPost, saveState, queueStats, appendLog } from "./queue.mjs";
import { renderText, unresolvedPlaceholders, placeholders } from "./render.mjs";
import { postToChannel, LIMITS } from "./channels.mjs";
import { generateQueue } from "./generate-queue.mjs";
import { writeReport, createReportIssue } from "./report.mjs";
import { syncRepoSettings } from "./repo.mjs";

const BANNED = [
  "revolutionary",
  "guaranteed",
  "100% accurate",
  "get rich",
  "follow for follow",
  "dm me",
  "limited time only",
  "act now",
];

function parseFlags(args) {
  const flags = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const [key, inline] = arg.slice(2).split("=");
      if (inline !== undefined) {
        flags[key] = inline;
      } else if (args[i + 1] && !args[i + 1].startsWith("--")) {
        flags[key] = args[++i];
      } else {
        flags[key] = true;
      }
    } else {
      flags._.push(arg);
    }
  }
  return flags;
}

function truncate(text, length = 110) {
  return text.replace(/\s+/g, " ").slice(0, length) + (text.length > length ? "…" : "");
}

function isLive(config, flags) {
  if (flags["dry-run"]) return false;
  if (flags.live) return true;
  return config.posting?.dryRun === false;
}

function validateQueue(queue, config) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const texts = new Map();
  const knownChannels = new Set(Object.keys(LIMITS));
  const knownPlaceholders = new Set(placeholders());

  if (!queue.items?.length) errors.push("Queue has no items.");

  for (const [index, item] of queue.items.entries()) {
    const where = `item ${index + 1} (${item.id || "no id"})`;

    for (const field of ["id", "date", "time", "channels", "text"]) {
      if (!item[field]) errors.push(`${where}: missing ${field}`);
    }
    if (!item.id) continue;

    if (ids.has(item.id)) errors.push(`${where}: duplicate id`);
    ids.add(item.id);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date || "") || Number.isNaN(Date.parse(`${item.date}T00:00:00Z`))) {
      errors.push(`${where}: invalid date "${item.date}"`);
    }
    if (!/^\d{2}:\d{2}$/.test(item.time || "")) errors.push(`${where}: invalid time "${item.time}"`);

    if (!Array.isArray(item.channels) || item.channels.length === 0) {
      errors.push(`${where}: channels must be a non-empty array`);
    } else {
      for (const channel of item.channels) {
        if (!knownChannels.has(channel)) errors.push(`${where}: unknown channel "${channel}"`);
        const limit = LIMITS[channel];
        if (limit && item.text.length > limit) {
          errors.push(`${where}: ${item.text.length} chars exceeds ${channel} limit (${limit})`);
        }
      }
    }

    const unresolved = unresolvedPlaceholders(item.text || "");
    for (const key of unresolved) {
      if (!knownPlaceholders.has(key)) errors.push(`${where}: unknown placeholder {{${key}}}`);
    }

    const normalized = (item.text || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (texts.has(normalized)) errors.push(`${where}: duplicate text of ${texts.get(normalized)}`);
    texts.set(normalized, item.id);

    for (const phrase of BANNED) {
      if (normalized.includes(phrase)) errors.push(`${where}: banned phrase "${phrase}"`);
    }
  }

  const sorted = [...queue.items].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  if (queue.items.some((item, index) => item.id !== sorted[index].id)) {
    warnings.push("Queue is not sorted by date/time. Posting still works.");
  }

  const lastDate = sorted.at(-1)?.date;
  if (lastDate) {
    const daysLeft = Math.round((Date.parse(`${lastDate}T00:00:00Z`) - Date.now()) / 86_400_000);
    if (daysLeft < 30) warnings.push(`Queue ends in ${daysLeft} days. Run \`npm run generate\` to extend it.`);
  }

  if (config.posting?.dryRun) warnings.push("Dry-run is enabled. Set MARKETING_LIVE=true or run with --live to publish.");

  return { errors, warnings };
}

async function commandPost(flags) {
  const config = loadConfig();
  const queue = loadQueue();
  const live = isLive(config, flags);
  const due = dueItems(queue, config, {
    date: flags.date,
    id: flags.id,
    includeStale: Boolean(flags["include-stale"]),
  });
  const max = Number(flags.limit || config.posting?.maxPerRun || 4);
  const selected = due.slice(0, max);

  if (!selected.length) {
    console.log("No due items. Nothing to post.");
    return 0;
  }

  const state = loadState();
  let posted = 0;
  let skipped = 0;
  let failed = 0;

  for (const { item } of selected) {
    console.log(`\n${live ? "POST" : "DRY RUN"} ${item.date} ${item.time} · ${item.pillar} · ${item.channels.join(", ")}`);
    const results = [];

    for (const channel of item.channels) {
      const text = renderText(item.text, {
        channel,
        links: config.links,
        utm: { ...(config.utm || {}), ...(item.utm || {}), medium: config.utm?.medium || "social" },
      });

      if (text.length > (LIMITS[channel] || 10_000)) {
        const result = { channel, ok: false, skipped: true, reason: `rendered text too long (${text.length})` };
        results.push(result);
        skipped += 1;
        console.log(`  ⏭ ${channel} — ${result.reason}`);
        continue;
      }

      if (!live) {
        results.push({ channel, ok: false, skipped: true, reason: "dry-run" });
        console.log(`  ── ${channel} (${text.length} chars) ──`);
        console.log(
          text
            .split("\n")
            .map((line) => `  │ ${line}`)
            .join("\n"),
        );
        continue;
      }

      const result = { channel, ...(await postToChannel(channel, text, config)) };
      results.push(result);
      if (result.ok) {
        posted += 1;
        console.log(`  ✅ ${channel}${result.url ? ` — ${result.url}` : ""}`);
      } else if (result.skipped) {
        skipped += 1;
        console.log(`  ⏭ ${channel} — ${result.reason}`);
      } else {
        failed += 1;
        console.log(`  ❌ ${channel} — ${result.error}`);
      }
    }

    if (live && results.some((r) => r.ok)) {
      recordPost(state, item, results);
      saveState(state);
      appendLog(`${item.id} posted=${results.filter((r) => r.ok).map((r) => r.channel).join(",")}`);
    }
  }

  console.log(`\nSummary: ${posted} posted, ${skipped} skipped, ${failed} failed${live ? "" : " (dry run)"}`);
  if (live && failed > 0 && posted === 0) return 1;
  return 0;
}

function commandValidate() {
  const config = loadConfig();
  const queue = loadQueue();
  const { errors, warnings } = validateQueue(queue, config);
  const stats = queueStats(queue);

  console.log(`Queue: ${stats.total} items · ${stats.posted} posted · ${stats.upcoming} upcoming · ${stats.overdue} overdue`);
  console.log(`Range: ${queue.startDate} → ${queue.endDate} (${queue.cadence || "custom cadence"})`);

  for (const warning of warnings) console.log(`⚠️  ${warning}`);
  for (const error of errors) console.log(`❌ ${error}`);

  if (errors.length) {
    console.log(`\n${errors.length} error(s). Fix them before posting.`);
    return 1;
  }
  console.log(`\n✅ Queue is valid.${warnings.length ? ` ${warnings.length} warning(s).` : ""}`);
  return 0;
}

function commandGenerate(flags) {
  const startDate = flags.start || "2026-11-02";
  const days = Number(flags.days || 90);
  const out = flags.out ? flags.out : QUEUE_FILE;
  if (fs.existsSync(out) && !flags.force) {
    console.error(`${out} already exists. Use --force to overwrite.`);
    return 1;
  }
  const queue = generateQueue({ startDate, days });
  writeJson(out, queue);
  console.log(`Generated ${queue.items.length} items from ${queue.startDate} to ${queue.endDate}.`);
  console.log(`Written to ${out}`);
  return 0;
}

async function commandReport(flags) {
  const config = loadConfig();
  const { file, markdown } = await writeReport(config);
  console.log(`Report written to ${file}\n`);
  console.log(markdown);
  if (flags.issue) {
    const result = await createReportIssue(markdown, config);
    if (result.ok) console.log(`\nIssue created: ${result.url}`);
    else console.log(`\nCould not create issue: ${result.reason}`);
  }
  return 0;
}

async function commandRepo(flags) {
  const config = loadConfig();
  const result = await syncRepoSettings(config, { dryRun: Boolean(flags["dry-run"]) });
  console.log(JSON.stringify(result, null, 2));
  return 0;
}

function commandSchedule(flags) {
  const days = Number(flags.days || 7);
  const queue = loadQueue();
  const state = loadState();
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = queue.items
    .filter((item) => !state.posted?.[item.id] && item.date >= today)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
    .slice(0, days);

  if (!upcoming.length) {
    console.log("Nothing scheduled. Generate a queue or extend the current one.");
    return 0;
  }
  for (const item of upcoming) {
    console.log(`${item.date} ${item.time}  ${item.channels.join(",").padEnd(28)} ${truncate(item.text, 80)}`);
  }
  return 0;
}

function commandStats() {
  const queue = loadQueue();
  const state = loadState();
  const stats = queueStats(queue, state);
  const next = queue.items
    .filter((item) => !state.posted?.[item.id] && item.date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0];

  console.log(`Total: ${stats.total}`);
  console.log(`Posted: ${stats.posted}`);
  console.log(`Upcoming: ${stats.upcoming}`);
  console.log(`Overdue: ${stats.overdue}`);
  console.log(`Next: ${next ? `${next.date} ${next.time} (${next.channels.join(", ")})` : "none"}`);
  return 0;
}

function help() {
  console.log(`Fatortak marketing automation

Usage: node src/cli.mjs <command> [options]

Commands:
  post [--dry-run] [--live] [--date YYYY-MM-DD] [--id ID] [--limit N] [--include-stale]
  validate
  generate [--start YYYY-MM-DD] [--days 90] [--out FILE] [--force]
  schedule [--days 7]
  stats
  report [--issue]
  repo [--dry-run]

Environment:
  MARKETING_LIVE=true          Publish instead of dry-run
  MARKETING_CONFIG=path        Use a custom config file
  GITHUB_TOKEN / REPO_ADMIN_TOKEN
  X_ACCESS_TOKEN
  LINKEDIN_ACCESS_TOKEN + LINKEDIN_AUTHOR_URN
  BLUESKY_HANDLE + BLUESKY_APP_PASSWORD
  MASTODON_ACCESS_TOKEN (+ MASTODON_INSTANCE)
  TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
  DISCORD_WEBHOOK_URL
  PLAUSIBLE_API_KEY + PLAUSIBLE_SITE_ID
`);
}

async function main() {
  const [command = "help", ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  ensureDir(REPORTS_DIR);

  try {
    switch (command) {
      case "post":
        return await commandPost(flags);
      case "validate":
        return commandValidate(flags);
      case "generate":
        return commandGenerate(flags);
      case "report":
        return await commandReport(flags);
      case "repo":
        return await commandRepo(flags);
      case "schedule":
        return commandSchedule(flags);
      case "stats":
        return commandStats(flags);
      case "help":
      case "--help":
      case "-h":
        help();
        return 0;
      default:
        console.error(`Unknown command: ${command}\n`);
        help();
        return 1;
    }
  } catch (error) {
    console.error(`❌ ${error.message}`);
    if (process.env.DEBUG) console.error(error.stack);
    return 1;
  }
}

process.exitCode = await main();
