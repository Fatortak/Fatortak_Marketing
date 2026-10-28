const TRACKED = new Set(["fatortak.github.io", "fatortak.net", "www.fatortak.net"]);

export function withUtm(url, { source, medium = "social", campaign = "oss-launch", content } = {}) {
  if (!url || !/^https?:\/\//i.test(url)) return url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!TRACKED.has(parsed.hostname)) return url;

  parsed.searchParams.set("utm_source", source || "direct");
  parsed.searchParams.set("utm_medium", medium);
  parsed.searchParams.set("utm_campaign", campaign);
  if (content) parsed.searchParams.set("utm_content", content);
  return parsed.toString();
}

export function isTracked(url) {
  try {
    return TRACKED.has(new URL(url).hostname);
  } catch {
    return false;
  }
}
