// ============================================================
// chak-project-ui.js  (extracted from main.js lines 19673-20113)
// domain section 19673-20113
// ============================================================
function renderChakProjectOverview() {
  var proj = getActiveChakProject();
  if (!proj) {
    elements.chartRoot.innerHTML =
      '<div class="p-8 text-center text-slate-400">Project not found.</div>';
    return;
  }

  var hasSubs = !!(proj.subprojects && proj.subprojects.length);
  var sub = hasSubs ? getActiveChakSubproject() : null;
  var datasets = sub ? sub.datasets || [] : proj.datasets || [];
  var dashboards = sub ? sub.dashboards || [] : proj.dashboards || [];

  var datasetCards = datasets
    .map(function (ds) {
      return (
        '<button data-chak-dataset="' +
        escapeHtml(ds.id) +
        '" class="flex flex-col items-start gap-1 rounded-2xl border-2 border-slate-200 bg-white p-4 text-left hover:border-sky-300 hover:bg-sky-50 transition">' +
        '<div class="text-[14px] font-bold text-slate-800">' +
        escapeHtml(ds.name) +
        "</div>" +
        '<div class="text-[11px] text-slate-400">' +
        (ds.elements || "?") +
        " data elements</div>" +
        "</div>"
      );
    })
    .join("");

  var dashboardItems = dashboards
    .map(function (db) {
      var dbId = typeof db === "string" ? db : db.id;
      var dbName = typeof db === "string" ? db : db.name;
      var vizCount =
        typeof db === "string"
          ? 0
          : db.visualizations
            ? db.visualizations.length
            : 0;
      return (
        '<button data-chak-dashboard="' +
        escapeHtml(dbId) +
        '" class="flex flex-col items-start gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-sky-300 hover:bg-sky-50 transition w-full">' +
        '<div class="text-[13px] font-semibold text-slate-700">' +
        escapeHtml(dbName) +
        "</div>" +
        (vizCount > 0
          ? '<div class="text-[11px] text-slate-400">' +
            vizCount +
            " visualizations</div>"
          : "") +
        "</div>"
      );
    })
    .join("");

  // Subproject tabs (if this project groups multiple sub-projects)
  var subTabsHtml = "";
  if (hasSubs) {
    subTabsHtml =
      '<div class="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">' +
      '<div class="flex flex-wrap gap-2">' +
      proj.subprojects
        .map(function (sp) {
          var isActive = sub && sub.id === sp.id;
          return (
            '<button data-chak-subproject="' +
            escapeHtml(sp.id) +
            '" class="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition ' +
            (isActive
              ? "bg-sky-600 text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200") +
            '">' +
            "<span>" +
            escapeHtml(sp.icon || "📁") +
            "</span>" +
            escapeHtml(sp.name) +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      (sub
        ? '<p class="mt-3 text-xs text-slate-500 leading-relaxed">' +
          escapeHtml(sub.desc || "") +
          "</p>"
        : "") +
      "</div>";
  }

  elements.chartRoot.innerHTML =
    '<div class="space-y-6">' +
    // Header
    '<div class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">' +
    '<div class="flex items-center justify-between mb-4">' +
    '<div class="flex items-center gap-3">' +
    '<div class="text-3xl">' +
    (sub ? escapeHtml(sub.icon || proj.icon) : proj.icon) +
    "</div>" +
    "<div>" +
    '<h2 class="text-lg font-bold text-slate-800">' +
    escapeHtml(sub ? sub.name : proj.name) +
    "</h2>" +
    '<p class="text-xs text-slate-500">' +
    escapeHtml(sub ? proj.name + " — " + (sub.desc || "") : proj.desc || "") +
    "</p>" +
    "</div>" +
    "</div>" +
    "</div>" +
    // Subproject tabs
    subTabsHtml +
    // Info badges
    '<div class="flex flex-wrap gap-3 text-xs text-slate-500">' +
    '<span class="bg-slate-100 px-3 py-1.5 rounded-full">📦 ' +
    datasets.length +
    " datasets</span>" +
    '<span class="bg-slate-100 px-3 py-1.5 rounded-full">📊 ' +
    dashboards.length +
    " dashboards</span>" +
    "</div>" +
    "</div>" +
    // Datasets grid
    (datasetCards
      ? '<div class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">' +
        '<h3 class="text-sm font-bold text-slate-700 mb-3">📦 Datasets</h3>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">' +
        datasetCards +
        "</div>" +
        "</div>"
      : "") +
    // Dashboards list
    (dashboardItems
      ? '<div class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">' +
        '<h3 class="text-sm font-bold text-slate-700 mb-3">📊 Dashboards</h3>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        dashboardItems +
        "</div>" +
        "</div>"
      : "") +
    "</div>";

  // Attach subproject tab click handlers
  elements.chartRoot
    .querySelectorAll("[data-chak-subproject]")
    .forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.activeChakSubproject =
          btn.getAttribute("data-chak-subproject") || "";
        state.activeDatasetId = "";
        state.activeDashboardId = "";
        renderChakProjectOverview();
      });
    });

  // Attach dataset click handlers
  elements.chartRoot
    .querySelectorAll("[data-chak-dataset]")
    .forEach(function (btn) {
      btn.addEventListener("click", function () {
        var dsId = btn.getAttribute("data-chak-dataset") || "";
        state.activeDatasetId = dsId;
        state.activeDashboardId = "";
        state.activePage = "chak_dataset";
        // Set hash directly without slugify to preserve case-sensitive ID
        var prefix = getProjectHashPrefix();
        var next = "#/" + prefix + "chak_dataset/" + encodeURIComponent(dsId);
        if (window.location.hash !== next) {
          window.location.hash = next;
        }
        renderCurrentView();
      });
    });

  // Attach dashboard click handlers
  elements.chartRoot
    .querySelectorAll("[data-chak-dashboard]")
    .forEach(function (btn) {
      btn.addEventListener("click", function () {
        var dbId = btn.getAttribute("data-chak-dashboard") || "";
        state.activeDashboardId = dbId;
        state.activeDatasetId = "";
        state.activePage = "chak_dashboard";
        var prefix = getProjectHashPrefix();
        var next = "#/" + prefix + "chak_dashboard/" + encodeURIComponent(dbId);
        if (window.location.hash !== next) {
          window.location.hash = next;
        }
        renderCurrentView();
      });
    });
}

async function renderChakDatasetDetail() {
  var dsId = state.activeDatasetId;
  if (!dsId) {
    renderChakProjectOverview();
    return;
  }

  var proj = getActiveChakProject();

  // Find dataset name from config (including subprojects)
  var dsName = dsId;
  if (proj) {
    var found = findChakDatasetInProject(proj, dsId);
    if (found) dsName = found.name;
  }

  // Show loading
  elements.chartRoot.innerHTML =
    '<div class="space-y-6">' +
    '<div class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">' +
    '<div class="flex items-center gap-3">' +
    '<div class="w-5 h-5 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>' +
    '<span class="text-sm text-slate-500">Loading dataset: ' +
    escapeHtml(dsName) +
    "…</span>" +
    "</div>" +
    "</div>" +
    "</div>";

  try {
    var resp = await fetch(
      "/api/chak-explore/dataset/" + encodeURIComponent(dsId),
    );
    var result = await resp.json();

    if (!result.ok) throw new Error(result.error || "Failed to load");

    var ds = result.dataset || {};
    var dataElements = ds.dataElements || [];

    // Build table rows
    var tableRows = dataElements
      .map(function (de, idx) {
        return (
          "<tr>" +
          '<td class="px-3 py-2 text-[12px] text-slate-400">' +
          (idx + 1) +
          "</td>" +
          '<td class="px-3 py-2 text-[13px] font-medium text-slate-700 max-w-[260px] truncate" title="' +
          escapeHtml(de.name || "") +
          '">' +
          escapeHtml(de.name || "") +
          "</td>" +
          '<td class="px-3 py-2 text-[12px] text-slate-500">' +
          escapeHtml(de.id || "") +
          "</td>" +
          '<td class="px-3 py-2 text-[12px]"><span class="bg-slate-100 px-2 py-0.5 rounded text-slate-600">' +
          escapeHtml(de.valueType || de.value_type || "") +
          "</span></td>" +
          (de.categoryCombo
            ? '<td class="px-3 py-2 text-[12px] text-slate-500">' +
              escapeHtml(de.categoryCombo.name || de.categoryCombo || "") +
              "</td>"
            : '<td class="px-3 py-2 text-[12px] text-slate-400">—</td>') +
          "</tr>"
        );
      })
      .join("");

    var totalElements = ds.totalElements || dataElements.length;

    elements.chartRoot.innerHTML =
      '<div class="space-y-6">' +
      // Header with back button
      '<div class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">' +
      '<div class="flex items-center justify-between mb-3">' +
      "<div>" +
      '<h2 class="text-lg font-bold text-slate-800">' +
      escapeHtml(dsName) +
      "</h2>" +
      '<p class="text-xs text-slate-400">Dataset ID: ' +
      escapeHtml(dsId) +
      "</p>" +
      "</div>" +
      '<button onclick="renderChakProjectOverview()" class="text-xs text-slate-400 hover:text-slate-600 underline">← Back</button>' +
      "</div>" +
      // Metadata badges
      '<div class="flex flex-wrap gap-2 text-xs text-slate-500">' +
      '<span class="bg-slate-100 px-3 py-1.5 rounded-full">📦 ' +
      totalElements +
      " data elements</span>" +
      (ds.periodType
        ? '<span class="bg-slate-100 px-3 py-1.5 rounded-full">📅 ' +
          escapeHtml(ds.periodType) +
          "</span>"
        : "") +
      "</div>" +
      "</div>" +
      // Data elements table
      '<div class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm overflow-x-auto">' +
      '<h3 class="text-sm font-bold text-slate-700 mb-3">📋 Data Elements</h3>' +
      '<table class="w-full text-left border-collapse">' +
      "<thead>" +
      '<tr class="border-b border-slate-200">' +
      '<th class="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase">#</th>' +
      '<th class="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase">Name</th>' +
      '<th class="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase">ID</th>' +
      '<th class="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase">Value Type</th>' +
      '<th class="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase">Category</th>' +
      "</tr>" +
      "</thead>" +
      "<tbody>" +
      tableRows +
      "</tbody>" +
      "</table>" +
      "</div>" +
      "</div>";
  } catch (err) {
    elements.chartRoot.innerHTML =
      '<div class="space-y-6">' +
      '<div class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">' +
      '<div class="flex items-center justify-between mb-3">' +
      "<div>" +
      '<h2 class="text-lg font-bold text-slate-800">' +
      escapeHtml(dsName) +
      "</h2>" +
      '<p class="text-xs text-slate-400">Dataset ID: ' +
      escapeHtml(dsId) +
      "</p>" +
      "</div>" +
      '<button onclick="renderChakProjectOverview()" class="text-xs text-slate-400 hover:text-slate-600 underline">← Back</button>' +
      "</div>" +
      '<div class="p-8 text-center">' +
      '<div class="text-4xl mb-2">⚠️</div>' +
      '<p class="text-sm font-medium text-slate-700">Failed to load dataset</p>' +
      '<p class="text-xs text-slate-400 mt-1">' +
      escapeHtml(err.message) +
      "</p>" +
      '<button onclick="renderChakDatasetDetail()" class="mt-3 px-4 py-2 bg-sky-600 text-white text-xs rounded-lg hover:bg-sky-700">Retry</button>' +
      "</div>" +
      "</div>" +
      "</div>";
  }
}

// ═════════════════════════════════════════════════════════════════════
// CHAK Dashboard Detail — shows visualizations for a dashboard
// ═════════════════════════════════════════════════════════════════════

function renderChakDashboardDetail() {
  var dbId = state.activeDashboardId;
  if (!dbId) {
    renderChakProjectOverview();
    return;
  }

  var proj = getActiveChakProject();
  var dbName = dbId;
  var visualizations = [];

  // Find dashboard config (including subprojects)
  if (proj) {
    var found = findChakDashboardInProject(proj, dbId);
    if (found) {
      dbName = typeof found === "string" ? found : found.name;
      visualizations =
        typeof found === "string" ? [] : found.visualizations || [];
    }
  }

  // Build visualization cards
  var vizCards = visualizations
    .map(function (viz, idx) {
      return (
        '<div class="rounded-xl border border-slate-200 bg-white p-4 hover:border-sky-300 hover:bg-sky-50 transition">' +
        '<div class="flex items-center justify-between">' +
        '<div class="flex items-center gap-3">' +
        '<div class="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600 text-xs font-bold">' +
        (idx + 1) +
        "</div>" +
        "<div>" +
        '<div class="text-[14px] font-semibold text-slate-800">' +
        escapeHtml(viz.name || "Unknown") +
        "</div>" +
        '<div class="text-[11px] text-slate-400 font-mono">' +
        escapeHtml(viz.id || "") +
        "</div>" +
        "</div>" +
        "</div>" +
        '<a href="http://ereporting.chak.or.ke:8500/dhis-web-data-visualizer/?type=CHART&id=' +
        encodeURIComponent(viz.id) +
        '" target="_blank" class="text-xs text-sky-600 hover:text-sky-800 underline whitespace-nowrap">Open →</a>' +
        "</div>" +
        "</div>"
      );
    })
    .join("");

  elements.chartRoot.innerHTML =
    '<div class="space-y-6">' +
    // Header with back button
    '<div class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">' +
    '<div class="flex items-center justify-between mb-3">' +
    "<div>" +
    '<h2 class="text-lg font-bold text-slate-800">' +
    escapeHtml(dbName) +
    "</h2>" +
    '<p class="text-xs text-slate-400">Dashboard ID: ' +
    escapeHtml(dbId) +
    " | " +
    visualizations.length +
    " visualizations</p>" +
    "</div>" +
    '<button onclick="renderChakProjectOverview()" class="text-xs text-slate-400 hover:text-slate-600 underline">← Back</button>' +
    "</div>" +
    // Metadata badges
    '<div class="flex flex-wrap gap-2 text-xs text-slate-500">' +
    '<span class="bg-sky-100 px-3 py-1.5 rounded-full">📊 ' +
    visualizations.length +
    " visualizations</span>" +
    (proj
      ? '<span class="bg-sky-100 px-3 py-1.5 rounded-full">🏷️ ' +
        escapeHtml(proj.name) +
        "</span>"
      : "") +
    "</div>" +
    // Link to full dashboard
    '<div class="mt-2">' +
    '<a href="http://ereporting.chak.or.ke:8500/dhis-web-dashboard/#/' +
    escapeHtml(dbId) +
    '" target="_blank" class="text-xs text-sky-600 hover:text-sky-800 underline">🔗 Open full dashboard in CHAK DHIS2 →</a>' +
    "</div>" +
    "</div>" +
    // Visualizations grid
    (vizCards
      ? '<div class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">' +
        '<h3 class="text-sm font-bold text-slate-700 mb-3">📈 Visualizations</h3>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        vizCards +
        "</div>" +
        "</div>"
      : '<div class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm text-center py-10">' +
        '<div class="text-4xl mb-2">📭</div>' +
        '<p class="text-sm text-slate-500">No visualizations found for this dashboard.</p>' +
        '<p class="text-xs text-slate-400 mt-1">Visualization data may need to be refreshed from CHAK DHIS2.</p>' +
        "</div>") +
    "</div>";
}
