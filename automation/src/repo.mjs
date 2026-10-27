import { env, githubRepo, githubToken, loadConfig } from "./config.mjs";

const API = "https://api.github.com";

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "fatortak-marketing",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function call(url, { token, method, body }) {
  const response = await fetch(url, { method, headers: headers(token), body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* text */
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${String(typeof data === "string" ? data : JSON.stringify(data)).slice(0, 400)}`);
  return data;
}

export async function syncRepoSettings(config = loadConfig(), { dryRun = false } = {}) {
  const repo = githubRepo(config);
  const token = env("REPO_ADMIN_TOKEN") || env("GITHUB_TOKEN");
  const meta = config.repoMetadata || {};

  if (!meta.description && !meta.homepage && !meta.topics) {
    throw new Error("repoMetadata is empty in marketing/config.json");
  }

  const patch = {
    description: meta.description,
    homepage: meta.homepage,
    has_issues: true,
    has_discussions: true,
    has_wiki: false,
    has_projects: false,
    allow_squash_merge: true,
    allow_merge_commit: false,
    delete_branch_on_merge: true,
  };
  Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);

  if (dryRun || !token) {
    return {
      dryRun: true,
      reason: token ? "dry run requested" : "REPO_ADMIN_TOKEN / GITHUB_TOKEN not set",
      repo,
      patch,
      topics: meta.topics || [],
    };
  }

  const updated = await call(`${API}/repos/${repo}`, { token, method: "PATCH", body: patch });
  let topics = null;
  if (Array.isArray(meta.topics) && meta.topics.length) {
    topics = await call(`${API}/repos/${repo}/topics`, {
      token,
      method: "PUT",
      body: { names: meta.topics },
    });
  }

  return {
    dryRun: false,
    repo,
    description: updated.description,
    homepage: updated.homepage,
    topics: topics?.names || [],
    discussions: updated.has_discussions,
  };
}
