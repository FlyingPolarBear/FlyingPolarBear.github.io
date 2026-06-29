const meta = window.CCF_META;
const allRows = window.CCF_DATA;

const els = {
  dataUpdated: document.getElementById("dataUpdated"),
  statsTotal: document.getElementById("statsTotal"),
  statsCards: document.getElementById("statsCards"),
  scoreBars: document.getElementById("scoreBars"),
  heatmap: document.getElementById("partitionHeatmap"),
  impactChart: document.getElementById("impactChart"),
  impactChartNote: document.getElementById("impactChartNote"),
  impactMode: document.getElementById("impactMode"),
  scoreTableBody: document.getElementById("scoreTableBody"),
  tableBody: document.getElementById("statsTableBody"),
  themeToggle: document.getElementById("themeToggle"),
  backToTop: document.getElementById("backToTop"),
};

const rankScore = { A: 3, B: 2, C: 1 };
const jcrScoreMap = { Q1: 4, Q2: 3, Q3: 2, Q4: 1 };
const casScoreMap = { "1区": 4, "2区": 3, "3区": 2, "4区": 1 };
let impactGroupMode = "jcr";
let currentImpactStats = [];
const impactModes = new Set(["jcr", "ccf", "cas", "domain"]);

function init() {
  applyStatsUrlState();
  renderDataUpdated();
  const stats = buildDomainStats();
  renderStats(stats);
  bindEvents();
  restoreTheme();
  updateBackToTop();
}

function renderDataUpdated() {
  if (!els.dataUpdated) return;
  els.dataUpdated.textContent = `数据更新 ${formatMetaDate(meta.generatedAt)}`;
}

function bindEvents() {
  els.impactMode.addEventListener("click", (event) => {
    const button = event.target.closest("[data-impact-mode]");
    if (!button) return;
    impactGroupMode = button.dataset.impactMode;
    renderImpactChart(currentImpactStats);
    syncStatsUrlState();
  });
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
  window.addEventListener("popstate", () => {
    applyStatsUrlState();
    renderImpactChart(currentImpactStats);
  });
}

function restoreTheme() {
  const isDark = localStorage.getItem("ccf-theme") === "dark";
  document.body.classList.toggle("dark", isDark);
  els.themeToggle.textContent = isDark ? "浅色" : "深色";
}

function updateBackToTop() {
  els.backToTop.classList.toggle("visible", window.scrollY > 420);
}

function applyStatsUrlState() {
  const mode = new URLSearchParams(window.location.search).get("impact");
  impactGroupMode = impactModes.has(mode) ? mode : "jcr";
}

function syncStatsUrlState() {
  const nextUrl = new URL(window.location.href);
  if (impactGroupMode === "jcr") {
    nextUrl.searchParams.delete("impact");
  } else {
    nextUrl.searchParams.set("impact", impactGroupMode);
  }
  if (nextUrl.href !== window.location.href) {
    history.replaceState(null, "", nextUrl.href);
  }
}

function buildDomainStats() {
  return meta.domainOrder.map((domain) => {
    const rows = allRows.filter((row) => row.domain === domain);
    const journals = rows.filter((row) => row.type === "journal");
    const conferences = rows.filter((row) => row.type === "conference");
    const counts = {
      conferenceA: countRows(conferences, "A"),
      conferenceB: countRows(conferences, "B"),
      conferenceC: countRows(conferences, "C"),
      journalA: countRows(journals, "A"),
      journalB: countRows(journals, "B"),
      journalC: countRows(journals, "C"),
    };
    const ifValues = journals.map((row) => Number(row.impactFactor)).filter(Number.isFinite);
    const ifScores = journals.map((row) => impactScore(row.impactFactor)).filter(Number.isFinite);
    const jcrScores = journals.map((row) => jcrScore(bestQuartile(row.jcrQuartile))).filter(Number.isFinite);
    const casScores = journals.map((row) => casScore(row.casPartition)).filter(Number.isFinite);
    const scoreParts = [
      normalize(avg(ifScores), 3),
      normalize(avg(jcrScores), 4),
      normalize(avg(casScores), 4),
    ].filter(Number.isFinite);
    return {
      domain,
      label: meta.domainShort[domain],
      rows,
      journals,
      conferences,
      counts,
      total: rows.length,
      conferenceTotal: conferences.length,
      journalTotal: journals.length,
      rankA: countRows(rows, "A"),
      rankB: countRows(rows, "B"),
      rankC: countRows(rows, "C"),
      ccfScore: avg(rows.map((row) => rankScore[row.rank]).filter(Number.isFinite)),
      avgIf: avg(ifValues),
      ifScore: avg(ifScores),
      jcrScore: avg(jcrScores),
      casScore: avg(casScores),
      partitionScore: scoreParts.length ? avg(scoreParts) * 100 : NaN,
      coverage: {
        if: ifValues.length,
        jcr: jcrScores.length,
        cas: casScores.length,
      },
      ifBuckets: impactBuckets(journals),
      heat: {
        jcr: countValues(journals.map((row) => bestQuartile(row.jcrQuartile)), ["Q1", "Q2", "Q3", "Q4"]),
        cas: countValues(journals.map((row) => row.casPartition), ["1区", "2区", "3区", "4区"]),
      },
    };
  });
}

function renderStats(stats) {
  const totals = summarizeAll(stats);
  const scoreSortedStats = [...stats].sort((a, b) => valueOrZero(b.partitionScore) - valueOrZero(a.partitionScore));
  currentImpactStats = scoreSortedStats;
  els.statsTotal.textContent = `共 ${totals.total} 条`;
  renderCards(totals);
  renderScoreBars(scoreSortedStats);
  renderHeatmap(stats);
  renderImpactChart(scoreSortedStats);
  renderScoreTable(scoreSortedStats);
  renderCountTable(stats, totals);
}

function summarizeAll(stats) {
  const journals = allRows.filter((row) => row.type === "journal");
  const ifValues = journals.map((row) => Number(row.impactFactor)).filter(Number.isFinite);
  const jcrCount = journals.filter((row) => bestQuartile(row.jcrQuartile)).length;
  const casCount = journals.filter((row) => row.casPartition).length;
  const bestDomain = [...stats].sort((a, b) => valueOrZero(b.partitionScore) - valueOrZero(a.partitionScore))[0];
  return {
    total: allRows.length,
    conferences: allRows.filter((row) => row.type === "conference").length,
    journals: journals.length,
    ifCount: ifValues.length,
    jcrCount,
    casCount,
    avgIf: avg(ifValues),
    bestDomain,
    counts: {
      conferenceA: sum(stats, "conferenceA"),
      conferenceB: sum(stats, "conferenceB"),
      conferenceC: sum(stats, "conferenceC"),
      journalA: sum(stats, "journalA"),
      journalB: sum(stats, "journalB"),
      journalC: sum(stats, "journalC"),
    },
  };
}

function renderCards(totals) {
  const coverage = totals.journals ? Math.round((totals.jcrCount / totals.journals) * 100) : 0;
  els.statsCards.innerHTML = [
    statCard("总条目", totals.total, "会议 + 期刊"),
    statCard("会议", totals.conferences, "CCF推荐会议"),
    statCard("期刊", totals.journals, "含 IF/JCR/中科院"),
    statCard("JCR覆盖", `${coverage}%`, `${totals.jcrCount}/${totals.journals}`),
    statCard("平均IF", formatNumber(totals.avgIf, 1), `${totals.ifCount} 本有IF`),
    statCard("最高方向", totals.bestDomain.label, `${formatNumber(totals.bestDomain.partitionScore, 0)} 分`),
  ].join("");
}

function statCard(label, value, note) {
  return `<article class="stats-card">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
    <em>${escapeHtml(note)}</em>
  </article>`;
}

function renderScoreBars(stats) {
  const maxScore = Math.max(...stats.map((item) => valueOrZero(item.partitionScore)), 1);
  els.scoreBars.innerHTML = stats.map((item) => {
    const score = valueOrZero(item.partitionScore);
    const width = Math.max(4, (score / maxScore) * 100);
    return `<div class="score-bar-row">
      <div class="score-bar-label">
        <strong>${escapeHtml(item.label)}</strong>
        <span>${item.journalTotal}刊 / ${item.conferenceTotal}会</span>
      </div>
      <div class="score-bar-track" aria-hidden="true">
        <span style="width:${formatNumber(width, 1)}%"></span>
      </div>
      <b>${formatNumber(score, 0)}</b>
    </div>`;
  }).join("");
}

function renderHeatmap(stats) {
  const columns = ["Q1", "Q2", "Q3", "Q4", "1区", "2区", "3区", "4区"];
  const max = Math.max(...stats.flatMap((item) => [
    ...Object.values(item.heat.jcr),
    ...Object.values(item.heat.cas),
  ]), 1);
  const header = `<div class="heatmap-row heatmap-head"><span>方向</span>${columns.map((column) => `<b>${column}</b>`).join("")}</div>`;
  const body = stats.map((item) => {
    const cells = columns.map((column) => {
      const value = column.startsWith("Q") ? item.heat.jcr[column] : item.heat.cas[column];
      const intensity = value / max;
      const style = heatStyle(column, intensity);
      return `<b class="heat-cell" style="${style}" title="${escapeAttr(item.label)} ${column}: ${value}">${value}</b>`;
    }).join("");
    return `<div class="heatmap-row"><span>${escapeHtml(item.label)}</span>${cells}</div>`;
  }).join("");
  els.heatmap.innerHTML = header + body;
}

function renderImpactChart(stats) {
  const xMin = 0;
  const xMax = impactAxisMax();
  const xValues = sampleRange(xMin, xMax, 140);
  syncImpactModeUI();
  const seriesList = buildImpactSeries(stats, impactGroupMode, xValues);
  const maxDensity = Math.max(...seriesList.flatMap((series) => series.densityPoints.map((point) => point.density)), 0.01);
  const yMax = niceDensityMax(maxDensity);
  const width = 1040;
  const height = 390;
  const margin = { top: 24, right: 28, bottom: 58, left: 50 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const yTicks = buildDensityTicks(yMax);
  const xTicks = buildImpactTicks(xMax);
  const baseY = height - margin.bottom;
  const xScale = (value) => margin.left + ((value - xMin) / (xMax - xMin)) * plotWidth;
  const grid = yTicks.map((tick) => {
    const y = yScale(tick, yMax, margin.top, plotHeight);
    return `<g class="if-grid">
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"></line>
      <text x="${margin.left - 10}" y="${y + 4}" text-anchor="end">${formatDensity(tick)}</text>
    </g>`;
  }).join("");
  const xLabels = xTicks.map((tick) => {
    const x = xScale(tick);
    return `<text class="if-x-label" x="${formatNumber(x, 2)}" y="${height - 28}" text-anchor="middle">${tick}</text>`;
  }).join("");
  const seriesMarkup = seriesList.map((series) => {
    const points = series.densityPoints.map((point) => ({
      x: xScale(point.x),
      y: yScale(point.density, yMax, margin.top, plotHeight),
      density: point.density,
      value: point.x,
    }));
    const linePath = smoothPath(points);
    const first = points[0];
    const last = points[points.length - 1];
    const areaPath = `${linePath} L ${formatNumber(last.x, 2)} ${baseY} L ${formatNumber(first.x, 2)} ${baseY} Z`;
    return `<g class="if-series" tabindex="0" role="img"
      style="--series-color:${series.color}"
      aria-label="${escapeAttr(series.label)} ${series.count} 本期刊 平均IF ${formatNumber(series.avgIf, 1)}"
      data-key="${escapeAttr(series.key)}"
      data-label="${escapeAttr(series.label)}"
      data-count="${series.count}"
      data-avg="${formatNumber(series.avgIf, 1)}"
      data-max="${formatNumber(series.maxIf, 1)}"
      data-peak="${formatNumber(series.peakIf, 1)}"
      data-top="${escapeAttr(topImpactItems(series.items))}">
      <path class="if-area" d="${areaPath}"></path>
      <path class="if-line" d="${linePath}"></path>
      <path class="if-hit-line" d="${linePath}"></path>
    </g>`;
  }).join("");
  const legend = seriesList.map((series) => `<button class="if-legend-item" type="button"
    style="--series-color:${series.color}"
    data-key="${escapeAttr(series.key)}"
    aria-label="${escapeAttr(series.label)}">
      <i aria-hidden="true"></i>${escapeHtml(series.label)}
    </button>`).join("");
  els.impactChart.innerHTML = `<div class="if-distribution-wrap">
    <svg class="if-distribution" viewBox="0 0 ${width} ${height}" role="img" aria-label="影响因子分布图">
      <rect class="if-plot-bg" x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" rx="8"></rect>
      ${grid}
      ${seriesMarkup}
      <line class="if-axis" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"></line>
      <line class="if-axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"></line>
      ${xLabels}
    </svg>
    <div class="if-legend">
      ${legend}
    </div>
    <div class="if-tooltip" role="status" aria-live="polite"></div>
  </div>`;
  bindImpactInteractions();
}

function bindImpactInteractions() {
  const wrap = els.impactChart.querySelector(".if-distribution-wrap");
  const tooltip = els.impactChart.querySelector(".if-tooltip");
  if (!wrap || !tooltip) return;

  wrap.addEventListener("pointermove", (event) => {
    const target = event.target.closest(".if-series, .if-legend-item");
    if (!target) {
      hideImpactTooltip();
      return;
    }
    showImpactTooltip(target, event.clientX, event.clientY);
  });
  wrap.addEventListener("pointerleave", hideImpactTooltip);
  wrap.addEventListener("focusin", (event) => {
    const target = event.target.closest(".if-series, .if-legend-item");
    if (!target) return;
    const rect = target.getBoundingClientRect();
    showImpactTooltip(target, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  wrap.addEventListener("focusout", (event) => {
    if (!event.target.closest(".if-series, .if-legend-item")) return;
    hideImpactTooltip();
  });
  wrap.addEventListener("keydown", (event) => {
    const target = event.target.closest(".if-series, .if-legend-item");
    if (!target) return;
    if (event.key === "Escape") hideImpactTooltip();
  });
}

function showImpactTooltip(target, clientX, clientY) {
  const series = impactSeriesByKey(target.dataset.key);
  const tooltip = els.impactChart.querySelector(".if-tooltip");
  if (!tooltip || !series) return;
  tooltip.innerHTML = `<strong>${escapeHtml(series.dataset.label)}</strong>
    <b>${escapeHtml(series.dataset.count)} 本期刊 · 平均 IF ${escapeHtml(series.dataset.avg)}</b>
    <span>密度峰值：IF ${escapeHtml(series.dataset.peak)}</span>
    <em>最高：${escapeHtml(series.dataset.top || "-")}</em>`;
  tooltip.classList.add("visible");
  setImpactActive(series.dataset.key);
  positionImpactTooltip(tooltip, clientX, clientY);
}

function positionImpactTooltip(tooltip, clientX, clientY) {
  const padding = 14;
  const rect = tooltip.getBoundingClientRect();
  let left = clientX + padding;
  let top = clientY + padding;
  if (left + rect.width > window.innerWidth - padding) left = clientX - rect.width - padding;
  if (top + rect.height > window.innerHeight - padding) top = clientY - rect.height - padding;
  tooltip.style.left = `${Math.max(padding, left)}px`;
  tooltip.style.top = `${Math.max(padding, top)}px`;
}

function hideImpactTooltip() {
  const tooltip = els.impactChart.querySelector(".if-tooltip");
  if (tooltip) tooltip.classList.remove("visible");
  els.impactChart.querySelectorAll(".if-series, .if-legend-item").forEach((item) => {
    item.classList.remove("is-active", "is-muted");
  });
}

function setImpactActive(activeKey) {
  els.impactChart.querySelectorAll(".if-series, .if-legend-item").forEach((item) => {
    const active = item.dataset.key === activeKey;
    item.classList.toggle("is-active", active);
    item.classList.toggle("is-muted", !active);
  });
}

function heatStyle(column, intensity) {
  const alpha = 0.1 + intensity * 0.72;
  if (column.startsWith("Q")) return `--heat-bg:rgba(37, 99, 235, ${alpha});--heat-fg:${intensity > 0.48 ? "#fff" : "#1d4ed8"}`;
  return `--heat-bg:rgba(234, 88, 12, ${alpha});--heat-fg:${intensity > 0.48 ? "#fff" : "#9a3412"}`;
}

function renderScoreTable(stats) {
  els.scoreTableBody.innerHTML = stats.map((item) => `<tr>
    <td>${escapeHtml(item.label)}</td>
    <td>${item.total}</td>
    <td>${item.conferenceTotal}</td>
    <td>${item.journalTotal}</td>
    <td>${item.rankA}/${item.rankB}/${item.rankC}</td>
    <td>${formatNumber(item.avgIf, 1)}</td>
    <td>${formatNumber(item.ifScore, 1)}</td>
    <td>${formatNumber(item.jcrScore, 1)}</td>
    <td>${formatNumber(item.casScore, 1)}</td>
    <td><span class="score-pill">${formatNumber(item.partitionScore, 0)}</span></td>
  </tr>`).join("");
}

function renderCountTable(stats, totals) {
  const rows = stats.map((item) => statsRow(item.label, item.counts));
  rows.push(statsRow("总计", totals.counts, "total-row"));
  els.tableBody.innerHTML = rows.join("");
}

function statsRow(label, item, className = "") {
  const conferenceTotal = item.conferenceA + item.conferenceB + item.conferenceC;
  const journalTotal = item.journalA + item.journalB + item.journalC;
  const total = conferenceTotal + journalTotal;
  return `<tr class="${className}">
    <td>${escapeHtml(label)}</td>
    <td>${item.conferenceA}</td>
    <td>${item.conferenceB}</td>
    <td>${item.conferenceC}</td>
    <td>${conferenceTotal}</td>
    <td>${item.journalA}</td>
    <td>${item.journalB}</td>
    <td>${item.journalC}</td>
    <td>${journalTotal}</td>
    <td>${total}</td>
  </tr>`;
}

function countRows(rows, rank) {
  return rows.filter((row) => row.rank === rank).length;
}

function countValues(values, keys) {
  return Object.fromEntries(keys.map((key) => [key, values.filter((value) => value === key).length]));
}

function impactBuckets(journals) {
  const buckets = { low: 0, mid: 0, high: 0, empty: 0 };
  for (const row of journals) {
    const value = Number(row.impactFactor);
    if (!Number.isFinite(value)) {
      buckets.empty += 1;
    } else if (value >= 10) {
      buckets.high += 1;
    } else if (value >= 5) {
      buckets.mid += 1;
    } else {
      buckets.low += 1;
    }
  }
  return buckets;
}

function syncImpactModeUI() {
  const notes = {
    jcr: "JCR 分区密度 / IF",
    ccf: "CCF 等级密度 / IF",
    cas: "中科院分区密度 / IF",
    domain: "方向密度 / IF",
  };
  els.impactChartNote.textContent = notes[impactGroupMode] || notes.jcr;
  els.impactMode.querySelectorAll("[data-impact-mode]").forEach((button) => {
    const active = button.dataset.impactMode === impactGroupMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function buildImpactSeries(stats, mode, xValues) {
  return impactGroups(stats, mode).map((group, index) => {
    const items = journalImpactItems(group.rows);
    const densityPoints = kernelDensityPoints(items.map((itemValue) => itemValue.ifValue), xValues);
    const peakPoint = densityPoints.reduce((peak, point) => point.density > peak.density ? point : peak, densityPoints[0]);
    return {
      key: group.key,
      label: group.label,
      color: impactSeriesColor(index, mode, group.key),
      items,
      densityPoints,
      peakIf: peakPoint?.x ?? NaN,
      count: items.length,
      avgIf: avg(items.map((itemValue) => itemValue.ifValue)),
      maxIf: items.length ? Math.max(...items.map((itemValue) => itemValue.ifValue)) : NaN,
    };
  }).filter((series) => series.count);
}

function impactGroups(stats, mode) {
  const journals = allRows.filter((row) => row.type === "journal");
  if (mode === "cas") {
    return ["1区", "2区", "3区", "4区"].map((zone) => ({
      key: `cas-${zone}`,
      label: zone,
      rows: journals.filter((row) => row.casPartition === zone),
    }));
  }
  if (mode === "ccf") {
    return ["A", "B", "C"].map((rank) => ({
      key: `ccf-${rank}`,
      label: rank,
      rows: journals.filter((row) => row.rank === rank),
    }));
  }
  if (mode === "domain") {
    return stats.map((item) => ({
      key: `domain-${item.domain}`,
      label: item.label,
      rows: item.journals,
    }));
  }
  return ["Q1", "Q2", "Q3", "Q4"].map((quartile) => ({
    key: `jcr-${quartile}`,
    label: quartile,
    rows: journals.filter((row) => bestQuartile(row.jcrQuartile) === quartile),
  }));
}

function journalImpactItems(rows) {
  return rows
    .map((row) => ({ row, ifValue: Number(row.impactFactor) }))
    .filter((itemValue) => Number.isFinite(itemValue.ifValue));
}

function impactAxisMax() {
  return 20;
}

function sampleRange(min, max, count) {
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, index) => min + index * step);
}

function kernelDensityPoints(values, xValues) {
  if (!values.length) return xValues.map((x) => ({ x, density: 0 }));
  const bandwidth = densityBandwidth(values);
  const normalizer = values.length * bandwidth * Math.sqrt(2 * Math.PI);
  return xValues.map((x) => {
    const density = values.reduce((total, value) => {
      const scaled = (x - value) / bandwidth;
      return total + Math.exp(-0.5 * scaled * scaled);
    }, 0) / normalizer;
    return { x, density };
  });
}

function densityBandwidth(values) {
  if (values.length < 2) return 1.2;
  const sigma = standardDeviation(values) || 1;
  return clamp(1.06 * sigma * Math.pow(values.length, -0.2), 0.85, 2.8);
}

function standardDeviation(values) {
  const mean = avg(values);
  if (!Number.isFinite(mean)) return NaN;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function impactSeriesColor(index, mode, key) {
  const partitionColors = {
    "jcr-Q1": "#1d4ed8",
    "jcr-Q2": "#0284c7",
    "jcr-Q3": "#60a5fa",
    "jcr-Q4": "#94a3b8",
    "cas-1区": "#c2410c",
    "cas-2区": "#f97316",
    "cas-3区": "#f59e0b",
    "cas-4区": "#fdba74",
    "ccf-A": "#b42318",
    "ccf-B": "#9a5b00",
    "ccf-C": "#256b45",
  };
  if (mode !== "domain" && partitionColors[key]) return partitionColors[key];
  const colors = ["#2563eb", "#ea580c", "#0891b2", "#9333ea", "#dc2626", "#16a34a", "#7c3aed", "#be123c", "#0f766e", "#64748b"];
  return colors[index % colors.length];
}

function niceDensityMax(value) {
  if (value <= 0.12) return 0.12;
  if (value <= 0.18) return 0.18;
  if (value <= 0.25) return 0.25;
  if (value <= 0.35) return 0.35;
  return Math.ceil(value * 10) / 10;
}

function buildDensityTicks(maxValue) {
  return Array.from({ length: 5 }, (_, index) => (maxValue / 4) * index);
}

function buildImpactTicks(maxValue) {
  const ticks = [];
  for (let value = 0; value <= maxValue; value += 5) ticks.push(value);
  return ticks;
}

function formatDensity(value) {
  return value === 0 ? "0" : value.toFixed(2);
}

function yScale(value, maxValue, top, height) {
  return top + height - (value / maxValue) * height;
}

function smoothPath(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${formatNumber(points[0].x, 2)} ${formatNumber(points[0].y, 2)}`;
  let path = `M ${formatNumber(points[0].x, 2)} ${formatNumber(points[0].y, 2)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] || points[index];
    const current = points[index];
    const next = points[index + 1];
    const nextAfter = points[index + 2] || next;
    const minY = Math.min(current.y, next.y);
    const maxY = Math.max(current.y, next.y);
    const cp1x = current.x + (next.x - previous.x) / 6;
    const cp1y = clamp(current.y + (next.y - previous.y) / 6, minY, maxY);
    const cp2x = next.x - (nextAfter.x - current.x) / 6;
    const cp2y = clamp(next.y - (nextAfter.y - current.y) / 6, minY, maxY);
    path += ` C ${formatNumber(cp1x, 2)} ${formatNumber(cp1y, 2)}, ${formatNumber(cp2x, 2)} ${formatNumber(cp2y, 2)}, ${formatNumber(next.x, 2)} ${formatNumber(next.y, 2)}`;
  }
  return path;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function topImpactItems(items) {
  return [...items]
    .sort((a, b) => b.ifValue - a.ifValue)
    .slice(0, 3)
    .map((item) => `${item.row.abbr || item.row.name} ${formatNumber(item.ifValue, 1)}`)
    .join("；");
}

function impactSeriesByKey(key) {
  return [...els.impactChart.querySelectorAll(".if-series")].find((series) => series.dataset.key === key);
}

function sum(stats, key) {
  return stats.reduce((total, item) => total + item.counts[key], 0);
}

function bestQuartile(value) {
  const values = new Set(String(value || "").toUpperCase().match(/Q[1-4]/g) || []);
  return ["Q1", "Q2", "Q3", "Q4"].find((quartile) => values.has(quartile)) || "";
}

function impactScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return NaN;
  if (number >= 10) return 3;
  if (number >= 5) return 2;
  return 1;
}

function jcrScore(value) {
  return jcrScoreMap[value] ?? NaN;
}

function casScore(value) {
  const match = String(value || "").match(/[1-4]区/);
  return match ? casScoreMap[match[0]] : NaN;
}

function normalize(value, max) {
  return Number.isFinite(value) && max ? value / max : NaN;
}

function avg(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sumValue, value) => sumValue + value, 0) / valid.length : NaN;
}

function valueOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

function formatNumber(value, digits) {
  return Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function formatMetaDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
