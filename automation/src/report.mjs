import fs from "node:fs";
import path from "node:path";
import { REPORTS_DIR, STATE_DIR, ensureDir, env, githubRepo, githubToken, loadConfig, readJson, writeJson } from "./config.mjs";
import { loadQueue, loadState, queueStats } from "./queue.mjs";

const API = "https://api.github.com";
const today = () => new Date().toISOString().slice(0, 10);

async function gh(url, { token, accept = "application/vnd.github+json" } = {}) {
  const headers = {
    Accept: accept,
    "User-Agent": "fatortak-marketing",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    return { error: `HTTP ${response.status}`, status: response.status, data: null };
  }
  const data = await response.json();
  return { data, headers: response.headers, error: null };
}

function pageCount(linkHeader) {
  if (!linkHeader) return null;
  const match = linkHeader.match(/[?&]page=(\d+)>; rel="last"/);
  return match ? Number(match[1]) : null;
}

async function githubSnapshot({ repo, token }) {
  const [repoInfo, views, clones, contributors, releases] = await Promise.all([
    gh(`${API}/repos/${repo}`, { token }),
    gh(`${API}/repos/${repo}/traffic/views`, { token }),
    gh(`${API}/repos/${repo}/traffic/clones`, { token }),
    gh(`${API}/repos/${repo}/contributors?per_page=100&anon=1`, { token }),
    gh(`${API}/repos/${repo}/releases?per_page=1`, { token }),
  ]);

  if (repoInfo.error) {
    return { error: repoInfo.error, repo };
  }

  const contributorsPages = pageCount(contributors.headers?.get("link"));
  const contributorCount = contributorsPages
    ? contributorsPages * 100
    : Array.isArray(contributors.data)
      ? contributors.data.length
      : null;

  return {
    repo,
    name: repoInfo.data.full_name,
    description: repoInfo.data.description,
    stars: repoInfo.data.stargazers_count,
    forks: repoInfo.data.forks_count,
    watchers: repoInfo.data.subscribers_count,
    openIssues: repoInfo.data.open_issues_count,
    license: repoInfo.data.license?.spdx_id || "none",
    defaultBranch: repoInfo.data.default_branch,
    createdAt: repoInfo.data.created_at,
    pushedAt: repoInfo.data.pushed_at,
    homepage: repoInfo.data.homepage,
    topics: repoInfo.data.topics || [],
    contributors: contributorCount,
    views14: views.data?.count ?? null,
    viewsUnique14: views.data?.uniques ?? null,
    clones14: clones.data?.count ?? null,
    clonesUnique14: clones.data?.uniques ?? null,
    latestRelease: Array.isArray(releases.data) && releases.data[0] ? releases.data[0].tag_name : null,
    trafficError: views.error || clones.error || null,
  };
}

async function plausibleSnapshot(config) {
  const siteId = env("PLAUSIBLE_SITE_ID", config.analytics?.plausible?.siteId);
  const apiKey = env("PLAUSIBLE_API_KEY");
  if (!config.analytics?.plausible?.enabled || !siteId || !apiKey) return null;

  const url = new URL("https://plausible.io/api/v1/stats/aggregate");
  url.searchParams.set("site_id", siteId);
  url.searchParams.set("period", "7d");
  url.searchParams.append("metrics", "visitors");
  url.searchParams.append("metrics", "pageviews");
  url.searchParams.append("metrics", "bounce_rate");

  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!response.ok) return { error: `HTTP ${response.status}` };
    const data = await response.json();
    return {
      visitors: data.results?.visitors?.value ?? null,
      pageviews: data.results?.pageviews?.value ?? null,
      bounceRate: data.results?.bounce_rate?.value ?? null,
    };
  } catch (error) {
    return { error: error.message };
  }
}

function updateHistory(snapshot) {
  const file = path.join(STATE_DIR, "metrics-history.json");
  const history = readJson(file, []);
  const date = today();
  const entry = {
    date,
    stars: snapshot.stars,
    forks: snapshot.forks,
    contributors: snapshot.contributors,
    views14: snapshot.views14,
    clones14: snapshot.clones14,
  };
  const filtered = history.filter((h) => h.date !== date);
  filtered.push(entry);
  filtered.sort((a, b) => a.date.localeCompare(b.date));
  writeJson(file, filtered.slice(-180));
  return filtered;
}

function delta(history, key) {
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const past = history.filter((h) => h.date <= cutoff).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const current = history.at(-1);
  if (!past || !current || typeof current[key] !== "number" || typeof past[key] !== "number") return null;
  return current[key] - past[key];
}

function fmt(value, fallback = "—") {
  return value === null || value === undefined ? fallback : value.toLocaleString("en-US");
}

function signed(value) {
  if (value === null || value === undefined) return "—";
  return value > 0 ? `+${value.toLocaleString("en-US")}` : value.toLocaleString("en-US");
}

export async function buildReport(config = loadConfig()) {
  const repo = githubRepo(config);
  const token = githubToken();
  const github = await githubSnapshot({ repo, token });
  const website = await plausibleSnapshot(config);
  const history = github.error ? [] : updateHistory(github);
  const queue = loadQueue();
  const state = loadState();
  const stats = queueStats(queue, state);

  const commercialFile = path.join(REPORTS_DIR, "..", "metrics", "commercial.json");
  const commercial = readJson(commercialFile, null);

  const lines = [];
  lines.push(`# Growth report — ${today()}`);
  lines.push("");
  lines.push(`Repository: \`${repo}\` · generated ${new Date().toISOString()}`);
  lines.push("");

  if (github.error) {
    lines.push(`> GitHub API error: ${github.error}. Set \`GITHUB_TOKEN\` for reliable metrics.`);
    lines.push("");
  } else {
    lines.push("## Headline");
    lines.push("");
    lines.push("| Metric | Value | 7-day change |");
    lines.push("| --- | ---: | ---: |");
    lines.push(`| GitHub stars | ${fmt(github.stars)} | ${signed(delta(history, "stars"))} |`);
    lines.push(`| Forks | ${fmt(github.forks)} | ${signed(delta(history, "forks"))} |`);
    lines.push(`| Contributors | ${fmt(github.contributors)} | ${signed(delta(history, "contributors"))} |`);
    lines.push(`| Open issues | ${fmt(github.openIssues)} | — |`);
    lines.push(`| Unique visitors (14d) | ${fmt(github.viewsUnique14)} | — |`);
    lines.push(`| Unique clones (14d) | ${fmt(github.clonesUnique14)} | — |`);
    lines.push("");
    lines.push("## Repository");
    lines.push("");
    lines.push(`- Description: ${github.description || "**missing**"}`);
    lines.push(`- Homepage: ${github.homepage || "**missing**"}`);
    lines.push(`- License: ${github.license}`);
    lines.push(`- Topics: ${github.topics.length ? github.topics.join(", ") : "**none**"}`);
    lines.push(`- Latest release: ${github.latestRelease || "none"}`);
    lines.push(`- Last push: ${github.pushedAt || "—"}`);
    if (github.trafficError) lines.push(`- Traffic API: ${github.trafficError} (needs push access)`);
    lines.push("");
  }

  lines.push("## Website (7 days)");
  lines.push("");
  if (!website) {
    lines.push("Plausible is not configured. Add `PLAUSIBLE_API_KEY` and enable it in `marketing/config.json`.");
  } else if (website.error) {
    lines.push(`Plausible error: ${website.error}`);
  } else {
    lines.push(`- Visitors: ${fmt(website.visitors)}`);
    lines.push(`- Pageviews: ${fmt(website.pageviews)}`);
    lines.push(`- Bounce rate: ${website.bounceRate ?? "—"}%`);
  }
  lines.push("");

  lines.push("## Content pipeline");
  lines.push("");
  lines.push(`- Queue items: ${stats.total}`);
  lines.push(`- Posted: ${stats.posted}`);
  lines.push(`- Upcoming: ${stats.upcoming}`);
  lines.push(`- Overdue / missed: ${stats.overdue}`);
  lines.push(`- Cadence: ${queue.cadence || "—"}`);
  lines.push("");

  lines.push("## Commercial");
  lines.push("");
  if (!commercial) {
    lines.push("No `marketing/metrics/commercial.json` yet. Add demos booked, trials, paying customers and MRR to track the funnel. This is the one metric file that still needs a human or a payment-provider integration.");
  } else {
    lines.push("| Metric | Value |");
    lines.push("| --- | ---: |");
    lines.push(`| Demos booked | ${fmt(commercial.demosBooked)} |`);
    lines.push(`| Trials started | ${fmt(commercial.trialsStarted)} |`);
    lines.push(`| Paying customers | ${fmt(commercial.payingCustomers)} |`);
    lines.push(`| MRR (EGP) | ${fmt(commercial.mrrEgp)} |`);
    lines.push(`| Updated | ${commercial.updated || "—"} |`);
  }
  lines.push("");

  lines.push("## Next actions");
  lines.push("");
  const actions = [];
  if (!github.error && !github.description) actions.push("Set the repository description.");
  if (!github.error && !github.homepage) actions.push("Set the repository homepage to the landing page.");
  if (!github.error && !github.topics?.length) actions.push("Add GitHub topics for discoverability.");
  if (stats.overdue > 0) actions.push(`Review ${stats.overdue} missed content item(s) before they go stale.`);
  if (!website) actions.push("Connect Plausible (or Umami) so traffic is measured, not guessed.");
  if (!commercial) actions.push("Record commercial metrics weekly (demos, trials, customers, MRR).");
  if (!actions.length) actions.push("Keep shipping. Reply to every new issue and PR within one business day.");
  for (const action of actions) lines.push(`- ${action}`);
  lines.push("");
  lines.push("---");
  lines.push("_Generated by `marketing/automation`. Numbers are pulled from GitHub and Plausible; commercial metrics are supplied by the maintainer._");

  return { markdown: lines.join("\n"), github, website, stats, commercial };
}

export async function writeReport(config = loadConfig()) {
  const report = await buildReport(config);
  ensureDir(REPORTS_DIR);
  const file = path.join(REPORTS_DIR, `${today()}.md`);
  fs.writeFileSync(file, `${report.markdown}\n`, "utf8");
  fs.writeFileSync(path.join(REPORTS_DIR, "latest.md"), `${report.markdown}\n`, "utf8");
  return { file, ...report };
}

export async function createReportIssue(markdown, config = loadConfig()) {
  const token = githubToken();
  const repo = githubRepo(config);
  if (!token) return { ok: false, reason: "GITHUB_TOKEN not set" };

  const response = await fetch(`${API}/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "fatortak-marketing",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      title: `Growth report — ${today()}`,
      body: markdown,
      labels: ["growth"],
    }),
  });
  if (!response.ok) {
    return { ok: false, reason: `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}` };
  }
  const data = await response.json();
  return { ok: true, url: data.html_url, number: data.number };
}
