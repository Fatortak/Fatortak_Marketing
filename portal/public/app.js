(() => {
  "use strict";

  const state = {
    view: "overview",
    overview: null,
    posts: [],
    connections: [],
    metrics: null,
    reports: null,
    settings: null,
    mediaLibrary: [],
    mediaFiles: [],
    filters: { status: "", channel: "", lang: "", q: "" },
    calendarMonth: monthKey(new Date()),
    editing: null,
    token: localStorage.getItem("portal_token") || "",
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function localDateKey(date) {
    return `${monthKey(date)}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function localDateTimeValue(date) {
    return `${localDateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  const PAGE_META = {
    overview: ["Overview", "One control room for every channel."],
    calendar: ["Calendar", "See the publishing rhythm and catch gaps."],
    queue: ["Content", "Review, schedule and publish every post."],
    composer: ["Composer", "Write once, adapt for every connected channel."],
    connections: ["Connections", "What is automated, what needs API approval, and why."],
    analytics: ["Analytics", "Traffic, followers, engagement and channel health."],
    reports: ["Reports", "What worked, what to change, and what to do next."],
    settings: ["Settings", "Portal behavior and publishing safety."],
  };

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fmtNumber(value) {
    const n = Number(value || 0);
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
  }

  function fmtDate(value, withTime = true) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    }).format(date);
  }

  function statusChip(status) {
    const label = String(status || "draft").replace(/_/g, " ");
    return `<span class="status ${esc(status)}">${esc(label)}</span>`;
  }

  function channelLabel(key) {
    const channel = state.connections.find((item) => item.key === key);
    return channel ? channel.label : key;
  }

  function channelChips(channels) {
    return `<div class="chips">${(channels || []).map((channel) => `<span class="chip">${esc(channelLabel(channel))}</span>`).join("")}</div>`;
  }

  function channelIcon(key, label) {
    return `<span class="channel-icon"><img src="icons/${esc(key)}.svg" alt="" loading="lazy" onerror="this.style.display='none';this.parentElement.textContent='${esc((label || key).slice(0, 2).toUpperCase())}'" /></span>`;
  }

  function channelStatusChip(channel) {
    if (channel.configured && verifiedFresh(channel)) return `<span class="chip lime">verified</span>`;
    if (channel.configured && channel.verified?.ok) return `<span class="chip amber">test stale</span>`;
    if (channel.configured && channel.verified && !channel.verified.ok) return `<span class="chip rose">test failed</span>`;
    if (channel.configured) return `<span class="chip cyan">configured</span>`;
    if (channel.mode === "monitoring") return `<span class="chip cyan">monitoring</span>`;
    if (channel.mode === "restricted") return `<span class="chip muted">blocked by platform</span>`;
    return `<span class="chip amber">needs setup</span>`;
  }

  function verifiedFresh(channel) {
    const check = channel.verified;
    if (!check?.ok || !check.at) return false;
    return Date.now() - new Date(check.at).getTime() < 24 * 60 * 60 * 1000;
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

  function toast(message, type = "") {
    const node = document.createElement("div");
    node.className = `toast ${type}`;
    node.textContent = message;
    $("#toasts").appendChild(node);
    setTimeout(() => node.remove(), 4200);
  }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
    const response = await fetch(path, { ...options, headers });
    if (response.status === 401) {
      const token = window.prompt("Portal access token");
      if (token) {
        state.token = token;
        localStorage.setItem("portal_token", token);
        return api(path, options);
      }
      throw new Error("Unauthorized");
    }
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }

  async function refreshAll() {
    const [overview, posts, connections, metrics, reports, settings, media] = await Promise.all([
      api("/api/overview"),
      api("/api/posts"),
      api("/api/connections"),
      api("/api/metrics"),
      api("/api/reports/summary"),
      api("/api/settings"),
      api("/api/media"),
    ]);
    state.overview = overview;
    state.posts = posts.posts || [];
    state.connections = connections.channels || [];
    state.metrics = metrics;
    state.reports = reports;
    state.settings = settings.settings;
    state.mediaLibrary = media.library || [];
    state.mediaFiles = media.media || [];
    renderMode();
    renderView();
    renderSitePill();
  }

  async function refreshConnections() {
    const configured = state.connections.filter((channel) => channel.configured);
    const outcomes = await Promise.allSettled(
      configured.map((channel) => api(`/api/connections/${channel.key}/test`, { method: "POST", body: "{}" }))
    );
    await refreshAll();
    const failed = outcomes.filter((outcome) => outcome.status === "rejected" || !outcome.value?.result?.ok).length;
    toast(
      failed ? `${failed} connection test${failed === 1 ? "" : "s"} failed.` : `Tested ${configured.length} connected channel${configured.length === 1 ? "" : "s"}.`,
      failed ? "error" : "success"
    );
  }

  function renderMode() {
    const overview = state.overview;
    if (!overview) return;
    const live = overview.live && !overview.dryRun;
    $("#mode-dot").classList.toggle("live", live);
    $("#mode-label").textContent = live ? "Live mode" : overview.dryRun ? "Dry run" : "Live locked";
    $("#mode-detail").textContent = overview.autoPublish ? "Auto-publish scheduled" : "Auto-publish off";
  }

  function renderSitePill() {
    const overview = state.overview;
    if (!overview) return;
    const pill = $("#site-pill");
    const text = $("#site-pill-text");
    pill.classList.toggle("live", overview.siteLive);
    text.textContent = overview.siteLive ? "Landing page live" : "Landing page not live";
  }

  function setSidebar(open) {
    $("#sidebar").classList.toggle("is-open", Boolean(open));
    $("#scrim").hidden = !open;
  }

  function setView(view) {
    state.view = view;
    $$(".nav-item").forEach((item) => item.classList.toggle("is-active", item.dataset.view === view));
    const meta = PAGE_META[view] || PAGE_META.overview;
    $("#page-title").textContent = meta[0];
    $("#page-subtitle").textContent = meta[1];
    setSidebar(false);
    renderView();
  }

  function renderView() {
    const view = state.view;
    if (!state.overview) {
      $("#view").innerHTML = `<div class="card card-pad"><div class="skeleton" style="width:45%"></div><div class="skeleton" style="width:70%;margin-top:10px"></div><div class="skeleton" style="width:60%;margin-top:10px"></div></div>`;
      return;
    }
    if (view === "overview") renderOverview();
    else if (view === "calendar") renderCalendar();
    else if (view === "queue") renderQueue();
    else if (view === "composer") renderComposer();
    else if (view === "connections") renderConnections();
    else if (view === "analytics") renderAnalytics();
    else if (view === "reports") renderReports();
    else if (view === "settings") renderSettings();
  }

  function kpi(label, value, foot) {
    return `<div class="card kpi"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${value}</div><div class="kpi-foot">${foot || ""}</div></div>`;
  }

  function renderOverview() {
    const o = state.overview;
    const posts = o.posts || {};
    const metrics = o.metrics?.totals || {};
    const traffic = o.traffic || {};
    const followers = metrics.followers || 0;
    const engagementRate = followers ? ((metrics.engagement || 0) / followers) * 100 : 0;
    const pipeline = [
      ["Needs review", posts.needsReview || 0],
      ["Scheduled", posts.scheduled || 0],
      ["Published", posts.published || 0],
      ["Failed", posts.failed || 0],
      ["Blocked", posts.blocked || 0],
    ];
    const maxPipeline = Math.max(1, ...pipeline.map(([, n]) => n));
    const channels = o.channels || [];
    const upcoming = posts.upcoming || [];
    const activity = o.activity || [];

    $("#view").innerHTML = `
      <div class="grid kpis">
        ${kpi("Scheduled", fmtNumber(posts.scheduled), `<span class="up">●</span> ${o.siteLive ? "site live" : "site not live"}`)}
        ${kpi("Needs review", fmtNumber(posts.needsReview), `<span class="${posts.needsReview ? "warn" : "up"}">●</span> ${posts.needsReview ? "review queue" : "all clear"}`)}
        ${kpi("Published · 30d", fmtNumber(posts.published30), `<span class="up">●</span> ${fmtNumber(posts.published)} total`)}
        ${kpi("Followers", fmtNumber(followers), `${engagementRate ? engagementRate.toFixed(1) + "% engagement" : "connect APIs for metrics"}`)}
      </div>
      <div class="section two-col">
        <div class="card card-pad">
          <div class="section-head"><h3>Publishing pipeline</h3><span>${fmtNumber(posts.total)} posts</span></div>
          <div class="pipeline">
            ${pipeline.map(([label, count]) => `
              <div class="pipeline-row"><label>${label}</label><div class="pipeline-track"><div class="pipeline-fill" style="width:${Math.round((count / maxPipeline) * 100)}%"></div></div><strong>${fmtNumber(count)}</strong></div>
            `).join("")}
          </div>
          <div class="section-head" style="margin-top:20px"><h3>Traffic · 30 days</h3><span>${traffic.configured ? traffic.provider === "first-party" ? "First-party" : "Plausible" : "not connected"}</span></div>
          ${traffic.configured && !traffic.error ? `
            <div class="grid" style="grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">
              <div><div class="kpi-label">Visitors</div><div class="kpi-value" style="font-size:1.25rem">${fmtNumber(traffic.visitors)}</div></div>
              <div><div class="kpi-label">Pageviews</div><div class="kpi-value" style="font-size:1.25rem">${fmtNumber(traffic.pageviews)}</div></div>
              <div><div class="kpi-label">Bounce</div><div class="kpi-value" style="font-size:1.25rem">${traffic.bounceRate ? fmtNumber(traffic.bounceRate) + "%" : "—"}</div></div>
            </div>` : `<div class="empty" style="padding:18px 0"><strong>${traffic.error ? "Traffic sync failed" : "Connect analytics"}</strong><span>${esc(traffic.error || "Deploy stats.php on the landing page or add PLAUSIBLE_SITE_ID and PLAUSIBLE_API_KEY.")}</span></div>`}
        </div>
        <div class="card card-pad">
          <div class="section-head"><h3>Automation</h3><span>${o.autoPublish ? "scheduler on" : "scheduler off"}</span></div>
          <div class="setting-row"><div><strong>Publishing mode</strong><span>${o.live ? "Live API publishing is available" : "Live publishing is locked by env"}</span></div><span class="chip ${o.live && !o.dryRun ? "lime" : "amber"}">${o.live && !o.dryRun ? "LIVE" : "DRY RUN"}</span></div>
          <div class="setting-row"><div><strong>Landing page</strong><span>${esc(o.siteUrl || "")}</span></div><span class="chip ${o.siteLive ? "lime" : "rose"}">${o.siteLive ? "LIVE" : "NOT LIVE"}</span></div>
          <div class="setting-row"><div><strong>Queue source</strong><span>${fmtNumber(o.queue?.total)} items · ${fmtNumber(o.queue?.posted)} posted</span></div><span class="chip">${o.queue?.next ? "next " + esc(o.queue.next.date) : "empty"}</span></div>
          <div class="setting-row"><div><strong>Connected channels</strong><span>${channels.filter((c) => c.configured).length} of ${channels.length} API-ready</span></div><span class="chip purple">${channels.filter((c) => c.mode === "api").length} API modes</span></div>
        </div>
      </div>
      <div class="section card">
        <div class="card-pad" style="padding-bottom:4px"><div class="section-head"><h3>Channel health</h3><span>Posting + monitoring</span></div></div>
        <div class="table-wrap"><table><thead><tr><th>Channel</th><th>Mode</th><th>Status</th><th>Followers</th><th>Engagement</th><th>Clicks</th><th>Last sync</th><th></th></tr></thead><tbody>
          ${channels.map((channel) => `
            <tr>
              <td><div class="channel-name">${channelIcon(channel.key, channel.label)}<div><strong>${esc(channel.label)}</strong><span>${esc(channel.profile || "No profile URL")}</span></div></div></td>
              <td><span class="chip ${channel.mode === "api" ? "purple" : channel.mode === "monitoring" ? "cyan" : "muted"}">${esc(channel.mode)}</span></td>
              <td>${channelStatusChip(channel)}</td>
              <td>${fmtNumber(channel.metrics?.followers)}</td>
              <td>${fmtNumber(channel.metrics?.engagement)}</td>
              <td>${fmtNumber(channel.metrics?.clicks)}</td>
              <td>${channel.metrics?.lastUpdated ? fmtDate(channel.metrics.lastUpdated, false) : "—"}</td>
              <td class="row-actions">${channel.profile ? `<a class="icon-btn" href="${esc(channel.profile)}" target="_blank" rel="noopener" title="Open profile"><svg><use href="#i-external"></use></svg></a>` : ""}</td>
            </tr>
          `).join("")}
        </tbody></table></div>
      </div>
      <div class="section two-col">
        <div class="card card-pad">
          <div class="section-head"><h3>Upcoming</h3><button class="btn btn-ghost btn-sm" data-view="queue">Open content</button></div>
          ${upcoming.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Post</th><th>Channels</th><th>Status</th></tr></thead><tbody>
            ${upcoming.map((post) => `<tr data-edit="${esc(post.id)}" style="cursor:pointer"><td>${fmtDate(post.scheduledAt)}</td><td><div class="cell-title"><strong>${esc(post.title)}</strong><span>${esc(post.language.toUpperCase())} · ${esc(post.pillar)}</span></div></td><td>${channelChips(post.channels)}</td><td>${statusChip(post.status)}</td></tr>`).join("")}
          </tbody></table></div>` : `<div class="empty"><strong>No upcoming posts</strong><span>Create or schedule a post to see it here.</span></div>`}
        </div>
        <div class="card card-pad">
          <div class="section-head"><h3>Activity</h3><span>latest</span></div>
          <div class="report-list">
            ${activity.length ? activity.map((item) => `<div class="report-item">${esc(item.message)}<br><span style="color:var(--muted-2);font-size:.6rem">${fmtDate(item.at)}</span></div>`).join("") : `<div class="empty"><strong>No activity yet</strong><span>Publish or edit a post to start the log.</span></div>`}
          </div>
        </div>
      </div>
    `;
  }

  function renderCalendar() {
    const month = state.calendarMonth;
    const [year, monthNumber] = month.split("-").map(Number);
    const first = new Date(year, monthNumber - 1, 1);
    const startDay = first.getDay();
    const days = new Date(year, monthNumber, 0).getDate();
    const prevDays = new Date(year, monthNumber - 1, 0).getDate();
    const cells = [];
    for (let i = startDay - 1; i >= 0; i -= 1) cells.push({ day: prevDays - i, outside: true, date: null });
    for (let day = 1; day <= days; day += 1) {
      const date = `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ day, outside: false, date });
    }
    let trailing = 1;
    while (cells.length % 7 !== 0) cells.push({ day: trailing++, outside: true, date: null });
    const today = localDateKey(new Date());
    const postsByDate = {};
    for (const post of state.posts) {
      const date = (post.scheduledAt || "").slice(0, 10);
      if (!postsByDate[date]) postsByDate[date] = [];
      postsByDate[date].push(post);
    }
    const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(first);

    $("#view").innerHTML = `
      <div class="page-head"><div><span class="eyebrow">Publishing calendar</span><h2>${monthName}</h2><p>Click a post to edit it. The queue is in Cairo time.</p></div>
      <div class="page-head-actions"><button class="btn btn-ghost" data-cal-prev>Previous</button><button class="btn btn-ghost" data-cal-today>Today</button><button class="btn btn-ghost" data-cal-next>Next</button><button class="btn btn-primary" data-new>New post</button></div></div>
      <div class="card card-pad">
        <div class="calendar-grid">
          ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => `<div class="calendar-dow">${day}</div>`).join("")}
          ${cells.map((cell) => `
            <div class="calendar-day ${cell.outside ? "is-outside" : ""} ${cell.date === today ? "is-today" : ""}">
              <div class="calendar-day-number">${cell.day}</div>
              ${cell.date ? (postsByDate[cell.date] || []).slice(0, 4).map((post) => `<button class="calendar-post ${esc(post.status)}" data-edit="${esc(post.id)}" title="${esc(post.title)}">${esc(post.title)}</button>`).join("") : ""}
              ${cell.date && (postsByDate[cell.date] || []).length > 4 ? `<div class="calendar-day-number">+${postsByDate[cell.date].length - 4} more</div>` : ""}
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderQueue() {
    const filters = state.filters;
    const posts = state.posts.filter((post) => {
      if (filters.status && post.status !== filters.status) return false;
      if (filters.channel && !(post.channels || []).includes(filters.channel)) return false;
      if (filters.lang && post.language !== filters.lang) return false;
      if (filters.q && !`${post.title} ${post.content}`.toLowerCase().includes(filters.q.toLowerCase())) return false;
      return true;
    });
    $("#view").innerHTML = `
      <div class="page-head"><div><span class="eyebrow">Content queue</span><h2>${fmtNumber(posts.length)} posts</h2><p>Review, edit, schedule and publish across every channel.</p></div>
      <div class="page-head-actions"><button class="btn btn-ghost" data-import-queue>Import 90-day queue</button><button class="btn btn-primary" data-new>New post</button></div></div>
      <div class="card toolbar">
        <div class="search"><svg><use href="#i-search"></use></svg><input id="filter-q" placeholder="Search posts…" value="${esc(filters.q)}" /></div>
        <select id="filter-status"><option value="">All statuses</option>${["needs_review","scheduled","published","failed","blocked","dry_run","draft","approved"].map((status) => `<option value="${status}" ${filters.status === status ? "selected" : ""}>${status.replace(/_/g, " ")}</option>`).join("")}</select>
        <select id="filter-channel"><option value="">All channels</option>${state.connections.map((channel) => `<option value="${esc(channel.key)}" ${filters.channel === channel.key ? "selected" : ""}>${esc(channel.label)}</option>`).join("")}</select>
        <select id="filter-lang"><option value="">EN + AR</option><option value="en" ${filters.lang === "en" ? "selected" : ""}>English</option><option value="ar" ${filters.lang === "ar" ? "selected" : ""}>Arabic</option></select>
      </div>
      <div class="card">
        ${posts.length ? `<div class="table-wrap"><table><thead><tr><th>Post</th><th>Channels</th><th>Schedule</th><th>Status</th><th></th></tr></thead><tbody>
          ${posts.map((post) => `
            <tr>
              <td><div class="post-title-wrap">${post.mediaUrl ? `<div class="post-thumb"><img src="${esc(post.mediaUrl)}" alt="${esc(post.mediaAlt || "")}" loading="lazy" /></div>` : `<div class="post-thumb is-empty"></div>`}<div class="cell-title"><strong>${esc(post.title)}</strong><span>${esc(post.language.toUpperCase())} · ${esc(post.pillar)}${post.source === "queue" ? " · queue" : ""} · ${post.mediaUrl ? esc(post.mediaKind || "media") : "no media"}</span></div></div></td>
              <td>${channelChips(post.channels)}</td>
              <td>${fmtDate(post.scheduledAt)}</td>
              <td>${statusChip(post.status)}</td>
              <td class="row-actions">
                <button class="icon-btn" data-edit="${esc(post.id)}" title="Edit"><svg><use href="#i-pen"></use></svg></button>
                <button class="icon-btn" data-dry="${esc(post.id)}" title="Dry-run publish"><svg><use href="#i-send"></use></svg></button>
                <button class="icon-btn" data-publish="${esc(post.id)}" title="Publish live"><svg><use href="#i-check"></use></svg></button>
                <button class="icon-btn" data-delete="${esc(post.id)}" title="Delete"><svg><use href="#i-trash"></use></svg></button>
              </td>
            </tr>
          `).join("")}
        </tbody></table></div>` : `<div class="empty"><strong>No posts match</strong><span>Change the filters or create a new post.</span></div>`}
      </div>
    `;
  }

  function renderComposer() {
    const drafts = state.posts.filter((post) => ["draft", "needs_review"].includes(post.status)).slice(0, 6);
    $("#view").innerHTML = `
      <div class="page-head"><div><span class="eyebrow">Composer</span><h2>Write once. Adapt per channel.</h2><p>Use {{site}} and {{repo}} placeholders. The portal adds UTM tags on publish.</p></div><div class="page-head-actions"><button class="btn btn-primary" data-new>New post</button></div></div>
      <div class="two-col">
        <div class="card card-pad">
          <div class="section-head"><h3>Template</h3><span>EN + AR</span></div>
          <div class="field"><span>Product proof</span><textarea id="tpl-product" rows="7">Ask your ledger: "How did October compare with September?"

The assistant answers with the numbers and KPI cards from your own data.

See it → {{site}}</textarea></div>
          <div class="field"><span>OCR flow</span><textarea id="tpl-ocr" rows="7">Upload a supplier invoice. Preview it. Review the extracted fields. Create the purchase invoice.

OCR invoice capture is built into Fatortak.

{{site}}</textarea></div>
          <div class="form-actions"><button class="btn btn-outline" data-template="product">Use product template</button><button class="btn btn-outline" data-template="ocr">Use OCR template</button></div>
        </div>
        <div class="card card-pad">
          <div class="section-head"><h3>Drafts and review</h3><span>${drafts.length} waiting</span></div>
          ${drafts.length ? `<div class="report-list">${drafts.map((post) => `<button class="report-item" data-edit="${esc(post.id)}" style="text-align:left;background:transparent">${esc(post.title)}<br><span style="color:var(--muted-2);font-size:.6rem">${esc(post.language.toUpperCase())} · ${esc(post.status)}</span></button>`).join("")}</div>` : `<div class="empty"><strong>No drafts</strong><span>Start a new post or import the queue.</span></div>`}
        </div>
      </div>
    `;
  }

  function renderConnections() {
    const channels = state.connections;
    const connected = channels.filter((c) => c.configured).length;
    const verified = channels.filter(verifiedFresh).length;
    $("#view").innerHTML = `
      <div class="page-head"><div><span class="eyebrow">Connections</span><h2>${connected} configured · ${verified} verified · ${channels.length} channels</h2><p>Save credentials once, test them, then the scheduler posts without you. Platform account creation and app review still happen in the platform's own console.</p></div><div class="page-head-actions"><button class="btn btn-ghost" data-refresh-connections>Test all</button><button class="btn btn-primary" data-view="queue">Open content</button></div></div>
      <div class="card card-pad section" style="margin-top:0">
        <div class="section-head"><h3>How connection works</h3><span>one-time</span></div>
        <p style="color:var(--muted);font-size:.78rem;line-height:1.7;margin-bottom:8px">Click <strong>Connect</strong> on a channel, open its official console, paste the token or ID, and hit <strong>Save &amp; test</strong>. The portal writes the values to its private <code>.env</code>, verifies the connection and never returns the secret. It cannot create social accounts, accept platform terms, pass app review or enter an OTP for you — those steps need the account owner.</p>
        <div class="chips"><span class="chip lime">${verified} verified</span><span class="chip cyan">${connected} configured</span><span class="chip amber">${channels.filter((c) => c.mode === "api" && !c.configured).length} waiting</span><span class="chip muted">${channels.filter((c) => c.mode === "restricted").length} blocked</span></div>
      </div>
      <div class="channel-grid section">
        ${channels.map((channel) => `
          <div class="card channel-card">
            <div class="channel-head"><div class="channel-name">${channelIcon(channel.key, channel.label)}<div><strong>${esc(channel.label)}</strong><span>${esc(channel.mode)}</span></div></div>${channelStatusChip(channel)}</div>
            <p>${esc(channel.requirements)}</p>
            <div class="chips" style="margin-bottom:2px"><span class="chip ${channel.media === "none" ? "muted" : "purple"}">${esc(mediaSupportLabel(channel.media))}</span>${channel.verified ? `<span class="chip ${verifiedFresh(channel) ? "lime" : channel.verified.ok ? "amber" : "rose"}">${verifiedFresh(channel) ? "test ok" : channel.verified.ok ? "test stale" : "test failed"}</span>` : ""}</div>
            ${channel.verified?.detail ? `<p class="channel-verify-detail">${esc(channel.verified.detail)}</p>` : ""}
            <div class="env-list">${(channel.env || []).map((name) => `<code>${esc(name)}</code>`).join("") || `<code>no API credentials</code>`}</div>
            <div class="channel-metrics"><div><span>Followers</span><strong>${fmtNumber(channel.metrics?.followers)}</strong></div><div><span>Engagement</span><strong>${fmtNumber(channel.metrics?.engagement)}</strong></div><div><span>Clicks</span><strong>${fmtNumber(channel.metrics?.clicks)}</strong></div></div>
            <div class="channel-actions">
              ${channel.profile ? `<a class="btn btn-ghost btn-sm" href="${esc(channel.profile)}" target="_blank" rel="noopener">Profile <svg><use href="#i-external"></use></svg></a>` : ""}
              <button class="btn ${channel.mode === "api" ? "btn-primary" : "btn-outline"} btn-sm" data-connect="${esc(channel.key)}">${channel.mode === "api" ? (channel.configured ? "Manage" : "Connect") : "Why blocked"}</button>
            </div>
          </div>
        `).join("")}
      </div>
      <div class="card card-pad section"><div class="section-head"><h3>Why some channels are restricted</h3><span>platform rules</span></div><p style="color:var(--muted);font-size:.78rem;line-height:1.7">Hacker News, Reddit and Product Hunt do not provide compliant unattended posting. TikTok requires a Content Posting API audit and a video asset. YouTube requires OAuth, a video asset and quota. WhatsApp requires opt-in template approval. The portal will not pretend those are automated; it monitors where possible and blocks the publish instead of risking the account.</p></div>
    `;
  }

  function renderAnalytics() {
    const metrics = state.metrics?.metrics || state.overview?.metrics?.channels || {};
    const totals = state.metrics?.totals || state.overview?.metrics?.totals || {};
    const traffic = state.metrics?.traffic || state.overview?.traffic || {};
    const channels = state.connections;
    const maxFollowers = Math.max(1, ...Object.values(metrics).map((item) => Number(item.followers || 0)));
    const maxSource = Math.max(1, ...(traffic.sources || []).map((item) => Number(item.visitors || 0)));
    $("#view").innerHTML = `
      <div class="page-head"><div><span class="eyebrow">Analytics</span><h2>Channel performance</h2><p>Metrics are ingestion-only. No manual counters: missing data means the API is not connected.</p></div><div class="page-head-actions"><button class="btn btn-primary" data-sync-metrics><svg><use href="#i-refresh"></use></svg>Sync metrics</button><a class="btn btn-ghost" href="/api/reports/export?format=csv">Export CSV</a></div></div>
      <div class="grid metric-grid">
        <div class="card metric-card"><span>Followers</span><strong>${fmtNumber(totals.followers)}</strong></div>
        <div class="card metric-card"><span>Reach</span><strong>${fmtNumber(totals.reach)}</strong></div>
        <div class="card metric-card"><span>Engagement</span><strong>${fmtNumber(totals.engagement)}</strong></div>
        <div class="card metric-card"><span>Clicks</span><strong>${fmtNumber(totals.clicks)}</strong></div>
      </div>
      <div class="section two-col">
        <div class="card card-pad">
          <div class="section-head"><h3>Audience by channel</h3><span>followers</span></div>
          <div class="bar-chart">
            ${channels.map((channel) => `<div class="bar-row"><label>${esc(channel.label)}</label><div class="bar-track"><div class="bar-fill" style="width:${Math.round(((metrics[channel.key]?.followers || 0) / maxFollowers) * 100)}%"></div></div><strong>${fmtNumber(metrics[channel.key]?.followers)}</strong></div>`).join("")}
          </div>
        </div>
        <div class="card card-pad">
          <div class="section-head"><h3>Landing traffic</h3><span>${traffic.configured ? traffic.provider === "first-party" ? "First-party · 30 days" : "Plausible · 30 days" : "not connected"}</span></div>
          ${traffic.configured && !traffic.error ? `<div class="grid" style="grid-template-columns:repeat(3,minmax(0,1fr));gap:10px"><div><div class="kpi-label">Visitors</div><div class="kpi-value" style="font-size:1.2rem">${fmtNumber(traffic.visitors)}</div></div><div><div class="kpi-label">Pageviews</div><div class="kpi-value" style="font-size:1.2rem">${fmtNumber(traffic.pageviews)}</div></div><div><div class="kpi-label">Bounce</div><div class="kpi-value" style="font-size:1.2rem">${fmtNumber(traffic.bounceRate)}%</div></div></div>${(traffic.sources || []).length ? `<div class="section-head" style="margin-top:16px"><h3 style="font-size:.8rem">Traffic by source</h3><span>UTM · 30 days</span></div><div class="bar-chart">${traffic.sources.slice(0, 8).map((source) => `<div class="bar-row"><label>${esc(source.source)}</label><div class="bar-track"><div class="bar-fill" style="width:${Math.round((Number(source.visitors || 0) / maxSource) * 100)}%"></div></div><strong>${fmtNumber(source.visitors)}</strong></div>`).join("")}</div>` : ""}` : `<div class="empty" style="padding:24px 0"><strong>${traffic.error ? "Sync failed" : "Connect Plausible"}</strong><span>${esc(traffic.error || "Set PLAUSIBLE_SITE_ID and PLAUSIBLE_API_KEY on the portal server.")}</span></div>`}
        </div>
      </div>
      <div class="card section"><div class="table-wrap"><table><thead><tr><th>Channel</th><th>Status</th><th>Followers</th><th>Reach</th><th>Engagement</th><th>Clicks</th><th>Posts</th><th>Last sync</th></tr></thead><tbody>
        ${channels.map((channel) => `<tr><td><div class="channel-name">${channelIcon(channel.key, channel.label)}<div><strong>${esc(channel.label)}</strong><span>${esc(channel.mode)}</span></div></div></td><td><span class="chip ${channel.configured ? "lime" : channel.mode === "restricted" ? "muted" : "amber"}">${channel.configured ? "API" : channel.mode}</span></td><td>${fmtNumber(metrics[channel.key]?.followers)}</td><td>${fmtNumber(metrics[channel.key]?.reach)}</td><td>${fmtNumber(metrics[channel.key]?.engagement)}</td><td>${fmtNumber(metrics[channel.key]?.clicks)}</td><td>${fmtNumber(metrics[channel.key]?.posts)}</td><td>${metrics[channel.key]?.lastUpdated ? fmtDate(metrics[channel.key].lastUpdated, false) : "—"}</td></tr>`).join("")}
      </tbody></table></div></div>
    `;
  }

  function renderReports() {
    const report = state.reports || {};
    const posts = report.posts || {};
    const metrics = report.metrics?.totals || {};
    const traffic = report.traffic || {};
    const channelCounts = report.channelCounts || {};
    const maxChannel = Math.max(1, ...Object.values(channelCounts));
    $("#view").innerHTML = `
      <div class="page-head"><div><span class="eyebrow">Reports</span><h2>What changed this period</h2><p>Generated from the portal queue, metrics and traffic. Export for the weekly review.</p></div><div class="page-head-actions"><a class="btn btn-ghost" href="/api/reports/export?format=csv">CSV</a><a class="btn btn-ghost" href="/api/reports/export?format=json">JSON</a><button class="btn btn-primary" data-refresh>Refresh</button></div></div>
      <div class="grid kpis">
        ${kpi("Published · 30d", fmtNumber(posts.published30), `${fmtNumber(posts.published)} total`)}
        ${kpi("Scheduled", fmtNumber(posts.scheduled), `${fmtNumber(posts.total)} in portal`)}
        ${kpi("Followers", fmtNumber(metrics.followers), `${fmtNumber(metrics.engagement)} engagements`)}
        ${kpi("Landing visitors", traffic.configured ? fmtNumber(traffic.visitors) : "—", traffic.configured ? (traffic.provider === "first-party" ? "First-party · 30 days" : "Plausible · 30 days") : "connect analytics")}
      </div>
      <div class="section report-grid">
        <div class="card card-pad">
          <div class="section-head"><h3>Recommendations</h3><span>rule-based</span></div>
          <div class="report-list">${(report.recommendations || []).map((item) => `<div class="report-item">${esc(item)}</div>`).join("") || `<div class="empty"><strong>No blockers</strong><span>Keep publishing and syncing metrics.</span></div>`}</div>
        </div>
        <div class="card card-pad">
          <div class="section-head"><h3>Posts by channel</h3><span>${fmtNumber(posts.total)} posts</span></div>
          <div class="bar-chart">${Object.entries(channelCounts).sort((a, b) => b[1] - a[1]).map(([key, count]) => `<div class="bar-row"><label>${esc(channelLabel(key))}</label><div class="bar-track"><div class="bar-fill" style="width:${Math.round((count / maxChannel) * 100)}%"></div></div><strong>${fmtNumber(count)}</strong></div>`).join("")}</div>
        </div>
      </div>
      <div class="card card-pad section">
        <div class="section-head"><h3>Latest automation report</h3><span>${report.latestReport ? "marketing/reports" : "none yet"}</span></div>
        ${report.latestReport ? `<pre class="report-pre">${esc(report.latestReport)}</pre>` : `<div class="empty"><strong>No weekly report</strong><span>Run the marketing growth report or sync metrics to create one.</span></div>`}
      </div>
    `;
  }

  function renderSettings() {
    const settings = state.settings || {};
    const overview = state.overview || {};
    $("#view").innerHTML = `
      <div class="page-head"><div><span class="eyebrow">Settings</span><h2>Publishing safety</h2><p>Dry run is the default. Live publishing requires the server env flag.</p></div><div class="page-head-actions"><button class="btn btn-primary" data-save-settings>Save settings</button></div></div>
      <div class="settings-grid">
        <div class="card card-pad">
          <div class="section-head"><h3>Portal behavior</h3><span>${overview.live ? "live env on" : "live env locked"}</span></div>
          <div class="setting-row"><div><strong>Dry run</strong><span>Simulate publishes and show what would happen.</span></div><label class="switch"><input type="checkbox" id="setting-dry" ${settings.dryRun ? "checked" : ""}/><span></span></label></div>
          <div class="setting-row"><div><strong>Auto-approve queue</strong><span>New queue imports are scheduled without review.</span></div><label class="switch"><input type="checkbox" id="setting-auto-approve" ${settings.autoApprove ? "checked" : ""}/><span></span></label></div>
          <div class="setting-row"><div><strong>Require live landing page</strong><span>Block {{site}} posts until the page is reachable.</span></div><label class="switch"><input type="checkbox" id="setting-require-site" ${settings.requireLiveSite ? "checked" : ""}/><span></span></label></div>
          <div class="setting-row"><div><strong>Require image or video</strong><span>Block text-only posts on every channel.</span></div><label class="switch"><input type="checkbox" id="setting-media-required" ${settings.mediaRequired ? "checked" : ""}/><span></span></label></div>
          <label class="field" style="margin-top:14px"><span>Timezone</span><input type="text" id="setting-timezone" value="${esc(settings.timezone || "Africa/Cairo")}" /></label>
          <label class="field"><span>Public media host</span><input type="url" id="setting-public-url" value="${esc(settings.publicUrl || "")}" placeholder="https://marketing.example.com" /><small style="color:var(--muted-2);font-size:.64rem;line-height:1.5">Instagram, Threads and Dev.to fetch media from this public address. It must reach the portal from the internet; localhost cannot be used.</small></label>
        </div>
        <div class="card card-pad">
          <div class="section-head"><h3>Environment</h3><span>read-only</span></div>
          <div class="setting-row"><div><strong>Live publishing</strong><span>MARKETING_LIVE</span></div><span class="chip ${overview.live ? "lime" : "amber"}">${overview.live ? "true" : "false"}</span></div>
          <div class="setting-row"><div><strong>Auto-publish scheduler</strong><span>PORTAL_AUTO_PUBLISH</span></div><span class="chip ${overview.autoPublish ? "lime" : "amber"}">${overview.autoPublish ? "true" : "false"}</span></div>
          <div class="setting-row"><div><strong>Landing page</strong><span>${esc(settings.siteUrl || "")}</span></div><span class="chip ${overview.siteLive ? "lime" : "rose"}">${overview.siteLive ? "live" : "not live"}</span></div>
          <div class="setting-row"><div><strong>Repository</strong><span>${esc(settings.repo || "")}</span></div><span class="chip">GitHub</span></div>
          <div class="setting-row"><div><strong>Dry run</strong><span>Effective publish mode</span></div><span class="chip ${settings.dryRun ? "amber" : "lime"}">${settings.dryRun ? "simulate" : "live"}</span></div>
        </div>
      </div>
      <div class="card card-pad section">
        <div class="section-head"><h3>Queue and data</h3><span>local JSON store</span></div>
        <div class="form-actions"><button class="btn btn-outline" data-import-queue>Import 90-day queue</button><a class="btn btn-ghost" href="/api/reports/export?format=json">Export portal JSON</a></div>
        <p style="color:var(--muted-2);font-size:.7rem;margin-top:10px">Portal state is stored in <code>marketing/portal/data/portal.json</code> (gitignored). The existing automation queue is separate and remains the GitHub Actions source.</p>
      </div>
      <div class="card card-pad section">
        <div class="section-head"><h3>Security</h3><span>local-first</span></div>
        <p style="color:var(--muted);font-size:.78rem;line-height:1.7">The portal binds to <code>127.0.0.1</code> by default. Set <code>PORTAL_ADMIN_TOKEN</code> before exposing it behind a reverse proxy. Credentials saved by the Connections wizard are written to <code>marketing/portal/.env</code>, loaded as environment variables and never returned by the API.</p>
      </div>
    `;
  }

  function renderChannelPicker(selected) {
    const picker = $("#channel-picker");
    picker.innerHTML = state.connections.map((channel) => `
      <label class="channel-toggle ${selected.includes(channel.key) ? "is-checked" : ""}">
        <input type="checkbox" value="${esc(channel.key)}" ${selected.includes(channel.key) ? "checked" : ""} />
        ${esc(channel.label)}
      </label>
    `).join("");
    picker.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => {
        input.closest(".channel-toggle").classList.toggle("is-checked", input.checked);
        updateCharCounts();
      });
    });
  }

  function selectedChannels() {
    return $$("#channel-picker input:checked").map((input) => input.value);
  }

  function updateCharCounts() {
    const content = $("#post-content").value || "";
    const selected = selectedChannels();
    const limits = { x: 280, linkedin: 3000, facebook: 63206, instagram: 2200, threads: 500, bluesky: 300, mastodon: 500, telegram: 4096, discord: 2000, devto: 100000, tiktok: 2200, youtube: 5000, reddit: 40000, hackernews: 10000, producthunt: 5000, whatsapp: 4096, github: 65536 };
    $("#char-counts").innerHTML = selected.map((channel) => {
      const limit = limits[channel] || 0;
      const over = limit && content.length > limit;
      return `<span class="${over ? "over" : ""}">${esc(channelLabel(channel))}: ${content.length}${limit ? " / " + limit : ""}</span>`;
    }).join("");
  }

  function defaultMediaForPillar(pillar) {
    const item = state.mediaLibrary.find((entry) => (entry.pillars || []).includes(pillar)) || state.mediaLibrary[0];
    return item ? { ...item } : null;
  }

  function setPostMedia(media) {
    const current = media || {};
    $("#post-media-url").value = current.url || "";
    $("#post-media-public").value = current.publicUrl || "";
    $("#post-media-kind").value = current.kind || "";
    $("#post-media-name").value = current.name || "";
    $("#post-media-source").value = current.source || "";
    $("#post-media-alt").value = current.alt || "";
    const preview = $("#media-preview");
    if (!current.url) {
      preview.innerHTML = `<span>No media attached</span>`;
      $("#media-hint").textContent = "Posts without an image or video are blocked.";
      return;
    }
    if (current.kind === "video") {
      preview.innerHTML = `<video src="${esc(current.url)}" controls muted playsinline></video>`;
    } else {
      preview.innerHTML = `<img src="${esc(current.url)}" alt="${esc(current.alt || "")}" />`;
    }
    const publicReady = /^https?:\/\//i.test(current.publicUrl || "");
    $("#media-hint").textContent = publicReady
      ? "Media ready. Instagram, Threads and Dev.to can use the public URL."
      : "Local media works for native uploads. Instagram, Threads and Dev.to need PORTAL_PUBLIC_URL or a public https URL.";
  }

  function postMediaFromForm() {
    return {
      url: $("#post-media-url").value.trim(),
      publicUrl: $("#post-media-public").value.trim(),
      kind: $("#post-media-kind").value.trim(),
      name: $("#post-media-name").value.trim(),
      source: $("#post-media-source").value.trim(),
      alt: $("#post-media-alt").value.trim(),
    };
  }

  async function uploadMediaFile(file) {
    if (!file) return;
    if (!/^image\/|^video\//.test(file.type || "")) {
      toast("Choose an image or video file.", "error");
      return;
    }
    const headers = {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
    };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    toast("Uploading media…");
    try {
      const response = await fetch("/api/media", { method: "POST", headers, body: file });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setPostMedia({ ...data.media, source: "upload" });
      toast("Media uploaded.", "success");
    } catch (error) {
      toast(error.message, "error");
    }
  }

  function openMediaLibrary() {
    const uploaded = state.mediaFiles.map((item) => ({ ...item, label: item.name, source: "upload" }));
    const entries = [...uploaded, ...state.mediaLibrary.map((item) => ({ ...item, name: item.name || item.file, source: "library" }))];
    modal("Media library", `
      <div class="media-grid">
        ${entries.length ? entries.map((item, index) => `
          <button type="button" class="media-item" data-media-index="${index}">
            ${item.kind === "video" ? `<video src="${esc(item.url)}" muted playsinline></video>` : `<img src="${esc(item.url)}" alt="${esc(item.alt || item.label || "")}" />`}
            <span>${esc(item.label || item.name)}</span>
            <em>${esc(item.kind || "image")}</em>
          </button>
        `).join("") : `<div class="empty"><strong>No media yet</strong><span>Upload an image or video first.</span></div>`}
      </div>
    `, []);
    $$("[data-media-index]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = entries[Number(button.dataset.mediaIndex)];
        setPostMedia(item);
        closeModal();
      });
    });
  }

  function openDrawer(post = null, prefill = null) {
    state.editing = post;
    $("#drawer-title").textContent = post?.id ? "Edit post" : "New post";
    $("#post-id").value = post?.id || "";
    $("#post-title").value = prefill?.title || post?.title || "";
    $("#post-content").value = prefill?.content || post?.content || "";
    $("#post-language").value = post?.language || "en";
    $("#post-pillar").value = prefill?.pillar || post?.pillar || "product";
    $("#post-schedule").value = (post?.scheduledAt || localDateTimeValue(new Date())).slice(0, 16);
    $("#post-status").value = ["draft", "needs_review", "approved", "scheduled"].includes(post?.status) ? post.status : "draft";
    const existingMedia = post?.mediaUrl
      ? {
          url: post.mediaUrl,
          publicUrl: post.mediaPublicUrl || "",
          kind: post.mediaKind || "",
          name: post.mediaName || "",
          source: post.mediaSource || "",
          alt: post.mediaAlt || "",
        }
      : null;
    setPostMedia(prefill?.media || existingMedia || (post?.id ? null : defaultMediaForPillar(prefill?.pillar || "product")));
    $("#post-notes").value = post?.notes || "";
    renderChannelPicker(prefill?.channels || post?.channels || []);
    updateCharCounts();
    $("#drawer").hidden = false;
    $("#overlay").hidden = false;
    $("#post-title").focus();
  }

  function closeDrawer() {
    $("#drawer").hidden = true;
    $("#overlay").hidden = true;
    state.editing = null;
  }

  async function savePost(statusOverride) {
    const id = $("#post-id").value;
    const media = postMediaFromForm();
    const body = {
      title: $("#post-title").value.trim() || "Untitled post",
      content: $("#post-content").value,
      channels: selectedChannels(),
      language: $("#post-language").value,
      pillar: $("#post-pillar").value,
      scheduledAt: $("#post-schedule").value,
      status: statusOverride || $("#post-status").value,
      mediaUrl: media.url,
      mediaPublicUrl: media.publicUrl,
      mediaKind: media.kind,
      mediaName: media.name,
      mediaSource: media.source,
      mediaAlt: media.alt,
      notes: $("#post-notes").value.trim(),
    };
    if (!body.content.trim()) return toast("Write the post content first.", "error");
    if (!body.channels.length) return toast("Select at least one channel.", "error");
    if (!body.mediaUrl && ["scheduled", "approved", "published"].includes(body.status)) {
      return toast("Attach an image or video before scheduling or publishing.", "error");
    }
    try {
      const response = id
        ? await api(`/api/posts/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) })
        : await api("/api/posts", { method: "POST", body: JSON.stringify(body) });
      toast(id ? "Post updated." : "Post created.", "success");
      closeDrawer();
      await refreshAll();
      return response.post;
    } catch (error) {
      toast(error.message, "error");
      return null;
    }
  }

  async function publish(id, dryRun) {
    const post = state.posts.find((item) => item.id === id);
    if (!post) return;
    if (!dryRun) {
      const confirmed = window.confirm(
        `Publish live to ${post.channels.map(channelLabel).join(", ")}?\n\nThis calls the live platform APIs. Make sure the copy, links and media are correct.`
      );
      if (!confirmed) return;
    }
    try {
      const result = await api(`/api/posts/${encodeURIComponent(id)}/publish`, {
        method: "POST",
        body: JSON.stringify({ dryRun }),
      });
      const summary = result.result?.blocked
        ? result.result.results?.[0]?.reason || "Blocked"
        : result.result?.dryRun
          ? "Dry run complete."
          : `Published to ${result.result?.published || 0} channel${result.result?.published === 1 ? "" : "s"}.`;
      toast(summary, result.result?.blocked ? "error" : "success");
      await refreshAll();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function updateStatus(id, status) {
    try {
      await api(`/api/posts/${encodeURIComponent(id)}/status`, { method: "POST", body: JSON.stringify({ status }) });
      toast(`Status set to ${status.replace(/_/g, " ")}.`, "success");
      await refreshAll();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function deletePost(id) {
    const post = state.posts.find((item) => item.id === id);
    if (!post) return;
    const confirmed = window.confirm(`Delete “${post.title}” from the portal?\n\nThis does not delete a published platform post.`);
    if (!confirmed) return;
    try {
      await api(`/api/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast("Post deleted.", "success");
      await refreshAll();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  function modal(title, body, actions = []) {
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = body;
    $("#modal-actions").innerHTML = "";
    for (const action of actions) {
      const button = document.createElement("button");
      button.className = `btn ${action.className || "btn-ghost"}`;
      button.textContent = action.label;
      button.addEventListener("click", () => {
        closeModal();
        action.onClick?.();
      });
      $("#modal-actions").appendChild(button);
    }
    $("#modal").hidden = false;
  }

  function closeModal() {
    $("#modal").hidden = true;
  }

  function confirmModal(title, body, confirmLabel) {
    return new Promise((resolve) => {
      modal(title, body, [
        { label: "Cancel", className: "btn-ghost", onClick: () => resolve(false) },
        { label: confirmLabel, className: "btn-primary", onClick: () => resolve(true) },
      ]);
    });
  }

  function credentialLabel(key) {
    const labels = {
      X_ACCESS_TOKEN: "X user access token (OAuth 2.0)",
      X_API_KEY: "X API key (OAuth 1.0a, images)",
      X_API_SECRET: "X API secret (OAuth 1.0a)",
      X_OAUTH1_ACCESS_TOKEN: "X OAuth 1.0a user token (optional if your main token is OAuth 1.0a)",
      X_OAUTH1_ACCESS_TOKEN_SECRET: "X OAuth 1.0a token secret",
      LINKEDIN_ACCESS_TOKEN: "LinkedIn access token",
      LINKEDIN_AUTHOR_URN: "Company URN (urn:li:organization:…)",
      LINKEDIN_VERSION: "LinkedIn API version",
      FACEBOOK_PAGE_ID: "Facebook Page ID",
      FACEBOOK_PAGE_ACCESS_TOKEN: "Facebook Page access token",
      INSTAGRAM_USER_ID: "Instagram Business account ID",
      INSTAGRAM_ACCESS_TOKEN: "Instagram access token",
      THREADS_USER_ID: "Threads user ID",
      THREADS_ACCESS_TOKEN: "Threads access token",
      BLUESKY_HANDLE: "Bluesky handle (name.bsky.social)",
      BLUESKY_APP_PASSWORD: "Bluesky app password",
      BLUESKY_SERVICE: "Bluesky service URL",
      MASTODON_INSTANCE: "Mastodon instance URL",
      MASTODON_ACCESS_TOKEN: "Mastodon access token",
      MASTODON_ACCOUNT: "Mastodon account handle",
      TELEGRAM_BOT_TOKEN: "Telegram bot token",
      TELEGRAM_CHAT_ID: "Telegram channel ID (starts with -100)",
      DISCORD_WEBHOOK_URL: "Discord webhook URL",
      DEVTO_API_KEY: "Dev.to API key",
    };
    return labels[key] || key;
  }

  function secretField(key) {
    return /TOKEN|SECRET|PASSWORD|API_KEY/i.test(key);
  }

  async function testChannelConnection(key) {
    const box = $("#connect-result");
    if (box) {
      box.className = "connect-result";
      box.textContent = "Testing the saved credentials…";
    }
    try {
      const data = await api(`/api/connections/${encodeURIComponent(key)}/test`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (box) {
        box.className = `connect-result ${data.result?.ok ? "ok" : "error"}`;
        box.textContent = data.result?.detail || (data.result?.ok ? "Connection verified." : "Connection failed.");
      }
      toast(data.result?.ok ? "Connection verified." : data.result?.detail || "Connection failed.", data.result?.ok ? "success" : "error");
      await refreshAll();
    } catch (error) {
      if (box) {
        box.className = "connect-result error";
        box.textContent = error.message;
      }
      toast(error.message, "error");
    }
  }

  async function saveChannelCredentials(key) {
    const values = {};
    $$("#connect-form [data-env-key]").forEach((input) => {
      const value = input.value.trim();
      if (value) values[input.dataset.envKey] = value;
    });
    if (!Object.keys(values).length) {
      toast("Enter at least one credential value.", "error");
      return;
    }
    try {
      await api(`/api/connections/${encodeURIComponent(key)}/credentials`, {
        method: "PUT",
        body: JSON.stringify({ values }),
      });
      toast("Credentials saved locally.", "success");
      await testChannelConnection(key);
    } catch (error) {
      toast(error.message, "error");
    }
  }

  function openChannelSetup(key) {
    const channel = state.connections.find((item) => item.key === key);
    if (!channel) return;
    const fields = channel.credentialKeys || [];
    const isApi = channel.mode === "api" && fields.length > 0;
    const links = [
      channel.console ? `<a class="btn btn-outline btn-sm" href="${esc(channel.console)}" target="_blank" rel="noopener">Open developer console <svg><use href="#i-external"></use></svg></a>` : "",
      channel.docs ? `<a class="btn btn-ghost btn-sm" href="${esc(channel.docs)}" target="_blank" rel="noopener">Platform docs <svg><use href="#i-external"></use></svg></a>` : "",
      channel.signup ? `<a class="btn btn-ghost btn-sm" href="${esc(channel.signup)}" target="_blank" rel="noopener">Platform signup <svg><use href="#i-external"></use></svg></a>` : "",
      channel.profile ? `<a class="btn btn-ghost btn-sm" href="${esc(channel.profile)}" target="_blank" rel="noopener">Live profile <svg><use href="#i-external"></use></svg></a>` : "",
    ].filter(Boolean).join("");
    const form = isApi ? `
      <form id="connect-form" class="connect-form" autocomplete="off">
        ${fields.map((name) => `
          <label class="field">
            <span>${esc(credentialLabel(name))} <code>${esc(name)}</code></span>
            <input type="${secretField(name) ? "password" : "text"}" data-env-key="${esc(name)}"
              placeholder="${channel.configured ? "Saved — leave blank to keep" : name}"
              autocomplete="off" spellcheck="false" />
          </label>
        `).join("")}
        <div class="form-actions">
          <button type="button" class="btn btn-primary" id="connect-save">Save &amp; test</button>
          <button type="button" class="btn btn-outline" id="connect-test">Test saved connection</button>
        </div>
        <div id="connect-result" class="connect-result">${channel.verified ? esc(channel.verified.detail || "") : "Credentials are written to marketing/portal/.env and never returned by the API."}</div>
      </form>
    ` : `<div class="connect-result error">${esc(channel.requirements)}</div>`;

    modal(`${channel.label} connection`, `
      <div class="connect-head">
        ${channelStatusChip(channel)}
        <span class="chip ${channel.media === "none" ? "muted" : "purple"}">${esc(mediaSupportLabel(channel.media))}</span>
      </div>
      <p style="margin-bottom:12px">${esc(channel.note || channel.requirements)}</p>
      ${isApi ? `<p style="margin-bottom:12px;color:var(--muted-2);font-size:.72rem">This is the one-time platform step. The portal cannot create the account, accept the platform terms, pass app review or enter an OTP. After you paste a valid token, posting is automated.</p>` : ""}
      ${form}
      <div class="connect-links">${links}</div>
      ${channel.media === "public-url" ? `<p style="margin-top:12px;color:var(--muted-2);font-size:.7rem">This channel fetches media from a public URL. Set <code>PORTAL_PUBLIC_URL</code> to a public address for the portal, or attach a CDN URL.</p>` : ""}
    `, []);

    if (isApi) {
      $("#connect-save").addEventListener("click", () => saveChannelCredentials(key));
      $("#connect-test").addEventListener("click", () => testChannelConnection(key));
    }
  }

  async function syncMetrics() {
    try {
      toast("Syncing metrics…");
      const result = await api("/api/metrics/sync", { method: "POST", body: JSON.stringify({}) });
      toast(`Synced ${result.synced?.length || 0} channels.`, "success");
      if (result.warnings?.length) console.warn(result.warnings);
      await refreshAll();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function importQueue() {
    try {
      const result = await api("/api/import-queue", { method: "POST", body: JSON.stringify({}) });
      toast(`Imported ${result.imported} queue posts.`, "success");
      await refreshAll();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function saveSettings() {
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          dryRun: $("#setting-dry").checked,
          autoApprove: $("#setting-auto-approve").checked,
          requireLiveSite: $("#setting-require-site").checked,
          mediaRequired: $("#setting-media-required").checked,
          publicUrl: $("#setting-public-url").value.trim(),
          timezone: $("#setting-timezone").value.trim() || "Africa/Cairo",
        }),
      });
      toast("Settings saved.", "success");
      await refreshAll();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  function bind() {
    $$(".nav-item").forEach((item) => item.addEventListener("click", () => setView(item.dataset.view)));
    $("#new-post").addEventListener("click", () => openDrawer());
    $("#drawer-close").addEventListener("click", closeDrawer);
    $("#overlay").addEventListener("click", closeDrawer);
    $("#modal-close").addEventListener("click", closeModal);
    $("#refresh").addEventListener("click", () => refreshAll().then(() => toast("Refreshed.")).catch((error) => toast(error.message, "error")));
    $("#mobile-menu").addEventListener("click", () => setSidebar(!$("#sidebar").classList.contains("is-open")));
    $("#scrim").addEventListener("click", () => setSidebar(false));
    $("#post-content").addEventListener("input", updateCharCounts);
    $("#media-file").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) uploadMediaFile(file);
    });
    $("#media-library").addEventListener("click", openMediaLibrary);
    $("#media-clear").addEventListener("click", () => setPostMedia(null));
    $("#save-draft").addEventListener("click", () => savePost("draft"));
    $("#publish-dry").addEventListener("click", async () => {
      const saved = await savePost($("#post-status").value || "draft");
      if (saved) await publish(saved.id, true);
    });
    $("#publish-live").addEventListener("click", async () => {
      const id = $("#post-id").value;
      if (id) {
        await publish(id, false);
        return;
      }
      const saved = await savePost($("#post-status").value || "draft");
      if (saved) await publish(saved.id, false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (!$("#scrim").hidden) setSidebar(false);
        if (!$("#drawer").hidden) closeDrawer();
        if (!$("#modal").hidden) closeModal();
      }
    });

    $("#view").addEventListener("click", async (event) => {
      const target = event.target.closest("[data-view],[data-edit],[data-dry],[data-publish],[data-delete],[data-new],[data-template],[data-import-queue],[data-refresh],[data-sync-metrics],[data-save-settings],[data-connect],[data-channel-help],[data-cal-prev],[data-cal-next],[data-cal-today],[data-refresh-connections]");
      if (!target) return;
      if (target.dataset.view) return setView(target.dataset.view);
      if (target.dataset.template) {
        const source = document.querySelector(`#tpl-${target.dataset.template}`);
        const title = target.dataset.template === "ocr" ? "OCR invoice capture" : "Ask your ledger";
        const pillar = target.dataset.template === "ocr" ? "ai-ocr" : "product";
        return openDrawer(null, {
          title,
          content: source ? source.value : "",
          pillar,
          channels: ["x", "linkedin"],
          media: defaultMediaForPillar(pillar),
        });
      }
      if (target.dataset.new !== undefined) return openDrawer();
      if (target.dataset.edit) {
        const post = state.posts.find((item) => item.id === target.dataset.edit);
        if (post) openDrawer(post);
        return;
      }
      if (target.dataset.dry) return publish(target.dataset.dry, true);
      if (target.dataset.publish) return publish(target.dataset.publish, false);
      if (target.dataset.delete) return deletePost(target.dataset.delete);
      if (target.dataset.importQueue !== undefined) return importQueue();
      if (target.dataset.refreshConnections !== undefined) return refreshConnections();
      if (target.dataset.refresh !== undefined) return refreshAll();
      if (target.dataset.syncMetrics !== undefined) return syncMetrics();
      if (target.dataset.saveSettings !== undefined) return saveSettings();
      if (target.dataset.connect) return openChannelSetup(target.dataset.connect);
      if (target.dataset.channelHelp) return openChannelSetup(target.dataset.channelHelp);
      if (target.dataset.calPrev !== undefined) {
        const date = new Date(`${state.calendarMonth}-01T00:00:00`);
        date.setMonth(date.getMonth() - 1);
        state.calendarMonth = monthKey(date);
        return renderCalendar();
      }
      if (target.dataset.calNext !== undefined) {
        const date = new Date(`${state.calendarMonth}-01T00:00:00`);
        date.setMonth(date.getMonth() + 1);
        state.calendarMonth = monthKey(date);
        return renderCalendar();
      }
      if (target.dataset.calToday !== undefined) {
        state.calendarMonth = monthKey(new Date());
        return renderCalendar();
      }
    });

    $("#view").addEventListener("change", (event) => {
      const id = event.target.id;
      if (id === "filter-status") state.filters.status = event.target.value;
      if (id === "filter-channel") state.filters.channel = event.target.value;
      if (id === "filter-lang") state.filters.lang = event.target.value;
      if (id.startsWith("filter-") && id !== "filter-q") renderQueue();
    });
  }

  async function boot() {
    bind();
    try {
      await refreshAll();
    } catch (error) {
      $("#view").innerHTML = `<div class="card card-pad"><div class="empty"><strong>Portal API unavailable</strong><span>${esc(error.message)}</span></div></div>`;
    }
  }

  boot();
})();
