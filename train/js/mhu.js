// ============================================================
// mhu.js  (extracted from main.js lines 1177-4044)
// domain section 1177-4044
// ============================================================
function renderHealthProgrammes() {
  const activeSlug = state.activeSubtabs["health_programmes"] || "mhu";

  if (activeSlug === "mhu") {
    renderMhuPage();
  } else if (activeSlug === "projects") {
    renderProjectSelection();
  }
}

// ── MHU Cached config ────────────────────────────────────────────────
let _mhuConfig = null;
let _mhuConfigPromise = null;

async function loadMhuConfig() {
  if (_mhuConfig) return _mhuConfig;
  if (_mhuConfigPromise) return _mhuConfigPromise;
  _mhuConfigPromise = fetch("/api/mhu/config")
    .then((r) => r.json())
    .then((cfg) => {
      _mhuConfig = cfg;
      return cfg;
    })
    .catch(() => null);
  return _mhuConfigPromise;
}

// ── Load CSV data from PBIX export for filters ──
let _mhuCsvData = null;
let _mhuCsvDataPromise = null;

async function loadMhuCsvData() {
  if (_mhuCsvData) return _mhuCsvData;
  if (_mhuCsvDataPromise) return _mhuCsvDataPromise;
  _mhuCsvDataPromise = fetch("/api/mhu/csv-data")
    .then((r) => r.json())
    .then((data) => {
      _mhuCsvData = data;
      return data;
    })
    .catch(() => null);
  return _mhuCsvDataPromise;
}

// ── Render MHU page (4-level cascade: County → Owner type → Owner → Name) ──
async function renderMhuPage() {
  // Hide the general top filter bar (county, subcounty, facility, period)
  const topFilters = document.getElementById("topFilters");
  if (topFilters) topFilters.classList.add("hidden");

  const csvData = await loadMhuCsvData();
  const config = await loadMhuConfig();

  if (!csvData || !csvData.facilities) {
    elements.chartRoot.innerHTML = `<div class="p-10 text-center text-slate-400">Failed to load MHU data.</div>`;
    return;
  }

  // Get selected filters from state (keys: county, ownerType, owner, facilityName)
  let selectedCounty = state.mhuCounty || "all";
  let selectedOwnerType = state.mhuOwnerType || "all";
  let selectedOwner = state.mhuOwner || "all";
  let selectedFacility = state.mhuFacility || ""; // facility name

  const allFacilities = csvData.facilities;
  const counties = csvData.counties;
  const countyNames = Object.keys(counties).sort();

  // ── Cascade filtering ──
  // 1. Filter by county
  let filteredByCounty = allFacilities;
  if (selectedCounty !== "all") {
    filteredByCounty = allFacilities.filter((f) => f.county === selectedCounty);
  }

  // 2. Available owner types from county-filtered results (respecting CSV hierarchy)
  let availableOwnerTypes = [];
  if (selectedCounty !== "all") {
    // Use pre-computed county -> owner_types from the CSV data
    const countyInfo = counties[selectedCounty];
    if (countyInfo) {
      availableOwnerTypes = countyInfo.owner_types || [];
    }
  } else {
    // All counties: collect all unique owner types
    const seen = new Set();
    for (const f of filteredByCounty) {
      if (!seen.has(f.owner_type)) {
        seen.add(f.owner_type);
        availableOwnerTypes.push({ type: f.owner_type, owners: [] });
      }
    }
    // Get owners for each type
    for (const ot of availableOwnerTypes) {
      const ownerSet = new Set();
      for (const f of allFacilities) {
        if (f.owner_type === ot.type) ownerSet.add(f.owner);
      }
      ot.owners = [...ownerSet].sort();
    }
  }

  // 3. Filter by owner type
  let filteredByOwnerType = filteredByCounty;
  if (selectedOwnerType !== "all") {
    filteredByOwnerType = filteredByCounty.filter(
      (f) => f.owner_type === selectedOwnerType,
    );
  }

  // 4. Available owners — always compute from the already-filtered data for accuracy
  const availableOwners = (() => {
    const seen = new Set();
    const result = [];
    for (const f of filteredByOwnerType) {
      if (!seen.has(f.owner)) {
        seen.add(f.owner);
        result.push(f.owner);
      }
    }
    return result.sort();
  })();

  // 5. Filter by owner
  let filteredByOwner = filteredByOwnerType;
  if (selectedOwner !== "all") {
    filteredByOwner = filteredByOwnerType.filter(
      (f) => f.owner === selectedOwner,
    );
  }

  // 6. Sort remaining facilities by name
  filteredByOwner.sort((a, b) => a.name.localeCompare(b.name));

  // Reset selections if they no longer match
  const ownerTypesForDisplay = availableOwnerTypes.map((o) => o.type);
  if (
    selectedOwnerType !== "all" &&
    !ownerTypesForDisplay.includes(selectedOwnerType)
  ) {
    selectedOwnerType = "all";
    state.mhuOwnerType = "all";
  }
  if (selectedOwner !== "all" && !availableOwners.includes(selectedOwner)) {
    selectedOwner = "all";
    state.mhuOwner = "all";
  }
  if (
    selectedFacility &&
    !filteredByOwner.find((f) => f.name === selectedFacility)
  ) {
    selectedFacility = "";
    state.mhuFacility = "";
  }

  // ── Build HTML ──
  const tabKeys = config?.tabs ? Object.keys(config.tabs) : [];
  const activeSubtab = state.mhuMhuSubtab || "WORKLOAD";

  elements.chartRoot.innerHTML = `
    <div class="space-y-5">
      <!-- Filters Row (4 cascading filters) -->
      <div class="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div class="flex flex-wrap gap-3 items-end">
          <div class="min-w-[160px] flex-1">
            <label class="mb-1 block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">County</label>
            <select id="mhuCountyFilter" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200">
              <option value="all">All Counties (${countyNames.length})</option>
              ${countyNames
                .map((c) => {
                  const cnt = counties[c]?.facility_count || 0;
                  return `<option value="${escapeHtml(c)}" ${selectedCounty === c ? "selected" : ""}>${escapeHtml(c)} (${cnt})</option>`;
                })
                .join("")}
            </select>
          </div>
          <div class="min-w-[200px] flex-1">
            <label class="mb-1 block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Owner Type</label>
            <select id="mhuOwnerTypeFilter" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200">
              <option value="all">All Types (${ownerTypesForDisplay.length})</option>
              ${ownerTypesForDisplay
                .map((ot) => {
                  const cnt = filteredByCounty.filter(
                    (f) => f.owner_type === ot,
                  ).length;
                  return `<option value="${escapeHtml(ot)}" ${selectedOwnerType === ot ? "selected" : ""}>${escapeHtml(ot)} (${cnt})</option>`;
                })
                .join("")}
            </select>
          </div>
          <div class="min-w-[220px] flex-1">
            <label class="mb-1 block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Owner</label>
            <select id="mhuOwnerFilter" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200">
              <option value="all">All Owners (${availableOwners.length})</option>
              ${availableOwners
                .map((o) => {
                  const cnt = filteredByOwnerType.filter(
                    (f) => f.owner === o,
                  ).length;
                  return `<option value="${escapeHtml(o)}" ${selectedOwner === o ? "selected" : ""}>${escapeHtml(o)} (${cnt})</option>`;
                })
                .join("")}
            </select>
          </div>
          <div class="min-w-[250px] flex-1">
            <label class="mb-1 block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Member Health Unit</label>
            <select id="mhuFacilityFilter" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200">
              <option value="">— Select a member health unit —</option>
              ${filteredByOwner
                .map(
                  (f) =>
                    `<option value="${escapeHtml(f.name)}" ${selectedFacility === f.name ? "selected" : ""}>${escapeHtml(f.name)}</option>`,
                )
                .join("")}
            </select>
          </div>
        </div>
      </div>

      <!-- Detail Area: KHIS MOH 717 subtabs (always visible) -->
      <div id="mhuRoot" class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm min-h-[200px]">
        ${
          !selectedFacility && filteredByOwner.length > 0 && tabKeys.length > 0
            ? renderMhuAggregateNavHtml(
                selectedCounty !== "all" && selectedOwnerType === "all"
                  ? selectedCounty + " — All Types"
                  : selectedCounty !== "all" &&
                      selectedOwnerType !== "all" &&
                      selectedOwner === "all"
                    ? selectedCounty + " — " + selectedOwnerType
                    : "All Counties (" +
                      filteredByOwner.length +
                      " facilities)",
                filteredByOwner.length,
                activeSubtab,
                tabKeys,
              )
            : renderMhuSubtabNavAlways(
                selectedFacility,
                null,
                activeSubtab,
                tabKeys,
              )
        }
      </div>
    </div>
  `;

  // ── Bind county filter ──
  const countyEl = document.getElementById("mhuCountyFilter");
  if (countyEl) {
    countyEl.addEventListener("change", () => {
      state.mhuCounty = countyEl.value;
      state.mhuOwnerType = "all";
      state.mhuOwner = "all";
      state.mhuFacility = "";
      state.mhuMhuSubtab = "WORKLOAD";
      renderMhuPage();
    });
  }

  // ── Bind owner type filter ──
  const ownerTypeEl = document.getElementById("mhuOwnerTypeFilter");
  if (ownerTypeEl) {
    ownerTypeEl.addEventListener("change", () => {
      state.mhuOwnerType = ownerTypeEl.value;
      state.mhuOwner = "all";
      state.mhuFacility = "";
      state.mhuMhuSubtab = "WORKLOAD";
      renderMhuPage();
    });
  }

  // ── Bind owner filter ──
  const ownerEl = document.getElementById("mhuOwnerFilter");
  if (ownerEl) {
    ownerEl.addEventListener("change", () => {
      state.mhuOwner = ownerEl.value;
      state.mhuFacility = "";
      state.mhuMhuSubtab = "WORKLOAD";
      renderMhuPage();
    });
  }

  // ── Bind facility filter ──
  const facilityEl = document.getElementById("mhuFacilityFilter");
  if (facilityEl) {
    facilityEl.addEventListener("change", () => {
      state.mhuFacility = facilityEl.value;
      state.mhuMhuSubtab = "WORKLOAD";
      renderMhuPage();
    });
  }

  // ── If a facility is selected, try loading KHIS MOH 717 subtab data ──
  if (selectedFacility && config?.tabs) {
    // Find matching facility in KHIS mapping by name (flexible match)
    let khisFacilityId = null;
    if (config.facilities) {
      const sel = selectedFacility.toLowerCase().trim();
      for (const [uid, f] of Object.entries(config.facilities)) {
        const fn = f.name.toLowerCase().trim();
        if (sel === fn || sel.includes(fn) || fn.includes(sel)) {
          khisFacilityId = uid;
          break;
        }
      }
    }

    // Always look up CHAK OU ID from CSV data (for HIV tab routing)
    let chakFacilityId = null;
    if (allFacilities) {
      const facObj = allFacilities.find((f) => f.name === selectedFacility);
      if (facObj && facObj.chak_ou_id) {
        chakFacilityId = facObj.chak_ou_id;
      }
    }

    // Use CHAK facility ID as effective ID if no KHIS mapping
    const effectiveFacilityId =
      khisFacilityId || (chakFacilityId ? `chak::${chakFacilityId}` : null);

    // Re-render subtab nav with facility name and load data
    renderKhisSubtabNav(
      selectedFacility,
      effectiveFacilityId,
      activeSubtab,
      tabKeys,
      chakFacilityId,
    );

    if (effectiveFacilityId) {
      loadAndRenderMhuTab(
        config,
        effectiveFacilityId,
        activeSubtab,
        selectedFacility,
        chakFacilityId,
      );
    } else {
      const contentEl = document.getElementById("mhuTabContent");
      if (contentEl) {
        contentEl.innerHTML = `
          <div class="flex flex-col items-center justify-center py-14 text-sm text-slate-400">
            <div class="font-semibold text-slate-500">No KHIS data</div>
            <div class="mt-1 text-xs text-center max-w-md">This facility is not mapped in the KHIS dataset.</div>
          </div>`;
      }
    }
  } else if (!selectedFacility && filteredByOwner.length > 0 && config?.tabs) {
    // ── Aggregate mode — show aggregated data across all filtered facilities ──
    const facilityNames = filteredByOwner.map(function (f) {
      return f.name;
    });
    state.mhuAggregateNames = facilityNames;

    // Build aggregate label based on filter level
    let aggregateLabel = "All Facilities";
    if (selectedCounty !== "all" && selectedOwnerType === "all") {
      aggregateLabel = selectedCounty + " — All Types";
    } else if (
      selectedCounty !== "all" &&
      selectedOwnerType !== "all" &&
      selectedOwner === "all"
    ) {
      aggregateLabel = selectedCounty + " — " + selectedOwnerType;
    } else if (selectedCounty === "all") {
      aggregateLabel =
        "All Counties (" + filteredByOwner.length + " facilities)";
    }

    // Re-render subtab nav with aggregate info
    renderMhuAggregateNav(
      aggregateLabel,
      filteredByOwner.length,
      activeSubtab,
      tabKeys,
    );

    // Load aggregated data for the active subtab (skip HIV — per-facility only)
    if (activeSubtab !== "HIV_DASHBOARD") {
      loadAndRenderMhuAggregatedTab(
        config,
        facilityNames,
        activeSubtab,
        filteredByOwner.length,
        aggregateLabel,
      );
    } else {
      const contentEl = document.getElementById("mhuTabContent");
      if (contentEl) {
        contentEl.innerHTML = `
          <div class="flex flex-col items-center justify-center py-14 text-sm text-slate-400">
            <div class="font-semibold text-slate-500">Aggregate not available</div>
            <div class="mt-1 text-xs text-center max-w-md">HIV Dashboard is only available for individual facilities. Select a specific facility to view HIV data.</div>
          </div>`;
      }
    }
  }
}

function renderMhuDetail(facilityId) {
  if (!facilityId) {
    return `
      <div class="flex flex-col items-center justify-center py-10 text-sm text-slate-400">
        <svg class="mb-3 h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
        <div class="font-semibold text-slate-500">Select a Member Health Unit</div>
        <div class="mt-1 text-xs">Choose a county and ownership, then pick a unit to view KHIS/CHAK data</div>
      </div>
    `;
  }
  return `
    <div class="flex flex-col items-center justify-center py-8 text-sm text-slate-400">
      <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500"></div>
      <div class="mt-3 font-semibold text-slate-500">Loading data…</div>
    </div>
  `;
}

// ── Aggregate mode nav HTML (no click handlers, for initial render) ──
function renderMhuAggregateNavHtml(
  label,
  facilityCount,
  activeSubtab,
  tabKeys,
) {
  if (!tabKeys || tabKeys.length === 0) {
    return '<div class="flex flex-col items-center justify-center py-10 text-sm text-slate-400"><div class="font-semibold text-slate-500">No tabs configured</div></div>';
  }

  const tabLabels = {
    WORKLOAD: "Workload",
    HYPERTENSION_DIABETES: "Hypertension & Diabetes",
    MNCH: "MNCH",
    HIV_DASHBOARD: "HIV Dashboard",
    OTHER: "Other",
  };

  return `
    <div class="mb-4">
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <div class="text-sm font-bold text-slate-700">${escapeHtml(label)}</div>
        <span class="text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">${facilityCount} facilities · Aggregated</span>
      </div>
      <div class="flex flex-wrap gap-1 border-b border-slate-200 pb-1">
        ${tabKeys
          .map(
            (slug) => `
          <button class="mhu-tab-btn px-4 py-1.5 text-[12px] font-semibold rounded-t-lg transition cursor-pointer
            ${
              activeSubtab === slug
                ? "bg-sky-50 text-sky-700 border-b-2 border-sky-500"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }"
            data-tab-slug="${slug}">${tabLabels[slug] || slug.replace(/_/g, " ")}</button>
        `,
          )
          .join("")}
      </div>
    </div>
    <div id="mhuTabContent" class="min-h-[200px]">
      <div class="flex items-center justify-center py-12">
        <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500"></div>
        <div class="ml-3 text-sm text-slate-500">Loading aggregated data across ${facilityCount} facilities…</div>
      </div>
    </div>`;
}

// ── Always-rendered subtab nav bar (even without a selected facility) ──
function renderMhuSubtabNavAlways(
  facilityName,
  khisFacilityId,
  activeSubtab,
  tabKeys,
) {
  if (!tabKeys || tabKeys.length === 0) {
    return `<div class="flex flex-col items-center justify-center py-10 text-sm text-slate-400">
      <div class="font-semibold text-slate-500">No tabs configured</div>
    </div>`;
  }

  const tabLabels = {
    WORKLOAD: "Workload",
    HYPERTENSION_DIABETES: "Hypertension & Diabetes",
    MNCH: "MNCH",
    HIV_DASHBOARD: "HIV Dashboard",
    OTHER: "Other",
  };

  if (facilityName) {
    // Facility selected — show name + badge + tabs
    return `
      <div class="mb-4">
        <div class="flex flex-wrap items-center gap-2 mb-3">
          <div class="text-sm font-bold text-slate-700">${escapeHtml(facilityName)}</div>
          <span class="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">${khisFacilityId ? (khisFacilityId.startsWith("chak::") ? "CHAK DHIS" : "KHIS MOH 717") : "PBIX — no CHAK data"}</span>
        </div>
        <div class="flex flex-wrap gap-1 border-b border-slate-200 pb-1">
          ${tabKeys
            .map(
              (slug) => `
            <button class="mhu-tab-btn px-4 py-1.5 text-[12px] font-semibold rounded-t-lg transition cursor-pointer
              ${
                activeSubtab === slug
                  ? "bg-sky-50 text-sky-700 border-b-2 border-sky-500"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }"
              data-tab-slug="${slug}">${tabLabels[slug] || slug.replace(/_/g, " ")}</button>
          `,
            )
            .join("")}
        </div>
      </div>
      <div id="mhuTabContent" class="min-h-[200px]">
        <div class="flex flex-col items-center justify-center py-10 text-sm text-slate-400">
          <svg class="mb-3 h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
          <div class="font-semibold text-slate-500">${escapeHtml(facilityName)}</div>
          <div class="mt-1 text-xs text-center max-w-md">Loading data…</div>
        </div>
      </div>`;
  }

  // No facility selected — show tabs with placeholder
  return `
    <div class="mb-4">
      <div class="flex flex-wrap gap-1 border-b border-slate-200 pb-1">
        ${tabKeys
          .map(
            (slug) => `
          <button class="mhu-tab-btn px-4 py-1.5 text-[12px] font-semibold rounded-t-lg transition cursor-pointer
            ${
              activeSubtab === slug
                ? "bg-sky-50 text-sky-700 border-b-2 border-sky-500"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }"
            data-tab-slug="${slug}">${tabLabels[slug] || slug.replace(/_/g, " ")}</button>
        `,
          )
          .join("")}
      </div>
    </div>
    <div id="mhuTabContent" class="min-h-[200px]">
      <div class="flex flex-col items-center justify-center py-10 text-sm text-slate-400">
        <svg class="mb-3 h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
        <div class="font-semibold text-slate-500">Select a Member Health Unit</div>
        <div class="mt-1 text-xs">Choose a county and ownership, then pick a unit to view KHIS/CHAK data</div>
      </div>
    </div>`;
}

// ── Render KHIS subtab navigation ────────────────────────────────────
function renderKhisSubtabNav(
  facilityName,
  khisFacilityId,
  activeSubtab,
  tabKeys,
  chakFacilityId,
) {
  const root = document.getElementById("mhuRoot");
  if (!root) return;

  // Tab labels for display
  const tabLabels = {
    WORKLOAD: "Workload",
    HYPERTENSION_DIABETES: "Hypertension & Diabetes",
    MNCH: "MNCH",
    HIV_DASHBOARD: "HIV Dashboard",
    OTHER: "Other",
  };

  root.innerHTML = `
    <div class="mb-4">
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <div class="text-sm font-bold text-slate-700">${escapeHtml(facilityName)}</div>
        <span class="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">${khisFacilityId ? (khisFacilityId.startsWith("chak::") ? "CHAK DHIS" : "KHIS MOH 717") : "PBIX — no KHIS data"}</span>
      </div>
      <div class="flex flex-wrap gap-1 border-b border-slate-200 pb-1">
        ${tabKeys
          .map(
            (slug) => `
          <button class="mhu-tab-btn px-4 py-1.5 text-[12px] font-semibold rounded-t-lg transition cursor-pointer
            ${
              activeSubtab === slug
                ? "bg-sky-50 text-sky-700 border-b-2 border-sky-500"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }"
            data-tab-slug="${slug}">${tabLabels[slug] || slug.replace(/_/g, " ")}</button>
        `,
          )
          .join("")}
      </div>
    </div>
    <div id="mhuTabContent" class="min-h-[200px]">
      <div class="flex items-center justify-center py-12">
        <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500"></div>
        <div class="ml-3 text-sm text-slate-500">Loading data…</div>
      </div>
    </div>
  `;

  // Bind subtab click handlers
  document.querySelectorAll(".mhu-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slug = btn.getAttribute("data-tab-slug");
      state.mhuMhuSubtab = slug;
      renderKhisSubtabNav(facilityName, khisFacilityId, slug, tabKeys);
      if (khisFacilityId) {
        // Re-fetch config and load tab
        loadMhuConfig().then((cfg) => {
          if (cfg)
            loadAndRenderMhuTab(
              cfg,
              khisFacilityId,
              slug,
              facilityName,
              chakFacilityId,
            );
        });
      } else {
        // No KHIS mapping — show empty state
        const contentEl = document.getElementById("mhuTabContent");
        if (contentEl) {
          contentEl.innerHTML = `
            <div class="flex flex-col items-center justify-center py-14 text-sm text-slate-400">
              <div class="font-semibold text-slate-500">No KHIS data</div>
              <div class="mt-1 text-xs text-center max-w-md">This facility is not mapped in the KHIS dataset.</div>
            </div>`;
        }
      }
    });
  });
}

// ── Determine data source per tab ─────────────────────────────────────
const MHU_API = "/api/mhu/khis-data";
const MHU_BADGE = "KHIS MOH 717";

// MHU data period — LAST_MONTH = last complete month (fast; avoids the slow
// 12-month pull when loading the MHU tab with all facilities)
const MHU_PE = "LAST_MONTH";

// ── MOH 711 Data Elements for Workload tab sections ──────────────────
const WORKLOAD_MOH711_UIDS = [
  "f9vesk5d4IY", // MOH 711 New ANC clients
  "Fz0LzxMT1vV", // MOH 711 Pregnant women completing 4 ANC visits
  "cKr5133RFuN", // MOH 711 Rev 2020_No. of clients completed 8th ANC Contact
  "jaPrPmor6WV", // MOH 711 Normal Deliveries
  "sMqM8DwiAaj", // MOH 711 Breach Delivery
  "Kx64gGqaFVq", // MOH 711 Assisted vaginal delivery
  "KuMX8VqCejs", // MOH 711 Deliveries from HIV+ve Women
  "rAZBTMa7Jy3", // MOH 711 Caesarian Sections
  "zVTIzkATPDS", // MOH 711 Babies discharge Alive
  "syjjPqXbjTm", // MOH 711 Low Birth Weight <2500gms
  "GAr6xu6f1n7", // MOH 711 Neonatal deaths 0-28 Days
  "BYMSIbnUzXQ", // MOH 711 Rev 2020_Maternal deaths 15-19Years
  "AC1Iorxdijc", // MOH 711 Rev 2020_Maternal deaths 20-24 Years
  "dPRCstLVkZu", // MOH 711 Rev 2020_Maternal deaths 25+ Years
  "CoAXLBxR0Ik", // MOH 711 Adolescent (10-19yrs) Maternal deaths
  "kAp7ViUXEKh", // MOH 711 Maternal Deaths Audited Within 7 Days
  "tHRlLvvCObn", // MOH 711 Rev 2020_Neonatal deaths audited within 7 days
];

const WORKLOAD_MOH711_LABELS = {
  f9vesk5d4IY: "ANC New Visits",
  Fz0LzxMT1vV: "ANC 4th Visit (Completing 4 visits)",
  cKr5133RFuN: "ANC 8th Visit (Completed 8 contacts)",
  jaPrPmor6WV: "Normal Deliveries",
  sMqM8DwiAaj: "Breach Delivery",
  Kx64gGqaFVq: "Assisted Vaginal Delivery",
  KuMX8VqCejs: "Deliveries from HIV+ Women",
  rAZBTMa7Jy3: "Caesarian Sections",
  zVTIzkATPDS: "Babies discharged Alive",
  syjjPqXbjTm: "Low Birth Weight (<2500gms)",
  GAr6xu6f1n7: "Neonatal Deaths (0-28 Days)",
  BYMSIbnUzXQ: "Maternal Deaths (15-19 yrs)",
  AC1Iorxdijc: "Maternal Deaths (20-24 yrs)",
  dPRCstLVkZu: "Maternal Deaths (25+ yrs)",
  CoAXLBxR0Ik: "Adolescent Maternal Deaths (10-19 yrs)",
  kAp7ViUXEKh: "Maternal Deaths Audited (7 days)",
  tHRlLvvCObn: "Neonatal Deaths Audited (7 days)",
};

// ── Load & render MHU tab data ────────────────────────────────────────
async function loadAndRenderMhuTab(
  config,
  facilityId,
  tabSlug,
  selectedFacilityName,
  chakFacilityId,
) {
  const tabElements = config.tabs?.[tabSlug];
  const contentEl = document.getElementById("mhuTabContent");
  if (!contentEl) return; // nav not rendered yet

  if (!tabElements || tabElements.length === 0) {
    contentEl.innerHTML = `
      <div class="flex flex-col items-center justify-center py-14 text-sm text-slate-400">
        <div class="font-semibold text-slate-500">No data elements defined for this tab</div>
      </div>`;
    return;
  }

  // Detect CHAK facility mode (from CHAK MHUs.csv or passed chakFacilityId)
  const isChakFacility =
    typeof facilityId === "string" && facilityId.startsWith("chak::");
  const chakOuId = isChakFacility
    ? facilityId.replace("chak::", "")
    : chakFacilityId || null;
  const facilityName =
    selectedFacilityName || config.facilities?.[facilityId]?.name || facilityId;
  const ouId = isChakFacility ? chakOuId : facilityId;

  // For CHAK-only facilities (no KHIS mapping), non-HIV tabs show message
  if (isChakFacility && tabSlug !== "HIV_DASHBOARD") {
    contentEl.innerHTML = `
      <div class="flex flex-col items-center justify-center py-14 text-sm text-slate-400">
        <div class="font-semibold text-slate-500">CHAK DHIS only</div>
        <div class="mt-1 text-xs text-center max-w-md">CHAK DHIS only provides HIV (MOH 731) data. Non-HIV tabs require KHIS data which isn't available for this CHAK facility.</div>
      </div>`;
    return;
  }

  // For any facility with CHAK OU, route HIV tab to CHAK DHIS
  if (chakOuId && tabSlug === "HIV_DASHBOARD") {
    // Route CHAK HIV tab directly to CHAK DHIS (for both CHAK-only and KHIS-mapped CHAK facilities)
    await renderMhuHivDashboard(contentEl, facilityName, chakOuId);
    return;
  }

  // Show loading
  contentEl.innerHTML = `
    <div class="flex items-center justify-center py-12">
      <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500"></div>
      <div class="ml-3 text-sm text-slate-500">Loading KHIS data…</div>
    </div>
  `;

  // Build dx param
  const dxIds = tabElements.map((e) => e.id).join(";");

  try {
    // Fetch MOH 711 data for WORKLOAD (summary cards) and MNCH (full charts)
    let moh711Data = null;
    if (tabSlug === "WORKLOAD" || tabSlug === "MNCH") {
      const moh711Dx = WORKLOAD_MOH711_UIDS.join(";");
      const resp711 = await fetch(
        `${MHU_API}?dx=${encodeURIComponent(moh711Dx)}&ou=${encodeURIComponent(ouId)}&pe=${MHU_PE}`,
      );
      if (resp711.ok) {
        const result711 = await resp711.json();
        moh711Data = result711.data || {};
      }
    }

    const resp = await fetch(
      `${MHU_API}?dx=${encodeURIComponent(dxIds)}&ou=${encodeURIComponent(ouId)}&pe=${MHU_PE}`,
    );
    if (!resp.ok) {
      throw new Error(`API returned ${resp.status}`);
    }
    const result = await resp.json();
    const data = result.data || {};

    // If data is empty, show a message
    if (
      Object.keys(data).length === 0 &&
      (!moh711Data || Object.keys(moh711Data).length === 0)
    ) {
      contentEl.innerHTML = `
        <div class="flex flex-col items-center justify-center py-14 text-sm text-slate-400">
          <div class="font-semibold text-slate-500">No data available</div>
          <div class="mt-1 text-xs">KHIS returned no records for ${escapeHtml(facilityName)} in the last complete month</div>
        </div>`;
      return;
    }

    // ── Fetch COC-disaggregated data for Inpatient Admissions (Under 5 / Over 5) ──
    let cocData = null;
    if (tabSlug === "WORKLOAD") {
      // Hardcoded COC UIDs for all 14 inpatient departments (same for both Under 5 and Over 5)
      const ALL_COC_IDS = [
        "ObiJr399QRt",
        "bPNw3Km3Ug7",
        "O68sxX0pJMT",
        "oJ6IUNugflo",
        "KFmqREu0VSL",
        "JUI7tesx6as",
        "Lj5arkL7GL8",
        "R99ctw9w6Kt",
        "B0ji6ZY2zJ3",
        "szjWdpjHTDe",
        "vr2WcWaojbO",
        "tMEFFDHQCAW",
        "Qy5yADe3SiB",
        "rYfAgBnJKnj",
      ];
      const dxStr = "cvJuw6Fbuiw;r7LJ3kCX8EZ";
      const cocStr = ALL_COC_IDS.join(";");
      const MHU_COC_API = "/api/mhu/khis-data-coc";
      try {
        const respCoc = await fetch(
          `${MHU_COC_API}?dx=${encodeURIComponent(dxStr)}&co=${encodeURIComponent(cocStr)}&ou=${encodeURIComponent(ouId)}&pe=${MHU_PE}`,
        );
        if (respCoc.ok) {
          const resultCoc = await respCoc.json();
          cocData = resultCoc.data || {};
        }
      } catch (e) {
        console.warn("Failed to fetch COC-disaggregated data:", e);
      }
    }

    // Render based on tab
    const tabLabel = tabSlug.replace(/_/g, " ");

    if (tabSlug === "WORKLOAD") {
      renderMhuWorkload(
        contentEl,
        data,
        tabElements,
        facilityName,
        moh711Data,
        cocData,
      );
    } else if (tabSlug === "HYPERTENSION_DIABETES") {
      renderMhuDiabetesHypertension(contentEl, data, tabElements, facilityName);
    } else if (tabSlug === "MNCH") {
      renderMhuMnch(contentEl, facilityName, moh711Data);
    } else if (tabSlug === "HIV_DASHBOARD") {
      // HIV_DASHBOARD uses hardcoded KHIS UIDs for HIV metrics
      await renderMhuHivDashboard(contentEl, facilityName, ouId);
    } else {
      renderMhuGenericTable(
        contentEl,
        data,
        tabElements,
        facilityName,
        tabLabel,
      );
    }
  } catch (err) {
    contentEl.innerHTML = `
      <div class="flex flex-col items-center justify-center py-14 text-sm text-red-400">
        <div class="font-semibold text-red-500">Error loading data</div>
        <div class="mt-1 text-xs">${escapeHtml(err.message)}</div>
      </div>`;
  }
}

// ── Aggregate endpoint ────────────────────────────────────────────────
const MHU_AGGREGATE_API = "/api/mhu/khis-data-aggregate";

// ── Render MHU aggregate nav (no specific facility selected) ──────────
function renderMhuAggregateNav(label, facilityCount, activeSubtab, tabKeys) {
  const root = document.getElementById("mhuRoot");
  if (!root) return;

  const tabLabels = {
    WORKLOAD: "Workload",
    HYPERTENSION_DIABETES: "Hypertension & Diabetes",
    MNCH: "MNCH",
    HIV_DASHBOARD: "HIV Dashboard",
    OTHER: "Other",
  };

  root.innerHTML = `
    <div class="mb-4">
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <div class="text-sm font-bold text-slate-700">${escapeHtml(label)}</div>
        <span class="text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">${facilityCount} facilities · Aggregated</span>
      </div>
      <div class="flex flex-wrap gap-1 border-b border-slate-200 pb-1">
        ${tabKeys
          .map(
            (slug) => `
          <button class="mhu-tab-btn px-4 py-1.5 text-[12px] font-semibold rounded-t-lg transition cursor-pointer
            ${
              activeSubtab === slug
                ? "bg-sky-50 text-sky-700 border-b-2 border-sky-500"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            }"
            data-tab-slug="${slug}">${tabLabels[slug] || slug.replace(/_/g, " ")}</button>
        `,
          )
          .join("")}
      </div>
    </div>
    <div id="mhuTabContent" class="min-h-[200px]">
      <div class="flex items-center justify-center py-12">
        <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500"></div>
        <div class="ml-3 text-sm text-slate-500">Loading aggregated data across ${facilityCount} facilities…</div>
      </div>
    </div>
  `;

  // Bind subtab click handlers for aggregate mode
  document.querySelectorAll(".mhu-tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const slug = btn.getAttribute("data-tab-slug");
      state.mhuMhuSubtab = slug;
      const aggNames = state.mhuAggregateNames || [];

      // Re-render nav
      renderMhuAggregateNav(label, facilityCount, slug, tabKeys);

      if (slug === "HIV_DASHBOARD") {
        const contentEl = document.getElementById("mhuTabContent");
        if (contentEl) {
          contentEl.innerHTML = `
            <div class="flex flex-col items-center justify-center py-14 text-sm text-slate-400">
              <div class="font-semibold text-slate-500">Aggregate not available</div>
              <div class="mt-1 text-xs text-center max-w-md">HIV Dashboard is only available for individual facilities. Select a specific facility to view HIV data.</div>
            </div>`;
        }
        return;
      }

      loadMhuConfig().then(function (cfg) {
        if (cfg && aggNames.length > 0) {
          loadAndRenderMhuAggregatedTab(
            cfg,
            aggNames,
            slug,
            facilityCount,
            label,
          );
        }
      });
    });
  });
}

// ── Load & render MHU aggregated tab data ─────────────────────────────
async function loadAndRenderMhuAggregatedTab(
  config,
  facilityNames,
  tabSlug,
  facilityCount,
  aggregateLabel,
) {
  const tabElements = config.tabs?.[tabSlug];
  const contentEl = document.getElementById("mhuTabContent");
  if (!contentEl) return;

  if (!tabElements || tabElements.length === 0) {
    contentEl.innerHTML = `
      <div class="flex flex-col items-center justify-center py-14 text-sm text-slate-400">
        <div class="font-semibold text-slate-500">No data elements defined for this tab</div>
      </div>`;
    return;
  }

  // Show loading
  contentEl.innerHTML = `
    <div class="flex items-center justify-center py-12">
      <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500"></div>
      <div class="ml-3 text-sm text-slate-500">Loading aggregated data across ${facilityCount} facilities…</div>
    </div>
  `;

  const dxIds = tabElements
    .map(function (e) {
      return e.id;
    })
    .join(";");

  try {
    // Fetch MOH 711 data for WORKLOAD (summary cards) and MNCH (full charts)
    let moh711Data = null;
    if (tabSlug === "WORKLOAD" || tabSlug === "MNCH") {
      const moh711DxIds = WORKLOAD_MOH711_UIDS.join(";");
      const resp711 = await fetch(MHU_AGGREGATE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dx: moh711DxIds,
          names: facilityNames,
          pe: MHU_PE,
        }),
      });
      if (resp711.ok) {
        const result711 = await resp711.json();
        moh711Data = result711.data || {};
      }
    }

    const resp = await fetch(MHU_AGGREGATE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dx: dxIds,
        names: facilityNames,
        pe: MHU_PE,
      }),
    });
    if (!resp.ok) throw new Error("API returned " + resp.status);
    const result = await resp.json();
    const data = result.data || {};

    if (
      Object.keys(data).length === 0 &&
      (!moh711Data || Object.keys(moh711Data).length === 0)
    ) {
      contentEl.innerHTML = `
        <div class="flex flex-col items-center justify-center py-14 text-sm text-slate-400">
          <div class="font-semibold text-slate-500">No aggregated data available</div>
          <div class="mt-1 text-xs text-center max-w-md">KHIS returned no records for ${result.matched_count || 0} matched facilities.</div>
        </div>`;
      return;
    }

    // Render based on tab type using existing chart renderers
    if (tabSlug === "WORKLOAD") {
      // Also fetch COC-disaggregated data for aggregated view (may not be available)
      let cocDataAgg = null;
      // Only fetch COC data for single-facility aggregated view (not county-level)
      renderMhuWorkload(
        contentEl,
        data,
        tabElements,
        aggregateLabel + " (Aggregated)",
        moh711Data,
        null, // COC data not available for aggregated view
      );
    } else if (tabSlug === "HYPERTENSION_DIABETES") {
      renderMhuDiabetesHypertension(
        contentEl,
        data,
        tabElements,
        aggregateLabel + " (Aggregated)",
      );
    } else if (tabSlug === "MNCH") {
      renderMhuMnch(contentEl, aggregateLabel + " (Aggregated)", moh711Data);
    } else {
      renderMhuGenericTable(
        contentEl,
        data,
        tabElements,
        aggregateLabel + " (Aggregated)",
        tabSlug.replace(/_/g, " "),
      );
    }
  } catch (err) {
    contentEl.innerHTML = `
      <div class="flex flex-col items-center justify-center py-14 text-sm text-red-400">
        <div class="font-semibold text-red-500">Error loading aggregated data</div>
        <div class="mt-1 text-xs">${escapeHtml(err.message)}</div>
      </div>`;
  }
}

// ── Parse KHIS response data into per-element time series ────────────
function parseMhuTimeSeries(data, tabElements) {
  // data is { dx_id: { "period_label": value, ... }, ... }
  // Collect all periods (months) across all DEs
  const periodSet = new Set();
  for (const dxData of Object.values(data)) {
    for (const period of Object.keys(dxData)) {
      periodSet.add(period);
    }
  }
  const periods = Array.from(periodSet).sort();

  // For each element, extract monthly values by looking up its DX ID
  return tabElements.map((el) => {
    const dxData = data[el.id] || {};
    const values = periods.map((p) => dxData[p] || 0);
    const total = values.reduce((a, b) => a + b, 0);
    return { ...el, periods, values, total };
  });
}

// ── Render a line chart using Highcharts ──────────────────────────────
function renderHighchartLine(
  containerId,
  title,
  seriesData,
  categories,
  yLabel,
) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (typeof Highcharts === "undefined") {
    el.innerHTML =
      '<div class="text-sm text-red-400 py-4">Highcharts not loaded</div>';
    return;
  }
  try {
    Highcharts.chart(containerId, {
      chart: { type: "line", height: 280, style: { fontFamily: "inherit" } },
      title: { text: title, style: { fontSize: "13px", fontWeight: "600" } },
      xAxis: {
        categories,
        labels: { rotation: -45, style: { fontSize: "10px" } },
      },
      yAxis: { title: { text: yLabel || "Count" }, allowDecimals: false },
      tooltip: { shared: true, valueDecimals: 0 },
      legend: {
        enabled: seriesData.length > 1,
        layout: "horizontal",
        align: "center",
        verticalAlign: "bottom",
        itemStyle: { fontSize: "10px" },
      },
      plotOptions: { line: { marker: { radius: 3 } } },
      series: seriesData,
      credits: { enabled: false },
    });
  } catch (e) {
    el.innerHTML = `<div class="text-sm text-red-400 py-4">Chart error: ${e.message}</div>`;
  }
}

// ── Render a clean bar chart using Highcharts ────────────────────────
function renderHighchartBar(
  containerId,
  title,
  seriesData,
  categories,
  yLabel,
) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (typeof Highcharts === "undefined") {
    el.innerHTML =
      '<div class="text-sm text-red-400 py-4">Highcharts not loaded</div>';
    return;
  }
  try {
    Highcharts.chart(containerId, {
      chart: { type: "column", height: 280, style: { fontFamily: "inherit" } },
      title: { text: title, style: { fontSize: "13px", fontWeight: "600" } },
      xAxis: {
        categories,
        labels: { rotation: -45, style: { fontSize: "10px" } },
      },
      yAxis: {
        title: { text: yLabel || "Count" },
        allowDecimals: false,
        gridLineDashStyle: "Dash",
      },
      tooltip: { shared: true, valueDecimals: 0 },
      legend: {
        enabled: seriesData.length > 1,
        layout: "horizontal",
        align: "center",
        verticalAlign: "bottom",
        itemStyle: { fontSize: "10px" },
      },
      plotOptions: {
        column: {
          borderRadius: 3,
          borderWidth: 0,
          pointPadding: 0.06,
          groupPadding: 0.1,
          maxPointWidth: 36,
        },
      },
      series: seriesData,
      credits: { enabled: false },
    });
  } catch (e) {
    el.innerHTML = `<div class="text-sm text-red-400 py-4">Chart error: ${e.message}</div>`;
  }
}

// ── Render a donut (circular) chart using Highcharts ─────────────────
function renderHighchartDonut(containerId, title, seriesData) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (typeof Highcharts === "undefined") {
    el.innerHTML =
      '<div class="text-sm text-red-400 py-4">Highcharts not loaded</div>';
    return;
  }
  try {
    Highcharts.chart(containerId, {
      chart: { type: "pie", height: 280, style: { fontFamily: "inherit" } },
      title: { text: title, style: { fontSize: "13px", fontWeight: "600" } },
      tooltip: {
        pointFormat: "<b>{point.y}</b> ({point.percentage:.1f}%)",
      },
      plotOptions: {
        pie: {
          innerSize: "55%",
          allowPointSelect: true,
          cursor: "pointer",
          dataLabels: {
            enabled: true,
            format: "<b>{point.name}</b>: {point.percentage:.1f}%",
            style: { fontSize: "10px" },
          },
          showInLegend: true,
        },
      },
      legend: {
        layout: "horizontal",
        align: "center",
        verticalAlign: "bottom",
        itemStyle: { fontSize: "10px" },
      },
      series: [{ name: title, data: seriesData }],
      credits: { enabled: false },
    });
  } catch (e) {
    el.innerHTML = `<div class="text-sm text-red-400 py-4">Chart error: ${e.message}</div>`;
  }
}

// ── Department label map for Inpatient Admission COCs ────────────────
const DEPT_LABELS = {
  PAEDIATRICS: "Paediatrics",
  MATERNITY: "Maternity",
  PSYCHIATRY: "Psychiatry",
  EYE: "Eye",
  SURGICAL: "Surgical",
  AMENITY: "Amenity",
  MEDICAL: "Medical",
  RENAL: "Renal",
  ORTHOPAEDIC: "Orthopaedic",
  ISOLATION: "Isolation",
  "NURSERY/NEWBORN": "Nursery/Newborn",
  ICU: "ICU",
  OTHER: "Other",
  "OBST/GYN": "Obst/Gyn",
};

// ── WORKLOAD tab ──────────────────────────────────────────────────────
function renderMhuWorkload(
  container,
  data,
  tabElements,
  facilityName,
  moh711Data,
  cocData,
) {
  // ── Parse MOH 717 data ──
  const parsed = parseMhuTimeSeries(data, tabElements);
  const periods = parsed.length > 0 ? parsed[0].periods : [];

  // Group MOH 717 into categories
  const inpatientNames = [
    "Admission",
    "Cots",
    "Discharge",
    "Bed",
    "Inpatient",
    "Delivery",
    "Maternity",
  ];
  const outpatientNames = [
    "Outpatient",
    "OPD",
    "Dressing",
    "Injection",
    "Card",
    "CWC",
    "Immuniz",
  ];

  const inpatientItems = parsed.filter(
    (p) =>
      inpatientNames.some((kw) => p.name.includes(kw)) &&
      !p.name.includes("NHIF"),
  );
  const outpatientItems = parsed.filter((p) =>
    outpatientNames.some((kw) => p.name.includes(kw)),
  );
  const otherItems = parsed.filter(
    (p) =>
      !inpatientNames.some((kw) => p.name.includes(kw)) &&
      !outpatientNames.some((kw) => p.name.includes(kw)),
  );
  const sortByTotal = (arr) => arr.sort((a, b) => b.total - a.total);
  sortByTotal(inpatientItems);
  sortByTotal(outpatientItems);
  sortByTotal(otherItems);

  // ── Parse MOH 711 data for new sections ──
  const moh711Periods = new Set();
  const moh711Values = {};
  if (moh711Data) {
    for (const [uid, dxData] of Object.entries(moh711Data)) {
      for (const period of Object.keys(dxData)) {
        moh711Periods.add(period);
      }
    }
  }
  const moh711PeriodList = Array.from(moh711Periods).sort();

  // Compute totals for each MOH 711 UID
  const moh711Totals = {};
  const moh711Series = {};
  if (moh711Data) {
    for (const uid of WORKLOAD_MOH711_UIDS) {
      const dxData = moh711Data[uid] || {};
      const values = moh711PeriodList.map((p) => dxData[p] || 0);
      const total = values.reduce((a, b) => a + b, 0);
      moh711Totals[uid] = total;
      moh711Series[uid] = values;
    }
  }

  // Compute derived metrics
  const normalDel = moh711Totals["jaPrPmor6WV"] || 0;
  const breachDel = moh711Totals["sMqM8DwiAaj"] || 0;
  const assistDel = moh711Totals["Kx64gGqaFVq"] || 0;
  const caesarianSections = moh711Totals["rAZBTMa7Jy3"] || 0;
  const babiesAlive = moh711Totals["zVTIzkATPDS"] || 0;
  const lowBirthWeight = moh711Totals["syjjPqXbjTm"] || 0;
  const totalDeliveries = normalDel + breachDel + assistDel;

  const maternalDeathTotal =
    (moh711Totals["BYMSIbnUzXQ"] || 0) +
    (moh711Totals["AC1Iorxdijc"] || 0) +
    (moh711Totals["dPRCstLVkZu"] || 0) +
    (moh711Totals["CoAXLBxR0Ik"] || 0);
  const neonatalDeaths = moh711Totals["GAr6xu6f1n7"] || 0;

  // Compute rates
  const cSectionRate =
    totalDeliveries > 0
      ? ((caesarianSections / totalDeliveries) * 100).toFixed(1)
      : "0.0";
  const lbwRate =
    babiesAlive > 0 ? ((lowBirthWeight / babiesAlive) * 100).toFixed(1) : "0.0";

  // ── Parse COC-disaggregated data for Inpatient Admissions ──
  // Hardcoded COC ID → department name mapping (same for Under 5 and Over 5)
  const cocDeptMap = {
    ObiJr399QRt: "PAEDIATRICS",
    bPNw3Km3Ug7: "MATERNITY",
    O68sxX0pJMT: "PSYCHIATRY",
    oJ6IUNugflo: "EYE",
    KFmqREu0VSL: "SURGICAL",
    JUI7tesx6as: "AMENITY",
    Lj5arkL7GL8: "MEDICAL",
    R99ctw9w6Kt: "RENAL",
    B0ji6ZY2zJ3: "ORTHOPAEDIC",
    szjWdpjHTDe: "ISOLATION",
    vr2WcWaojbO: "NURSERY/NEWBORN",
    tMEFFDHQCAW: "ICU",
    Qy5yADe3SiB: "OTHER",
    rYfAgBnJKnj: "OBST/GYN",
  };
  // Parse the two inpatient admission DEs from cocData
  const ADMISSION_DE_IDS = ["cvJuw6Fbuiw", "r7LJ3kCX8EZ"];
  const ADMISSION_LABELS = {
    cvJuw6Fbuiw: "Under 5",
    r7LJ3kCX8EZ: "Over 5",
  };
  const admissionDeptData = {}; // {deId: {deptName: total, ...}, ...}
  const admissionDeptPeriodData = {}; // {deId: {deptName: [values], ...}, ...}
  if (cocData) {
    // Collect all periods from cocData
    const cocPeriodSet = new Set();
    for (const dxData of Object.values(cocData)) {
      for (const p of Object.keys(dxData)) {
        cocPeriodSet.add(p);
      }
    }
    const cocPeriods = Array.from(cocPeriodSet).sort();
    for (const deId of ADMISSION_DE_IDS) {
      admissionDeptData[deId] = {};
      admissionDeptPeriodData[deId] = {};
      // Find matching COC keys in cocData
      for (const [key, dxData] of Object.entries(cocData)) {
        if (key.startsWith(deId + ".")) {
          const cocId = key.split(".")[1];
          const deptName = cocDeptMap[cocId] || cocId;
          const values = cocPeriods.map((p) => dxData[p] || 0);
          const total = values.reduce((a, b) => a + b, 0);
          admissionDeptData[deId][deptName] = total;
          admissionDeptPeriodData[deId][deptName] = values;
        }
      }
    }
  }

  // Collect chart div IDs for deferred rendering (build HTML first, render charts after)
  const chartDefs = [];

  // ── Build ALL HTML first (no innerHTML overwrites during construction) ──
  let html = `
    <div class="mb-4">
      <div class="text-sm font-bold text-slate-700">${escapeHtml(facilityName)}</div>
      <div class="text-[11px] text-slate-400">MOH 717 — Workload · Last 12 months</div>
    </div>
  `;

  // ── SECTION 1: Summary KPI Cards (MOH 717 inpatient + outpatient) ──
  const topInpatient = inpatientItems.slice(0, 6);
  const topOutpatient = outpatientItems.slice(0, 6);
  const kpiItems = [...topInpatient, ...topOutpatient].slice(0, 8);
  if (kpiItems.length > 0) {
    html += `<div class="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-2">`;
    for (const item of kpiItems) {
      html += `
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div class="text-[18px] font-bold text-slate-800">${item.total.toLocaleString()}</div>
          <div class="text-[10px] text-slate-500 leading-tight mt-0.5">${escapeHtml(item.name.replace(/^MOH 717[^_]*_/, "").replace(/Rev2020_/, ""))}</div>
        </div>`;
    }
    html += `</div>`;
  }

  // ── SECTION 2: MNCH Quick Summary (compact KPI cards) ──
  html += `<div class="mb-5"><div class="text-sm font-bold text-slate-700 mb-2">📋 MNCH Overview Summary</div>`;
  html += `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">`;
  html += `<div class="rounded-xl border border-slate-200 bg-white p-2.5"><div class="text-[18px] font-bold text-slate-800">${totalDeliveries.toLocaleString()}</div><div class="text-[10px] text-slate-500 leading-tight">Total Deliveries</div></div>`;
  html += `<div class="rounded-xl border border-slate-200 bg-white p-2.5"><div class="text-[18px] font-bold text-slate-800">${cSectionRate}%</div><div class="text-[10px] text-slate-500 leading-tight">C-Section Rate</div></div>`;
  html += `<div class="rounded-xl border border-slate-200 bg-white p-2.5"><div class="text-[18px] font-bold text-slate-800">${(moh711Totals["f9vesk5d4IY"] || 0).toLocaleString()}</div><div class="text-[10px] text-slate-500 leading-tight">ANC New Visits</div></div>`;
  html += `<div class="rounded-xl border border-slate-200 bg-white p-2.5"><div class="text-[18px] font-bold text-slate-800">${babiesAlive.toLocaleString()}</div><div class="text-[10px] text-slate-500 leading-tight">Babies discharged Alive</div></div>`;
  html += `<div class="rounded-xl border border-slate-200 bg-white p-2.5"><div class="text-[18px] font-bold text-rose-700">${maternalDeathTotal.toLocaleString()}</div><div class="text-[10px] text-slate-500 leading-tight">Maternal Deaths</div></div>`;
  html += `<div class="rounded-xl border border-slate-200 bg-white p-2.5"><div class="text-[18px] font-bold text-orange-700">${neonatalDeaths.toLocaleString()}</div><div class="text-[10px] text-slate-500 leading-tight">Neonatal Deaths</div></div>`;
  html += `<div class="rounded-xl border border-slate-200 bg-white p-2.5"><div class="text-[18px] font-bold text-slate-800">${breachDel.toLocaleString()}</div><div class="text-[10px] text-slate-500 leading-tight">Breach Delivery</div></div>`;
  html += `<div class="rounded-xl border border-slate-200 bg-white p-2.5"><div class="text-[18px] font-bold text-slate-800">${assistDel.toLocaleString()}</div><div class="text-[10px] text-slate-500 leading-tight">Assisted Vaginal Delivery</div></div>`;
  html += `</div></div>`;

  // ── SECTION 3: MOH 717 Inpatient — individual charts ──
  if (inpatientItems.length > 0) {
    html += `<div class="mb-5"><div class="text-sm font-bold text-slate-700 mb-3">🏥 Inpatient Services (MOH 717)</div>`;
    html += `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">`;
    for (let i = 0; i < inpatientItems.length; i++) {
      const item = inpatientItems[i];
      const chartId = `mhuInpatient_${i}`;
      const shortName = item.name
        .replace(/^MOH 717[^_]*_/, "")
        .replace(/Rev2020_/, "");
      const ct = i % 3; // 0=bar, 1=line, 2=donut
      html += `<div id="${chartId}" class="rounded-xl border border-slate-200 p-2.5 bg-white shadow-sm"></div>`;
      chartDefs.push({
        type: "inpatient_single",
        chartId,
        item,
        periods,
        chartSubType: ct,
        shortName,
      });
    }
    html += `</div></div>`;
  }

  // ── SECTION 3B: Inpatient Admissions by Department (Under 5 / Over 5) ──
  // Build ordered list of ALL department names from DEPT_LABELS (preserving order)
  const ALL_DEPT_NAMES = Object.keys(DEPT_LABELS);
  html += `<div class="mb-5"><div class="text-sm font-bold text-slate-700 mb-3">📊 Inpatient Admissions by Department</div>`;
  html += `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">`;
  for (const deId of ADMISSION_DE_IDS) {
    const deptTotals = admissionDeptData[deId] || {};
    // Build values for ALL departments, defaulting to 0
    const deptNames = ALL_DEPT_NAMES.map((name) => DEPT_LABELS[name]);
    const deptValues = ALL_DEPT_NAMES.map((name) => deptTotals[name] || 0);
    const label = ADMISSION_LABELS[deId] || deId;
    const chartId = `mhuAdmission_${deId}`;
    html += `<div id="${chartId}" class="rounded-xl border border-slate-200 p-3 bg-white shadow-sm"></div>`;
    chartDefs.push({
      type: "admission_bar",
      chartId,
      title: `Inpatient Admissions — ${label}`,
      categories: deptNames,
      values: deptValues,
      label,
    });
  }
  html += `</div></div>`;

  // ── SECTION 4: MOH 717 Outpatient — individual charts ──
  if (outpatientItems.length > 0) {
    html += `<div class="mb-5"><div class="text-sm font-bold text-slate-700 mb-3">🚶 Outpatient & Clinic Services (MOH 717)</div>`;
    html += `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">`;
    for (let i = 0; i < outpatientItems.length; i++) {
      const item = outpatientItems[i];
      const chartId = `mhuOutpatient_${i}`;
      const shortName = item.name
        .replace(/^MOH 717[^_]*_/, "")
        .replace(/Rev2020_/, "");
      const ct = i % 3; // 0=bar, 1=line, 2=donut
      html += `<div id="${chartId}" class="rounded-xl border border-slate-200 p-2.5 bg-white shadow-sm"></div>`;
      chartDefs.push({
        type: "outpatient_single",
        chartId,
        item,
        periods,
        chartSubType: ct,
        shortName,
      });
    }
    html += `</div></div>`;
  }

  // ── SECTION 5: Other MOH 717 indicators table ──
  if (otherItems.length > 0) {
    let tableHtml = `
      <div class="mt-4">
        <div class="text-xs font-semibold text-slate-500 uppercase mb-2">Other Workload Indicators</div>
        <div class="overflow-x-auto rounded-xl border border-slate-200">
          <table class="w-full text-left text-[12px]">
            <thead><tr class="bg-slate-100 text-slate-600">`;
    const months = periods.slice(-6);
    tableHtml += `<th class="px-3 py-2 font-semibold">Indicator</th>`;
    for (const m of months)
      tableHtml += `<th class="px-3 py-2 font-semibold text-right">${escapeHtml(m)}</th>`;
    tableHtml += `<th class="px-3 py-2 font-semibold text-right">Total</th></tr></thead><tbody>`;
    for (const item of otherItems.slice(0, 15)) {
      tableHtml += `<tr class="border-t border-slate-100 hover:bg-slate-50">`;
      tableHtml += `<td class="px-3 py-1.5 font-medium text-slate-700">${escapeHtml(item.name.replace(/^MOH 717[^_]*_/, "").replace(/Rev2020_/, ""))}</td>`;
      const lastVals = item.values.slice(-6);
      for (const v of lastVals)
        tableHtml += `<td class="px-3 py-1.5 text-right text-slate-600">${v.toLocaleString()}</td>`;
      tableHtml += `<td class="px-3 py-1.5 text-right font-semibold text-slate-800">${item.total.toLocaleString()}</td></tr>`;
    }
    tableHtml += `</tbody></table></div></div>`;
    html += tableHtml;
  }

  // ── Write ALL HTML at once ──
  container.innerHTML = html;

  // ── Render all deferred charts ──
  for (const def of chartDefs) {
    if (def.type === "inpatient_single") {
      if (def.chartSubType === 0) {
        renderHighchartBar(
          def.chartId,
          def.shortName,
          [{ name: def.shortName, data: def.item.values }],
          def.periods,
          "Count",
        );
      } else if (def.chartSubType === 1) {
        renderHighchartLine(
          def.chartId,
          def.shortName,
          [{ name: def.shortName, data: def.item.values }],
          def.periods,
          "Count",
        );
      } else {
        const donutData = def.item.values
          .map((v, idx) => ({
            name: def.periods[idx] || `M${idx + 1}`,
            y: v,
          }))
          .filter((d) => d.y > 0);
        if (donutData.length > 0) {
          renderHighchartDonut(def.chartId, def.shortName, donutData);
        } else {
          const el = document.getElementById(def.chartId);
          if (el)
            el.innerHTML =
              '<div class="text-xs text-slate-400 py-6 text-center">No data</div>';
        }
      }
    } else if (def.type === "outpatient_single") {
      if (def.chartSubType === 0) {
        renderHighchartBar(
          def.chartId,
          def.shortName,
          [{ name: def.shortName, data: def.item.values }],
          def.periods,
          "Count",
        );
      } else if (def.chartSubType === 1) {
        renderHighchartLine(
          def.chartId,
          def.shortName,
          [{ name: def.shortName, data: def.item.values }],
          def.periods,
          "Count",
        );
      } else {
        const donutData = def.item.values
          .map((v, idx) => ({
            name: def.periods[idx] || `M${idx + 1}`,
            y: v,
          }))
          .filter((d) => d.y > 0);
        if (donutData.length > 0) {
          renderHighchartDonut(def.chartId, def.shortName, donutData);
        } else {
          const el = document.getElementById(def.chartId);
          if (el)
            el.innerHTML =
              '<div class="text-xs text-slate-400 py-6 text-center">No data</div>';
        }
      }
    } else if (def.type === "admission_bar") {
      renderHighchartBar(
        def.chartId,
        `Inpatient Admissions — ${def.label}`,
        [{ name: "Admissions", data: def.values, color: "#3b82f6" }],
        def.categories,
        "Total Admissions",
      );
    } else {
      // MOH 711 line chart
      const seriesData = def.uids
        .filter((uid) => (moh711Totals[uid] || 0) > 0)
        .map((uid) => ({
          name: WORKLOAD_MOH711_LABELS[uid] || uid,
          data: moh711Series[uid] || [],
        }));
      renderHighchartLine(
        def.chartId,
        def.title,
        seriesData,
        moh711PeriodList,
        def.yLabel,
      );
    }
  }
}

// ── HYPERTENSION & DIABETES tab (MOH 740) ─────────────────────────────
function renderMhuDiabetesHypertension(
  container,
  data,
  tabElements,
  facilityName,
) {
  // ── Parse time series ──
  const parsed = parseMhuTimeSeries(data, tabElements);
  const periods = parsed.length > 0 ? parsed[0].periods : [];

  if (parsed.length === 0 || !periods.length) {
    container.innerHTML = `
      <div class="mb-4">
        <div class="text-sm font-bold text-slate-700">${escapeHtml(facilityName)}</div>
        <div class="text-[11px] text-slate-400">Diabetes & Hypertension · MOH 740 · Last 12 months</div>
      </div>
      <div class="flex flex-col items-center justify-center py-14 text-sm text-slate-400">
        <div class="font-semibold text-slate-500">No MOH 740 data available</div>
      </div>`;
    return;
  }

  // ── Build lookup by element ID ──
  const byId = {};
  for (const item of parsed) {
    byId[item.id] = item;
  }

  // ── Helper to get total for a UID ──
  function tot(uid) {
    return byId[uid] ? byId[uid].total : 0;
  }
  function vals(uid) {
    return byId[uid] ? byId[uid].values : periods.map(() => 0);
  }
  function label(uid) {
    return byId[uid]
      ? byId[uid].name.replace(/^(MOH 740_|NCD_)/, "").replace(/_/g, " ")
      : uid;
  }

  // ── Correct KHIS data element UIDs for MOH 740 ──
  // All use iHRIS Gender combo (returns total M+F)

  // Core indicators
  const DM_NEW = "X1nfVRZfgoj"; // NCD_No. of newly diagnosed diabetes cases
  const DM_REVISIT = "PMAwYlc0jCR"; // MOH 740_Revisits to clinic/Known DM
  const HTN_NEW = "s7cDALEmOP0"; // NCD_No. of newly diagnosed hypertension cases
  const HTN_REVISIT = "zaaOEKkYUYN"; // MOH 740_Re-visit to clinic/Known HTN
  const COMORBID_NEW = "lzXHQzLfZ3Y"; // MOH 740_Newly diagnosed co-morbid with both DM and HTN cases
  const COMORBID_REVISIT = "U2C1pH3FhPr"; // MOH 740_Revisits to clinic/Known co-morbid DM and HTN
  const FIRST_VISIT = "DJaovg3DyCN"; // NCD_First visit (DM and HTN)
  const REVISIT_BOTH = "QxrKGwLa01d"; // NCD_Re-visit (DM and HTN)

  // Diabetes Management
  const THERAPY_DIET = "j4XffLyqcY7"; // NCD_No. of patients on diet and exercise only
  const THERAPY_INSULIN = "EgtgGwiEZVK"; // NCD_No. of patients on insulin
  const THERAPY_OGL = "K9iAjXdslFq"; // NCD_No. of patients on OGLAs
  const THERAPY_BOTH = "nVAnB1FaQvS"; // NCD_No. of patients on both (Insulin and OGLAs)
  const THERAPY_ANTIHYPER = "OPV0jQg6XUq"; // NCD_No. of patients on antihypertensives

  // HbA1c
  const HBA1C_DONE = "SNIA8DX7tap"; // NCD_No. of patients done HbA1c
  const HBA1C_TARGET = "VoFeZvr48Lh"; // NCD_No. that met HbA1c target

  // Complications - Admissions
  const COMP_DKA = "Ni5RRjLGWQH"; // NCD_No. admitted with DKA
  const COMP_HYPO = "bZn8S29lVjp"; // NCD_No. admitted with Hypoglycemia
  const COMP_STROKE = "mkPM8byu5Zx"; // NCD_No. admitted with stroke
  const COMP_HF = "nHL9YUGPVGt"; // NCD_No. admitted with heart failure
  const COMP_KIDNEY = "qNqKmxk27MU"; // NCD_No. with kidney complications
  const COMP_RETINO = "yie5hljYlAv"; // NCD_No. with diabetic retinopathy
  const COMP_NEURO = "VwCqIauu3qT"; // NCD_No. of Patients with neuropathies

  // Diabetic Foot
  const FOOT_NEW = "ZtOe9P9tKDG"; // MOH 740_No. of patients with diabetic foot
  const FOOT_SCREEN = "z88eEimoRGI"; // NCD_No. of patients screened for diabetic foot
  const FOOT_ULCER = "ZRSBoRa00hj"; // NCD_No. of patients with diabetic foot ulcer
  const FOOT_AMP = "QURrpyQyh6b"; // NCD_No. of amputation due to diabetic foot
  const FOOT_SAVED = "Tjf74bmUe8h"; // NCD_No. of feet saved through treatment

  // TB Screening
  const TB_SCREEN = "ebigsxT6fUb"; // NCD_No. Screened for Tuberculosis
  const TB_POS = "WlyzeVsquET"; // NCD_No. Screened Positive for Tuberclosis

  // Gestational
  const GEST_SCREEN = "x0UpKUf3qN4"; // NCD_No. screened for Gestational Diabetes Mellitus
  const GEST_DIAG = "Qcz2146ffun"; // NCD_No. diagnosed for Gestational Diabetes Mellitus

  // Other
  const DIAB_SECONDARY = "vkgcaOcqEX9"; // NCD_No. of Diabetes secondary to other causes
  const HIGH_BP = "CJB9gTlPyD5"; // NCD_No. with high BP (More than140/90)

  // ── Compute summary KPIs ──
  const dmNewTotal = tot(DM_NEW);
  const dmRevisitTotal = tot(DM_REVISIT);
  const htnNewTotal = tot(HTN_NEW);
  const htnRevisitTotal = tot(HTN_REVISIT);
  const comorbidNewTotal = tot(COMORBID_NEW);
  const comorbidRevisitTotal = tot(COMORBID_REVISIT);
  const gestTotal = tot(GEST_DIAG);
  const onTherapy = tot(THERAPY_INSULIN) + tot(THERAPY_OGL) + tot(THERAPY_BOTH);
  const highBpTotal = tot(HIGH_BP);
  const hba1cDone = tot(HBA1C_DONE);

  // ── Deferred chart defs ──
  const chartDefs = [];

  // ── Build HTML ──
  let html = `
    <div class="mb-4">
      <div class="text-sm font-bold text-slate-700">${escapeHtml(facilityName)}</div>
      <div class="text-[11px] text-slate-400">Diabetes & Hypertension · MOH 740 · Last 12 months</div>
    </div>
  `;

  // ──────────────────────────────────────────────────────────────────
  // SECTION 1: Summary KPI Cards
  // ──────────────────────────────────────────────────────────────────
  html += `<div class="mb-5"><div class="text-sm font-bold text-slate-700 mb-3">📊 Key Summary</div>`;
  html += `<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">`;
  html += `<div class="rounded-xl border border-slate-200 bg-blue-50 p-3"><div class="text-[22px] font-bold text-blue-800">${dmNewTotal.toLocaleString()}</div><div class="text-[10px] text-blue-600">New Diabetes</div></div>`;
  html += `<div class="rounded-xl border border-slate-200 bg-cyan-50 p-3"><div class="text-[22px] font-bold text-cyan-800">${dmRevisitTotal.toLocaleString()}</div><div class="text-[10px] text-cyan-600">Revisit/Known DM</div></div>`;
  html += `<div class="rounded-xl border border-slate-200 bg-emerald-50 p-3"><div class="text-[22px] font-bold text-emerald-800">${htnNewTotal.toLocaleString()}</div><div class="text-[10px] text-emerald-600">New Hypertension</div></div>`;
  html += `<div class="rounded-xl border border-slate-200 bg-teal-50 p-3"><div class="text-[22px] font-bold text-teal-800">${htnRevisitTotal.toLocaleString()}</div><div class="text-[10px] text-teal-600">Revisit/Known HTN</div></div>`;
  html += `<div class="rounded-xl border border-slate-200 bg-amber-50 p-3"><div class="text-[22px] font-bold text-amber-800">${comorbidNewTotal.toLocaleString()}</div><div class="text-[10px] text-amber-600">New Comorbid DM+HTN</div></div>`;
  html += `<div class="rounded-xl border border-slate-200 bg-purple-50 p-3"><div class="text-[22px] font-bold text-purple-800">${onTherapy.toLocaleString()}</div><div class="text-[10px] text-purple-600">On Therapy</div></div>`;
  html += `<div class="rounded-xl border border-slate-200 bg-pink-50 p-3"><div class="text-[22px] font-bold text-pink-800">${gestTotal.toLocaleString()}</div><div class="text-[10px] text-pink-600">Gestational Diabetes</div></div>`;
  html += `<div class="rounded-xl border border-slate-200 bg-red-50 p-3"><div class="text-[22px] font-bold text-red-800">${highBpTotal.toLocaleString()}</div><div class="text-[10px] text-red-600">High BP</div></div>`;
  html += `<div class="rounded-xl border border-slate-200 bg-amber-50 p-3"><div class="text-[22px] font-bold text-amber-800">${hba1cDone.toLocaleString()}</div><div class="text-[10px] text-amber-600">HbA1c Done</div></div>`;
  html += `<div class="rounded-xl border border-slate-200 bg-slate-100 p-3"><div class="text-[22px] font-bold text-slate-800">${(dmNewTotal + dmRevisitTotal + htnNewTotal + htnRevisitTotal).toLocaleString()}</div><div class="text-[10px] text-slate-600">Total DM+HTN Encounters</div></div>`;
  html += `</div></div>`;

  // ──────────────────────────────────────────────────────────────────
  // SECTION 2: Diabetes Overview (Bar Chart - New vs Revisit)
  // ──────────────────────────────────────────────────────────────────
  const dmOverviewChartId = "mhu740_dm_overview_" + Date.now();
  html += `<div class="mb-5"><div class="text-sm font-bold text-slate-700 mb-2">🩸 Diabetes Overview</div>`;
  html += `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">`;
  html += `<div id="${dmOverviewChartId}" class="rounded-xl border border-slate-200 p-2.5 bg-white shadow-sm"></div>`;
  chartDefs.push({
    type: "bar_single",
    chartId: dmOverviewChartId,
    title: "Diabetes - New vs Known",
    items: [
      { id: DM_NEW, label: "New Diabetes" },
      { id: DM_REVISIT, label: "Known/Revisit DM" },
    ],
  });

  // Diabetes Management Overview
  const dmMgmtChartId = "mhu740_dm_mgmt_" + Date.now();
  html += `<div id="${dmMgmtChartId}" class="rounded-xl border border-slate-200 p-2.5 bg-white shadow-sm"></div>`;
  chartDefs.push({
    type: "bar_single",
    chartId: dmMgmtChartId,
    title: "Diabetes Management",
    items: [
      { id: THERAPY_DIET, label: "Diet & Exercise" },
      { id: THERAPY_INSULIN, label: "Insulin" },
      { id: THERAPY_OGL, label: "OGLAs" },
      { id: THERAPY_BOTH, label: "Insulin + OGL" },
    ],
  });
  html += `</div></div>`;

  // ──────────────────────────────────────────────────────────────────
  // SECTION 3: HbA1c & Diabetes Admissions
  // ──────────────────────────────────────────────────────────────────
  html += `<div class="mb-5"><div class="text-sm font-bold text-slate-700 mb-2">🧪 HbA1c Monitoring & Acute Admissions</div>`;
  html += `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">`;

  const hba1cChartId = "mhu740_dm_hba1c_" + Date.now();
  html += `<div id="${hba1cChartId}" class="rounded-xl border border-slate-200 p-2.5 bg-white shadow-sm"></div>`;
  chartDefs.push({
    type: "bar_single",
    chartId: hba1cChartId,
    title: "HbA1c Monitoring",
    items: [
      { id: HBA1C_DONE, label: "HbA1c Done" },
      { id: HBA1C_TARGET, label: "Met Target (<7%)" },
    ],
  });

  const admitChartId = "mhu740_dm_admit_" + Date.now();
  html += `<div id="${admitChartId}" class="rounded-xl border border-slate-200 p-2.5 bg-white shadow-sm"></div>`;
  chartDefs.push({
    type: "bar_single",
    chartId: admitChartId,
    title: "Acute Diabetes Admissions",
    items: [
      { id: COMP_DKA, label: "DKA" },
      { id: COMP_HYPO, label: "Hypoglycemia" },
    ],
  });

  html += `</div></div>`;

  // ──────────────────────────────────────────────────────────────────
  // SECTION 4: Diabetes Complications & Foot
  // ──────────────────────────────────────────────────────────────────
  html += `<div class="mb-5"><div class="text-sm font-bold text-slate-700 mb-2">⚠️ Diabetes Complications & Foot</div>`;
  html += `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">`;

  const compChartId = "mhu740_dm_comp_" + Date.now();
  html += `<div id="${compChartId}" class="rounded-xl border border-slate-200 p-2.5 bg-white shadow-sm"></div>`;
  chartDefs.push({
    type: "bar_single",
    chartId: compChartId,
    title: "Diabetes Complications",
    items: [
      { id: COMP_STROKE, label: "Stroke" },
      { id: COMP_HF, label: "Heart Failure" },
      { id: COMP_KIDNEY, label: "Kidney" },
      { id: COMP_RETINO, label: "Retinopathy" },
      { id: COMP_NEURO, label: "Neuropathy" },
    ],
  });

  const footChartId = "mhu740_dm_foot_" + Date.now();
  html += `<div id="${footChartId}" class="rounded-xl border border-slate-200 p-2.5 bg-white shadow-sm"></div>`;
  chartDefs.push({
    type: "bar_single",
    chartId: footChartId,
    title: "Diabetic Foot",
    items: [
      { id: FOOT_SCREEN, label: "Screened" },
      { id: FOOT_NEW, label: "New Foot Dx" },
      { id: FOOT_ULCER, label: "Foot Ulcer" },
      { id: FOOT_AMP, label: "Amputation" },
      { id: FOOT_SAVED, label: "Feet Saved" },
    ],
  });

  html += `</div></div>`;

  // ──────────────────────────────────────────────────────────────────
  // SECTION 5: Antihypertensives & TB Screening
  // ──────────────────────────────────────────────────────────────────
  html += `<div class="mb-5"><div class="text-sm font-bold text-slate-700 mb-2">💊 Treatment & TB Screening</div>`;
  html += `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">`;

  const antihyperChartId = "mhu740_antihyper_" + Date.now();
  html += `<div id="${antihyperChartId}" class="rounded-xl border border-slate-200 p-2.5 bg-white shadow-sm"></div>`;
  chartDefs.push({
    type: "bar_single",
    chartId: antihyperChartId,
    title: "Anti-hypertensive & Secondary Diabetes",
    items: [
      { id: THERAPY_ANTIHYPER, label: "On Antihypertensives" },
      { id: DIAB_SECONDARY, label: "Secondary Diabetes" },
    ],
  });

  const tbChartId = "mhu740_tb_" + Date.now();
  html += `<div id="${tbChartId}" class="rounded-xl border border-slate-200 p-2.5 bg-white shadow-sm"></div>`;
  chartDefs.push({
    type: "bar_single",
    chartId: tbChartId,
    title: "TB Screening in Diabetes Patients",
    items: [
      { id: TB_SCREEN, label: "Screened for TB" },
      { id: TB_POS, label: "TB Positive" },
    ],
  });

  html += `</div></div>`;

  // ──────────────────────────────────────────────────────────────────
  // SECTION 6: Hypertension Overview
  // ──────────────────────────────────────────────────────────────────
  const htnOverviewChartId = "mhu740_htn_overview_" + Date.now();
  html += `<div class="mb-5"><div class="text-sm font-bold text-slate-700 mb-2">❤️ Hypertension Overview</div>`;
  html += `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">`;
  html += `<div id="${htnOverviewChartId}" class="rounded-xl border border-slate-200 p-2.5 bg-white shadow-sm"></div>`;
  chartDefs.push({
    type: "bar_single",
    chartId: htnOverviewChartId,
    title: "Hypertension - New vs Known",
    items: [
      { id: HTN_NEW, label: "New Hypertension" },
      { id: HTN_REVISIT, label: "Known/Revisit HTN" },
      { id: HIGH_BP, label: "High BP (>140/90)" },
    ],
  });

  const htnMgmtChartId = "mhu740_htn_mgmt_" + Date.now();
  html += `<div id="${htnMgmtChartId}" class="rounded-xl border border-slate-200 p-2.5 bg-white shadow-sm"></div>`;
  chartDefs.push({
    type: "bar_single",
    chartId: htnMgmtChartId,
    title: "First Visit & Revisit (DM+HTN combined)",
    items: [
      { id: FIRST_VISIT, label: "First Visit (DM & HTN)" },
      { id: REVISIT_BOTH, label: "Revisit (DM & HTN)" },
    ],
  });
  html += `</div></div>`;

  // ──────────────────────────────────────────────────────────────────
  // SECTION 7: Hypertension Complications
  // ──────────────────────────────────────────────────────────────────
  html += `<div class="mb-5"><div class="text-sm font-bold text-slate-700 mb-2">⚠️ Hypertension Complications</div>`;
  html += `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">`;

  const htnCompChartId = "mhu740_htn_comp_" + Date.now();
  html += `<div id="${htnCompChartId}" class="rounded-xl border border-slate-200 p-2.5 bg-white shadow-sm"></div>`;
  chartDefs.push({
    type: "bar_single",
    chartId: htnCompChartId,
    title: "Hypertension Complications",
    items: [
      { id: COMP_STROKE, label: "Stroke" },
      { id: COMP_HF, label: "Heart Failure" },
    ],
  });

  // A second complications chart
  const htnComp2ChartId = "mhu740_htn_comp2_" + Date.now();
  html += `<div id="${htnComp2ChartId}" class="rounded-xl border border-slate-200 p-2.5 bg-white shadow-sm"></div>`;
  chartDefs.push({
    type: "bar_single",
    chartId: htnComp2ChartId,
    title: "Other Complications",
    items: [
      { id: COMP_KIDNEY, label: "Kidney" },
      { id: COMP_RETINO, label: "Retinopathy" },
      { id: COMP_NEURO, label: "Neuropathy" },
    ],
  });

  html += `</div></div>`;

  // ──────────────────────────────────────────────────────────────────
  // SECTION 8: Comorbid (DM + HTN) & Gestational
  // ──────────────────────────────────────────────────────────────────
  html += `<div class="mb-5"><div class="text-sm font-bold text-slate-700 mb-2">🔄 Comorbid (Diabetes + Hypertension) & Gestational</div>`;
  html += `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">`;

  const comorbidChartId = "mhu740_comorbid_" + Date.now();
  html += `<div id="${comorbidChartId}" class="rounded-xl border border-slate-200 p-2.5 bg-white shadow-sm"></div>`;
  chartDefs.push({
    type: "bar_single",
    chartId: comorbidChartId,
    title: "Comorbid DM+HTN",
    items: [
      { id: COMORBID_NEW, label: "New Comorbid" },
      { id: COMORBID_REVISIT, label: "Revisit Comorbid" },
    ],
  });

  const gestChartId = "mhu740_gest_" + Date.now();
  html += `<div id="${gestChartId}" class="rounded-xl border border-slate-200 p-2.5 bg-white shadow-sm"></div>`;
  chartDefs.push({
    type: "bar_single",
    chartId: gestChartId,
    title: "Gestational Diabetes",
    items: [
      { id: GEST_SCREEN, label: "Screened" },
      { id: GEST_DIAG, label: "Diagnosed" },
    ],
  });

  html += `</div></div>`;

  // ──────────────────────────────────────────────────────────────────
  // SECTION 10: All Indicators Reference Table (compact)
  // ──────────────────────────────────────────────────────────────────
  const sortByTotal = (arr) => arr.sort((a, b) => b.total - a.total);
  const sortedAll = sortByTotal([...parsed]);
  if (sortedAll.length > 0) {
    let tableHtml = `<div class="mt-4"><div class="text-xs font-semibold text-slate-500 uppercase mb-2">📋 All MOH 740 Indicators (${sortedAll.length})</div>`;
    tableHtml += `<div class="overflow-x-auto rounded-xl border border-slate-200 max-h-80 overflow-y-auto">`;
    tableHtml += `<table class="w-full text-left text-[12px]">`;
    tableHtml += `<thead><tr class="bg-slate-100 text-slate-600 sticky top-0">`;
    tableHtml += `<th class="px-3 py-2 font-semibold">Indicator</th>`;
    const months = periods.slice(-6);
    for (const m of months)
      tableHtml += `<th class="px-3 py-2 font-semibold text-right">${escapeHtml(m)}</th>`;
    tableHtml += `<th class="px-3 py-2 font-semibold text-right">Total</th></tr></thead><tbody>`;
    for (const item of sortedAll) {
      tableHtml += `<tr class="border-t border-slate-100 hover:bg-slate-50">`;
      tableHtml += `<td class="px-3 py-1.5 font-medium text-slate-700">${escapeHtml(item.name.replace(/^MHU /, "").replace(/_/g, " "))}</td>`;
      const lastVals = item.values.slice(-6);
      for (const v of lastVals)
        tableHtml += `<td class="px-3 py-1.5 text-right text-slate-600">${v.toLocaleString()}</td>`;
      tableHtml += `<td class="px-3 py-1.5 text-right font-semibold text-slate-800">${item.total.toLocaleString()}</td></tr>`;
    }
    tableHtml += `</tbody></table></div></div>`;
    html += tableHtml;
  }

  // ── Write ALL HTML ──
  container.innerHTML = html;

  // ──────────────────────────────────────────────────────────────────
  // Render all deferred charts
  // ──────────────────────────────────────────────────────────────────
  for (const def of chartDefs) {
    if (def.type === "bar_single") {
      // New format: items = [{id, label}]
      const series = def.items
        .filter((item) => tot(item.id) > 0)
        .map((item) => ({
          name: item.label,
          data: vals(item.id),
        }));
      if (series.length > 0) {
        renderHighchartBar(def.chartId, def.title, series, periods, "Count");
      } else {
        const el = document.getElementById(def.chartId);
        if (el)
          el.innerHTML =
            '<div class="text-xs text-slate-400 py-6 text-center">No data</div>';
      }
    } else if (def.type === "bar") {
      // Simple bar chart - one series per UID
      const series = def.uids.map((uid) => ({
        name: label(uid)
          .replace(/^(?:new |revisit |cumm )/i, "")
          .replace(/\b(F|M)$/, "($1)"),
        data: vals(uid),
      }));
      renderHighchartBar(def.chartId, def.title, series, periods, "Count");
    } else if (def.type === "bar_group") {
      // Grouped bar chart - one series per UID
      const series = def.uids.map((uid) => ({
        name: label(uid)
          .replace(/^(?:MHU )?/, "")
          .replace(/\b(F|M)\b/, "($1)"),
        data: vals(uid),
      }));
      renderHighchartBar(def.chartId, def.title, series, periods, "Count");
    } else if (def.type === "donut_uids") {
      // Donut chart from UIDs
      const donutData = def.uids
        .map((uid) => ({
          name: label(uid)
            .replace(/^(?:new |revisit |cumm )/i, "")
            .replace(/\b(F|M)\b/, "($1)"),
          y: tot(uid),
        }))
        .filter((d) => d.y > 0);
      if (donutData.length > 0) {
        renderHighchartDonut(def.chartId, def.title, donutData);
      } else {
        const el = document.getElementById(def.chartId);
        if (el)
          el.innerHTML =
            '<div class="text-xs text-slate-400 py-6 text-center">No data</div>';
      }
    }
  }
}

// ── MNCH tab — full MOH 711 charts ───────────────────────────────────
function renderMhuMnch(container, facilityName, moh711Data) {
  // ── Parse MOH 711 data ──
  const moh711Periods = new Set();
  if (moh711Data) {
    for (const [uid, dxData] of Object.entries(moh711Data)) {
      for (const period of Object.keys(dxData)) {
        moh711Periods.add(period);
      }
    }
  }
  const moh711PeriodList = Array.from(moh711Periods).sort();

  const moh711Totals = {};
  const moh711Series = {};
  if (moh711Data) {
    for (const uid of WORKLOAD_MOH711_UIDS) {
      const dxData = moh711Data[uid] || {};
      const values = moh711PeriodList.map((p) => dxData[p] || 0);
      const total = values.reduce((a, b) => a + b, 0);
      moh711Totals[uid] = total;
      moh711Series[uid] = values;
    }
  }

  // Derived metrics
  const normalDel = moh711Totals["jaPrPmor6WV"] || 0;
  const breachDel = moh711Totals["sMqM8DwiAaj"] || 0;
  const assistDel = moh711Totals["Kx64gGqaFVq"] || 0;
  const caesarianSections = moh711Totals["rAZBTMa7Jy3"] || 0;
  const babiesAlive = moh711Totals["zVTIzkATPDS"] || 0;
  const lowBirthWeight = moh711Totals["syjjPqXbjTm"] || 0;
  const totalDeliveries = normalDel + breachDel + assistDel;

  const maternalDeathTotal =
    (moh711Totals["BYMSIbnUzXQ"] || 0) +
    (moh711Totals["AC1Iorxdijc"] || 0) +
    (moh711Totals["dPRCstLVkZu"] || 0) +
    (moh711Totals["CoAXLBxR0Ik"] || 0);
  const neonatalDeaths = moh711Totals["GAr6xu6f1n7"] || 0;

  const cSectionRate =
    totalDeliveries > 0
      ? ((caesarianSections / totalDeliveries) * 100).toFixed(1)
      : "0.0";
  const lbwRate =
    babiesAlive > 0 ? ((lowBirthWeight / babiesAlive) * 100).toFixed(1) : "0.0";

  if (Object.keys(moh711Totals).length === 0 || !moh711PeriodList.length) {
    container.innerHTML = `
      <div class="mb-4">
        <div class="text-sm font-bold text-slate-700">${escapeHtml(facilityName)}</div>
        <div class="text-[11px] text-slate-400">MNCH · MOH 711 · Last 12 months</div>
      </div>
      <div class="flex flex-col items-center justify-center py-14 text-sm text-slate-400">
        <div class="font-semibold text-slate-500">No MOH 711 data available for MNCH indicators</div>
      </div>`;
    return;
  }

  const chartDefs = [];

  let html = `
    <div class="mb-4">
      <div class="text-sm font-bold text-slate-700">${escapeHtml(facilityName)}</div>
      <div class="text-[11px] text-slate-400">MNCH · MOH 711 · Last 12 months</div>
    </div>
  `;

  // ── SECTION 1: Delivery Outcomes ──
  if (totalDeliveries > 0 || breachDel > 0 || assistDel > 0) {
    html += `<div class="mb-5"><div class="text-sm font-bold text-slate-700 mb-3">🚼 Delivery Outcomes</div>`;
    html += `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">`;
    html += `<div class="rounded-xl border border-slate-200 bg-blue-50 p-3"><div class="text-[22px] font-bold text-blue-800">${totalDeliveries.toLocaleString()}</div><div class="text-[10px] text-blue-600">Total Deliveries</div></div>`;
    html += `<div class="rounded-xl border border-slate-200 bg-emerald-50 p-3"><div class="text-[22px] font-bold text-emerald-800">${normalDel.toLocaleString()}</div><div class="text-[10px] text-emerald-600">Normal Deliveries</div></div>`;
    html += `<div class="rounded-xl border border-slate-200 bg-amber-50 p-3"><div class="text-[22px] font-bold text-amber-800">${assistDel.toLocaleString()}</div><div class="text-[10px] text-amber-600">Assisted Vaginal Delivery</div></div>`;
    html += `<div class="rounded-xl border border-slate-200 bg-rose-50 p-3"><div class="text-[22px] font-bold text-rose-800">${breachDel.toLocaleString()}</div><div class="text-[10px] text-rose-600">Breach Delivery</div></div>`;
    html += `<div class="rounded-xl border border-slate-200 bg-pink-50 p-3"><div class="text-[22px] font-bold text-pink-800">${caesarianSections.toLocaleString()}</div><div class="text-[10px] text-pink-600">C-Sections</div></div>`;
    html += `<div class="rounded-xl border border-slate-200 bg-cyan-50 p-3"><div class="text-[22px] font-bold text-cyan-800">${cSectionRate}%</div><div class="text-[10px] text-cyan-600">C-Section Rate</div></div>`;
    html += `<div class="rounded-xl border border-slate-200 bg-teal-50 p-3"><div class="text-[22px] font-bold text-teal-800">${babiesAlive.toLocaleString()}</div><div class="text-[10px] text-teal-600">Babies discharged Alive</div></div>`;
    html += `<div class="rounded-xl border border-slate-200 bg-stone-50 p-3"><div class="text-[22px] font-bold text-stone-800">${lowBirthWeight.toLocaleString()}</div><div class="text-[10px] text-stone-600">Low Birth Weight (${lbwRate}%)</div></div>`;
    html += `</div>`;

    const delUids = ["jaPrPmor6WV", "sMqM8DwiAaj", "Kx64gGqaFVq"];
    const hasDelData = delUids.some(
      (uid) => moh711Series[uid] && moh711Series[uid].some((v) => v > 0),
    );
    if (hasDelData && moh711PeriodList.length > 0) {
      const chartId = "mhuMnchDel_" + Date.now();
      html += `<div id="${chartId}" class="rounded-xl border border-slate-200 p-3 mb-4"></div>`;
      chartDefs.push({
        chartId,
        chartType: "donut",
        title: "Delivery Methods (Proportion)",
        items: [
          { name: "Normal Deliveries", y: normalDel },
          { name: "Breach Delivery", y: breachDel },
          { name: "Assisted Vaginal", y: assistDel },
          { name: "C-Sections", y: caesarianSections },
        ],
      });
    }
    html += `</div>`;
  }

  // ── SECTION 2: ANC ──
  const ancUids = ["f9vesk5d4IY", "Fz0LzxMT1vV", "cKr5133RFuN"];
  const hasAncData = ancUids.some((uid) => (moh711Totals[uid] || 0) > 0);
  if (hasAncData) {
    html += `<div class="mb-5"><div class="text-sm font-bold text-slate-700 mb-3">🏥 Antenatal Care (ANC)</div>`;
    html += `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">`;
    html += `<div class="rounded-xl border border-slate-200 bg-violet-50 p-3"><div class="text-[22px] font-bold text-violet-800">${(moh711Totals["f9vesk5d4IY"] || 0).toLocaleString()}</div><div class="text-[10px] text-violet-600">ANC New Visits</div></div>`;
    html += `<div class="rounded-xl border border-slate-200 bg-indigo-50 p-3"><div class="text-[22px] font-bold text-indigo-800">${(moh711Totals["Fz0LzxMT1vV"] || 0).toLocaleString()}</div><div class="text-[10px] text-indigo-600">ANC 4th Visit</div></div>`;
    html += `<div class="rounded-xl border border-slate-200 bg-purple-50 p-3"><div class="text-[22px] font-bold text-purple-800">${(moh711Totals["cKr5133RFuN"] || 0).toLocaleString()}</div><div class="text-[10px] text-purple-600">ANC 8th Visit</div></div>`;
    html += `</div>`;

    const hasAncTrend = ancUids.some(
      (uid) => moh711Series[uid] && moh711Series[uid].some((v) => v > 0),
    );
    if (hasAncTrend && moh711PeriodList.length > 0) {
      const chartId2 = "mhuMnchANC_" + Date.now();
      html += `<div id="${chartId2}" class="rounded-xl border border-slate-200 p-3 mb-4"></div>`;
      chartDefs.push({
        chartId: chartId2,
        title: "ANC Visits (Monthly Trend)",
        uids: ancUids,
        yLabel: "Visits",
      });
    }
    html += `</div>`;
  }

  // ── SECTION 3A: Neonatal Mortality ──
  if (neonatalDeaths > 0) {
    html += `<div class="mb-5"><div class="text-sm font-bold text-slate-700 mb-3">👶 Neonatal Mortality</div>`;
    html += `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">`;
    html += `<div class="rounded-xl border border-slate-200 bg-orange-50 p-3"><div class="text-[22px] font-bold text-orange-800">${neonatalDeaths.toLocaleString()}</div><div class="text-[10px] text-orange-600">Neonatal Deaths (0-28 Days)</div></div>`;
    if (totalDeliveries > 0) {
      const ndr = ((neonatalDeaths / totalDeliveries) * 1000).toFixed(1);
      html += `<div class="rounded-xl border border-slate-200 bg-stone-50 p-3"><div class="text-[22px] font-bold text-stone-800">${ndr}</div><div class="text-[10px] text-stone-600">Neonatal Death Rate (per 1,000 deliveries)</div></div>`;
    }
    const neonatalAudited = moh711Totals["tHRlLvvCObn"] || 0;
    if (neonatalAudited > 0) {
      html += `<div class="rounded-xl border border-slate-200 bg-amber-50 p-3"><div class="text-[22px] font-bold text-amber-800">${neonatalAudited.toLocaleString()}</div><div class="text-[10px] text-amber-600">Neonatal Deaths Audited (7 days)</div></div>`;
    }
    html += `</div>`;

    // Neonatal deaths monthly trend
    if (moh711Series["GAr6xu6f1n7"] && moh711PeriodList.length > 0) {
      const chartIdN = "mhuMnchNeo_" + Date.now();
      html += `<div id="${chartIdN}" class="rounded-xl border border-slate-200 p-3 mb-4"></div>`;
      chartDefs.push({
        chartId: chartIdN,
        title: "Neonatal Deaths 0-28 Days (Monthly Trend)",
        uids: ["GAr6xu6f1n7"],
        yLabel: "Deaths",
      });
    }
    html += `</div>`;
  }

  // ── SECTION 3B: Maternal Mortality ──
  if (maternalDeathTotal > 0) {
    html += `<div class="mb-5"><div class="text-sm font-bold text-slate-700 mb-3">⚠️ Maternal Mortality</div>`;
    html += `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">`;
    html += `<div class="rounded-xl border border-slate-200 bg-red-50 p-3"><div class="text-[22px] font-bold text-red-800">${maternalDeathTotal.toLocaleString()}</div><div class="text-[10px] text-red-600">Maternal Deaths (Total)</div></div>`;
    if (totalDeliveries > 0) {
      const mmr = ((maternalDeathTotal / totalDeliveries) * 100000).toFixed(1);
      html += `<div class="rounded-xl border border-slate-200 bg-slate-50 p-3"><div class="text-[22px] font-bold text-slate-800">${mmr}</div><div class="text-[10px] text-slate-600">Maternal Mortality Ratio (per 100k deliveries)</div></div>`;
    }
    const maternalAudited = moh711Totals["kAp7ViUXEKh"] || 0;
    if (maternalAudited > 0) {
      html += `<div class="rounded-xl border border-slate-200 bg-rose-50 p-3"><div class="text-[22px] font-bold text-rose-800">${maternalAudited.toLocaleString()}</div><div class="text-[10px] text-rose-600">Maternal Deaths Audited (7 days)</div></div>`;
    }
    html += `</div>`;

    // Maternal deaths by age group (donut)
    const matUids = [
      "BYMSIbnUzXQ",
      "AC1Iorxdijc",
      "dPRCstLVkZu",
      "CoAXLBxR0Ik",
    ];
    const hasMatDonut = matUids.some((uid) => (moh711Totals[uid] || 0) > 0);
    if (hasMatDonut) {
      const chartIdM = "mhuMnchMat_" + Date.now();
      html += `<div id="${chartIdM}" class="rounded-xl border border-slate-200 p-3 mb-4"></div>`;
      chartDefs.push({
        chartId: chartIdM,
        chartType: "donut",
        title: "Maternal Deaths by Age Group",
        items: matUids
          .filter((uid) => (moh711Totals[uid] || 0) > 0)
          .map((uid) => ({
            name: WORKLOAD_MOH711_LABELS[uid] || uid,
            y: moh711Totals[uid] || 0,
          })),
      });
    }

    // Maternal deaths monthly trend
    const hasMatTrend = matUids.some(
      (uid) => moh711Series[uid] && moh711Series[uid].some((v) => v > 0),
    );
    if (hasMatTrend && moh711PeriodList.length > 0) {
      const chartIdM2 = "mhuMnchMatTrend_" + Date.now();
      html += `<div id="${chartIdM2}" class="rounded-xl border border-slate-200 p-3 mb-4"></div>`;
      chartDefs.push({
        chartId: chartIdM2,
        title: "Maternal Deaths (Monthly Trend by Age Group)",
        uids: matUids,
        yLabel: "Deaths",
      });
    }
    html += `</div>`;
  }

  // ── SECTION 4: Individual Charts ──
  if (
    breachDel > 0 &&
    moh711Series["sMqM8DwiAaj"] &&
    moh711PeriodList.length > 0
  ) {
    const chartIdB = "mhuMnchBreach_" + Date.now();
    html += `<div class="mb-5"><div class="text-sm font-bold text-slate-700 mb-3">📊 Breach Delivery</div><div id="${chartIdB}" class="rounded-xl border border-slate-200 p-3"></div></div>`;
    chartDefs.push({
      chartId: chartIdB,
      title: "Breach Delivery (Monthly Trend)",
      uids: ["sMqM8DwiAaj"],
      yLabel: "Count",
    });
  }
  if (
    assistDel > 0 &&
    moh711Series["Kx64gGqaFVq"] &&
    moh711PeriodList.length > 0
  ) {
    const chartIdA = "mhuMnchAVD_" + Date.now();
    html += `<div class="mb-5"><div class="text-sm font-bold text-slate-700 mb-3">📊 Assisted Vaginal Delivery</div><div id="${chartIdA}" class="rounded-xl border border-slate-200 p-3"></div></div>`;
    chartDefs.push({
      chartId: chartIdA,
      title: "Assisted Vaginal Delivery (Monthly Trend)",
      uids: ["Kx64gGqaFVq"],
      yLabel: "Count",
    });
  }

  // ── Write ALL HTML ──
  container.innerHTML = html;

  // ── Render deferred charts (mixed types) ──
  for (const def of chartDefs) {
    if (def.chartType === "donut") {
      // Donut chart: data is array of { name, y } objects
      const donutData = def.items
        .filter((item) => item.y > 0)
        .map((item) => ({ name: item.name, y: item.y }));
      renderHighchartDonut(def.chartId, def.title, donutData);
    } else if (def.chartType === "line") {
      // Line chart
      const seriesData = def.uids
        .filter((uid) => (moh711Totals[uid] || 0) > 0)
        .map((uid) => ({
          name: WORKLOAD_MOH711_LABELS[uid] || uid,
          data: moh711Series[uid] || [],
        }));
      renderHighchartLine(
        def.chartId,
        def.title,
        seriesData,
        moh711PeriodList,
        def.yLabel,
      );
    } else {
      // Bar chart (default)
      const seriesData = def.uids
        .filter((uid) => (moh711Totals[uid] || 0) > 0)
        .map((uid) => ({
          name: WORKLOAD_MOH711_LABELS[uid] || uid,
          data: moh711Series[uid] || [],
        }));
      renderHighchartBar(
        def.chartId,
        def.title,
        seriesData,
        moh711PeriodList,
        def.yLabel,
      );
    }
  }
}

// ── MNCH empty fallback ──────────────────────────────────────────────
function renderMhuMnchEmpty(container, facilityName) {
  container.innerHTML = `
    <div class="mb-4">
      <div class="text-sm font-bold text-slate-700">${escapeHtml(facilityName)}</div>
      <div class="text-[11px] text-slate-400">MNCH · No data</div>
    </div>
    <div class="flex flex-col items-center justify-center py-14 text-sm text-slate-400">
      <svg class="mb-3 h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div class="font-semibold text-slate-500">No MOH 711 MNCH data available</div>
    </div>`;
}

// ── HIV DASHBOARD tab — CHAK DHIS UIDs ──────────────────────────
// Data elements from CHAK DHIS (MER/C&T & MOH 731 compatible)
const HIV_UIDS = [
  "aMp82zBYPnx", // CHAK: TX_CURR Patients on Care (was: HV01-01)
  "yVSPslVCpu3", // HV01-07 Total Revisit on ART
  "MQF59FTGl7N", // HV01-04 Total Starting on ART
  "iZHADd1svrB", // HV01-10 Total Ever on ART
  "QJX1IYymTwR", // HV01-11 Total Enrolled in Care
  "PLOzPReieli", // HV01-12 Total Currently in Care
  "RHyfJDq4FsT", // CHAK: TB_ICF OPD Screened for TB (was: HV04-01)
  "pDoW8tq74Co", // HV01-14 Current on ART Female 15+
  "KMWQGDpqPcJ", // HV01-13 Current on ART Male 15+
  "FmEfFpTP1Tu", // HV01-15 Current on ART Male <15
  "lOyMumfLe7d", // HV01-16 Current on ART Female <15
  "ezNx1i74mpa", // HV01-17 Starting ART Male 15+
  "TJxRQq9K8jl", // HV01-18 Starting ART Female 15+
  "CcOr3MB7Mh4", // HV01-19 Starting ART Pregnant
  "imgvJzyf6ww", // HV01-08 Revisit on ART Male 15+
  "BPFYXYonMWF", // HV01-09 Revisit on ART Female 15+
  "BdbVjZPWvYP", // CHAK: TB_ICF CCC Started on IPT (was: Starting IPT)
];

// Friendly labels for the CHAK UIDs
const HIV_LABELS = {
  aMp82zBYPnx: "TX_CURR Patients on Care (ART)",
  yVSPslVCpu3: "Total Revisit on ART",
  MQF59FTGl7N: "Total Starting on ART",
  iZHADd1svrB: "Total Ever on ART",
  QJX1IYymTwR: "Total Enrolled in Care",
  PLOzPReieli: "HIV Currently in Care (Total)",
  RHyfJDq4FsT: "TB Screened (OPD ICF)",
  pDoW8tq74Co: "Current on ART (Female 15+)",
  KMWQGDpqPcJ: "Current on ART (Male 15+)",
  FmEfFpTP1Tu: "Current on ART (Male <15)",
  lOyMumfLe7d: "Current on ART (Female <15)",
  ezNx1i74mpa: "Male 15+ Starting on ART",
  TJxRQq9K8jl: "Female 15+ Starting on ART",
  CcOr3MB7Mh4: "Pregnant Starting on ART",
  imgvJzyf6ww: "Male 15+ Revisit on ART",
  BPFYXYonMWF: "Female 15+ Revisit on ART",
  BdbVjZPWvYP: "Started on IPT (CCC)",
};

async function renderMhuHivDashboard(container, facilityName, ouId) {
  // Look up the CHAK OU ID by facility name (CHAK uses different OU IDs than KHIS)
  let chakOuId = ouId;
  try {
    const lookupResp = await fetch(
      `/api/mhu/chak-ou-lookup?name=${encodeURIComponent(facilityName)}`,
    );
    if (lookupResp.ok) {
      const lookupResult = await lookupResp.json();
      if (lookupResult && lookupResult.uid) {
        chakOuId = lookupResult.uid;
      }
    }
  } catch (e) {
    // fallback: use passed ouId (might be wrong but try anyway)
  }

  const dxStr = HIV_UIDS.join(";");

  try {
    // Use CHAK DHIS endpoint (not KHIS)
    const resp = await fetch(
      `/api/mhu/chak-data?dx=${encodeURIComponent(dxStr)}&ou=${encodeURIComponent(chakOuId)}&pe=LAST_12_MONTHS`,
    );
    if (!resp.ok) throw new Error(`API returned ${resp.status}`);
    const result = await resp.json();
    const data = result.data || {};

    const subtitleHtml = `<div class="text-[11px] text-slate-400">HIV Dashboard · CHAK DHIS (MER/C&T)</div>`;

    if (Object.keys(data).length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-14 text-sm text-slate-400">
          <div class="font-semibold text-slate-500">No HIV data available</div>
          <div class="mt-1 text-xs max-w-md text-center">CHAK DHIS returned no HIV records for this facility. It may not report MOH 731 HIV data.</div>
        </div>`;
      return;
    }

    // Parse into per-DE time series
    const parsed = [];
    const allPeriods = new Set();
    for (const uid of HIV_UIDS) {
      const dxData = data[uid];
      if (!dxData) continue;
      const periods = Object.keys(dxData).sort(sortPeriodLabels);
      const values = periods.map((p) => parseFloat(dxData[p]) || 0);
      const total = values.reduce((a, b) => a + b, 0);
      periods.forEach((p) => allPeriods.add(p));
      parsed.push({
        id: uid,
        name: HIV_LABELS[uid] || uid,
        periods,
        values,
        total,
      });
    }

    const sortedPeriods = Array.from(allPeriods).sort(sortPeriodLabels);

    // Compute derived KPIs (CHAK DHIS UIDs)
    const totalOnArt = findValue(parsed, "aMp82zBYPnx");
    const totalStarting = findValue(parsed, "MQF59FTGl7N");
    const totalEver = findValue(parsed, "iZHADd1svrB");
    const totalRevisit = findValue(parsed, "yVSPslVCpu3");
    const totalEnrolled = findValue(parsed, "QJX1IYymTwR");
    const totalScreenedTb = findValue(parsed, "RHyfJDq4FsT");

    // Current on ART by sex
    const currFemale15 = findValue(parsed, "pDoW8tq74Co");
    const currMale15 = findValue(parsed, "KMWQGDpqPcJ");
    const currMaleChild = findValue(parsed, "FmEfFpTP1Tu");
    const currFemaleChild = findValue(parsed, "lOyMumfLe7d");
    const totalCurrBreakdown =
      currMale15 + currFemale15 + currMaleChild + currFemaleChild;

    // Starting on ART by sex
    const maleStart = findValue(parsed, "ezNx1i74mpa");
    const femaleStart = findValue(parsed, "TJxRQq9K8jl");
    const pregnantStart = findValue(parsed, "CcOr3MB7Mh4");
    const totalNewStart = maleStart + femaleStart + pregnantStart;

    // IPT (CHAK DHIS — disaggregated by OPD/IPD)
    const iptTotal = findValue(parsed, "BdbVjZPWvYP");
    const iptMale = 0;
    const iptFemale = 0;

    let html = `
      <div class="mb-4">
        <div class="text-sm font-bold text-slate-700">${escapeHtml(facilityName)}</div>
        ${subtitleHtml}
      </div>

      <!-- KPI Cards (6) -->
      <div class="mb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div class="rounded-xl border border-violet-200 bg-violet-50 p-3">
          <div class="text-[20px] font-bold text-violet-800">${totalOnArt.toLocaleString()}</div>
          <div class="text-[10px] text-violet-600 leading-tight">Current on ART</div>
        </div>
        <div class="rounded-xl border border-sky-200 bg-sky-50 p-3">
          <div class="text-[20px] font-bold text-sky-800">${totalStarting.toLocaleString()}</div>
          <div class="text-[10px] text-sky-600 leading-tight">Starting on ART</div>
        </div>
        <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div class="text-[20px] font-bold text-emerald-800">${totalRevisit.toLocaleString()}</div>
          <div class="text-[10px] text-emerald-600 leading-tight">Revisit on ART</div>
        </div>
        <div class="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
          <div class="text-[20px] font-bold text-cyan-800">${totalEnrolled.toLocaleString()}</div>
          <div class="text-[10px] text-cyan-600 leading-tight">Enrolled in Care</div>
        </div>
        <div class="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <div class="text-[20px] font-bold text-rose-800">${totalEver.toLocaleString()}</div>
          <div class="text-[10px] text-rose-600 leading-tight">Ever on ART</div>
        </div>
        <div class="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div class="text-[20px] font-bold text-amber-800">${totalScreenedTb.toLocaleString()}</div>
          <div class="text-[10px] text-amber-600 leading-tight">Screened for TB</div>
        </div>
      </div>
    `;

    // Trend chart
    if (parsed.length >= 2 && sortedPeriods.length > 0) {
      html += `<div class="mb-5"><div id="hivTrendChart" class="rounded-xl border border-slate-200 p-3"></div></div>`;
    }

    // Breakdown charts (side by side)
    const hasPieData = totalCurrBreakdown > 0 || totalNewStart > 0;
    if (hasPieData) {
      html += `<div class="mb-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div id="hivCurrChart" class="rounded-xl border border-slate-200 p-3"></div>
        <div id="hivStartChart" class="rounded-xl border border-slate-200 p-3"></div>
      </div>`;
    }

    // IPT + TB summary cards
    if (iptTotal > 0) {
      html += `<div class="mb-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div id="hivIptChart" class="rounded-xl border border-slate-200 p-3"></div>
        <div id="hivRevisitChart" class="rounded-xl border border-slate-200 p-3"></div>
      </div>`;
    }

    // Full data table
    html += `<div class="overflow-x-auto rounded-xl border border-slate-200 mt-4">
      <div class="p-3 text-xs font-semibold text-slate-700">📋 HIV Indicators — Monthly Values</div>
      <table class="w-full text-left text-[12px]">
        <thead><tr class="bg-slate-100 text-slate-600">
          <th class="px-3 py-2 font-semibold">Indicator</th>`;
    for (const m of sortedPeriods)
      html += `<th class="px-3 py-2 font-semibold text-right">${escapeHtml(m)}</th>`;
    html += `<th class="px-3 py-2 font-semibold text-right">Total</th></tr></thead><tbody>`;
    for (const item of parsed) {
      html += `<tr class="border-t border-slate-100 hover:bg-slate-50">`;
      html += `<td class="px-3 py-1.5 font-medium text-slate-700">${escapeHtml(item.name)}</td>`;
      for (const v of item.values)
        html += `<td class="px-3 py-1.5 text-right text-slate-600">${v.toLocaleString()}</td>`;
      html += `<td class="px-3 py-1.5 text-right font-semibold text-slate-800">${item.total.toLocaleString()}</td>`;
      html += `</tr>`;
    }
    html += `</tbody></table></div>`;

    container.innerHTML = html;

    // ── Trend chart ──
    if (parsed.length >= 2 && sortedPeriods.length > 0) {
      const trendUids = [
        "aMp82zBYPnx",
        "yVSPslVCpu3",
        "MQF59FTGl7N",
        "RHyfJDq4FsT",
      ];
      const trendItems = [];
      for (const uid of trendUids) {
        const item = parsed.find((p) => p.id === uid);
        if (item) {
          trendItems.push({
            name: HIV_LABELS[uid] || uid,
            data: item.values,
          });
        }
      }
      if (trendItems.length >= 2) {
        renderHighchartLine(
          "hivTrendChart",
          "HIV Indicators — Monthly Trend (CHAK DHIS)",
          trendItems,
          sortedPeriods,
          "Patients",
        );
      }
    }

    // ── Current on ART by sex/age (donut) ──
    if (totalCurrBreakdown > 0) {
      Highcharts.chart("hivCurrChart", {
        chart: { type: "pie" },
        title: { text: "Current on ART by Sex/Age" },
        tooltip: { pointFormat: "<b>{point.y}</b> ({point.percentage:.1f}%)" },
        plotOptions: {
          pie: {
            innerSize: "50%",
            allowPointSelect: true,
            cursor: "pointer",
            dataLabels: {
              enabled: true,
              format: "<b>{point.name}</b>: {point.y}",
            },
          },
        },
        series: [
          {
            name: "Patients",
            colorByPoint: true,
            data: [
              { name: "Male 15+", y: currMale15, color: "#2563eb" },
              { name: "Female 15+", y: currFemale15, color: "#ec4899" },
              { name: "Male <15", y: currMaleChild, color: "#60a5fa" },
              { name: "Female <15", y: currFemaleChild, color: "#f472b6" },
            ].filter((d) => d.y > 0),
          },
        ],
        credits: { enabled: false },
      });
    }

    // ── Starting on ART breakdown (column) ──
    if (totalNewStart > 0) {
      Highcharts.chart("hivStartChart", {
        chart: { type: "column" },
        title: { text: "Starting on ART by Sex" },
        xAxis: { categories: ["New on ART"] },
        yAxis: { title: { text: "Patients" }, allowDecimals: false },
        tooltip: { pointFormat: "{series.name}: <b>{point.y}</b>" },
        plotOptions: { column: { stacking: "normal" } },
        series: [
          { name: "Male 15+", data: [maleStart], color: "#2563eb" },
          { name: "Female 15+", data: [femaleStart], color: "#ec4899" },
          { name: "Pregnant", data: [pregnantStart], color: "#f59e0b" },
        ].filter((s) => s.data[0] > 0),
        credits: { enabled: false },
      });
    }

    // ── IPT (single bar with total) ──
    if (iptTotal > 0) {
      Highcharts.chart("hivIptChart", {
        chart: { type: "column" },
        title: { text: "Isoniazid Preventive Therapy (IPT)" },
        xAxis: { categories: ["Started on IPT"] },
        yAxis: { title: { text: "Patients" }, allowDecimals: false },
        tooltip: { pointFormat: "{series.name}: <b>{point.y}</b>" },
        plotOptions: { column: { stacking: "normal" } },
        series: [
          { name: "Total Started IPT", data: [iptTotal], color: "#8b5cf6" },
        ],
        credits: { enabled: false },
      });

      // ── Revisit on ART by sex ──
      const revisitMale = findValue(parsed, "imgvJzyf6ww");
      const revisitFemale = findValue(parsed, "BPFYXYonMWF");
      Highcharts.chart("hivRevisitChart", {
        chart: { type: "column" },
        title: { text: "Revisit on ART by Sex" },
        xAxis: { categories: ["Revisit on ART"] },
        yAxis: { title: { text: "Patients" }, allowDecimals: false },
        tooltip: { pointFormat: "{series.name}: <b>{point.y}</b>" },
        plotOptions: { column: { stacking: "normal" } },
        series: [
          { name: "Male 15+", data: [revisitMale], color: "#2563eb" },
          { name: "Female 15+", data: [revisitFemale], color: "#ec4899" },
        ].filter((s) => s.data[0] > 0),
        credits: { enabled: false },
      });
    }
  } catch (err) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-14 text-sm text-red-400">
        <div class="font-semibold text-red-500">Error loading HIV data</div>
        <div class="mt-1 text-xs">${escapeHtml(err.message)}</div>
      </div>`;
  }
}

function findValue(parsed, uid) {
  const item = parsed.find((p) => p.id === uid);
  return item ? item.total : 0;
}

function sortPeriodLabels(a, b) {
  // Sort "July 2025"-style month labels chronologically
  const MONTHS = {
    January: 1,
    February: 2,
    March: 3,
    April: 4,
    May: 5,
    June: 6,
    July: 7,
    August: 8,
    September: 9,
    October: 10,
    November: 11,
    December: 12,
  };
  const pa = a.split(" ");
  const pb = b.split(" ");
  if (pa.length >= 2 && pb.length >= 2 && MONTHS[pa[0]] && MONTHS[pb[0]]) {
    const ya = parseInt(pa[1]) || 0,
      yb = parseInt(pb[1]) || 0;
    return ya !== yb ? ya - yb : MONTHS[pa[0]] - MONTHS[pb[0]];
  }
  return a.localeCompare(b);
}

// ── Generic tab renderer: summary KPIs + trend line chart + table ────
function renderMhuGenericTab(
  container,
  data,
  tabElements,
  facilityName,
  tabTitle,
) {
  const parsed = parseMhuTimeSeries(data, tabElements);
  const periods = parsed.length > 0 ? parsed[0].periods : [];
  const sortByTotal = (arr) => arr.sort((a, b) => b.total - a.total);
  sortByTotal(parsed);

  let html = `
    <div class="mb-4">
      <div class="text-sm font-bold text-slate-700">${escapeHtml(facilityName)}</div>
      <div class="text-[11px] text-slate-400">${escapeHtml(tabTitle)} · Last 12 months</div>
    </div>
  `;

  // KPI cards for top 6
  if (parsed.length > 0) {
    const top = parsed.slice(0, 6);
    html += `<div class="mb-5 grid grid-cols-2 sm:grid-cols-3 gap-2">`;
    for (const item of top) {
      html += `
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div class="text-[18px] font-bold text-slate-800">${item.total.toLocaleString()}</div>
          <div class="text-[10px] text-slate-500 leading-tight mt-0.5">${escapeHtml(item.name.replace(/^MOH 717[^_]*_/, "").replace(/Rev2020_/, ""))}</div>
        </div>
      `;
    }
    html += `</div>`;

    // Trend chart for top 8
    if (parsed.length >= 2 && periods.length > 0) {
      const top8 = parsed.slice(0, 8);
      html += `<div class="mb-5"><div id="mhuGenericChart" class="rounded-xl border border-slate-200 p-3"></div></div>`;
    }

    // Full table
    html += `<div class="overflow-x-auto rounded-xl border border-slate-200 mt-4">
      <table class="w-full text-left text-[12px]">
        <thead><tr class="bg-slate-100 text-slate-600">`;
    html += `<th class="px-3 py-2 font-semibold">Indicator</th>`;
    const months = periods.slice(-6);
    for (const m of months)
      html += `<th class="px-3 py-2 font-semibold text-right">${escapeHtml(m)}</th>`;
    html += `<th class="px-3 py-2 font-semibold text-right">Total</th></tr></thead><tbody>`;
    for (const item of parsed) {
      html += `<tr class="border-t border-slate-100 hover:bg-slate-50">`;
      html += `<td class="px-3 py-1.5 font-medium text-slate-700">${escapeHtml(item.name.replace(/^MOH 717[^_]*_/, "").replace(/Rev2020_/, ""))}</td>`;
      const lastVals = item.values.slice(-6);
      for (const v of lastVals)
        html += `<td class="px-3 py-1.5 text-right text-slate-600">${v.toLocaleString()}</td>`;
      html += `<td class="px-3 py-1.5 text-right font-semibold text-slate-800">${item.total.toLocaleString()}</td>`;
      html += `</tr>`;
    }
    html += `</tbody></table></div>`;
  }

  container.innerHTML = html;

  // Render trend chart
  if (parsed.length >= 2 && periods.length > 0) {
    const top8 = parsed.slice(0, 8);
    renderHighchartLine(
      "mhuGenericChart",
      tabTitle + " (Monthly Trend)",
      top8.map((item) => ({
        name: item.name.replace(/^MOH 717[^_]*_/, "").replace(/Rev2020_/, ""),
        data: item.values,
      })),
      periods,
      "Count",
    );
  }
}

// ── Generic table fallback ────────────────────────────────────────────
function renderMhuGenericTable(
  container,
  data,
  tabElements,
  facilityName,
  tabLabel,
) {
  const parsed = parseMhuTimeSeries(data, tabElements);
  const periods = parsed.length > 0 ? parsed[0].periods : [];
  const sortByTotal = (arr) => arr.sort((a, b) => b.total - a.total);
  sortByTotal(parsed);

  let html = `
    <div class="mb-4">
      <div class="text-sm font-bold text-slate-700">${escapeHtml(facilityName)}</div>
      <div class="text-[11px] text-slate-400">${escapeHtml(tabLabel)} · Last 12 months</div>
    </div>
  `;

  if (parsed.length === 0) {
    html += `<div class="py-8 text-center text-sm text-slate-400">No data available</div>`;
  } else {
    html += `<div class="overflow-x-auto rounded-xl border border-slate-200">
      <table class="w-full text-left text-[12px]">
        <thead><tr class="bg-slate-100 text-slate-600">`;
    html += `<th class="px-3 py-2 font-semibold">Indicator</th>`;
    const months = periods.slice(-6);
    for (const m of months)
      html += `<th class="px-3 py-2 font-semibold text-right">${escapeHtml(m)}</th>`;
    html += `<th class="px-3 py-2 font-semibold text-right">Total</th></tr></thead><tbody>`;
    for (const item of parsed) {
      html += `<tr class="border-t border-slate-100 hover:bg-slate-50">`;
      html += `<td class="px-3 py-1.5 font-medium text-slate-700">${escapeHtml(item.name.replace(/^MOH 717[^_]*_/, "").replace(/Rev2020_/, ""))}</td>`;
      const lastVals = item.values.slice(-6);
      for (const v of lastVals)
        html += `<td class="px-3 py-1.5 text-right text-slate-600">${v.toLocaleString()}</td>`;
      html += `<td class="px-3 py-1.5 text-right font-semibold text-slate-800">${item.total.toLocaleString()}</td>`;
      html += `</tr>`;
    }
    html += `</tbody></table></div>`;
  }

  container.innerHTML = html;
}

