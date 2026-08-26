// ============================================================
// nart-hiv.js  (extracted from main.js lines 5403-5976)
// domain section 5403-5976
// ============================================================
// ── NART Trend Chart ────────────────────────────────────────────────
let _nartTrendData = null;

async function renderNartTrendChart(container) {
  const wrapper = document.createElement("div");
  wrapper.id = "nartCsvWrapper";
  wrapper.className =
    "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm";
  wrapper.innerHTML = `
    <div class="flex items-center justify-center py-16 text-slate-500 text-sm gap-2">
      <div class="w-5 h-5 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
      Loading chart data…
    </div>
  `;
  container.appendChild(wrapper);

  const county =
    state.countyFilter !== "all" ? state.countyFilter : "Meru County";
  const scParam =
    state.subCountyFilter !== "all"
      ? `&subcounty=${encodeURIComponent(state.subCountyFilter)}`
      : "";
  const facParam =
    state.facilityFilter !== "all"
      ? `&facility=${encodeURIComponent(state.facilityFilter)}`
      : "";
  const projParam =
    state.projectFilter !== "all"
      ? `&project=${encodeURIComponent(state.projectFilter)}`
      : "";
  try {
    const resp = await fetch(
      `/api/hiv-treatment/nart-trend?county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}`,
    );
    const json = await resp.json();
    if (json.error) {
      wrapper.innerHTML = `<div class="text-red-500 text-sm py-8 text-center">${escapeHtml(json.error)}</div>`;
      return;
    }
    _nartTrendData = json;
    buildNartChart(wrapper, json);
  } catch (e) {
    wrapper.innerHTML = `<div class="text-red-500 text-sm py-8 text-center">Failed to load: ${escapeHtml(e.message)}</div>`;
  }
}

function buildNartChart(container, data) {
  const { county, metrics, trend } = data;

  const metricColors = {
    total: "#2563eb",
    males: "#16a34a",
    adults_15plus: "#d97706",
  };
  const series = metrics.map((m) => ({
    name: m.label,
    key: m.key,
    data: trend.map((p) => p[m.key]),
    color: metricColors[m.key],
  }));
  const categories = trend.map((p) => p.label);

  container.innerHTML = `
    <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex items-center justify-between mb-2">
        <div>
          <div class="text-sm font-bold text-slate-800">Newly Started on ART – ${escapeHtml(county)}</div>
          <div class="text-xs text-slate-400">Monthly trend ${categories[0]} to ${categories[categories.length - 1]}</div>
        </div>
        <div class="relative">
          <button id="nartMenuBtn" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-500" title="Options">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
          </button>
          <div id="nartMenu" class="hidden absolute right-0 top-10 bg-white border border-slate-200 rounded-xl shadow-lg z-50 min-w-[180px] py-1">
            <button data-nart-action="fullscreen" class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              View Full Chart
            </button>
            <button data-nart-action="viewdata" class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              View Data Used
            </button>
          </div>
        </div>
      </div>
      <div id="nartMainChart" style="height:380px;width:100%"></div>
    </div>
  `;

  // ── Hamburger menu toggle ──
  const menuBtn = document.getElementById("nartMenuBtn");
  const menu = document.getElementById("nartMenu");
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("hidden");
  });
  document.addEventListener("click", () => menu.classList.add("hidden"), {
    once: false,
  });

  // ── Menu actions ──
  container.querySelectorAll("[data-nart-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.add("hidden");
      const action = btn.getAttribute("data-nart-action");
      if (action === "fullscreen") openNartFullscreen(data);
      if (action === "viewdata") openNartDataModal(data);
    });
  });

  // ── Render Highcharts ──
  if (window.Highcharts) {
    Highcharts.chart("nartMainChart", {
      chart: { type: "line", zoomType: "x" },
      title: { text: null },
      xAxis: {
        categories,
        labels: { style: { fontSize: "11px" }, rotation: -30 },
      },
      yAxis: { title: { text: "Patients" }, allowDecimals: false },
      tooltip: { shared: true, valueSuffix: " patients" },
      plotOptions: {
        series: { marker: { enabled: true, radius: 3 }, connectNulls: false },
      },
      series,
      credits: { enabled: false },
      exporting: { enabled: false },
      legend: {
        align: "center",
        verticalAlign: "bottom",
        layout: "horizontal",
      },
    });
  }
}

function openNartFullscreen(data) {
  const { county, metrics, trend } = data;
  const metricColors = {
    total: "#2563eb",
    males: "#16a34a",
    adults_15plus: "#d97706",
  };
  const categories = trend.map((p) => p.label);

  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm";
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-4xl max-h-[95vh] flex flex-col">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div>
          <div class="text-lg font-bold text-slate-800">Newly Started on ART – ${escapeHtml(county)}</div>
          <div class="text-xs text-slate-400">${categories[0]} to ${categories[categories.length - 1]}</div>
        </div>
        <button id="nartFsClose" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-400">&times;</button>
      </div>
      <div class="flex-1 p-4" id="nartFsChart" style="min-height:450px"></div>
    </div>
  `;
  document.body.appendChild(modal);

  modal
    .querySelector("#nartFsClose")
    .addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });

  const series = metrics.map((m) => ({
    name: m.label,
    key: m.key,
    data: trend.map((p) => p[m.key]),
    color: metricColors[m.key],
  }));

  if (window.Highcharts) {
    Highcharts.chart("nartFsChart", {
      chart: { type: "line", zoomType: "x" },
      title: { text: null },
      xAxis: {
        categories,
        labels: { style: { fontSize: "11px" }, rotation: -30 },
      },
      yAxis: { title: { text: "Patients" }, allowDecimals: false },
      tooltip: { shared: true, valueSuffix: " patients" },
      plotOptions: { series: { marker: { enabled: true, radius: 4 } } },
      series,
      credits: { enabled: false },
      exporting: { enabled: true },
      legend: { align: "center", verticalAlign: "bottom" },
    });
  }
}

function openNartDataModal(data) {
  const { county, metrics, trend } = data;
  const rows = trend
    .map((p) => {
      let r = `<td class="px-3 py-1.5 text-sm font-medium text-slate-600">${escapeHtml(p.label)}</td>`;
      for (const m of metrics)
        r += `<td class="px-3 py-1.5 text-sm text-slate-700 text-right">${p[m.key]}</td>`;
      return `<tr class="border-b border-slate-100 hover:bg-slate-50">${r}</tr>`;
    })
    .join("");

  const headers = metrics
    .map(
      (m) =>
        `<th class="px-3 py-2 text-xs font-semibold text-slate-500 text-right">${escapeHtml(m.label)}</th>`,
    )
    .join("");

  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm";
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-3xl max-h-[85vh] flex flex-col">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div>
          <div class="text-lg font-bold text-slate-800">Data Used – ${escapeHtml(county)}</div>
          <div class="text-xs text-slate-400">${trend.length} months of data</div>
        </div>
        <button id="nartDtClose" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-400">&times;</button>
      </div>
      <div class="flex-1 overflow-auto p-4">
        <table class="w-full border-collapse">
          <thead><tr class="border-b border-slate-200"><th class="px-3 py-2 text-xs font-semibold text-slate-500 text-left">Period</th>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal
    .querySelector("#nartDtClose")
    .addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

// ── NART Live DHIS2 Chart ───────────────────────────────────────────
let _nartDhisData = null;

async function renderNartDhisLiveChart(container) {
  const wrapper = document.createElement("div");
  wrapper.id = "nartDhisWrapper";
  wrapper.className =
    "rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm";
  wrapper.innerHTML = `
    <div class="flex items-center justify-center py-10 text-slate-500 text-sm gap-2">
      <div class="w-5 h-5 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
      Querying DHIS2 live…
    </div>
  `;
  container.appendChild(wrapper);

  const county =
    state.countyFilter !== "all" ? state.countyFilter : "Meru County";
  const scParam =
    state.subCountyFilter !== "all"
      ? `&subcounty=${encodeURIComponent(state.subCountyFilter)}`
      : "";
  const facParam =
    state.facilityFilter !== "all"
      ? `&facility=${encodeURIComponent(state.facilityFilter)}`
      : "";
  const projParam =
    state.projectFilter !== "all"
      ? `&project=${encodeURIComponent(state.projectFilter)}`
      : "";
  try {
    const resp = await fetch(
      `/api/hiv-treatment/nart-dhis-live?county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}`,
    );
    const json = await resp.json();
    if (json.error) {
      wrapper.innerHTML = `<div class="text-red-500 text-sm py-8 text-center">${escapeHtml(json.error)}</div>`;
      return;
    }
    _nartDhisData = json;
    buildNartDhisChart(wrapper, json);
  } catch (e) {
    wrapper.innerHTML = `<div class="text-red-500 text-sm py-8 text-center">DHIS2 unavailable: ${escapeHtml(e.message)}</div>`;
  }
}

function buildNartDhisChart(wrapper, data) {
  const { county, metrics, trend, fetched_at, superpower_url } = data;

  const metricColors = {
    total: "#2563eb",
    males: "#16a34a",
    adults_15plus: "#d97706",
  };
  const series = metrics.map((m) => ({
    name: m.label,
    key: m.key,
    data: trend.map((p) => p[m.key]),
    color: metricColors[m.key],
  }));
  const categories = trend.map((p) => p.label);

  wrapper.innerHTML = `
    <div class="flex items-center justify-between mb-2">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold text-slate-800">Newly Started on ART – ${escapeHtml(county)}</span>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-100 text-purple-700 border border-purple-300">
            <span class="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
            ⚡ Superpower
          </span>
        </div>
        <div class="text-xs text-slate-400">
          ${categories[0] || ""} to ${categories[categories.length - 1] || ""}
          ${fetched_at ? ` · Fetched ${fetched_at}` : ""}
        </div>
        ${superpower_url ? `<div class="text-[10px] text-purple-500 mt-0.5 truncate max-w-md" title="${escapeHtml(superpower_url)}">🔗 ${escapeHtml(superpower_url.substring(0, 80))}…</div>` : ""}
      </div>
      <div class="relative">
        <button id="nartDhisMenuBtn" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-500" title="Options">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        </button>
        <div id="nartDhisMenu" class="hidden absolute right-0 top-10 bg-white border border-slate-200 rounded-xl shadow-lg z-50 min-w-[180px] py-1">
          <button data-nart-dhis-action="fullscreen" class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            View Full Chart
          </button>
          <button data-nart-dhis-action="viewdata" class="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            View Data Used
          </button>
        </div>
      </div>
    </div>
    <div id="nartDhisMainChart" style="height:380px;width:100%"></div>
  `;

  // ── Hamburger menu ──
  const menuBtn = document.getElementById("nartDhisMenuBtn");
  const menu = document.getElementById("nartDhisMenu");
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("hidden");
  });
  document.addEventListener("click", () => menu.classList.add("hidden"));

  wrapper.querySelectorAll("[data-nart-dhis-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.add("hidden");
      const action = btn.getAttribute("data-nart-dhis-action");
      if (action === "fullscreen") openNartDhisFullscreen(data);
      if (action === "viewdata") openNartDhisDataModal(data);
    });
  });

  // ── Highcharts ──
  if (window.Highcharts) {
    Highcharts.chart("nartDhisMainChart", {
      chart: { type: "line", zoomType: "x" },
      title: { text: null },
      xAxis: {
        categories,
        labels: { style: { fontSize: "11px" }, rotation: -30 },
      },
      yAxis: { title: { text: "Patients" }, allowDecimals: false },
      tooltip: { shared: true, valueSuffix: " patients" },
      plotOptions: {
        series: { marker: { enabled: true, radius: 3 }, connectNulls: false },
      },
      series,
      credits: { enabled: false },
      exporting: { enabled: false },
      legend: { align: "center", verticalAlign: "bottom" },
    });
  }
}

function openNartDhisFullscreen(data) {
  const { county, metrics, trend } = data;
  const metricColors = {
    total: "#2563eb",
    males: "#16a34a",
    adults_15plus: "#d97706",
  };
  const categories = trend.map((p) => p.label);
  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm";
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-4xl max-h-[95vh] flex flex-col">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div>
          <div class="text-lg font-bold text-slate-800">⚡ Superpower – ${escapeHtml(county)}</div>
          <div class="text-xs text-slate-400">${categories[0]} to ${categories[categories.length - 1]}</div>
        </div>
        <button id="nartDhisFsClose" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-400">&times;</button>
      </div>
      <div class="flex-1 p-4" id="nartDhisFsChart" style="min-height:450px"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal
    .querySelector("#nartDhisFsClose")
    .addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
  const series = metrics.map((m) => ({
    name: m.label,
    key: m.key,
    data: trend.map((p) => p[m.key]),
    color: metricColors[m.key],
  }));
  if (window.Highcharts) {
    Highcharts.chart("nartDhisFsChart", {
      chart: { type: "line", zoomType: "x" },
      title: { text: null },
      xAxis: {
        categories,
        labels: { style: { fontSize: "11px" }, rotation: -30 },
      },
      yAxis: { title: { text: "Patients" }, allowDecimals: false },
      tooltip: { shared: true, valueSuffix: " patients" },
      plotOptions: { series: { marker: { enabled: true, radius: 4 } } },
      series,
      credits: { enabled: false },
      exporting: { enabled: true },
      legend: { align: "center", verticalAlign: "bottom" },
    });
  }
}

function openNartDhisDataModal(data) {
  const { county, metrics, trend } = data;
  const rows = trend
    .map((p) => {
      let r = `<td class="px-3 py-1.5 text-sm font-medium text-slate-600">${escapeHtml(p.label)}</td>`;
      for (const m of metrics)
        r += `<td class="px-3 py-1.5 text-sm text-slate-700 text-right">${p[m.key]}</td>`;
      return `<tr class="border-b border-slate-100 hover:bg-slate-50">${r}</tr>`;
    })
    .join("");
  const headers = metrics
    .map(
      (m) =>
        `<th class="px-3 py-2 text-xs font-semibold text-slate-500 text-right">${escapeHtml(m.label)}</th>`,
    )
    .join("");
  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm";
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-3xl max-h-[85vh] flex flex-col">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div>
          <div class="text-lg font-bold text-slate-800">⚡ Superpower Data – ${escapeHtml(county)}</div>
          <div class="text-xs text-slate-400">${trend.length} months · Source: CHAK DHIS2</div>
        </div>
        <button id="nartDhisDtClose" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-400">&times;</button>
      </div>
      <div class="flex-1 overflow-auto p-4">
        <table class="w-full border-collapse">
          <thead><tr class="border-b border-slate-200"><th class="px-3 py-2 text-xs font-semibold text-slate-500 text-left">Period</th>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal
    .querySelector("#nartDhisDtClose")
    .addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

// ═══════════════════════════════════════════════════════════════════
// ── Unified DHIS2 Live Chart Renderer (tx_new, tx_curr, vl, …) ──
// ═══════════════════════════════════════════════════════════════════

const SUBTAB_TYPE_MAP = {
  "newly-started-on-art": {
    type: "tx_new",
    title: "Newly Started on ART",
    badge: "⚡ Superpower",
  },
  "current-on-art": {
    type: "tx_curr",
    title: "Current on ART",
    badge: "⚡ Superpower",
  },
  "vl-monitoring": {
    type: "vl",
    title: "VL Monitoring",
    badge: "⚡ Superpower",
  },
  "art-optimization": {
    type: "art_optimization",
    title: "ART Optimization",
    badge: "⚡ JTP Data",
    chartType: "multi-metric",
  },
  "adverse-events---ae": {
    type: "adverse_events",
    title: "Adverse Events (AE)",
    badge: "⚡ JTP Data",
    chartType: "multi-metric",
  },
  dsd: {
    type: "dsd",
    title: "Differentiated Service Delivery",
    badge: "⚡ JTP Data",
    chartType: "multi-metric",
  },
  "treatment-outcomes": {
    type: "treatment_outcomes",
    title: "Treatment Outcomes",
    badge: "⚡ JTP Data",
    chartType: "multi-metric",
  },
  otz: {
    type: "otz",
    title: "OTZ (O and Teen Club)",
    badge: "⚡ JTP Data",
    chartType: "multi-metric",
  },
  ovc: {
    type: "ovc",
    title: "OVC",
    badge: "⚡ JTP Data",
    chartType: "multi-metric",
  },
  "covid-19": {
    type: "covid",
    title: "COVID-19",
    badge: "⚡ JTP Data",
    chartType: "multi-metric",
  },
  ahd: {
    type: "ahd",
    title: "Advanced HIV Disease",
    badge: "⚡ JTP Data",
    chartType: "multi-metric",
  },
  "hiv-testing-services-uptake": {
    type: "hts_uptake",
    title: "HTS Uptake",
    badge: "⚡ Live",
  },
  "hiv-testing-services-linkage": {
    type: "hts_linkage",
    title: "HTS Linkage",
    badge: "⚡ Live",
  },
  "partner-notification-services": {
    type: "partner_notification",
    title: "Partner Notification",
    badge: "⚡ Live",
  },
  prep: {
    type: "prep",
    title: "PrEP",
    badge: "⚡ Live",
  },
};

let _dhisLiveData = null; // cached data for current view

