import fs from "node:fs";
import path from "node:path";
import { CONTENT_DIR, STATE_DIR, readJson, writeJson, ensureDir } from "./config.mjs";

export const QUEUE_FILE = path.join(CONTENT_DIR, "queue.json");
const STATE_FILE = path.join(STATE_DIR, "state.json");
const LOG_FILE = path.join(STATE_DIR, "post.log");

export function loadQueue(file = QUEUE_FILE) {
  const queue = readJson(file);
  if (!Array.isArray(queue.items)) throw new Error(`Queue at ${file} has no items array`);
  return queue;
}

export function loadState() {
  return readJson(STATE_FILE, { version: 1, posted: {}, runs: [] });
}

export function saveState(state) {
  ensureDir(STATE_DIR);
  state.runs = (state.runs || []).slice(-30);
  writeJson(STATE_FILE, state);
}

export function localNow(timeZone = "Africa/Cairo") {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
  };
}

function itemTimestamp(item) {
  return Date.parse(`${item.date}T${item.time || "00:00"}:00Z`);
}

export function isDue(item, now, { maxAgeHours = 36, includeStale = false, ignoreSchedule = false } = {}) {
  if (!ignoreSchedule) {
    const itemLocal = `${item.date}T${item.time || "00:00"}`;
    const nowLocal = `${now.date}T${now.time}`;
    if (itemLocal > nowLocal) return { due: false, reason: "future" };
  }

  const ageHours = (Date.now() - itemTimestamp(item)) / 3_600_000;
  if (!includeStale && ageHours > maxAgeHours) {
    return { due: false, reason: `stale (${Math.round(ageHours)}h old)` };
  }
  return { due: true, reason: "due" };
}

export function dueItems(queue, config, { date, id, includeStale = false } = {}) {
  const now = localNow(config.posting?.timezone || queue.timezone || "Africa/Cairo");
  const posted = loadState().posted || {};
  const maxAgeHours = config.posting?.maxAgeHours ?? 36;

  return queue.items
    .filter((item) => !posted[item.id])
    .filter((item) => (id ? item.id === id : true))
    .filter((item) => (date ? item.date === date : true))
    .map((item) => ({
      item,
      ...isDue(item, now, { maxAgeHours, includeStale, ignoreSchedule: Boolean(date || id) }),
    }))
    .filter((entry) => entry.due)
    .sort((a, b) => `${a.item.date}T${a.item.time}`.localeCompare(`${b.item.date}T${b.item.time}`));
}

export function recordPost(state, item, results) {
  state.posted = state.posted || {};
  state.posted[item.id] = {
    at: new Date().toISOString(),
    date: item.date,
    time: item.time,
    channels: item.channels,
    results,
  };
  state.runs = state.runs || [];
  state.runs.push({
    at: new Date().toISOString(),
    id: item.id,
    results,
  });
}

export function appendLog(line) {
  ensureDir(STATE_DIR);
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`, "utf8");
}

export function queueStats(queue, state = loadState()) {
  const posted = state.posted || {};
  const now = new Date().toISOString().slice(0, 10);
  const total = queue.items.length;
  const done = queue.items.filter((item) => posted[item.id]).length;
  const upcoming = queue.items.filter((item) => !posted[item.id] && item.date >= now).length;
  const overdue = queue.items.filter((item) => !posted[item.id] && item.date < now).length;
  return { total, posted: done, upcoming, overdue, remaining: total - done };
}
