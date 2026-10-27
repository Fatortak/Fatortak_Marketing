import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const AUTOMATION_ROOT = path.resolve(here, "..");
export const MARKETING_ROOT = path.resolve(AUTOMATION_ROOT, "..");
export const REPO_ROOT = path.resolve(MARKETING_ROOT, "..");
export const STATE_DIR = path.join(AUTOMATION_ROOT, ".state");
export const CONTENT_DIR = path.join(MARKETING_ROOT, "content");
export const REPORTS_DIR = path.join(MARKETING_ROOT, "reports");

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" && fallback !== null) return fallback;
    throw new Error(`Cannot read JSON at ${file}: ${error.message}`);
  }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function loadConfig() {
  const configured = process.env.MARKETING_CONFIG
    ? path.resolve(process.env.MARKETING_CONFIG)
    : path.join(MARKETING_ROOT, "config.json");
  const fallback = path.join(MARKETING_ROOT, "config.example.json");
  const file = fs.existsSync(configured) ? configured : fallback;
  const config = readJson(file);

  const live = process.env.MARKETING_LIVE === "true";
  config.posting = {
    timezone: "Africa/Cairo",
    dryRun: true,
    maxPerRun: 4,
    maxAgeHours: 36,
    ...config.posting,
  };
  if (live) config.posting.dryRun = false;

  config._meta = { file, usedExample: file === fallback };
  return config;
}

export function env(name, fallback = undefined) {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

export function githubRepo(config) {
  return env("GITHUB_REPOSITORY", config.repo);
}

export function githubToken() {
  return env("GITHUB_TOKEN") || env("REPO_ADMIN_TOKEN");
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
