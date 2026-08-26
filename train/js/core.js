// ============================================================
// core.js  (extracted from main.js lines 1-1176)
// domain section 1-1176
// ============================================================
const state = {
  rawData: [],
  filteredData: [],
  catalog: null,
  facilityPage: null,
  activePage: "overview",
  activeProject: "",
  facilityFilter: "all",
  locationHierarchy: null,
  countyFilter: "all",
  subCountyFilter: "all",
  projectFilter: "all",
  periodFilter: "all",
  activeSubtabs: {},
  activeDatasetId: "",
  activeDashboardId: "",
  activeChakSubproject: "",
  activeMhuSubtab: "WORKLOAD",
  playgroundMode: "finance",
  playgroundChart: null,
  playgroundFinanceData: null,
  jtCounties: [],
  jtSubcounties: [],
  jtSubcountyMap: {},
  jtFacilityNames: [],
  jtFacilityIds: [],
  jtFacilityIdNameMap: {},
  jtFacilitiesBySubcounty: {},
};

// ── CHAK DHIS2 Project Configuration ──
const CHAK_PROJECTS = Object.assign({}, window.PROJECT_CONFIGS || {});

// Flatten: get all chak project codes and ids for quick lookup
const CHAK_PROJECT_CODES = {};
const CHAK_PROJECT_IDS = {};
Object.values(CHAK_PROJECTS).forEach(function (p) {
  CHAK_PROJECT_CODES[p.code] = p.id;
  CHAK_PROJECT_IDS[p.id] = p;
});

// Build dataset-id → project lookup
const CHAK_DATASET_TO_PROJECT = {};
Object.values(CHAK_PROJECTS).forEach(function (p) {
  p.datasets.forEach(function (ds) {
    CHAK_DATASET_TO_PROJECT[ds.id] = p.id;
  });
  (p.subprojects || []).forEach(function (sp) {
    (sp.datasets || []).forEach(function (ds) {
      CHAK_DATASET_TO_PROJECT[ds.id] = p.id;
    });
  });
});

function isChakProject() {
  return state.activeProject && !!CHAK_PROJECT_IDS[state.activeProject];
}

function getActiveChakProject() {
  return CHAK_PROJECT_IDS[state.activeProject] || null;
}

const tailwindConfig = {
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 18px 40px rgba(10, 102, 194, 0.12)",
      },
      colors: {
        ink: "#0f172a",
        surface: "#f3f6f9",
      },
    },
  },
};

const elements = {};

document.addEventListener("DOMContentLoaded", async () => {
  setupTailwindRuntime();
  bindElements();
  bindChatControls();
  bindHeaderNavLinks();
  bindFilterControls();
  applyHashRoute();
  window.addEventListener("hashchange", () => {
    applyHashRoute();
    renderCurrentView();
  });
  await loadDashboardData();
  // renderCurrentView() is already called inside loadDashboardData
});

function applyHashRoute() {
  const hash = String(window.location.hash || "").replace(/^#\/?/, "");
  if (!hash) return;
  const parts = hash.split("/").filter(Boolean);
  if (!parts.length) return;

  // Build project map: jamii_tekelezi + all CHAK projects
  const projectMap = { jm: "jamii_tekelezi" };
  Object.keys(CHAK_PROJECT_CODES).forEach(function (code) {
    projectMap[code] = CHAK_PROJECT_CODES[code];
  });
  // Backward-compatible alias: old BfW code "bw" → BFTW RMNCAH
  projectMap["bw"] = "bftw_rmncah";
  let pageId, subtabSlug;

  if (parts[0] === "p" && parts.length >= 2 && projectMap[parts[1]]) {
    const projectCode = parts[1];
    state.activeProject = projectMap[projectCode];
    pageId = parts[2] || "overview";
    subtabSlug = parts[3] || "";
  } else {
    state.activeProject = "";
    pageId = parts[0];
    subtabSlug = parts[1] || "";
  }

  const validPages = new Set([
    "overview",
    "playground",
    "health_programmes",
    "human_resource",
    "cbsl",
    "reporting_rates",
    "hiv_testing",
    "hiv_treatment",
    "profile",
    "prep_page",
    "pmtct",
    "tb",
    "post_rape",
    "cacx",
    "linkage",
    "service_desk",
    "resources",
    "case_surveillance",
    "facilities",
    "indicators",
    "jamii",
    "all",
    // CHAK dataset detail pages
    "chak_dataset",
    // CHAK dashboard detail pages
    "chak_dashboard",
  ]);
  if (!validPages.has(pageId)) return;

  state.activePage = pageId;

  // If navigating to CHAK dataset page, treat subtabSlug as dataset ID (URI-decoded)
  if (pageId === "chak_dataset" && subtabSlug) {
    state.activeDatasetId = decodeURIComponent(subtabSlug);
  }
  // If navigating to CHAK dashboard page, treat subtabSlug as dashboard ID (URI-decoded)
  if (pageId === "chak_dashboard" && subtabSlug) {
    state.activeDashboardId = decodeURIComponent(subtabSlug);
  }

  const meta = getPageMeta(pageId);
  if (subtabSlug) {
    state.activeSubtabs[pageId] = subtabSlug;
  } else if (meta.subtabs && meta.subtabs.length) {
    state.activeSubtabs[pageId] =
      state.activeSubtabs[pageId] || toSlug(meta.subtabs[0]);
  }
}

function toSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getProjectHashPrefix() {
  if (state.activeProject === "jamii_tekelezi") return "p/jm/";
  var chakProj = getActiveChakProject();
  if (chakProj) return "p/" + chakProj.code + "/";
  return "";
}

function setPageHash(pageId, subtabLabel = "") {
  const sub = subtabLabel ? `/${toSlug(subtabLabel)}` : "";
  const projectPrefix = getProjectHashPrefix();
  const next = `#/${projectPrefix}${pageId}${sub}`;
  if (window.location.hash !== next) {
    window.location.hash = next;
  }
}

function scrollToPageTop() {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "instant" in window ? "instant" : "auto",
  });
}

// ── Get subtabs filtered for current context (Jamii Tekelezi vs global) ──
function getSubtabsForPage(pageId) {
  const meta = getPageMeta(pageId);
  let subtabs = Array.isArray(meta.subtabs) ? meta.subtabs : [];
  if (state.activeProject === "jamii_tekelezi" && pageId === "hiv_treatment") {
    const exclude = new Set(["otz", "ovc", "covid-19", "care-treatment"]);
    subtabs = subtabs.filter(function (s) {
      return !exclude.has(toSlug(s));
    });
  }
  return subtabs;
}

function bindHeaderNavLinks() {
  try {
    const headerLinks = Array.from(document.querySelectorAll("header a"));
    if (!headerLinks.length) return;

    headerLinks.forEach((a) => {
      const text = (a.textContent || a.innerText || "").trim();
      if (!text) return;
      const map = {
        Home: "overview",
        "Reporting Rates": "reporting_rates",
        "HIV Testing & Prevention": "hiv_testing",
        "HIV Treatment": "hiv_treatment",
        Profile: "profile",
        PrEP: "prep_page",
        PMTCT: "pmtct",
        TB: "tb",
        "Post ResP": "post_rape",
        CACX: "cacx",
        "Service Desk": "service_desk",
        Resources: "resources",
        "Case Surveillance Dashboard": "case_surveillance",
        Facilities: "facilities",
        Indicators: "indicators",
        "All Charts": "all",
      };

      const pageId = map[text];
      if (!pageId) return;

      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        state.activePage = pageId;
        const meta = getPageMeta(pageId);
        if (meta.subtabs && meta.subtabs.length) {
          if (!state.activeSubtabs[pageId]) {
            state.activeSubtabs[pageId] = toSlug(meta.subtabs[0]);
          }
          setPageHash(pageId, state.activeSubtabs[pageId]);
        } else {
          setPageHash(pageId);
        }
        renderCurrentView();
        headerLinks.forEach(
          (ln) => ln.classList && ln.classList.remove("active"),
        );
        a.classList && a.classList.add("active");
      });
    });
  } catch (e) {
    // silent
  }
}

function setupTailwindRuntime() {
  window.tailwind = window.tailwind || {};
  window.tailwind.config = tailwindConfig;

  if (!document.querySelector("script[data-tailwind-runtime]")) {
    const script = document.createElement("script");
    script.dataset.tailwindRuntime = "true";
    script.src = "https://cdn.tailwindcss.com";
    script.async = true;
    document.head.appendChild(script);
  }
}

function bindElements() {
  elements.chartRoot = document.getElementById("chart");
  elements.pageTabs = document.getElementById("pageTabs");
  elements.pageContextBar = document.getElementById("pageContextBar");
  elements.pageBreadcrumb = document.getElementById("pageBreadcrumb");
  elements.pageSublinks = document.getElementById("pageSublinks");
  elements.countyFilter = document.getElementById("countyFilter");
  elements.subCountyFilter = document.getElementById("subCountyFilter");
  elements.facilityFilter = document.getElementById("facilityFilter");
  elements.projectFilter = document.getElementById("projectFilter");
  elements.periodFilter = document.getElementById("periodFilter");
  elements.periodSelector = document.getElementById("periodSelector");
  elements.resetFilters = document.getElementById("resetFilters");
  elements.aiFab = document.getElementById("aiFab");
  elements.chatOverlay = document.getElementById("chatOverlay");
  elements.chatModal = document.getElementById("chatModal");
  elements.closeChat = document.getElementById("closeChat");
  elements.chatForm = document.getElementById("chatForm");
  elements.chatInput = document.getElementById("chatInput");
  elements.chatMessages = document.getElementById("chatMessages");
}

function getPageMeta(pageId) {
  const pages = {
    health_programmes: {
      title: "Health Programmes",
      subtabs: ["MHU", "Projects"],
    },
    human_resource: { title: "Human Resource", subtabs: ["Overview"] },
    cbsl: { title: "CBSL", subtabs: ["Overview"] },
    hiv_testing: {
      title: "HIV Testing & Prevention",
      subtabs: [
        "Overview",
        "HIV TESTING SERVICES UPTAKE",
        "HIV TESTING SERVICES LINKAGE",
        "PARTNER NOTIFICATION SERVICES",
        "HTS Performance",
        "HTS Index Testing",
        "SNS Cascade",
        "HTS Summary",
        "Testing Modality",
      ],
    },
    reporting_rates: { title: "Reporting Rates", subtabs: ["Overview"] },
    hiv_treatment: {
      title: "HIV Treatment",
      subtabs: [
        "Overview",
        "Newly Started on ART",
        "Current on ART",
        "ART Optimization",
        "Adverse Events - AE",
        "DSD",
        "VL Monitoring",
        "Treatment Outcomes",
        "OTZ",
        "OVC",
        "COVID-19",
        "AHD",
        "Key Indicators",
        "Care & Treatment",
        "CD4/TPT Uptake",
        "Viral Load Cascade",
        "IIT Quarterly",
      ],
    },
    profile: {
      title: "Profile",
      subtabs: ["Overview"],
    },
    prep_page: {
      title: "PrEP",
      subtabs: ["Overview"],
    },
    pmtct: {
      title: "PMTCT",
      subtabs: ["Overview"],
    },
    tb: {
      title: "TB",
      subtabs: ["Overview"],
    },
    post_rape: {
      title: "Post ResP",
      subtabs: ["Overview"],
    },
    cacx: {
      title: "CACX",
      subtabs: ["Overview"],
    },
    linkage: {
      title: "Linkage",
      subtabs: ["Overview"],
    },
    service_desk: { title: "Service Desk", subtabs: ["Overview"] },
    resources: { title: "Resources", subtabs: ["Overview"] },
    case_surveillance: {
      title: "Case Surveillance Dashboard",
      subtabs: ["Overview"],
    },
    facilities: { title: "Facilities", subtabs: ["Overview"] },
    indicators: { title: "Indicators", subtabs: ["Overview"] },
    all: { title: "All Charts", subtabs: ["Overview"] },
    financial_analysis: {
      title: "Financial Analysis",
      subtabs: [
        "Overview",
        "Budget Analysis",
        "Indicator Performance",
        "Health Summary",
        "Narratives",
      ],
    },
    playground: { title: "Playground", subtabs: [] },
    jamii: {
      title: "Jamii Tekelezi",
      subtabs: [
        "Overview",
        "TX_CURR Analytics",
        "Programme Highlights",
        "Workload & MHU",
      ],
    },
    overview: { title: "Home", subtabs: [] },
  };
  return pages[pageId] || { title: pageId, subtabs: ["Overview"] };
}

function hidePageContext() {
  if (!elements.pageContextBar) return;
  elements.pageContextBar.classList.add("hidden");
  if (elements.pageBreadcrumb) elements.pageBreadcrumb.innerHTML = "";
  if (elements.pageSublinks) elements.pageSublinks.innerHTML = "";
}

function renderPageContext(pageId) {
  const meta = getPageMeta(pageId);
  if (
    !elements.pageContextBar ||
    !elements.pageBreadcrumb ||
    !elements.pageSublinks
  )
    return;

  var subtabs = getSubtabsForPage(pageId);
  if (subtabs.length && !state.activeSubtabs[pageId]) {
    state.activeSubtabs[pageId] = toSlug(subtabs[0]);
  }

  // ── Project context mode (e.g., inside Jamii Tekelezi) ──
  if (state.activeProject === "jamii_tekelezi") {
    elements.pageContextBar.classList.remove("hidden");
    const activeSlug = state.activeSubtabs[pageId] || toSlug(subtabs[0] || "");
    const activeLabel =
      subtabs.find((s) => toSlug(s) === activeSlug) || subtabs[0] || "";
    elements.pageBreadcrumb.innerHTML = `
      <div class="flex items-center gap-2 text-[12px] text-slate-500">
        <button id="exitProjectBtn" class="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-[12px] font-medium text-sky-700 hover:bg-sky-100 transition">
          ← Back to Projects
        </button>
        <span class="text-slate-300">|</span>
        <span class="font-semibold text-sky-700">🏥 Jamii Tekelezi</span>
        <span class="text-slate-400">/</span>
        <span>${escapeHtml(meta.title)}${activeLabel ? " / " + escapeHtml(activeLabel) : ""}</span>
      </div>
    `;
    const exitBtn = document.getElementById("exitProjectBtn");
    if (exitBtn) {
      exitBtn.addEventListener("click", () => {
        state.activeProject = "";
        state.activePage = "health_programmes";
        state.activeSubtabs["health_programmes"] = "projects";
        if (elements.projectFilter) elements.projectFilter.value = "all";
        setPageHash("health_programmes", "projects");
        renderCurrentView();
      });
    }
    // Still render subtabs
    if (subtabs.length) {
      elements.pageSublinks.className =
        "mt-2 flex gap-1 overflow-x-auto whitespace-nowrap pb-0.5";
      elements.pageSublinks.innerHTML = subtabs
        .map((label) => {
          const slug = toSlug(label);
          const active = slug === activeSlug;
          return `<button data-subtab="${escapeHtml(slug)}" class="inline-flex shrink-0 items-center px-3 py-1.5 text-[13px] font-medium tracking-tight rounded-md transition ${active ? "bg-sky-100 text-sky-700 font-semibold" : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"}">${escapeHtml(label)}</button>`;
        })
        .join("");
      elements.pageSublinks.querySelectorAll("[data-subtab]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const slug = btn.getAttribute("data-subtab") || "";
          state.activeSubtabs[pageId] = slug;
          setPageHash(pageId, slug);
          scrollToPageTop();
          renderCurrentView();
        });
      });
    } else {
      elements.pageSublinks.innerHTML = "";
    }
    return;
  }

  // ── Regular page context ──
  if (!subtabs.length) {
    hidePageContext();
    return;
  }

  elements.pageContextBar.classList.remove("hidden");

  const activeSlug = state.activeSubtabs[pageId] || toSlug(subtabs[0]);
  const activeLabel =
    subtabs.find((s) => toSlug(s) === activeSlug) || subtabs[0];
  elements.pageBreadcrumb.innerHTML = `
    <div class="text-[12px] text-slate-500">${escapeHtml(meta.title)} / ${escapeHtml(activeLabel)}</div>
  `;
  elements.pageSublinks.className =
    "mt-2 flex gap-1 overflow-x-auto whitespace-nowrap pb-0.5";
  elements.pageSublinks.innerHTML = subtabs
    .map((label) => {
      const slug = toSlug(label);
      const active = slug === activeSlug;
      return `<button data-subtab="${escapeHtml(slug)}" class="inline-flex shrink-0 items-center px-3 py-1.5 text-[13px] font-medium tracking-tight rounded-md transition ${active ? "bg-sky-100 text-sky-700 font-semibold" : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"}">${escapeHtml(label)}</button>`;
    })
    .join("");

  elements.pageSublinks.querySelectorAll("[data-subtab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const slug = btn.getAttribute("data-subtab") || "";
      state.activeSubtabs[pageId] = slug;
      setPageHash(pageId, slug);
      scrollToPageTop();
      renderCurrentView();
    });
  });
}

function bindFilterControls() {
  // ── Period selector ──
  const periodLabel = document.getElementById("periodLabel");
  const periodFilterInput = elements.periodFilter;
  let pickerPopup = null;
  let pickerYear = new Date().getFullYear();

  const MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  function closePeriodPicker() {
    if (pickerPopup) {
      pickerPopup.remove();
      pickerPopup = null;
    }
  }

  function buildPeriodPicker() {
    closePeriodPicker();
    const rect = elements.periodSelector.getBoundingClientRect();
    pickerPopup = document.createElement("div");
    pickerPopup.id = "periodPickerPopup";
    pickerPopup.style.cssText = `
      position:fixed; z-index:9999; top:${rect.bottom + 4}px; left:${rect.left}px;
      background:white; border:1px solid #d7e8fb; border-radius:10px;
      box-shadow:0 8px 24px rgba(0,0,0,0.10); padding:12px; width:240px;
      font-family:Inter,system-ui,sans-serif;
    `;

    const yearRow = document.createElement("div");
    yearRow.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;";
    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.textContent = "\u2039";
    prevBtn.style.cssText =
      "background:none;border:none;cursor:pointer;font-size:20px;padding:2px 8px;color:#0f172a;";
    const yearSpan = document.createElement("span");
    yearSpan.style.cssText = "font-size:15px;font-weight:700;color:#0f172a;";
    yearSpan.textContent = String(pickerYear);
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.textContent = "\u203a";
    nextBtn.style.cssText =
      "background:none;border:none;cursor:pointer;font-size:20px;padding:2px 8px;color:#0f172a;";

    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      pickerYear -= 1;
      yearSpan.textContent = String(pickerYear);
      Array.from(monthGrid.children).forEach((btn) => {
        const m = btn.dataset.month;
        const val = `${pickerYear}-${m}`;
        const active = val === state.periodFilter;
        btn.style.background = active ? "#0ea5e9" : "#f1f5f9";
        btn.style.color = active ? "white" : "#0f172a";
      });
    });

    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      pickerYear += 1;
      yearSpan.textContent = String(pickerYear);
      Array.from(monthGrid.children).forEach((btn) => {
        const m = btn.dataset.month;
        const val = `${pickerYear}-${m}`;
        const active = val === state.periodFilter;
        btn.style.background = active ? "#0ea5e9" : "#f1f5f9";
        btn.style.color = active ? "white" : "#0f172a";
      });
    });

    yearRow.appendChild(prevBtn);
    yearRow.appendChild(yearSpan);
    yearRow.appendChild(nextBtn);
    pickerPopup.appendChild(yearRow);

    const monthGrid = document.createElement("div");
    monthGrid.style.cssText =
      "display:grid;grid-template-columns:repeat(3,1fr);gap:6px;";

    for (let i = 0; i < 12; i++) {
      const m = String(i + 1).padStart(2, "0");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = MONTH_NAMES[i];
      btn.dataset.month = m;
      const val = `${pickerYear}-${m}`;
      const active = val === state.periodFilter;
      btn.style.cssText = `
        border:none;border-radius:6px;padding:8px 4px;cursor:pointer;
        font-size:13px;font-weight:500;transition:background 0.15s;
        background:${active ? "#0ea5e9" : "#f1f5f9"};color:${active ? "white" : "#0f172a"};
      `;
      btn.addEventListener("mouseenter", () => {
        if (val !== state.periodFilter) btn.style.background = "#e2e8f0";
      });
      btn.addEventListener("mouseleave", () => {
        if (val !== state.periodFilter) btn.style.background = "#f1f5f9";
      });
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.periodFilter = val;
        if (periodFilterInput) periodFilterInput.value = val;
        const y = pickerYear;
        const monthName = MONTH_NAMES[i];
        periodLabel.textContent = `${monthName} ${y}`;
        periodLabel.style.color = "#0f172a";
        closePeriodPicker();
        renderCurrentView();
      });
      monthGrid.appendChild(btn);
    }

    pickerPopup.appendChild(monthGrid);
    document.body.appendChild(pickerPopup);

    setTimeout(() => {
      document.addEventListener("click", closePeriodPicker, { once: true });
    }, 0);
  }

  elements.periodSelector?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (pickerPopup) {
      closePeriodPicker();
    } else {
      if (state.periodFilter && state.periodFilter !== "all") {
        pickerYear = Number(state.periodFilter.split("-")[0]);
      } else {
        pickerYear = new Date().getFullYear();
      }
      buildPeriodPicker();
    }
  });

  elements.countyFilter?.addEventListener("change", () => {
    state.countyFilter = elements.countyFilter.value;
    state.subCountyFilter = "all";
    state.facilityFilter = "all";
    if (elements.subCountyFilter) elements.subCountyFilter.value = "all";
    if (elements.facilityFilter) elements.facilityFilter.value = "all";
    renderSelectOptions(
      elements.subCountyFilter,
      "Sub-Counties",
      getSubCountyOptions(state.countyFilter),
    );
    if (elements.subCountyFilter) {
      elements.subCountyFilter.dataset.populated = "true";
    }
    renderSelectOptions(
      elements.facilityFilter,
      "Facilities",
      getFacilityOptions(state.countyFilter, state.subCountyFilter),
    );
    populateFilterOptions();
    renderCurrentView();
  });

  elements.subCountyFilter?.addEventListener("change", () => {
    const selectedValue = elements.subCountyFilter.value;
    state.subCountyFilter = selectedValue;
    state.facilityFilter = "all";
    if (elements.facilityFilter) elements.facilityFilter.value = "all";
    if (elements.subCountyFilter) {
      elements.subCountyFilter.dataset.populated = "true";
    }
    renderSelectOptions(
      elements.facilityFilter,
      "Facilities",
      getFacilityOptions(state.countyFilter, state.subCountyFilter),
    );
    populateFilterOptions();
    renderCurrentView();
  });

  elements.facilityFilter?.addEventListener("change", () => {
    state.facilityFilter = elements.facilityFilter.value;
    renderCurrentView();
  });

  elements.projectFilter?.addEventListener("change", () => {
    state.projectFilter = elements.projectFilter.value;
    renderCurrentView();
  });

  elements.resetFilters?.addEventListener("click", () => {
    state.facilityFilter = "all";
    state.countyFilter = "all";
    state.subCountyFilter = "all";
    state.facilityFilter = "all";
    state.projectFilter = "all";
    state.periodFilter = "all";
    if (elements.facilityFilter) elements.facilityFilter.value = "all";
    if (elements.countyFilter) elements.countyFilter.value = "all";
    if (elements.subCountyFilter) elements.subCountyFilter.value = "all";
    if (elements.projectFilter) elements.projectFilter.value = "all";
    if (periodFilterInput) periodFilterInput.value = "";
    periodLabel.textContent = "Period";
    periodLabel.style.color = "#64748b";
    closePeriodPicker();
    renderSelectOptions(elements.countyFilter, "Counties", getCountyOptions());
    renderSelectOptions(
      elements.subCountyFilter,
      "Sub-Counties",
      getSubCountyOptions("all"),
    );
    renderSelectOptions(
      elements.facilityFilter,
      "Facilities",
      getFacilityOptions("all", "all"),
    );
    populateFilterOptions();
    renderCurrentView();
  });
}

function bindChatControls() {
  elements.aiFab.addEventListener("click", () => openChat());
  elements.chatOverlay.addEventListener("click", closeChat);
  elements.closeChat.addEventListener("click", closeChat);
  elements.chatForm.addEventListener("submit", handleChatSubmit);
}

function renderPageTabs() {
  if (!elements.pageTabs) return;

  let tabs;
  if (state.activeProject === "jamii_tekelezi") {
    // Within Jamii Tekelezi project — show program navigation
    tabs = [
      { id: "overview", label: "Home" },
      { id: "financial_analysis", label: "Finance Analysis" },
      { id: "reporting_rates", label: "Reporting Rates" },
      { id: "hiv_testing", label: "HIV Testing" },
      { id: "hiv_treatment", label: "HIV Treatment" },
      { id: "profile", label: "Profile" },
      { id: "prep_page", label: "PrEP" },
      { id: "pmtct", label: "PMTCT" },
      { id: "tb", label: "TB" },
      { id: "post_rape", label: "Post ResP" },
      { id: "cacx", label: "CACX" },
    ];
  } else if (isChakProject()) {
    // Within a CHAK project — show overview, dashboard tabs, then dataset tabs
    var chakProj = getActiveChakProject();
    tabs = [{ id: "overview", label: "Overview" }];
    // Add dashboard tabs
    (chakProj.dashboards || []).forEach(function (db) {
      var dbId = typeof db === "string" ? db : db.id;
      var dbName = typeof db === "string" ? db : db.name;
      tabs.push({ id: "chak_dashboard", label: dbName, dbId: dbId });
    });
    // Add dataset tabs
    chakProj.datasets.forEach(function (ds) {
      tabs.push({ id: "chak_dataset", label: ds.name, dsId: ds.id });
    });
    // Mark the current tab
    elements.pageTabs.innerHTML = tabs
      .map(function (tab) {
        var active = state.activePage === tab.id;
        if (tab.id === "chak_dataset" && state.activeDatasetId === tab.dsId)
          active = true;
        if (tab.id === "chak_dashboard" && state.activeDashboardId === tab.dbId)
          active = true;
        return (
          '<div data-page-tab="' +
          tab.id +
          '" data-ds-id="' +
          (tab.dsId || "") +
          '" data-db-id="' +
          (tab.dbId || "") +
          '" class="nav-item ' +
          (active ? "active" : "") +
          '">' +
          '<div class="text-[14px] font-semibold tracking-tight">' +
          escapeHtml(tab.label) +
          "</div></div>"
        );
      })
      .join("");

    elements.pageTabs
      .querySelectorAll("[data-page-tab]")
      .forEach(function (el) {
        el.addEventListener("click", function () {
          var pid = el.getAttribute("data-page-tab") || "overview";
          var dsId = el.getAttribute("data-ds-id") || "";
          var dbId = el.getAttribute("data-db-id") || "";
          if (pid === "overview") {
            state.activePage = "overview";
            state.activeDatasetId = "";
            state.activeDashboardId = "";
            setPageHash("overview");
          } else if (pid === "chak_dataset" && dsId) {
            state.activePage = "chak_dataset";
            state.activeDatasetId = dsId;
            state.activeDashboardId = "";
            var prefix = getProjectHashPrefix();
            window.location.hash =
              "#/" + prefix + "chak_dataset/" + encodeURIComponent(dsId);
          } else if (pid === "chak_dashboard" && dbId) {
            state.activePage = "chak_dashboard";
            state.activeDashboardId = dbId;
            state.activeDatasetId = "";
            var prefix = getProjectHashPrefix();
            window.location.hash =
              "#/" + prefix + "chak_dashboard/" + encodeURIComponent(dbId);
          }
          scrollToPageTop();
          renderCurrentView();
        });
      });
    return;
  } else {
    // Global navigation
    tabs = [
      { id: "overview", label: "Home" },
      { id: "playground", label: "Playground" },
      { id: "health_programmes", label: "Health Programmes" },
      { id: "financial_analysis", label: "Finance Analysis" },
      { id: "human_resource", label: "Human Resource" },
      { id: "cbsl", label: "CBSL" },
    ];
  }

  elements.pageTabs.innerHTML = tabs
    .map((tab) => {
      const active = state.activePage === tab.id ? "active" : "";
      return `
        <div data-page-tab="${tab.id}" class="nav-item ${active}">
          <div class="text-[14px] font-semibold tracking-tight">${escapeHtml(tab.label)}</div>
        </div>
      `;
    })
    .join("");

  elements.pageTabs.querySelectorAll("[data-page-tab]").forEach((el) => {
    el.addEventListener("click", () => {
      const pid = el.getAttribute("data-page-tab") || "overview";
      state.activePage = pid;
      const meta = getPageMeta(pid);
      if (meta.subtabs && meta.subtabs.length) {
        if (!state.activeSubtabs[pid])
          state.activeSubtabs[pid] = toSlug(meta.subtabs[0]);
        setPageHash(pid, state.activeSubtabs[pid]);
      } else {
        setPageHash(pid);
      }
      scrollToPageTop();
      renderCurrentView();
    });
  });
}

function populateFilterOptions() {
  if (elements.facilityFilter) {
    const prevFacVal = elements.facilityFilter.value;
    const facilityOptions = getFacilityOptions(
      state.countyFilter,
      state.subCountyFilter,
    );
    renderSelectOptions(elements.facilityFilter, "Facilities", facilityOptions);
    if (prevFacVal !== "all") {
      const stillExists = Array.from(elements.facilityFilter.options).some(
        (opt) => opt.value === prevFacVal,
      );
      if (stillExists) elements.facilityFilter.value = prevFacVal;
    }
  }
  if (elements.countyFilter && !elements.countyFilter.dataset.populated) {
    renderSelectOptions(elements.countyFilter, "Counties", getCountyOptions());
    elements.countyFilter.dataset.populated = "true";
  }

  if (elements.subCountyFilter) {
    const prevVal = elements.subCountyFilter.value;
    renderSelectOptions(
      elements.subCountyFilter,
      "Sub-Counties",
      getSubCountyOptions(state.countyFilter),
    );
    if (prevVal !== "all") {
      const stillExists = Array.from(elements.subCountyFilter.options).some(
        (opt) => opt.value === prevVal,
      );
      if (stillExists) elements.subCountyFilter.value = prevVal;
    }
  }

  // Populate project filter with the 11 real projects
  if (elements.projectFilter && !elements.projectFilter.dataset.populated) {
    const projects = [
      { value: "all", label: "All Projects" },
      { value: "jamii-tekelezi", label: "Jamii Tekelezi (JTP)" },
      { value: "chap-stawisha", label: "CHAP Stawisha" },
      { value: "eis", label: "EIS" },
      { value: "gf-mnch", label: "Gates Foundation MNCH" },
      { value: "bftw-rmncah", label: "BFTW RMNCAH" },
      { value: "pep", label: "PEP" },
      { value: "impact", label: "IMPACT Project" },
      { value: "eye-health", label: "Eye Health (ACSP)" },
      { value: "cdic-icare", label: "CDIC / iCARE" },
      { value: "internship", label: "Internship Program" },
      { value: "gitlab", label: "GitLab" },
    ];
    renderSelectOptions(elements.projectFilter, "", projects);
    elements.projectFilter.dataset.populated = "true";
  }
}

// ── Health Programmes Page ──
