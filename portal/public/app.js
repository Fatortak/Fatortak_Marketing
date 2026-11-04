(() => {
  "use strict";

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */

  const state = {
    view: "overview",
    overview: null,
    posts: [],
    connections: [],
    meta: null,
    templates: [],
    mediaLibrary: [],
    mediaFiles: [],
    reports: null,
    activity: null,
    clockOffset: 0,
    loadedAt: 0,
    token: storageGet("portal_token") || "",
    content: {
      status: "",
      channel: "",
      lang: "",
      pillar: "",
      tag: "",
      when: "",
      q: "",
      sort: "schedule-asc",
      page: 1,
      pageSize: Number(storageGet("portal_page_size")) || 25,
      selected: new Set(),
    },
    calendar: { month: "", lang: "", channel: "" },
    mediaView: { filter: "all", q: "" },
    activityView: { type: "", q: "", offset: 0, limit: 50 },
    connectionsFilter: "all",
    automations: null,
    autoTab: "posts",
    commentRules: null,
    inbox: null,
    inboxView: { status: "open", channel: "", q: "", offset: 0, limit: 30 },
    inboxSelected: new Set(),
    savedReplies: null,
    audit: null,
    trash: null,
    editor: { post: null, snapshot: "", preview: [], side: "preview", previewSeq: 0, saving: false, overrides: {}, issues: [], automations: [] },
  };

  const VIEWS = ["overview", "inbox", "content", "calendar", "media", "templates", "automations", "health", "trash", "connections", "analytics", "reports", "activity", "settings"];
  const LEGACY_VIEWS = { queue: "content", composer: "templates" };

  const PAGE_META = {
    overview: ["Overview", "What is going out, what needs you, and how channels are doing."],
    content: ["Content", "Every post: review, schedule, publish and clean up in bulk."],
    calendar: ["Calendar", "Drag posts between days to reschedule them."],
    media: ["Media", "Uploaded files and the brand screenshot library."],
    templates: ["Templates", "Reusable copy to start new posts fast."],
    inbox: ["Inbox", "Comments from every channel, with replies and DMs."],
    automations: ["Automations", "Stories, teasers, follow-ups and comment → DM rules."],
    health: ["Content health", "What will hurt reach, and one-click fixes."],
    trash: ["Trash", "Deleted posts are kept for 30 days."],
    connections: ["Connections", "Connect channels and set how each one publishes."],
    analytics: ["Analytics", "Traffic, followers, engagement and channel health."],
    reports: ["Reports", "What worked, what to change and what to do next."],
    activity: ["Activity", "Audit trail of every change and publish."],
    settings: ["Settings", "Publishing safety and portal behavior."],
  };

  const STATUS_LABEL = {
    draft: "Draft",
    needs_review: "Needs review",
    approved: "Approved",
    scheduled: "Scheduled",
    published: "Published",
    failed: "Failed",
    blocked: "Blocked",
    dry_run: "Dry run",
    publishing: "Publishing",
  };

  const STATUS_HINT = {
    draft: "Work in progress. Drafts never publish.",
    needs_review: "Waiting for approval. Won't publish until it is scheduled.",
    approved: "Approved but on hold. Switch to Scheduled to publish automatically.",
    scheduled: "Publishes automatically at this time while live mode is on.",
    published: "Already sent. Use Results to retry individual channels.",
    failed: "The last attempt failed. Fix it, then retry from Results or reschedule.",
    blocked: "Stopped by a safety check (media, landing page or channel setup).",
    dry_run: "Legacy dry-run state. Set to Scheduled to publish again.",
  };

  const PILLAR_LABEL = {
    product: "Product",
    insight: "Insight",
    "open-source": "Open source",
    "use-case": "Use case",
    arabic: "Arabic",
    "ai-ocr": "AI + OCR",
    commercial: "Commercial",
    tip: "Tip",
  };

  const STATUS_TABS = ["", "scheduled", "needs_review", "draft", "approved", "published", "failed", "blocked", "dry_run"];

  const TIMEZONES = [
    "Africa/Cairo", "Asia/Riyadh", "Asia/Dubai", "Asia/Kuwait", "Asia/Qatar", "Asia/Amman", "Asia/Beirut",
    "Africa/Casablanca", "Africa/Tunis", "Africa/Algiers", "Europe/London", "Europe/Berlin", "Europe/Istanbul",
    "America/New_York", "America/Los_Angeles", "UTC",
  ];

  const API_BASE = location.pathname.startsWith("/portal") ? "/portal/index.php" : "";
  const UNDER_PROXY = Boolean(API_BASE);

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  /* ------------------------------------------------------------------ *
   * Utilities
   * ------------------------------------------------------------------ */

  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      if (value === null || value === undefined || value === "") localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    } catch {
      // Storage can be unavailable (private mode); the portal works without it.
    }
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function plural(count, word, many = `${word}s`) {
    return `${fmtNumber(count)} ${Number(count) === 1 ? word : many}`;
  }

  function fmtNumber(value) {
    const n = Number(value || 0);
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
  }

  function fmtBytes(bytes) {
    const n = Number(bytes || 0);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  function metricValue(value, lastUpdated) {
    if (!lastUpdated || value === null || value === undefined || value === "") return "—";
    const number = Number(value);
    return Number.isFinite(number) ? fmtNumber(number) : "—";
  }

  function debounce(fn, wait) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  function tz() {
    return state.overview?.settings?.timezone || state.meta?.timezone || "Africa/Cairo";
  }

  function tzShort() {
    const zone = tz();
    return zone === "Africa/Cairo" ? "Cairo" : zone.split("/").pop().replace(/_/g, " ");
  }

  /* Scheduled times are naive wall-clock strings in the portal timezone.
     Treat them as UTC for arithmetic and formatting so the browser's own
     timezone never shifts them. */

  function naiveMs(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(value || ""));
    if (!match) return NaN;
    const [, y, mo, d, h, mi, s] = match;
    return Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0));
  }

  function msToNaive(ms) {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  }

  function wallNowMs() {
    return Date.now() + state.clockOffset;
  }

  function wallNow() {
    return msToNaive(wallNowMs());
  }

  function todayKey() {
    return wallNow().slice(0, 10);
  }

  function fmtWall(value, { time = true, weekday = false, year = true } = {}) {
    const ms = naiveMs(value);
    if (!Number.isFinite(ms)) return "—";
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      ...(weekday ? { weekday: "short" } : {}),
      day: "2-digit",
      month: "short",
      ...(year ? { year: "numeric" } : {}),
      ...(time ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {}),
    }).format(new Date(ms));
  }

  function fmtTime(value) {
    const text = String(value || "");
    return /T(\d{2}:\d{2})/.exec(text)?.[1] || "";
  }

  function fmtInstant(value, { time = true } = {}) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: tz(),
        day: "2-digit",
        month: "short",
        year: "numeric",
        ...(time ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {}),
      }).format(date);
    } catch {
      return date.toLocaleString();
    }
  }

  function relativeFrom(diffMs) {
    const abs = Math.abs(diffMs);
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;
    let text;
    if (abs < minute) text = "now";
    else if (abs < hour) text = `${Math.round(abs / minute)}m`;
    else if (abs < day) text = `${Math.round(abs / hour)}h`;
    else if (abs < 45 * day) text = `${Math.round(abs / day)}d`;
    else text = `${Math.round(abs / (30 * day))}mo`;
    if (text === "now") return "now";
    return diffMs > 0 ? `in ${text}` : `${text} ago`;
  }

  function relativeWall(value) {
    const ms = naiveMs(value);
    if (!Number.isFinite(ms)) return "";
    return relativeFrom(ms - wallNowMs());
  }

  function relativeInstant(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return relativeFrom(date.getTime() - Date.now());
  }

  function isOverdue(post) {
    return post.status === "scheduled" && String(post.scheduledAt) < wallNow();
  }

  function nextHourNaive() {
    const ms = wallNowMs();
    const next = Math.floor(ms / 3_600_000) * 3_600_000 + 3_600_000;
    return msToNaive(next);
  }

  function nextFreeSlot(excludeId) {
    const taken = new Set(
      state.posts
        .filter((post) => post.id !== excludeId && ["scheduled", "approved", "needs_review"].includes(post.status))
        .map((post) => String(post.scheduledAt).slice(0, 13))
    );
    let ms = naiveMs(nextHourNaive());
    for (let i = 0; i < 24 * 30; i += 1) {
      const candidate = msToNaive(ms);
      const hour = new Date(ms).getUTCHours();
      if (hour >= 8 && hour <= 21 && !taken.has(candidate.slice(0, 13))) return candidate;
      ms += 3_600_000;
    }
    return nextHourNaive();
  }

  function statusLabel(status) {
    return STATUS_LABEL[status] || String(status || "draft").replace(/_/g, " ");
  }

  function statusChip(status) {
    return `<span class="status ${esc(status)}">${esc(statusLabel(status))}</span>`;
  }

  function pillarLabel(pillar) {
    return PILLAR_LABEL[pillar] || pillar || "—";
  }

  function channelDef(key) {
    return state.connections.find((item) => item.key === key) || null;
  }

  function channelLabel(key) {
    return channelDef(key)?.label || key;
  }

  function channelIcon(key, { size = "", title = "" } = {}) {
    const label = channelLabel(key);
    const initials = esc(label.slice(0, 2).toUpperCase());
    return `<span class="channel-icon ${size}" title="${esc(title || label)}"><img src="icons/${esc(key)}.svg" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('${initials}'))" /></span>`;
  }

  function channelIcons(channels, max = 6) {
    const list = channels || [];
    const shown = list.slice(0, max).map((key) => channelIcon(key, { size: "xs" })).join("");
    const extra = list.length > max ? `<span class="channel-more" title="${esc(list.slice(max).map(channelLabel).join(", "))}">+${list.length - max}</span>` : "";
    return `<div class="channel-stack" aria-label="${esc(list.map(channelLabel).join(", "))}">${shown}${extra}</div>`;
  }

  function verifiedFresh(channel) {
    const check = channel?.verified;
    if (!check?.ok || !check.at) return false;
    return Date.now() - new Date(check.at).getTime() < 24 * 60 * 60 * 1000;
  }

  function channelStatusChip(channel) {
    if (channel.configured && verifiedFresh(channel)) return `<span class="chip lime">verified</span>`;
    if (channel.configured && channel.verified?.ok) return `<span class="chip amber">test stale</span>`;
    if (channel.configured && channel.verified && !channel.verified.ok) return `<span class="chip rose">test failed</span>`;
    if (channel.configured) return `<span class="chip cyan">configured</span>`;
    if (channel.mode === "monitoring") return `<span class="chip cyan">monitoring</span>`;
    if (channel.mode === "restricted") return `<span class="chip muted">restricted</span>`;
    return `<span class="chip amber">needs setup</span>`;
  }

  function mediaSupportLabel(value) {
    const labels = {
      "image/video": "Image + video",
      "public-url": "Public image/video URL",
      image: "Image upload",
      video: "Video only",
      none: "No media",
    };
    return labels[value] || value || "No media";
  }

  function resultCounts(results) {
    const list = (results || []).filter((result) => result.channel);
    return {
      published: list.filter((result) => result.ok && !result.dryRun).length,
      failed: list.filter((result) => !result.ok && !result.skipped).length,
      skipped: list.filter((result) => result.skipped).length,
      total: list.length,
    };
  }

  function icon(name) {
    return `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  }

  function emptyState(title, text, action = "") {
    return `<div class="empty"><div class="empty-mark">${icon("info")}</div><strong>${esc(title)}</strong><span>${esc(text)}</span>${action}</div>`;
  }

  function withToken(url) {
    if (!state.token || UNDER_PROXY) return url;
    return `${url}${url.includes("?") ? "&" : "?"}token=${encodeURIComponent(state.token)}`;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard.", "success");
    } catch {
      toast("Copy failed. Select the text and copy it manually.", "error");
    }
  }

  /* ------------------------------------------------------------------ *
   * Toasts, dialogs, menus
   * ------------------------------------------------------------------ */

  function toast(message, type = "", { action, timeout = 4600 } = {}) {
    const node = document.createElement("div");
    node.className = `toast ${type}`;
    node.setAttribute("role", type === "error" ? "alert" : "status");
    const text = document.createElement("span");
    text.textContent = message;
    node.appendChild(text);
    if (action) {
      const button = document.createElement("button");
      button.className = "toast-action";
      button.textContent = action.label;
      button.addEventListener("click", () => {
        node.remove();
        action.onClick();
      });
      node.appendChild(button);
    }
    const close = document.createElement("button");
    close.className = "toast-close";
    close.setAttribute("aria-label", "Dismiss");
    close.innerHTML = icon("close");
    close.addEventListener("click", () => node.remove());
    node.appendChild(close);
    $("#toasts").appendChild(node);
    setTimeout(() => node.remove(), type === "error" ? timeout + 3000 : timeout);
  }

  let modalState = null;

  function openModal({ title, body, actions = [], wide = false, onClose = null, onOpen = null }) {
    if (modalState) finishModal(null, true);
    const previousFocus = document.activeElement;
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = body;
    $(".modal-card").classList.toggle("is-wide", Boolean(wide));
    const actionsBox = $("#modal-actions");
    actionsBox.innerHTML = "";
    modalState = { onClose, previousFocus };
    for (const action of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `btn ${action.className || "btn-ghost"}`;
      button.textContent = action.label;
      if (action.id) button.id = action.id;
      button.addEventListener("click", async () => {
        // `stay` actions run inside the dialog (validation, save & test) and keep it open by returning true.
        // Every other action closes this dialog first, so it can safely open another one.
        if (!action.stay) {
          finishModal(action.value ?? null);
          action.onClick?.(button);
          return;
        }
        const mine = modalState;
        const keepOpen = await action.onClick?.(button);
        if (keepOpen === true || modalState !== mine) return;
        finishModal(action.value ?? null);
      });
      actionsBox.appendChild(button);
    }
    $("#modal").hidden = false;
    onOpen?.();
    const focusTarget = $("#modal-body [autofocus]") || $("#modal-body input, #modal-body textarea, #modal-body select") || actionsBox.querySelector(".btn-primary, .btn-danger") || $("#modal-close");
    setTimeout(() => focusTarget?.focus(), 30);
  }

  function finishModal(value, silent = false) {
    if (!modalState) return;
    const { onClose, previousFocus } = modalState;
    modalState = null;
    $("#modal").hidden = true;
    $("#modal-body").innerHTML = "";
    if (!silent) onClose?.(value);
    else onClose?.(null);
    if (previousFocus && document.contains(previousFocus)) previousFocus.focus?.();
  }

  function confirmDialog({ title, message, confirmLabel = "Confirm", danger = false, detail = "" }) {
    return new Promise((resolve) => {
      openModal({
        title,
        body: `<p>${message}</p>${detail ? `<div class="modal-detail">${detail}</div>` : ""}`,
        actions: [
          { label: "Cancel", className: "btn-ghost", value: false },
          { label: confirmLabel, className: danger ? "btn-danger" : "btn-primary", value: true },
        ],
        onClose: (value) => resolve(value === true),
      });
    });
  }

  function promptDialog({ title, label, value = "", placeholder = "", type = "text", hint = "", confirmLabel = "Save", validate }) {
    return new Promise((resolve) => {
      let result = null;
      openModal({
        title,
        body: `<form id="prompt-form" class="prompt-form"><label class="field"><span>${esc(label)}</span><input id="prompt-input" type="${esc(type)}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" autofocus /></label>${hint ? `<p class="field-hint">${esc(hint)}</p>` : ""}<p class="field-error" id="prompt-error" hidden></p></form>`,
        actions: [
          { label: "Cancel", className: "btn-ghost" },
          {
            label: confirmLabel,
            className: "btn-primary",
            stay: true,
            onClick: () => {
              const input = $("#prompt-input");
              const raw = input.value.trim();
              const error = validate ? validate(raw) : raw ? "" : "This field is required.";
              if (error) {
                $("#prompt-error").textContent = error;
                $("#prompt-error").hidden = false;
                input.focus();
                return true;
              }
              result = raw;
              return false;
            },
          },
        ],
        onClose: () => resolve(result),
        onOpen: () => {
          $("#prompt-form").addEventListener("submit", (event) => {
            event.preventDefault();
            $("#modal-actions .btn-primary").click();
          });
        },
      });
    });
  }

  function closeMenu() {
    const menu = $("#menu");
    if (menu.hidden) return;
    menu.hidden = true;
    menu.innerHTML = "";
    menu._anchor?.setAttribute("aria-expanded", "false");
    menu._anchor = null;
  }

  function openMenu(anchor, items) {
    const menu = $("#menu");
    if (!menu.hidden && menu._anchor === anchor) {
      closeMenu();
      return;
    }
    closeMenu();
    menu.innerHTML = "";
    for (const item of items) {
      if (!item) continue;
      if (item.divider) {
        menu.insertAdjacentHTML("beforeend", `<div class="menu-divider" role="separator"></div>`);
        continue;
      }
      if (item.heading) {
        menu.insertAdjacentHTML("beforeend", `<div class="menu-heading">${esc(item.heading)}</div>`);
        continue;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "menuitem");
      button.className = `menu-item ${item.danger ? "danger" : ""}`;
      button.disabled = Boolean(item.disabled);
      button.innerHTML = `${item.icon ? icon(item.icon) : ""}<span>${esc(item.label)}</span>${item.hint ? `<em>${esc(item.hint)}</em>` : ""}`;
      button.addEventListener("click", () => {
        closeMenu();
        item.onClick?.();
      });
      menu.appendChild(button);
    }
    menu.hidden = false;
    menu._anchor = anchor;
    anchor.setAttribute("aria-expanded", "true");
    const rect = anchor.getBoundingClientRect();
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    let left = rect.right - width;
    if (left < 8) left = Math.min(rect.left, window.innerWidth - width - 8);
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 6);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${top}px`;
    menu.querySelector(".menu-item:not(:disabled)")?.focus();
  }

  async function withBusy(button, fn) {
    if (!button) return fn();
    if (button.dataset.busy === "1") return undefined;
    button.dataset.busy = "1";
    button.disabled = true;
    button.classList.add("is-busy");
    button.setAttribute("aria-busy", "true");
    try {
      return await fn();
    } finally {
      delete button.dataset.busy;
      button.disabled = false;
      button.classList.remove("is-busy");
      button.removeAttribute("aria-busy");
    }
  }

  /* ------------------------------------------------------------------ *
   * API
   * ------------------------------------------------------------------ */

  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.status = status;
      this.data = data;
    }
  }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    if (options.body && typeof options.body === "string") headers["Content-Type"] = "application/json";
    const requestedMethod = (options.method || "GET").toUpperCase();
    const fetchOptions = { ...options };
    if (UNDER_PROXY && (requestedMethod === "PUT" || requestedMethod === "DELETE")) {
      // IIS only forwards GET/POST to PHP; the proxy restores the real method from this header.
      fetchOptions.method = "POST";
      headers["X-Portal-Method"] = requestedMethod;
    }
    let response;
    try {
      response = await fetch(API_BASE + path, { ...fetchOptions, headers });
    } catch {
      setOffline(true);
      throw new ApiError("The portal server is not reachable. Check your connection and retry.", 0, {});
    }
    setOffline(false);
    if (response.status === 401) {
      if (UNDER_PROXY) {
        toast("Your session expired. Redirecting to sign in…", "error");
        setTimeout(() => (location.href = "/portal/"), 900);
        throw new ApiError("Session expired", 401, {});
      }
      const token = await promptDialog({
        title: "Portal access token",
        label: "Admin token",
        type: "password",
        hint: "This portal is protected by PORTAL_ADMIN_TOKEN. The token is stored in this browser only.",
        confirmLabel: "Unlock",
      });
      if (token) {
        state.token = token;
        storageSet("portal_token", token);
        return api(path, options);
      }
      throw new ApiError("Unauthorized", 401, {});
    }
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!response.ok) throw new ApiError(data.error || `Request failed (HTTP ${response.status})`, response.status, data);
    return data;
  }

  const jsonBody = (value) => JSON.stringify(value ?? {});

  function setOffline(offline) {
    const slot = $("#banner-slot");
    if (offline) {
      slot.innerHTML = `<div class="banner danger">${icon("alert")}<span>Can't reach the portal server. Changes won't be saved until it is back.</span><button class="btn btn-ghost btn-sm" data-banner-retry>Retry</button></div>`;
    } else if (slot.querySelector("[data-banner-retry]")) {
      slot.innerHTML = "";
    }
  }

  /* ------------------------------------------------------------------ *
   * Data loading
   * ------------------------------------------------------------------ */

  function applyMeta(meta) {
    state.meta = meta;
    const ms = naiveMs(meta.now);
    if (Number.isFinite(ms)) state.clockOffset = ms - Date.now();
  }

  async function loadAll() {
    const [overview, posts, connections, media, meta, templates] = await Promise.all([
      api("/api/overview"),
      api("/api/posts"),
      api("/api/connections"),
      api("/api/media"),
      api("/api/meta"),
      api("/api/templates"),
    ]);
    state.overview = overview;
    state.posts = posts.posts || [];
    state.connections = connections.channels || [];
    state.mediaLibrary = media.library || [];
    state.mediaFiles = media.media || [];
    state.templates = templates.templates || [];
    applyMeta(meta);
    state.loadedAt = Date.now();
    state.reports = null;
    state.activity = null;
    state.audit = null;
    state.trash = null;
    state.automations = null;
    state.commentRules = null;
    state.inbox = null;
    pruneSelection();
    renderChrome();
    renderView();
  }

  async function loadPosts() {
    const [overview, posts, meta] = await Promise.all([api("/api/overview"), api("/api/posts"), api("/api/meta")]);
    state.overview = overview;
    state.posts = posts.posts || [];
    applyMeta(meta);
    state.loadedAt = Date.now();
    state.reports = null;
    state.activity = null;
    state.audit = null;
    state.trash = null;
    pruneSelection();
    renderChrome();
    renderView();
  }

  async function loadMedia() {
    const media = await api("/api/media");
    state.mediaLibrary = media.library || [];
    state.mediaFiles = media.media || [];
  }

  async function loadConnections() {
    const [connections, overview] = await Promise.all([api("/api/connections"), api("/api/overview")]);
    state.connections = connections.channels || [];
    state.overview = overview;
    renderChrome();
    renderView();
  }

  function pruneSelection() {
    const ids = new Set(state.posts.map((post) => post.id));
    for (const id of [...state.content.selected]) if (!ids.has(id)) state.content.selected.delete(id);
  }

  function replacePost(post) {
    if (!post) return;
    const index = state.posts.findIndex((item) => item.id === post.id);
    const light = { ...post };
    if (Array.isArray(light.revisions)) {
      light.revisionCount = light.revisions.length;
      delete light.revisions;
    }
    if (index >= 0) state.posts[index] = { ...state.posts[index], ...light };
    else state.posts.push(light);
  }

  /* ------------------------------------------------------------------ *
   * Routing and chrome
   * ------------------------------------------------------------------ */

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [name, query = ""] = raw.split("?");
    const view = LEGACY_VIEWS[name] || name;
    return { view: VIEWS.includes(view) ? view : "overview", params: new URLSearchParams(query) };
  }

  function navigate(view, params = null) {
    const query = params ? `?${new URLSearchParams(params).toString()}` : "";
    const target = `#/${view}${query}`;
    if (location.hash === target) handleRoute();
    else location.hash = target;
  }

  function handleRoute() {
    const { view, params } = parseHash();
    if (view === "content") {
      const c = state.content;
      const keys = ["status", "when", "q", "tag", "channel", "lang", "pillar"];
      const changed = keys.some((key) => params.has(key));
      if (changed) {
        // A link with filters describes the whole view; clear anything it does not mention.
        for (const key of keys) c[key] = params.get(key) || "";
        c.page = 1;
        c.selected.clear();
        $("#global-search-input").value = c.q || "";
      }
    }
    setView(view);
    const postId = params.get("post");
    if (postId && state.posts.length) {
      const post = state.posts.find((item) => item.id === postId);
      if (post) openEditor(post);
    }
  }

  function setView(view) {
    state.view = view;
    closeMenu();
    $$(".nav-item").forEach((item) => {
      const active = item.dataset.view === view;
      item.classList.toggle("is-active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    const meta = PAGE_META[view] || PAGE_META.overview;
    $("#page-title").textContent = meta[0];
    $("#page-subtitle").textContent = meta[1];
    document.title = `${meta[0]} · Fatortak Marketing OS`;
    setSidebar(false);
    renderView();
    $("#view").scrollTop = 0;
    window.scrollTo({ top: 0 });
  }

  function setSidebar(open) {
    $("#sidebar").classList.toggle("is-open", Boolean(open));
    $("#scrim").hidden = !open;
    $("#mobile-menu").setAttribute("aria-expanded", open ? "true" : "false");
  }

  function renderChrome() {
    const overview = state.overview;
    if (!overview) return;
    const live = overview.live && !overview.dryRun;
    $("#mode-dot").classList.toggle("live", live);
    $("#mode-card").classList.toggle("is-live", live);
    $("#mode-label").textContent = live ? "Live mode" : overview.dryRun ? "Dry run" : "Live locked";
    $("#mode-detail").textContent = live
      ? overview.autoPublish ? "Scheduler publishing" : "Scheduler off (env)"
      : overview.live ? "Turn dry run off to go live" : "MARKETING_LIVE is off";

    const pill = $("#site-pill");
    pill.classList.toggle("live", Boolean(overview.siteLive));
    $("#site-pill-text").textContent = overview.siteLive ? "Landing live" : "Landing down";
    if (overview.siteUrl) $("#landing-link").href = overview.siteUrl;

    const posts = overview.posts || {};
    const attention = (posts.needsReview || 0) + (posts.failed || 0);
    const badge = $("#badge-content");
    badge.hidden = !attention;
    badge.textContent = attention > 99 ? "99+" : String(attention);
    badge.title = `${posts.needsReview || 0} need review · ${posts.failed || 0} failed`;

    const failing = state.connections.filter((channel) => channel.configured && channel.verified && !channel.verified.ok).length;
    const cBadge = $("#badge-connections");
    cBadge.hidden = !failing;
    cBadge.textContent = String(failing);
    cBadge.title = `${failing} connection test${failing === 1 ? "" : "s"} failing`;

    const flagged = state.posts.filter((post) => post.health && (post.health.error || post.health.warn)).length;
    const hBadge = $("#badge-health");
    hBadge.hidden = !flagged;
    hBadge.textContent = flagged > 99 ? "99+" : String(flagged);
    hBadge.title = `${flagged} upcoming post${flagged === 1 ? "" : "s"} with warnings`;

    const autos = overview.automations?.enabled || 0;
    const aBadge = $("#badge-automations");
    aBadge.hidden = !autos;
    aBadge.textContent = String(autos);
    aBadge.title = `${autos} active automation${autos === 1 ? "" : "s"}`;

    const unread = overview.comments?.new || 0;
    const iBadge = $("#badge-inbox");
    iBadge.hidden = !unread;
    iBadge.textContent = unread > 99 ? "99+" : String(unread);
    iBadge.title = `${unread} new comment${unread === 1 ? "" : "s"}`;
  }

  function renderView() {
    if (!state.overview) {
      $("#view").innerHTML = `<div class="grid kpis">${Array.from({ length: 4 }, () => `<div class="card kpi"><div class="skeleton" style="width:40%"></div><div class="skeleton tall" style="width:60%;margin-top:12px"></div></div>`).join("")}</div><div class="card card-pad section"><div class="skeleton" style="width:30%"></div><div class="skeleton" style="width:80%;margin-top:14px"></div><div class="skeleton" style="width:65%;margin-top:10px"></div></div>`;
      return;
    }
    const renderers = {
      overview: renderOverview,
      inbox: renderInbox,
      content: renderContent,
      calendar: renderCalendar,
      media: renderMedia,
      templates: renderTemplates,
      automations: renderAutomations,
      health: renderHealth,
      trash: renderTrash,
      connections: renderConnections,
      analytics: renderAnalytics,
      reports: renderReports,
      activity: renderActivity,
      settings: renderSettings,
    };
    (renderers[state.view] || renderOverview)();
  }

  /* ------------------------------------------------------------------ *
   * Overview
   * ------------------------------------------------------------------ */

  function kpi(label, value, foot = "", { href = "", tone = "" } = {}) {
    const tag = href ? "a" : "div";
    return `<${tag} class="card kpi ${tone}" ${href ? `href="${esc(href)}"` : ""}><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${value}</div><div class="kpi-foot">${foot}</div></${tag}>`;
  }

  function alertCard(tone, iconName, title, text, actionLabel, href) {
    return `<div class="alert ${tone}">${icon(iconName)}<div><strong>${esc(title)}</strong><span>${text}</span></div>${actionLabel ? `<a class="btn btn-ghost btn-sm" href="${esc(href)}">${esc(actionLabel)}</a>` : ""}</div>`;
  }

  function renderOverview() {
    const o = state.overview;
    const posts = o.posts || {};
    const metrics = o.metrics?.totals || {};
    const traffic = o.traffic || {};
    const channels = state.connections.length ? state.connections : o.channels || [];
    const upcoming = posts.upcoming || [];
    const next = upcoming[0];
    const live = o.live && !o.dryRun && o.autoPublish;

    const alerts = [];
    if (posts.overdue) {
      const why = !o.live ? "MARKETING_LIVE is off" : o.dryRun ? "dry run is on" : !o.autoPublish ? "the scheduler is disabled" : "the scheduler will catch up on its next tick";
      alerts.push(alertCard("amber", "clock", `${plural(posts.overdue, "scheduled post")} overdue`, `Their time has passed but they have not published because ${esc(why)}.`, "Review", "#/content?status=scheduled&when=overdue"));
    }
    if (posts.failed) alerts.push(alertCard("rose", "alert", `${plural(posts.failed, "post")} failed`, "Open Results on each post to see the platform error and retry.", "Review failures", "#/content?status=failed"));
    if (posts.needsReview) alerts.push(alertCard("blue", "eye", `${plural(posts.needsReview, "post")} waiting for review`, "Approve them to put them on the schedule.", "Review", "#/content?status=needs_review"));
    const failingTests = channels.filter((channel) => channel.configured && channel.verified && !channel.verified.ok);
    if (failingTests.length) alerts.push(alertCard("rose", "plug", `${plural(failingTests.length, "connection test")} failing`, esc(failingTests.map((channel) => channel.label).join(", ")) + " — automatic publishing skips them.", "Open connections", "#/connections"));

    const days = [];
    const start = naiveMs(`${todayKey()}T00:00:00`);
    const counts = {};
    for (const post of state.posts) {
      if (!["scheduled", "published", "approved", "needs_review"].includes(post.status)) continue;
      const key = String(post.scheduledAt).slice(0, 10);
      counts[key] = counts[key] || { scheduled: 0, published: 0, other: 0 };
      if (post.status === "published") counts[key].published += 1;
      else if (post.status === "scheduled") counts[key].scheduled += 1;
      else counts[key].other += 1;
    }
    for (let i = 0; i < 14; i += 1) {
      const key = msToNaive(start + i * 86_400_000).slice(0, 10);
      days.push({ key, ...(counts[key] || { scheduled: 0, published: 0, other: 0 }) });
    }
    const maxDay = Math.max(1, ...days.map((day) => day.scheduled + day.published + day.other));

    $("#view").innerHTML = `
      ${alerts.length ? `<div class="alerts">${alerts.join("")}</div>` : ""}
      <div class="grid kpis">
        ${kpi("Next post", next ? esc(relativeWall(next.scheduledAt)) : "—", next ? `<span class="truncate">${esc(fmtWall(next.scheduledAt, { year: false }))} · ${esc(next.title)}</span>` : "Nothing scheduled", { href: next ? `#/content?post=${encodeURIComponent(next.id)}` : "#/content" })}
        ${kpi("Scheduled", fmtNumber(posts.scheduled), `<span class="dot-sm ${live ? "lime" : "amber"}"></span>${fmtNumber(posts.today)} today · ${live ? "publishing live" : "not publishing"}`, { href: "#/content?status=scheduled" })}
        ${kpi("Needs review", fmtNumber(posts.needsReview), `${fmtNumber(posts.drafts)} drafts · ${fmtNumber(posts.approved)} approved`, { href: "#/content?status=needs_review", tone: posts.needsReview ? "tone-blue" : "" })}
        ${kpi("Published · 30d", fmtNumber(posts.published30), `${fmtNumber(posts.published)} all time${posts.failed ? ` · <span class="text-rose">${fmtNumber(posts.failed)} failed</span>` : ""}`, { href: "#/content?status=published" })}
      </div>

      <div class="card card-pad section">
        <div class="section-head"><h3>Next 14 days</h3><a class="link-btn" href="#/calendar">Open calendar</a></div>
        <div class="day-strip">
          ${days.map((day) => {
            const total = day.scheduled + day.published + day.other;
            const d = new Date(naiveMs(`${day.key}T00:00:00`));
            const label = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" }).format(d);
            return `<a class="day-col ${day.key === todayKey() ? "is-today" : ""}" href="#/calendar?month=${day.key.slice(0, 7)}" title="${esc(fmtWall(`${day.key}T00:00`, { time: false }))}: ${total} posts">
              <span class="day-bar"><span class="seg published" style="height:${(day.published / maxDay) * 100}%"></span><span class="seg scheduled" style="height:${(day.scheduled / maxDay) * 100}%"></span><span class="seg other" style="height:${(day.other / maxDay) * 100}%"></span></span>
              <strong>${total || ""}</strong><em>${label} ${d.getUTCDate()}</em></a>`;
          }).join("")}
        </div>
        <div class="legend"><span><i class="published"></i>Published</span><span><i class="scheduled"></i>Scheduled</span><span><i class="other"></i>Review / approved</span></div>
      </div>

      <div class="section two-col">
        <div class="card card-pad">
          <div class="section-head"><h3>Up next</h3><a class="link-btn" href="#/content?status=scheduled&when=upcoming">All scheduled</a></div>
          ${upcoming.length ? `<div class="agenda">${upcoming.map((post) => `
            <button type="button" class="agenda-item" data-edit="${esc(post.id)}">
              <span class="agenda-time"><strong>${esc(fmtTime(post.scheduledAt))}</strong><em>${esc(fmtWall(post.scheduledAt, { time: false, year: false, weekday: true }))}</em></span>
              <span class="agenda-body"><strong dir="auto">${esc(post.title)}</strong><span>${esc(post.language.toUpperCase())} · ${esc(pillarLabel(post.pillar))} · ${esc(relativeWall(post.scheduledAt))}</span></span>
              ${channelIcons(post.channels, 4)}
            </button>`).join("")}</div>` : emptyState("Nothing scheduled", "Create a post or schedule an approved one.", `<button class="btn btn-primary btn-sm" data-new>New post</button>`)}
        </div>
        <div class="stack">
          <div class="card card-pad">
            <div class="section-head"><h3>Publishing</h3><span>${o.live ? "live env" : "env locked"}</span></div>
            <div class="setting-row"><div><strong>Mode</strong><span>${o.live ? (o.dryRun ? "Live is available; dry run is on" : "Publishing to live platform APIs") : "MARKETING_LIVE=false on the server"}</span></div><span class="chip ${o.live && !o.dryRun ? "lime" : "amber"}">${o.live && !o.dryRun ? "LIVE" : "DRY RUN"}</span></div>
            <div class="setting-row"><div><strong>Scheduler</strong><span>${o.autoPublish ? "Publishes due posts every minute" : "PORTAL_AUTO_PUBLISH is off"}</span></div><span class="chip ${o.autoPublish ? "lime" : "muted"}">${o.autoPublish ? "ON" : "OFF"}</span></div>
            <div class="setting-row"><div><strong>Landing page</strong><span class="truncate">${esc(o.siteUrl || "")}</span></div><span class="chip ${o.siteLive ? "lime" : "rose"}">${o.siteLive ? "UP" : "DOWN"}</span></div>
            <div class="setting-row"><div><strong>Channels</strong><span>${channels.filter((c) => c.configured).length} connected · ${channels.filter((c) => verifiedFresh(c)).length} verified today</span></div><a class="link-btn" href="#/connections">Manage</a></div>
          </div>
          <div class="card card-pad">
            <div class="section-head"><h3>Audience</h3><a class="link-btn" href="#/analytics">Analytics</a></div>
            <div class="mini-stats">
              <div><span>Followers</span><strong>${metrics.available?.followers ? fmtNumber(metrics.followers) : "—"}</strong></div>
              <div><span>Engagement</span><strong>${metrics.available?.engagement ? fmtNumber(metrics.engagement) : "—"}</strong></div>
              <div><span>Visitors · 30d</span><strong>${traffic.configured && !traffic.error ? fmtNumber(traffic.visitors) : "—"}</strong></div>
            </div>
          </div>
        </div>
      </div>

      <div class="section two-col">
        <div class="card">
          <div class="card-pad pb-0"><div class="section-head"><h3>Channel health</h3><a class="link-btn" href="#/connections">Connections</a></div></div>
          <div class="table-wrap"><table><thead><tr><th>Channel</th><th>Status</th><th class="num">Followers</th><th class="num">Engagement</th><th>Last sync</th></tr></thead><tbody>
            ${channels.filter((channel) => channel.mode === "api" || channel.configured).map((channel) => `
              <tr>
                <td><div class="channel-name">${channelIcon(channel.key)}<div><strong>${esc(channel.label)}</strong><span>${esc(channel.mode)}</span></div></div></td>
                <td>${channelStatusChip(channel)}</td>
                <td class="num">${metricValue(channel.metrics?.followers, channel.metrics?.lastUpdated)}</td>
                <td class="num">${metricValue(channel.metrics?.engagement, channel.metrics?.lastUpdated)}</td>
                <td>${channel.metrics?.lastUpdated ? esc(relativeInstant(channel.metrics.lastUpdated)) : "—"}</td>
              </tr>`).join("")}
          </tbody></table></div>
        </div>
        <div class="card card-pad">
          <div class="section-head"><h3>Recent activity</h3><a class="link-btn" href="#/activity">View all</a></div>
          ${activityList((o.activity || []).slice(0, 8))}
        </div>
      </div>
    `;
  }

  function activityList(items) {
    if (!items.length) return emptyState("No activity yet", "Edits, publishes and settings changes appear here.");
    return `<ol class="timeline">${items.map((item) => `
      <li class="timeline-item type-${esc(item.type)}">
        <span class="timeline-dot"></span>
        <div><p dir="auto">${esc(item.message)}</p><span>${esc(fmtInstant(item.at))} · ${esc(relativeInstant(item.at))}${item.postId && state.posts.some((post) => post.id === item.postId) ? ` · <button class="link-btn" data-edit="${esc(item.postId)}">Open post</button>` : ""}</span></div>
      </li>`).join("")}</ol>`;
  }

  /* ------------------------------------------------------------------ *
   * Content
   * ------------------------------------------------------------------ */

  function contentFiltered({ ignoreStatus = false } = {}) {
    const c = state.content;
    const now = wallNow();
    const weekEnd = msToNaive(naiveMs(now) + 7 * 86_400_000);
    const q = c.q.trim().toLowerCase();
    return state.posts.filter((post) => {
      if (!ignoreStatus && c.status && post.status !== c.status) return false;
      if (c.channel && !(post.channels || []).includes(c.channel)) return false;
      if (c.lang && post.language !== c.lang) return false;
      if (c.pillar && post.pillar !== c.pillar) return false;
      if (c.tag && !(post.tags || []).includes(c.tag)) return false;
      const at = String(post.scheduledAt);
      if (c.when === "upcoming" && at < now) return false;
      if (c.when === "overdue" && !(at < now && post.status === "scheduled")) return false;
      if (c.when === "past" && at >= now) return false;
      if (c.when === "today" && !at.startsWith(now.slice(0, 10))) return false;
      if (c.when === "week" && !(at >= now && at <= weekEnd)) return false;
      if (q && !`${post.title} ${post.content} ${(post.tags || []).join(" ")} ${post.notes || ""} ${post.id}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  function sortPosts(posts) {
    const sort = state.content.sort;
    const sorted = [...posts];
    const byDate = (a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt));
    if (sort === "schedule-asc") sorted.sort(byDate);
    if (sort === "schedule-desc") sorted.sort((a, b) => byDate(b, a));
    if (sort === "updated-desc") sorted.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    if (sort === "title-asc") sorted.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    if (sort === "status") sorted.sort((a, b) => STATUS_TABS.indexOf(a.status) - STATUS_TABS.indexOf(b.status) || byDate(a, b));
    return sorted;
  }

  function filtersActive() {
    const c = state.content;
    return Boolean(c.channel || c.lang || c.pillar || c.tag || c.when || c.q);
  }

  function renderContent() {
    const c = state.content;
    const base = contentFiltered({ ignoreStatus: true });
    const tabCounts = {};
    for (const post of base) tabCounts[post.status] = (tabCounts[post.status] || 0) + 1;
    const filtered = sortPosts(c.status ? base.filter((post) => post.status === c.status) : base);
    const pages = Math.max(1, Math.ceil(filtered.length / c.pageSize));
    c.page = Math.min(Math.max(1, c.page), pages);
    const pageItems = filtered.slice((c.page - 1) * c.pageSize, c.page * c.pageSize);
    const selectedCount = c.selected.size;
    const allPageSelected = pageItems.length > 0 && pageItems.every((post) => c.selected.has(post.id));
    const tags = state.meta?.tags || [];
    const pillars = state.meta?.pillars || Object.keys(PILLAR_LABEL);
    const exportParams = new URLSearchParams();
    for (const key of ["status", "channel", "lang", "pillar", "tag", "q"]) if (c[key]) exportParams.set(key, c[key]);

    $("#view").innerHTML = `
      <div class="page-head">
        <div><span class="eyebrow">Content library</span><h2>${plural(filtered.length, "post")}${filtersActive() || c.status ? ` <small>of ${fmtNumber(state.posts.length)}</small>` : ""}</h2></div>
        <div class="page-head-actions">
          <a class="btn btn-ghost" href="#/trash">${icon("trash")}Trash${state.overview?.trash ? ` <em class="count-pill">${fmtNumber(state.overview.trash)}</em>` : ""}</a>
          <a class="btn btn-ghost" href="${esc(withToken(`${API_BASE}/api/reports/export?format=csv${exportParams.toString() ? `&${exportParams}` : ""}`))}" download>${icon("download")}Export CSV</a>
          <button class="btn btn-primary" data-new>${icon("plus")}New post</button>
        </div>
      </div>

      <div class="tabs" role="tablist" aria-label="Filter by status">
        ${STATUS_TABS.filter((status) => !status || tabCounts[status] || status === c.status || ["scheduled", "needs_review", "draft", "published"].includes(status)).map((status) => `
          <button type="button" role="tab" class="tab ${c.status === status ? "is-active" : ""} ${status ? `tab-${esc(status)}` : ""}" data-tab="${esc(status)}" aria-selected="${c.status === status}">
            ${esc(status ? statusLabel(status) : "All")}<em>${fmtNumber(status ? tabCounts[status] || 0 : base.length)}</em>
          </button>`).join("")}
      </div>

      <div class="card toolbar">
        <div class="search"><svg><use href="#i-search"></use></svg><input id="filter-q" type="search" placeholder="Search title, copy, tags, notes…" value="${esc(c.q)}" aria-label="Search posts" /></div>
        <select id="filter-when" aria-label="Date range">
          ${[["", "Any time"], ["upcoming", "Upcoming"], ["today", "Today"], ["week", "Next 7 days"], ["overdue", "Overdue"], ["past", "Past"]].map(([value, label]) => `<option value="${value}" ${c.when === value ? "selected" : ""}>${label}</option>`).join("")}
        </select>
        <select id="filter-channel" aria-label="Channel"><option value="">All channels</option>${state.connections.map((channel) => `<option value="${esc(channel.key)}" ${c.channel === channel.key ? "selected" : ""}>${esc(channel.label)}</option>`).join("")}</select>
        <select id="filter-lang" aria-label="Language"><option value="">EN + AR</option><option value="en" ${c.lang === "en" ? "selected" : ""}>English</option><option value="ar" ${c.lang === "ar" ? "selected" : ""}>Arabic</option></select>
        <select id="filter-pillar" aria-label="Pillar"><option value="">All pillars</option>${pillars.map((pillar) => `<option value="${esc(pillar)}" ${c.pillar === pillar ? "selected" : ""}>${esc(pillarLabel(pillar))}</option>`).join("")}</select>
        ${tags.length ? `<select id="filter-tag" aria-label="Tag"><option value="">All tags</option>${tags.map((tag) => `<option value="${esc(tag)}" ${c.tag === tag ? "selected" : ""}>#${esc(tag)}</option>`).join("")}</select>` : ""}
        <select id="filter-sort" aria-label="Sort">
          ${[["schedule-asc", "Schedule ↑"], ["schedule-desc", "Schedule ↓"], ["updated-desc", "Recently edited"], ["title-asc", "Title A–Z"], ["status", "Status"]].map(([value, label]) => `<option value="${value}" ${c.sort === value ? "selected" : ""}>${label}</option>`).join("")}
        </select>
        ${filtersActive() ? `<button class="btn btn-ghost btn-sm" data-clear-filters>${icon("close")}Clear</button>` : ""}
      </div>

      <div class="bulk-bar ${selectedCount ? "is-visible" : ""}" role="region" aria-label="Bulk actions">
        <strong>${plural(selectedCount, "selected", "selected")}</strong>
        ${selectedCount && selectedCount < filtered.length ? `<button class="link-btn" data-select-all-matching>Select all ${fmtNumber(filtered.length)} matching</button>` : ""}
        <span class="foot-spacer"></span>
        <button class="btn btn-ghost btn-sm" data-bulk="schedule">${icon("clock")}Schedule</button>
        <button class="btn btn-ghost btn-sm" data-bulk-menu="status" aria-haspopup="menu">Status ▾</button>
        <button class="btn btn-ghost btn-sm" data-bulk="shift">${icon("calendar")}Move days</button>
        <button class="btn btn-ghost btn-sm" data-bulk-menu="channels" aria-haspopup="menu">Channels ▾</button>
        <button class="btn btn-ghost btn-sm" data-bulk-menu="tags" aria-haspopup="menu">${icon("tag")}Tags ▾</button>
        <button class="btn btn-ghost btn-sm" data-bulk="duplicate">${icon("copy")}Duplicate</button>
        <button class="btn btn-danger btn-sm" data-bulk="delete">${icon("trash")}Delete</button>
        <button class="icon-btn sm" data-bulk="clear" aria-label="Clear selection" title="Clear selection">${icon("close")}</button>
      </div>

      <div class="card">
        ${pageItems.length ? `<div class="table-wrap"><table class="content-table"><thead><tr>
            <th class="col-check"><input type="checkbox" id="select-page" aria-label="Select all on this page" ${allPageSelected ? "checked" : ""} /></th>
            <th>Post</th><th>Channels</th><th>Schedule (${esc(tzShort())})</th><th>Status</th><th class="col-actions"><span class="sr-only">Actions</span></th>
          </tr></thead><tbody>
          ${pageItems.map((post) => contentRow(post)).join("")}
        </tbody></table></div>
        <div class="pager">
          <span>${fmtNumber((c.page - 1) * c.pageSize + 1)}–${fmtNumber(Math.min(c.page * c.pageSize, filtered.length))} of ${fmtNumber(filtered.length)}</span>
          <span class="foot-spacer"></span>
          <label class="pager-size">Rows <select id="page-size">${[25, 50, 100].map((size) => `<option ${c.pageSize === size ? "selected" : ""}>${size}</option>`).join("")}</select></label>
          <button class="icon-btn sm" data-page="prev" ${c.page <= 1 ? "disabled" : ""} aria-label="Previous page">‹</button>
          <span class="pager-page">Page ${c.page} / ${pages}</span>
          <button class="icon-btn sm" data-page="next" ${c.page >= pages ? "disabled" : ""} aria-label="Next page">›</button>
        </div>`
        : emptyState(
            state.posts.length ? "No posts match these filters" : "No posts yet",
            state.posts.length ? "Try another status tab or clear the filters." : "Create your first post or start from a template.",
            state.posts.length && (filtersActive() || c.status) ? `<button class="btn btn-ghost btn-sm" data-clear-filters data-clear-status>Clear filters</button>` : `<button class="btn btn-primary btn-sm" data-new>New post</button>`
          )}
      </div>
    `;
  }

  function contentRow(post) {
    const selected = state.content.selected.has(post.id);
    const overdue = isOverdue(post);
    const counts = resultCounts(post.results);
    const resultHint = post.status === "published" && counts.total
      ? `<span class="result-mini ${counts.failed || counts.skipped ? "warn" : ""}" title="${counts.published} published · ${counts.failed} failed · ${counts.skipped} skipped">${counts.published}/${counts.total} sent</span>`
      : "";
    return `<tr class="${selected ? "is-selected" : ""}" data-row="${esc(post.id)}">
      <td class="col-check"><input type="checkbox" data-select="${esc(post.id)}" ${selected ? "checked" : ""} aria-label="Select ${esc(post.title)}" /></td>
      <td>
        <div class="post-title-wrap">
          ${post.mediaUrl ? `<div class="post-thumb">${post.mediaKind === "video" ? `${post.posterUrl ? `<img src="${esc(post.posterUrl)}" alt="" loading="lazy" />` : ""}<span class="thumb-video overlay">${icon("play")}</span>` : `<img src="${esc(post.mediaUrl)}" alt="" loading="lazy" />`}</div>` : `<div class="post-thumb is-empty" title="No media">${icon("image")}</div>`}
          <div class="cell-title">
            <button type="button" class="title-link" data-edit="${esc(post.id)}" dir="auto">${esc(post.title)}</button>
            <span><b class="lang-badge">${esc(String(post.language || "en").toUpperCase())}</b>${esc(pillarLabel(post.pillar))}${(post.tags || []).map((tag) => ` <i class="tag">#${esc(tag)}</i>`).join("")}${post.revisionCount ? ` · ${plural(post.revisionCount, "edit")}` : ""}</span>
          </div>
        </div>
      </td>
      <td>${channelIcons(post.channels, 4)}</td>
      <td><div class="when ${overdue ? "is-overdue" : ""}"><strong>${esc(fmtWall(post.scheduledAt, { year: false }))}</strong><span>${overdue ? "overdue · " : ""}${esc(relativeWall(post.scheduledAt))}</span></div></td>
      <td><div class="status-cell">${statusChip(post.status)}${resultHint}${post.health && (post.health.error || post.health.warn) ? `<button type="button" class="health-mini ${post.health.error ? "err" : ""}" data-edit="${esc(post.id)}" title="${post.health.error ? `${post.health.error} problem(s)` : ""} ${post.health.warn ? `${post.health.warn} warning(s)` : ""} — open to see checks">${icon("alert")}${post.health.error + post.health.warn}</button>` : ""}</div></td>
      <td class="col-actions"><div class="row-actions">
        ${["needs_review", "draft", "approved"].includes(post.status) ? `<button class="btn btn-ghost btn-sm" data-approve="${esc(post.id)}" title="Approve and schedule">${icon("check")}Approve</button>` : ""}
        <button class="icon-btn sm" data-edit="${esc(post.id)}" title="Edit" aria-label="Edit">${icon("pen")}</button>
        <button class="icon-btn sm" data-row-menu="${esc(post.id)}" title="More actions" aria-label="More actions" aria-haspopup="menu">${icon("more")}</button>
      </div></td>
    </tr>`;
  }

  function rowMenu(anchor, id) {
    const post = state.posts.find((item) => item.id === id);
    if (!post) return;
    const counts = resultCounts(post.results);
    openMenu(anchor, [
      { label: "Edit", icon: "pen", onClick: () => openEditor(post) },
      { label: "Dry run", icon: "play", hint: "simulate", onClick: () => publishPost(post.id, true) },
      { label: "Channel results", icon: "report", disabled: !counts.total && !post.preview, onClick: () => showChannelStatus(post.id) },
      { label: "Duplicate", icon: "copy", onClick: () => duplicatePost(post.id) },
      { divider: true },
      post.status !== "scheduled" ? { label: "Schedule", icon: "clock", onClick: () => updateStatus(post.id, "scheduled") } : { label: "Pause (back to draft)", icon: "clock", onClick: () => updateStatus(post.id, "draft") },
      post.status !== "needs_review" && post.status !== "published" ? { label: "Send for review", icon: "eye", onClick: () => updateStatus(post.id, "needs_review") } : null,
      { label: post.status === "published" ? "Publish again…" : "Publish now…", icon: "send", disabled: !state.overview?.live, hint: state.overview?.live ? "" : "live locked", onClick: () => publishPost(post.id, false) },
      { divider: true },
      { label: "Copy link to post", icon: "link", onClick: () => copyText(`${location.origin}${location.pathname}#/content?post=${encodeURIComponent(post.id)}`) },
      { label: "Delete", icon: "trash", danger: true, onClick: () => deletePost(post.id) },
    ]);
  }

  async function runBulk(action, value, { confirmText, danger = false } = {}) {
    const ids = [...state.content.selected];
    if (!ids.length) return;
    if (confirmText) {
      const ok = await confirmDialog({ title: "Bulk action", message: confirmText, confirmLabel: danger ? "Delete" : "Apply", danger });
      if (!ok) return;
    }
    try {
      const result = await api("/api/posts/bulk", { method: "POST", body: jsonBody({ ids, action, value }) });
      const skipped = result.skipped?.length || 0;
      toast(`Updated ${plural(result.updated, "post")}${skipped ? `, skipped ${skipped} (${esc(result.skipped[0].reason)})` : ""}.`, skipped && !result.updated ? "error" : "success");
      if (action === "delete") state.content.selected.clear();
      if (action === "duplicate") {
        state.content.selected.clear();
        for (const id of result.created || []) state.content.selected.add(id);
      }
      await loadPosts();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  function bulkMenu(anchor, kind) {
    const count = state.content.selected.size;
    if (kind === "status") {
      openMenu(anchor, [
        { heading: `Set status on ${count}` },
        ...["scheduled", "needs_review", "approved", "draft"].map((status) => ({ label: statusLabel(status), onClick: () => runBulk("status", status) })),
      ]);
    }
    if (kind === "channels") {
      const apiChannels = state.connections.filter((channel) => channel.mode === "api");
      openMenu(anchor, [
        { heading: "Add channel" },
        ...apiChannels.map((channel) => ({ label: `+ ${channel.label}`, hint: channel.configured ? "" : "not connected", onClick: () => runBulk("addChannel", channel.key) })),
        { divider: true },
        { heading: "Remove channel" },
        ...state.connections
          .filter((channel) => state.posts.some((post) => state.content.selected.has(post.id) && post.channels.includes(channel.key)))
          .map((channel) => ({ label: `− ${channel.label}`, onClick: () => runBulk("removeChannel", channel.key) })),
      ]);
    }
    if (kind === "tags") {
      const selectedTags = [...new Set(state.posts.filter((post) => state.content.selected.has(post.id)).flatMap((post) => post.tags || []))];
      openMenu(anchor, [
        {
          label: "Add tag…",
          icon: "plus",
          onClick: async () => {
            const tag = await promptDialog({ title: `Tag ${plural(count, "post")}`, label: "Tag", placeholder: "launch-week", confirmLabel: "Add tag" });
            if (tag) runBulk("addTag", tag);
          },
        },
        ...(selectedTags.length ? [{ divider: true }, { heading: "Remove tag" }, ...selectedTags.map((tag) => ({ label: `#${tag}`, onClick: () => runBulk("removeTag", tag) }))] : []),
      ]);
    }
  }

  async function bulkAction(kind) {
    const count = state.content.selected.size;
    if (kind === "clear") {
      state.content.selected.clear();
      return renderContent();
    }
    if (kind === "schedule") return runBulk("status", "scheduled");
    if (kind === "duplicate") return runBulk("duplicate");
    if (kind === "delete") {
      const published = state.posts.filter((post) => state.content.selected.has(post.id) && post.status === "published").length;
      return runBulk("delete", null, {
        confirmText: `Delete ${plural(count, "post")} from the portal?${published ? ` ${published} already published — this does not remove them from the platforms.` : ""}`,
        danger: true,
      });
    }
    if (kind === "shift") {
      const value = await promptDialog({
        title: `Move ${plural(count, "post")}`,
        label: "Days to move (negative moves earlier)",
        type: "number",
        value: "1",
        hint: "Keeps each post's time of day.",
        confirmLabel: "Move",
        validate: (raw) => (/^-?\d+$/.test(raw) && Number(raw) !== 0 && Math.abs(Number(raw)) <= 365 ? "" : "Enter a whole number between -365 and 365, not 0."),
      });
      if (value !== null) runBulk("shift", Number(value));
    }
  }

  /* ------------------------------------------------------------------ *
   * Calendar
   * ------------------------------------------------------------------ */

  function renderCalendar() {
    const cal = state.calendar;
    const params = parseHash().params;
    if (params.get("month") && /^\d{4}-\d{2}$/.test(params.get("month"))) cal.month = params.get("month");
    if (!cal.month) cal.month = todayKey().slice(0, 7);
    const [year, monthNumber] = cal.month.split("-").map(Number);
    const firstMs = Date.UTC(year, monthNumber - 1, 1);
    const startDay = new Date(firstMs).getUTCDay();
    const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const cells = [];
    for (let i = startDay; i > 0; i -= 1) cells.push({ date: msToNaive(firstMs - i * 86_400_000).slice(0, 10), outside: true });
    for (let day = 1; day <= days; day += 1) cells.push({ date: `${cal.month}-${pad(day)}`, outside: false });
    let tail = 1;
    while (cells.length % 7 !== 0) cells.push({ date: msToNaive(Date.UTC(year, monthNumber, tail++)).slice(0, 10), outside: true });

    const today = todayKey();
    const byDate = {};
    for (const post of state.posts) {
      if (cal.lang && post.language !== cal.lang) continue;
      if (cal.channel && !(post.channels || []).includes(cal.channel)) continue;
      const date = String(post.scheduledAt || "").slice(0, 10);
      (byDate[date] = byDate[date] || []).push(post);
    }
    for (const list of Object.values(byDate)) list.sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
    const monthName = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(firstMs));
    const monthPosts = Object.entries(byDate).filter(([date]) => date.startsWith(cal.month)).flatMap(([, list]) => list);
    const MAX = 4;

    $("#view").innerHTML = `
      <div class="page-head">
        <div><span class="eyebrow">Publishing calendar · ${esc(tzShort())} time</span><h2>${esc(monthName)} <small>${plural(monthPosts.length, "post")}</small></h2></div>
        <div class="page-head-actions">
          <select id="cal-lang" aria-label="Language"><option value="">EN + AR</option><option value="en" ${cal.lang === "en" ? "selected" : ""}>English</option><option value="ar" ${cal.lang === "ar" ? "selected" : ""}>Arabic</option></select>
          <select id="cal-channel" aria-label="Channel"><option value="">All channels</option>${state.connections.filter((c) => c.mode === "api").map((channel) => `<option value="${esc(channel.key)}" ${cal.channel === channel.key ? "selected" : ""}>${esc(channel.label)}</option>`).join("")}</select>
          <div class="btn-group"><button class="btn btn-ghost" data-cal="prev" aria-label="Previous month">‹</button><button class="btn btn-ghost" data-cal="today">Today</button><button class="btn btn-ghost" data-cal="next" aria-label="Next month">›</button></div>
          <button class="btn btn-primary" data-new>${icon("plus")}New post</button>
        </div>
      </div>
      <div class="card card-pad">
        <div class="calendar-grid" role="grid" aria-label="${esc(monthName)}">
          ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<div class="calendar-dow" role="columnheader">${day}</div>`).join("")}
          ${cells.map((cell) => {
            const list = byDate[cell.date] || [];
            const past = cell.date < today;
            return `<div class="calendar-day ${cell.outside ? "is-outside" : ""} ${cell.date === today ? "is-today" : ""} ${past ? "is-past" : ""}" data-day="${cell.date}" role="gridcell">
              <div class="calendar-day-head"><span class="calendar-day-number">${Number(cell.date.slice(8))}</span>${list.length ? `<span class="calendar-count">${list.length}</span>` : ""}${past ? "" : `<button class="calendar-add" data-cal-new="${cell.date}" title="New post on this day" aria-label="New post on ${esc(cell.date)}">+</button>`}</div>
              ${list.slice(0, MAX).map((post) => calendarChip(post)).join("")}
              ${list.length > MAX ? `<button class="calendar-more" data-cal-day="${cell.date}">+${list.length - MAX} more</button>` : ""}
            </div>`;
          }).join("")}
        </div>
        <div class="legend">
          ${["scheduled", "needs_review", "draft", "published", "failed"].map((status) => `<span><i class="status-dot ${status}"></i>${statusLabel(status)}</span>`).join("")}
          <span class="legend-hint">Drag a post to another day to reschedule it.</span>
        </div>
      </div>
    `;
  }

  function calendarChip(post) {
    const movable = !["published", "publishing"].includes(post.status);
    return `<button type="button" class="calendar-post ${esc(post.status)} ${isOverdue(post) ? "is-overdue" : ""}" data-edit="${esc(post.id)}" ${movable ? `draggable="true" data-drag="${esc(post.id)}"` : ""} title="${esc(`${fmtTime(post.scheduledAt)} · ${post.title} · ${statusLabel(post.status)}`)}"><b>${esc(fmtTime(post.scheduledAt))}</b><span dir="auto">${esc(post.title)}</span>${post.language === "ar" ? `<i>AR</i>` : ""}</button>`;
  }

  function openDayModal(date) {
    const list = state.posts
      .filter((post) => String(post.scheduledAt).startsWith(date))
      .filter((post) => (!state.calendar.lang || post.language === state.calendar.lang) && (!state.calendar.channel || post.channels.includes(state.calendar.channel)))
      .sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
    openModal({
      title: fmtWall(`${date}T00:00`, { time: false, weekday: true }),
      wide: true,
      body: list.length ? `<div class="agenda">${list.map((post) => `
        <button type="button" class="agenda-item" data-modal-edit="${esc(post.id)}">
          <span class="agenda-time"><strong>${esc(fmtTime(post.scheduledAt))}</strong><em>${esc(String(post.language).toUpperCase())}</em></span>
          <span class="agenda-body"><strong dir="auto">${esc(post.title)}</strong><span>${esc(pillarLabel(post.pillar))}</span></span>
          ${channelIcons(post.channels, 4)}${statusChip(post.status)}
        </button>`).join("")}</div>` : emptyState("No posts", "Nothing is planned for this day."),
      actions: [
        { label: "Close", className: "btn-ghost" },
        ...(date >= todayKey() ? [{ label: "New post this day", className: "btn-primary", onClick: () => openEditor(null, { scheduledAt: `${date}T09:00:00` }) }] : []),
      ],
      onOpen: () => {
        $$("[data-modal-edit]").forEach((button) =>
          button.addEventListener("click", () => {
            const post = state.posts.find((item) => item.id === button.dataset.modalEdit);
            finishModal(null);
            if (post) openEditor(post);
          })
        );
      },
    });
  }

  async function reschedulePost(id, date) {
    const post = state.posts.find((item) => item.id === id);
    if (!post) return;
    const time = String(post.scheduledAt).slice(11, 19) || "09:00:00";
    const target = `${date}T${time}`;
    if (target === post.scheduledAt) return;
    if (target < wallNow() && post.status === "scheduled") {
      const ok = await confirmDialog({
        title: "Move into the past?",
        message: `${esc(fmtWall(target))} has already passed. A scheduled post there publishes on the next scheduler tick when live mode is on.`,
        confirmLabel: "Move anyway",
      });
      if (!ok) return;
    }
    const previous = post.scheduledAt;
    post.scheduledAt = target;
    renderCalendar();
    try {
      const response = await api(`/api/posts/${encodeURIComponent(id)}`, { method: "PUT", body: jsonBody({ scheduledAt: target, updatedAt: post.updatedAt }) });
      replacePost(response.post);
      toast(`Moved “${post.title}” to ${fmtWall(target, { year: false })}.`, "success", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              const undo = await api(`/api/posts/${encodeURIComponent(id)}`, { method: "PUT", body: jsonBody({ scheduledAt: previous }) });
              replacePost(undo.post);
              renderView();
              toast("Move undone.");
            } catch (error) {
              toast(error.message, "error");
            }
          },
        },
      });
      loadPosts().catch(() => {});
    } catch (error) {
      post.scheduledAt = previous;
      renderCalendar();
      toast(error.message, "error");
    }
  }

  /* ------------------------------------------------------------------ *
   * Media
   * ------------------------------------------------------------------ */

  function allMediaEntries() {
    const uploads = state.mediaFiles.map((item) => ({ ...item, label: item.name, origin: "upload" }));
    const library = state.mediaLibrary.map((item) => ({ ...item, name: item.file, origin: "library" }));
    return [...uploads, ...library];
  }

  function renderMedia() {
    const view = state.mediaView;
    const q = view.q.trim().toLowerCase();
    const entries = allMediaEntries().filter((item) => {
      if (view.filter === "uploads" && item.origin !== "upload") return false;
      if (view.filter === "library" && item.origin !== "library") return false;
      if (view.filter === "video" && item.kind !== "video") return false;
      if (view.filter === "unused" && (item.usage?.total || 0) > 0) return false;
      if (q && !`${item.label || ""} ${item.name || ""} ${item.alt || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const totalSize = state.mediaFiles.reduce((sum, item) => sum + Number(item.size || 0), 0);
    $("#view").innerHTML = `
      <div class="page-head">
        <div><span class="eyebrow">Media library</span><h2>${plural(state.mediaFiles.length, "upload")} <small>· ${fmtBytes(totalSize)} · ${plural(state.mediaLibrary.length, "brand asset")}</small></h2></div>
        <div class="page-head-actions">
          <label class="btn btn-primary">${icon("upload")}Upload files<input type="file" id="media-page-file" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/quicktime,video/webm,video/x-m4v" hidden /></label>
        </div>
      </div>
      <div class="dropzone" id="media-dropzone">${icon("upload")}<span><strong>Drop images or videos here</strong> · PNG, JPG, WebP, GIF, MP4, MOV, WebM up to 100 MB</span><div class="upload-progress" id="page-upload-progress" hidden><div class="upload-bar"><span id="page-upload-bar"></span></div><span id="page-upload-label"></span></div></div>
      <div class="card toolbar">
        <div class="search"><svg><use href="#i-search"></use></svg><input id="media-q" type="search" placeholder="Search media…" value="${esc(view.q)}" aria-label="Search media" /></div>
        <div class="segmented" role="group" aria-label="Filter media">
          ${[["all", "All"], ["uploads", "Uploads"], ["library", "Brand library"], ["video", "Video"], ["unused", "Unused"]].map(([key, label]) => `<button type="button" class="${view.filter === key ? "is-active" : ""}" data-media-filter="${key}">${label}</button>`).join("")}
        </div>
      </div>
      ${entries.length ? `<div class="media-cards">${entries.map((item) => `
        <article class="card media-card">
          <div class="media-card-thumb">${item.kind === "video" ? `<video src="${esc(item.url)}" muted playsinline preload="metadata"></video><span class="thumb-video">${icon("play")}</span>` : `<img src="${esc(item.url)}" alt="${esc(item.alt || "")}" loading="lazy" />`}<span class="media-origin ${item.origin}">${item.origin === "upload" ? "Upload" : "Brand"}</span></div>
          <div class="media-card-body">
            <strong class="truncate" title="${esc(item.label || item.name)}">${esc(item.label || item.name)}</strong>
            <span>${esc(item.kind || "image")}${item.size ? ` · ${fmtBytes(item.size)}` : ""} · ${item.usage?.total ? `used by ${plural(item.usage.total, "post")}${item.usage.pending ? ` (${item.usage.pending} pending)` : ""}` : "unused"}</span>
          </div>
          <div class="media-card-actions">
            <button class="btn btn-ghost btn-sm" data-media-use="${esc(item.origin)}:${esc(item.id)}">${icon("plus")}New post</button>
            <button class="icon-btn sm" data-media-copy="${esc(item.publicUrl || item.url)}" title="Copy URL" aria-label="Copy URL">${icon("copy")}</button>
            <a class="icon-btn sm" href="${esc(item.url)}" target="_blank" rel="noopener" title="Open" aria-label="Open">${icon("external")}</a>
            ${item.origin === "upload" ? `<button class="icon-btn sm danger" data-media-delete="${esc(item.id)}" title="Delete" aria-label="Delete">${icon("trash")}</button>` : ""}
          </div>
        </article>`).join("")}</div>` : `<div class="card">${emptyState("No media found", view.filter === "all" && !q ? "Upload an image or video to start." : "Try another filter.")}</div>`}
    `;
  }

  function mediaEntryToPostMedia(item) {
    return {
      url: item.url,
      publicUrl: /^https?:\/\//i.test(item.publicUrl || "") ? item.publicUrl : "",
      kind: item.kind || "image",
      name: item.name || item.file || "",
      source: item.origin === "upload" ? "upload" : `library:${item.id}`,
      alt: item.alt || "",
    };
  }

  function uploadFile(file, onProgress) {
    return new Promise((resolve, reject) => {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (!/^image\/|^video\//.test(file.type || "") && !["png", "jpg", "jpeg", "webp", "gif", "avif", "mp4", "mov", "webm", "m4v"].includes(ext)) {
        reject(new Error(`${file.name}: choose an image or video file.`));
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        reject(new Error(`${file.name} is larger than 100 MB.`));
        return;
      }
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/api/media`);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
      if (state.token) xhr.setRequestHeader("Authorization", `Bearer ${state.token}`);
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded / event.total);
      });
      xhr.addEventListener("load", () => {
        let data = {};
        try {
          data = JSON.parse(xhr.responseText || "{}");
        } catch {
          data = {};
        }
        if (xhr.status === 401 && UNDER_PROXY) {
          location.href = "/portal/";
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data.media);
        else reject(new Error(data.error || `Upload failed (HTTP ${xhr.status})`));
      });
      xhr.addEventListener("error", () => reject(new Error("Upload failed. Check your connection.")));
      xhr.send(file);
    });
  }

  async function uploadMany(files, { bar, label, box }) {
    const list = [...files];
    if (!list.length) return [];
    const uploaded = [];
    box.hidden = false;
    for (let i = 0; i < list.length; i += 1) {
      const file = list[i];
      label.textContent = `Uploading ${file.name} (${i + 1}/${list.length})…`;
      try {
        const media = await uploadFile(file, (ratio) => (bar.style.width = `${Math.round(((i + ratio) / list.length) * 100)}%`));
        uploaded.push(media);
      } catch (error) {
        toast(error.message, "error");
      }
    }
    bar.style.width = "100%";
    setTimeout(() => {
      box.hidden = true;
      bar.style.width = "0";
    }, 600);
    if (uploaded.length) toast(`Uploaded ${plural(uploaded.length, "file")}.`, "success");
    return uploaded;
  }

  async function deleteMedia(id) {
    const item = state.mediaFiles.find((entry) => entry.id === id);
    if (!item) return;
    const pending = item.usage?.pending || 0;
    const ok = await confirmDialog({
      title: "Delete media",
      message: `Delete <strong>${esc(item.name)}</strong>? ${pending ? `${plural(pending, "unpublished post")} still use it and would publish without media.` : item.usage?.total ? "Published posts keep their platform copy." : "No posts use it."}`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/media/${encodeURIComponent(id)}${pending ? "?force=1" : ""}`, { method: "DELETE" });
      toast("Media deleted.", "success");
      await loadMedia();
      renderMedia();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  /* ------------------------------------------------------------------ *
   * Templates
   * ------------------------------------------------------------------ */

  function renderTemplates() {
    $("#view").innerHTML = `
      <div class="page-head">
        <div><span class="eyebrow">Templates</span><h2>${plural(state.templates.length, "template")}</h2><p>Start posts from proven copy. Placeholders like {{site}} stay as tracked links.</p></div>
        <div class="page-head-actions"><button class="btn btn-primary" data-template-new>${icon("plus")}New template</button></div>
      </div>
      ${state.templates.length ? `<div class="template-grid">${state.templates.map((template) => `
        <article class="card template-card">
          <div class="template-head"><div><strong>${esc(template.name)}</strong><span>${esc(String(template.language || "en").toUpperCase())} · ${esc(pillarLabel(template.pillar))} · updated ${esc(relativeInstant(template.updatedAt))}</span></div>${channelIcons(template.channels, 4)}</div>
          <pre class="template-body" dir="auto">${esc(template.content)}</pre>
          <div class="template-actions">
            <button class="btn btn-primary btn-sm" data-template-use="${esc(template.id)}">${icon("pen")}Use template</button>
            <button class="btn btn-ghost btn-sm" data-template-edit="${esc(template.id)}">Edit</button>
            <button class="icon-btn sm danger" data-template-delete="${esc(template.id)}" title="Delete template" aria-label="Delete template">${icon("trash")}</button>
          </div>
        </article>`).join("")}</div>` : `<div class="card">${emptyState("No templates", "Save a post as a template from the editor, or create one here.", `<button class="btn btn-primary btn-sm" data-template-new>New template</button>`)}</div>`}
    `;
  }

  function templateForm(template = {}) {
    const selected = new Set(template.channels || []);
    return `<form id="template-form" class="template-form">
      <label class="field"><span>Name</span><input id="tpl-name" maxlength="80" value="${esc(template.name || "")}" placeholder="Weekly product tip" autofocus /></label>
      <div class="field-row">
        <label class="field"><span>Language</span><select id="tpl-language"><option value="en" ${template.language !== "ar" ? "selected" : ""}>English</option><option value="ar" ${template.language === "ar" ? "selected" : ""}>Arabic</option></select></label>
        <label class="field"><span>Pillar</span><select id="tpl-pillar">${(state.meta?.pillars || Object.keys(PILLAR_LABEL)).map((pillar) => `<option value="${esc(pillar)}" ${template.pillar === pillar ? "selected" : ""}>${esc(pillarLabel(pillar))}</option>`).join("")}</select></label>
      </div>
      <div class="field"><span>Default channels</span><div class="channel-picker compact">${state.connections.filter((channel) => channel.mode === "api").map((channel) => `<label class="channel-toggle ${selected.has(channel.key) ? "is-checked" : ""}"><input type="checkbox" value="${esc(channel.key)}" ${selected.has(channel.key) ? "checked" : ""} />${channelIcon(channel.key, { size: "xs" })}${esc(channel.label)}</label>`).join("")}</div></div>
      <label class="field"><span>Copy</span><textarea id="tpl-content" rows="8" dir="auto">${esc(template.content || "")}</textarea></label>
      <p class="field-error" id="tpl-error" hidden></p>
    </form>`;
  }

  function openTemplateModal(template = null, prefill = null) {
    const source = template || prefill || {};
    openModal({
      title: template ? "Edit template" : "New template",
      wide: true,
      body: templateForm(source),
      actions: [
        { label: "Cancel", className: "btn-ghost" },
        {
          label: template ? "Save template" : "Create template",
          className: "btn-primary",
          stay: true,
          onClick: async (button) => {
            const body = {
              name: $("#tpl-name").value.trim(),
              language: $("#tpl-language").value,
              pillar: $("#tpl-pillar").value,
              channels: $$("#template-form .channel-toggle input:checked").map((input) => input.value),
              content: $("#tpl-content").value,
            };
            const error = !body.name ? "Give the template a name." : !body.content.trim() ? "Write the template copy." : "";
            if (error) {
              $("#tpl-error").textContent = error;
              $("#tpl-error").hidden = false;
              return true;
            }
            try {
              await withBusy(button, async () => {
                const response = template
                  ? await api(`/api/templates/${encodeURIComponent(template.id)}`, { method: "PUT", body: jsonBody(body) })
                  : await api("/api/templates", { method: "POST", body: jsonBody(body) });
                const index = state.templates.findIndex((item) => item.id === response.template.id);
                if (index >= 0) state.templates[index] = response.template;
                else state.templates.unshift(response.template);
              });
              toast(template ? "Template saved." : "Template created.", "success");
              if (state.view === "templates") renderTemplates();
              return false;
            } catch (err) {
              $("#tpl-error").textContent = err.message;
              $("#tpl-error").hidden = false;
              return true;
            }
          },
        },
      ],
      onOpen: () => {
        $$("#template-form .channel-toggle input").forEach((input) =>
          input.addEventListener("change", () => input.closest(".channel-toggle").classList.toggle("is-checked", input.checked))
        );
        $("#tpl-language").addEventListener("change", (event) => ($("#tpl-content").dir = event.target.value === "ar" ? "rtl" : "auto"));
      },
    });
  }

  async function deleteTemplate(id) {
    const template = state.templates.find((item) => item.id === id);
    if (!template) return;
    const ok = await confirmDialog({ title: "Delete template", message: `Delete the template <strong>${esc(template.name)}</strong>? Posts created from it are not affected.`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await api(`/api/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
      state.templates = state.templates.filter((item) => item.id !== id);
      toast("Template deleted.", "success");
      renderTemplates();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  function useTemplate(id) {
    const template = state.templates.find((item) => item.id === id);
    if (!template) return;
    openEditor(null, {
      title: template.name,
      content: template.content,
      language: template.language,
      pillar: template.pillar,
      channels: template.channels,
    });
  }

  /* ------------------------------------------------------------------ *
   * Connections
   * ------------------------------------------------------------------ */

  const CAPABILITY_LABELS = [
    ["text", "Text"],
    ["image", "Image"],
    ["video", "Video"],
    ["story", "Story"],
    ["metrics", "Stats"],
  ];

  function connectionGroup(channel) {
    if (channel.mode !== "api") return "restricted";
    if (!channel.configured) return "setup";
    if (channel.verified && !channel.verified.ok) return "attention";
    if (!channel.verified) return "attention";
    return "ready";
  }

  function connectionGroupLabel(group) {
    return { ready: "Ready to publish", attention: "Needs attention", setup: "Not connected", restricted: "Can't automate" }[group] || group;
  }

  function capabilityRow(channel) {
    const caps = channel.capabilities || {};
    return `<div class="caps">${CAPABILITY_LABELS.map(([key, label]) => `<span class="cap ${caps[key] ? "on" : "off"}" title="${esc(caps[key] ? `${label}: supported` : `${label}: not available on ${channel.label}`)}">${caps[key] ? icon("check") : icon("close")}${label}</span>`).join("")}</div>`;
  }

  function ruleChips(rule) {
    if (!rule) return "";
    const chips = [];
    if (rule.dailyCap) chips.push(`<span class="chip purple">max ${rule.dailyCap}/day</span>`);
    if (rule.linkInBio) chips.push(`<span class="chip cyan">link in bio</span>`);
    if (rule.hashtags) chips.push(`<span class="chip muted" title="${esc(rule.hashtags)}">${rule.hashtags.split(" ").length} hashtags</span>`);
    return chips.join("");
  }

  function renderConnections() {
    const channels = state.connections;
    const filter = state.connectionsFilter;
    const groups = { ready: [], attention: [], setup: [], restricted: [] };
    for (const channel of channels) groups[connectionGroup(channel)].push(channel);
    const apiCount = channels.filter((channel) => channel.mode === "api").length;
    const readyPct = apiCount ? Math.round((groups.ready.length / apiCount) * 100) : 0;
    const list = filter === "all" ? [...groups.attention, ...groups.ready, ...groups.setup, ...groups.restricted] : groups[filter] || [];
    $("#view").innerHTML = `
      <div class="page-head">
        <div><span class="eyebrow">Connections</span><h2>${groups.ready.length} of ${apiCount} channels ready <small>${groups.attention.length ? `· ${groups.attention.length} need attention` : ""}</small></h2>
          <p>Connect a channel once and the scheduler posts for you. Each card shows what the channel supports and how long setup takes.</p></div>
        <div class="page-head-actions">
          <button class="btn btn-ghost" data-test-all>${icon("refresh")}Test all connected</button>
          <button class="btn btn-outline" data-apply-recommended>${icon("check")}Apply recommended rules</button>
        </div>
      </div>
      <div class="card card-pad connect-summary">
        <div class="progress-row"><div class="progress"><span style="width:${readyPct}%"></span></div><strong>${readyPct}%</strong></div>
        <div class="summary-chips">
          ${["ready", "attention", "setup", "restricted"].map((group) => `<button type="button" class="summary-chip ${group} ${filter === group ? "is-active" : ""}" data-conn-filter="${group}"><strong>${groups[group].length}</strong><span>${connectionGroupLabel(group)}</span></button>`).join("")}
          <button type="button" class="summary-chip all ${filter === "all" ? "is-active" : ""}" data-conn-filter="all"><strong>${channels.length}</strong><span>All channels</span></button>
        </div>
      </div>
      <div class="channel-grid section">
        ${list.map((channel) => {
          const group = connectionGroup(channel);
          const guide = channel.guide;
          const action = group === "setup" ? "Connect" : group === "attention" ? "Fix" : group === "ready" ? "Manage" : "Details";
          return `<article class="card channel-card group-${group}">
            <div class="channel-head">
              <div class="channel-name">${channelIcon(channel.key)}<div><strong>${esc(channel.label)}</strong><span>${esc(connectionGroupLabel(group))}</span></div></div>
              ${channelStatusChip(channel)}
            </div>
            ${group === "setup" && guide ? `<p class="effort">${icon("clock")}${esc(guide.effort)} · ${esc(guide.difficulty)} setup</p>` : ""}
            ${channel.configured && channel.verified?.detail ? `<p class="channel-verify-detail ${channel.verified.ok ? "" : "is-error"}">${esc(channel.verified.detail)}</p>` : ""}
            ${group === "restricted" ? `<p class="muted-text">${esc(channel.requirements)}</p>` : ""}
            ${channel.mode === "api" ? capabilityRow(channel) : ""}
            ${ruleChips(channel.rule) ? `<div class="chips">${ruleChips(channel.rule)}</div>` : ""}
            ${channel.configured ? `<div class="channel-metrics"><div><span>Followers</span><strong>${metricValue(channel.metrics?.followers, channel.metrics?.lastUpdated)}</strong></div><div><span>Tested</span><strong>${channel.verified?.at ? esc(relativeInstant(channel.verified.at)) : "never"}</strong></div><div><span>Planned posts</span><strong>${fmtNumber(state.posts.filter((post) => post.status === "scheduled" && post.channels.includes(channel.key)).length)}</strong></div></div>` : ""}
            <div class="channel-actions">
              ${channel.profile ? `<a class="btn btn-ghost btn-sm" href="${esc(channel.profile)}" target="_blank" rel="noopener">Profile ${icon("external")}</a>` : ""}
              ${channel.configured ? `<button class="btn btn-ghost btn-sm" data-test-channel="${esc(channel.key)}">Test</button>` : ""}
              <button class="btn ${group === "setup" || group === "attention" ? "btn-primary" : "btn-outline"} btn-sm" data-connect="${esc(channel.key)}">${action}</button>
            </div>
          </article>`;
        }).join("") || `<div class="card">${emptyState("Nothing here", "No channels in this group.")}</div>`}
      </div>
      <div class="card card-pad section"><div class="section-head"><h3>Why some channels can't be automated</h3></div><p class="prose">Hacker News, Reddit and Product Hunt don't allow unattended posting. TikTok needs an approved Content Posting app and video. YouTube needs Google OAuth, video and quota. WhatsApp is opt-in messaging, not a feed. Stories are only available through Facebook and Instagram — the other platforms have no Stories API.</p></div>
    `;
  }

  async function testChannel(key, button) {
    return withBusy(button, async () => {
      const box = $("#connect-result");
      if (box) {
        box.className = "connect-result";
        box.textContent = "Testing the saved credentials…";
      }
      try {
        const data = await api(`/api/connections/${encodeURIComponent(key)}/test`, { method: "POST", body: jsonBody({}) });
        const ok = Boolean(data.result?.ok);
        const detail = data.result?.detail || (ok ? "Connection verified." : "Connection failed.");
        if (box) {
          box.className = `connect-result ${ok ? "ok" : "error"}`;
          box.textContent = ok ? `Connected · ${detail}` : detail;
        }
        toast(`${channelLabel(key)}: ${detail}`, ok ? "success" : "error");
        const index = state.connections.findIndex((item) => item.key === key);
        if (index >= 0 && data.channel) state.connections[index] = { ...state.connections[index], ...data.channel };
        renderChrome();
        if (state.view === "connections") renderConnections();
        return ok;
      } catch (error) {
        if (box) {
          box.className = "connect-result error";
          box.textContent = error.message;
        }
        toast(error.message, "error");
        return false;
      }
    });
  }

  async function testAllConnections(button) {
    const configured = state.connections.filter((channel) => channel.configured);
    if (!configured.length) return toast("No channels are connected yet.", "error");
    await withBusy(button, async () => {
      const outcomes = await Promise.allSettled(configured.map((channel) => api(`/api/connections/${channel.key}/test`, { method: "POST", body: jsonBody({}) })));
      const failed = outcomes.filter((outcome) => outcome.status === "rejected" || !outcome.value?.result?.ok).length;
      toast(failed ? `${failed} of ${configured.length} connection tests failed.` : `All ${configured.length} connections verified.`, failed ? "error" : "success");
      await loadConnections();
    });
  }

  async function saveChannelRules(changes, { quiet = false } = {}) {
    const response = await api("/api/settings", { method: "PUT", body: jsonBody({ channelRules: changes }) });
    state.overview.settings = response.settings;
    if (!quiet) toast("Channel rules saved.", "success");
    await loadConnections();
    state.audit = null;
    return response;
  }

  async function applyRecommendedRules(button) {
    const current = state.overview?.settings?.channelRules || {};
    const changes = {};
    const details = [];
    for (const channel of state.connections.filter((item) => item.mode === "api" && item.recommendedDaily)) {
      const rule = { ...(current[channel.key] || {}) };
      const planned = state.posts.filter((post) => post.status === "scheduled" && post.channels.includes(channel.key));
      const perDay = {};
      for (const post of planned) perDay[post.scheduledAt.slice(0, 10)] = (perDay[post.scheduledAt.slice(0, 10)] || 0) + 1;
      const max = Math.max(0, ...Object.values(perDay));
      if (max > channel.recommendedDaily && !rule.dailyCap) {
        rule.dailyCap = channel.recommendedDaily;
        details.push(`${channel.label}: max ${channel.recommendedDaily}/day (now up to ${max})`);
      }
      if (channel.key === "instagram" && !rule.linkInBio) {
        rule.linkInBio = true;
        details.push("Instagram: replace links with “Link in bio”");
      }
      if (JSON.stringify(rule) !== JSON.stringify(current[channel.key] || {})) changes[channel.key] = rule;
    }
    if (!details.length) return toast("Rules already match the recommendations.", "success");
    const ok = await confirmDialog({
      title: "Apply recommended rules?",
      message: "These limits protect reach on feeds that punish over-posting. Extra posts still go to the other channels; you can change any rule later.",
      detail: `<ul class="plain-list">${details.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`,
      confirmLabel: "Apply",
    });
    if (!ok) return;
    await withBusy(button, async () => {
      try {
        await saveChannelRules(changes, { quiet: true });
        toast(`Applied ${plural(details.length, "rule")}.`, "success");
        renderView();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  }

  function fieldInput(field) {
    const placeholder = field.saved && field.secret ? "Saved — leave blank to keep" : field.example || "";
    return `<label class="field cred-field" data-field="${esc(field.key)}">
      <span>${esc(field.label)} ${field.required ? "" : `<em class="optional">optional</em>`} ${field.saved ? `<em class="saved">${icon("check")}saved</em>` : ""}</span>
      <div class="secret-input"><input type="${field.secret ? "password" : "text"}" data-env-key="${esc(field.key)}" data-pattern="${esc(field.pattern)}" value="${esc(field.value || "")}" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false" />${field.secret ? `<button type="button" class="link-btn" data-reveal>Show</button>` : ""}</div>
      ${field.help ? `<small class="field-hint">${esc(field.help)}</small>` : ""}
      <small class="field-error" hidden></small>
    </label>`;
  }

  function openChannelSetup(key, tab = "connect") {
    const channel = channelDef(key);
    if (!channel) return;
    const isApi = channel.mode === "api" && (channel.fields || []).length > 0;
    const guide = channel.guide;
    const rule = channel.rule || {};
    const links = [
      channel.console ? `<a class="btn btn-outline btn-sm" href="${esc(channel.console)}" target="_blank" rel="noopener">Open developer console ${icon("external")}</a>` : "",
      channel.docs ? `<a class="btn btn-ghost btn-sm" href="${esc(channel.docs)}" target="_blank" rel="noopener">API docs ${icon("external")}</a>` : "",
      channel.profile ? `<a class="btn btn-ghost btn-sm" href="${esc(channel.profile)}" target="_blank" rel="noopener">Live profile ${icon("external")}</a>` : "",
      !channel.configured && channel.signup ? `<a class="btn btn-ghost btn-sm" href="${esc(channel.signup)}" target="_blank" rel="noopener">Create account ${icon("external")}</a>` : "",
    ].filter(Boolean).join("");

    const connectTab = isApi
      ? `<div class="setup-grid">
          <div class="setup-steps">
            <h4>${guide ? `Setup · ${esc(guide.effort)}` : "Setup"}</h4>
            <ol class="steps">${(guide?.steps || [channel.note]).map((step) => `<li>${esc(step)}</li>`).join("")}</ol>
            <div class="connect-links">${links}</div>
            <p class="field-hint">The portal can't create accounts, accept platform terms, pass app review or type an OTP for you. Once a valid token is saved, posting is automatic.</p>
          </div>
          <form id="connect-form" class="connect-form" autocomplete="off">
            ${channel.fields.map(fieldInput).join("")}
            <div id="connect-result" class="connect-result ${channel.verified ? (channel.verified.ok ? "ok" : "error") : ""}">${channel.verified ? esc(`${channel.verified.ok ? "Connected · " : ""}${channel.verified.detail || ""}`) : "Values are stored in the portal's private .env file and never shown again."}</div>
            <div class="form-actions">
              <button type="button" class="btn btn-primary" id="connect-save">${icon("check")}Save & test</button>
              ${channel.configured ? `<button type="button" class="btn btn-outline" id="connect-test">Test again</button><button type="button" class="btn btn-danger" id="connect-remove">Disconnect</button>` : ""}
            </div>
          </form>
        </div>`
      : `<div class="connect-result error">${esc(channel.requirements)}</div><div class="connect-links">${links}</div>`;

    const rulesTab = `<form id="rules-form" class="rules-form">
        <p class="prose">Rules change what this channel receives without editing each post. They apply to previews, dry runs and real publishes.</p>
        <label class="field"><span>Maximum posts per day</span>
          <div class="inline-input"><input type="number" min="0" max="100" id="rule-cap" value="${esc(rule.dailyCap || 0)}" /><button type="button" class="link-btn" id="rule-cap-recommended">Use recommended (${channel.recommendedDaily || "—"})</button></div>
          <small class="field-hint">0 = no limit. When the limit is reached, the scheduler skips this channel for the rest of the day (other channels still publish). Posts tagged <code>#priority</code> (for example your daily videos) always go out, and publishing by hand is never limited.</small></label>
        <label class="field"><span>Standard hashtags</span><input id="rule-hashtags" value="${esc(rule.hashtags || "")}" placeholder="#fatortak #accounting #MENA" />
          <small class="field-hint">Added to the end of every post on ${esc(channel.label)} unless the post already includes them.</small></label>
        <div class="setting-row"><div><strong>Replace links with “Link in bio”</strong><span>For channels where links in captions aren't clickable (Instagram). Arabic posts use “الرابط في البايو”.</span></div><label class="switch"><input type="checkbox" id="rule-bio" ${rule.linkInBio ? "checked" : ""} /><span></span></label></div>
        <label class="field" id="rule-bio-text-wrap" ${rule.linkInBio ? "" : "hidden"}><span>Custom wording (optional)</span><input id="rule-bio-text" maxlength="60" value="${esc(rule.linkText || "")}" placeholder="Link in bio" /></label>
        <div class="form-actions"><button type="button" class="btn btn-primary" id="rules-save">${icon("check")}Save rules</button><button type="button" class="btn btn-ghost" id="rules-clear">Clear rules</button></div>
      </form>`;

    openModal({
      title: `${channel.label}`,
      wide: true,
      body: `
        <div class="connect-head">${channelIcon(channel.key)}${channelStatusChip(channel)}${channel.mode === "api" ? capabilityRow(channel) : ""}</div>
        ${channel.mode === "api" ? `<div class="segmented section-gap" role="tablist"><button type="button" data-setup-tab="connect" class="${tab === "connect" ? "is-active" : ""}">Connection</button><button type="button" data-setup-tab="rules" class="${tab === "rules" ? "is-active" : ""}">Publishing rules</button></div>` : ""}
        <div data-setup-panel="connect" ${tab === "connect" ? "" : "hidden"}>${connectTab}</div>
        ${channel.mode === "api" ? `<div data-setup-panel="rules" ${tab === "rules" ? "" : "hidden"}>${rulesTab}</div>` : ""}`,
      actions: [],
      onOpen: () => {
        $$("[data-setup-tab]").forEach((button) =>
          button.addEventListener("click", () => {
            $$("[data-setup-tab]").forEach((item) => item.classList.toggle("is-active", item === button));
            $$("[data-setup-panel]").forEach((panel) => (panel.hidden = panel.dataset.setupPanel !== button.dataset.setupTab));
          })
        );
        $$("#connect-form [data-reveal]").forEach((button) =>
          button.addEventListener("click", () => {
            const input = button.previousElementSibling;
            input.type = input.type === "password" ? "text" : "password";
            button.textContent = input.type === "password" ? "Show" : "Hide";
          })
        );
        const validateField = (input) => {
          const wrap = input.closest(".cred-field");
          const error = wrap.querySelector(".field-error");
          const pattern = input.dataset.pattern;
          const value = input.value.trim();
          const bad = value && pattern && !new RegExp(pattern).test(value);
          const field = channel.fields.find((item) => item.key === input.dataset.envKey);
          error.hidden = !bad;
          error.textContent = bad ? `This doesn't look right${field?.example ? ` — expected something like ${field.example}` : ""}.` : "";
          input.classList.toggle("is-invalid", Boolean(bad));
          return !bad;
        };
        $$("#connect-form [data-env-key]").forEach((input) => input.addEventListener("input", () => validateField(input)));
        $("#connect-save")?.addEventListener("click", async (event) => {
          const inputs = $$("#connect-form [data-env-key]");
          if (!inputs.every(validateField)) return toast("Fix the highlighted fields first.", "error");
          const values = {};
          for (const input of inputs) {
            const field = channel.fields.find((item) => item.key === input.dataset.envKey);
            const value = input.value.trim();
            if (value && !(field && !field.secret && value === (field.value || ""))) values[input.dataset.envKey] = value;
          }
          const missing = channel.fields.filter((field) => field.required && !field.saved && !values[field.key]);
          if (missing.length) return toast(`Fill in: ${missing.map((field) => field.label).join(", ")}.`, "error");
          await withBusy(event.currentTarget, async () => {
            try {
              if (Object.keys(values).length) await api(`/api/connections/${encodeURIComponent(key)}/credentials`, { method: "PUT", body: jsonBody({ values }) });
              $$("#connect-form input[type=password]").forEach((input) => (input.value = ""));
              await loadConnections();
              const ok = await testChannel(key, null);
              if (ok) {
                finishModal(null);
                toast(`${channel.label} is connected and verified.`, "success");
              }
            } catch (error) {
              const box = $("#connect-result");
              if (box) {
                box.className = "connect-result error";
                box.textContent = error.message;
              }
              toast(error.message, "error");
            }
          });
        });
        $("#connect-test")?.addEventListener("click", (event) => testChannel(key, event.currentTarget));
        $("#connect-remove")?.addEventListener("click", async () => {
          finishModal(null);
          const ok = await confirmDialog({
            title: `Disconnect ${channel.label}?`,
            message: `This removes the saved ${channel.label} credentials from the portal. Scheduled posts will skip ${channel.label} until you connect it again. Nothing is deleted on ${channel.label}.`,
            confirmLabel: "Disconnect",
            danger: true,
          });
          if (!ok) return;
          try {
            await api(`/api/connections/${encodeURIComponent(key)}/credentials`, { method: "DELETE" });
            toast(`${channel.label} disconnected.`, "success");
            await loadConnections();
          } catch (error) {
            toast(error.message, "error");
          }
        });
        $("#rule-bio")?.addEventListener("change", (event) => ($("#rule-bio-text-wrap").hidden = !event.target.checked));
        $("#rule-cap-recommended")?.addEventListener("click", () => ($("#rule-cap").value = channel.recommendedDaily || 0));
        $("#rules-save")?.addEventListener("click", (event) =>
          withBusy(event.currentTarget, async () => {
            try {
              await saveChannelRules({ [key]: { dailyCap: Number($("#rule-cap").value || 0), hashtags: $("#rule-hashtags").value, linkInBio: $("#rule-bio").checked, linkText: $("#rule-bio-text").value } });
              finishModal(null);
            } catch (error) {
              toast(error.message, "error");
            }
          })
        );
        $("#rules-clear")?.addEventListener("click", async () => {
          try {
            await saveChannelRules({ [key]: {} });
            finishModal(null);
          } catch (error) {
            toast(error.message, "error");
          }
        });
      },
    });
  }

  /* ------------------------------------------------------------------ *
   * Automations
   * ------------------------------------------------------------------ */

  const EVENT_LABEL = {
    before: "Before a post publishes",
    published: "After a post publishes",
    scheduled: "When a post is scheduled",
  };

  const AUTOMATION_PRESETS = [
    {
      key: "story-live",
      title: "Share every new post as a Story",
      text: "When a post goes live, share its image or video as a Facebook and Instagram Story.",
      rule: { name: "Story when a post goes live", trigger: { event: "published", minutes: 5 }, filter: {}, actions: [{ type: "story", channels: ["facebook", "instagram"], media: "post" }] },
    },
    {
      key: "teaser",
      title: "Tease launches 1 hour before",
      text: "For posts tagged #launch: a Story plus a short teaser on X, Bluesky and Mastodon an hour before.",
      rule: { name: "Launch teaser", trigger: { event: "before", minutes: 60 }, filter: { tags: ["launch"] }, actions: [{ type: "story", channels: ["facebook", "instagram"], media: "post" }, { type: "post", channels: ["x", "bluesky", "mastodon"], media: "none", text: "Coming up at {{time}} (Cairo): {{title}}" }] },
    },
    {
      key: "offer",
      title: "Announce new offers everywhere",
      text: "When a post tagged #offer is scheduled, share a Story and announce it on Telegram, X and LinkedIn right away.",
      rule: { name: "New offer announcement", trigger: { event: "scheduled", minutes: 0 }, filter: { tags: ["offer"] }, actions: [{ type: "story", channels: ["facebook", "instagram"], media: "post" }, { type: "post", channels: ["telegram", "x", "linkedin"], media: "post", text: "New offer: {{excerpt}}\n\n{{pricing}}" }] },
    },
    {
      key: "follow-up",
      title: "Next-day follow-up",
      text: "A day after a #launch post goes out, remind followers who missed it.",
      rule: { name: "Next-day reminder", trigger: { event: "published", minutes: 1440 }, filter: { tags: ["launch"] }, actions: [{ type: "post", channels: ["x", "bluesky", "mastodon"], media: "none", text: "In case you missed it: {{title}}\n\n{{site}}" }] },
    },
  ];

  function durationText(minutes) {
    const m = Number(minutes || 0);
    if (!m) return "";
    if (m % 1440 === 0) return plural(m / 1440, "day");
    if (m % 60 === 0) return plural(m / 60, "hour");
    return plural(m, "minute");
  }

  function automationSentence(rule) {
    const t = rule.trigger || {};
    const f = rule.filter || {};
    const when = t.event === "before"
      ? `${durationText(t.minutes)} before`
      : t.event === "published"
        ? t.minutes ? `${durationText(t.minutes)} after` : "As soon as"
        : t.minutes ? `${durationText(t.minutes)} after` : "As soon as";
    const what = [
      f.language ? (f.language === "ar" ? "Arabic" : "English") : "",
      "post",
      f.tags?.length ? `tagged ${f.tags.map((tag) => `#${tag}`).join(" or ")}` : "",
      f.pillars?.length ? `in ${f.pillars.map(pillarLabel).join(" / ")}` : "",
      f.channels?.length ? `going to ${f.channels.map(channelLabel).join(" / ")}` : "",
      f.keyword ? `mentioning “${f.keyword}”` : "",
    ].filter(Boolean).join(" ");
    const verb = t.event === "scheduled" ? "is scheduled" : t.event === "before" ? "publishes" : "publishes";
    const actions = (rule.actions || []).map((action) =>
      action.type === "story" ? `share a Story on ${action.channels.map(channelLabel).join(" & ")}` : `post on ${action.channels.map(channelLabel).join(", ")}`
    );
    const article = /^[AEIOU]/i.test(what) ? "an" : "a";
    return `${when} ${t.event === "before" ? `${article} ${what}` : `${article} ${what}`} ${verb}, ${actions.join(" and ")}.`;
  }

  async function loadAutomations() {
    state.automations = await api("/api/automations");
    return state.automations;
  }

  function automationTabs() {
    const ruleCount = state.overview?.comments?.rules || 0;
    return `<div class="segmented section-gap" role="tablist" aria-label="Automation type">
      <button type="button" class="${state.autoTab === "posts" ? "is-active" : ""}" data-auto-tab="posts">${icon("bolt")}Post automations</button>
      <button type="button" class="${state.autoTab === "comments" ? "is-active" : ""}" data-auto-tab="comments">${icon("story")}Comment → DM<em>${ruleCount || ""}</em></button>
    </div>`;
  }

  async function renderAutomations() {
    const tab = parseHash().params.get("tab");
    if (tab === "comments" || tab === "posts") state.autoTab = tab;
    if (state.autoTab === "comments") {
      $("#view").innerHTML = `<div class="page-head"><div><span class="eyebrow">Automations</span><h2>Comment → DM rules</h2><p>Answer common comments automatically: send a private message and, if you like, a short public reply.</p></div></div>${automationTabs()}<div class="card card-pad"><div class="skeleton" style="width:40%"></div></div>`;
      const html = await renderCommentRules();
      if (state.view !== "automations" || state.autoTab !== "comments") return;
      $("#view").innerHTML = `<div class="page-head"><div><span class="eyebrow">Automations</span><h2>Comment → DM rules <small>${plural((state.commentRules?.rules || []).filter((rule) => rule.enabled).length, "active rule")}</small></h2><p>Answer common comments automatically: send a private message and, if you like, a short public reply.</p></div><div class="page-head-actions"><button class="btn btn-primary" data-crule-new>${icon("plus")}New comment rule</button></div></div>${automationTabs()}${html}`;
      return;
    }
    if (!state.automations) {
      $("#view").innerHTML = `<div class="card card-pad"><div class="skeleton" style="width:30%"></div><div class="skeleton" style="width:70%;margin-top:14px"></div></div>`;
      try {
        await loadAutomations();
      } catch (error) {
        $("#view").innerHTML = `<div class="card">${emptyState("Automations unavailable", error.message)}</div>`;
        return;
      }
      if (state.view !== "automations") return;
    }
    const data = state.automations;
    const rules = data.automations || [];
    const runs = data.runs || [];
    $("#view").innerHTML = `
      <div class="page-head">
        <div><span class="eyebrow">Automations</span><h2>${plural(rules.filter((rule) => rule.enabled).length, "active rule")} <small>of ${rules.length}</small></h2><p>Share Stories, teasers, offers and follow-ups automatically around your posts.</p></div>
        <div class="page-head-actions"><button class="btn btn-primary" data-auto-new>${icon("plus")}New automation</button></div>
      </div>
      ${automationTabs()}
      <div class="alert ${data.live ? "lime" : "amber"}">${icon(data.live ? "bolt" : "info")}<div><strong>${data.live ? "Automations are running" : "Automations are paused while the portal is in dry run"}</strong><span>${data.live ? "Rules are checked every minute together with the scheduler." : "Use Test to see exactly what a rule would do. They start running when live publishing and the scheduler are on."}</span></div></div>
      <div class="inline-alert info-note">${icon("story")}<span><strong>Stories</strong> can be published to Facebook and Instagram only — no other platform offers a Stories API. For X, LinkedIn, Bluesky, Mastodon, Threads, Telegram and Discord use a <strong>Post</strong> action (teaser, announcement or follow-up).</span></div>
      ${rules.length ? `<div class="auto-list section">${rules.map((rule) => `
        <article class="card auto-card ${rule.enabled ? "" : "is-paused"}">
          <label class="switch" title="${rule.enabled ? "Pause" : "Turn on"}"><input type="checkbox" data-auto-toggle="${esc(rule.id)}" ${rule.enabled ? "checked" : ""} /><span></span></label>
          <div class="auto-main">
            <strong>${esc(rule.name)}</strong>
            <p>${esc(automationSentence(rule))}</p>
            <div class="chips">${rule.actions.map((action) => `<span class="chip ${action.type === "story" ? "purple" : "cyan"}">${action.type === "story" ? "Story" : "Post"} · ${action.channels.map(channelLabel).join(", ")}</span>`).join("")}<span class="chip muted">${rule.runCount ? `ran ${plural(rule.runCount, "time")} · last ${esc(relativeInstant(rule.lastRunAt))}` : "not run yet"}</span></div>
          </div>
          <div class="auto-actions">
            <button class="btn btn-outline btn-sm" data-auto-test="${esc(rule.id)}">${icon("play")}Test</button>
            <button class="btn btn-ghost btn-sm" data-auto-edit="${esc(rule.id)}">Edit</button>
            <button class="icon-btn sm" data-auto-more="${esc(rule.id)}" aria-label="More" aria-haspopup="menu">${icon("more")}</button>
          </div>
        </article>`).join("")}</div>` : ""}
      <div class="section">
        <div class="section-head"><h3>${rules.length ? "Add from a recipe" : "Start from a recipe"}</h3></div>
        <div class="preset-grid">${AUTOMATION_PRESETS.map((preset) => `<button type="button" class="card preset" data-auto-preset="${preset.key}"><strong>${esc(preset.title)}</strong><span>${esc(preset.text)}</span></button>`).join("")}</div>
      </div>
      <div class="card card-pad section">
        <div class="section-head"><h3>Recent runs</h3><span>${plural(runs.length, "run")}</span></div>
        ${runs.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Automation</th><th>Post</th><th>Result</th></tr></thead><tbody>${runs.slice(0, 30).map((run, index) => `
          <tr><td>${esc(fmtInstant(run.at))}</td><td>${esc(run.ruleName)}</td><td><button class="link-btn" data-edit="${esc(run.postId)}">${esc(run.postTitle)}</button></td>
          <td><button class="link-btn" data-auto-run-detail="${index}">${run.ok}/${run.total} succeeded</button></td></tr>`).join("")}</tbody></table></div>` : emptyState("No runs yet", "Runs appear here once a rule fires.")}
      </div>
    `;
  }

  function outcomesTable(outcomes) {
    return `<div class="result-list">${outcomes.map((outcome) => {
      const label = outcome.dryRun ? (outcome.ok ? "Would run" : "Would skip") : outcome.ok ? "Done" : outcome.skipped ? "Skipped" : "Failed";
      const cls = outcome.dryRun ? (outcome.ok ? "scheduled" : "blocked") : outcome.ok ? "published" : outcome.skipped ? "blocked" : "failed";
      return `<div class="result-row">
        <div class="result-channel">${channelIcon(outcome.channel, { size: "xs" })}<strong>${esc(channelLabel(outcome.channel))}</strong><span class="chip ${outcome.type === "story" ? "purple" : "cyan"}">${outcome.type === "story" ? "Story" : "Post"}</span></div>
        <span class="status ${cls}">${esc(label)}</span>
        <p class="result-detail">${esc(outcome.reason || outcome.error || outcome.url || (outcome.id ? `id: ${outcome.id}` : ""))}${outcome.text ? `<br><span class="quote" dir="auto">${esc(outcome.text)}</span>` : ""}</p>
      </div>`;
    }).join("")}</div>`;
  }

  async function testAutomation(id, { live = false } = {}) {
    const rule = state.automations?.automations.find((item) => item.id === id);
    if (!rule) return;
    if (live) {
      if (!state.overview?.live) return toast("Live publishing is locked (MARKETING_LIVE=false).", "error");
      const ok = await confirmDialog({ title: "Run now?", message: `Run <strong>${esc(rule.name)}</strong> for real on the next matching post. Stories and posts are published immediately.`, confirmLabel: "Run now", danger: true });
      if (!ok) return;
    }
    try {
      const result = await api(`/api/automations/${encodeURIComponent(id)}/${live ? "run" : "test"}`, { method: "POST", body: jsonBody({}) });
      openModal({
        title: `${live ? "Ran" : "Test"} · ${rule.name}`,
        wide: true,
        body: `<p class="prose">${live ? "Ran on" : "Simulated on"} <strong dir="auto">${esc(result.post.title)}</strong> (${esc(fmtWall(result.post.scheduledAt))}). ${plural(result.matching, "post")} currently match this rule.${live ? "" : " Nothing was sent."}</p>${outcomesTable(result.outcomes)}`,
        actions: [{ label: "Close", className: "btn-ghost" }],
      });
      if (live) {
        state.automations = null;
        renderAutomations();
      }
    } catch (error) {
      toast(error.message, "error");
    }
  }

  function automationForm(rule) {
    const t = rule.trigger || { event: "published", minutes: 0 };
    const unit = !t.minutes ? 1 : t.minutes % 1440 === 0 ? 1440 : t.minutes % 60 === 0 ? 60 : 1;
    const f = rule.filter || {};
    const pillars = state.meta?.pillars || Object.keys(PILLAR_LABEL);
    return `<form id="auto-form" class="auto-form">
      <p class="auto-sentence" id="auto-sentence"></p>
      <label class="field"><span>Name</span><input id="auto-name" maxlength="80" value="${esc(rule.name || "")}" placeholder="Offer story" autofocus /></label>
      <fieldset class="auto-step"><legend><b>1</b> When</legend>
        <div class="field-row">
          <label class="field"><span>Trigger</span><select id="auto-event">${Object.entries(EVENT_LABEL).map(([key, label]) => `<option value="${key}" ${t.event === key ? "selected" : ""}>${label}</option>`).join("")}</select></label>
          <label class="field"><span id="auto-delay-label">Timing</span><div class="inline-input"><input type="number" min="0" id="auto-amount" value="${t.minutes ? t.minutes / unit : 0}" /><select id="auto-unit"><option value="1" ${unit === 1 ? "selected" : ""}>minutes</option><option value="60" ${unit === 60 ? "selected" : ""}>hours</option><option value="1440" ${unit === 1440 ? "selected" : ""}>days</option></select></div></label>
        </div>
      </fieldset>
      <fieldset class="auto-step"><legend><b>2</b> Which posts <em>(leave empty for all posts)</em></legend>
        <div class="field-row">
          <label class="field"><span>Tags</span><input id="auto-tags" list="tag-options" value="${esc((f.tags || []).join(", "))}" placeholder="offer, launch" /></label>
          <label class="field"><span>Language</span><select id="auto-lang"><option value="">Any</option><option value="en" ${f.language === "en" ? "selected" : ""}>English</option><option value="ar" ${f.language === "ar" ? "selected" : ""}>Arabic</option></select></label>
        </div>
        <div class="field"><span>Pillars</span><div class="chip-picker" id="auto-pillars">${pillars.map((pillar) => `<label class="pick ${f.pillars?.includes(pillar) ? "is-checked" : ""}"><input type="checkbox" value="${esc(pillar)}" ${f.pillars?.includes(pillar) ? "checked" : ""} />${esc(pillarLabel(pillar))}</label>`).join("")}</div></div>
        <label class="field"><span>Text contains</span><input id="auto-keyword" value="${esc(f.keyword || "")}" placeholder="e.g. discount" /></label>
      </fieldset>
      <fieldset class="auto-step"><legend><b>3</b> Then</legend>
        <div id="auto-actions"></div>
        <div class="form-actions"><button type="button" class="btn btn-ghost btn-sm" data-add-action="story">${icon("story")}Add Story</button><button type="button" class="btn btn-ghost btn-sm" data-add-action="post">${icon("send")}Add Post</button></div>
      </fieldset>
      <p class="field-error" id="auto-error" hidden></p>
    </form>`;
  }

  function actionEditor(action, index) {
    const story = action.type === "story";
    const channels = state.connections.filter((channel) => channel.mode === "api" && channel.key !== "devto");
    return `<div class="action-card" data-action-index="${index}">
      <div class="action-head">
        <div class="segmented"><button type="button" class="${story ? "is-active" : ""}" data-action-type="story">${icon("story")}Story</button><button type="button" class="${story ? "" : "is-active"}" data-action-type="post">${icon("send")}Post</button></div>
        <button type="button" class="icon-btn sm danger" data-action-remove aria-label="Remove action">${icon("trash")}</button>
      </div>
      <div class="channel-picker compact">${channels.map((channel) => {
        const allowed = !story || channel.capabilities?.story;
        const checked = action.channels.includes(channel.key);
        return `<label class="channel-toggle ${checked ? "is-checked" : ""} ${allowed ? "" : "is-disabled"}" title="${allowed ? (channel.configured ? "Connected" : "Not connected yet — will be skipped") : `${channel.label} has no Stories API`}"><input type="checkbox" value="${esc(channel.key)}" ${checked ? "checked" : ""} ${allowed ? "" : "disabled"} />${channelIcon(channel.key, { size: "xs" })}<span>${esc(channel.label)}</span><i class="readiness ${channel.configured ? "ready" : "setup"}"></i></label>`;
      }).join("")}</div>
      <div class="field-row">
        <label class="field"><span>Media</span><select data-action-media>
          <option value="post" ${action.media === "post" ? "selected" : ""}>The post's image or video</option>
          <option value="poster" ${action.media === "poster" ? "selected" : ""}>Video cover image (if the post is a video)</option>
          ${story ? "" : `<option value="none" ${action.media === "none" ? "selected" : ""}>No media (text only)</option>`}
        </select></label>
      </div>
      ${story ? `<p class="field-hint">Stories show the image or video only — platforms don't allow captions or link stickers through their API.</p>` : `
        <label class="field"><span>Text</span><textarea rows="3" data-action-text dir="auto" placeholder="Coming up at {{time}}: {{title}}">${esc(action.text || "")}</textarea></label>
        <div class="editor-toolbar flat"><span>Insert</span>${["{{title}}", "{{excerpt}}", "{{time}}", "{{date}}", "{{site}}", "{{pricing}}"].map((token) => `<button type="button" class="token-btn" data-action-token="${token}">${token}</button>`).join("")}</div>`}
    </div>`;
  }

  function openAutomationModal(existing = null, preset = null) {
    const draft = JSON.parse(JSON.stringify(existing || preset || { name: "", trigger: { event: "published", minutes: 0 }, filter: {}, actions: [{ type: "story", channels: ["facebook", "instagram"], media: "post" }] }));
    const readForm = () => {
      const unit = Number($("#auto-unit").value);
      draft.name = $("#auto-name").value.trim();
      draft.trigger = { event: $("#auto-event").value, minutes: Math.round(Number($("#auto-amount").value || 0) * unit) };
      draft.filter = {
        tags: $("#auto-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
        language: $("#auto-lang").value,
        pillars: $$("#auto-pillars input:checked").map((input) => input.value),
        keyword: $("#auto-keyword").value.trim(),
      };
      $$("#auto-actions .action-card").forEach((card) => {
        const action = draft.actions[Number(card.dataset.actionIndex)];
        action.channels = $$(".channel-picker input:checked", card).map((input) => input.value);
        action.media = $("[data-action-media]", card).value;
        const text = $("[data-action-text]", card);
        if (text) action.text = text.value;
      });
      return draft;
    };
    const renderActions = () => {
      $("#auto-actions").innerHTML = draft.actions.map(actionEditor).join("") || `<p class="field-hint">Add at least one action.</p>`;
      updateSentence();
    };
    const updateSentence = () => {
      readForm();
      $("#auto-sentence").textContent = draft.actions.length && draft.actions.every((action) => action.channels.length) ? automationSentence(draft) : "Pick when it runs, which posts, and what to share.";
      $("#auto-delay-label").textContent = draft.trigger.event === "before" ? "How long before" : "Delay (0 = right away)";
    };
    openModal({
      title: existing ? "Edit automation" : "New automation",
      wide: true,
      body: automationForm(draft),
      actions: [
        { label: "Cancel", className: "btn-ghost" },
        {
          label: existing ? "Save" : "Create automation",
          className: "btn-primary",
          stay: true,
          onClick: async (button) => {
            readForm();
            try {
              await withBusy(button, async () => {
                const body = { ...draft, enabled: existing ? existing.enabled : true };
                if (existing) await api(`/api/automations/${encodeURIComponent(existing.id)}`, { method: "PUT", body: jsonBody(body) });
                else await api("/api/automations", { method: "POST", body: jsonBody(body) });
              });
              toast(existing ? "Automation saved." : "Automation created. Use Test to preview it.", "success");
              state.automations = null;
              if (state.view === "automations") renderAutomations();
              return false;
            } catch (error) {
              $("#auto-error").textContent = error.message;
              $("#auto-error").hidden = false;
              return true;
            }
          },
        },
      ],
      onOpen: () => {
        renderActions();
        const form = $("#auto-form");
        form.addEventListener("input", updateSentence);
        form.addEventListener("change", (event) => {
          const pick = event.target.closest(".pick, .channel-toggle");
          if (pick) pick.classList.toggle("is-checked", event.target.checked);
          updateSentence();
        });
        form.addEventListener("click", (event) => {
          const add = event.target.closest("[data-add-action]");
          if (add) {
            readForm();
            draft.actions.push(add.dataset.addAction === "story" ? { type: "story", channels: ["facebook", "instagram"], media: "post" } : { type: "post", channels: [], media: "none", text: "" });
            renderActions();
          }
          const card = event.target.closest(".action-card");
          if (!card) return;
          const index = Number(card.dataset.actionIndex);
          if (event.target.closest("[data-action-remove]")) {
            readForm();
            draft.actions.splice(index, 1);
            renderActions();
          }
          const type = event.target.closest("[data-action-type]");
          if (type) {
            readForm();
            const action = draft.actions[index];
            action.type = type.dataset.actionType;
            if (action.type === "story") {
              action.channels = action.channels.filter((key) => ["facebook", "instagram"].includes(key));
              if (!action.channels.length) action.channels = ["facebook", "instagram"];
              if (action.media === "none") action.media = "post";
            }
            renderActions();
          }
          const token = event.target.closest("[data-action-token]");
          if (token) {
            const textarea = $("[data-action-text]", card);
            insertAtCursor(textarea, token.dataset.actionToken);
          }
        });
      },
    });
  }

  function automationMenu(anchor, id) {
    const rule = state.automations?.automations.find((item) => item.id === id);
    if (!rule) return;
    openMenu(anchor, [
      { label: "Test (dry run)", icon: "play", onClick: () => testAutomation(id) },
      { label: "Run now on next post…", icon: "bolt", disabled: !state.overview?.live, hint: state.overview?.live ? "" : "live locked", onClick: () => testAutomation(id, { live: true }) },
      { label: "Duplicate", icon: "copy", onClick: () => openAutomationModal(null, { ...rule, name: `${rule.name} (copy)` }) },
      { divider: true },
      {
        label: "Delete",
        icon: "trash",
        danger: true,
        onClick: async () => {
          const ok = await confirmDialog({ title: "Delete automation", message: `Delete <strong>${esc(rule.name)}</strong>? Past runs stay in the log.`, confirmLabel: "Delete", danger: true });
          if (!ok) return;
          try {
            await api(`/api/automations/${encodeURIComponent(id)}`, { method: "DELETE" });
            toast("Automation deleted.", "success");
            state.automations = null;
            renderAutomations();
          } catch (error) {
            toast(error.message, "error");
          }
        },
      },
    ]);
  }

  async function toggleAutomation(id, enabled) {
    const rule = state.automations?.automations.find((item) => item.id === id);
    if (!rule) return;
    try {
      await api(`/api/automations/${encodeURIComponent(id)}`, { method: "PUT", body: jsonBody({ ...rule, enabled }) });
      rule.enabled = enabled;
      toast(enabled ? `“${rule.name}” is on.` : `“${rule.name}” is paused.`, "success");
      renderAutomations();
    } catch (error) {
      toast(error.message, "error");
      renderAutomations();
    }
  }

  /* ------------------------------------------------------------------ *
   * Content health
   * ------------------------------------------------------------------ */

  const ISSUE_LABEL = {
    repeat: "Repeated message",
    "ig-link": "Link in Instagram caption",
    "no-hashtags": "No hashtags",
    "too-long": "Too long for a channel",
    "no-media": "No media",
    "no-alt": "No alt text",
    "no-cta": "No call to action",
  };

  async function renderHealth() {
    if (!state.audit) {
      $("#view").innerHTML = `<div class="card card-pad"><div class="skeleton" style="width:30%"></div><div class="skeleton" style="width:70%;margin-top:14px"></div></div>`;
      try {
        state.audit = await api("/api/content/audit");
      } catch (error) {
        $("#view").innerHTML = `<div class="card">${emptyState("Content audit unavailable", error.message)}</div>`;
        return;
      }
      if (state.view !== "health") return;
    }
    const audit = state.audit;
    const tone = audit.score >= 80 ? "lime" : audit.score >= 60 ? "amber" : "rose";
    const flagged = Object.entries(audit.issues || {})
      .map(([id, issues]) => ({ post: state.posts.find((post) => post.id === id), issues }))
      .filter((item) => item.post)
      .sort((a, b) => b.issues.filter((i) => i.level === "error").length - a.issues.filter((i) => i.level === "error").length || b.issues.filter((i) => i.level === "warn").length - a.issues.filter((i) => i.level === "warn").length || String(a.post.scheduledAt).localeCompare(String(b.post.scheduledAt)));
    const totalMix = Math.max(1, Object.values(audit.pillarMix || {}).reduce((sum, n) => sum + n, 0));
    const actionFor = (code, item = {}) => ({
      caps: `<button class="btn btn-primary btn-sm" data-apply-recommended>Apply recommended caps</button>`,
      "link-in-bio": `<button class="btn btn-primary btn-sm" data-rules="instagram">Set up Instagram rules</button>`,
      hashtags: (item.channels || ["Instagram", "LinkedIn"]).map((label) => {
        const channel = state.connections.find((entry) => entry.label === label);
        return channel ? `<button class="btn btn-outline btn-sm" data-rules="${esc(channel.key)}">${esc(label)} hashtags</button>` : "";
      }).join(" "),
      repeat: `<button class="btn btn-ghost btn-sm" data-health-filter="repeat">Show posts</button>`,
      "too-long": `<button class="btn btn-ghost btn-sm" data-health-filter="too-long">Show posts</button>`,
    }[code] || "");
    const issueFilter = state.healthFilter || "";
    const shown = issueFilter ? flagged.filter((item) => item.issues.some((issue) => issue.code === issueFilter)) : flagged;

    $("#view").innerHTML = `
      <div class="page-head">
        <div><span class="eyebrow">Content health</span><h2>${plural(audit.upcoming, "upcoming post")} checked</h2><p>Checks the queue for what hurts reach: repeated copy, over-posting, links Instagram can't open, missing hashtags and posts that are too long.</p></div>
        <div class="page-head-actions"><button class="btn btn-ghost" data-health-refresh>${icon("refresh")}Re-check</button></div>
      </div>
      <div class="health-top">
        <div class="card score-card ${tone}"><div class="score-ring" style="--score:${audit.score}"><strong>${audit.score}</strong><span>/ 100</span></div><div><strong>${audit.score >= 80 ? "Healthy" : audit.score >= 60 ? "Needs work" : "At risk"}</strong><span>${fmtNumber(audit.counts.error)} errors · ${fmtNumber(audit.counts.warn)} warnings · ${fmtNumber(audit.counts.info)} tips</span><span>${fmtNumber(audit.uniqueMessages)} unique messages · ${fmtNumber(audit.questions)} posts ask a question</span></div></div>
        <div class="card card-pad suggestions">
          <div class="section-head"><h3>What to fix first</h3></div>
          ${audit.suggestions.length ? audit.suggestions.map((item) => `<div class="suggestion">${icon("alert")}<p>${esc(item.text)}</p><div>${actionFor(item.code, item)}</div></div>`).join("") : emptyState("Looking good", "No major issues in the upcoming queue.")}
        </div>
      </div>
      <div class="section two-col">
        <div class="card">
          <div class="card-pad pb-0"><div class="section-head"><h3>Posts per day by channel</h3><span>scheduled</span></div></div>
          <div class="table-wrap"><table><thead><tr><th>Channel</th><th class="num">Avg</th><th class="num">Busiest day</th><th class="num">Recommended</th><th>Cap</th><th></th></tr></thead><tbody>
            ${audit.volume.map((row) => `<tr><td><div class="channel-name">${channelIcon(row.channel, { size: "xs" })}<strong>${esc(row.label)}</strong></div></td><td class="num">${row.avgPerDay}</td><td class="num ${row.over ? "text-rose" : ""}">${row.maxPerDay}</td><td class="num">${row.recommended || "—"}</td><td>${row.cap ? `<span class="chip purple">max ${row.cap}</span>` : `<span class="muted">none</span>`}</td><td><button class="link-btn" data-rules="${esc(row.channel)}">${row.cap ? "Edit" : "Set cap"}</button></td></tr>`).join("") || `<tr><td colspan="6" class="muted">Nothing scheduled.</td></tr>`}
          </tbody></table></div>
        </div>
        <div class="card card-pad">
          <div class="section-head"><h3>Mix</h3><span>upcoming</span></div>
          <div class="lang-split"><span style="width:${((audit.languageMix.en || 0) / totalMix) * 100}%">EN ${fmtNumber(audit.languageMix.en || 0)}</span><span style="width:${((audit.languageMix.ar || 0) / totalMix) * 100}%">AR ${fmtNumber(audit.languageMix.ar || 0)}</span></div>
          <div class="bar-chart" style="margin-top:14px">${Object.entries(audit.pillarMix || {}).sort((a, b) => b[1] - a[1]).map(([pillar, count]) => `<div class="bar-row"><label>${esc(pillarLabel(pillar))}</label><div class="bar-track"><div class="bar-fill" style="width:${Math.round((count / totalMix) * 100)}%"></div></div><strong>${Math.round((count / totalMix) * 100)}%</strong></div>`).join("")}</div>
        </div>
      </div>
      <div class="card section">
        <div class="card-pad pb-0"><div class="section-head"><h3>Posts with issues</h3>
          <select id="health-filter" aria-label="Issue type"><option value="">All issues (${flagged.length})</option>${Object.entries(audit.byCode || {}).map(([code, count]) => `<option value="${esc(code)}" ${issueFilter === code ? "selected" : ""}>${esc(ISSUE_LABEL[code] || code)} (${count})</option>`).join("")}</select></div></div>
        ${shown.length ? `<div class="issue-list">${shown.slice(0, 60).map(({ post, issues }) => `
          <div class="issue-row">
            <div class="issue-post"><button class="title-link" data-edit="${esc(post.id)}" dir="auto">${esc(post.title)}</button><span>${esc(fmtWall(post.scheduledAt, { year: false }))} · ${esc(String(post.language).toUpperCase())} · ${statusChip(post.status)}</span></div>
            <ul>${issues.filter((issue) => !issueFilter || issue.code === issueFilter).map((issue) => `<li class="lvl-${issue.level}">${esc(issue.message)}</li>`).join("")}</ul>
          </div>`).join("")}</div>${shown.length > 60 ? `<p class="field-hint card-pad">Showing 60 of ${shown.length}.</p>` : ""}` : emptyState("No issues", "Nothing flagged for this filter.")}
      </div>
    `;
  }

  /* ------------------------------------------------------------------ *
   * Trash
   * ------------------------------------------------------------------ */

  async function renderTrash() {
    if (!state.trash) {
      $("#view").innerHTML = `<div class="card card-pad"><div class="skeleton" style="width:30%"></div></div>`;
      try {
        state.trash = (await api("/api/trash")).items || [];
      } catch (error) {
        $("#view").innerHTML = `<div class="card">${emptyState("Trash unavailable", error.message)}</div>`;
        return;
      }
      if (state.view !== "trash") return;
    }
    const items = state.trash;
    $("#view").innerHTML = `
      <div class="page-head">
        <div><span class="eyebrow">Trash</span><h2>${plural(items.length, "deleted post")}</h2><p>Deleted posts stay here for 30 days. Restored posts come back as drafts so nothing publishes by surprise.</p></div>
        <div class="page-head-actions"><a class="btn btn-ghost" href="#/content">Back to content</a>${items.length ? `<button class="btn btn-danger" data-trash-empty>${icon("trash")}Empty trash</button>` : ""}</div>
      </div>
      <div class="card">${items.length ? `<div class="table-wrap"><table><thead><tr><th>Post</th><th>Was</th><th>Deleted</th><th></th></tr></thead><tbody>
        ${items.map((item) => `<tr><td><div class="cell-title"><strong dir="auto">${esc(item.post.title)}</strong><span>${esc(fmtWall(item.post.scheduledAt, { year: false }))} · ${esc(String(item.post.language || "en").toUpperCase())}</span></div></td><td>${statusChip(item.post.status)}</td><td>${esc(relativeInstant(item.deletedAt))}</td>
          <td class="col-actions"><div class="row-actions"><button class="btn btn-outline btn-sm" data-trash-restore="${esc(item.post.id)}">Restore</button><button class="icon-btn sm danger" data-trash-delete="${esc(item.post.id)}" title="Delete forever" aria-label="Delete forever">${icon("trash")}</button></div></td></tr>`).join("")}
      </tbody></table></div>` : emptyState("Trash is empty", "Deleted posts appear here for 30 days.")}</div>
    `;
  }

  async function trashAction(kind, id) {
    try {
      if (kind === "restore") {
        const result = await api(`/api/trash/${encodeURIComponent(id)}/restore`, { method: "POST", body: jsonBody({}) });
        toast(`Restored “${result.post.title}” as a draft.`, "success", { action: { label: "Open", onClick: () => openEditor(state.posts.find((post) => post.id === result.post.id) || result.post) } });
      } else if (kind === "delete") {
        const ok = await confirmDialog({ title: "Delete forever?", message: "This post can't be recovered afterwards.", confirmLabel: "Delete forever", danger: true });
        if (!ok) return;
        await api(`/api/trash/${encodeURIComponent(id)}`, { method: "DELETE" });
        toast("Deleted forever.", "success");
      } else if (kind === "empty") {
        const ok = await confirmDialog({ title: "Empty trash?", message: `Permanently delete ${plural(state.trash.length, "post")}? This can't be undone.`, confirmLabel: "Empty trash", danger: true });
        if (!ok) return;
        await api("/api/trash", { method: "DELETE" });
        toast("Trash emptied.", "success");
      }
      state.trash = null;
      await loadPosts();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  /* ------------------------------------------------------------------ *
   * Inbox (comments) and comment → DM rules
   * ------------------------------------------------------------------ */

  const ENGAGE_TOKENS = ["{{first_name}}", "{{name}}", "{{keyword}}", "{{post}}", "{{site}}", "{{pricing}}", "{{demo}}"];

  const COMMENT_RULE_PRESETS = [
    {
      key: "price",
      title: "“Price” → send pricing",
      text: "Anyone who comments price / السعر / بكام gets your plans by DM and a public “check your DMs”.",
      rule: { name: "Pricing by DM", channels: ["instagram", "facebook"], keywords: ["price", "prices", "pricing", "السعر", "سعر", "بكام", "الاسعار"], mode: "any", dm: "Hi {{first_name}} 👋 Thanks for asking! Here are our plans: {{pricing}}", reply: "Sent you the details by DM 📩" },
    },
    {
      key: "link",
      title: "“Link” → send the link",
      text: "Comment LINK (or لينك / الرابط) to receive the link privately — great with “comment LINK” posts.",
      rule: { name: "Link by DM", channels: ["instagram", "facebook"], keywords: ["link", "لينك", "الرابط", "رابط"], mode: "any", dm: "Here you go {{first_name}}: {{site}}", reply: "Check your DMs 📩" },
    },
    {
      key: "demo",
      title: "“Demo” → book a demo",
      text: "Comments asking for a demo get the booking link by DM.",
      rule: { name: "Demo by DM", channels: ["instagram", "facebook", "bluesky", "mastodon"], keywords: ["demo", "trial", "تجربة", "ديمو"], mode: "any", dm: "Hi {{first_name}}, happy to show you Fatortak! Book a demo here: {{demo}}", reply: "" },
    },
  ];

  async function loadInbox() {
    const v = state.inboxView;
    const params = new URLSearchParams({ status: v.status, limit: String(v.limit), offset: String(v.offset) });
    if (v.channel) params.set("channel", v.channel);
    if (v.q) params.set("q", v.q);
    const [inbox, saved] = await Promise.all([api(`/api/comments?${params}`), state.savedReplies ? Promise.resolve({ items: state.savedReplies }) : api("/api/saved-replies")]);
    state.inbox = inbox;
    state.savedReplies = saved.items || [];
    return inbox;
  }

  function initials(name) {
    return String(name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
  }

  async function renderInbox() {
    if (!state.inbox) {
      $("#view").innerHTML = `<div class="card card-pad"><div class="skeleton" style="width:30%"></div><div class="skeleton" style="width:80%;margin-top:14px"></div></div>`;
      try {
        await loadInbox();
      } catch (error) {
        $("#view").innerHTML = `<div class="card">${emptyState("Inbox unavailable", error.message)}</div>`;
        return;
      }
      if (state.view !== "inbox") return;
    }
    const data = state.inbox;
    const v = state.inboxView;
    const counts = data.counts || {};
    const selected = state.inboxSelected;
    const tabs = [["open", "Open", (counts.new || 0) + (counts.read || 0)], ["new", "New", counts.new || 0], ["replied", "Replied", counts.replied || 0], ["archived", "Archived", counts.archived || 0], ["", "All", counts.total || 0]];
    const pages = Math.max(1, Math.ceil(data.total / v.limit));
    const page = Math.floor(v.offset / v.limit) + 1;
    $("#view").innerHTML = `
      <div class="page-head">
        <div><span class="eyebrow">Inbox</span><h2>${plural(counts.new || 0, "new comment")} <small>${data.syncedAt ? `· synced ${esc(relativeInstant(data.syncedAt))}` : "· not synced yet"}</small></h2><p>Comments on your published posts, in one place. Reply publicly or send a private message without opening each app.</p></div>
        <div class="page-head-actions">
          <a class="btn btn-ghost" href="#/automations?tab=comments">${icon("bolt")}Comment → DM rules</a>
          <button class="btn btn-primary" data-inbox-sync>${icon("refresh")}Sync comments</button>
        </div>
      </div>
      ${data.live ? "" : `<div class="alert amber">${icon("info")}<div><strong>Replies and DMs are locked</strong><span>Comments still sync. Rule DMs go out once live publishing is on (MARKETING_LIVE=true and dry run off).</span></div></div>`}
      <div class="engage-support">
        ${data.channels.map((channel) => `<span class="support-chip ${channel.configured ? "on" : "off"}" title="${esc(channel.note)}">${channelIcon(channel.key, { size: "xs" })}${esc(channelLabel(channel.key))}<em>${channel.configured ? "comments + DM" : "not connected"}</em></span>`).join("")}
        ${data.unsupported.map((channel) => `<span class="support-chip off" title="${esc(channel.note)}">${channelIcon(channel.key, { size: "xs" })}${esc(channelLabel(channel.key))}<em>not available</em></span>`).join("")}
      </div>
      <div class="tabs" role="tablist">${tabs.map(([key, label, count]) => `<button type="button" class="tab ${v.status === key ? "is-active" : ""}" data-inbox-tab="${key}">${label}<em>${fmtNumber(count)}</em></button>`).join("")}</div>
      <div class="card toolbar">
        <div class="search"><svg><use href="#i-search"></use></svg><input id="inbox-q" type="search" placeholder="Search comments or people…" value="${esc(v.q)}" aria-label="Search comments" /></div>
        <select id="inbox-channel" aria-label="Channel"><option value="">All channels</option>${data.channels.map((channel) => `<option value="${esc(channel.key)}" ${v.channel === channel.key ? "selected" : ""}>${esc(channelLabel(channel.key))}</option>`).join("")}</select>
        ${selected.size ? `<span class="foot-spacer"></span><strong class="sel-count">${selected.size} selected</strong><button class="btn btn-ghost btn-sm" data-inbox-bulk="read">Mark read</button><button class="btn btn-ghost btn-sm" data-inbox-bulk="archived">Archive</button><button class="icon-btn sm" data-inbox-bulk="clear" aria-label="Clear selection">${icon("close")}</button>` : ""}
      </div>
      ${data.items.length ? `<div class="inbox-list">${data.items.map((comment) => commentCard(comment)).join("")}</div>
        ${data.total > v.limit ? `<div class="pager card"><span>Page ${page} / ${pages}</span><span class="foot-spacer"></span><button class="icon-btn sm" data-inbox-page="prev" ${page <= 1 ? "disabled" : ""}>‹</button><button class="icon-btn sm" data-inbox-page="next" ${page >= pages ? "disabled" : ""}>›</button></div>` : ""}`
        : `<div class="card">${emptyState(counts.total ? "Nothing here" : "No comments yet", counts.total ? "Try another tab or clear the search." : "Press Sync comments after your posts get replies. Facebook, Instagram, Bluesky and Mastodon are supported.")}</div>`}
    `;
  }

  function commentCard(comment) {
    const selected = state.inboxSelected.has(comment.id);
    const windowNote = comment.dmWindowEndsAt && !comment.dm
      ? Date.parse(comment.dmWindowEndsAt) > Date.now() ? `DM possible until ${fmtInstant(comment.dmWindowEndsAt, { time: false })}` : "DM window closed (7 days)"
      : "";
    return `<article class="card comment-card status-${esc(comment.status)} ${selected ? "is-selected" : ""}" data-comment="${esc(comment.id)}">
      <input type="checkbox" class="comment-check" data-comment-select="${esc(comment.id)}" ${selected ? "checked" : ""} aria-label="Select comment" />
      <div class="avatar" aria-hidden="true">${esc(initials(comment.author?.name))}</div>
      <div class="comment-main">
        <div class="comment-meta">
          <strong dir="auto">${esc(comment.author?.name || "Unknown")}</strong>
          ${comment.author?.handle ? `<span>@${esc(comment.author.handle)}</span>` : ""}
          ${channelIcon(comment.channel, { size: "xs" })}
          <span>${esc(relativeInstant(comment.createdAt))}</span>
          ${comment.status === "new" ? `<span class="chip blue-chip">new</span>` : ""}
        </div>
        <p class="comment-text" dir="auto">${esc(comment.text)}</p>
        <div class="comment-context">
          ${comment.postId ? `<button class="link-btn" data-edit="${esc(comment.postId)}" dir="auto">On: ${esc(comment.postTitle || "post")}</button>` : ""}
          ${comment.matches.map((match) => `<span class="chip purple" title="Keyword: ${esc(match.keyword)}">${icon("bolt")}${esc(match.name)}${match.ran ? ` · ${match.ran.dm?.ok || match.ran.reply?.ok ? "sent" : "failed"}` : " · waiting"}</span>`).join("")}
          ${comment.dm ? `<span class="chip lime">DM sent ${esc(relativeInstant(comment.dm.at))}</span>` : windowNote ? `<span class="chip muted">${esc(windowNote)}</span>` : ""}
        </div>
        ${(comment.replies || []).length ? `<div class="reply-thread">${comment.replies.map((reply) => `<p dir="auto"><b>You</b> ${esc(reply.text)} <span>${esc(relativeInstant(reply.at))}</span></p>`).join("")}</div>` : ""}
        ${comment.dm ? `<div class="reply-thread dm"><p dir="auto"><b>DM</b> ${esc(comment.dm.text)}</p></div>` : ""}
        <div class="composer" data-composer="${esc(comment.id)}" hidden></div>
      </div>
      <div class="comment-actions">
        <button class="btn btn-ghost btn-sm" data-comment-reply="${esc(comment.id)}">${icon("send")}Reply</button>
        <button class="btn btn-ghost btn-sm" data-comment-dm="${esc(comment.id)}" ${comment.dmAllowed ? "" : "disabled"} title="${comment.dmAllowed ? "Send a private message" : comment.dm ? "Already sent a DM" : "DMs aren't possible for this comment"}">${icon("story")}DM</button>
        <button class="icon-btn sm" data-comment-more="${esc(comment.id)}" aria-label="More" aria-haspopup="menu">${icon("more")}</button>
      </div>
    </article>`;
  }

  function findComment(id) {
    return state.inbox?.items.find((item) => item.id === id) || null;
  }

  function openComposer(id, mode) {
    const comment = findComment(id);
    if (!comment) return;
    $$(".composer").forEach((box) => {
      if (box.dataset.composer !== id) {
        box.hidden = true;
        box.innerHTML = "";
      }
    });
    const box = $(`[data-composer="${CSS.escape(id)}"]`);
    if (!box) return;
    const dm = mode === "dm";
    box.hidden = false;
    box.innerHTML = `
      <div class="composer-head"><strong>${dm ? `Private message to ${esc(comment.author?.name || "")}` : "Public reply"}</strong>${dm && comment.dmWindowEndsAt ? `<span class="field-hint">Meta allows one private reply within 7 days.</span>` : ""}</div>
      <textarea rows="3" dir="auto" data-composer-text placeholder="${dm ? "Hi {{first_name}}, here are the details…" : "Thanks for the comment!"}"></textarea>
      <div class="composer-tools">
        <div class="editor-toolbar flat">${ENGAGE_TOKENS.slice(0, 4).map((token) => `<button type="button" class="token-btn" data-composer-token="${token}">${token}</button>`).join("")}</div>
        <span class="foot-spacer"></span>
        <button type="button" class="btn btn-ghost btn-sm" data-saved-menu>Saved replies ▾</button>
        <button type="button" class="btn btn-ghost btn-sm" data-composer-cancel>Cancel</button>
        <button type="button" class="btn btn-primary btn-sm" data-composer-send="${dm ? "dm" : "reply"}" ${state.inbox?.live ? "" : "disabled title=\"Live publishing is locked\""}>${icon("send")}${dm ? "Send DM" : "Reply"}</button>
      </div>`;
    box.querySelector("textarea").focus();
  }

  async function sendComposer(id, kind, button) {
    const box = $(`[data-composer="${CSS.escape(id)}"]`);
    const text = box?.querySelector("[data-composer-text]").value.trim();
    if (!text) return toast("Write a message first.", "error");
    await withBusy(button, async () => {
      try {
        await api(`/api/comments/${encodeURIComponent(id)}/${kind}`, { method: "POST", body: jsonBody({ text }) });
        toast(kind === "dm" ? "DM sent." : "Reply posted.", "success");
        state.inbox = null;
        await renderInbox();
        loadPosts().catch(() => {});
      } catch (error) {
        toast(error.message, "error");
      }
    });
  }

  async function setCommentStatus(ids, status) {
    try {
      if (ids.length === 1) await api(`/api/comments/${encodeURIComponent(ids[0])}`, { method: "PUT", body: jsonBody({ status }) });
      else await api("/api/comments/bulk", { method: "POST", body: jsonBody({ ids, status }) });
      state.inboxSelected.clear();
      state.inbox = null;
      await renderInbox();
      refreshInboxBadge();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  function refreshInboxBadge() {
    api("/api/overview").then((overview) => {
      state.overview = overview;
      renderChrome();
    }).catch(() => {});
  }

  function commentMenu(anchor, id) {
    const comment = findComment(id);
    if (!comment) return;
    openMenu(anchor, [
      comment.status !== "read" ? { label: "Mark as read", icon: "check", onClick: () => setCommentStatus([id], "read") } : { label: "Mark as new", icon: "info", onClick: () => setCommentStatus([id], "new") },
      { label: "Mark as replied", icon: "send", onClick: () => setCommentStatus([id], "replied") },
      comment.status !== "archived" ? { label: "Archive", icon: "trash", onClick: () => setCommentStatus([id], "archived") } : { label: "Move back to inbox", icon: "refresh", onClick: () => setCommentStatus([id], "read") },
      { divider: true },
      comment.url ? { label: "Open on platform", icon: "external", onClick: () => window.open(comment.url, "_blank", "noopener") } : null,
      { label: "Create a rule from this comment", icon: "bolt", onClick: () => openCommentRuleModal(null, { name: `Reply to “${comment.text.slice(0, 20)}”`, channels: [comment.channel], keywords: comment.text.split(/\s+/).filter((word) => word.length > 2).slice(0, 2), mode: "any", dm: "", reply: "" }) },
    ]);
  }

  function savedRepliesMenu(anchor, textarea) {
    const items = state.savedReplies || [];
    openMenu(anchor, [
      ...(items.length ? items.map((item) => ({ label: item.title, onClick: () => insertAtCursor(textarea, item.text) })) : [{ label: "No saved replies yet", disabled: true }]),
      { divider: true },
      {
        label: "Save current text…",
        icon: "plus",
        disabled: !textarea.value.trim(),
        onClick: async () => {
          const title = await promptDialog({ title: "Save reply", label: "Name", value: textarea.value.trim().slice(0, 40), confirmLabel: "Save" });
          if (!title) return;
          try {
            const result = await api("/api/saved-replies", { method: "POST", body: jsonBody({ title, text: textarea.value.trim() }) });
            state.savedReplies = [result.item, ...(state.savedReplies || [])];
            toast("Saved reply added.", "success");
          } catch (error) {
            toast(error.message, "error");
          }
        },
      },
    ]);
  }

  async function syncInbox(button) {
    await withBusy(button, async () => {
      try {
        const result = await api("/api/comments/sync", { method: "POST", body: jsonBody({}) });
        toast(`${plural(result.new || 0, "new comment")}${result.sent ? ` · ${result.sent} rule replies sent` : ""}${result.pendingDryRun ? ` · ${result.pendingDryRun} waiting for live mode` : ""}.`, "success");
        if (result.warnings?.length) openModal({ title: "Sync warnings", body: `<ul class="plain-list">${result.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>`, actions: [{ label: "Close", className: "btn-ghost" }] });
        state.inbox = null;
        await renderInbox();
        refreshInboxBadge();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  }

  /* Comment → DM rules (shown as a tab on the Automations page) */

  async function loadCommentRules() {
    state.commentRules = await api("/api/comment-rules");
    return state.commentRules;
  }

  function commentRuleSentence(rule) {
    const words = rule.matchAll ? "any comment" : `a comment ${rule.mode === "exact" ? "that is exactly" : rule.mode === "all" ? "containing all of" : "containing"} ${rule.keywords.map((keyword) => `“${keyword}”`).join(rule.mode === "all" ? " and " : " or ")}`;
    const where = rule.channels.map(channelLabel).join(" or ");
    const actions = [rule.dm?.trim() ? "send them a DM" : "", rule.reply?.trim() ? "reply publicly" : ""].filter(Boolean).join(" and ");
    return `When someone leaves ${words} on ${where}${rule.filter?.tags?.length ? ` (posts tagged ${rule.filter.tags.map((tag) => `#${tag}`).join(", ")})` : ""}, ${actions}${rule.oncePerPerson ? " — once per person" : ""}.`;
  }

  async function renderCommentRules() {
    if (!state.commentRules) {
      try {
        await loadCommentRules();
      } catch (error) {
        return `<div class="card">${emptyState("Rules unavailable", error.message)}</div>`;
      }
    }
    const data = state.commentRules;
    const rules = data.rules || [];
    return `
      <div class="inline-alert info-note">${icon("info")}<span>DMs to commenters work on <strong>Facebook and Instagram</strong> (official “private reply”, needs Meta messaging permission, within 7 days, one per comment), <strong>Bluesky</strong> (app password with DM access) and <strong>Mastodon</strong> (direct post). X, LinkedIn and Threads have no API for this.</span></div>
      ${rules.length ? `<div class="auto-list section">${rules.map((rule) => `
        <article class="card auto-card ${rule.enabled ? "" : "is-paused"}">
          <label class="switch" title="${rule.enabled ? "Pause" : "Turn on"}"><input type="checkbox" data-crule-toggle="${esc(rule.id)}" ${rule.enabled ? "checked" : ""} /><span></span></label>
          <div class="auto-main">
            <strong>${esc(rule.name)}</strong>
            <p>${esc(commentRuleSentence(rule))}</p>
            <div class="chips">${rule.dm ? `<span class="chip purple" dir="auto" title="${esc(rule.dm)}">DM: ${esc(rule.dm.slice(0, 50))}${rule.dm.length > 50 ? "…" : ""}</span>` : ""}${rule.reply ? `<span class="chip cyan" dir="auto">Reply: ${esc(rule.reply.slice(0, 40))}</span>` : ""}<span class="chip muted">${fmtNumber(rule.stats?.matched || 0)} matched · ${fmtNumber(rule.stats?.sent || 0)} sent${rule.stats?.failed ? ` · ${fmtNumber(rule.stats.failed)} failed` : ""}</span></div>
          </div>
          <div class="auto-actions">
            <button class="btn btn-outline btn-sm" data-crule-test="${esc(rule.id)}">${icon("play")}Test</button>
            <button class="btn btn-ghost btn-sm" data-crule-edit="${esc(rule.id)}">Edit</button>
            <button class="icon-btn sm danger" data-crule-delete="${esc(rule.id)}" aria-label="Delete rule">${icon("trash")}</button>
          </div>
        </article>`).join("")}</div>` : ""}
      <div class="section">
        <div class="section-head"><h3>${rules.length ? "Add from a recipe" : "Start from a recipe"}</h3><button class="btn btn-primary btn-sm" data-crule-new>${icon("plus")}New comment rule</button></div>
        <div class="preset-grid">${COMMENT_RULE_PRESETS.map((preset) => `<button type="button" class="card preset" data-crule-preset="${preset.key}"><strong>${esc(preset.title)}</strong><span>${esc(preset.text)}</span></button>`).join("")}</div>
      </div>`;
  }

  function openCommentRuleModal(existing = null, preset = null) {
    const rule = existing || preset || { name: "", channels: ["instagram", "facebook"], keywords: [], mode: "any", dm: "", reply: "", oncePerPerson: true, markReplied: true };
    const engageChannels = ["facebook", "instagram", "bluesky", "mastodon"];
    openModal({
      title: existing ? "Edit comment rule" : "New comment rule",
      wide: true,
      body: `<form id="crule-form" class="auto-form">
        <p class="auto-sentence" id="crule-sentence"></p>
        <label class="field"><span>Name</span><input id="crule-name" maxlength="80" value="${esc(rule.name || "")}" placeholder="Pricing by DM" autofocus /></label>
        <fieldset class="auto-step"><legend><b>1</b> When someone comments on</legend>
          <div class="channel-picker compact" id="crule-channels">${state.connections.filter((channel) => channel.mode === "api" && channel.key !== "devto").map((channel) => {
            const ok = engageChannels.includes(channel.key);
            const checked = (rule.channels || []).includes(channel.key);
            return `<label class="channel-toggle ${checked ? "is-checked" : ""} ${ok ? "" : "is-disabled"}" title="${ok ? (channel.configured ? "Connected" : "Not connected yet") : `${channel.label}: no comment/DM API`}"><input type="checkbox" value="${esc(channel.key)}" ${checked ? "checked" : ""} ${ok ? "" : "disabled"} />${channelIcon(channel.key, { size: "xs" })}<span>${esc(channel.label)}</span></label>`;
          }).join("")}</div>
          <label class="field" style="margin-top:10px"><span>Only on posts tagged (optional)</span><input id="crule-tags" list="tag-options" value="${esc((rule.filter?.tags || []).join(", "))}" placeholder="offer, launch" /></label>
        </fieldset>
        <fieldset class="auto-step"><legend><b>2</b> And the comment</legend>
          <div class="field-row">
            <label class="field"><span>Match</span><select id="crule-mode"><option value="any" ${rule.mode === "any" && !rule.matchAll ? "selected" : ""}>contains any keyword</option><option value="all" ${rule.mode === "all" ? "selected" : ""}>contains all keywords</option><option value="exact" ${rule.mode === "exact" ? "selected" : ""}>is exactly a keyword</option><option value="every" ${rule.matchAll ? "selected" : ""}>every comment</option></select></label>
            <label class="field" id="crule-keywords-wrap"><span>Keywords (comma separated, Arabic or English)</span><input id="crule-keywords" dir="auto" value="${esc((rule.keywords || []).join(", "))}" placeholder="price, السعر, بكام" /></label>
          </div>
          <p class="field-hint">Matching ignores capital letters, Arabic diacritics and elongation (ـ), and different alef/yaa forms. Keywords match whole words.</p>
        </fieldset>
        <fieldset class="auto-step"><legend><b>3</b> Then</legend>
          <label class="field"><span>Send this DM</span><textarea id="crule-dm" rows="3" dir="auto" placeholder="Hi {{first_name}}! Here are our plans: {{pricing}}">${esc(rule.dm || "")}</textarea></label>
          <div class="editor-toolbar flat">${ENGAGE_TOKENS.map((token) => `<button type="button" class="token-btn" data-crule-token="crule-dm" data-token="${token}">${token}</button>`).join("")}</div>
          <label class="field" style="margin-top:10px"><span>And reply publicly (optional)</span><input id="crule-reply" dir="auto" value="${esc(rule.reply || "")}" placeholder="Sent you a DM 📩" /></label>
          <div class="chips">${["Sent you a DM 📩", "Check your messages 📩", "تم إرسال التفاصيل في الرسائل 📩"].map((text) => `<button type="button" class="chip pick-chip" data-crule-reply-preset="${esc(text)}" dir="auto">${esc(text)}</button>`).join("")}</div>
          <div class="setting-row"><div><strong>Once per person</strong><span>Don't DM the same person twice for this rule.</span></div><label class="switch"><input type="checkbox" id="crule-once" ${rule.oncePerPerson !== false ? "checked" : ""} /><span></span></label></div>
          <div class="setting-row"><div><strong>Mark as replied</strong><span>Move handled comments out of “New”.</span></div><label class="switch"><input type="checkbox" id="crule-mark" ${rule.markReplied !== false ? "checked" : ""} /><span></span></label></div>
        </fieldset>
        <p class="field-error" id="crule-error" hidden></p>
      </form>`,
      actions: [
        { label: "Cancel", className: "btn-ghost" },
        {
          label: existing ? "Save" : "Create rule",
          className: "btn-primary",
          stay: true,
          onClick: async (button) => {
            const body = readCommentRuleForm();
            try {
              await withBusy(button, async () => {
                if (existing) await api(`/api/comment-rules/${encodeURIComponent(existing.id)}`, { method: "PUT", body: jsonBody({ ...body, enabled: existing.enabled }) });
                else await api("/api/comment-rules", { method: "POST", body: jsonBody(body) });
              });
              toast(existing ? "Rule saved." : "Rule created. Use Test to try a comment.", "success");
              state.commentRules = null;
              if (state.view === "automations") renderAutomations();
              return false;
            } catch (error) {
              $("#crule-error").textContent = error.message;
              $("#crule-error").hidden = false;
              return true;
            }
          },
        },
      ],
      onOpen: () => {
        const update = () => {
          const body = readCommentRuleForm();
          $("#crule-keywords-wrap").hidden = body.matchAll;
          $("#crule-sentence").textContent = body.channels.length && (body.matchAll || body.keywords.length) && (body.dm || body.reply) ? commentRuleSentence(body) : "Pick channels, keywords and what to send.";
        };
        const form = $("#crule-form");
        form.addEventListener("input", update);
        form.addEventListener("change", (event) => {
          event.target.closest(".channel-toggle")?.classList.toggle("is-checked", event.target.checked);
          update();
        });
        form.addEventListener("click", (event) => {
          const token = event.target.closest("[data-crule-token]");
          if (token) insertAtCursor($(`#${token.dataset.cruleToken}`), token.dataset.token);
          const preset = event.target.closest("[data-crule-reply-preset]");
          if (preset) {
            $("#crule-reply").value = preset.dataset.cruleReplyPreset;
            update();
          }
        });
        update();
      },
    });
  }

  function readCommentRuleForm() {
    const mode = $("#crule-mode").value;
    return {
      name: $("#crule-name").value.trim(),
      channels: $$("#crule-channels input:checked").map((input) => input.value),
      keywords: $("#crule-keywords").value.split(",").map((keyword) => keyword.trim()).filter(Boolean),
      mode: mode === "every" ? "any" : mode,
      matchAll: mode === "every",
      filter: { tags: $("#crule-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean) },
      dm: $("#crule-dm").value,
      reply: $("#crule-reply").value,
      oncePerPerson: $("#crule-once").checked,
      markReplied: $("#crule-mark").checked,
    };
  }

  function testCommentRule(id) {
    const rule = state.commentRules?.rules.find((item) => item.id === id);
    if (!rule) return;
    openModal({
      title: `Test · ${rule.name}`,
      wide: true,
      body: `<p class="prose">Type a comment as a follower would. Nothing is sent.</p>
        <div class="field-row"><label class="field"><span>Comment</span><input id="ctest-text" dir="auto" value="${esc(rule.keywords[0] ? `How much is the ${rule.keywords[0]}?` : "Nice post!")}" autofocus /></label>
        <label class="field"><span>Channel</span><select id="ctest-channel">${rule.channels.map((key) => `<option value="${esc(key)}">${esc(channelLabel(key))}</option>`).join("")}</select></label></div>
        <label class="field"><span>Commenter name</span><input id="ctest-name" value="Sara Ahmed" /></label>
        <div id="ctest-result" class="ctest-result"></div>`,
      actions: [{ label: "Close", className: "btn-ghost" }],
      onOpen: () => {
        const run = debounce(async () => {
          try {
            const result = await api(`/api/comment-rules/${encodeURIComponent(id)}/test`, { method: "POST", body: jsonBody({ text: $("#ctest-text").value, channel: $("#ctest-channel").value, name: $("#ctest-name").value }) });
            $("#ctest-result").innerHTML = result.match
              ? `<div class="connect-result ok">Matches${result.keyword ? ` on “${esc(result.keyword)}”` : ""}.</div>${result.dm ? `<div class="bubble dm"><span>DM</span><p dir="auto">${esc(result.dm)}</p></div>` : ""}${result.reply ? `<div class="bubble"><span>Public reply</span><p dir="auto">${esc(result.reply)}</p></div>` : ""}`
              : `<div class="connect-result">No match — this comment would be left for you to answer.</div>`;
          } catch (error) {
            $("#ctest-result").innerHTML = `<div class="connect-result error">${esc(error.message)}</div>`;
          }
        }, 250);
        ["#ctest-text", "#ctest-channel", "#ctest-name"].forEach((selector) => $(selector).addEventListener("input", run));
        $("#ctest-channel").addEventListener("change", run);
        run();
      },
    });
  }

  async function commentRuleAction(kind, id, enabled) {
    const rule = state.commentRules?.rules.find((item) => item.id === id);
    if (!rule) return;
    try {
      if (kind === "toggle") {
        await api(`/api/comment-rules/${encodeURIComponent(id)}`, { method: "PUT", body: jsonBody({ ...rule, enabled }) });
        toast(enabled ? `“${rule.name}” is on.` : `“${rule.name}” is paused.`, "success");
      } else if (kind === "delete") {
        const ok = await confirmDialog({ title: "Delete comment rule", message: `Delete <strong>${esc(rule.name)}</strong>?`, confirmLabel: "Delete", danger: true });
        if (!ok) return;
        await api(`/api/comment-rules/${encodeURIComponent(id)}`, { method: "DELETE" });
        toast("Rule deleted.", "success");
      }
      state.commentRules = null;
      renderAutomations();
    } catch (error) {
      toast(error.message, "error");
    }
  }
  /* ------------------------------------------------------------------ *
   * Analytics and reports
   * ------------------------------------------------------------------ */

  function metricCell(metrics, key) {
    const value = metricValue(metrics?.[key], metrics?.lastUpdated);
    const scope = metrics?.windows?.[key];
    return scope && value !== "—" ? `<span class="has-tip" title="${esc(scope)}">${value}</span>` : value;
  }

  function delta(value) {
    if (value === null || value === undefined) return `<span class="muted">—</span>`;
    if (value === 0) return `<span class="muted">0</span>`;
    return `<span class="${value > 0 ? "text-lime" : "text-rose"}">${value > 0 ? "+" : ""}${fmtNumber(value)}</span>`;
  }

  function followerSparkline(series, channel = null) {
    const points = (series || []).map((entry) => (channel ? entry.followers[channel] : Object.values(entry.followers).reduce((sum, n) => sum + n, 0))).filter((n) => Number.isFinite(n));
    if (points.length < 2) return `<p class="field-hint">Follower history starts with the first metrics sync; the trend appears after two days of data.</p>`;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = Math.max(1, max - min);
    const w = 600;
    const h = 90;
    const coords = points.map((n, i) => `${(i / (points.length - 1)) * w},${h - ((n - min) / span) * (h - 10) - 5}`).join(" ");
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Followers over ${points.length} days, from ${fmtNumber(points[0])} to ${fmtNumber(points.at(-1))}"><polyline points="${coords}" /></svg>
      <div class="spark-legend"><span>${esc(series[0].date)}</span><span>${fmtNumber(points[0])} → <strong>${fmtNumber(points.at(-1))}</strong></span><span>${esc(series.at(-1).date)}</span></div>`;
  }

  function renderAnalytics() {
    const o = state.overview;
    const metrics = o.metrics?.channels || {};
    const totals = o.metrics?.totals || {};
    const growth = o.metrics?.growth || { channels: {} };
    const traffic = o.traffic || {};
    const channels = state.connections;
    const withData = channels.filter((channel) => metrics[channel.key]?.lastUpdated && metrics[channel.key]?.followers !== null);
    const maxFollowers = Math.max(1, ...withData.map((channel) => Number(metrics[channel.key]?.followers || 0)));
    const maxSource = Math.max(1, ...(traffic.sources || []).map((item) => Number(item.visitors || 0)));
    const firstParty = traffic.provider === "first-party";
    const lastSync = channels.map((channel) => metrics[channel.key]?.lastUpdated).filter(Boolean).sort().pop();
    const growth7 = Object.values(growth.channels || {}).reduce((sum, row) => (row.d7 === null ? sum : (sum ?? 0) + row.d7), null);

    $("#view").innerHTML = `
      <div class="page-head">
        <div><span class="eyebrow">Analytics</span><h2>Channel performance</h2><p>Numbers come straight from each platform's API. A dash means the platform doesn't provide that number or the channel isn't connected — never a guessed zero. Hover a number to see exactly what it covers.${lastSync ? ` Last sync ${esc(relativeInstant(lastSync))}.` : ""}</p></div>
        <div class="page-head-actions"><button class="btn btn-primary" data-sync-metrics>${icon("refresh")}Sync metrics</button></div>
      </div>
      <div class="grid metric-grid">
        <div class="card metric-card"><span>Followers</span><strong>${totals.available?.followers ? fmtNumber(totals.followers) : "—"}</strong><em>${plural(totals.available?.followers || 0, "channel")}${growth7 !== null ? ` · ${delta(growth7)} in 7 days` : ""}</em></div>
        <div class="card metric-card"><span>Reach</span><strong>${totals.available?.reach ? fmtNumber(totals.reach) : "—"}</strong><em class="has-tip" title="Each platform measures reach over a different window; see the table.">sum of ${plural(totals.available?.reach || 0, "channel")} · windows differ</em></div>
        <div class="card metric-card"><span>Engagement</span><strong>${totals.available?.engagement ? fmtNumber(totals.engagement) : "—"}</strong><em class="has-tip" title="Likes, comments, reposts and clicks over each platform's own window; see the table.">sum of ${plural(totals.available?.engagement || 0, "channel")} · windows differ</em></div>
        <div class="card metric-card"><span>Landing visitors · 30d</span><strong>${traffic.configured && !traffic.error ? fmtNumber(traffic.visitors) : "—"}</strong><em>${traffic.configured ? (firstParty ? "first-party counter" : "Plausible") : "not connected"}</em></div>
      </div>
      <div class="section two-col">
        <div class="card card-pad">
          <div class="section-head"><h3>Followers over time</h3><span>${growth.days ? `${plural(growth.days, "day")} of history` : "no history yet"}</span></div>
          ${followerSparkline(growth.series)}
          ${withData.length ? `<div class="bar-chart" style="margin-top:14px">${withData.sort((a, b) => Number(metrics[b.key]?.followers || 0) - Number(metrics[a.key]?.followers || 0)).map((channel) => {
            const followers = Number(metrics[channel.key]?.followers || 0);
            return `<div class="bar-row"><label>${channelIcon(channel.key, { size: "xs" })}${esc(channel.label)}</label><div class="bar-track"><div class="bar-fill" style="width:${Math.round((followers / maxFollowers) * 100)}%"></div></div><strong>${fmtNumber(followers)}</strong></div>`;
          }).join("")}</div>` : emptyState("No channel data yet", "Connect a channel and run Sync metrics.")}
        </div>
        <div class="card card-pad">
          <div class="section-head"><h3>Landing traffic</h3><span>${traffic.configured ? (firstParty ? "First-party · 30 days" : "Plausible · 30 days") : "not connected"}</span></div>
          ${traffic.configured && !traffic.error ? `
            <div class="mini-stats"><div><span>Visitors</span><strong>${fmtNumber(traffic.visitors)}</strong></div><div><span>Pageviews</span><strong>${fmtNumber(traffic.pageviews)}</strong></div><div><span>Bounce</span><strong>${firstParty || !traffic.bounceRate ? "—" : `${fmtNumber(traffic.bounceRate)}%`}</strong></div></div>
            ${firstParty ? `<p class="field-hint" style="margin-top:8px">Visitors are counted once per day per device (cookie-less), so the 30-day figure can count a returning person more than once. Bounce rate isn't measured by the first-party counter.</p>` : ""}
            ${(traffic.sources || []).length ? `<div class="section-head" style="margin-top:18px"><h3 class="h-sm">By source</h3><span>UTM</span></div><div class="bar-chart">${traffic.sources.slice(0, 8).map((source) => `<div class="bar-row"><label>${esc(source.source)}</label><div class="bar-track"><div class="bar-fill cyan" style="width:${Math.round((Number(source.visitors || 0) / maxSource) * 100)}%"></div></div><strong>${fmtNumber(source.visitors)}</strong></div>`).join("")}</div>` : ""}`
            : emptyState(traffic.error ? "Traffic sync failed" : "Connect analytics", traffic.error || "Deploy stats.php on the landing page or set PLAUSIBLE_SITE_ID and PLAUSIBLE_API_KEY.")}
        </div>
      </div>
      <div class="card section"><div class="table-wrap"><table><thead><tr><th>Channel</th><th>Status</th><th class="num">Followers</th><th class="num">7 days</th><th class="num">30 days</th><th class="num">Reach</th><th class="num">Engagement</th><th class="num">Clicks</th><th class="num">Posts</th><th>Last sync</th></tr></thead><tbody>
        ${channels.filter((channel) => channel.mode === "api" || metrics[channel.key]?.lastUpdated).map((channel) => {
          const m = metrics[channel.key] || {};
          const g = growth.channels?.[channel.key] || {};
          return `<tr><td><div class="channel-name">${channelIcon(channel.key)}<div><strong>${esc(channel.label)}</strong><span class="truncate" title="${esc(m.note || "")}">${esc(m.note || channel.mode)}</span></div></div></td><td>${channelStatusChip(channel)}</td><td class="num">${metricCell(m, "followers")}</td><td class="num">${delta(g.d7)}</td><td class="num">${delta(g.d30)}</td><td class="num">${metricCell(m, "reach")}</td><td class="num">${metricCell(m, "engagement")}</td><td class="num">${metricCell(m, "clicks")}</td><td class="num">${metricCell(m, "posts")}</td><td>${m.lastUpdated ? esc(relativeInstant(m.lastUpdated)) : "—"}</td></tr>`;
        }).join("")}
      </tbody></table></div>
      <div class="card-pad"><p class="field-hint">Hover a number with a dotted underline to see its window (for example, Instagram reach covers the last 28 days and Bluesky engagement the latest 30 posts). Facebook reach adds up per-post unique viewers, so someone who saw two posts counts twice.</p></div></div>
    `;
  }

  async function syncMetrics(button) {
    await withBusy(button, async () => {
      try {
        toast("Syncing metrics from connected platforms…");
        const result = await api("/api/metrics/sync", { method: "POST", body: jsonBody({}) });
        const warnings = result.warnings || [];
        toast(`Synced ${plural(result.synced?.length || 0, "channel")}${warnings.length ? ` · ${plural(warnings.length, "warning")}` : ""}.`, "success");
        if (warnings.length) {
          openModal({ title: "Sync warnings", body: `<ul class="plain-list">${warnings.map((warning) => `<li>${esc(warning)}</li>`).join("")}</ul>`, actions: [{ label: "Close", className: "btn-ghost" }] });
        }
        await loadAll();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  }

  async function renderReports() {
    if (!state.reports) {
      $("#view").innerHTML = `<div class="card card-pad"><div class="skeleton" style="width:30%"></div><div class="skeleton" style="width:70%;margin-top:14px"></div></div>`;
      try {
        state.reports = await api("/api/reports/summary");
      } catch (error) {
        $("#view").innerHTML = `<div class="card">${emptyState("Reports unavailable", error.message)}</div>`;
        return;
      }
      if (state.view !== "reports") return;
    }
    const report = state.reports;
    const posts = report.posts || {};
    const metrics = report.metrics?.totals || {};
    const traffic = report.traffic || {};
    const delivery = Object.entries(report.delivery || {}).sort((a, b) => b[1].published - a[1].published);
    const channelCounts = report.channelCounts || {};
    const maxChannel = Math.max(1, ...Object.values(channelCounts));
    const top = report.topPosts || [];
    const runs = report.automationRuns || [];
    const totalsDelivery = delivery.reduce((sum, [, row]) => ({ published: sum.published + row.published, failed: sum.failed + row.failed }), { published: 0, failed: 0 });
    const successRate = totalsDelivery.published + totalsDelivery.failed ? Math.round((totalsDelivery.published / (totalsDelivery.published + totalsDelivery.failed)) * 100) : null;

    $("#view").innerHTML = `
      <div class="page-head">
        <div><span class="eyebrow">Reports</span><h2>Performance summary</h2><p>Generated ${esc(relativeInstant(report.generatedAt))}. Delivery counts what each platform actually accepted in the last 30 days.</p></div>
        <div class="page-head-actions">
          <a class="btn btn-ghost" href="${esc(withToken(`${API_BASE}/api/reports/export?format=csv`))}" download>${icon("download")}CSV</a>
          <a class="btn btn-ghost" href="${esc(withToken(`${API_BASE}/api/reports/export?format=json`))}" download>${icon("download")}JSON</a>
          <button class="btn btn-primary" data-reports-refresh>${icon("refresh")}Refresh</button>
        </div>
      </div>
      <div class="grid kpis">
        ${kpi("Posts published · 30d", fmtNumber(posts.published30), `${fmtNumber(posts.published)} all time`)}
        ${kpi("Channel deliveries · 30d", fmtNumber(totalsDelivery.published), successRate === null ? "no attempts yet" : `${successRate}% success · ${fmtNumber(totalsDelivery.failed)} failed`, { tone: successRate !== null && successRate < 80 ? "tone-blue" : "" })}
        ${kpi("Followers", metrics.available?.followers ? fmtNumber(metrics.followers) : "—", metrics.available?.engagement ? `${fmtNumber(metrics.engagement)} engagements (windows differ)` : "no engagement data")}
        ${kpi("Landing visitors · 30d", traffic.configured && !traffic.error ? fmtNumber(traffic.visitors) : "—", traffic.configured ? (traffic.provider === "first-party" ? "first-party counter" : "Plausible") : "connect analytics")}
      </div>
      <div class="card section">
        <div class="card-pad pb-0"><div class="section-head"><h3>Delivery by channel · 30 days</h3><span>from publish results</span></div></div>
        ${delivery.length ? `<div class="table-wrap"><table><thead><tr><th>Channel</th><th class="num">Published</th><th class="num">Failed</th><th class="num">Skipped</th><th class="num">Daily cap</th><th>Success</th></tr></thead><tbody>
          ${delivery.map(([channel, row]) => `<tr><td><div class="channel-name">${channelIcon(channel, { size: "xs" })}<strong>${esc(channelLabel(channel))}</strong></div></td><td class="num">${fmtNumber(row.published)}</td><td class="num ${row.failed ? "text-rose" : ""}">${fmtNumber(row.failed)}</td><td class="num">${fmtNumber(row.skipped)}</td><td class="num">${fmtNumber(row.capped)}</td><td>${row.successRate === null ? "—" : `<div class="rate"><div class="bar-track"><div class="bar-fill ${row.successRate < 80 ? "rose" : ""}" style="width:${row.successRate}%"></div></div><strong>${row.successRate}%</strong></div>`}</td></tr>`).join("")}
        </tbody></table></div>` : `<div class="card-pad">${emptyState("No deliveries yet", "Delivery appears after posts publish.")}</div>`}
      </div>
      <div class="section report-grid">
        <div class="card card-pad">
          <div class="section-head"><h3>Top posts</h3><span>by engagement</span></div>
          ${top.length ? `<ol class="top-posts">${top.map((item) => `<li><button class="link-btn" data-edit="${esc(item.id)}" dir="auto">${esc(item.title)}</button><span>${fmtNumber(item.engagement)} engagements${item.reach ? ` · ${fmtNumber(item.reach)} reach` : ""} · ${Object.keys(item.byChannel).map(channelLabel).join(", ")}</span></li>`).join("")}</ol>` : emptyState("No post-level data yet", "After posts publish, Sync metrics attaches platform numbers to each post.")}
        </div>
        <div class="card card-pad">
          <div class="section-head"><h3>Recommendations</h3><span>rule-based</span></div>
          ${(report.recommendations || []).length ? `<div class="report-list">${report.recommendations.map((item) => `<div class="report-item">${icon("alert")}<span>${esc(item)}</span></div>`).join("")}</div>` : emptyState("No blockers", "Keep publishing and syncing metrics.")}
          <a class="btn btn-ghost btn-sm" href="#/health" style="margin-top:12px">Open content health</a>
        </div>
      </div>
      <div class="section report-grid">
        <div class="card card-pad">
          <div class="section-head"><h3>Planned posts by channel</h3><span>all posts, any status</span></div>
          <div class="bar-chart">${Object.entries(channelCounts).sort((a, b) => b[1] - a[1]).map(([key, count]) => `<div class="bar-row"><label>${channelIcon(key, { size: "xs" })}${esc(channelLabel(key))}</label><div class="bar-track"><div class="bar-fill cyan" style="width:${Math.round((count / maxChannel) * 100)}%"></div></div><strong>${fmtNumber(count)}</strong></div>`).join("")}</div>
        </div>
        <div class="card card-pad">
          <div class="section-head"><h3>Automation runs</h3><a class="link-btn" href="#/automations">Automations</a></div>
          ${runs.length ? `<ul class="plain-runs">${runs.slice(0, 8).map((run) => `<li><strong>${esc(run.ruleName)}</strong><span>${esc(relativeInstant(run.at))} · ${run.ok}/${run.total} ok · ${esc(run.postTitle)}</span></li>`).join("")}</ul>` : emptyState("No automation runs", "Runs appear once a rule fires.")}
        </div>
      </div>
      <div class="card card-pad section">
        <div class="section-head"><h3>Latest automation report</h3><span>${report.latestReport ? "reports/" : "none yet"}</span></div>
        ${report.latestReport ? `<pre class="report-pre">${esc(report.latestReport)}</pre>` : emptyState("No weekly report", "Run the marketing growth report to create one.")}
      </div>
    `;
  }
  /* ------------------------------------------------------------------ *
   * Activity
   * ------------------------------------------------------------------ */

  async function renderActivity() {
    const view = state.activityView;
    if (!state.activity) {
      $("#view").innerHTML = `<div class="card card-pad"><div class="skeleton" style="width:30%"></div><div class="skeleton" style="width:80%;margin-top:14px"></div><div class="skeleton" style="width:60%;margin-top:10px"></div></div>`;
      try {
        const params = new URLSearchParams({ limit: String(view.limit), offset: String(view.offset) });
        if (view.type) params.set("type", view.type);
        if (view.q) params.set("q", view.q);
        state.activity = await api(`/api/activity?${params}`);
      } catch (error) {
        $("#view").innerHTML = `<div class="card">${emptyState("Activity unavailable", error.message)}</div>`;
        return;
      }
      if (state.view !== "activity") return;
    }
    const data = state.activity;
    const pages = Math.max(1, Math.ceil(data.total / view.limit));
    const page = Math.floor(view.offset / view.limit) + 1;
    $("#view").innerHTML = `
      <div class="page-head"><div><span class="eyebrow">Audit trail</span><h2>${plural(data.total, "event")}</h2><p>Times shown in ${esc(tz())}. The portal keeps the latest 1,000 events.</p></div></div>
      <div class="card toolbar">
        <div class="search"><svg><use href="#i-search"></use></svg><input id="activity-q" type="search" placeholder="Search activity…" value="${esc(view.q)}" aria-label="Search activity" /></div>
        <select id="activity-type" aria-label="Event type"><option value="">All events</option>${(data.types || []).map((type) => `<option value="${esc(type)}" ${view.type === type ? "selected" : ""}>${esc(type.replace(/_/g, " "))}</option>`).join("")}</select>
      </div>
      <div class="card card-pad">${activityList(data.items || [])}
        ${data.total > view.limit ? `<div class="pager"><span>Page ${page} / ${pages}</span><span class="foot-spacer"></span><button class="icon-btn sm" data-activity-page="prev" ${page <= 1 ? "disabled" : ""} aria-label="Newer">‹</button><button class="icon-btn sm" data-activity-page="next" ${page >= pages ? "disabled" : ""} aria-label="Older">›</button></div>` : ""}
      </div>
    `;
  }

  /* ------------------------------------------------------------------ *
   * Settings
   * ------------------------------------------------------------------ */

  function renderSettings() {
    const settings = state.overview.settings || {};
    const overview = state.overview;
    const zones = TIMEZONES.includes(settings.timezone) ? TIMEZONES : [settings.timezone, ...TIMEZONES];
    $("#view").innerHTML = `
      <div class="page-head">
        <div><span class="eyebrow">Settings</span><h2>Publishing safety</h2><p>Dry run is the safe default. Live publishing also needs <code>MARKETING_LIVE=true</code> on the server.</p></div>
        <div class="page-head-actions"><span class="dirty-flag" id="settings-dirty" hidden>Unsaved changes</span><button class="btn btn-primary" data-save-settings id="settings-save" disabled>${icon("check")}Save settings</button></div>
      </div>
      <form class="settings-grid" id="settings-form">
        <div class="card card-pad">
          <div class="section-head"><h3>Publishing behavior</h3></div>
          <div class="setting-row"><div><strong>Dry run</strong><span>Simulate every publish. Turn off to let the scheduler post for real.</span></div><label class="switch"><input type="checkbox" id="setting-dry" ${settings.dryRun ? "checked" : ""} /><span></span></label></div>
          <div class="setting-row"><div><strong>Auto-approve imports</strong><span>Imported queue posts go straight to Scheduled instead of Needs review.</span></div><label class="switch"><input type="checkbox" id="setting-auto-approve" ${settings.autoApprove ? "checked" : ""} /><span></span></label></div>
          <div class="setting-row"><div><strong>Require a live landing page</strong><span>Block posts that link to the site while it is down.</span></div><label class="switch"><input type="checkbox" id="setting-require-site" ${settings.requireLiveSite ? "checked" : ""} /><span></span></label></div>
          <div class="setting-row"><div><strong>Require image or video</strong><span>Block text-only posts on every channel.</span></div><label class="switch"><input type="checkbox" id="setting-media-required" ${settings.mediaRequired ? "checked" : ""} /><span></span></label></div>
          <label class="field" style="margin-top:14px"><span>Portal timezone</span><select id="setting-timezone">${zones.map((zone) => `<option ${zone === settings.timezone ? "selected" : ""}>${esc(zone)}</option>`).join("")}</select><small class="field-hint">Schedules are wall-clock times in this zone. Changing it does not move existing posts.</small></label>
          <label class="field"><span>Public media host</span><input type="url" id="setting-public-url" value="${esc(settings.publicUrl || "")}" placeholder="https://marketing.example.com" /><small class="field-hint">Instagram, Threads and Dev.to download media from this address. It must be reachable from the internet.</small></label>
        </div>
        <div class="stack">
          <div class="card card-pad">
            <div class="section-head"><h3>Environment</h3><span>read-only</span></div>
            <div class="setting-row"><div><strong>Live publishing</strong><span>MARKETING_LIVE</span></div><span class="chip ${overview.live ? "lime" : "amber"}">${overview.live ? "true" : "false"}</span></div>
            <div class="setting-row"><div><strong>Scheduler</strong><span>PORTAL_AUTO_PUBLISH</span></div><span class="chip ${overview.autoPublish ? "lime" : "amber"}">${overview.autoPublish ? "true" : "false"}</span></div>
            <div class="setting-row"><div><strong>Effective mode</strong><span>What a scheduled post does when due</span></div><span class="chip ${overview.live && !settings.dryRun && overview.autoPublish ? "lime" : "amber"}">${overview.live && !settings.dryRun && overview.autoPublish ? "publishes live" : "waits"}</span></div>
            <div class="setting-row"><div><strong>Landing page</strong><span class="truncate">${esc(settings.siteUrl || "")}</span></div><span class="chip ${overview.siteLive ? "lime" : "rose"}">${overview.siteLive ? "up" : "down"}</span></div>
            <div class="setting-row"><div><strong>Repository</strong><span>${esc(settings.repo || "")}</span></div>${icon("github")}</div>
          </div>
          <div class="card card-pad">
            <div class="section-head"><h3>Data</h3><span>JSON store</span></div>
            <p class="prose">State lives in <code>portal/data/portal.json</code> with rolling backups in <code>data/backups</code>. Credentials stay in <code>portal/.env</code> and are never returned by the API.</p>
            <div class="form-actions" style="margin-top:12px">
              <a class="btn btn-ghost btn-sm" href="${esc(withToken(`${API_BASE}/api/reports/export?format=json`))}" download>${icon("download")}Export everything (JSON)</a>
              <button type="button" class="btn btn-ghost btn-sm" data-import-queue>Import legacy queue</button>
            </div>
          </div>
        </div>
      </form>
    `;
    const form = $("#settings-form");
    const snapshot = settingsSnapshot();
    const onChange = () => {
      const dirty = settingsSnapshot() !== snapshot;
      $("#settings-dirty").hidden = !dirty;
      $("#settings-save").disabled = !dirty;
    };
    form.addEventListener("input", onChange);
    form.addEventListener("change", onChange);
    form.addEventListener("submit", (event) => event.preventDefault());
  }

  function settingsSnapshot() {
    return JSON.stringify(settingsBody());
  }

  function settingsBody() {
    return {
      dryRun: $("#setting-dry").checked,
      autoApprove: $("#setting-auto-approve").checked,
      requireLiveSite: $("#setting-require-site").checked,
      mediaRequired: $("#setting-media-required").checked,
      publicUrl: $("#setting-public-url").value.trim(),
      timezone: $("#setting-timezone").value,
    };
  }

  async function saveSettings(button) {
    const body = settingsBody();
    const current = state.overview.settings || {};
    if (current.dryRun && !body.dryRun && state.overview.live) {
      const ok = await confirmDialog({
        title: "Go live?",
        message: `Turning dry run off lets the scheduler publish due posts to real platforms${state.overview.posts?.overdue ? ` — including <strong>${plural(state.overview.posts.overdue, "overdue post")}</strong> on its next tick` : ""}.`,
        confirmLabel: "Go live",
        danger: true,
      });
      if (!ok) return;
    }
    await withBusy(button, async () => {
      try {
        await api("/api/settings", { method: "PUT", body: jsonBody(body) });
        toast("Settings saved.", "success");
        await loadAll();
      } catch (error) {
        toast(error.message, "error");
      }
    });
  }

  async function importQueue() {
    const ok = await confirmDialog({
      title: "Import legacy queue",
      message: "Adds legacy queue posts that are not in the portal yet. It can schedule duplicate content on top of the current daily plan — use it only to restore the old queue.",
      confirmLabel: "Import",
    });
    if (!ok) return;
    try {
      const result = await api("/api/import-queue", { method: "POST", body: jsonBody({}) });
      toast(`Imported ${plural(result.imported, "post")}.`, "success");
      await loadPosts();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  /* ------------------------------------------------------------------ *
   * Post actions
   * ------------------------------------------------------------------ */

  async function updateStatus(id, status) {
    try {
      const response = await api(`/api/posts/${encodeURIComponent(id)}/status`, { method: "POST", body: jsonBody({ status }) });
      replacePost(response.post);
      toast(`“${response.post.title}” → ${statusLabel(status)}.`, "success");
      await loadPosts();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function duplicatePost(id) {
    try {
      const response = await api(`/api/posts/${encodeURIComponent(id)}/duplicate`, { method: "POST", body: jsonBody({}) });
      toast("Duplicated as a draft.", "success", { action: { label: "Open", onClick: () => openEditor(state.posts.find((post) => post.id === response.post.id) || response.post) } });
      await loadPosts();
      return response.post;
    } catch (error) {
      toast(error.message, "error");
      return null;
    }
  }

  async function deletePost(id, { fromEditor = false } = {}) {
    const post = state.posts.find((item) => item.id === id);
    if (!post) return false;
    const ok = await confirmDialog({
      title: "Delete post",
      message: `Delete <strong dir="auto">${esc(post.title)}</strong> from the portal?`,
      detail: post.status === "published" ? "It is already published. This removes only the portal record, not the platform posts." : "",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return false;
    try {
      await api(`/api/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
      state.content.selected.delete(id);
      if (fromEditor) closeEditor(true);
      toast("Post deleted.", "success");
      await loadPosts();
      return true;
    } catch (error) {
      toast(error.message, "error");
      return false;
    }
  }

  async function publishPost(id, dryRun, { button = null } = {}) {
    const post = state.posts.find((item) => item.id === id);
    if (!post) return null;
    if (!dryRun) {
      if (!state.overview?.live) {
        toast("Live publishing is locked. Set MARKETING_LIVE=true on the portal server.", "error");
        return null;
      }
      let preview = [];
      try {
        preview = (await api("/api/preview", { method: "POST", body: jsonBody({ id }) })).channels || [];
      } catch {
        preview = [];
      }
      const rows = (preview.length ? preview : post.channels.map((channel) => ({ channel, label: channelLabel(channel), configured: channelDef(channel)?.configured }))).map((item) => {
        const note = item.over ? `<span class="text-rose">too long (${item.length}/${item.limit}) — will skip</span>` : item.configured ? `<span class="text-lime">ready</span>` : `<span class="text-amber">not connected — will skip</span>`;
        return `<li>${channelIcon(item.channel, { size: "xs" })}<strong>${esc(item.label)}</strong>${note}</li>`;
      }).join("");
      const ok = await confirmDialog({
        title: post.status === "published" ? "Publish again?" : "Publish now?",
        message: `This sends <strong dir="auto">${esc(post.title)}</strong> to the live platforms immediately.${post.status === "published" ? " It is already published, so followers will see it twice." : ""}`,
        detail: `<ul class="publish-list">${rows}</ul>`,
        confirmLabel: "Publish now",
        danger: true,
      });
      if (!ok) return null;
    }
    const run = async () => {
      try {
        const result = await api(`/api/posts/${encodeURIComponent(id)}/publish`, {
          method: "POST",
          body: jsonBody({ dryRun, ...(post.status === "published" && !dryRun ? { force: true } : {}) }),
        });
        replacePost(result.post);
        const r = result.result || {};
        if (r.blocked) toast(r.results?.[0]?.reason || "Blocked by a safety check.", "error");
        else if (r.dryRun) {
          const ready = (r.results || []).filter((item) => item.ready && item.ok).length;
          const total = (r.results || []).length;
          toast(`Dry run: ${ready} of ${total} channels would publish. Nothing was sent.`, ready === total ? "success" : "", {
            action: { label: "Details", onClick: () => showChannelStatus(id) },
          });
        } else {
          toast(`Published to ${plural(r.published || 0, "channel")}${r.failures ? ` · ${r.failures} failed` : ""}${r.skipped ? ` · ${r.skipped} skipped` : ""}.`, r.failures ? "error" : "success", {
            action: { label: "Results", onClick: () => showChannelStatus(id) },
          });
        }
        await loadPosts();
        return result;
      } catch (error) {
        toast(error.message, "error");
        return null;
      }
    };
    return button ? withBusy(button, run) : run();
  }

  function channelResultDetail(result) {
    if (!result) return { label: "Not attempted", className: "draft", detail: "No publish attempt recorded yet." };
    const note = result.mediaNote ? ` · ${result.mediaNote}` : "";
    if (result.dryRun) return { label: result.ready ? "Would publish" : "Would skip", className: result.ready ? "scheduled" : "blocked", detail: (result.reason || "Simulated only; nothing was sent.") + note };
    if (result.ok) return { label: "Published", className: "published", detail: (result.url || (result.id ? `id: ${result.id}` : "Published successfully.")) + note, url: result.url };
    if (result.skipped) return { label: "Skipped", className: "blocked", detail: result.reason || "Skipped" };
    return { label: "Failed", className: "failed", detail: result.reason || result.error || "Unknown error" };
  }

  function resultsTable(post, results, { dry = false } = {}) {
    const channels = [...new Set([...(post.channels || []), ...results.filter((r) => r.channel).map((result) => result.channel)])];
    const general = results.filter((result) => !result.channel);
    return `${general.map((result) => `<div class="inline-alert ${result.ok ? "" : "rose"}">${icon("alert")}<span>${esc(result.reason || result.error || "")}</span></div>`).join("")}
      <div class="result-list">${channels.map((channel) => {
        const result = results.find((item) => item.channel === channel);
        const detail = channelResultDetail(dry && !result ? null : result);
        return `<div class="result-row">
          <div class="result-channel">${channelIcon(channel, { size: "xs" })}<strong>${esc(channelLabel(channel))}</strong></div>
          <span class="status ${detail.className}">${esc(detail.label)}</span>
          <p class="result-detail">${detail.url ? `<a href="${esc(detail.url)}" target="_blank" rel="noopener">${esc(detail.url)}</a>${result?.mediaNote ? ` · ${esc(result.mediaNote)}` : ""}` : esc(String(detail.detail).slice(0, 400))}</p>
        </div>`;
      }).join("")}</div>`;
  }

  function showChannelStatus(id) {
    const post = state.posts.find((item) => item.id === id);
    if (!post) return;
    const results = Array.isArray(post.results) ? post.results : [];
    const counts = resultCounts(results);
    const failed = results.filter((result) => result.channel && !result.ok && !result.skipped);
    const skipped = results.filter((result) => result.channel && result.skipped);
    const live = Boolean(state.overview?.live);
    let body = "";
    if (results.length) {
      body += `<p class="prose">${counts.published} of ${post.channels.length} channels published${counts.failed ? ` · ${counts.failed} failed` : ""}${counts.skipped ? ` · ${counts.skipped} skipped` : ""}${post.lastAttemptAt ? ` · last attempt ${esc(relativeInstant(post.lastAttemptAt))}` : ""}.</p>${resultsTable(post, results)}`;
    }
    if (post.preview?.results?.length) {
      body += `<h4 class="modal-subhead">Last dry run · ${esc(relativeInstant(post.preview.at))}</h4>${resultsTable(post, post.preview.results, { dry: true })}`;
    }
    if (!body) body = emptyState("No attempts yet", "Run a dry run to check every channel before it goes out.");
    body += `<p class="field-hint" style="margin-top:12px">Skipped = not attempted (missing setup, too long or a failed connection test). Failed = the platform API returned an error.</p>`;
    const actions = [{ label: "Close", className: "btn-ghost" }];
    if (failed.length && live) actions.push({ label: `Retry failed (${failed.length})`, className: "btn-primary", onClick: () => retryChannels(id, failed.map((result) => result.channel)) });
    if (skipped.length && live) actions.push({ label: `Retry skipped (${skipped.length})`, className: "btn-outline", onClick: () => retryChannels(id, skipped.map((result) => result.channel)) });
    actions.splice(1, 0, { label: "Dry run again", className: "btn-ghost", onClick: () => publishPost(id, true) });
    openModal({ title: `Channel results · ${post.title}`, body, actions, wide: true });
  }

  async function retryChannels(id, channels) {
    const post = state.posts.find((item) => item.id === id);
    if (!post || !channels.length) return;
    const ok = await confirmDialog({
      title: "Retry channels",
      message: `Publish <strong dir="auto">${esc(post.title)}</strong> to ${esc(channels.map(channelLabel).join(", "))} now? Only these channels are called.`,
      confirmLabel: "Retry now",
    });
    if (!ok) return;
    try {
      const response = await api(`/api/posts/${encodeURIComponent(id)}/publish`, { method: "POST", body: jsonBody({ dryRun: false, channels }) });
      const results = response.result?.results || [];
      const failedCount = results.filter((result) => !result.ok && !result.skipped).length;
      toast(results.map((result) => `${channelLabel(result.channel)}: ${result.ok ? "published" : result.skipped ? "skipped" : "failed"}`).join(" · ") || "Retry finished.", failedCount ? "error" : "success");
      replacePost(response.post);
      await loadPosts();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  /* ------------------------------------------------------------------ *
   * Editor drawer
   * ------------------------------------------------------------------ */

  function editorSnapshot() {
    return JSON.stringify(editorBody());
  }

  function editorBody(statusOverride) {
    const media = {
      url: $("#post-media-url").value.trim(),
      publicUrl: $("#post-media-public").value.trim(),
      kind: $("#post-media-kind").value.trim(),
      name: $("#post-media-name").value.trim(),
      source: $("#post-media-source").value.trim(),
      alt: $("#post-media-alt").value.trim(),
    };
    return {
      title: $("#post-title").value.trim(),
      content: $("#post-content").value,
      channels: selectedChannels(),
      language: $("#post-language").value,
      pillar: $("#post-pillar").value,
      tags: $("#post-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
      scheduledAt: $("#post-schedule").value,
      status: statusOverride || $("#post-status").value,
      mediaUrl: media.url,
      mediaPublicUrl: media.publicUrl,
      mediaKind: media.kind,
      mediaName: media.name,
      mediaSource: media.source,
      mediaAlt: media.alt,
      posterUrl: state.editor.poster?.url || "",
      posterPublicUrl: state.editor.poster?.publicUrl || "",
      posterName: state.editor.poster?.name || "",
      notes: $("#post-notes").value.trim(),
      overrides: Object.fromEntries(
        Object.entries(state.editor.overrides || {}).filter(([channel, text]) => text && text.trim() && $$("#channel-picker input:checked").some((input) => input.value === channel))
      ),
    };
  }

  function isEditorDirty() {
    return !$("#drawer").hidden && editorSnapshot() !== state.editor.snapshot;
  }

  function updateDirty() {
    $("#dirty-flag").hidden = !isEditorDirty();
  }

  function renderPlaceholderBar() {
    const placeholders = state.meta?.placeholders?.length ? state.meta.placeholders : ["site", "repo", "pricing", "demo"];
    $("#placeholder-bar").innerHTML = `<span>Insert</span>${placeholders.map((key) => `<button type="button" class="token-btn" data-insert="{{${esc(key)}}}" title="Insert tracked ${esc(key)} link">{{${esc(key)}}}</button>`).join("")}`;
  }

  function renderPillarOptions(current) {
    const pillars = [...(state.meta?.pillars || Object.keys(PILLAR_LABEL))];
    if (current && !pillars.includes(current)) pillars.push(current);
    $("#post-pillar").innerHTML = pillars.map((pillar) => `<option value="${esc(pillar)}">${esc(pillarLabel(pillar))}</option>`).join("");
  }

  function renderStatusOptions(current) {
    const statuses = ["draft", "needs_review", "approved", "scheduled"];
    if (current && !statuses.includes(current)) statuses.push(current);
    $("#post-status").innerHTML = statuses.map((status) => `<option value="${esc(status)}">${esc(statusLabel(status))}</option>`).join("");
  }

  function updateStatusHint() {
    const status = $("#post-status").value;
    $("#status-hint").textContent = STATUS_HINT[status] || "";
    const at = $("#post-schedule").value;
    const label = $("#schedule-label");
    label.textContent = `Publish at (${tzShort()} time)`;
    const past = at && `${at}:00` < wallNow() && status === "scheduled";
    $("#post-schedule").classList.toggle("is-warning", Boolean(past));
    if (past) $("#status-hint").textContent = "This time has passed. It publishes on the next scheduler tick when live mode is on.";
  }

  function renderChannelPicker(selected) {
    const sorted = [...state.connections].sort((a, b) => {
      const rank = (channel) => (channel.configured ? 0 : channel.mode === "api" ? 1 : 2);
      return rank(a) - rank(b);
    });
    $("#channel-picker").innerHTML = sorted.map((channel) => {
      const checked = selected.includes(channel.key);
      const readiness = channel.configured ? "ready" : channel.mode === "api" ? "setup" : "restricted";
      const title = channel.configured ? "Connected" : channel.mode === "api" ? "Not connected yet — will be skipped" : "Restricted — publishing is blocked";
      return `<label class="channel-toggle ${checked ? "is-checked" : ""} is-${readiness}" title="${esc(title)}">
        <input type="checkbox" value="${esc(channel.key)}" ${checked ? "checked" : ""} />
        ${channelIcon(channel.key, { size: "xs" })}<span>${esc(channel.label)}</span><i class="readiness ${readiness}"></i>
      </label>`;
    }).join("");
  }

  function selectedChannels() {
    // Keep the post's existing channel order so a save never looks like a channel change.
    const picked = $$("#channel-picker input:checked").map((input) => input.value);
    const original = state.editor.post?.channels || [];
    return [...original.filter((key) => picked.includes(key)), ...picked.filter((key) => !original.includes(key))];
  }

  function setPostMedia(media) {
    const current = media || {};
    $("#post-media-url").value = current.url || "";
    $("#post-media-public").value = current.publicUrl || "";
    $("#post-media-kind").value = current.kind || "";
    $("#post-media-name").value = current.name || "";
    $("#post-media-source").value = current.source || "";
    // A video's cover image travels with it; X and LinkedIn publish the cover until video upload is enabled.
    state.editor.poster = current.kind === "video" && current.posterUrl
      ? { url: current.posterUrl, publicUrl: current.posterPublicUrl || "", name: current.posterName || "" }
      : null;
    if (media) $("#post-media-alt").value = current.alt || $("#post-media-alt").value || "";
    else $("#post-media-alt").value = "";
    const preview = $("#media-preview");
    const required = Boolean(state.overview?.settings?.mediaRequired);
    $("#media-req").hidden = !required;
    if (!current.url) {
      preview.innerHTML = `<div class="media-empty">${icon("image")}<strong>Drop an image or video here</strong><span>or use Upload, Library or From URL</span></div>`;
      $("#media-hint").textContent = required ? "Required: posts without an image or video are blocked before any channel is called." : "Optional. Most channels perform better with an image.";
      $("#media-box").classList.remove("has-media");
    } else {
      preview.innerHTML = current.kind === "video"
        ? `<video src="${esc(current.url)}" ${current.posterUrl ? `poster="${esc(current.posterUrl)}"` : ""} controls muted playsinline preload="metadata"></video>`
        : `<img src="${esc(current.url)}" alt="${esc(current.alt || "")}" />`;
      const publicReady = /^https?:\/\//i.test(current.publicUrl || current.url || "");
      $("#media-hint").textContent = `${current.name || "Attached"} · ${publicReady ? "public URL ready for Instagram, Threads and Dev.to." : "local file: native-upload channels work; Instagram/Threads/Dev.to need a public media host."}`;
      $("#media-box").classList.add("has-media");
    }
    $("#media-url-row").hidden = true;
    schedulePreview();
    updateDirty();
  }

  function openMediaPicker() {
    const entries = allMediaEntries();
    openModal({
      title: "Choose media",
      wide: true,
      body: entries.length ? `<div class="media-grid">${entries.map((item, index) => `
        <button type="button" class="media-item" data-media-index="${index}">
          ${item.kind === "video" ? `<video src="${esc(item.url)}" muted playsinline preload="metadata"></video>` : `<img src="${esc(item.url)}" alt="${esc(item.alt || item.label || "")}" loading="lazy" />`}
          <span class="truncate">${esc(item.label || item.name)}</span>
          <em>${item.origin === "upload" ? "upload" : "brand"} · ${esc(item.kind || "image")}${item.usage?.total ? ` · used ${item.usage.total}×` : ""}</em>
        </button>`).join("")}</div>` : emptyState("No media yet", "Upload an image or video first."),
      actions: [{ label: "Close", className: "btn-ghost" }],
      onOpen: () => {
        $$("[data-media-index]").forEach((button) =>
          button.addEventListener("click", () => {
            setPostMedia(mediaEntryToPostMedia(entries[Number(button.dataset.mediaIndex)]));
            finishModal(null);
          })
        );
      },
    });
  }

  function defaultMediaForPillar(pillar) {
    const matches = state.mediaLibrary.filter((entry) => (entry.pillars || []).includes(pillar));
    const item = matches.find((entry) => String(entry.id).startsWith("social-")) || matches[0] || state.mediaLibrary[0];
    return item ? mediaEntryToPostMedia({ ...item, name: item.file, origin: "library" }) : null;
  }

  function editorMeta(post) {
    if (!post?.id) return `Will be saved as a new post`;
    const parts = [
      statusChip(post.status),
      post.source === "queue" ? `<span class="chip muted">from queue</span>` : "",
      `<span>Created ${esc(relativeInstant(post.createdAt))}</span>`,
      post.updatedAt ? `<span>Edited ${esc(relativeInstant(post.updatedAt))}</span>` : "",
      post.publishedAt ? `<span>Published ${esc(fmtInstant(post.publishedAt))}</span>` : "",
    ];
    return parts.filter(Boolean).join("");
  }

  async function openEditor(post = null, prefill = null) {
    if (!$("#drawer").hidden && isEditorDirty()) {
      const ok = await confirmDialog({ title: "Discard changes?", message: "You have unsaved changes in the open post.", confirmLabel: "Discard", danger: true });
      if (!ok) return;
    }
    closeMenu();
    const editor = state.editor;
    editor.post = post ? { ...post } : null;
    editor.preview = [];
    editor.side = "preview";
    const source = { ...(post || {}), ...(prefill || {}) };
    editor.overrides = { ...(source.overrides || {}) };
    editor.openOverrides = new Set(Object.keys(editor.overrides));
    editor.issues = [];
    editor.automations = [];
    $("#drawer-eyebrow").textContent = post?.id ? `Edit post · ${post.id}` : prefill?.title ? "New post from template" : "New post";
    $("#drawer-title").textContent = source.title || "Untitled post";
    $("#drawer-meta").innerHTML = editorMeta(post);
    $("#post-id").value = post?.id || "";
    $("#post-title").value = source.title || "";
    $("#post-content").value = source.content || "";
    $("#post-language").value = source.language === "ar" ? "ar" : "en";
    renderPillarOptions(source.pillar || "product");
    $("#post-pillar").value = source.pillar || "product";
    $("#post-tags").value = (source.tags || []).join(", ");
    $("#tag-options").innerHTML = (state.meta?.tags || []).map((tag) => `<option value="${esc(tag)}"></option>`).join("");
    $("#post-schedule").value = String(source.scheduledAt || nextFreeSlot(post?.id)).slice(0, 16);
    renderStatusOptions(post?.status);
    $("#post-status").value = post?.status || "draft";
    $("#post-notes").value = source.notes || "";
    renderPlaceholderBar();
    renderChannelPicker(source.channels || (post ? [] : state.connections.filter((channel) => channel.configured).map((channel) => channel.key)));
    const existingMedia = source.mediaUrl
      ? { url: source.mediaUrl, publicUrl: source.mediaPublicUrl || "", kind: source.mediaKind || "", name: source.mediaName || "", source: source.mediaSource || "", alt: source.mediaAlt || "", posterUrl: source.posterUrl || "", posterPublicUrl: source.posterPublicUrl || "", posterName: source.posterName || "" }
      : null;
    $("#post-media-alt").value = source.mediaAlt || "";
    setPostMedia(prefill?.media || existingMedia || (post?.id ? null : defaultMediaForPillar(source.pillar || "product")));
    applyLanguageDir();
    updateStatusHint();
    $("#post-delete").hidden = !post?.id;
    $("#publish-live").disabled = !state.overview?.live;
    $("#publish-live").title = state.overview?.live ? "Publish to every selected channel now" : "Live publishing is locked (MARKETING_LIVE=false)";
    $$(".side-tab").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.side === "preview");
      tab.setAttribute("aria-selected", tab.dataset.side === "preview" ? "true" : "false");
    });
    $("#drawer").hidden = false;
    $("#overlay").hidden = false;
    document.body.classList.add("has-drawer");
    editor.snapshot = editorSnapshot();
    updateDirty();
    renderSidePanel();
    schedulePreview(0);
    setTimeout(() => $("#post-content").focus(), 40);

    if (post?.id) {
      try {
        const full = await api(`/api/posts/${encodeURIComponent(post.id)}`);
        if (state.editor.post?.id === post.id) {
          state.editor.post = full.post;
          state.editor.issues = full.issues || [];
          state.editor.automations = full.automations || [];
          $("#drawer-meta").innerHTML = editorMeta(full.post);
          renderSidePanel();
        }
      } catch {
        // The list copy is enough to edit; history just stays unavailable.
      }
    }
  }

  async function closeEditor(force = false) {
    if (!force && isEditorDirty()) {
      const ok = await confirmDialog({ title: "Discard changes?", message: "Your edits to this post have not been saved.", confirmLabel: "Discard", danger: true });
      if (!ok) return false;
    }
    $("#drawer").hidden = true;
    $("#overlay").hidden = true;
    document.body.classList.remove("has-drawer");
    state.editor.post = null;
    state.editor.snapshot = "";
    const { params } = parseHash();
    if (params.has("post")) {
      params.delete("post");
      history.replaceState(null, "", `#/${state.view}${params.toString() ? `?${params}` : ""}`);
    }
    return true;
  }

  function applyLanguageDir() {
    const rtl = $("#post-language").value === "ar";
    $("#post-content").dir = rtl ? "rtl" : "ltr";
    $("#post-content").lang = rtl ? "ar" : "en";
    $("#post-title").dir = "auto";
  }

  const schedulePreview = (() => {
    let timer = null;
    return (wait = 350) => {
      clearTimeout(timer);
      timer = setTimeout(fetchPreview, wait);
    };
  })();

  async function fetchPreview() {
    if ($("#drawer").hidden) return;
    const editor = state.editor;
    const seq = ++editor.previewSeq;
    const body = editorBody();
    try {
      const data = await api("/api/preview", {
        method: "POST",
        body: jsonBody({ id: $("#post-id").value || undefined, content: body.content, channels: body.channels, mediaUrl: body.mediaUrl, mediaKind: body.mediaKind, mediaPublicUrl: body.mediaPublicUrl, posterUrl: body.posterUrl, overrides: body.overrides, language: body.language }),
      });
      if (seq !== editor.previewSeq) return;
      editor.preview = data.channels || [];
    } catch {
      if (seq !== editor.previewSeq) return;
      editor.preview = [];
    }
    updateContentCount();
    if (editor.side === "preview") renderSidePanel();
  }

  function updateContentCount() {
    const preview = state.editor.preview;
    const badge = $("#content-count");
    const raw = [...($("#post-content").value || "")].length;
    if (!preview.length) {
      badge.textContent = `${raw} chars`;
      badge.className = "count-badge";
      return;
    }
    const strictest = preview.filter((item) => item.limit).sort((a, b) => a.limit - a.length - (b.limit - b.length))[0];
    const over = preview.filter((item) => item.over);
    if (!strictest) {
      badge.textContent = `${raw} chars`;
      badge.className = "count-badge";
      return;
    }
    badge.textContent = over.length ? `${over.map((item) => item.label).join(", ")} over limit` : `${strictest.label} ${strictest.length}/${strictest.limit}`;
    badge.className = `count-badge ${over.length ? "over" : strictest.length > strictest.limit * 0.9 ? "near" : ""}`;
  }

  function renderSidePanel() {
    const editor = state.editor;
    const panel = $("#side-panel");
    const post = editor.post;
    if (editor.side === "preview") {
      const preview = editor.preview;
      const body = editorBody();
      if (!body.channels.length) {
        panel.innerHTML = emptyState("Pick channels", "Select at least one channel to preview how the post renders there.");
        return;
      }
      if (!preview.length) {
        panel.innerHTML = `<div class="skeleton" style="width:60%"></div><div class="skeleton tall" style="width:100%;margin-top:12px"></div>`;
        return;
      }
      const rtl = body.language === "ar";
      // While someone types in a per-channel box, update the cards in place so the box keeps focus.
      if (panel.contains(document.activeElement) && document.activeElement.matches("[data-override]")) {
        for (const item of preview) {
          const card = panel.querySelector(`[data-preview-card="${item.channel}"]`);
          if (!card) continue;
          card.classList.toggle("is-over", item.over);
          card.querySelector(".preview-text").textContent = item.text;
          const text = card.querySelector(".limit-text");
          if (text) text.textContent = item.limit ? `${fmtNumber(item.length)} / ${fmtNumber(item.limit)}` : `${fmtNumber(item.length)} chars`;
          const bar = card.querySelector(".limit-bar span");
          if (bar && item.limit) bar.style.width = `${Math.min(100, (item.length / item.limit) * 100)}%`;
        }
        return;
      }
      const issues = editor.issues || [];
      panel.innerHTML = `${issues.length ? `<div class="checks"><h4 class="side-subhead">Checks (saved version)</h4>${issues.map((issue) => `<p class="check lvl-${issue.level}">${icon(issue.level === "info" ? "info" : "alert")}<span>${esc(issue.message)}</span></p>`).join("")}</div>` : ""}
        <p class="field-hint">Exactly what each channel receives — tracked links, channel rules and the platform's own character counting. Use <strong>Customize</strong> to write a different version for one channel.</p>
        ${preview.map((item) => {
          const pct = item.limit ? Math.min(100, (item.length / item.limit) * 100) : 0;
          const readiness = item.mode !== "api" ? `<span class="chip muted">restricted</span>` : item.configured ? `<span class="chip lime">ready</span>` : `<span class="chip amber">not connected</span>`;
          const open = editor.openOverrides?.has(item.channel);
          return `<article class="preview-card ${item.over ? "is-over" : ""}" data-preview-card="${esc(item.channel)}">
            <header>${channelIcon(item.channel, { size: "xs" })}<strong>${esc(item.label)}</strong>${item.custom || editor.overrides?.[item.channel] ? `<span class="chip purple">custom copy</span>` : ""}${(item.rules || []).map((rule) => `<span class="chip muted">${esc(rule)}</span>`).join("")}${readiness}
              <button type="button" class="link-btn" data-override-toggle="${esc(item.channel)}">${open ? "Close" : editor.overrides?.[item.channel] ? "Edit custom copy" : "Customize"}</button></header>
            ${open ? `<div class="override-box"><textarea rows="5" data-override="${esc(item.channel)}" dir="${rtl ? "rtl" : "auto"}" placeholder="Write the ${esc(item.label)} version…">${esc(editor.overrides?.[item.channel] ?? $("#post-content").value)}</textarea>
              <div class="override-actions"><span class="field-hint">Placeholders like {{site}} work here too.</span><button type="button" class="link-btn" data-override-reset="${esc(item.channel)}">Use main copy</button></div></div>` : ""}
            <div class="preview-text" dir="${rtl ? "rtl" : "auto"}">${esc(item.text) || `<em class="muted">Empty</em>`}</div>
            ${body.mediaUrl ? `<div class="preview-media">${body.mediaKind === "video" ? `${body.posterUrl ? `<img src="${esc(body.posterUrl)}" alt="" loading="lazy" />` : ""}<span class="thumb-video overlay">${icon("play")}</span>` : `<img src="${esc(body.mediaUrl)}" alt="" loading="lazy" />`}</div>` : ""}
            <footer>
              ${item.limit ? `<div class="limit-bar"><span style="width:${pct}%"></span></div><span class="limit-text">${fmtNumber(item.length)} / ${fmtNumber(item.limit)}</span>` : `<span class="limit-text">${fmtNumber(item.length)} chars</span>`}
            </footer>
            ${item.over ? `<p class="preview-note rose">Too long — this channel will be skipped. Trim ${fmtNumber(item.length - item.limit)} characters.</p>` : ""}
            ${(item.notes || []).map((note) => `<p class="preview-note amber">${esc(note)}</p>`).join("")}
          </article>`;
        }).join("")}`;
      return;
    }
    if (editor.side === "results") {
      if (!post?.id) {
        panel.innerHTML = emptyState("Not saved yet", "Save the post, then run a dry run to check every channel.");
        return;
      }
      const results = Array.isArray(post.results) ? post.results : [];
      let html = "";
      if (results.length) html += `<h4 class="side-subhead">Last publish${post.lastAttemptAt ? ` · ${esc(relativeInstant(post.lastAttemptAt))}` : ""}</h4>${resultsTable(post, results)}<button type="button" class="btn btn-outline btn-sm" data-side-status style="margin-top:10px">Open full results & retry</button>`;
      if (post.preview?.results?.length) html += `<h4 class="side-subhead">Last dry run · ${esc(relativeInstant(post.preview.at))}</h4>${resultsTable(post, post.preview.results, { dry: true })}`;
      const autos = editor.automations || [];
      if (autos.length) {
        html += `<h4 class="side-subhead">Automations for this post</h4><ul class="auto-mini">${autos.map((rule) => `<li>${icon("bolt")}<span><strong>${esc(rule.name)}</strong> · ${rule.event === "before" ? `${durationText(rule.minutes)} before` : rule.event === "published" ? (rule.minutes ? `${durationText(rule.minutes)} after publishing` : "when it publishes") : "when scheduled"}${rule.enabled ? "" : " · paused"}${rule.ran ? ` · ran ${esc(relativeInstant(rule.ran.at))} (${rule.ran.ok}/${rule.ran.total})` : ""}</span></li>`).join("")}</ul>`;
      }
      panel.innerHTML = html || emptyState("No attempts yet", "Use Dry run to simulate the publish. Nothing is sent.");
      return;
    }
    if (editor.side === "history") {
      if (!post?.id) {
        panel.innerHTML = emptyState("No history yet", "Every save keeps a revision you can restore.");
        return;
      }
      const revisions = Array.isArray(post.revisions) ? post.revisions : null;
      if (!revisions) {
        panel.innerHTML = `<div class="skeleton" style="width:60%"></div>`;
        return;
      }
      panel.innerHTML = revisions.length
        ? `<p class="field-hint">The portal keeps the last 20 versions. Restoring keeps the current status.</p><ol class="revision-list">${revisions.map((revision, index) => {
            const changes = [];
            const next = index === 0 ? post : revisions[index - 1];
            if (revision.content !== next.content) changes.push("copy");
            if (revision.title !== next.title) changes.push("title");
            if (revision.scheduledAt !== next.scheduledAt) changes.push(`time ${fmtWall(revision.scheduledAt, { year: false })}`);
            if (revision.status !== next.status) changes.push(`status ${statusLabel(revision.status)}`);
            if ([...(revision.channels || [])].sort().join() !== [...(next.channels || [])].sort().join()) changes.push("channels");
            if (revision.mediaUrl !== next.mediaUrl) changes.push("media");
            return `<li class="revision">
              <div><strong>${esc(fmtInstant(revision.at))}</strong><span>${esc(relativeInstant(revision.at))}${changes.length ? ` · before: ${esc(changes.join(", "))}` : ""}</span><p dir="auto">${esc(String(revision.content || "").slice(0, 180))}${String(revision.content || "").length > 180 ? "…" : ""}</p></div>
              <button type="button" class="btn btn-ghost btn-sm" data-restore="${index}">Restore</button>
            </li>`;
          }).join("")}</ol>`
        : emptyState("No earlier versions", "Revisions appear after the first edit.");
    }
  }

  async function saveEditor({ status, quiet = false, button = null } = {}) {
    if (state.editor.saving) return null;
    const id = $("#post-id").value;
    const body = editorBody(status);
    if (!body.content.trim()) {
      toast("Write the post copy first.", "error");
      $("#post-content").focus();
      return null;
    }
    if (!body.channels.length) {
      toast("Select at least one channel.", "error");
      return null;
    }
    if (state.overview?.settings?.mediaRequired && !body.mediaUrl && ["scheduled", "approved", "published"].includes(body.status)) {
      toast("Attach an image or video before scheduling.", "error");
      return null;
    }
    if (!body.title) body.title = body.content.trim().split("\n")[0].slice(0, 140);
    const run = async () => {
      state.editor.saving = true;
      try {
        const payload = id ? { ...body, updatedAt: state.editor.post?.updatedAt } : body;
        const response = id
          ? await api(`/api/posts/${encodeURIComponent(id)}`, { method: "PUT", body: jsonBody(payload) })
          : await api("/api/posts", { method: "POST", body: jsonBody(payload) });
        replacePost(response.post);
        state.editor.post = { ...(state.editor.post || {}), ...response.post };
        $("#post-id").value = response.post.id;
        $("#post-title").value = response.post.title;
        $("#drawer-title").textContent = response.post.title;
        $("#drawer-eyebrow").textContent = `Edit post · ${response.post.id}`;
        $("#drawer-meta").innerHTML = editorMeta(state.editor.post);
        renderStatusOptions(response.post.status);
        $("#post-status").value = response.post.status;
        $("#post-delete").hidden = false;
        state.editor.snapshot = editorSnapshot();
        updateDirty();
        updateStatusHint();
        if (!quiet) toast(id ? "Post saved." : "Post created.", "success");
        loadPosts().catch(() => {});
        api(`/api/posts/${encodeURIComponent(response.post.id)}`).then((full) => {
          if (state.editor.post?.id === full.post.id) {
            state.editor.post = full.post;
            renderSidePanel();
          }
        }).catch(() => {});
        return response.post;
      } catch (error) {
        if (error.status === 409 && error.data?.post) {
          const overwrite = await confirmDialog({
            title: "Post changed elsewhere",
            message: "Someone (or the scheduler) changed this post after you opened it. Overwrite their version with yours?",
            confirmLabel: "Overwrite",
            danger: true,
          });
          if (overwrite) {
            state.editor.post = { ...(state.editor.post || {}), updatedAt: error.data.post.updatedAt };
            state.editor.saving = false;
            return saveEditor({ status, quiet, button: null });
          }
          return null;
        }
        toast(error.message, "error");
        return null;
      } finally {
        state.editor.saving = false;
      }
    };
    return button ? withBusy(button, run) : run();
  }

  async function saveAsTemplate() {
    const body = editorBody();
    if (!body.content.trim()) return toast("Write some copy before saving a template.", "error");
    openTemplateModal(null, { name: body.title || body.content.trim().split("\n")[0].slice(0, 60), content: body.content, language: body.language, pillar: body.pillar, channels: body.channels });
  }

  async function restoreRevision(index) {
    const post = state.editor.post;
    if (!post?.id) return;
    if (isEditorDirty()) {
      const ok = await confirmDialog({ title: "Discard unsaved edits?", message: "Restoring replaces the editor with the older version.", confirmLabel: "Restore", danger: true });
      if (!ok) return;
    } else {
      const ok = await confirmDialog({ title: "Restore this version?", message: "The current version is kept in history, so you can undo this.", confirmLabel: "Restore" });
      if (!ok) return;
    }
    try {
      const response = await api(`/api/posts/${encodeURIComponent(post.id)}/restore`, { method: "POST", body: jsonBody({ index }) });
      replacePost(response.post);
      await closeEditor(true);
      await openEditor(state.posts.find((item) => item.id === post.id) || response.post);
      state.editor.post = response.post;
      state.editor.side = "history";
      $$(".side-tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.side === "history"));
      renderSidePanel();
      toast("Version restored.", "success");
      loadPosts().catch(() => {});
    } catch (error) {
      toast(error.message, "error");
    }
  }

  function quickTime(kind) {
    let value;
    if (kind === "hour") value = msToNaive(naiveMs(nextHourNaive()));
    if (kind === "tomorrow") value = `${msToNaive(naiveMs(`${todayKey()}T00:00:00`) + 86_400_000).slice(0, 10)}T09:00:00`;
    if (kind === "slot") value = nextFreeSlot($("#post-id").value);
    if (!value) return;
    $("#post-schedule").value = value.slice(0, 16);
    updateStatusHint();
    updateDirty();
  }

  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const before = textarea.value.slice(0, start);
    const needsSpace = before && !/\s$/.test(before);
    textarea.setRangeText(`${needsSpace ? " " : ""}${text}`, start, end, "end");
    textarea.focus();
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /* ------------------------------------------------------------------ *
   * Shortcuts
   * ------------------------------------------------------------------ */

  function showShortcuts() {
    const rows = [
      ["N", "New post"],
      ["/", "Search posts"],
      ["R", "Refresh data"],
      ["G then O", "Go to Overview"],
      ["G then C", "Go to Content"],
      ["G then K", "Go to Calendar"],
      ["G then M", "Go to Media"],
      ["G then T", "Go to Templates"],
      ["G then A", "Go to Analytics"],
      ["G then S", "Go to Settings"],
      ["Ctrl / ⌘ + S", "Save the open post"],
      ["Esc", "Close dialog or editor"],
    ];
    openModal({
      title: "Keyboard shortcuts",
      body: `<dl class="shortcut-list">${rows.map(([keys, label]) => `<div><dt>${keys.split(" ").map((key) => (["then", "+"].includes(key) ? `<span>${key}</span>` : `<kbd>${esc(key)}</kbd>`)).join(" ")}</dt><dd>${esc(label)}</dd></div>`).join("")}</dl>`,
      actions: [{ label: "Close", className: "btn-ghost" }],
    });
  }

  function isTyping(event) {
    const target = event.target;
    return target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
  }

  /* ------------------------------------------------------------------ *
   * Event binding
   * ------------------------------------------------------------------ */

  async function refresh(button) {
    await withBusy(button, async () => {
      try {
        await loadAll();
        toast("Up to date.");
      } catch (error) {
        toast(error.message, "error");
      }
    });
  }

  function bind() {
    window.addEventListener("hashchange", handleRoute);
    $("#new-post").addEventListener("click", () => openEditor());
    $("#refresh").addEventListener("click", (event) => refresh(event.currentTarget));
    $("#mobile-menu").addEventListener("click", () => setSidebar(!$("#sidebar").classList.contains("is-open")));
    $("#scrim").addEventListener("click", () => setSidebar(false));
    $("#shortcuts-link").addEventListener("click", showShortcuts);
    $("#signout-link").hidden = !UNDER_PROXY;

    $("#global-search").addEventListener("submit", (event) => {
      event.preventDefault();
      state.content.q = $("#global-search-input").value.trim();
      state.content.page = 1;
      if (state.view !== "content") navigate("content");
      else renderContent();
    });
    $("#global-search-input").addEventListener(
      "input",
      debounce(() => {
        if (state.view !== "content") return;
        state.content.q = $("#global-search-input").value.trim();
        state.content.page = 1;
        renderContent();
      }, 200)
    );

    // Modal
    $("#modal-close").addEventListener("click", () => finishModal(null));
    $("#modal").addEventListener("mousedown", (event) => {
      if (event.target.id === "modal") finishModal(null);
    });
    $("#modal").addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const focusable = $$("#modal button:not([disabled]), #modal input, #modal select, #modal textarea, #modal a[href]").filter((node) => node.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    // Menus close on outside click / scroll / resize
    document.addEventListener("mousedown", (event) => {
      const menu = $("#menu");
      if (!menu.hidden && !menu.contains(event.target) && !menu._anchor?.contains(event.target)) closeMenu();
    });
    window.addEventListener("resize", closeMenu);
    $("#view").addEventListener("scroll", closeMenu, { passive: true });
    window.addEventListener("scroll", closeMenu, { passive: true });

    $("#banner-slot").addEventListener("click", (event) => {
      if (event.target.closest("[data-banner-retry]")) loadAll().catch((error) => toast(error.message, "error"));
    });

    // Drawer
    $("#drawer-close").addEventListener("click", () => closeEditor());
    $("#overlay").addEventListener("click", () => closeEditor());
    $("#post-form").addEventListener("submit", (event) => event.preventDefault());
    $("#post-form").addEventListener("input", (event) => {
      if (event.target.id === "post-content") schedulePreview();
      if (event.target.id === "post-title") $("#drawer-title").textContent = event.target.value.trim() || "Untitled post";
      if (event.target.id === "post-schedule") updateStatusHint();
      updateDirty();
    });
    $("#post-form").addEventListener("change", (event) => {
      if (event.target.closest("#channel-picker")) {
        event.target.closest(".channel-toggle")?.classList.toggle("is-checked", event.target.checked);
        schedulePreview(100);
      }
      if (event.target.id === "post-language") {
        applyLanguageDir();
        schedulePreview(100);
      }
      if (event.target.id === "post-status" || event.target.id === "post-schedule") updateStatusHint();
      updateDirty();
    });
    $("#post-form").addEventListener("click", (event) => {
      const insert = event.target.closest("[data-insert]");
      if (insert) insertAtCursor($("#post-content"), insert.dataset.insert);
      const pick = event.target.closest("[data-pick]");
      if (pick) {
        const mode = pick.dataset.pick;
        const keys = mode === "none" ? [] : state.connections.filter((channel) => (mode === "connected" ? channel.configured : channel.mode === "api")).map((channel) => channel.key);
        renderChannelPicker(keys);
        schedulePreview(100);
        updateDirty();
      }
      const quick = event.target.closest("[data-quick]");
      if (quick) quickTime(quick.dataset.quick);
    });
    $("#media-file").addEventListener("change", async (event) => {
      const files = event.target.files;
      if (!files?.length) return;
      const [media] = await uploadMany(files, { bar: $("#upload-bar"), label: $("#upload-label"), box: $("#upload-progress") });
      event.target.value = "";
      if (media) {
        setPostMedia({ ...media, source: "upload", alt: $("#post-media-alt").value });
        loadMedia().catch(() => {});
      }
    });
    const mediaBox = $("#media-box");
    ["dragenter", "dragover"].forEach((type) =>
      mediaBox.addEventListener(type, (event) => {
        if (![...(event.dataTransfer?.types || [])].includes("Files")) return;
        event.preventDefault();
        mediaBox.classList.add("is-drop");
      })
    );
    ["dragleave", "drop"].forEach((type) => mediaBox.addEventListener(type, () => mediaBox.classList.remove("is-drop")));
    mediaBox.addEventListener("drop", async (event) => {
      if (!event.dataTransfer?.files?.length) return;
      event.preventDefault();
      const [media] = await uploadMany([event.dataTransfer.files[0]], { bar: $("#upload-bar"), label: $("#upload-label"), box: $("#upload-progress") });
      if (media) {
        setPostMedia({ ...media, source: "upload" });
        loadMedia().catch(() => {});
      }
    });
    $("#media-library").addEventListener("click", openMediaPicker);
    $("#media-clear").addEventListener("click", () => setPostMedia(null));
    $("#media-url-toggle").addEventListener("click", () => {
      $("#media-url-row").hidden = !$("#media-url-row").hidden;
      if (!$("#media-url-row").hidden) $("#post-media-external").focus();
    });
    $("#media-url-apply").addEventListener("click", () => {
      const value = $("#post-media-external").value.trim();
      if (!/^https:\/\/\S+$/i.test(value)) return toast("Enter a public https:// image or video URL.", "error");
      const name = decodeURIComponent(value.split("?")[0].split("/").pop() || "media");
      const kind = /\.(mp4|mov|webm|m4v)$/i.test(name) ? "video" : "image";
      setPostMedia({ url: value, publicUrl: value, kind, name, source: "url", alt: $("#post-media-alt").value });
      $("#post-media-external").value = "";
    });
    $("#post-media-external").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        $("#media-url-apply").click();
      }
    });

    $("#save-draft").addEventListener("click", (event) => saveEditor({ status: "draft", button: event.currentTarget }));
    $("#post-save").addEventListener("click", (event) => saveEditor({ button: event.currentTarget }));
    $("#publish-dry").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      await withBusy(button, async () => {
        const saved = isEditorDirty() || !$("#post-id").value ? await saveEditor({ quiet: true }) : state.editor.post;
        if (!saved) return;
        const result = await publishPost(saved.id, true);
        if (result?.post) {
          state.editor.post = { ...state.editor.post, ...result.post };
          state.editor.snapshot = editorSnapshot();
          state.editor.side = "results";
          $$(".side-tab").forEach((tab) => {
            tab.classList.toggle("is-active", tab.dataset.side === "results");
            tab.setAttribute("aria-selected", tab.dataset.side === "results" ? "true" : "false");
          });
          renderSidePanel();
        }
      });
    });
    $("#publish-live").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const saved = isEditorDirty() || !$("#post-id").value ? await saveEditor({ quiet: true }) : state.editor.post;
      if (!saved) return;
      const result = await publishPost(saved.id, false, { button });
      if (result?.post) {
        state.editor.snapshot = editorSnapshot();
        await closeEditor(true);
      }
    });
    $("#post-delete").addEventListener("click", () => {
      const id = $("#post-id").value;
      if (id) deletePost(id, { fromEditor: true });
    });
    $("#post-save-template").addEventListener("click", saveAsTemplate);
    $(".side-tabs").addEventListener("click", (event) => {
      const tab = event.target.closest(".side-tab");
      if (!tab) return;
      state.editor.side = tab.dataset.side;
      $$(".side-tab").forEach((item) => {
        item.classList.toggle("is-active", item === tab);
        item.setAttribute("aria-selected", item === tab ? "true" : "false");
      });
      renderSidePanel();
    });
    $("#side-panel").addEventListener("click", (event) => {
      const restore = event.target.closest("[data-restore]");
      if (restore) restoreRevision(Number(restore.dataset.restore));
      if (event.target.closest("[data-side-status]") && state.editor.post?.id) showChannelStatus(state.editor.post.id);
      const toggle = event.target.closest("[data-override-toggle]");
      if (toggle) {
        const channel = toggle.dataset.overrideToggle;
        const open = state.editor.openOverrides || (state.editor.openOverrides = new Set());
        if (open.has(channel)) open.delete(channel);
        else {
          open.add(channel);
          if (!state.editor.overrides[channel]) state.editor.overrides[channel] = $("#post-content").value;
        }
        renderSidePanel();
        if (open.has(channel)) $(`[data-override="${channel}"]`)?.focus();
        schedulePreview(100);
        updateDirty();
      }
      const reset = event.target.closest("[data-override-reset]");
      if (reset) {
        delete state.editor.overrides[reset.dataset.overrideReset];
        state.editor.openOverrides?.delete(reset.dataset.overrideReset);
        renderSidePanel();
        schedulePreview(50);
        updateDirty();
      }
    });
    $("#side-panel").addEventListener("input", (event) => {
      const box = event.target.closest("[data-override]");
      if (!box) return;
      state.editor.overrides[box.dataset.override] = box.value;
      schedulePreview();
      updateDirty();
    });

    // Keyboard
    let gPressed = 0;
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (!$("#menu").hidden) return closeMenu();
        if (!$("#modal").hidden) return finishModal(null);
        if (!$("#drawer").hidden) return closeEditor();
        if ($("#sidebar").classList.contains("is-open")) return setSidebar(false);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && !$("#drawer").hidden) {
        event.preventDefault();
        saveEditor({ button: $("#post-save") });
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event) || !$("#modal").hidden) return;
      const key = event.key.toLowerCase();
      if (Date.now() - gPressed < 900) {
        const map = { o: "overview", c: "content", k: "calendar", m: "media", t: "templates", a: "analytics", s: "settings", r: "reports" };
        gPressed = 0;
        if (map[key]) {
          event.preventDefault();
          if (!$("#drawer").hidden) closeEditor().then((closed) => closed && navigate(map[key]));
          else navigate(map[key]);
        }
        return;
      }
      if (!$("#drawer").hidden) return;
      if (key === "g") gPressed = Date.now();
      else if (key === "/") {
        event.preventDefault();
        $("#global-search-input").focus();
        $("#global-search-input").select();
      } else if (key === "n") {
        event.preventDefault();
        openEditor();
      } else if (key === "r") refresh($("#refresh"));
      else if (key === "?") showShortcuts();
    });

    window.addEventListener("beforeunload", (event) => {
      if (isEditorDirty()) {
        event.preventDefault();
        event.returnValue = "";
      }
    });

    // View delegation
    const view = $("#view");
    view.addEventListener("click", async (event) => {
      const target = event.target.closest("button, a[data-edit], [data-row]");
      if (!target) return;
      const d = target.dataset;
      if (d.new !== undefined) return openEditor();
      if (d.edit) {
        event.preventDefault();
        const post = state.posts.find((item) => item.id === d.edit);
        if (post) openEditor(post);
        return;
      }
      if (d.approve) return updateStatus(d.approve, "scheduled");
      if (d.rowMenu) return rowMenu(target, d.rowMenu);
      if (d.tab !== undefined) {
        state.content.status = d.tab;
        state.content.page = 1;
        state.content.selected.clear();
        history.replaceState(null, "", `#/content${d.tab ? `?status=${d.tab}` : ""}`);
        return renderContent();
      }
      if (d.clearFilters !== undefined) {
        Object.assign(state.content, { channel: "", lang: "", pillar: "", tag: "", when: "", q: "", page: 1 });
        if (d.clearStatus !== undefined) state.content.status = "";
        $("#global-search-input").value = "";
        history.replaceState(null, "", "#/content");
        return renderContent();
      }
      if (d.page) {
        state.content.page += d.page === "next" ? 1 : -1;
        renderContent();
        $(".content-table")?.scrollIntoView({ block: "start", behavior: "smooth" });
        return;
      }
      if (d.selectAllMatching !== undefined) {
        const c = state.content;
        for (const post of contentFiltered({ ignoreStatus: true }).filter((post) => !c.status || post.status === c.status)) c.selected.add(post.id);
        return renderContent();
      }
      if (d.bulk) return bulkAction(d.bulk);
      if (d.bulkMenu) return bulkMenu(target, d.bulkMenu);
      if (d.cal) {
        const cal = state.calendar;
        if (d.cal === "today") cal.month = todayKey().slice(0, 7);
        else {
          const [y, m] = cal.month.split("-").map(Number);
          const next = new Date(Date.UTC(y, m - 1 + (d.cal === "next" ? 1 : -1), 1));
          cal.month = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}`;
        }
        history.replaceState(null, "", `#/calendar?month=${cal.month}`);
        return renderCalendar();
      }
      if (d.calNew) return openEditor(null, { scheduledAt: `${d.calNew}T09:00:00` });
      if (d.calDay) return openDayModal(d.calDay);
      if (d.mediaFilter) {
        state.mediaView.filter = d.mediaFilter;
        return renderMedia();
      }
      if (d.mediaCopy) return copyText(/^https?:/i.test(d.mediaCopy) ? d.mediaCopy : `${location.origin}${d.mediaCopy}`);
      if (d.mediaDelete) return deleteMedia(d.mediaDelete);
      if (d.mediaUse) {
        const [origin, ...rest] = d.mediaUse.split(":");
        const id = rest.join(":");
        const item = allMediaEntries().find((entry) => entry.origin === origin && String(entry.id) === id);
        if (item) openEditor(null, { media: mediaEntryToPostMedia(item), pillar: (item.pillars || [])[0] || "product" });
        return;
      }
      if (d.templateNew !== undefined) return openTemplateModal();
      if (d.templateUse) return useTemplate(d.templateUse);
      if (d.templateEdit) return openTemplateModal(state.templates.find((item) => item.id === d.templateEdit));
      if (d.templateDelete) return deleteTemplate(d.templateDelete);
      // Inbox
      if (d.inboxSync !== undefined) return syncInbox(target);
      if (d.inboxTab !== undefined) {
        Object.assign(state.inboxView, { status: d.inboxTab, offset: 0 });
        state.inboxSelected.clear();
        state.inbox = null;
        return renderInbox();
      }
      if (d.inboxPage) {
        const v = state.inboxView;
        v.offset = Math.max(0, v.offset + (d.inboxPage === "next" ? v.limit : -v.limit));
        state.inbox = null;
        return renderInbox();
      }
      if (d.inboxBulk) {
        if (d.inboxBulk === "clear") {
          state.inboxSelected.clear();
          return renderInbox();
        }
        return setCommentStatus([...state.inboxSelected], d.inboxBulk);
      }
      if (d.commentReply) return openComposer(d.commentReply, "reply");
      if (d.commentDm) return openComposer(d.commentDm, "dm");
      if (d.commentMore) return commentMenu(target, d.commentMore);
      if (d.composerCancel !== undefined) {
        const box = target.closest(".composer");
        box.hidden = true;
        box.innerHTML = "";
        return;
      }
      if (d.composerToken) return insertAtCursor(target.closest(".composer").querySelector("textarea"), d.composerToken);
      if (d.savedMenu !== undefined) return savedRepliesMenu(target, target.closest(".composer").querySelector("textarea"));
      if (d.composerSend) return sendComposer(target.closest(".composer").dataset.composer, d.composerSend, target);
      // Comment → DM rules
      if (d.autoTab) {
        state.autoTab = d.autoTab;
        history.replaceState(null, "", `#/automations?tab=${d.autoTab}`);
        return renderAutomations();
      }
      if (d.cruleNew !== undefined) return openCommentRuleModal();
      if (d.crulePreset) {
        const preset = COMMENT_RULE_PRESETS.find((item) => item.key === d.crulePreset);
        return preset && openCommentRuleModal(null, preset.rule);
      }
      if (d.cruleTest) return testCommentRule(d.cruleTest);
      if (d.cruleEdit) return openCommentRuleModal(state.commentRules?.rules.find((item) => item.id === d.cruleEdit));
      if (d.cruleDelete) return commentRuleAction("delete", d.cruleDelete);
      if (d.autoNew !== undefined) return openAutomationModal();
      if (d.autoPreset) {
        const preset = AUTOMATION_PRESETS.find((item) => item.key === d.autoPreset);
        if (preset) return openAutomationModal(null, preset.rule);
        return;
      }
      if (d.autoTest) return testAutomation(d.autoTest);
      if (d.autoEdit) return openAutomationModal(state.automations?.automations.find((item) => item.id === d.autoEdit));
      if (d.autoMore) return automationMenu(target, d.autoMore);
      if (d.autoRunDetail) {
        const run = state.automations?.runs?.[Number(d.autoRunDetail)];
        if (run) openModal({ title: `${run.ruleName} · ${fmtInstant(run.at)}`, wide: true, body: `<p class="prose">On <strong dir="auto">${esc(run.postTitle)}</strong> (${esc(run.source)}).</p>${outcomesTable(run.outcomes || [])}`, actions: [{ label: "Close", className: "btn-ghost" }] });
        return;
      }
      if (d.applyRecommended !== undefined) return applyRecommendedRules(target);
      if (d.rules) return openChannelSetup(d.rules, "rules");
      if (d.healthRefresh !== undefined) {
        state.audit = null;
        return withBusy(target, renderHealth);
      }
      if (d.healthFilter) {
        state.healthFilter = d.healthFilter;
        renderHealth();
        $(".issue-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (d.trashRestore) return trashAction("restore", d.trashRestore);
      if (d.trashDelete) return trashAction("delete", d.trashDelete);
      if (d.trashEmpty !== undefined) return trashAction("empty");
      if (d.connFilter) {
        state.connectionsFilter = d.connFilter;
        return renderConnections();
      }
      if (d.connect) return openChannelSetup(d.connect);
      if (d.testChannel) return testChannel(d.testChannel, target).then(() => state.view === "connections" && renderConnections());
      if (d.testAll !== undefined) return testAllConnections(target);
      if (d.syncMetrics !== undefined) return syncMetrics(target);
      if (d.reportsRefresh !== undefined) {
        state.reports = null;
        return withBusy(target, renderReports);
      }
      if (d.saveSettings !== undefined) return saveSettings(target);
      if (d.importQueue !== undefined) return importQueue();
      if (d.activityPage) {
        const a = state.activityView;
        a.offset = Math.max(0, a.offset + (d.activityPage === "next" ? a.limit : -a.limit));
        state.activity = null;
        return renderActivity();
      }
    });

    view.addEventListener("dblclick", (event) => {
      const row = event.target.closest("[data-row]");
      if (row && !event.target.closest("button, input, a")) {
        const post = state.posts.find((item) => item.id === row.dataset.row);
        if (post) openEditor(post);
      }
    });

    view.addEventListener("change", (event) => {
      const { id } = event.target;
      const c = state.content;
      if (event.target.dataset.select) {
        if (event.target.checked) c.selected.add(event.target.dataset.select);
        else c.selected.delete(event.target.dataset.select);
        return renderContent();
      }
      if (id === "select-page") {
        const filtered = sortPosts(contentFiltered({ ignoreStatus: true }).filter((post) => !c.status || post.status === c.status));
        const pageItems = filtered.slice((c.page - 1) * c.pageSize, c.page * c.pageSize);
        for (const post of pageItems) {
          if (event.target.checked) c.selected.add(post.id);
          else c.selected.delete(post.id);
        }
        return renderContent();
      }
      const filterMap = { "filter-when": "when", "filter-channel": "channel", "filter-lang": "lang", "filter-pillar": "pillar", "filter-tag": "tag", "filter-sort": "sort" };
      if (filterMap[id]) {
        c[filterMap[id]] = event.target.value;
        c.page = 1;
        return renderContent();
      }
      if (id === "page-size") {
        c.pageSize = Number(event.target.value) || 25;
        c.page = 1;
        storageSet("portal_page_size", c.pageSize);
        return renderContent();
      }
      if (id === "cal-lang" || id === "cal-channel") {
        state.calendar[id === "cal-lang" ? "lang" : "channel"] = event.target.value;
        return renderCalendar();
      }
      if (event.target.dataset.autoToggle) return toggleAutomation(event.target.dataset.autoToggle, event.target.checked);
      if (event.target.dataset.cruleToggle) return commentRuleAction("toggle", event.target.dataset.cruleToggle, event.target.checked);
      if (event.target.dataset.commentSelect) {
        if (event.target.checked) state.inboxSelected.add(event.target.dataset.commentSelect);
        else state.inboxSelected.delete(event.target.dataset.commentSelect);
        return renderInbox();
      }
      if (id === "inbox-channel") {
        Object.assign(state.inboxView, { channel: event.target.value, offset: 0 });
        state.inbox = null;
        return renderInbox();
      }
      if (id === "health-filter") {
        state.healthFilter = event.target.value;
        return renderHealth();
      }
      if (id === "activity-type") {
        state.activityView.type = event.target.value;
        state.activityView.offset = 0;
        state.activity = null;
        return renderActivity();
      }
      if (id === "media-page-file") {
        uploadMany(event.target.files, { bar: $("#page-upload-bar"), label: $("#page-upload-label"), box: $("#page-upload-progress") }).then(async () => {
          await loadMedia();
          if (state.view === "media") renderMedia();
        });
      }
    });

    const searchInput = debounce((target) => {
      if (target.id === "filter-q") {
        state.content.q = target.value;
        state.content.page = 1;
        $("#global-search-input").value = target.value;
        const caret = target.selectionStart;
        renderContent();
        const input = $("#filter-q");
        input.focus();
        input.setSelectionRange(caret, caret);
      }
      if (target.id === "media-q") {
        state.mediaView.q = target.value;
        const caret = target.selectionStart;
        renderMedia();
        const input = $("#media-q");
        input.focus();
        input.setSelectionRange(caret, caret);
      }
      if (target.id === "inbox-q") {
        Object.assign(state.inboxView, { q: target.value, offset: 0 });
        state.inbox = null;
        renderInbox().then(() => {
          const input = $("#inbox-q");
          if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
          }
        });
      }
      if (target.id === "activity-q") {
        state.activityView.q = target.value;
        state.activityView.offset = 0;
        state.activity = null;
        renderActivity().then(() => {
          const input = $("#activity-q");
          if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
          }
        });
      }
    }, 220);
    view.addEventListener("input", (event) => {
      if (["filter-q", "media-q", "activity-q", "inbox-q"].includes(event.target.id)) searchInput(event.target);
    });

    // Calendar drag & drop
    view.addEventListener("dragstart", (event) => {
      const chip = event.target.closest("[data-drag]");
      if (!chip) return;
      event.dataTransfer.setData("text/x-post-id", chip.dataset.drag);
      event.dataTransfer.effectAllowed = "move";
      chip.classList.add("is-dragging");
    });
    view.addEventListener("dragend", (event) => event.target.closest?.("[data-drag]")?.classList.remove("is-dragging"));
    view.addEventListener("dragover", (event) => {
      const day = event.target.closest("[data-day]");
      if (day && [...event.dataTransfer.types].includes("text/x-post-id")) {
        event.preventDefault();
        $$(".calendar-day.is-drop").forEach((node) => node !== day && node.classList.remove("is-drop"));
        day.classList.add("is-drop");
      }
      const zone = event.target.closest("#media-dropzone");
      if (zone && [...event.dataTransfer.types].includes("Files")) {
        event.preventDefault();
        zone.classList.add("is-drop");
      }
    });
    view.addEventListener("dragleave", (event) => {
      const day = event.target.closest("[data-day]");
      if (day && !day.contains(event.relatedTarget)) day.classList.remove("is-drop");
      const zone = event.target.closest("#media-dropzone");
      if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove("is-drop");
    });
    view.addEventListener("drop", (event) => {
      const day = event.target.closest("[data-day]");
      const id = event.dataTransfer.getData("text/x-post-id");
      if (day && id) {
        event.preventDefault();
        day.classList.remove("is-drop");
        reschedulePost(id, day.dataset.day);
        return;
      }
      const zone = event.target.closest("#media-dropzone");
      if (zone && event.dataTransfer.files?.length) {
        event.preventDefault();
        zone.classList.remove("is-drop");
        uploadMany(event.dataTransfer.files, { bar: $("#page-upload-bar"), label: $("#page-upload-label"), box: $("#page-upload-progress") }).then(async () => {
          await loadMedia();
          if (state.view === "media") renderMedia();
        });
      }
    });

    // Keep data fresh while the tab is visible and nothing is being edited.
    setInterval(() => {
      if (document.visibilityState !== "visible" || !$("#drawer").hidden || !$("#modal").hidden || !$("#menu").hidden) return;
      if (Date.now() - state.loadedAt < 55_000) return;
      if (["settings"].includes(state.view)) return;
      if (document.activeElement && $("#view").contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (state.content.selected.size && state.view === "content") return;
      loadPosts().catch(() => {});
    }, 15_000);
  }

  async function boot() {
    bind();
    renderView();
    const { view } = parseHash();
    state.view = view;
    try {
      await loadAll();
      handleRoute();
    } catch (error) {
      $("#view").innerHTML = `<div class="card">${emptyState("Portal API unavailable", error.message, `<button class="btn btn-primary btn-sm" onclick="location.reload()">Retry</button>`)}</div>`;
    }
  }

  boot();
})();
