import { withUtm } from "./utm.mjs";

const PLACEHOLDERS = ["repo", "site", "docs", "demo", "pricing", "discussions"];

export function renderText(text, { channel, links, utm }) {
  let output = text;
  for (const key of PLACEHOLDERS) {
    const value = links[key];
    if (value === undefined) continue;
    const tagged = withUtm(value, {
      source: channel,
      medium: utm?.medium || "social",
      campaign: utm?.campaign || "oss-launch",
      content: utm?.content,
    });
    output = output.replaceAll(`{{${key}}}`, tagged);
  }
  return output.trim();
}

export function unresolvedPlaceholders(text) {
  return [...text.matchAll(/\{\{([a-z0-9_-]+)\}\}/gi)].map((m) => m[1]);
}

export function placeholders() {
  return PLACEHOLDERS;
}
