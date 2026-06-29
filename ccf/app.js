const meta = window.CCF_META;
const allRows = window.CCF_DATA;

const domainPalette = [
  { bg: "#e8edff", fg: "#2f4095", border: "#aab8f2", strong: "#4b5fc8" },
  { bg: "#e3f5ff", fg: "#075985", border: "#9bd8f4", strong: "#0284c7" },
  { bg: "#ffe7e6", fg: "#9f1d1d", border: "#f3b2ad", strong: "#dc3f36" },
  { bg: "#f1e8ff", fg: "#6b2bb8", border: "#cfb7f5", strong: "#8b5cf6" },
  { bg: "#fff0c7", fg: "#875300", border: "#e9c76d", strong: "#c78200" },
  { bg: "#e8f0ef", fg: "#36524f", border: "#b5c8c5", strong: "#607d79" },
  { bg: "#ffe6f2", fg: "#9d1f60", border: "#efafd0", strong: "#d9468f" },
  { bg: "#dcf8ea", fg: "#09623a", border: "#93dfb7", strong: "#13a366" },
  { bg: "#def7f6", fg: "#096164", border: "#8adbd8", strong: "#11969b" },
  { bg: "#ffe9d5", fg: "#90400d", border: "#eab489", strong: "#d76d1f" },
];

const typePalette = {
  conference: { bg: "#e7f0ff", fg: "#164b97", border: "#a9c8f6", strong: "#2563eb" },
  journal: { bg: "#e5f7df", fg: "#2f6b1f", border: "#abd89f", strong: "#58a942" },
};

const rankPalette = {
  A: { bg: "#ffe7e6", fg: "#9f1d1d", border: "#f3b2ad", strong: "#dc3f36" },
  B: { bg: "#fff0c7", fg: "#875300", border: "#e9c76d", strong: "#c78200" },
  C: { bg: "#dcf8ea", fg: "#09623a", border: "#93dfb7", strong: "#13a366" },
};

const neutralPalette = { bg: "#f3f6f5", fg: "#40505a", border: "#cfd8d4", strong: "#66727d" };

const rankOrder = { A: 1, B: 2, C: 3 };
const dayMs = 24 * 60 * 60 * 1000;
const defaultSort = { key: "domainShort", dir: "asc" };
const sortKeys = new Set(["domainShort", "typeLabel", "rank", "deadlineMonth", "abbr", "name", "publisher", "impactFactor", "jcrQuartile", "casPartition"]);

const state = {
  query: "",
  types: [],
  ranks: [],
  domains: [],
  sortKey: "domainShort",
  sortDir: "asc",
};

const els = {
  allSummary: document.getElementById("allSummary"),
  dataUpdated: document.getElementById("dataUpdated"),
  typeSummary: document.getElementById("typeSummary"),
  rankSummary: document.getElementById("rankSummary"),
  domainSummary: document.getElementById("domainSummary"),
  searchInput: document.getElementById("searchInput"),
  resultCount: document.getElementById("resultCount"),
  resultBody: document.getElementById("resultBody"),
  resetFilters: document.getElementById("resetFilters"),
  downloadXlsx: document.getElementById("downloadXlsx"),
  copyLink: document.getElementById("copyLink"),
  themeToggle: document.getElementById("themeToggle"),
  backToTop: document.getElementById("backToTop"),
  mobileSortKey: document.getElementById("mobileSortKey"),
  mobileSortDir: document.getElementById("mobileSortDir"),
  siteHeader: document.querySelector(".site-header"),
};

function init() {
  renderDataUpdated();
  applyUrlState();
  bindEvents();
  restoreTheme();
  render({ syncUrl: false });
  updateBackToTop();
  updateStickyHeaderHeight();
}

function renderDataUpdated() {
  if (!els.dataUpdated) return;
  els.dataUpdated.textContent = `数据更新 ${formatMetaDate(meta.generatedAt)}`;
}

function bindEvents() {
  document.querySelector(".summary-panel").addEventListener("click", (event) => {
    const card = event.target.closest("[data-filter]");
    if (!card) return;
    const group = card.dataset.filter;
    const value = card.dataset.value;
    if (group === "facet") {
      state.query = "";
      state.types = [];
      state.ranks = [];
      state.domains = [];
      els.searchInput.value = "";
    } else {
      toggleSelection(group, value);
    }
    render();
  });

  els.searchInput.addEventListener("input", () => {
    state.query = els.searchInput.value.trim().toLowerCase();
    render();
  });

  if (els.mobileSortKey) {
    els.mobileSortKey.addEventListener("change", () => {
      state.sortKey = els.mobileSortKey.value;
      render();
    });
  }

  if (els.mobileSortDir) {
    els.mobileSortDir.addEventListener("click", () => {
      state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      render();
    });
  }

  els.resetFilters.addEventListener("click", () => {
    state.query = "";
    state.types = [];
    state.ranks = [];
    state.domains = [];
    state.sortKey = defaultSort.key;
    state.sortDir = defaultSort.dir;
    els.searchInput.value = "";
    render();
  });

  els.downloadXlsx.addEventListener("click", () => exportXlsx(getFilteredRows()));
  els.copyLink.addEventListener("click", copyCurrentLink);

  els.themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    els.themeToggle.textContent = isDark ? "浅色" : "深色";
    localStorage.setItem("ccf-theme", isDark ? "dark" : "light");
  });

  els.backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", updateBackToTop, { passive: true });
  window.addEventListener("resize", updateStickyHeaderHeight);
  window.addEventListener("popstate", () => {
    applyUrlState();
    render({ syncUrl: false });
  });

  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.tabIndex = 0;
    th.setAttribute("role", "button");
    th.addEventListener("click", () => sortByHeader(th));
    th.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      sortByHeader(th);
    });
  });
}

function sortByHeader(th) {
  const key = th.dataset.sort;
  if (state.sortKey === key) {
    state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
  } else {
    state.sortKey = key;
    state.sortDir = "asc";
  }
  render();
}

function restoreTheme() {
  const isDark = localStorage.getItem("ccf-theme") === "dark";
  document.body.classList.toggle("dark", isDark);
  els.themeToggle.textContent = isDark ? "浅色" : "深色";
}

function updateBackToTop() {
  els.backToTop.classList.toggle("visible", window.scrollY > 420);
}

function updateStickyHeaderHeight() {
  if (!els.siteHeader) return;
  const height = Math.ceil(els.siteHeader.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--sticky-header-height", `${height}px`);
}

async function copyCurrentLink() {
  syncUrlState();
  const url = window.location.href;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      fallbackCopyText(url);
    }
    showCopyState("已复制");
  } catch (error) {
    fallbackCopyText(url);
    showCopyState("已复制");
  }
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function showCopyState(text) {
  const original = "复制链接";
  els.copyLink.textContent = text;
  els.copyLink.disabled = true;
  window.setTimeout(() => {
    els.copyLink.textContent = original;
    els.copyLink.disabled = false;
  }, 1400);
}

function applyUrlState() {
  const params = new URLSearchParams(window.location.search);
  const query = (params.get("q") || "").trim();
  state.query = query.toLowerCase();
  els.searchInput.value = query;

  const typeSet = new Set(listParam(params, "type").map(normalizeType).filter(Boolean));
  state.types = ["conference", "journal"].filter((type) => typeSet.has(type));

  const rankSet = new Set(listParam(params, "rank").map((rank) => rank.toUpperCase()).filter((rank) => ["A", "B", "C"].includes(rank)));
  state.ranks = ["A", "B", "C"].filter((rank) => rankSet.has(rank));

  const domainSet = new Set(listParam(params, "domain").map(resolveDomain).filter(Boolean));
  state.domains = meta.domainOrder.filter((domain) => domainSet.has(domain));

  const sortKey = params.get("sort");
  state.sortKey = sortKeys.has(sortKey) ? sortKey : defaultSort.key;
  state.sortDir = params.get("dir") === "desc" ? "desc" : defaultSort.dir;
}

function syncUrlState() {
  const params = new URLSearchParams();
  const query = els.searchInput.value.trim();
  if (query) params.set("q", query);
  if (state.types.length) params.set("type", state.types.join(","));
  if (state.ranks.length) params.set("rank", state.ranks.join(","));
  if (state.domains.length) {
    params.set("domain", state.domains.map((domain) => meta.domainShort[domain] || domain).join(","));
  }
  if (state.sortKey !== defaultSort.key || state.sortDir !== defaultSort.dir) {
    params.set("sort", state.sortKey);
    if (state.sortDir !== defaultSort.dir) params.set("dir", state.sortDir);
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.search = params.toString();
  if (nextUrl.href !== window.location.href) {
    history.replaceState(null, "", nextUrl.href);
  }
}

function listParam(params, key) {
  return params.getAll(key).flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
}

function normalizeType(value) {
  const text = String(value || "").toLowerCase();
  if (["conference", "conf", "c", "会议", "会"].includes(text)) return "conference";
  if (["journal", "j", "期刊", "刊"].includes(text)) return "journal";
  return "";
}

function resolveDomain(value) {
  return meta.domainOrder.find((domain) => domain === value || meta.domainShort[domain] === value) || "";
}

function getDomainColor(domain) {
  const index = Math.max(0, meta.domainOrder.indexOf(domain));
  return domainPalette[index % domainPalette.length];
}

function getTypeColor(type) {
  return typePalette[type];
}

function tagStyle(color) {
  return `--tag-bg:${color.bg};--tag-fg:${color.fg};--tag-border:${color.border};--tag-strong:${color.strong}`;
}

function renderFilterSummary() {
  const counts = summarizeCurrentRows();
  els.allSummary.innerHTML = filterCard("facet", "all", "全部", counts.total, neutralPalette, isAllClear());
  els.typeSummary.innerHTML = [
    filterCard("type", "conference", "会议", countRowsFor("type", "conference"), getTypeColor("conference"), state.types.includes("conference")),
    filterCard("type", "journal", "期刊", countRowsFor("type", "journal"), getTypeColor("journal"), state.types.includes("journal")),
  ].join("");

  els.rankSummary.innerHTML = ["A", "B", "C"].map((rank) => {
    return filterCard("rank", rank, rank, countRowsFor("rank", rank), rankPalette[rank], state.ranks.includes(rank));
  }).join("");

  els.domainSummary.innerHTML = meta.domainOrder.map((domain) => {
    return filterCard("domain", domain, meta.domainShort[domain], countRowsFor("domain", domain), getDomainColor(domain), state.domains.includes(domain), "domain-card");
  }).join("");
}

function isAllClear() {
  return state.query === "" && state.types.length === 0 && state.ranks.length === 0 && state.domains.length === 0;
}

function filterCard(group, value, label, count, color, active, className = "facet-card") {
  const activeClass = active ? " active" : "";
  return `<button class="${className}${activeClass}" type="button" data-filter="${escapeAttr(group)}" data-value="${escapeAttr(value)}" style="${tagStyle(color)}" aria-pressed="${active ? "true" : "false"}"><span>${escapeHtml(label)}</span><strong>${count}</strong></button>`;
}

function toggleSelection(group, value) {
  const key = { type: "types", rank: "ranks", domain: "domains" }[group];
  const values = state[key];
  const index = values.indexOf(value);
  if (index >= 0) {
    values.splice(index, 1);
  } else {
    values.push(value);
  }
}

function summarizeCurrentRows() {
  const counts = {
    total: 0,
    type: { conference: 0, journal: 0 },
    rank: { A: 0, B: 0, C: 0 },
    domain: Object.fromEntries(meta.domainOrder.map((domain) => [domain, 0])),
  };
  for (const row of allRows) {
    if (!rowMatchesFilters(row)) continue;
    counts.total += 1;
    counts.type[row.type] += 1;
    counts.rank[row.rank] += 1;
    counts.domain[row.domain] += 1;
  }
  return counts;
}

function countRowsFor(group, value) {
  const overrides = {};
  if (group === "type") overrides.types = [value];
  if (group === "rank") overrides.ranks = [value];
  if (group === "domain") overrides.domains = [value];
  return allRows.reduce((count, row) => count + (rowMatchesFilters(row, overrides) ? 1 : 0), 0);
}

function rowMatchesFilters(row, overrides = {}) {
  const types = overrides.types ?? state.types;
  const ranks = overrides.ranks ?? state.ranks;
  const domains = overrides.domains ?? state.domains;
  if (types.length > 0 && !types.includes(row.type)) return false;
  if (ranks.length > 0 && !ranks.includes(row.rank)) return false;
  if (domains.length > 0 && !domains.includes(row.domain)) return false;
  return !state.query || searchableText(row).includes(state.query);
}

function getFilteredRows() {
  const rows = allRows.filter((row) => rowMatchesFilters(row));
  rows.sort(compareRows);
  return rows;
}

function searchableText(row) {
  return [
    row.domain,
    row.domainShort,
    row.typeLabel,
    row.rank,
    row.deadlineMonth,
    row.deadlineDate,
    row.deadlineYear,
    row.abbr,
    row.name,
    row.publisher,
    row.impactFactor,
    row.jcrQuartile,
    row.jcrCategory,
    row.jcrWos,
    row.jcrIssn,
    row.casPartition,
    row.casCategory,
    row.casSmallCategory,
    row.casIssn,
    ...(row.urls || []),
  ].join(" ").toLowerCase();
}

function compareRows(a, b) {
  const direction = state.sortDir === "asc" ? 1 : -1;
  const key = state.sortKey;
  const primary = compareRowsByKey(a, b, key, direction);
  if (primary !== 0) return primary;
  if (key !== "domainShort") {
    const domain = compareRowsByKey(a, b, "domainShort", 1);
    if (domain !== 0) return domain;
  }
  return (a.id || 0) - (b.id || 0);
}

function compareRowsByKey(a, b, key, direction) {
  const left = sortValue(a, key);
  const right = sortValue(b, key);
  const leftMissing = isMissingSortValue(left);
  const rightMissing = isMissingSortValue(right);
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  if (typeof left === "number" && typeof right === "number") {
    return (left - right) * direction;
  }
  return String(left).localeCompare(String(right), "zh-Hans-CN", { numeric: true }) * direction;
}

function isMissingSortValue(value) {
  return value === "" || value == null || value === -1 || value === "ZZ";
}

function sortValue(row, key) {
  if (key === "rank") return rankOrder[row.rank] || 99;
  if (key === "deadlineMonth") {
    const timing = deadlineTiming(row);
    return Number.isFinite(timing.days) ? timing.days : -1;
  }
  if (key === "domainShort") return meta.domainOrder.indexOf(row.domain);
  if (key === "impactFactor") return row.impactFactor ? Number(row.impactFactor) : -1;
  if (key === "jcrQuartile") return bestQuartile(row.jcrQuartile) || "ZZ";
  if (key === "casPartition") return row.casPartition || "ZZ";
  return row[key] ?? "";
}

function render(options = {}) {
  renderFilterSummary();
  const rows = getFilteredRows();
  els.resultCount.textContent = `共 ${rows.length} 条 / ${allRows.length} 条`;
  els.resultBody.innerHTML = rows.map(renderRow).join("");
  updateSortedHeaders();
  if (options.syncUrl !== false) syncUrlState();
}

function updateSortedHeaders() {
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    const isSorted = th.dataset.sort === state.sortKey;
    th.classList.toggle("sorted-asc", isSorted && state.sortDir === "asc");
    th.classList.toggle("sorted-desc", isSorted && state.sortDir === "desc");
    th.setAttribute("aria-sort", isSorted ? (state.sortDir === "asc" ? "ascending" : "descending") : "none");
  });
  if (els.mobileSortKey) els.mobileSortKey.value = state.sortKey;
  if (els.mobileSortDir) {
    els.mobileSortDir.textContent = state.sortDir === "asc" ? "升序" : "降序";
    els.mobileSortDir.setAttribute("aria-label", state.sortDir === "asc" ? "当前升序，点击切换为降序" : "当前降序，点击切换为升序");
  }
}

function renderRow(row) {
  const jcrValue = bestQuartile(row.jcrQuartile);
  return `<tr>
    <td class="domain-cell" data-label="方向"><span class="domain-pill" style="${tagStyle(getDomainColor(row.domain))}">${escapeHtml(row.domainShort)}</span></td>
    <td class="type-cell" data-label="类型"><span class="type-pill" style="${tagStyle(getTypeColor(row.type))}">${escapeHtml(row.typeLabel)}</span></td>
    <td class="rank-cell" data-label="等级"><span class="rank-pill rank-${row.rank.toLowerCase()}">${escapeHtml(row.rank)}</span></td>
    <td class="deadline-cell" data-label="截稿">${deadlineValue(row)}</td>
    <td class="abbr-cell" data-label="简称">${escapeHtml(row.abbr)}</td>
    <td class="name-cell" data-label="全称">${linkedName(row)}</td>
    <td class="publisher-cell" data-label="出版社/组织">${escapeHtml(row.publisher)}</td>
    <td class="if-cell" data-label="IF">${metricValue(row.impactFactor, impactClass(row.impactFactor))}</td>
    <td class="jcr-cell" data-label="JCR" title="${escapeAttr(row.jcrCategory || "")}">${metricValue(jcrValue, quartileClass(jcrValue))}</td>
    <td class="cas-cell" data-label="中科院" title="${escapeAttr([row.casCategory, row.casTop === "是" ? "Top" : "", row.casSmallCategory].filter(Boolean).join("；"))}">${metricValue(row.casPartition, partitionClass(row.casPartition))}</td>
  </tr>`;
}

function linkedName(row) {
  const name = escapeHtml(row.name);
  const url = safeUrl(row.urls?.[0]);
  return url ? `<a class="name-link" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" title="打开网址">${name}</a>` : name;
}

function safeUrl(value) {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

function bestQuartile(value) {
  const values = new Set(String(value || "").toUpperCase().match(/Q[1-4]/g) || []);
  return ["Q1", "Q2", "Q3", "Q4"].find((quartile) => values.has(quartile)) || "";
}

function quartileClass(value) {
  return value ? `metric-${String(value).toLowerCase()}` : "";
}

function partitionClass(value) {
  const match = String(value || "").match(/[1-4]/);
  return match ? `metric-zone-${match[0]}` : "";
}

function impactClass(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  if (number >= 10) return "metric-if-high";
  if (number >= 5) return "metric-if-mid";
  return "metric-if-low";
}

function metricValue(value, className = "") {
  return value ? `<span class="metric-pill ${escapeAttr(className)}">${escapeHtml(value)}</span>` : `<span class="empty">-</span>`;
}

function deadlineValue(row) {
  if (!row.deadlineMonth) return `<span class="empty">-</span>`;
  const timing = deadlineTiming(row);
  const title = deadlineTitle(row, timing);
  const label = deadlineLabel(row, timing);
  const style = deadlineStyle(timing.days);
  const url = safeUrl(row.deadlineLink);
  return url
    ? `<a class="deadline-pill" style="${style}" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(title)}">${escapeHtml(label)}</a>`
    : `<span class="deadline-pill" style="${style}" title="${escapeAttr(title)}">${escapeHtml(label)}</span>`;
}

function deadlineTiming(row) {
  const target = deadlineTargetDate(row);
  if (!target) return { days: NaN, exact: false };
  const today = startOfToday();
  return {
    days: Math.ceil((target.date.getTime() - today.getTime()) / dayMs),
    exact: target.exact,
    date: target.date,
  };
}

function deadlineTargetDate(row) {
  const exactDate = parseDateOnly(row.deadlineDate);
  const today = startOfToday();
  if (exactDate && exactDate >= today) return { date: exactDate, exact: true };

  const months = Array.isArray(row.deadlineMonths)
    ? row.deadlineMonths.map(Number).filter((month) => month >= 1 && month <= 12)
    : [];
  if (!months.length) return null;
  const candidates = months.map((month) => nextMonthEstimate(today, month));
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return { date: candidates[0], exact: false };
}

function nextMonthEstimate(today, month) {
  let year = today.getFullYear();
  const candidate = new Date(year, month - 1, 15);
  if (candidate < today) {
    year += 1;
  }
  return new Date(year, month - 1, 15);
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function parseDateOnly(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function deadlineStyle(days) {
  if (!Number.isFinite(days)) return "";
  const color = deadlineColor(days);
  return `--deadline-color:${color}`;
}

function deadlineColor(days) {
  const stops = [
    { day: 0, color: [176, 92, 80] },
    { day: 75, color: [174, 126, 72] },
    { day: 180, color: [92, 122, 154] },
    { day: 365, color: [76, 132, 125] },
  ];
  const clamped = Math.max(0, Math.min(365, days));
  for (let index = 0; index < stops.length - 1; index += 1) {
    const left = stops[index];
    const right = stops[index + 1];
    if (clamped <= right.day) {
      const ratio = (clamped - left.day) / (right.day - left.day);
      const rgb = left.color.map((value, channel) => Math.round(value + (right.color[channel] - value) * ratio));
      return `rgb(${rgb.join(", ")})`;
    }
  }
  return `rgb(${stops[stops.length - 1].color.join(", ")})`;
}

function deadlineLabel(row, timing) {
  if (timing.exact && row.deadlineDate) {
    return formatDateMonthDay(row.deadlineDate);
  }
  return row.deadlineMonth;
}

function formatDateMonthDay(value) {
  const match = String(value || "").match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${Number(match[1])}月${Number(match[2])}日`;
}

function deadlineTitle(row, timing) {
  const parts = [];
  if (timing.exact && row.deadlineDate) {
    parts.push(`下次截稿：${row.deadlineDate}`);
  } else {
    parts.push(`常见截稿月份：${row.deadlineMonth}`);
    parts.push("按月份估算");
  }
  if (Number.isFinite(timing.days)) {
    parts.push(`约 ${timing.days} 天后`);
  }
  if (row.deadlineYear) {
    parts.push(`数据届次：${row.deadlineYear}`);
  }
  return parts.join("；");
}

function exportXlsx(rows) {
  const sheetRows = [
    ["领域", "类型", "等级", "截稿月份", "下次截稿日期", "简称", "全称", "出版社/组织", "IF", "JCR分区", "JCR学科", "中科院分区", "中科院大类", "中科院Top", "网址"],
    ...rows.map((row) => [
      row.domain,
      row.typeLabel,
      row.rank,
      row.deadlineMonth || "",
      row.deadlineDate || "",
      row.abbr,
      row.name,
      row.publisher,
      row.impactFactor || "",
      bestQuartile(row.jcrQuartile),
      row.jcrCategory || "",
      row.casPartition || "",
      row.casCategory || "",
      row.casTop || "",
      row.urls.join("; "),
    ]),
  ];
  const blob = createXlsxBlob(sheetRows);
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = buildDownloadFilename(rows);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildDownloadFilename(rows) {
  const parts = ["CCF推荐目录2026"];
  if (state.query) parts.push(`搜索-${state.query}`);
  if (state.types.length) parts.push(`类型-${state.types.map(typeLabel).join("+")}`);
  if (state.ranks.length) parts.push(`等级-${state.ranks.join("+")}`);
  if (state.domains.length) parts.push(`方向-${state.domains.map((domain) => meta.domainShort[domain] || domain).join("+")}`);
  if (parts.length === 1) parts.push("全部");
  parts.push(`${rows.length}条`);
  parts.push(formatTimestamp(new Date()));
  return `${sanitizeFilename(parts.join("_")).slice(0, 150)}.xlsx`;
}

function typeLabel(type) {
  return type === "conference" ? "会议" : "期刊";
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join("");
}

function formatMetaDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function sanitizeFilename(value) {
  return value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "")
    .replace(/_+/g, "_")
    .replace(/-+/g, "-");
}

function createXlsxBlob(rows) {
  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="CCF 2026" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: worksheetXml(rows),
    },
  ];
  return new Blob([zipFiles(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function worksheetXml(rows) {
  const sheetData = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const cells = row.map((value, columnIndex) => cellXml(value, `${columnName(columnIndex + 1)}${rowNumber}`)).join("");
    return `<row r="${rowNumber}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="16"/>
  <cols>
    <col min="1" max="1" width="28" customWidth="1"/>
    <col min="2" max="4" width="12" customWidth="1"/>
    <col min="5" max="5" width="14" customWidth="1"/>
    <col min="6" max="6" width="12" customWidth="1"/>
    <col min="7" max="7" width="54" customWidth="1"/>
    <col min="8" max="8" width="22" customWidth="1"/>
    <col min="9" max="10" width="12" customWidth="1"/>
    <col min="11" max="11" width="44" customWidth="1"/>
    <col min="12" max="14" width="12" customWidth="1"/>
    <col min="15" max="15" width="44" customWidth="1"/>
  </cols>
  <sheetData>${sheetData}</sheetData>
</worksheet>`;
}

function cellXml(value, ref) {
  return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value ?? "")}</t></is></c>`;
}

function columnName(index) {
  let name = "";
  while (index > 0) {
    const remainder = (index - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    index = Math.floor((index - 1) / 26);
  }
  return name;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function zipFiles(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const localHeader = zipLocalHeader(nameBytes, data.length, crc);
    const centralHeader = zipCentralHeader(nameBytes, data.length, crc, offset);
    localParts.push(localHeader, data);
    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = zipEndRecord(files.length, centralSize, centralOffset);
  return concatBytes([...localParts, ...centralParts, end]);
}

function zipLocalHeader(nameBytes, size, crc) {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(8, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, nameBytes.length, true);
  header.set(nameBytes, 30);
  return header;
}

function zipCentralHeader(nameBytes, size, crc, offset) {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(10, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint32(42, offset, true);
  header.set(nameBytes, 46);
  return header;
}

function zipEndRecord(fileCount, centralSize, centralOffset) {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  return header;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

init();
