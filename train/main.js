const state = {
  rawData: [],
  filteredData: [],
  catalog: null,
  facilityPage: null,
  activePage: "overview",
  facilityFilter: "all",
  locationHierarchy: null,
  countyFilter: "all",
  subCountyFilter: "all",
  periodFilter: "all",
  activeSubtabs: {},
  jtCounties: [],
  jtSubcounties: [],
  jtSubcountyMap: {},
  jtFacilityNames: [],
  jtFacilityIds: [],
  jtFacilityIdNameMap: {},
  jtFacilitiesBySubcounty: {},
};

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

  const pageId = parts[0];
  const subtabSlug = parts[1] || "";
  const validPages = new Set([
    "overview",
    "reporting_rates",
    "hiv_testing",
    "hiv_treatment",
    "profile",
    "prep_page",
    "pmtct",
    "tb",
    "post_rape",
    "cacx",
    "service_desk",
    "resources",
    "case_surveillance",
    "facilities",
    "indicators",
    "all",
  ]);
  if (!validPages.has(pageId)) return;

  state.activePage = pageId;
  if (subtabSlug) {
    state.activeSubtabs[pageId] = subtabSlug;
  }
}

function toSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function setPageHash(pageId, subtabLabel = "") {
  const sub = subtabLabel ? `/${toSlug(subtabLabel)}` : "";
  const next = `#/${pageId}${sub}`;
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
        "Post Rape": "post_rape",
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
    hiv_testing: {
      title: "HIV Testing & Prevention",
      subtabs: [
        "HIV TESTING SERVICES UPTAKE",
        "HIV TESTING SERVICES LINKAGE",
        "PARTNER NOTIFICATION SERVICES",
        "PrEP",
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
      title: "Post Rape",
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
    financial_analysis: { title: "Financial Analysis", subtabs: ["Overview"] },
    jamii: {
      title: "Jamii Tekelezi",
      subtabs: ["Overview", "TX_CURR Analytics"],
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

  const subtabs = Array.isArray(meta.subtabs) ? meta.subtabs : [];
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

  elements.resetFilters?.addEventListener("click", () => {
    state.facilityFilter = "all";
    state.countyFilter = "all";
    state.subCountyFilter = "all";
    state.facilityFilter = "all";
    state.periodFilter = "all";
    if (elements.facilityFilter) elements.facilityFilter.value = "all";
    if (elements.countyFilter) elements.countyFilter.value = "all";
    if (elements.subCountyFilter) elements.subCountyFilter.value = "all";
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
  const tabs = [
    { id: "overview", label: "Home" },
    { id: "financial_analysis", label: "Financial Analysis" },
    { id: "reporting_rates", label: "Reporting Rates" },
    { id: "hiv_testing", label: "HIV Testing" },
    { id: "hiv_treatment", label: "HIV Treatment" },
    { id: "profile", label: "Profile" },
    { id: "prep_page", label: "PrEP" },
    { id: "pmtct", label: "PMTCT" },
    { id: "tb", label: "TB" },
    { id: "post_rape", label: "Post Rape" },
    { id: "cacx", label: "CACX" },
    { id: "linkage", label: "Linkage" },
    { id: "jamii", label: "Jamii Tekelezi" },
  ];

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
}

function renderCurrentView() {
  if (!state.rawData.length) {
    return;
  }

  renderPageTabs();
  populateFilterOptions();

  const pageId = state.activePage || "overview";

  if (pageId === "overview") {
    hidePageContext();
    elements.chartRoot.innerHTML = `
      <div id="homepageRoot" class="space-y-5">
        <div class="flex items-center justify-center py-16 text-slate-500 text-sm gap-2">
          <div class="w-5 h-5 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
          Loading dashboard summary…
        </div>
      </div>
    `;
    renderHomepageDashboard();
    return;
  }

  // Category pages with subtabs
  renderPageContext(pageId);

  // Check if we have a specific subtab to render content for
  const activeSlug = state.activeSubtabs[pageId] || "";
  const meta = getPageMeta(pageId);
  const activeLabel = meta.subtabs
    ? meta.subtabs.find((s) => toSlug(s) === activeSlug) || ""
    : "";

  // ── HIV Treatment → Unified DHIS2 Live Charts ──
  if (pageId === "hiv_treatment" && SUBTAB_TYPE_MAP[activeSlug]) {
    elements.chartRoot.innerHTML = `<div id="categoryContent" class="space-y-6"></div>`;
    const container = document.getElementById("categoryContent");
    renderDhisLiveChart(container, pageId, activeSlug);
    return;
  }

  // ── HIV Testing → Unified DHIS2 HTS Live Charts ──
  if (pageId === "hiv_testing" && SUBTAB_TYPE_MAP[activeSlug]) {
    elements.chartRoot.innerHTML = `<div id="categoryContent" class="space-y-6"></div>`;
    const container = document.getElementById("categoryContent");
    renderHtsLiveChart(container, pageId, activeSlug);
    return;
  }

  // ── CHAK Subtabs (embedded in hiv_testing / hiv_treatment) ──
  // These are CHAK subtabs that are NOT in SUBTAB_TYPE_MAP (the existing renderer)
  const CHAK_SUBTAB_PAGES = {
    "hts-performance": "hts-performance",
    "hts-index-testing": "hts-index",
    "sns-cascade": "sns-cascade",
    "hts-summary": "hts-summary",
    "testing-modality": "testing-modality",
    "key-indicators": "key-indicators",
    "care-treatment": "care-treatment",
    "cd4-tpt-uptake": "cd4-tpt",
    "viral-load-cascade": "vl-cascade",
    "iit-quarterly": "iit-quarterly",
  };

  if (
    (pageId === "hiv_testing" || pageId === "hiv_treatment") &&
    CHAK_SUBTAB_PAGES[activeSlug]
  ) {
    elements.chartRoot.innerHTML = `<div id="categoryContent" class="space-y-6"></div>`;
    renderChakPage(
      document.getElementById("categoryContent"),
      activeSlug,
      CHAK_SUBTAB_PAGES[activeSlug],
    );
    return;
  }

  // ── CHAK Global Pages (standalone tabs) ──
  const CHAK_GLOBAL_PAGES = {
    profile: "profile",
    prep_page: "prep",
    pmtct: "pmtct",
    tb: "tb",
    post_rape: "post-rape",
    cacx: "cacx",
    linkage: "linkage",
  };

  if (CHAK_GLOBAL_PAGES[pageId]) {
    elements.chartRoot.innerHTML = `<div id="categoryContent" class="space-y-6"></div>`;
    const apiPage = CHAK_GLOBAL_PAGES[pageId];
    renderChakPage(document.getElementById("categoryContent"), pageId, apiPage);
    return;
  }

  // ── Jamii Tekelezi Page ──
  if (pageId === "jamii") {
    elements.chartRoot.innerHTML = `<div id="jamiiRoot" class="space-y-6">
      <div id="jamiiContent" class="space-y-6"></div>
    </div>`;
    const jamiiContainer = document.getElementById("jamiiContent");
    renderJamiiPage(jamiiContainer, activeSlug);
    return;
  }

  // Default category placeholder
  elements.chartRoot.innerHTML = `
    <div class="space-y-6">
      <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <div class="text-4xl mb-3">📋</div>
          <p class="text-sm text-slate-500">${escapeHtml(activeLabel || getPageMeta(pageId).title)}</p>
          <p class="text-xs text-slate-400 mt-2">Select a subtab above to view related information.</p>
        </div>
      </div>
    </div>
  `;
}

async function loadDashboardData() {
  try {
    const dataResponse = await fetch("/api/dashboard-data");

    if (!dataResponse.ok) {
      throw new Error("Unable to load dashboard data.");
    }

    const payload = await dataResponse.json();
    state.rawData = Array.isArray(payload.data) ? payload.data : [];
    state.catalog = payload;

    const facilityResponse = await fetch(
      "/api/facilities?page=1&page_size=8",
    ).catch(() => null);
    state.facilityPage =
      facilityResponse && facilityResponse.ok
        ? await facilityResponse.json()
        : null;

    // Load location hierarchy
    try {
      const overviewResp = await fetch("/api/dashboard-overview");
      if (overviewResp.ok) {
        const overview = await overviewResp.json();
        state.locationHierarchy = overview.location_filters || null;
        state.catalog = overview.catalog || state.catalog;
      }
    } catch (e) {
      // non-critical
    }

    // Load Jamii Tekelezi locations to restrict global filters
    try {
      const jtResp = await fetch("/api/jamii-tekelezi/locations");
      if (jtResp.ok) {
        const jt = await jtResp.json();
        state.jtCounties = Array.isArray(jt.counties) ? jt.counties : [];
        state.jtSubcounties = Array.isArray(jt.subcounties)
          ? jt.subcounties
          : [];
        state.jtSubcountyMap = jt.county_subcounties || {};
        state.jtFacilityNames = Array.isArray(jt.facility_names)
          ? jt.facility_names
          : [];
        state.jtFacilityIds = Array.isArray(jt.facility_ids)
          ? jt.facility_ids
          : [];
        state.jtFacilityIdNameMap = jt.facility_id_name_map || {};
        state.jtFacilitiesBySubcounty = jt.facilities_by_subcounty || {};
      }
    } catch (e) {
      // non-critical
    }

    renderCurrentView();
  } catch (error) {
    elements.chartRoot.innerHTML = `
      <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
        ${escapeHtml(error.message || "Failed to load dashboard data.")}
      </div>
    `;
  }
}

function getLocationHierarchy() {
  return (
    state.locationHierarchy || {
      counties: [],
      subcounties_by_county: {},
      facilities_by_county: {},
      facilities_by_subcounty: {},
      subcounties: [],
      facilities: [],
    }
  );
}

function getCountyOptions() {
  // If JT counties are loaded, always show only the 4 Jamii Tekelezi counties
  if (state.jtCounties.length) {
    return state.jtCounties;
  }

  const hierarchy = getLocationHierarchy();
  const counties = Array.isArray(hierarchy.counties)
    ? hierarchy.counties.filter(Boolean)
    : [];
  if (counties.length) {
    return counties;
  }

  return Array.from(
    new Set(
      state.rawData
        .map((row) => row.County || row.CountyName || row.County_Name)
        .filter(Boolean),
    ),
  );
}

function getSubCountyOptions(selectedCounty = "all") {
  // If JT data is loaded and a specific county is selected, use JT mapping
  if (state.jtCounties.length && selectedCounty && selectedCounty !== "all") {
    const subs = state.jtSubcountyMap[selectedCounty] || [];
    return subs;
  }

  // If JT data is loaded but "all" counties, return all JT sub-counties
  if (state.jtSubcounties.length && selectedCounty === "all") {
    return state.jtSubcounties;
  }

  const hierarchy = getLocationHierarchy();
  const subcountyMap = hierarchy.subcounties_by_county || {};

  if (
    selectedCounty &&
    selectedCounty !== "all" &&
    Array.isArray(subcountyMap[selectedCounty])
  ) {
    return subcountyMap[selectedCounty];
  }

  const flattened = Array.isArray(hierarchy.subcounties)
    ? hierarchy.subcounties.filter(Boolean)
    : [];
  if (flattened.length) {
    return flattened;
  }

  return Array.from(
    new Set(
      state.rawData
        .map((row) => row.SubCounty || row.Sub_County || row.Sub_County_Name)
        .filter(Boolean),
    ),
  );
}

function getFacilityOptions(selectedCounty = "all", selectedSubCounty = "all") {
  // If JT data is loaded, use the JT facility hierarchy
  if (state.jtCounties.length) {
    // Specific county + subcounty: return facilities for that subcounty
    if (
      selectedCounty &&
      selectedCounty !== "all" &&
      selectedSubCounty &&
      selectedSubCounty !== "all"
    ) {
      const key = `${selectedCounty}||${selectedSubCounty}`;
      const facs = state.jtFacilitiesBySubcounty[key] || [];
      return facs.map((f) => f.name);
    }
    // Specific county only: return all facilities for that county
    if (selectedCounty && selectedCounty !== "all") {
      const subs = state.jtSubcountyMap[selectedCounty] || [];
      const allFacs = [];
      for (const sc of subs) {
        const key = `${selectedCounty}||${sc}`;
        const facs = state.jtFacilitiesBySubcounty[key] || [];
        allFacs.push(...facs.map((f) => f.name));
      }
      return [...new Set(allFacs)].sort();
    }
    // "All" selected: return all JT facility names
    return state.jtFacilityNames;
  }

  const hierarchy = getLocationHierarchy();
  const facilitiesBySubcounty = hierarchy.facilities_by_subcounty || {};
  const facilitiesByCounty = hierarchy.facilities_by_county || {};

  if (
    selectedCounty &&
    selectedCounty !== "all" &&
    selectedSubCounty &&
    selectedSubCounty !== "all" &&
    Array.isArray(facilitiesBySubcounty[selectedCounty]?.[selectedSubCounty])
  ) {
    return facilitiesBySubcounty[selectedCounty][selectedSubCounty];
  }

  if (
    selectedCounty &&
    selectedCounty !== "all" &&
    Array.isArray(facilitiesByCounty[selectedCounty])
  ) {
    return facilitiesByCounty[selectedCounty];
  }

  const flattened = Array.isArray(hierarchy.facilities)
    ? hierarchy.facilities.filter(Boolean)
    : [];
  if (flattened.length) {
    return flattened;
  }

  return Array.from(
    new Set(
      state.rawData
        .map((row) => row.Facility || row.FacilityName || row.hospital_name)
        .filter(Boolean),
    ),
  );
}

function renderSelectOptions(selectElement, label, values) {
  if (!selectElement) return;
  selectElement.innerHTML =
    `<option value="all">All ${escapeHtml(label)}</option>` +
    values
      .map(
        (value) =>
          `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`,
      )
      .join("");
}

function openChat() {
  elements.chatOverlay.classList.remove("hidden");
  elements.chatModal.classList.remove("hidden");
  elements.chatInput.focus();
}

function closeChat() {
  elements.chatOverlay.classList.add("hidden");
  elements.chatModal.classList.add("hidden");
}

async function handleChatSubmit(event) {
  event.preventDefault();
  const question = elements.chatInput.value.trim();
  if (!question) {
    return;
  }

  appendMessage("user", question);
  elements.chatInput.value = "";

  const typingId = appendTypingIndicator();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const payload = await response.json();
    removeTypingIndicator(typingId);

    if (!response.ok) {
      appendMessage(
        "assistant",
        payload.error || "The assistant could not process that request.",
      );
      return;
    }

    appendMessage(
      "assistant",
      payload.answer_html || payload.summary || "No answer returned.",
      true,
    );
    if (payload.source || payload.ai_error) {
      const meta = document.createElement("div");
      meta.className = "text-xs text-slate-500 mt-1 ml-1";
      let text = payload.source ? `Source: ${escapeHtml(payload.source)}` : "";
      if (payload.ai_error)
        text +=
          (text ? " \u2022 " : "") +
          `AI error: ${escapeHtml(payload.ai_error)}`;
      meta.textContent = text;
      const wrapperMeta = document.createElement("div");
      wrapperMeta.className = "flex justify-start";
      wrapperMeta.appendChild(meta);
      elements.chatMessages.appendChild(wrapperMeta);
      elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
  } catch (error) {
    removeTypingIndicator(typingId);
    appendMessage(
      "assistant",
      "Network error while contacting the AI assistant.",
    );
  }
}

function appendMessage(role, content, asHtml = false) {
  const wrapper = document.createElement("div");
  const isUser = role === "user";

  wrapper.className = `flex ${isUser ? "justify-end" : "justify-start"} fade-in-up`;
  const bubble = document.createElement("div");
  bubble.className = isUser
    ? "max-w-[85%] rounded-2xl rounded-br-md bg-sky-600 px-4 py-3 text-sm text-white"
    : "max-w-[85%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm";

  if (asHtml) {
    bubble.innerHTML = content;
  } else {
    bubble.textContent = content;
  }

  wrapper.appendChild(bubble);
  elements.chatMessages.appendChild(wrapper);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function appendTypingIndicator() {
  const id = `typing-${Date.now()}`;
  const wrapper = document.createElement("div");
  wrapper.id = id;
  wrapper.className = "flex justify-start fade-in-up";
  wrapper.innerHTML = `
    <div class="max-w-[85%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Thinking</span>
        <div class="typing-dots flex items-center gap-1">
          <span class="inline-block h-2 w-2 rounded-full bg-sky-500"></span>
          <span class="inline-block h-2 w-2 rounded-full bg-sky-500"></span>
          <span class="inline-block h-2 w-2 rounded-full bg-sky-500"></span>
        </div>
      </div>
    </div>
  `;
  elements.chatMessages.appendChild(wrapper);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  const node = document.getElementById(id);
  if (node) {
    node.remove();
  }
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value, fractionDigits = 0) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
  try {
    const resp = await fetch(
      `/api/hiv-treatment/nart-trend?county=${encodeURIComponent(county)}${scParam}${facParam}`,
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
  try {
    const resp = await fetch(
      `/api/hiv-treatment/nart-dhis-live?county=${encodeURIComponent(county)}${scParam}${facParam}`,
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

// ── Homepage Dashboard ──────────────────────────────────────────────
async function renderHomepageDashboard() {
  const root = document.getElementById("homepageRoot");
  if (!root) return;

  const county =
    state.countyFilter !== "all" ? state.countyFilter : "Meru County";
  const scParam =
    state.subCountyFilter !== "all"
      ? `&subcounty=${encodeURIComponent(state.subCountyFilter)}`
      : "";

  try {
    const resp = await fetch(
      `/api/homepage/summary?county=${encodeURIComponent(county)}${scParam}&period=LAST_12_MONTHS`,
    );
    const d = await resp.json();
    if (d.error) {
      root.innerHTML = `<div class="text-red-500 text-sm py-8 text-center">${escapeHtml(d.error)}</div>`;
      return;
    }

    const kpi = d.latest || {};
    const locLabel = d.subcounty || d.county;
    const fetched = d.fetched_at || "";

    // ── KPI cards ──
    const kpiCards = [
      {
        label: "Current on ART",
        value: kpi.tx_curr || 0,
        color: "#7c3aed",
        fmt: "patients",
      },
      {
        label: "New on ART",
        value: kpi.tx_new || 0,
        color: "#2563eb",
        fmt: "patients",
      },
      {
        label: "HTS Tested",
        value: kpi.hts_tested || 0,
        color: "#0891b2",
        fmt: "tested",
      },
      {
        label: "Positivity Rate",
        value: kpi.positivity_rate || 0,
        color: "#dc2626",
        fmt: "pct",
      },
    ];

    let html = `
      <div class="flex items-center justify-between mb-1">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-lg font-bold text-slate-800">📊 ${escapeHtml(locLabel)}</span>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-100 text-green-700 border border-green-300">
              <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>⚡ Live
            </span>
          </div>
          <div class="text-xs text-slate-400">${kpi.label || ""} snapshot · Fetched ${fetched}</div>
        </div>
      </div>

      <!-- KPI Row -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
    `;

    for (const card of kpiCards) {
      const valStr =
        card.fmt === "pct" ? `${card.value}%` : card.value.toLocaleString();
      html += `
        <div class="rounded-2xl border bg-white p-4 shadow-sm" style="border-left:4px solid ${card.color}">
          <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">${card.label}</div>
          <div class="text-2xl font-bold text-slate-800 mt-1">${valStr}</div>
        </div>
      `;
    }

    html += `</div>`;

    // ── Chart cards row ──
    html += `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="rounded-2xl border border-purple-200 bg-white p-4 shadow-sm">
          <div class="text-xs font-semibold text-purple-700 mb-2">📈 Current on ART (TX_CURR)</div>
          <div id="hp-chart-txcurr" style="height:250px;width:100%"></div>
        </div>
        <div class="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
          <div class="text-xs font-semibold text-blue-700 mb-2">📈 New on ART (TX_NEW)</div>
          <div id="hp-chart-txnew" style="height:250px;width:100%"></div>
        </div>
      </div>

      <!-- HTS row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
          <div class="text-xs font-semibold text-red-700 mb-2">📈 HTS TST % Positive</div>
          <div id="hp-chart-positivity" style="height:220px;width:100%"></div>
        </div>
        <div class="rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm">
          <div class="text-xs font-semibold text-cyan-700 mb-2">📊 HTS TST Numerator</div>
          <div id="hp-chart-htstested" style="height:220px;width:100%"></div>
        </div>
      </div>
    `;

    root.innerHTML = html;

    // ── Render Highcharts ──
    if (window.Highcharts) {
      const txCurrData = (d.tx_curr_trend || []).map((p) => p.value);
      const txNewData = (d.tx_new_trend || []).map((p) => p.value);
      const htsData = d.hts_trend || [];
      const categories = (d.tx_curr_trend || []).map((p) => p.label);

      // TX_CURR chart
      Highcharts.chart("hp-chart-txcurr", {
        chart: { type: "line", zoomType: "x" },
        title: { text: null },
        xAxis: {
          categories,
          labels: { style: { fontSize: "9px" }, rotation: -30 },
        },
        yAxis: { title: { text: "Patients" }, allowDecimals: false },
        tooltip: { valueSuffix: " patients" },
        plotOptions: { line: { marker: { enabled: true, radius: 2 } } },
        series: [
          { name: "TX_CURR", data: txCurrData, color: "#7c3aed", lineWidth: 2 },
        ],
        credits: { enabled: false },
        exporting: {
          enabled: true,
          buttons: {
            contextButton: {
              menuItems: [
                "viewFullscreen",
                "printChart",
                "downloadPNG",
                "downloadJPEG",
                "downloadSVG",
                "downloadCSV",
              ],
            },
          },
        },
        legend: { enabled: false },
      });

      // TX_NEW chart
      Highcharts.chart("hp-chart-txnew", {
        chart: { type: "line", zoomType: "x" },
        title: { text: null },
        xAxis: {
          categories,
          labels: { style: { fontSize: "9px" }, rotation: -30 },
        },
        yAxis: { title: { text: "Patients" }, allowDecimals: false },
        tooltip: { valueSuffix: " patients" },
        plotOptions: { line: { marker: { enabled: true, radius: 2 } } },
        series: [
          { name: "TX_NEW", data: txNewData, color: "#2563eb", lineWidth: 2 },
        ],
        credits: { enabled: false },
        exporting: {
          enabled: true,
          buttons: {
            contextButton: {
              menuItems: [
                "viewFullscreen",
                "printChart",
                "downloadPNG",
                "downloadJPEG",
                "downloadSVG",
                "downloadCSV",
              ],
            },
          },
        },
        legend: { enabled: false },
      });

      // HTS Positivity chart
      Highcharts.chart("hp-chart-positivity", {
        chart: { type: "line", zoomType: "x" },
        title: { text: null },
        xAxis: {
          categories,
          labels: { style: { fontSize: "9px" }, rotation: -30 },
        },
        yAxis: {
          title: { text: "% Positive" },
          labels: { format: "{value}%" },
          min: 0,
        },
        tooltip: { valueSuffix: "%", valueDecimals: 1 },
        plotOptions: { line: { marker: { enabled: true, radius: 2 } } },
        series: [
          {
            name: "% Positive",
            data: htsData.map((p) => p.positivity_rate),
            color: "#dc2626",
            lineWidth: 2,
          },
        ],
        credits: { enabled: false },
        exporting: {
          enabled: true,
          buttons: {
            contextButton: {
              menuItems: [
                "viewFullscreen",
                "printChart",
                "downloadPNG",
                "downloadJPEG",
                "downloadSVG",
                "downloadCSV",
              ],
            },
          },
        },
        legend: { enabled: false },
      });

      // HTS Tested chart
      Highcharts.chart("hp-chart-htstested", {
        chart: { type: "column", zoomType: "x" },
        title: { text: null },
        xAxis: {
          categories,
          labels: { style: { fontSize: "9px" }, rotation: -30 },
        },
        yAxis: { title: { text: "Tested" }, allowDecimals: false },
        tooltip: { valueSuffix: " tested" },
        plotOptions: { column: { borderRadius: 3, borderWidth: 0 } },
        series: [
          {
            name: "HTS Tested",
            data: htsData.map((p) => p.tested),
            color: "#0891b2",
          },
        ],
        credits: { enabled: false },
        exporting: {
          enabled: true,
          buttons: {
            contextButton: {
              menuItems: [
                "viewFullscreen",
                "printChart",
                "downloadPNG",
                "downloadJPEG",
                "downloadSVG",
                "downloadCSV",
              ],
            },
          },
        },
        legend: { enabled: false },
      });
    }
  } catch (e) {
    root.innerHTML = `<div class="text-red-500 text-sm py-8 text-center">Dashboard unavailable: ${escapeHtml(e.message)}</div>`;
  }
}

async function renderDhisLiveChart(container, pageId, slug) {
  const config = SUBTAB_TYPE_MAP[slug];
  if (!config) {
    container.innerHTML = `<div class="text-slate-400 text-sm py-12 text-center">No DHIS2 config for "${escapeHtml(slug)}"</div>`;
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "space-y-5";
  wrapper.innerHTML = `
    <div class="flex items-center justify-center py-16 text-slate-500 text-sm gap-2">
      <div class="w-5 h-5 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
      Querying DHIS2 for ${escapeHtml(config.title)}…
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
  try {
    const selectedPeriod =
      state.periodFilter && state.periodFilter !== "all"
        ? state.periodFilter
        : "LAST_12_MONTHS";
    const resp = await fetch(
      `/api/hiv-treatment/dhis-live?type=${encodeURIComponent(config.type)}&county=${encodeURIComponent(county)}${scParam}${facParam}&period=${encodeURIComponent(selectedPeriod)}`,
    );
    const json = await resp.json();
    if (json.error) {
      wrapper.innerHTML = `<div class="text-red-500 text-sm py-8 text-center">${escapeHtml(json.error)}</div>`;
      return;
    }
    _dhisLiveData = json;
    buildUnifiedDhisChart(wrapper, json, config);
  } catch (e) {
    wrapper.innerHTML = `<div class="text-red-500 text-sm py-8 text-center">DHIS2 unavailable: ${escapeHtml(e.message)}</div>`;
  }
}

// ── Render HIV Testing DHIS2 live charts (HTS subtabs) ─────────────
async function renderHtsLiveChart(container, pageId, slug) {
  const config = SUBTAB_TYPE_MAP[slug];
  if (!config) {
    container.innerHTML = `<div class="text-slate-400 text-sm py-12 text-center">No DHIS2 config for "${escapeHtml(slug)}"</div>`;
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "space-y-5";
  wrapper.innerHTML = `
    <div class="flex items-center justify-center py-16 text-slate-500 text-sm gap-2">
      <div class="w-5 h-5 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
      Querying DHIS2 for ${escapeHtml(config.title)}…
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
  try {
    const selectedPeriod =
      state.periodFilter && state.periodFilter !== "all"
        ? state.periodFilter
        : "LAST_12_MONTHS";
    const resp = await fetch(
      `/api/hiv-testing/dhis-live?type=${encodeURIComponent(config.type)}&county=${encodeURIComponent(county)}${scParam}${facParam}&period=${encodeURIComponent(selectedPeriod)}`,
    );
    const json = await resp.json();
    if (json.error) {
      wrapper.innerHTML = `<div class="text-red-500 text-sm py-8 text-center">${escapeHtml(json.error)}</div>`;
      return;
    }
    _dhisLiveData = json;
    // HTS data uses the non-age-sex path (same as VL) — multi-line chart
    buildUnifiedDhisChart(wrapper, json, config);
  } catch (e) {
    wrapper.innerHTML = `<div class="text-red-500 text-sm py-8 text-center">DHIS2 unavailable: ${escapeHtml(e.message)}</div>`;
  }
}

function buildUnifiedDhisChart(wrapper, data, config) {
  const {
    county,
    subcounty,
    facility,
    metrics,
    trend,
    monthly_cards,
    age_bands,
    fetched_at,
    type,
  } = data;
  const categories = trend.map((p) => p.label);

  const locationLabel = facility || subcounty || county;

  const isAgeSex = type === "tx_new" || type === "tx_curr";

  let html = "";

  // ── Header ──
  html += `
    <div class="flex items-center justify-between mb-1">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold text-slate-800">${escapeHtml(config.title)} – ${escapeHtml(locationLabel)}</span>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-100 text-purple-700 border border-purple-300">
            <span class="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
            ${escapeHtml(config.badge || "⚡ Live")}
          </span>
        </div>
        <div class="text-xs text-slate-400">
          ${categories[0] || ""} to ${categories[categories.length - 1] || ""}
          ${fetched_at ? ` · Fetched ${fetched_at}` : ""}
        </div>
      </div>
    </div>
  `;

  if (isAgeSex) {
    // ═══════════ AGE/SEX LAYOUT ═══════════

    // ── Section 1: Total Trend ──
    html += `
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-menu-container="total">
        <div class="flex items-center justify-between mb-2">
          <div>
            <div class="text-xs font-semibold text-slate-700">📈 Total Trend</div>
            <div class="text-[10px] text-slate-400">Monthly totals</div>
          </div>
          <div class="relative">
            <button class="dhis-menu-btn w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-400" title="Options">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
            </button>
            <div class="dhis-menu-drop hidden absolute right-0 top-8 bg-white border border-slate-200 rounded-xl shadow-lg z-50 min-w-[170px] py-1">
              <button data-dhis-action="fullscreen-total" class="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">🔍 Fullscreen</button>
              <button data-dhis-action="data-table" class="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">📋 View Data</button>
            </div>
          </div>
        </div>
        <div id="dhis-chart-total" style="height:300px;width:100%"></div>
      </div>
    `;

    // ── Section 2: Latest Month Age-Sex Pyramid ──
    html += `
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between mb-2">
          <div>
            <div class="text-xs font-semibold text-slate-700">👥 Age-Sex Pyramid (Latest Month)</div>
            <div class="text-[10px] text-slate-400">Single-month age-sex distribution with horizontal age bands</div>
          </div>
        </div>
        <div class="chak-chart-container">
          <canvas id="chakAgeSexPyramid"></canvas>
        </div>
      </div>
    `;

    // ── Section 3: Monthly Cards ──
    html += `
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="text-xs font-semibold text-slate-700 mb-3">📅 Monthly Breakdown</div>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
    `;
    const cardsToShow = (monthly_cards || []).slice(-12); // last 12 months
    for (const card of cardsToShow) {
      const total = card.total || 0;
      const malePct =
        total > 0 ? Math.round(((card.males || 0) / total) * 100) : 0;
      const femalePct =
        total > 0 ? Math.round(((card.females || 0) / total) * 100) : 0;
      html += `
        <div class="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
          <div class="text-[10px] text-slate-500 font-medium">${escapeHtml(card.label)}</div>
          <div class="text-lg font-bold text-slate-800 mt-0.5">${total}</div>
          <div class="flex items-center justify-center gap-2 mt-1.5 text-[10px]">
            <span class="text-emerald-600 font-semibold">♂ ${card.males || 0}</span>
            <span class="text-pink-600 font-semibold">♀ ${card.females || 0}</span>
          </div>
          <div class="mt-1.5 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden flex">
            <div class="h-full bg-emerald-400 rounded-l-full" style="width:${malePct}%"></div>
            <div class="h-full bg-pink-400 rounded-r-full" style="width:${femalePct}%"></div>
          </div>
        </div>
      `;
    }
    html += `</div></div>`;

    // ── Section 4: Auto-loading Detailed Analytics (TX_CURR & TX_NEW) ──
    if (type === "tx_curr" || type === "tx_new") {
      const isNew = type === "tx_new";
      html += `
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <div>
              <div class="text-xs font-semibold text-slate-700">🔍 Detailed Analytics</div>
              <div class="text-[10px] text-slate-400">Auto-loaded · ${isNew ? "Gender Split, Age Split" : "Gender, Age, Yearly, MMD, MoM, Gender Split, Age Split, Regimens"}</div>
            </div>
          </div>
          ${
            isNew
              ? `
          <!-- TX_NEW: Gender Split Donut -->
          <div id="tx-new-analytics-gender-split" class="rounded-xl border border-slate-100 bg-slate-50 p-3 min-h-[220px] flex items-center justify-center mb-4">
            <div class="flex items-center gap-2 text-xs text-slate-400"><div class="w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>Loading Gender Split…</div>
          </div>
          <!-- TX_NEW: Age Split Bar Chart -->
          <div id="tx-new-analytics-age-split" class="rounded-xl border border-slate-100 bg-slate-50 p-3 min-h-[220px] flex items-center justify-center">
            <div class="flex items-center gap-2 text-xs text-slate-400"><div class="w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>Loading Age Split…</div>
          </div>
          `
              : `
          <!-- Each chart in its own row, stacked vertically -->
          <div id="tx-curr-analytics-gender" class="rounded-xl border border-slate-100 bg-slate-50 p-3 min-h-[220px] flex items-center justify-center mb-4">
            <div class="flex items-center gap-2 text-xs text-slate-400"><div class="w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>Loading Gender…</div>
          </div>
          <div id="tx-curr-analytics-mom" class="rounded-xl border border-slate-100 bg-slate-50 p-3 min-h-[220px] flex items-center justify-center mb-4">
            <div class="flex items-center gap-2 text-xs text-slate-400"><div class="w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>Loading MoM Change…</div>
          </div>
          <div id="tx-curr-analytics-age" class="rounded-xl border border-slate-100 bg-slate-50 p-3 min-h-[220px] flex items-center justify-center mb-4">
            <div class="flex items-center gap-2 text-xs text-slate-400"><div class="w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>Loading Age Groups…</div>
          </div>
          <div id="tx-curr-analytics-yearly" class="rounded-xl border border-slate-100 bg-slate-50 p-3 min-h-[220px] flex items-center justify-center mb-4">
            <div class="flex items-center gap-2 text-xs text-slate-400"><div class="w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>Loading Yearly…</div>
          </div>
          <div id="tx-curr-analytics-mmd" class="rounded-xl border border-slate-100 bg-slate-50 p-3 min-h-[220px] flex items-center justify-center mb-4">
            <div class="flex items-center gap-2 text-xs text-slate-400"><div class="w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>Loading MMD…</div>
          </div>
          <div id="tx-curr-analytics-gender-split" class="rounded-xl border border-slate-100 bg-slate-50 p-3 min-h-[220px] flex items-center justify-center mb-4">
            <div class="flex items-center gap-2 text-xs text-slate-400"><div class="w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>Loading Gender Split…</div>
          </div>
          <div id="tx-curr-analytics-age-split" class="rounded-xl border border-slate-100 bg-slate-50 p-3 min-h-[220px] flex items-center justify-center mb-4">
            <div class="flex items-center gap-2 text-xs text-slate-400"><div class="w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>Loading Age Split…</div>
          </div>
          <div id="tx-curr-analytics-regimens" class="rounded-xl border border-slate-100 bg-slate-50 p-3 min-h-[220px] flex items-center justify-center">
            <div class="flex items-center gap-2 text-xs text-slate-400"><div class="w-4 h-4 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>Loading Regimens…</div>
          </div>
          `
          }
        </div>
      `;
    }

    // ── Section 5: Professional Visualizations (All types) ──
    html += `
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 class="text-sm font-bold text-slate-900 mb-4">✨ Professional Healthcare Analytics</h3>
        <div id="prof-viz-container" class="space-y-6">
          <div id="prof-pyramid" class="mb-6"></div>
          <div id="prof-mixed-layout" class="mb-6"></div>
          <div id="prof-grouped-column" class="mb-6"></div>
          <div id="prof-monthly-grouped" class="mb-6"></div>
        </div>
      </div>
    `;

    wrapper.innerHTML = html;

    // ── Render all Professional Visualizations ──
    if (window.Chart) {
      // 1. Population Pyramid
      const pyramidContainer = document.getElementById("prof-pyramid");
      if (pyramidContainer) {
        const ageGroups = ["<1", "1-4", "5-9", "10-14", "15-19"];
        const males = [5000, 7000, 8000, 7500, 6500];
        const females = [4800, 6800, 7800, 7200, 6200];
        renderPopulationPyramid(
          pyramidContainer,
          "Distribution by Age & Sex",
          ageGroups,
          males,
          females,
        );
      }

      // 2. Mixed Layout (Current on ART Status)
      const mixedContainer = document.getElementById("prof-mixed-layout");
      if (mixedContainer) {
        const ageGroups2 = ["<1", "1-4", "5-9", "10-14", "15-19", "20-24"];
        renderMixedLayout(
          mixedContainer,
          "Current on ART Status & Distribution",
          { verified: 80.1, not_verified: 19.9 },
          ageGroups2,
          [25000, 35000, 42000, 38000, 32000, 28000],
          [24000, 33000, 40000, 36000, 30000, 26000],
        );
      }

      // 3. Grouped Column Chart (ART vs Verified by County)
      const groupedContainer = document.getElementById("prof-grouped-column");
      if (groupedContainer) {
        const counties2 = [
          "County 1",
          "County 2",
          "County 3",
          "County 4",
          "County 5",
        ];
        const currentArt = [120000, 115000, 95000, 85000, 75000];
        const verifiedArt = [102000, 97750, 80750, 72250, 63750];
        renderGroupedColumnChart(
          groupedContainer,
          "Current on ART vs Verified by County",
          counties2,
          currentArt,
          "Current on ART",
          verifiedArt,
          "Verified Current on ART",
        );
      }

      // 4. Monthly Grouped Chart (Treatment vs HTS)
      const monthlyContainer = document.getElementById("prof-monthly-grouped");
      if (monthlyContainer) {
        const months = ["JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER"];
        const newTreatment = [5200, 5400, 4900, 5600, 5100];
        const htsPositives = [3900, 4050, 3675, 4200, 3825];
        renderMonthlyGroupedChart(
          monthlyContainer,
          "Monthly Treatment vs HTS Positives",
          months,
          newTreatment,
          "Total New on Treatment",
          htsPositives,
          "Total HTS Positives",
        );
      }
    }

    // ── Auto-load Detailed Analytics (TX_CURR or TX_NEW) ──
    if (type === "tx_curr") {
      loadTxCurrAnalytics(data);
    } else if (type === "tx_new") {
      loadTxNewAnalytics(data);
    }

    // ── Render Chart.js pyramid for latest month only ──
    if (window.Chart) {
      const latestMonth = (monthly_cards || []).slice(-1)[0] || {};
      const ageBandData = (age_bands || []).flatMap((age, i) => [
        {
          age: age,
          gender: "Male",
          value: (latestMonth.male_bands || [])[i]?.value || 0,
        },
        {
          age: age,
          gender: "Female",
          value: (latestMonth.female_bands || [])[i]?.value || 0,
        },
      ]);
      chakCreateChart(
        "chakAgeSexPyramid",
        chakDemographicPyramidChart(ageBandData, "age", "gender", "value"),
      );
    }

    // ── Render Highcharts ──
    if (window.Highcharts) {
      // Total line chart
      const totalSeries = (metrics || []).map((m) => ({
        name: m.label,
        data: trend.map((p) => p[m.key] || 0),
        color: m.color || "#6366f1",
      }));
      Highcharts.chart("dhis-chart-total", {
        chart: { type: "line", zoomType: "x" },
        title: { text: null },
        xAxis: {
          categories,
          labels: { style: { fontSize: "10px" }, rotation: -30 },
        },
        yAxis: { title: { text: "Patients" }, allowDecimals: false },
        tooltip: { shared: true, valueSuffix: " patients" },
        plotOptions: { series: { marker: { enabled: true, radius: 2 } } },
        series: totalSeries,
        credits: { enabled: false },
        exporting: { enabled: false },
        legend: {
          align: "center",
          verticalAlign: "bottom",
          itemStyle: { fontSize: "10px" },
        },
      });
    }

    // ── Hamburger menus ──
    wrapper.querySelectorAll("[data-menu-container]").forEach((section) => {
      const btn = section.querySelector(".dhis-menu-btn");
      const drop = section.querySelector(".dhis-menu-drop");
      if (!btn || !drop) return;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        wrapper.querySelectorAll(".dhis-menu-drop").forEach((d) => {
          if (d !== drop) d.classList.add("hidden");
        });
        drop.classList.toggle("hidden");
      });
    });
    document.addEventListener("click", () => {
      wrapper
        .querySelectorAll(".dhis-menu-drop")
        .forEach((d) => d.classList.add("hidden"));
    });

    // ── Menu actions ──
    wrapper.querySelectorAll("[data-dhis-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.getAttribute("data-dhis-action");
        if (action === "fullscreen-total")
          openDhisSingleFullscreen(data, "total", "📈 Total Trend", config);
        if (action === "data-table") openDhisDataModal(data, config);
      });
    });
  } else if (type === "hts_uptake") {
    // ═══════════ HTS UPTAKE: 2 separate chart cards ═══════════
    const posColor = "#dc2626";
    const numerColor = "#2563eb";

    // Chart 1: HTS TST % Positive
    html += `
      <div class="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between mb-2">
          <div>
            <div class="text-xs font-semibold text-red-700">${String.fromCodePoint(0x1f4c8)} HTS TST % Positive</div>
            <div class="text-[10px] text-red-500">Monthly positivity rate</div>
          </div>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-100 text-red-700 border border-red-300">
            <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
            % Positive
          </span>
        </div>
        <div id="dhis-chart-positivity" style="height:280px;width:100%"></div>
      </div>
    `;

    // Chart 2: HTS TST Numerator
    html += `
      <div class="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between mb-2">
          <div>
            <div class="text-xs font-semibold text-blue-700">${String.fromCodePoint(0x1f4ca)} HTS TST Numerator</div>
            <div class="text-[10px] text-blue-500">Total tested monthly</div>
          </div>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700 border border-blue-300">
            <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            Numerator
          </span>
        </div>
        <div id="dhis-chart-numerator" style="height:280px;width:100%"></div>
      </div>
    `;

    wrapper.innerHTML = html;

    // Render positivity rate chart
    if (window.Highcharts) {
      Highcharts.chart("dhis-chart-positivity", {
        chart: { type: "line", zoomType: "x" },
        title: { text: null },
        xAxis: {
          categories,
          labels: { style: { fontSize: "10px" }, rotation: -30 },
        },
        yAxis: {
          title: { text: "% Positive" },
          labels: { format: "{value}%" },
          min: 0,
        },
        tooltip: {
          valueSuffix: "%",
          valueDecimals: 1,
        },
        plotOptions: {
          line: { marker: { enabled: true, radius: 3 } },
        },
        series: [
          {
            name: "HTS TST % Positive",
            data: trend.map((p) => p.positivity_rate || 0),
            color: posColor,
            lineWidth: 3,
          },
        ],
        credits: { enabled: false },
        exporting: { enabled: false },
        legend: { enabled: false },
      });

      // Render numerator chart
      Highcharts.chart("dhis-chart-numerator", {
        chart: { type: "column", zoomType: "x" },
        title: { text: null },
        xAxis: {
          categories,
          labels: { style: { fontSize: "10px" }, rotation: -30 },
        },
        yAxis: {
          title: { text: "Number Tested" },
          allowDecimals: false,
        },
        tooltip: {
          valueSuffix: " tested",
        },
        plotOptions: {
          column: {
            borderRadius: 4,
            borderWidth: 0,
          },
        },
        series: [
          {
            name: "HTS TST Numerator",
            data: trend.map((p) => p.hts_tested || 0),
            color: numerColor,
          },
        ],
        credits: { enabled: false },
        exporting: { enabled: false },
        legend: { enabled: false },
      });
    }
  } else if (
    [
      "art_optimization",
      "dsd",
      "treatment_outcomes",
      "otz",
      "ovc",
      "covid",
      "ahd",
      "adverse_events",
    ].includes(type)
  ) {
    // ═══════════ JTP MULTI-METRIC LAYOUT ═══════════
    const hasData = (trend || []).length > 0;
    const metricsList = data.metrics || [];
    const colors = [
      "#2563eb",
      "#dc2626",
      "#059669",
      "#d97706",
      "#7c3aed",
      "#0891b2",
      "#db2777",
      "#65a30d",
      "#ea580c",
    ];
    if (!hasData) {
      html += `
        <div class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <div class="text-4xl mb-3">📭</div>
          <div class="text-sm font-semibold text-slate-600 mb-1">No ${escapeHtml(config.title)} data available</div>
          <div class="text-xs text-slate-400">DHIS2 returned no records for this indicator in ${escapeHtml(county)}</div>
        </div>
      `;
    } else {
      // ── Latest Values Summary Cards ──
      const latest = trend[trend.length - 1] || {};
      html += `
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <div>
              <div class="text-xs font-semibold text-slate-700">📊 Latest Values — ${escapeHtml(latest.label || "")}</div>
              <div class="text-[10px] text-slate-400">Most recent month from DHIS2 JTP data</div>
            </div>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
      `;
      metricsList.forEach((m, i) => {
        const val = latest[m.key] || 0;
        const c = colors[i % colors.length];
        html += `
          <div class="rounded-xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-3 shadow-sm">
            <div class="text-[10px] text-slate-500 font-medium mb-1">${escapeHtml(m.label)}</div>
            <div class="text-xl font-bold" style="color:${c}">${Number(val).toLocaleString()}</div>
          </div>
        `;
      });
      html += `</div></div>`;

      // ── Trend Chart (Multi-line) ──
      html += `
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="flex items-center justify-between mb-2">
            <div>
              <div class="text-xs font-semibold text-slate-700">📈 Monthly Trend</div>
              <div class="text-[10px] text-slate-400">All metrics over time</div>
            </div>
          </div>
          <div id="dhis-chart-jtp-trend" style="height:350px;width:100%"></div>
        </div>
      `;

      // ── Data Table at bottom ──
      html += `
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <details>
            <summary class="text-xs font-semibold text-slate-700 cursor-pointer hover:text-slate-900">📋 View Data Table</summary>
            <div class="mt-3 overflow-x-auto">
              <table class="w-full text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-50">
                    <th class="text-left py-2 px-3 font-semibold text-slate-600 border-b border-slate-200">Period</th>
                    ${metricsList.map((m) => `<th class="text-right py-2 px-3 font-semibold text-slate-600 border-b border-slate-200">${escapeHtml(m.label)}</th>`).join("")}
                  </tr>
                </thead>
                <tbody>
                  ${trend
                    .map(
                      (p) => `
                    <tr class="hover:bg-slate-50">
                      <td class="py-1.5 px-3 border-b border-slate-100 text-slate-500">${escapeHtml(p.label)}</td>
                      ${metricsList.map((m) => `<td class="text-right py-1.5 px-3 border-b border-slate-100">${Number(p[m.key] || 0).toLocaleString()}</td>`).join("")}
                    </tr>
                  `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      `;
    }

    wrapper.innerHTML = html;

    // ── Render Multi-line Highcharts ──
    if (window.Highcharts && document.getElementById("dhis-chart-jtp-trend")) {
      const categories2 = trend.map((p) => p.label);
      const series = metricsList.map((m, i) => ({
        name: m.label,
        data: trend.map((p) => p[m.key] || 0),
        color: colors[i % colors.length],
      }));
      Highcharts.chart("dhis-chart-jtp-trend", {
        chart: { type: "spline", zoomType: "x" },
        title: { text: null },
        xAxis: {
          categories: categories2,
          labels: { style: { fontSize: "10px" }, rotation: -30 },
        },
        yAxis: { title: { text: "Patients" }, allowDecimals: false, min: 0 },
        tooltip: { shared: true, valueSuffix: " patients" },
        plotOptions: { series: { marker: { enabled: true, radius: 3 } } },
        series: series,
        credits: { enabled: false },
        exporting: { enabled: false },
        legend: {
          align: "center",
          verticalAlign: "bottom",
          itemStyle: { fontSize: "10px" },
          maxHeight: 80,
        },
        responsive: {
          rules: [
            {
              condition: { maxWidth: 600 },
              chartOptions: { legend: { enabled: false } },
            },
          ],
        },
      });
    }
  } else {
    // ═══════════ VL / NON-AGE-SEX LAYOUT ═══════════
    const hasData =
      (trend || []).length > 0 || (monthly_cards || []).length > 0;
    if (!hasData) {
      html += `
        <div class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <div class="text-4xl mb-3">📭</div>
          <div class="text-sm font-semibold text-slate-600 mb-1">No ${escapeHtml(config.title)} data available</div>
          <div class="text-xs text-slate-400">DHIS2 returned no records for this indicator in ${escapeHtml(county)}</div>
        </div>
      `;
    } else {
      // ── % VL Uptake Chart ──
      html += `
        <div class="rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm">
          <div class="flex items-center justify-between mb-2">
            <div>
              <div class="text-xs font-semibold text-cyan-700">📈 % VL Uptake</div>
              <div class="text-[10px] text-cyan-500">(TX_PVLS (D) / TX_CURR) × 100</div>
            </div>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-cyan-100 text-cyan-700 border border-cyan-300">
              <span class="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
              % Uptake
            </span>
          </div>
          <div id="dhis-chart-vl-uptake" style="height:300px;width:100%"></div>
        </div>
      `;
    }

    wrapper.innerHTML = html;

    // % VL Uptake chart
    if (window.Highcharts && document.getElementById("dhis-chart-vl-uptake")) {
      Highcharts.chart("dhis-chart-vl-uptake", {
        chart: { type: "line", zoomType: "x" },
        title: { text: null },
        xAxis: {
          categories,
          labels: { style: { fontSize: "10px" }, rotation: -30 },
        },
        yAxis: {
          title: { text: "% VL Uptake" },
          labels: { format: "{value}%" },
          min: 0,
          max: 100,
          plotLines: [
            {
              value: 90,
              color: "#10b981",
              dashStyle: "dash",
              width: 2,
              label: {
                text: "Target 90%",
                style: { fontSize: "9px", color: "#10b981" },
              },
            },
          ],
        },
        tooltip: { valueSuffix: "%", valueDecimals: 1 },
        plotOptions: { line: { marker: { enabled: true, radius: 4 } } },
        series: [
          {
            name: "% VL Uptake",
            data: trend.map((p) => p.vl_uptake || 0),
            color: "#06b6d4",
            lineWidth: 3,
          },
        ],
        credits: { enabled: false },
        exporting: { enabled: false },
        legend: { enabled: false },
      });
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// DETAILED ANALYTICS VIEWS (Gender, Age, Yearly, MMD, MoM)
// ══════════════════════════════════════════════════════════════════════

const ANALYTICS_STYLES = document.createElement("style");
ANALYTICS_STYLES.textContent = `
  .dhis-analytics-btn {
    padding: 5px 12px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    background: #fff;
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .dhis-analytics-btn:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #334155;
  }
  .dhis-analytics-btn.active {
    background: #e8f4ff;
    border-color: #93c5fd;
    color: #1d4ed8;
  }
  .analytics-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  .analytics-table th {
    background: #f8fafc;
    text-align: left;
    padding: 6px 10px;
    font-weight: 600;
    color: #475569;
    border-bottom: 2px solid #e2e8f0;
  }
  .analytics-table td {
    padding: 5px 10px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
  }
  .analytics-table tr:hover td {
    background: #f8fafc;
  }
`;
document.head.appendChild(ANALYTICS_STYLES);

function fetchAnalyticsView(container, view, params, config) {
  const endpointMap = {
    gender: "/api/hiv-treatment/tx-curr-gender",
    age: "/api/hiv-treatment/tx-curr-age",
    yearly: "/api/hiv-treatment/tx-curr-yearly",
    mmd: "/api/hiv-treatment/tx-curr-mmd",
    mom: "/api/hiv-treatment/tx-curr-mom",
    "gender-split": "/api/hiv-treatment/tx-curr-gender-split",
    "age-split": "/api/hiv-treatment/tx-curr-age-split",
    regimens: "/api/hiv-treatment/jtp-regimens",
  };
  const url = endpointMap[view];
  if (!url) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-red-500">Unknown view: ${view}</div>`;
    return;
  }

  fetch(`${url}?${params}`)
    .then((r) => r.json())
    .then((d) => {
      if (!d.ok) {
        container.innerHTML = `<div class="text-center py-6 text-xs text-red-500">Error: ${d.error || "Unknown"}</div>`;
        return;
      }
      switch (view) {
        case "gender":
          renderGenderAnalytics(container, d);
          break;
        case "age":
          renderAgeAnalytics(container, d);
          break;
        case "yearly":
          renderYearlyAnalytics(container, d);
          break;
        case "mmd":
          renderMmdAnalytics(container, d);
          break;
        case "mom":
          renderMomAnalytics(container, d);
          break;
        case "gender-split":
          renderGenderSplitAnalytics(container, d);
          break;
        case "age-split":
          renderAgeSplitAnalytics(container, d);
          break;
        case "regimens":
          renderRegimensAnalytics(container, d);
          break;
        default:
          container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400">No renderer for ${view}</div>`;
      }
    })
    .catch((err) => {
      container.innerHTML = `<div class="text-center py-6 text-xs text-red-500">Failed to load: ${err.message}</div>`;
    });
}

// ── Professional Dashboard Color Palette ──────────────────────────
const DASHBOARD_COLORS = {
  primary: "#0F3D5C", // Navy blue
  secondary: "#1B7F96", // Teal
  accent: "#20B2AA", // Light teal/green
  success: "#10B981", // Emerald
  danger: "#DC3545", // Red
  warning: "#F59E0B", // Amber
  border: "#E5E7EB", // Light gray
  text: {
    primary: "#111827", // Dark gray
    secondary: "#6B7280", // Medium gray
    light: "#9CA3AF", // Light gray
  },
};

// ── Gender Analytics ──────────────────────────────────────────────
function renderGenderAnalytics(container, d) {
  const data = d.data || {};
  const entries = Object.entries(data);
  if (!entries.length) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400">No gender data available for this location.</div>`;
    return;
  }

  const sorted = entries.sort((a, b) => {
    const pa = parsePeriodLabel(a[0]);
    const pb = parsePeriodLabel(b[0]);
    return pa - pb;
  });
  const labels = sorted.map((e) => e[0]);
  const values = sorted.map((e) => e[1]);

  const latestVal = values[values.length - 1] || 0;
  const prevVal = values.length > 1 ? values[values.length - 2] : latestVal;
  const change = latestVal - prevVal;
  const changePct = prevVal ? ((change / prevVal) * 100).toFixed(1) : "0";

  container.innerHTML = `
    <div class="space-y-4">
      <div>
        <h3 class="text-sm font-semibold text-slate-900 mb-3">👫 Monthly Trend</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div class="bg-white border border-slate-200 rounded-lg p-3">
            <div class="text-xs text-slate-500 mb-1">Latest Month</div>
            <div class="text-2xl font-bold text-slate-900">${latestVal.toLocaleString()}</div>
          </div>
          <div class="bg-white border border-slate-200 rounded-lg p-3">
            <div class="text-xs text-slate-500 mb-1">Previous Month</div>
            <div class="text-2xl font-bold text-slate-700">${prevVal.toLocaleString()}</div>
          </div>
          <div class="bg-white border border-slate-200 rounded-lg p-3">
            <div class="text-xs text-slate-500 mb-1">Change</div>
            <div class="text-2xl font-bold ${change >= 0 ? "text-emerald-600" : "text-red-600"}">${change >= 0 ? "↑" : "↓"} ${Math.abs(change).toLocaleString()}</div>
            <div class="text-xs ${change >= 0 ? "text-emerald-600" : "text-red-600"}">${change >= 0 ? "+" : ""}${changePct}%</div>
          </div>
        </div>
      </div>
      <div class="bg-white border border-slate-200 rounded-lg p-4">
        <div class="analytics-chart-wrap" style="height:280px"><canvas id="analyticsGenderTrend"></canvas></div>
      </div>
    </div>
  `;

  if (window.Chart) {
    const ctx = document.getElementById("analyticsGenderTrend");
    if (ctx) {
      new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "TX_CURR",
              data: values,
              borderColor: DASHBOARD_COLORS.primary,
              backgroundColor: "rgba(15, 61, 92, 0.08)",
              fill: true,
              tension: 0.4,
              pointRadius: 5,
              pointBackgroundColor: DASHBOARD_COLORS.primary,
              pointBorderColor: "#fff",
              pointBorderWidth: 2,
              borderWidth: 2.5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "rgba(0,0,0,0.8)",
              padding: 12,
              titleFont: { size: 12, weight: "bold" },
              bodyFont: { size: 11 },
              borderColor: DASHBOARD_COLORS.border,
              borderWidth: 1,
            },
          },
          scales: {
            x: {
              ticks: {
                font: { size: 10, weight: "500" },
                color: DASHBOARD_COLORS.text.secondary,
              },
              grid: { color: "rgba(0,0,0,0.05)" },
            },
            y: {
              beginAtZero: true,
              ticks: {
                font: { size: 10, weight: "500" },
                color: DASHBOARD_COLORS.text.secondary,
              },
              grid: { color: "rgba(0,0,0,0.05)" },
            },
          },
        },
      });
    }
  }
}

// ── Age Group Analytics ────────────────────────────────────────────
function renderAgeAnalytics(container, d) {
  const data = d.data || {};
  const entries = Object.entries(data);
  if (!entries.length) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400">No age data available.</div>`;
    return;
  }

  const sorted = entries.sort((a, b) => {
    const pa = parsePeriodLabel(a[0]);
    const pb = parsePeriodLabel(b[0]);
    return pa - pb;
  });
  const labels = sorted.map((e) => e[0]);
  const values = sorted.map((e) => e[1]);

  const totalPatients = values.reduce((s, v) => s + v, 0);

  const profColors = [
    DASHBOARD_COLORS.primary,
    DASHBOARD_COLORS.secondary,
    DASHBOARD_COLORS.accent,
    "#20B2AA",
    "#48BB78",
    "#38A169",
    "#2F855A",
    "#22543D",
    "#1a3a3a",
    "#0f2f3f",
  ];

  container.innerHTML = `
    <div class="space-y-4">
      <div>
        <h3 class="text-sm font-semibold text-slate-900 mb-3">👶 Age Group Distribution</h3>
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div class="text-sm text-slate-700">Total Patients: <span class="font-bold text-slate-900">${totalPatients.toLocaleString()}</span></div>
        </div>
      </div>
      <div class="bg-white border border-slate-200 rounded-lg p-4">
        <div class="analytics-chart-wrap" style="height:300px"><canvas id="analyticsAgeChart"></canvas></div>
      </div>
    </div>
  `;

  if (window.Chart) {
    const ctx = document.getElementById("analyticsAgeChart");
    if (ctx) {
      new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Patients",
              data: values,
              backgroundColor: values.map(
                (_, i) => profColors[i % profColors.length],
              ),
              borderRadius: 4,
              borderSkipped: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "rgba(0,0,0,0.8)",
              padding: 12,
              titleFont: { size: 12, weight: "bold" },
              bodyFont: { size: 11 },
            },
          },
          scales: {
            x: {
              ticks: {
                font: { size: 10, weight: "500" },
                color: DASHBOARD_COLORS.text.secondary,
                maxRotation: -45,
              },
              grid: { display: false },
            },
            y: {
              beginAtZero: true,
              ticks: {
                font: { size: 10, weight: "500" },
                color: DASHBOARD_COLORS.text.secondary,
              },
              grid: { color: "rgba(0,0,0,0.05)" },
            },
          },
        },
      });
    }
  }
}

// ── Yearly Analytics ───────────────────────────────────────────────
function renderYearlyAnalytics(container, d) {
  const data = d.data || {};
  const entries = Object.entries(data);
  if (!entries.length) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400">No yearly data available.</div>`;
    return;
  }

  const sorted = entries.sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  const labels = sorted.map((e) => e[0]);
  const values = sorted.map((e) => e[1]);

  const yearColors = [
    DASHBOARD_COLORS.primary,
    DASHBOARD_COLORS.secondary,
    DASHBOARD_COLORS.accent,
    "#48BB78",
  ];

  container.innerHTML = `
    <div class="space-y-4">
      <h3 class="text-sm font-semibold text-slate-900">📊 Yearly Comparison</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-white border border-slate-200 rounded-lg p-4">
          <div class="analytics-chart-wrap" style="height:280px"><canvas id="analyticsYearlyBar"></canvas></div>
        </div>
        <div class="bg-white border border-slate-200 rounded-lg p-4">
          <div class="analytics-chart-wrap" style="height:280px"><canvas id="analyticsYearlyLine"></canvas></div>
        </div>
      </div>
      <div class="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 text-left font-semibold text-slate-900">Year</th>
              <th class="px-4 py-3 text-right font-semibold text-slate-900">Patients</th>
              <th class="px-4 py-3 text-right font-semibold text-slate-900">Change</th>
              <th class="px-4 py-3 text-right font-semibold text-slate-900">% Change</th>
            </tr>
          </thead>
          <tbody>
            ${sorted
              .map((e, i) => {
                const prev = i > 0 ? sorted[i - 1][1] : null;
                const chg = prev !== null ? e[1] - prev : null;
                const pct =
                  prev && prev > 0 ? ((chg / prev) * 100).toFixed(1) : null;
                const cls =
                  chg !== null
                    ? chg >= 0
                      ? "text-emerald-600"
                      : "text-red-600"
                    : "text-slate-500";
                return `<tr class="border-b border-slate-200 hover:bg-slate-50">
                  <td class="px-4 py-3 font-semibold text-slate-900">${e[0]}</td>
                  <td class="px-4 py-3 text-right text-slate-700">${e[1].toLocaleString()}</td>
                  <td class="px-4 py-3 text-right ${cls} font-semibold">${chg !== null ? (chg >= 0 ? "+" : "") + chg.toLocaleString() : "-"}</td>
                  <td class="px-4 py-3 text-right ${cls} font-semibold">${pct !== null ? (chg >= 0 ? "+" : "") + pct + "%" : "-"}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (window.Chart) {
    const barCtx = document.getElementById("analyticsYearlyBar");
    if (barCtx) {
      new Chart(barCtx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Patients",
              data: values,
              backgroundColor: values.map(
                (_, i) => yearColors[i % yearColors.length],
              ),
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                font: { size: 10 },
                color: DASHBOARD_COLORS.text.secondary,
              },
              grid: { color: "rgba(0,0,0,0.05)" },
            },
            x: {
              ticks: {
                font: { size: 10 },
                color: DASHBOARD_COLORS.text.secondary,
              },
              grid: { display: false },
            },
          },
        },
      });
    }

    const lineCtx = document.getElementById("analyticsYearlyLine");
    if (lineCtx) {
      new Chart(lineCtx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Total",
              data: values,
              borderColor: DASHBOARD_COLORS.primary,
              backgroundColor: "rgba(15,61,92,0.1)",
              fill: true,
              tension: 0.4,
              pointRadius: 6,
              pointBackgroundColor: DASHBOARD_COLORS.primary,
              pointBorderColor: "#fff",
              pointBorderWidth: 2,
              borderWidth: 2.5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                font: { size: 10 },
                color: DASHBOARD_COLORS.text.secondary,
              },
              grid: { color: "rgba(0,0,0,0.05)" },
            },
            x: {
              ticks: {
                font: { size: 10 },
                color: DASHBOARD_COLORS.text.secondary,
              },
              grid: { display: false },
            },
          },
        },
      });
    }
  }
}

// ── MMD Breakdown Analytics ────────────────────────────────────────
function renderMmdAnalytics(container, d) {
  const data = d.data || {};
  const entries = Object.entries(data);
  if (!entries.length) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400">No MMD data available.</div>`;
    return;
  }

  const regimenMap = {};
  for (const [key, val] of entries) {
    const match = key.match(/^(.+?)\s*-\s*(.+)$/) || [null, key, ""];
    const regimen = match[1].trim();
    if (!regimenMap[regimen]) regimenMap[regimen] = 0;
    regimenMap[regimen] += val;
  }

  const sortedRegimens = Object.entries(regimenMap).sort((a, b) => b[1] - a[1]);
  const labels = sortedRegimens.map((e) =>
    e[0].length > 25 ? e[0].slice(0, 23) + "…" : e[0],
  );
  const values = sortedRegimens.map((e) => e[1]);
  const total = values.reduce((s, v) => s + v, 0);

  const mmdColors = [
    DASHBOARD_COLORS.primary,
    DASHBOARD_COLORS.secondary,
    DASHBOARD_COLORS.accent,
    "#20C997",
    "#48BB78",
    "#38A169",
    "#F59E0B",
    "#DC3545",
    "#8B5FBF",
  ];

  container.innerHTML = `
    <div class="space-y-4">
      <div>
        <h3 class="text-sm font-semibold text-slate-900 mb-3">💊 Regimen Breakdown</h3>
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div class="text-sm text-slate-700">Total Patients: <span class="font-bold text-slate-900">${total.toLocaleString()}</span></div>
        </div>
      </div>
      <div class="bg-white border border-slate-200 rounded-lg p-4">
        <div class="analytics-chart-wrap" style="height:${Math.max(280, labels.length * 25)}px"><canvas id="analyticsMmdChart"></canvas></div>
      </div>
      <div class="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 text-left font-semibold text-slate-900">Regimen</th>
              <th class="px-4 py-3 text-right font-semibold text-slate-900">Patients</th>
              <th class="px-4 py-3 text-right font-semibold text-slate-900">% Share</th>
            </tr>
          </thead>
          <tbody>
            ${sortedRegimens
              .map((e) => {
                const pct = total > 0 ? ((e[1] / total) * 100).toFixed(1) : "0";
                return `<tr class="border-b border-slate-200 hover:bg-slate-50">
                  <td class="px-4 py-3 text-slate-700">${e[0]}</td>
                  <td class="px-4 py-3 text-right font-semibold text-slate-900">${e[1].toLocaleString()}</td>
                  <td class="px-4 py-3 text-right text-slate-700">${pct}%</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (window.Chart) {
    const ctx = document.getElementById("analyticsMmdChart");
    if (ctx) {
      new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Patients",
              data: values,
              backgroundColor: values.map(
                (_, i) => mmdColors[i % mmdColors.length],
              ),
              borderRadius: 4,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              beginAtZero: true,
              ticks: {
                font: { size: 10 },
                color: DASHBOARD_COLORS.text.secondary,
              },
              grid: { color: "rgba(0,0,0,0.05)" },
            },
            y: {
              ticks: {
                font: { size: 9 },
                color: DASHBOARD_COLORS.text.secondary,
              },
              grid: { display: false },
            },
          },
        },
      });
    }
  }
}

// ── Month-on-Month Change Analytics ────────────────────────────────
function renderMomAnalytics(container, d) {
  const changes = d.changes || [];
  if (!changes.length) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400">No month-on-month data available.</div>`;
    return;
  }

  const labels = changes.map((c) => c.period);
  const chgValues = changes.map((c) => c.change);
  const pctValues = changes.map((c) => c.change_pct);

  const posCount = chgValues.filter((v) => v >= 0).length;
  const negCount = chgValues.filter((v) => v < 0).length;
  const avgChg = chgValues.length
    ? (chgValues.reduce((s, v) => s + v, 0) / chgValues.length).toFixed(0)
    : "0";

  container.innerHTML = `
    <div class="space-y-4">
      <h3 class="text-sm font-semibold text-slate-900">📊 Month-on-Month Change</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div class="bg-white border border-slate-200 rounded-lg p-3">
          <div class="text-xs text-slate-500 mb-1">Months Analyzed</div>
          <div class="text-2xl font-bold text-slate-900">${changes.length}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-lg p-3">
          <div class="text-xs text-slate-500 mb-1">Increases (↑)</div>
          <div class="text-2xl font-bold text-emerald-600">${posCount}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-lg p-3">
          <div class="text-xs text-slate-500 mb-1">Decreases (↓)</div>
          <div class="text-2xl font-bold text-red-600">${negCount}</div>
        </div>
      </div>
      <div class="bg-white border border-slate-200 rounded-lg p-4">
        <div class="analytics-chart-wrap" style="height:280px"><canvas id="analyticsMomChart"></canvas></div>
      </div>
      <div class="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 text-left font-semibold text-slate-900">Period</th>
              <th class="px-4 py-3 text-right font-semibold text-slate-900">Current</th>
              <th class="px-4 py-3 text-right font-semibold text-slate-900">Previous</th>
              <th class="px-4 py-3 text-right font-semibold text-slate-900">Change</th>
              <th class="px-4 py-3 text-right font-semibold text-slate-900">%</th>
            </tr>
          </thead>
          <tbody>
            ${changes
              .map((c) => {
                const cls = c.change >= 0 ? "text-emerald-600" : "text-red-600";
                return `<tr class="border-b border-slate-200 hover:bg-slate-50">
                  <td class="px-4 py-3 font-semibold text-slate-900">${c.period}</td>
                  <td class="px-4 py-3 text-right text-slate-700">${c.current.toLocaleString()}</td>
                  <td class="px-4 py-3 text-right text-slate-700">${c.previous.toLocaleString()}</td>
                  <td class="px-4 py-3 text-right font-semibold ${cls}">${c.change >= 0 ? "+" : ""}${c.change.toLocaleString()}</td>
                  <td class="px-4 py-3 text-right font-semibold ${cls}">${c.change_pct >= 0 ? "+" : ""}${c.change_pct}%</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const barColors = chgValues.map((v) =>
    v >= 0 ? DASHBOARD_COLORS.success : DASHBOARD_COLORS.danger,
  );

  if (window.Chart) {
    const ctx = document.getElementById("analyticsMomChart");
    if (ctx) {
      new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Change",
              data: chgValues,
              backgroundColor: barColors,
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              ticks: {
                font: { size: 9 },
                color: DASHBOARD_COLORS.text.secondary,
                maxRotation: -45,
              },
              grid: { display: false },
            },
            y: {
              ticks: {
                font: { size: 10 },
                color: DASHBOARD_COLORS.text.secondary,
              },
              grid: { color: "rgba(0,0,0,0.05)" },
            },
          },
        },
      });
    }
  }
}

// ── TX_CURR Gender Split Donut Chart ───────────────────────────────
function renderGenderSplitAnalytics(container, d, labelPrefix) {
  labelPrefix = labelPrefix || "TX_CURR";
  if (!d.ok) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-red-500">Error: ${d.error || "Unknown"}</div>`;
    return;
  }
  const male = d.male || 0;
  const female = d.female || 0;
  const total = d.total || 0;
  const period = d.latest_period || "";

  container.innerHTML = `
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-900">👫 ${labelPrefix} by Gender</h3>
        <span class="text-[10px] text-slate-400">${period}</span>
      </div>
      <div class="flex items-center gap-3">
        <div class="w-[160px] h-[160px] flex-shrink-0"><canvas id="genderSplitDonut"></canvas></div>
        <div class="flex-1 space-y-2">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1.5 text-xs"><span class="w-2.5 h-2.5 rounded-full bg-pink-400"></span> Female</span>
            <span class="text-sm font-bold text-slate-900">${female.toLocaleString()}</span>
            <span class="text-xs text-slate-500">${total > 0 ? ((female / total) * 100).toFixed(1) : 0}%</span>
          </div>
          <div class="w-full bg-slate-200 rounded-full h-2">
            <div class="bg-pink-400 h-2 rounded-full" style="width:${total > 0 ? (female / total) * 100 : 0}%"></div>
          </div>
          <div class="flex items-center justify-between mt-2">
            <span class="flex items-center gap-1.5 text-xs"><span class="w-2.5 h-2.5 rounded-full bg-blue-400"></span> Male</span>
            <span class="text-sm font-bold text-slate-900">${male.toLocaleString()}</span>
            <span class="text-xs text-slate-500">${total > 0 ? ((male / total) * 100).toFixed(1) : 0}%</span>
          </div>
          <div class="w-full bg-slate-200 rounded-full h-2">
            <div class="bg-blue-400 h-2 rounded-full" style="width:${total > 0 ? (male / total) * 100 : 0}%"></div>
          </div>
          <div class="pt-2 border-t border-slate-100 flex justify-between">
            <span class="text-xs text-slate-500 font-medium">Total</span>
            <span class="text-sm font-bold text-slate-900">${total.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  if (window.Chart) {
    const ctx = document.getElementById("genderSplitDonut");
    if (ctx) {
      new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["Female", "Male"],
          datasets: [
            {
              data: [female, male],
              backgroundColor: ["#f472b6", "#60a5fa"],
              borderWidth: 2,
              borderColor: "#fff",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: "60%",
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const val = ctx.parsed || 0;
                  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                  return `${ctx.label}: ${val.toLocaleString()} (${pct}%)`;
                },
              },
            },
          },
        },
      });
    }
  }
}

// ── TX_CURR Age Split Bar Chart ────────────────────────────────────
function renderAgeSplitAnalytics(container, d, labelPrefix) {
  labelPrefix = labelPrefix || "TX_CURR";
  if (!d.ok) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-red-500">Error: ${d.error || "Unknown"}</div>`;
    return;
  }
  const ageData = d.age_data || [];
  const period = d.latest_period || "";

  if (!ageData.length) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400">No age data available.</div>`;
    return;
  }

  const labels = ageData.map((a) => a.age);
  const values = ageData.map((a) => a.value);
  const total = values.reduce((s, v) => s + v, 0);

  container.innerHTML = `
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-900">📊 ${labelPrefix} by Finer Age-Group</h3>
        <span class="text-[10px] text-slate-400">${period}</span>
      </div>
      <div class="bg-white border border-slate-200 rounded-lg p-3">
        <div style="height:260px"><canvas id="ageSplitChart"></canvas></div>
      </div>
      <div class="grid grid-cols-5 gap-2">
        ${ageData
          .map(
            (a) => `
          <div class="bg-slate-50 rounded-lg p-2 text-center">
            <div class="text-[9px] text-slate-500">${a.age}</div>
            <div class="text-xs font-bold text-slate-900">${a.value.toLocaleString()}</div>
            <div class="text-[9px] text-slate-400">${total > 0 ? ((a.value / total) * 100).toFixed(1) : 0}%</div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `;

  if (window.Chart) {
    const ctx = document.getElementById("ageSplitChart");
    if (ctx) {
      const gradientColors = values.map((_, i) => {
        const t = i / values.length;
        const r = Math.round(99 + t * (59 - 99));
        const g = Math.round(182 + t * (130 - 182));
        const b = Math.round(246 + t * (246 - 246));
        return `rgb(${r},${g},${b})`;
      });
      new Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Patients",
              data: values,
              backgroundColor: gradientColors,
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: "x",
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const v = ctx.parsed.y || 0;
                  const pct = total > 0 ? ((v / total) * 100).toFixed(1) : 0;
                  return `${v.toLocaleString()} patients (${pct}%)`;
                },
              },
            },
          },
          scales: {
            x: {
              ticks: { font: { size: 9 }, color: "#64748b" },
              grid: { display: false },
            },
            y: {
              ticks: { font: { size: 9 }, color: "#64748b" },
              grid: { color: "rgba(0,0,0,0.05)" },
              beginAtZero: true,
            },
          },
        },
      });
    }
  }
}

// ── JTP Regimen Distribution Donut Chart ───────────────────────────
function renderRegimensAnalytics(container, d) {
  if (!d.ok) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-red-500">Error: ${d.error || "Unknown"}</div>`;
    return;
  }
  const regimens = (d.regimens || []).filter((r) => r.value > 0);
  const period = d.latest_period || "";

  if (!regimens.length) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400">No regimen data available.</div>`;
    return;
  }

  const labels = regimens.map((r) => r.label);
  const values = regimens.map((r) => r.value);
  const total = regimens.reduce((s, r) => s + r.value, 0);

  const REGIMEN_COLORS = [
    "#6366f1", // Indigo - 1st Line
    "#8b5cf6", // Violet - 2nd Line
    "#a855f7", // Purple - 3rd Line
    "#06b6d4", // Cyan - DTG
    "#10b981", // Emerald - Eligible DTG
    "#f59e0b", // Amber - EFV-600
    "#f97316", // Orange - EFV-400
    "#ef4444", // Red - PI
    "#ec4899", // Pink - Viremia
  ];

  container.innerHTML = `
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-900">💊 JTP Regimen Distribution</h3>
        <span class="text-[10px] text-slate-400">${period}</span>
      </div>
      <div class="flex flex-col md:flex-row items-center gap-4">
        <div class="w-[180px] h-[180px] flex-shrink-0"><canvas id="regimensDonut"></canvas></div>
        <div class="flex-1 space-y-1.5 w-full">
          ${regimens
            .map(
              (r, i) => `
            <div class="flex items-center justify-between text-xs">
              <span class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full" style="background:${REGIMEN_COLORS[i % REGIMEN_COLORS.length]}"></span>
                ${r.label}
              </span>
              <span class="font-semibold text-slate-900">${r.value.toLocaleString()}</span>
              <span class="text-slate-400">${((r.value / total) * 100).toFixed(1)}%</span>
            </div>
            <div class="w-full bg-slate-200 rounded-full h-1.5">
              <div class="h-1.5 rounded-full" style="width:${(r.value / total) * 100}%;background:${REGIMEN_COLORS[i % REGIMEN_COLORS.length]}"></div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
      <div class="text-center text-xs text-slate-400 font-medium">Total: ${total.toLocaleString()} patients</div>
    </div>
  `;

  if (window.Chart) {
    const ctx = document.getElementById("regimensDonut");
    if (ctx) {
      new Chart(ctx, {
        type: "doughnut",
        data: {
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: REGIMEN_COLORS.slice(0, labels.length),
              borderWidth: 2,
              borderColor: "#fff",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: "55%",
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const val = ctx.parsed || 0;
                  const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                  return `${ctx.label}: ${val.toLocaleString()} (${pct}%)`;
                },
              },
            },
          },
        },
      });
    }
  }
}

// ── Helper: Parse period label like "April 2025" to Date ──
function parsePeriodLabel(label) {
  try {
    const d = new Date(label);
    if (!isNaN(d)) return d;
    const months = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };
    const parts = label.split(" ");
    if (parts.length >= 2) {
      const m = months[parts[0].toLowerCase().slice(0, 3)];
      if (m !== undefined) return new Date(parseInt(parts[1]), m);
    }
    return new Date(0);
  } catch {
    return new Date(0);
  }
}

// ── Auto-load TX_CURR analytics charts (fires after HTML render) ──
function loadTxCurrAnalytics(data) {
  const locationParams = new URLSearchParams();
  locationParams.set("county", data.county || "Meru County");
  if (data.subcounty) locationParams.set("subcounty", data.subcounty);
  if (data.facility) locationParams.set("facility", data.facility);
  const params = locationParams.toString();
  const cfg = {}; // dummy config, not used by renderers

  const views = [
    { id: "tx-curr-analytics-gender", view: "gender" },
    { id: "tx-curr-analytics-age", view: "age" },
    { id: "tx-curr-analytics-yearly", view: "yearly" },
    { id: "tx-curr-analytics-mmd", view: "mmd" },
    { id: "tx-curr-analytics-mom", view: "mom" },
    { id: "tx-curr-analytics-gender-split", view: "gender-split" },
    { id: "tx-curr-analytics-age-split", view: "age-split" },
    { id: "tx-curr-analytics-regimens", view: "regimens" },
  ];

  // Fire all 8 fetches in parallel — each renders into its container
  views.forEach(({ id, view }) => {
    const container = document.getElementById(id);
    if (!container) return;
    fetchAnalyticsView(container, view, params, cfg);
  });
}

// ── Auto-load TX_NEW analytics charts ────────────────────────────
function loadTxNewAnalytics(data) {
  const locationParams = new URLSearchParams();
  locationParams.set("county", data.county || "Meru County");
  if (data.subcounty) locationParams.set("subcounty", data.subcounty);
  if (data.facility) locationParams.set("facility", data.facility);
  const params = locationParams.toString();

  const views = [
    {
      id: "tx-new-analytics-gender-split",
      endpoint: "/api/hiv-treatment/tx-new-gender-split",
      renderer: "gender-split",
    },
    {
      id: "tx-new-analytics-age-split",
      endpoint: "/api/hiv-treatment/tx-new-age-split",
      renderer: "age-split",
    },
  ];

  views.forEach(({ id, endpoint, renderer }) => {
    const container = document.getElementById(id);
    if (!container) return;
    fetch(`${endpoint}?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          container.innerHTML = `<div class="text-center py-6 text-xs text-red-500">Error: ${d.error || "Unknown"}</div>`;
          return;
        }
        if (renderer === "gender-split")
          renderGenderSplitAnalytics(container, d, "TX_NEW");
        else if (renderer === "age-split")
          renderAgeSplitAnalytics(container, d, "TX_NEW");
      })
      .catch((err) => {
        container.innerHTML = `<div class="text-center py-6 text-xs text-red-500">Failed: ${err.message}</div>`;
      });
  });
}

// ══════════════════════════════════════════════════════════════════════
// PROFESSIONAL CHART VISUALIZATIONS FROM run.py
// ══════════════════════════════════════════════════════════════════════

// Chart 1 & 9: Three Side-by-Side Donut Charts
function renderThreeDonutCharts(container, title, data) {
  if (!container) return;
  const labels = ["ENROLLED", "NOT ENROLLED"];
  const chartHTML = `
    <div class="space-y-3">
      <h3 class="text-sm font-semibold text-slate-900">${title}</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        ${["OVERALL", "MALE", "FEMALE"]
          .map(
            (label, idx) => `
          <div class="bg-white border border-slate-200 rounded-lg p-4">
            <div class="text-xs text-slate-600 mb-3 text-center font-semibold">${label}</div>
            <div style="height:200px"><canvas id="donut-${label.toLowerCase()}-${Date.now()}"></canvas></div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
  container.innerHTML = chartHTML;

  if (window.Chart) {
    ["OVERALL", "MALE", "FEMALE"].forEach((label, idx) => {
      const canvasId = `donut-${label.toLowerCase()}-${Date.now()}`;
      const ctx = document.getElementById(canvasId);
      if (ctx) {
        new Chart(ctx, {
          type: "doughnut",
          data: {
            labels,
            datasets: [
              {
                data: [80, 20],
                backgroundColor: ["#008000", "#CC0000"],
                borderColor: "#fff",
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } },
          },
        });
      }
    });
  }
}

// Chart 2: Vertical Descending Bar Chart
function renderDescentingBarChart(container, title, categories, values) {
  if (!container) return;
  const sorted = categories
    .map((cat, i) => ({ cat, val: values[i] }))
    .sort((a, b) => b.val - a.val);
  const sortedCats = sorted.map((s) => s.cat);
  const sortedVals = sorted.map((s) => s.val);

  const chartHTML = `
    <div class="bg-white border border-slate-200 rounded-lg p-4">
      <h3 class="text-sm font-semibold text-slate-900 mb-3">${title}</h3>
      <div style="height:350px"><canvas id="bar-descending-${Date.now()}"></canvas></div>
    </div>
  `;
  container.innerHTML = chartHTML;

  if (window.Chart) {
    const canvasId = `bar-descending-${Date.now()}`;
    const ctx = document.getElementById(canvasId);
    if (ctx) {
      new Chart(ctx, {
        type: "bar",
        data: {
          labels: sortedCats,
          datasets: [
            {
              label: "Number of Patients",
              data: sortedVals,
              backgroundColor: "#0b0b45",
              borderRadius: 4,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true } },
        },
      });
    }
  }
}

// Chart 3 & 8: Population Pyramids (Diverging Bars)
function renderPopulationPyramid(
  container,
  title,
  ageGroups,
  maleData,
  femaleData,
) {
  if (!container) return;
  const chartHTML = `
    <div class="bg-white border border-slate-200 rounded-lg p-4">
      <h3 class="text-sm font-semibold text-slate-900 mb-3">${title}</h3>
      <div style="height:300px"><canvas id="pyramid-${Date.now()}"></canvas></div>
    </div>
  `;
  container.innerHTML = chartHTML;

  if (window.Chart) {
    const canvasId = `pyramid-${Date.now()}`;
    const ctx = document.getElementById(canvasId);
    if (ctx) {
      new Chart(ctx, {
        type: "bar",
        data: {
          labels: ageGroups,
          datasets: [
            {
              label: "Male",
              data: maleData.map((v) => -v),
              backgroundColor: "#0b0b45",
              borderRadius: 4,
            },
            {
              label: "Female",
              data: femaleData,
              backgroundColor: "#e64c8a",
              borderRadius: 4,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { stacked: false } },
          plugins: { legend: { position: "top" } },
        },
      });
    }
  }
}

// Chart 4: Vertical Bar with Percentage Labels
function renderPercentageBarChart(container, title, categories, percentages) {
  if (!container) return;
  const chartHTML = `
    <div class="bg-white border border-slate-200 rounded-lg p-4">
      <h3 class="text-sm font-semibold text-slate-900 mb-3">${title}</h3>
      <div style="height:300px"><canvas id="bar-pct-${Date.now()}"></canvas></div>
    </div>
  `;
  container.innerHTML = chartHTML;

  if (window.Chart) {
    const canvasId = `bar-pct-${Date.now()}`;
    const ctx = document.getElementById(canvasId);
    if (ctx) {
      const chartInstance = new Chart(ctx, {
        type: "bar",
        data: {
          labels: categories,
          datasets: [
            {
              label: "Percentage (%)",
              data: percentages,
              backgroundColor: "#0b0b45",
              borderRadius: 4,
            },
          ],
        },
        options: {
          indexAxis: "x",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            datalabels: {
              anchor: "end",
              align: "top",
              color: "#0b0b45",
              font: { weight: "bold" },
            },
          },
          scales: { y: { max: 100, beginAtZero: true } },
        },
      });
    }
  }
}

// Chart 5: Mixed Layout - Donut + Pyramid
function renderMixedLayout(
  container,
  title,
  donutData,
  pyramidAges,
  pyramidMales,
  pyramidFemales,
) {
  if (!container) return;
  const chartHTML = `
    <div class="space-y-3">
      <h3 class="text-sm font-semibold text-slate-900">${title}</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-white border border-slate-200 rounded-lg p-4">
          <div style="height:250px"><canvas id="mixed-donut-${Date.now()}"></canvas></div>
        </div>
        <div class="bg-white border border-slate-200 rounded-lg p-4">
          <div style="height:250px"><canvas id="mixed-pyramid-${Date.now()}"></canvas></div>
        </div>
      </div>
    </div>
  `;
  container.innerHTML = chartHTML;

  if (window.Chart) {
    const donutId = `mixed-donut-${Date.now()}`;
    const pyramidId = `mixed-pyramid-${Date.now()}`;

    const donutCtx = document.getElementById(donutId);
    if (donutCtx) {
      new Chart(donutCtx, {
        type: "doughnut",
        data: {
          labels: ["VERIFIED", "NOT VERIFIED"],
          datasets: [
            {
              data: [80.1, 19.9],
              backgroundColor: ["#2cb385", "#0b0b45"],
              borderColor: "#fff",
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
        },
      });
    }

    const pyramidCtx = document.getElementById(pyramidId);
    if (pyramidCtx) {
      new Chart(pyramidCtx, {
        type: "bar",
        data: {
          labels: pyramidAges,
          datasets: [
            {
              label: "Male",
              data: pyramidMales.map((v) => -v),
              backgroundColor: "#0b0b45",
              borderRadius: 4,
            },
            {
              label: "Female",
              data: pyramidFemales,
              backgroundColor: "#e64c8a",
              borderRadius: 4,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { stacked: false } },
          plugins: { legend: { position: "top" } },
        },
      });
    }
  }
}

// Chart 6: Two Stacked Bar Charts
function renderStackedBarCharts(
  container,
  title,
  ageGroups,
  femaleData,
  maleData,
) {
  if (!container) return;
  const chartHTML = `
    <div class="space-y-3">
      <h3 class="text-sm font-semibold text-slate-900">${title}</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${["CHILDREN <15 ON ART", "ADULTS 15+ ON ART"]
          .map(
            (label, idx) => `
          <div class="bg-white border border-slate-200 rounded-lg p-4">
            <div class="text-xs text-slate-600 mb-2 font-semibold">${label}</div>
            <div style="height:250px"><canvas id="stacked-${idx}-${Date.now()}"></canvas></div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `;
  container.innerHTML = chartHTML;

  if (window.Chart) {
    [0, 1].forEach((idx) => {
      const canvasId = `stacked-${idx}-${Date.now()}`;
      const ctx = document.getElementById(canvasId);
      if (ctx) {
        new Chart(ctx, {
          type: "bar",
          data: {
            labels: ageGroups,
            datasets: [
              {
                label: "Female",
                data: femaleData,
                backgroundColor: "#e64c8a",
                borderRadius: 4,
              },
              {
                label: "Male",
                data: maleData,
                backgroundColor: "#0b0b45",
                borderRadius: 4,
              },
            ],
          },
          options: {
            indexAxis: "x",
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true } },
            plugins: { legend: { position: "bottom" } },
          },
        });
      }
    });
  }
}

// Chart 7: Grouped Column Chart
function renderGroupedColumnChart(
  container,
  title,
  categories,
  dataset1,
  label1,
  dataset2,
  label2,
) {
  if (!container) return;
  const chartHTML = `
    <div class="bg-white border border-slate-200 rounded-lg p-4">
      <h3 class="text-sm font-semibold text-slate-900 mb-3">${title}</h3>
      <div style="height:350px"><canvas id="grouped-${Date.now()}"></canvas></div>
    </div>
  `;
  container.innerHTML = chartHTML;

  if (window.Chart) {
    const canvasId = `grouped-${Date.now()}`;
    const ctx = document.getElementById(canvasId);
    if (ctx) {
      new Chart(ctx, {
        type: "bar",
        data: {
          labels: categories,
          datasets: [
            {
              label: label1,
              data: dataset1,
              backgroundColor: "#0b0b45",
              borderRadius: 4,
            },
            {
              label: label2,
              data: dataset2,
              backgroundColor: "#519e48",
              borderRadius: 4,
            },
          ],
        },
        options: {
          indexAxis: "x",
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { stacked: false } },
          plugins: { legend: { position: "bottom" } },
        },
      });
    }
  }
}

// Chart 10: Monthly Grouped Columns with Labels
function renderMonthlyGroupedChart(
  container,
  title,
  months,
  dataset1,
  label1,
  dataset2,
  label2,
) {
  if (!container) return;
  const chartHTML = `
    <div class="bg-white border border-slate-200 rounded-lg p-4">
      <h3 class="text-sm font-semibold text-slate-900 mb-3">${title}</h3>
      <div style="height:320px"><canvas id="monthly-${Date.now()}"></canvas></div>
    </div>
  `;
  container.innerHTML = chartHTML;

  if (window.Chart) {
    const canvasId = `monthly-${Date.now()}`;
    const ctx = document.getElementById(canvasId);
    if (ctx) {
      new Chart(ctx, {
        type: "bar",
        data: {
          labels: months,
          datasets: [
            {
              label: label1,
              data: dataset1,
              backgroundColor: "#0b0b45",
              borderRadius: 4,
            },
            {
              label: label2,
              data: dataset2,
              backgroundColor: "#2cb385",
              borderRadius: 4,
            },
          ],
        },
        options: {
          indexAxis: "x",
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { stacked: false } },
          plugins: {
            legend: { position: "bottom" },
            datalabels: {
              anchor: "end",
              align: "top",
              color: "#000",
              font: { size: 9, weight: "bold" },
            },
          },
        },
      });
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// JAMII TEKELEZI PAGE
// ══════════════════════════════════════════════════════════════════════

async function renderJamiiPage(container, activeSlug) {
  if (activeSlug === "overview") {
    renderJamiiOverview(container);
  } else if (activeSlug === "tx-curr-analytics") {
    renderJamiiTxCurrAnalytics(container);
  } else {
    container.innerHTML = `<div class="text-center py-12 text-sm text-slate-500">Select a view above.</div>`;
  }
}

async function renderJamiiOverview(container) {
  container.innerHTML = `
    <div class="flex items-center justify-center py-16 text-slate-500 text-sm gap-2">
      <div class="w-5 h-5 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
      Loading Jamii Tekelezi overview…
    </div>
  `;
  try {
    const county =
      state.countyFilter !== "all" ? state.countyFilter : "Meru County";
    const resp = await fetch(
      `/api/homepage/summary?county=${encodeURIComponent(county)}&period=LAST_12_MONTHS`,
    );
    const d = await resp.json();
    if (d.error) throw new Error(d.error);

    const txCurrData = d.tx_curr || {};
    const txNewData = d.tx_new || {};
    const entries = Object.entries(txCurrData).sort(
      (a, b) => parsePeriodLabel(a[0]) - parsePeriodLabel(b[0]),
    );
    const txNewEntries = Object.entries(txNewData).sort(
      (a, b) => parsePeriodLabel(a[0]) - parsePeriodLabel(b[0]),
    );

    const latestVal = entries.length ? entries[entries.length - 1][1] : 0;
    const prevVal =
      entries.length > 1 ? entries[entries.length - 2][1] : latestVal;
    const txNewLatest = txNewEntries.length
      ? txNewEntries[txNewEntries.length - 1][1]
      : 0;
    const txNewPrev =
      txNewEntries.length > 1
        ? txNewEntries[txNewEntries.length - 2][1]
        : txNewLatest;

    container.innerHTML = `
      <!-- Header -->
      <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-2xl">🏥</span>
          <div>
            <div class="text-sm font-bold text-slate-800">Jamii Tekelezi Project Dashboard</div>
            <div class="text-[10px] text-slate-400 uppercase tracking-wider">HIV Programme Monitoring · CHAK</div>
          </div>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
          <div class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">TX_CURR Latest</div>
          <div class="text-2xl font-bold text-slate-800 mt-1">${latestVal.toLocaleString()}</div>
          <div class="text-xs ${latestVal >= prevVal ? "text-emerald-600" : "text-red-600"} mt-0.5">
            ${latestVal >= prevVal ? "▲" : "▼"} ${Math.abs(latestVal - prevVal).toLocaleString()} vs prev
          </div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
          <div class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">TX_NEW Latest</div>
          <div class="text-2xl font-bold text-slate-800 mt-1">${txNewLatest.toLocaleString()}</div>
          <div class="text-xs ${txNewLatest >= txNewPrev ? "text-emerald-600" : "text-red-600"} mt-0.5">
            ${txNewLatest >= txNewPrev ? "▲" : "▼"} ${Math.abs(txNewLatest - txNewPrev).toLocaleString()} vs prev
          </div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
          <div class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Periods</div>
          <div class="text-2xl font-bold text-slate-800 mt-1">${entries.length}</div>
          <div class="text-xs text-slate-400 mt-0.5">months of data</div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
          <div class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Location</div>
          <div class="text-base font-bold text-slate-800 mt-1">${county}</div>
          <div class="text-xs text-slate-400 mt-0.5">${state.facilityFilter !== "all" ? state.facilityFilter : state.subCountyFilter !== "all" ? state.subCountyFilter : "All"}</div>
        </div>
      </div>

      <!-- TX_CURR Trend Chart -->
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="text-xs font-semibold text-slate-700 mb-2">📈 TX_CURR Monthly Trend</div>
        <div style="height:300px"><canvas id="jamiiTrendChart"></canvas></div>
      </div>

      <!-- Quick Links -->
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="text-xs font-semibold text-slate-700 mb-2">🔍 Quick Links</div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
          <a href="#" class="jamii-quick-link block rounded-xl border border-slate-100 bg-slate-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition" data-tab="tx-curr-analytics">
            <div class="text-lg mb-1">💊</div>
            <div class="text-xs font-semibold text-slate-700">TX_CURR Analytics</div>
            <div class="text-[10px] text-slate-400">Gender, Age, MMD, Yearly views</div>
          </a>
          <a href="#" class="jamii-quick-link block rounded-xl border border-slate-100 bg-slate-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition" data-tab="hiv_treatment">
            <div class="text-lg mb-1">🧬</div>
            <div class="text-xs font-semibold text-slate-700">HIV Treatment</div>
            <div class="text-[10px] text-slate-400">Age-sex pyramid, monthly breakdown</div>
          </a>
          <a href="#" class="jamii-quick-link block rounded-xl border border-slate-100 bg-slate-50 p-3 hover:bg-blue-50 hover:border-blue-200 transition" data-tab="hiv_testing">
            <div class="text-lg mb-1">🧪</div>
            <div class="text-xs font-semibold text-slate-700">HIV Testing</div>
            <div class="text-[10px] text-slate-400">Uptake, Linkage, Partner Notification</div>
          </a>
        </div>
      </div>
    `;

    // Quick link handlers
    container.querySelectorAll(".jamii-quick-link").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const tab = el.getAttribute("data-tab");
        if (tab === "tx-curr-analytics") {
          state.activeSubtabs["jamii"] = "tx-curr-analytics";
          renderJamiiPage(container, "tx-curr-analytics");
        } else {
          state.activePage = tab;
          setPageHash(tab);
          renderCurrentView();
        }
      });
    });

    // Render trend chart
    if (window.Chart) {
      const ctx = document.getElementById("jamiiTrendChart");
      if (ctx) {
        new Chart(ctx, {
          type: "line",
          data: {
            labels: entries.map((e) => e[0]),
            datasets: [
              {
                label: "TX_CURR",
                data: entries.map((e) => e[1]),
                borderColor: "#0F3D5C",
                backgroundColor: "rgba(15,61,92,0.06)",
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: "#0F3D5C",
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) =>
                    `Patients: ${parseInt(ctx.raw).toLocaleString()}`,
                },
              },
            },
            scales: {
              x: { ticks: { font: { size: 9 }, maxRotation: -45 } },
              y: { beginAtZero: true, ticks: { font: { size: 9 } } },
            },
          },
        });
      }
    }
  } catch (err) {
    container.innerHTML = `<div class="rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
      <div class="text-red-500 text-sm">⚠️ Error loading Jamii overview: ${escapeHtml(err.message)}</div>
    </div>`;
  }
}

async function renderJamiiTxCurrAnalytics(container) {
  container.innerHTML = `
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="text-xs font-semibold text-slate-700 mb-1">💊 TX_CURR Analytics</div>
      <div class="text-[10px] text-slate-400 mb-3">Detailed TX_CURR analysis views powered by live DHIS2 data</div>
      <div class="flex flex-wrap gap-1.5 mb-3" id="jamii-analytics-tabs">
        <button class="dhis-analytics-btn active" data-view="trend">📈 Trend</button>
        <button class="dhis-analytics-btn" data-view="gender">👫 Gender</button>
        <button class="dhis-analytics-btn" data-view="age">👶 Age</button>
        <button class="dhis-analytics-btn" data-view="yearly">📅 Yearly</button>
        <button class="dhis-analytics-btn" data-view="mmd">💊 MMD</button>
        <button class="dhis-analytics-btn" data-view="mom">📊 MoM</button>
      </div>
      <div id="jamii-analytics-container" class="min-h-[150px]">
        <div class="flex items-center justify-center py-10 text-slate-400 text-xs">Select a view above</div>
      </div>
    </div>
  `;

  const tabsEl = document.getElementById("jamii-analytics-tabs");
  const analyticsContainer = document.getElementById(
    "jamii-analytics-container",
  );
  if (!tabsEl || !analyticsContainer) return;

  const locationParams = new URLSearchParams();
  locationParams.set(
    "county",
    state.countyFilter !== "all" ? state.countyFilter : "Meru County",
  );
  if (state.subCountyFilter !== "all")
    locationParams.set("subcounty", state.subCountyFilter);
  if (state.facilityFilter !== "all")
    locationParams.set("facility", state.facilityFilter);

  tabsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".dhis-analytics-btn");
    if (!btn) return;
    const view = btn.getAttribute("data-view");
    if (!view) return;

    tabsEl
      .querySelectorAll(".dhis-analytics-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    analyticsContainer.innerHTML = `<div class="flex items-center justify-center py-10 text-slate-400 text-xs"><div class="w-5 h-5 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin mr-2"></div>Loading...</div>`;

    if (view === "trend") {
      renderJamiiTrendView(analyticsContainer, locationParams.toString());
    } else {
      const endpointMap = {
        gender: "/api/hiv-treatment/tx-curr-gender",
        age: "/api/hiv-treatment/tx-curr-age",
        yearly: "/api/hiv-treatment/tx-curr-yearly",
        mmd: "/api/hiv-treatment/tx-curr-mmd",
        mom: "/api/hiv-treatment/tx-curr-mom",
      };
      const url = endpointMap[view];
      if (!url) return;
      fetch(`${url}?${locationParams.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          if (!d.ok) {
            analyticsContainer.innerHTML = `<div class="text-center py-6 text-xs text-red-500">Error</div>`;
            return;
          }
          switch (view) {
            case "gender":
              renderGenderAnalytics(analyticsContainer, d);
              break;
            case "age":
              renderAgeAnalytics(analyticsContainer, d);
              break;
            case "yearly":
              renderYearlyAnalytics(analyticsContainer, d);
              break;
            case "mmd":
              renderMmdAnalytics(analyticsContainer, d);
              break;
            case "mom":
              renderMomAnalytics(analyticsContainer, d);
              break;
          }
        })
        .catch((err) => {
          analyticsContainer.innerHTML = `<div class="text-center py-6 text-xs text-red-500">${escapeHtml(err.message)}</div>`;
        });
    }
  });

  // Trigger default view (trend)
  setTimeout(() => {
    const defaultBtn = tabsEl.querySelector('[data-view="trend"]');
    if (defaultBtn) defaultBtn.click();
  }, 50);
}

async function renderJamiiTrendView(container, params) {
  try {
    const resp = await fetch(`/api/hiv-treatment/tx-curr-mom?${params}`);
    const d = await resp.json();
    if (!d.ok || !d.changes) {
      container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400">No trend data available.</div>`;
      return;
    }
    renderMomAnalytics(container, d);
  } catch (err) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-red-500">${escapeHtml(err.message)}</div>`;
  }
}

// ── Fullscreen for individual chart section ──
function openDhisSingleFullscreen(data, key, title, config) {
  const { county, trend, monthly_cards, age_bands } = data;
  const categories = trend.map((p) => p.label);
  const isMale = key === "males";
  const isFemale = key === "females";
  const isTotal = key === "total";

  let seriesData, chartType, extraOpts;
  if (isTotal) {
    chartType = "line";
    seriesData = (data.metrics || []).map((m) => ({
      name: m.label,
      data: trend.map((p) => p[m.key] || 0),
      color: m.color || "#6366f1",
    }));
    extraOpts = {
      plotOptions: { series: { marker: { enabled: true, radius: 3 } } },
    };
  } else {
    chartType = "column";
    const shades = isMale
      ? [
          "#0d47a1",
          "#1565c0",
          "#1976d2",
          "#1e88e5",
          "#2196f3",
          "#42a5f5",
          "#64b5f6",
          "#90caf9",
          "#0d6b96",
          "#1389b2",
          "#1aa3c5",
          "#26b7d8",
          "#4ecde6",
          "#7adff0",
          "#b3edf7",
        ]
      : [
          "#880e4f",
          "#ad1457",
          "#c2185b",
          "#d6336c",
          "#e91e63",
          "#f06292",
          "#f48fb1",
          "#f8bbd0",
          "#6a1b9a",
          "#8e24aa",
          "#ab47bc",
          "#ce93d8",
          "#e1bee7",
          "#f3e5f5",
          "#ede7f6",
        ];
    const bandsKey = isMale ? "male_bands" : "female_bands";
    seriesData = (age_bands || []).map((age, i) => ({
      name: age,
      data: (monthly_cards || []).map((mc) => {
        const band = (mc[bandsKey] || [])[i];
        return band ? band.value : 0;
      }),
      color: shades[i % shades.length],
    }));
    extraOpts = { plotOptions: { column: { stacking: "normal" } } };
  }

  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm";
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-4xl max-h-[95vh] flex flex-col">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div>
          <div class="text-lg font-bold text-slate-800">${escapeHtml(title)} – ${escapeHtml(config.title || "")}</div>
          <div class="text-xs text-slate-400">${escapeHtml(county)} · ${categories[0] || ""} to ${categories[categories.length - 1] || ""}</div>
        </div>
        <button id="dhisFsClose" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-400">&times;</button>
      </div>
      <div class="flex-1 p-4" id="dhisFsChart" style="min-height:450px"></div>
    </div>
  `;
  document.body.appendChild(modal);

  modal
    .querySelector("#dhisFsClose")
    .addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });

  if (window.Highcharts) {
    Highcharts.chart("dhisFsChart", {
      chart: { type: chartType, zoomType: "x" },
      title: { text: null },
      xAxis: {
        categories,
        labels: { style: { fontSize: "10px" }, rotation: -30 },
      },
      yAxis: { title: { text: "Patients" }, allowDecimals: false },
      tooltip: { shared: true, valueSuffix: " patients" },
      ...extraOpts,
      series: seriesData,
      credits: { enabled: false },
      exporting: { enabled: true },
      legend: {
        align: "center",
        verticalAlign: "bottom",
        itemStyle: { fontSize: "9px" },
      },
    });
  }
}

// ── Data table modal ──
function openDhisDataModal(data, config) {
  const { county, metrics, trend, monthly_cards } = data;
  const rows = trend
    .map((p) => {
      let r = `<td class="px-2 py-1 text-xs font-medium text-slate-600">${escapeHtml(p.label)}</td>`;
      for (const m of metrics || [])
        r += `<td class="px-2 py-1 text-xs text-slate-700 text-right">${p[m.key] || 0}</td>`;
      return `<tr class="border-b border-slate-100 hover:bg-slate-50">${r}</tr>`;
    })
    .join("");
  const headers = (metrics || [])
    .map(
      (m) =>
        `<th class="px-2 py-1.5 text-[10px] font-semibold text-slate-500 text-right">${escapeHtml(m.label)}</th>`,
    )
    .join("");

  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm";
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-3xl max-h-[85vh] flex flex-col">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div>
          <div class="text-lg font-bold text-slate-800">📋 ${escapeHtml(config.title)} – ${escapeHtml(county)}</div>
          <div class="text-xs text-slate-400">${trend.length} months · Source: CHAK DHIS2</div>
        </div>
        <button id="dhisDtClose" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-400">&times;</button>
      </div>
      <div class="flex-1 overflow-auto p-4">
        <table class="w-full border-collapse">
          <thead><tr class="border-b border-slate-200"><th class="px-2 py-1.5 text-[10px] font-semibold text-slate-500 text-left">Period</th>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal
    .querySelector("#dhisDtClose")
    .addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

// ── Age-band "See data used" modal ──
function openAgeBandDataModal(data, key, title, config) {
  const { county, monthly_cards, age_bands } = data;
  const isMale = key === "males";
  const bandsKey = isMale ? "male_bands" : "female_bands";

  // Build table: periods as columns, age bands as rows
  const cards = (monthly_cards || []).slice(-12);
  const headerRow =
    `<th class="px-2 py-1.5 text-[10px] font-semibold text-slate-500 text-left sticky left-0 bg-white z-10">Age Band</th>` +
    cards
      .map(
        (c) =>
          `<th class="px-2 py-1.5 text-[10px] font-semibold text-slate-500 text-right">${escapeHtml(c.label)}</th>`,
      )
      .join("");

  const bodyRows = (age_bands || [])
    .map((age, i) => {
      let row = `<td class="px-2 py-1.5 text-xs font-semibold text-slate-600 sticky left-0 bg-white">${escapeHtml(age)}</td>`;
      for (const card of cards) {
        const band = (card[bandsKey] || [])[i];
        row += `<td class="px-2 py-1.5 text-xs text-slate-700 text-right">${band ? band.value : 0}</td>`;
      }
      return `<tr class="border-b border-slate-100 hover:bg-slate-50">${row}</tr>`;
    })
    .join("");

  // Totals row
  let totalRow = `<td class="px-2 py-1.5 text-xs font-bold text-slate-700 sticky left-0 bg-slate-50">Total</td>`;
  for (const card of cards) {
    totalRow += `<td class="px-2 py-1.5 text-xs font-bold text-slate-700 text-right bg-slate-50">${card[key] || 0}</td>`;
  }

  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm";
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-5xl max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div>
          <div class="text-lg font-bold text-slate-800">📋 ${escapeHtml(title)} – ${escapeHtml(county)}</div>
          <div class="text-xs text-slate-400">${cards.length} months · Age rows × Period columns · Source: CHAK DHIS2</div>
        </div>
        <button id="abDataClose" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-400">&times;</button>
      </div>
      <div class="flex-1 overflow-auto p-4">
        <table class="w-full border-collapse">
          <thead><tr class="border-b-2 border-slate-200">${headerRow}</tr></thead>
          <tbody>${bodyRows}
            <tr class="border-t-2 border-slate-200 bg-slate-50">${totalRow}</tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal
    .querySelector("#abDataClose")
    .addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

// ═══════════════════════════════════════════════════════════════════
// ── CHAK PBIX Native Chart.js Renderers ──────────────────────────
// ═══════════════════════════════════════════════════════════════════

/** Track Chart.js instances so we can destroy them on re-render. */
let chakChartInstances = [];
function destroyChakCharts() {
  chakChartInstances.forEach((c) => c.destroy());
  chakChartInstances = [];
}

/** Wrapper around new Chart() that tracks instances for cleanup. */
function chakCreateChart(canvasId, config) {
  const el = document.getElementById(canvasId);
  if (!el) return null;
  const ctx = el.getContext("2d");
  if (!ctx) return null;
  const chart = new Chart(ctx, config);
  chakChartInstances.push(chart);
  return chart;
}

// ── Colour palette ──
const CHAK_COLORS = {
  blue: "#2563eb",
  green: "#16a34a",
  red: "#dc2626",
  orange: "#ea580c",
  purple: "#9333ea",
  pink: "#db2777",
  teal: "#0d9488",
  yellow: "#ca8a04",
  gray: "#6b7280",
};

const CHAK_PALETTE = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#ea580c",
  "#9333ea",
  "#db2777",
  "#0d9488",
  "#ca8a04",
  "#0891b2",
  "#4f46e5",
];

function chakColor(i) {
  return CHAK_PALETTE[i % CHAK_PALETTE.length];
}

// ── Helpers ──
function chakFmt(v) {
  return v != null
    ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })
    : "0";
}
function chakSum(arr, key) {
  return arr.reduce((a, d) => a + (Number(d[key]) || 0), 0);
}
function chakAvg(arr, key) {
  return arr.length > 0 ? (chakSum(arr, key) / arr.length).toFixed(1) : "0.0";
}
function chakLast(arr, key) {
  return arr.length > 0 ? Number(arr[arr.length - 1][key]) || 0 : 0;
}

function chakRenderTable(data, keys, labels) {
  if (!data || data.length === 0) return "";
  const lbls = labels || keys;
  return `
    <div class="chak-table-wrap">
      <table>
        <thead><tr>${lbls.map((l) => `<th>${l}</th>`).join("")}</tr></thead>
        <tbody>
          ${data
            .slice()
            .reverse()
            .map(
              (d) => `
            <tr>${keys
              .map((k) => {
                const v = d[k];
                const isPct = k.includes("pct") || k.includes("uptake");
                const isLabel = k === "label" || k === "period";
                if (isLabel) return `<td>${v || ""}</td>`;
                return `<td>${isPct ? (Number(v) || 0).toFixed(1) + "%" : chakFmt(v)}</td>`;
              })
              .join("")}</tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ── Chart config builders ──
function chakLineChart(data, series) {
  return {
    type: "line",
    data: {
      labels: data.map((d) => d.label),
      datasets: series.map((s) => ({
        label: s.label,
        data: data.map((d) => d[s.key]),
        borderColor: s.color,
        backgroundColor: s.color + "20",
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 6,
        yAxisID: s.yAxisID || "y",
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 12, padding: 12 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed.y;
              const isPct = ctx.dataset.label.includes("%");
              return ` ${ctx.dataset.label}: ${isPct ? val.toFixed(1) + "%" : val.toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 12, font: { size: 10 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#f0f0f0" },
          ticks: {
            callback: (v) => (v >= 1000 ? (v / 1000).toFixed(0) + "K" : v),
          },
        },
        y1: {
          position: "right",
          beginAtZero: true,
          grid: { display: false },
          ticks: { callback: (v) => v + "%" },
        },
      },
    },
  };
}

function chakBarChart(data, series) {
  return {
    type: "bar",
    data: {
      labels: data.map((d) => d.label),
      datasets: series.map((s) => ({
        label: s.label,
        data: data.map((d) => d[s.key]),
        backgroundColor: s.color,
        borderRadius: 4,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 12, padding: 12 },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
      },
    },
  };
}

// ── Funnel Chart config builder ──
function chakFunnelChart(data, series) {
  // Funnel expects a single dataset with values decreasing across stages
  return {
    type: "bar",
    data: {
      labels: data.map((d) => d.label),
      datasets: series.map((s, si) => ({
        label: s.label,
        data: data.map((d) => d[s.key]),
        backgroundColor: [
          "#2563eb80",
          "#16a34a80",
          "#ea580c80",
          "#9333ea80",
          "#db277780",
          "#0891b280",
          "#ca8a0480",
        ],
        borderColor: [
          "#2563eb",
          "#16a34a",
          "#ea580c",
          "#9333ea",
          "#db2777",
          "#0891b2",
          "#ca8a04",
        ],
        borderWidth: 1,
        borderRadius: si === series.length - 1 ? 4 : 0,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } },
        datalabels: {
          anchor: "end",
          align: "end",
          color: "#374151",
          font: { weight: "bold", size: 11 },
          formatter: function (v) {
            return v >= 1000 ? (v / 1000).toFixed(1) + "K" : v;
          },
        },
      },
      scales: {
        x: { beginAtZero: true, grid: { color: "#f0f0f0" } },
        y: { grid: { display: false } },
      },
    },
  };
}

// ── 100% Stacked Bar Chart config builder ──
function chak100PctStackedBarChart(data, series) {
  return {
    type: "bar",
    data: {
      labels: data.map((d) => d.label),
      datasets: series.map((s, si) => ({
        label: s.label,
        data: data.map((d) => d[s.key] || 0),
        backgroundColor:
          s.color ||
          ["#2563eb", "#16a34a", "#ea580c", "#9333ea", "#db2777", "#0891b2"][
            si % 6
          ],
        borderRadius: 0,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var total = ctx.dataset.data.reduce(function (a, b) {
                return a + b;
              }, 0);
              var pct =
                total > 0 ? ((ctx.parsed.x / total) * 100).toFixed(1) : 0;
              return (
                ctx.dataset.label +
                ": " +
                pct +
                "% (" +
                ctx.parsed.x.toLocaleString() +
                ")"
              );
            },
          },
        },
        datalabels: {
          color: "#fff",
          font: { weight: "bold", size: 10 },
          formatter: function (v, ctx) {
            var total = ctx.dataset.data.reduce(function (a, b) {
              return a + b;
            }, 0);
            return total > 0 ? ((v / total) * 100).toFixed(1) + "%" : "";
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          max: 100,
          grid: { color: "#f0f0f0" },
        },
        y: { stacked: true, grid: { display: false } },
      },
    },
  };
}

// ── 100% Stacked Column Chart config builder ──
function chak100PctStackedColumnChart(data, series) {
  var cfg = chak100PctStackedBarChart(data, series);
  delete cfg.options.indexAxis;
  // Swap x/y scales
  var tmpX = cfg.options.scales.x;
  var tmpY = cfg.options.scales.y;
  cfg.options.scales.x = tmpY;
  cfg.options.scales.y = tmpX;
  cfg.options.scales.x.grid = { display: false };
  cfg.options.scales.y.grid = { color: "#f0f0f0" };
  return cfg;
}

// ── Line + Stacked Column Combo Chart ──
function chakLineStackedColumnComboChart(data, columnSeries, lineSeries) {
  return {
    type: "bar",
    data: {
      labels: data.map(function (d) {
        return d.label;
      }),
      datasets: [].concat(
        columnSeries.map(function (s, si) {
          var colors = [
            "#2563eb80",
            "#16a34a80",
            "#ea580c80",
            "#9333ea80",
            "#db277780",
            "#0891b280",
          ];
          return {
            label: s.label,
            data: data.map(function (d) {
              return d[s.key] || 0;
            }),
            backgroundColor: s.color || colors[si % 6],
            borderColor: s.color || colors[si % 6].replace("80", ""),
            borderWidth: 0,
            borderRadius: 0,
            order: 2,
          };
        }),
        lineSeries.map(function (s) {
          return {
            label: s.label,
            data: data.map(function (d) {
              return d[s.key] || 0;
            }),
            type: "line",
            borderColor: s.color || "#dc2626",
            backgroundColor: (s.color || "#dc2626") + "20",
            pointBackgroundColor: s.color || "#dc2626",
            pointRadius: 4,
            fill: false,
            tension: 0.3,
            yAxisID: "y1",
            order: 1,
          };
        }),
      ),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } },
        tooltip: { mode: "index", intersect: false },
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          beginAtZero: true,
          position: "left",
          grid: { color: "#f0f0f0" },
        },
        y1: { position: "right", beginAtZero: true, grid: { display: false } },
      },
    },
  };
}

// ── Line + Clustered Column Combo Chart ──
function chakLineClusteredColumnComboChart(data, columnSeries, lineSeries) {
  var cfg = chakLineStackedColumnComboChart(data, columnSeries, lineSeries);
  // Unstack the columns
  cfg.options.scales.x.stacked = false;
  cfg.options.scales.y.stacked = false;
  return cfg;
}

// ── Donut Chart config builder ──
function chakDonutChart(data, series) {
  return {
    type: "doughnut",
    data: {
      labels: data.map(function (d) {
        return d.label;
      }),
      datasets: series.map(function (s) {
        return {
          label: s.label || "",
          data: data.map(function (d) {
            return d[s.key] || 0;
          }),
          backgroundColor: [
            "#2563eb",
            "#16a34a",
            "#ea580c",
            "#9333ea",
            "#db2777",
            "#0891b2",
            "#ca8a04",
            "#6b7280",
          ],
          borderWidth: 0,
        };
      }),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "60%",
      plugins: {
        legend: {
          position: "right",
          labels: { boxWidth: 12, padding: 10, font: { size: 11 } },
        },
        datalabels: {
          color: "#fff",
          font: { weight: "bold", size: 12 },
          formatter: function (v, ctx) {
            var total = ctx.dataset.data.reduce(function (a, b) {
              return a + b;
            }, 0);
            return total > 0 ? ((v / total) * 100).toFixed(1) + "%" : "";
          },
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var total = ctx.dataset.data.reduce(function (a, b) {
                return a + b;
              }, 0);
              var pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return (
                ctx.label +
                ": " +
                ctx.parsed.toLocaleString() +
                " (" +
                pct +
                "%)"
              );
            },
          },
        },
      },
    },
  };
}

// ── Patient Demographics Pyramid Chart config builder ──
function chakDemographicPyramidChart(data, ageKey, genderKey, valueKey) {
  if (!data || !data.length) {
    return {
      type: "bar",
      data: { labels: [], datasets: [] },
      options: { responsive: true, maintainAspectRatio: false },
    };
  }

  const ageGroups = Array.from(
    new Set(data.map((d) => d[ageKey] || "Unknown")),
  ).sort();
  const genders = Array.from(
    new Set(data.map((d) => String(d[genderKey] || "Unknown"))),
  );

  const genderSeries = genders.map((gender, index) => {
    const valueMap = data.reduce((acc, row) => {
      const age = row[ageKey] || "Unknown";
      const genderValue = String(row[genderKey] || "Unknown");
      if (genderValue !== gender) return acc;
      acc[age] = (acc[age] || 0) + Number(row[valueKey] || 0);
      return acc;
    }, {});

    const isMale = /^m(ale)?$/i.test(gender);
    return {
      label: gender,
      data: ageGroups.map((age) => {
        const value = Number(valueMap[age] || 0);
        return isMale ? -value : value;
      }),
      backgroundColor: chakColor(index),
      borderColor: chakColor(index),
      borderRadius: 4,
      barPercentage: 0.8,
      categoryPercentage: 0.85,
    };
  });

  const totalSeries = {
    label: "Total",
    type: "line",
    data: ageGroups.map((age) =>
      data
        .filter((row) => (row[ageKey] || "Unknown") === age)
        .reduce((sum, row) => sum + Number(row[valueKey] || 0), 0),
    ),
    borderColor: CHAK_COLORS.gray,
    backgroundColor: CHAK_COLORS.gray + "30",
    pointBackgroundColor: CHAK_COLORS.gray,
    pointRadius: 4,
    tension: 0.3,
    fill: false,
    yAxisID: "y1",
    order: 1,
  };

  return {
    type: "bar",
    data: {
      labels: ageGroups,
      datasets: [...genderSeries, totalSeries],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 12, padding: 12 },
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var value = Number(ctx.parsed.x || 0);
              return (
                ctx.dataset.label + ": " + Math.abs(value).toLocaleString()
              );
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: "#f0f0f0" },
          ticks: {
            callback: function (value) {
              return Math.abs(value).toLocaleString();
            },
          },
        },
        y: {
          grid: { display: false },
          reverse: true,
        },
        y1: {
          display: false,
          beginAtZero: true,
        },
      },
    },
  };
}

function chakTargetGaugeChart(value, target, options = {}) {
  const actual = Number(value || 0);
  const maxTarget = Number(target || 1);
  const percent =
    maxTarget > 0 ? Math.min(Math.max(actual / maxTarget, 0), 1) : 0;
  const remaining = Math.max(maxTarget - actual, 0);
  const fillColor =
    percent >= 1
      ? CHAK_COLORS.green
      : percent >= 0.75
        ? CHAK_COLORS.orange
        : CHAK_COLORS.red;

  const gaugeNeedlePlugin = {
    id: "chakGaugeNeedle",
    afterDatasetDraw: function (chart) {
      const cfg = chart.config.options.plugins.chakGaugeNeedle || {};
      const ctx = chart.ctx;
      const { left, right, top, bottom } = chart.chartArea;
      const centerX = (left + right) / 2;
      const centerY = bottom;
      const radius = Math.min((right - left) / 2, bottom - top) * 0.85;
      const angle = Math.PI * percent - Math.PI;
      const needleLength = radius * 0.9;
      const needleX = centerX + Math.cos(angle) * needleLength;
      const needleY = centerY + Math.sin(angle) * needleLength;
      ctx.save();
      ctx.beginPath();
      ctx.lineWidth = 4;
      ctx.strokeStyle = cfg.color || "#111827";
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(needleX, needleY);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
      ctx.fillStyle = cfg.color || "#111827";
      ctx.fill();
      ctx.font = "700 16px Inter, sans-serif";
      ctx.fillStyle = "#111827";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        Math.round(percent * 100) + "%",
        centerX,
        centerY - radius * 0.25,
      );
      ctx.font = "600 12px Inter, sans-serif";
      ctx.fillText(
        chakFmt(actual) + " / " + chakFmt(maxTarget),
        centerX,
        centerY + radius * 0.12,
      );
      ctx.restore();
    },
  };

  return {
    type: "doughnut",
    data: {
      labels: ["Progress", "Remaining"],
      datasets: [
        {
          data: [actual, remaining],
          backgroundColor: [fillColor, "#e5e7eb"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "80%",
      circumference: Math.PI,
      rotation: -Math.PI,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return ctx.label + ": " + chakFmt(ctx.parsed);
            },
          },
        },
        chakGaugeNeedle: {
          color: options.needleColor || "#111827",
        },
      },
      scales: {
        x: { display: false },
        y: { display: false },
      },
    },
    plugins: [gaugeNeedlePlugin],
  };
}

// ── Pivot Table renderer ──
function chakRenderPivotTable(data, rows, columns, valueKey, valueLabel) {
  // Group data by row categories and column categories
  if (!data || !data.length)
    return '<div class="chak-error-card">No pivot data</div>';
  var rowCategories = rows.map(function (r) {
    return r.key;
  });
  var colCategories = columns.map(function (c) {
    return c.key;
  });

  // Get unique row/col values
  var rowVals = {};
  var colVals = {};
  data.forEach(function (d) {
    rowCategories.forEach(function (rk) {
      var v = String(d[rk] || "");
      if (v) rowVals[v] = true;
    });
    colCategories.forEach(function (ck) {
      var v = String(d[ck] || "");
      if (v) colVals[v] = true;
    });
  });

  var rowList = Object.keys(rowVals);
  var colList = Object.keys(colVals);

  // Build pivot grid
  var html = '<div class="chak-table-wrap"><table><thead><tr>';
  html +=
    '<th style="position:sticky;left:0;z-index:2;background:#f9fafb;">' +
    (rows[0].label || "Category") +
    "</th>";
  colList.forEach(function (c) {
    html += '<th style="text-align:right;">' + escapeHtml(c) + "</th>";
  });
  html +=
    '<th style="text-align:right;background:#f0fdf4;">Total</th></tr></thead><tbody>';

  var grandTotal = 0;
  rowList.forEach(function (r) {
    html += "<tr>";
    html +=
      '<td style="position:sticky;left:0;background:#fff;font-weight:600;">' +
      escapeHtml(r) +
      "</td>";
    var rowTotal = 0;
    colList.forEach(function (c) {
      // Find value matching this row+col combination
      var cellData = data.filter(function (d) {
        var matchRow = rowCategories.some(function (rk) {
          return String(d[rk] || "") === r;
        });
        var matchCol = colCategories.some(function (ck) {
          return String(d[ck] || "") === c;
        });
        return matchRow && matchCol;
      });
      var val = cellData.reduce(function (sum, d) {
        return sum + parseFloat(d[valueKey] || 0);
      }, 0);
      rowTotal += val;
      grandTotal += val;
      html +=
        '<td style="text-align:right;">' +
        (val > 0
          ? val.toLocaleString(undefined, { maximumFractionDigits: 1 })
          : "-") +
        "</td>";
    });
    html +=
      '<td style="text-align:right;font-weight:600;background:#f0fdf4;">' +
      rowTotal.toLocaleString(undefined, { maximumFractionDigits: 1 }) +
      "</td>";
    html += "</tr>";
  });

  // Grand total row
  html += '<tr style="background:#f9fafb;font-weight:600;">';
  html += '<td style="position:sticky;left:0;background:#f9fafb;">Total</td>';
  colList.forEach(function () {
    html += "<td></td>";
  });
  html +=
    '<td style="text-align:right;background:#f0fdf4;">' +
    grandTotal.toLocaleString(undefined, { maximumFractionDigits: 1 }) +
    "</td>";
  html += "</tr>";

  html += "</tbody></table></div>";
  return html;
}

// ── CSS injected once ──
(function injectChakCss() {
  if (document.getElementById("chak-css")) return;
  const style = document.createElement("style");
  style.id = "chak-css";
  style.textContent = `
    .chak-kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:16px; }
    .chak-kpi-card { background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:14px 16px; box-shadow:0 1px 3px rgba(0,0,0,.04); }
    .chak-kpi-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.03em; color:#6b7280; margin-bottom:4px; }
    .chak-kpi-value { font-size:26px; font-weight:700; line-height:1.2; }
    .chak-kpi-value.blue { color:#2563eb; } .chak-kpi-value.green { color:#16a34a; }
    .chak-kpi-value.red { color:#dc2626; } .chak-kpi-value.orange { color:#ea580c; }
    .chak-kpi-value.purple { color:#9333ea; } .chak-kpi-value.pink { color:#db2777; }
    .chak-kpi-value.teal { color:#0d9488; }
    .chak-kpi-sub { font-size:11px; color:#9ca3af; margin-top:2px; }
    .chak-chart-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(360px,1fr)); gap:14px; margin-bottom:16px; }
    .chak-chart-card { background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:14px; box-shadow:0 1px 3px rgba(0,0,0,.04); }
    .chak-chart-card h3 { font-size:13px; font-weight:600; color:#374151; margin-bottom:8px; }
    .chak-chart-card.full { grid-column:1 / -1; }
    .chak-chart-container { position:relative; width:100%; height:280px; }
    .chak-page-info { margin-bottom:16px; }
    .chak-page-info h2 { font-size:16px; font-weight:700; color:#1f2937; }
    .chak-page-info p { font-size:12px; color:#6b7280; margin-top:2px; }
    .chak-table-wrap { overflow-x:auto; border:1px solid #e5e7eb; border-radius:8px; margin-top:12px; }
    .chak-table-wrap table { width:100%; border-collapse:collapse; font-size:11px; }
    .chak-table-wrap th { background:#f9fafb; padding:8px 10px; text-align:left; font-weight:600; color:#374151; border-bottom:1px solid #e5e7eb; white-space:nowrap; }
    .chak-table-wrap td { padding:6px 10px; border-bottom:1px solid #f3f4f6; color:#4b5563; }
    .chak-error-card { background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:24px; text-align:center; color:#dc2626; font-size:14px; }
    .chak-chart-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
    .chak-chart-header h3 { margin-bottom:0 !important; }
    .chak-chart-actions { display:flex; gap:4px; }
    .chak-action-btn { width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:6px; border:1px solid #e5e7eb; background:#fff; cursor:pointer; color:#6b7280; transition:all 0.15s; padding:0; }
    .chak-action-btn:hover { background:#f3f4f6; color:#374151; border-color:#d1d5db; }
    .chak-action-btn.chak-ai-btn:hover { background:#eef2ff; color:#4f46e5; border-color:#a5b4fc; }
    .chak-action-icon { width:14px; height:14px; }
    .chak-ai-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:9999; display:flex; align-items:center; justify-content:center; }
    .chak-ai-modal-box { background:#fff; border-radius:16px; max-width:520px; width:90%; max-height:80vh; overflow-y:auto; box-shadow:0 25px 50px rgba(0,0,0,0.15); }
    .chak-ai-modal-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid #e5e7eb; }
    .chak-ai-modal-header h3 { font-size:15px; font-weight:700; color:#1f2937; margin:0; }
    .chak-ai-modal-close { width:32px; height:32px; border:none; background:transparent; cursor:pointer; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#6b7280; font-size:18px; }
    .chak-ai-modal-close:hover { background:#f3f4f6; }
    .chak-ai-modal-body { padding:20px; font-size:13px; color:#4b5563; line-height:1.6; }
    .chak-ai-modal-input { width:100%; padding:10px 14px; border:1px solid #d1d5db; border-radius:8px; font-size:13px; outline:none; margin-bottom:12px; box-sizing:border-box;font-family:inherit; }
    .chak-ai-modal-input:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,0.1); }
    .chak-ai-modal-submit { background:#4f46e5; color:#fff; border:none; padding:8px 20px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; }
    .chak-ai-modal-submit:hover { background:#4338ca; }
    .chak-ai-modal-response { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:14px; margin-top:12px; font-size:12px; white-space:pre-wrap; max-height:300px; overflow-y:auto; color:#374151; }
    .chak-ai-modal-footer { display:flex; gap:8px; align-items:center; }

  `;
  document.head.appendChild(style);
})();

// ── CHAK Chart Card Generator with action bar ──
function chakChartCard(title, canvasId, extraClasses) {
  return (
    '<div class="chak-chart-card' +
    (extraClasses ? " " + extraClasses : "") +
    '">' +
    '<div class="chak-chart-header">' +
    "<h3>" +
    title +
    "</h3>" +
    '<div class="chak-chart-actions">' +
    '<button class="chak-action-btn chak-ai-btn" data-chak-action="ai" data-chart="' +
    canvasId +
    '" title="AI Assist">' +
    '<svg class="chak-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/>' +
    '<circle cx="12" cy="20" r="2"/>' +
    "</svg>" +
    "</button>" +
    '<button class="chak-action-btn" data-chak-action="data" data-chart="' +
    canvasId +
    '" title="View Data">' +
    '<svg class="chak-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
    '<line x1="3" y1="9" x2="21" y2="9"/>' +
    '<line x1="9" y1="3" x2="9" y2="21"/>' +
    "</svg>" +
    "</button>" +
    '<button class="chak-action-btn" data-chak-action="download" data-chart="' +
    canvasId +
    '" title="Download PNG">' +
    '<svg class="chak-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
    '<polyline points="7 10 12 15 17 10"/>' +
    '<line x1="12" y1="15" x2="12" y2="3"/>' +
    "</svg>" +
    "</button>" +
    "</div>" +
    "</div>" +
    '<div class="chak-chart-container"><canvas id="' +
    canvasId +
    '"></canvas></div>' +
    "</div>"
  );
}

// ── Global data store for CHAK chart data ──
var _chakDataStore = {};

function _chakSetData(slug, data) {
  _chakDataStore[slug] = data;
}

function _chakGetData(btn) {
  var card = btn.closest(".chak-chart-card");
  if (!card) return null;
  var grid = card.closest(".chak-chart-grid");
  if (!grid) return null;
  var container = grid.closest("[data-chak-slug]");
  if (!container) return null;
  return _chakDataStore[container.getAttribute("data-chak-slug")];
}

function _chakGetCanvas(btn) {
  var chartId = btn.getAttribute("data-chart");
  return document.getElementById(chartId);
}

// ── Download Chart as PNG ──
function _chakDownloadChart(btn) {
  var canvas = _chakGetCanvas(btn);
  if (!canvas) return;
  var link = document.createElement("a");
  link.download = (btn.getAttribute("data-chart") || "chart") + ".png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// ── View Chart Data ──
function _chakViewData(btn) {
  var canvas = _chakGetCanvas(btn);
  if (!canvas) return;
  var chartId = canvas.id;
  var chart = chakChartInstances.find(function (c) {
    return c.canvas && c.canvas.id === chartId;
  });
  if (!chart) return;
  var labels = chart.data.labels || [];
  var datasets = chart.data.datasets || [];
  if (!labels.length || !datasets.length) return;
  var html =
    '<div style="overflow-x:auto;max-height:400px;overflow-y:auto;font-size:12px;">';
  html += '<table style="width:100%;border-collapse:collapse;">';
  html += '<thead><tr style="background:#f9fafb;position:sticky;top:0;">';
  html +=
    '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid #e5e7eb;font-weight:600;">Month</th>';
  datasets.forEach(function (ds) {
    html +=
      '<th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e7eb;font-weight:600;">' +
      escapeHtml(ds.label || "") +
      "</th>";
  });
  html += "</tr></thead><tbody>";
  labels.forEach(function (label, i) {
    html += "<tr" + (i % 2 === 0 ? ' style="background:#fafafa;"' : "") + ">";
    html +=
      '<td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;">' +
      escapeHtml(label) +
      "</td>";
    datasets.forEach(function (ds) {
      var val =
        ds.data[i] != null
          ? Number(ds.data[i]).toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })
          : "-";
      html +=
        '<td style="padding:4px 8px;text-align:right;border-bottom:1px solid #f3f4f6;">' +
        val +
        "</td>";
    });
    html += "</tr>";
  });
  html += "</tbody></table></div>";
  _chakShowModal("📊 Chart Data", html);
}

// ── AI Assist Modal ──
function _chakAiAssist(btn) {
  var canvas = _chakGetCanvas(btn);
  var chartTitle = "";
  if (btn) {
    var card = btn.closest(".chak-chart-card");
    if (card) {
      var h3 = card.querySelector("h3");
      if (h3) chartTitle = h3.textContent;
    }
  }
  var chartId = canvas ? canvas.id : "";
  var html =
    '<p style="margin:0 0 12px;color:#6b7280;">Ask questions about <strong>' +
    escapeHtml(chartTitle || chartId) +
    "</strong></p>" +
    '<textarea id="chakAiInput" class="chak-ai-modal-input" rows="3" placeholder="e.g. What is the trend? What caused the drop in March?"></textarea>' +
    '<div class="chak-ai-modal-footer">' +
    '<button id="chakAiSubmit" class="chak-ai-modal-submit"><svg style="width:14px;height:14px;display:inline;margin-right:4px;vertical-align:middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><circle cx="12" cy="20" r="2"/></svg> Ask AI</button>' +
    "</div>" +
    '<div id="chakAiResponse" class="chak-ai-modal-response" style="display:none;"></div>';

  _chakShowModal("🤖 AI Chart Assistant", html, function () {
    setTimeout(function () {
      var input = document.getElementById("chakAiInput");
      var submit = document.getElementById("chakAiSubmit");
      var response = document.getElementById("chakAiResponse");
      if (!input || !submit) return;
      function handleAsk() {
        var q = input.value.trim();
        if (!q) return;
        response.style.display = "block";
        response.innerHTML =
          '<div style="display:flex;align-items:center;gap:8px;color:#6b7280;"><div style="width:16px;height:16px;border:2px solid #e0e7ff;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite;"></div> Analyzing chart data...</div>';
        submit.disabled = true;
        setTimeout(function () {
          response.innerHTML =
            '<div style="color:#374151;">Based on the <strong>' +
            escapeHtml(chartTitle || chartId) +
            '</strong> chart data, I can see the following trends:<br><br>• The data shows monthly variations across the displayed period<br>• You can examine the specific values in the chart above<br>• For detailed analysis, connect this to the main AI assistant<br><br><em style="color:#9ca3af;font-size:11px;">AI integration coming soon — click the main AI Assist icon for full analysis.</em></div>';
          submit.disabled = false;
        }, 1500);
      }
      submit.addEventListener("click", handleAsk);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && e.ctrlKey) handleAsk();
      });
    }, 100);
  });
}

// ── Show Modal overlay ──
function _chakShowModal(title, bodyHtml, afterRender) {
  var existing = document.querySelector(".chak-ai-modal-overlay");
  if (existing) existing.remove();
  var overlay = document.createElement("div");
  overlay.className = "chak-ai-modal-overlay";
  overlay.innerHTML =
    '<div class="chak-ai-modal-box">' +
    '<div class="chak-ai-modal-header">' +
    "<h3>" +
    title +
    "</h3>" +
    '<button class="chak-ai-modal-close" id="chakModalClose">&times;</button>' +
    "</div>" +
    '<div class="chak-ai-modal-body">' +
    bodyHtml +
    "</div>" +
    "</div>";
  document.body.appendChild(overlay);
  document
    .getElementById("chakModalClose")
    .addEventListener("click", function () {
      overlay.remove();
    });
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) overlay.remove();
  });
  if (afterRender) afterRender();
}

// ── Global action handler for CHAK chart buttons ──
document.addEventListener("click", function (e) {
  var btn = e.target.closest("[data-chak-action]");
  if (!btn) return;
  e.preventDefault();
  var action = btn.getAttribute("data-chak-action");
  if (action === "ai") _chakAiAssist(btn);
  else if (action === "data") _chakViewData(btn);
  else if (action === "download") _chakDownloadChart(btn);
});

// ================================================================
// RENDERER MAP
// ================================================================
const CHAK_RENDERERS = {};
function registerChakRenderer(slug, apiPageId, renderFn) {
  CHAK_RENDERERS[slug] = { apiPageId, renderFn };
}

// ── Profile ──
registerChakRenderer("profile", "profile", function (el, data) {
  const trend = data.trend || [];
  const latest = data.latest || {};
  el.innerHTML = `
    <div class="chak-page-info">
      <h2><i class="fas fa-map"></i> Profile — ${data.county}</h2>
      <p>Key indicators overview with facility-level map data</p>
    </div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_CURR (Latest)</div>
        <div class="chak-kpi-value blue">${chakFmt(latest.tx_curr)}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_NEW (Latest)</div>
        <div class="chak-kpi-value green">${chakFmt(latest.tx_new)}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">HTS Tested (Latest)</div>
        <div class="chak-kpi-value purple">${chakFmt(latest.hts_tested)}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">HTS Positive (Latest)</div>
        <div class="chak-kpi-value pink">${chakFmt(latest.hts_positive)}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("Monthly Trend — Key Indicators", "chakProfileTrend", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tx_curr", "tx_new", "hts_tested", "hts_positive"], ["Month", "TX_CURR", "TX_NEW", "HTS Tested", "HTS Positive"])}
  `;
  el.setAttribute("data-chak-slug", "profile");
  _chakSetData("profile", data);
  chakCreateChart(
    "chakProfileTrend",
    chakLineChart(trend, [
      { key: "tx_curr", label: "TX_CURR", color: CHAK_COLORS.blue },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.green },
      { key: "hts_tested", label: "HTS Tested", color: CHAK_COLORS.purple },
      { key: "hts_positive", label: "HTS Positive", color: CHAK_COLORS.pink },
    ]),
  );
});

// ── Key Indicators ──
registerChakRenderer("key-indicators", "key-indicators", function (el, data) {
  const trend = data.trend || [];
  const latest = trend[trend.length - 1] || {};
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-gauge-high"></i> Key Indicators Drill Down</h2><p>Program performance at a glance: VL, CD4, TPT, HTS, Linkage</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">% VL Uptake</div><div class="chak-kpi-value green">${latest.vl_uptake_pct || 0}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">% VL Suppression</div><div class="chak-kpi-value teal">${latest.vl_suppression_pct || 0}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Positivity Rate</div><div class="chak-kpi-value orange">${latest.positivity_pct || 0}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Linkage Rate</div><div class="chak-kpi-value purple">${latest.linkage_pct || 0}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">CD4 &lt;200</div><div class="chak-kpi-value red">${chakFmt(latest.cd4_less200)}</div><div class="chak-kpi-sub">${latest.cd4_uptake_pct || 0}% CD4 Uptake</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TPT Uptake</div><div class="chak-kpi-value blue">${latest.tpt_uptake_pct || 0}%</div><div class="chak-kpi-sub">${chakFmt(latest.tpt)} clients</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_CURR</div><div class="chak-kpi-value blue">${chakFmt(latest.tx_curr)}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_NEW</div><div class="chak-kpi-value green">${chakFmt(latest.tx_new)}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("VL Cascade %", "chakKiVlCascade")}
            ${chakChartCard("HTS Cascade %", "chakKiHtsCascade")}
            ${chakChartCard("TX_CURR + VL% (Combo)", "chakKiCombo")}
            ${chakChartCard("Latest KPI Radar", "chakKiRadar")}
            ${chakChartCard("Key Indicators Monthly Trend", "chakKiTrend", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tx_curr", "tx_new", "vl_uptake_pct", "vl_suppression_pct", "positivity_pct", "linkage_pct", "cd4_uptake_pct", "tpt_uptake_pct"], ["Month", "TX_CURR", "TX_NEW", "% VL Up", "% VL Supp", "% Pos", "% Link", "% CD4", "% TPT"])}
    `;
  el.setAttribute("data-chak-slug", "key-indicators");
  _chakSetData("key-indicators", data);
  chakCreateChart(
    "chakKiVlCascade",
    chakLineChart(trend, [
      { key: "vl_uptake_pct", label: "% VL Uptake", color: CHAK_COLORS.green },
      {
        key: "vl_suppression_pct",
        label: "% VL Suppression",
        color: CHAK_COLORS.teal,
      },
    ]),
  );
  chakCreateChart(
    "chakKiHtsCascade",
    chakLineChart(trend, [
      { key: "positivity_pct", label: "% Positive", color: CHAK_COLORS.orange },
      { key: "linkage_pct", label: "% Linked", color: CHAK_COLORS.purple },
    ]),
  );
  // Combo: TX_CURR bars + VL Uptake line (using new combo builder)
  chakCreateChart(
    "chakKiCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "tx_curr", label: "TX_CURR", color: CHAK_COLORS.blue + "80" }],
      [
        {
          key: "vl_uptake_pct",
          label: "% VL Uptake",
          color: CHAK_COLORS.green,
        },
      ],
    ),
  );

  // CD4 Distribution Donut (latest period)
  var cd4Data = [
    { label: "CD4 <200", value: latest.cd4_less200 || 0 },
    { label: "CD4 >200", value: latest.cd4_more200 || 0 },
    { label: "CD4 Unk", value: latest.cd4_unknown || 0 },
  ];
  var hasCd4Data = cd4Data.some(function (d) {
    return d.value > 0;
  });
  if (hasCd4Data) {
    // Replace radar with donut (radar is less useful)
    chakCreateChart(
      "chakKiRadar",
      chakDonutChart(cd4Data, [{ key: "value", label: "CD4" }]),
    );
  } else {
    // Keep radar as fallback
    chakCreateChart("chakKiRadar", {
      type: "radar",
      data: {
        labels: [
          "VL Uptake",
          "VL Suppression",
          "Linkage",
          "CD4 Uptake",
          "TPT Uptake",
        ],
        datasets: [
          {
            label: "Latest %",
            data: [
              latest.vl_uptake_pct || 0,
              latest.vl_suppression_pct || 0,
              latest.linkage_pct || 0,
              latest.cd4_uptake_pct || 0,
              latest.tpt_uptake_pct || 0,
            ],
            backgroundColor: CHAK_COLORS.blue + "40",
            borderColor: CHAK_COLORS.blue,
            pointBackgroundColor: CHAK_COLORS.blue,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { r: { beginAtZero: true, max: 100 } },
        plugins: { legend: { display: false } },
      },
    });
  }
  chakCreateChart(
    "chakKiTrend",
    chakLineChart(trend, [
      { key: "tx_curr", label: "TX_CURR", color: CHAK_COLORS.blue },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.green },
      { key: "cd4_less200", label: "CD4<200", color: CHAK_COLORS.red },
    ]),
  );
});

// ── PrEP ──
registerChakRenderer("prep_page", "prep", function (el, data) {
  const trend = data.trend || [];
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-shield"></i> PrEP Cascade</h2><p>PrEP screening, new initiations, current users, and typology breakdown</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">PrEP New (Cumulative)</div><div class="chak-kpi-value green">${chakFmt(chakSum(trend, "prep_new"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">PrEP Current (Latest)</div><div class="chak-kpi-value blue">${chakFmt(chakLast(trend, "prep_curr"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">PrEP Screened</div><div class="chak-kpi-value purple">${chakFmt(chakSum(trend, "prep_screened"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg % Uptake</div><div class="chak-kpi-value orange">${chakAvg(trend, "prep_uptake_pct")}%</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("PrEP Trend", "chakPrepTrend")}
            ${chakChartCard("PrEP New by Typology", "chakPrepTypology")}
            ${chakChartCard("Detailed Monthly Data", "chakPrepDetail", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "prep_new", "prep_curr", "prep_screened", "prep_uptake_pct"], ["Month", "New", "Current", "Screened", "% Uptake"])}`;
  el.setAttribute("data-chak-slug", "prep_page");
  _chakSetData("prep_page", data);
  // Combo: PrEP New bars + % Uptake line
  chakCreateChart(
    "chakPrepTrend",
    chakLineClusteredColumnComboChart(
      trend,
      [
        { key: "prep_new", label: "PrEP New", color: CHAK_COLORS.green + "80" },
        {
          key: "prep_curr",
          label: "PrEP Current",
          color: CHAK_COLORS.blue + "80",
        },
      ],
      [
        {
          key: "prep_uptake_pct",
          label: "% Uptake",
          color: CHAK_COLORS.orange,
        },
      ],
    ),
  );
  // Typology donut (latest period)
  var typologyLatest = trend[trend.length - 1] || {};
  var typologyData = [
    { label: "PBFW", value: typologyLatest.prep_new_pbfw || 0 },
    { label: "Pregnant", value: typologyLatest.prep_new_preg || 0 },
  ];
  chakCreateChart(
    "chakPrepTypology",
    chakDonutChart(typologyData, [{ key: "value", label: "Type" }]),
  );
  chakCreateChart(
    "chakPrepDetail",
    chakLineChart(trend, [
      { key: "prep_screened", label: "Screened", color: CHAK_COLORS.orange },
      { key: "prep_new", label: "New", color: CHAK_COLORS.green },
      {
        key: "prep_uptake_pct",
        label: "% Uptake",
        color: CHAK_COLORS.teal,
        yAxisID: "y1",
      },
    ]),
  );
});

// ── HTS Performance ──
registerChakRenderer("hts-performance", "hts-performance", function (el, data) {
  const trend = data.trend || [];
  const latest = trend[trend.length - 1] || {};
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-vial"></i> HTS Performance</h2><p>HIV Testing Services: tested, positive, linkage, yield, and TX_NEW</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Tested</div><div class="chak-kpi-value blue">${chakFmt(chakSum(trend, "tested"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Positive</div><div class="chak-kpi-value pink">${chakFmt(chakSum(trend, "positive"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Positivity Rate</div><div class="chak-kpi-value orange">${chakAvg(trend, "positivity_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Linkage Rate</div><div class="chak-kpi-value green">${chakAvg(trend, "linkage_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_NEW (Total)</div><div class="chak-kpi-value teal">${chakFmt(chakSum(trend, "tx_new"))}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("Tested + Positivity % (Combo)", "chakHtsCombo")}
            ${chakChartCard("Positive → Linked → TX_NEW", "chakHtsCascade")}
            ${chakChartCard("Linkage Breakdown", "chakHtsLinkage")}
            ${chakChartCard("Latest Funnel", "chakHtsFunnel")}
            ${chakChartCard("HTS Performance Detail", "chakHtsDetail", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tested", "positive", "positivity_pct", "linked_within", "linked_outside", "total_linked", "linkage_pct", "tx_new"], ["Month", "Tested", "Positive", "% Pos", "Linked In", "Linked Out", "Total Linked", "% Linked", "TX_NEW"])}
    `;
  el.setAttribute("data-chak-slug", "hts-performance");
  _chakSetData("hts-performance", data);
  // Combo: tested bar + positivity line
  chakCreateChart(
    "chakHtsCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "tested", label: "Tested", color: CHAK_COLORS.blue + "80" }],
      [
        {
          key: "positivity_pct",
          label: "% Positive",
          color: CHAK_COLORS.orange,
        },
      ],
    ),
  );
  // Positive → Linked → TX_NEW bars
  chakCreateChart(
    "chakHtsCascade",
    chakBarChart(trend, [
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
      { key: "total_linked", label: "Total Linked", color: CHAK_COLORS.green },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
    ]),
  );
  // Linkage bar
  chakCreateChart(
    "chakHtsLinkage",
    chakBarChart(trend, [
      {
        key: "linked_within",
        label: "Linked Within",
        color: CHAK_COLORS.green,
      },
      {
        key: "linked_outside",
        label: "Linked Outside",
        color: CHAK_COLORS.orange,
      },
    ]),
  );
  // Latest month funnel (donut using builder)
  var htsFunnelData = [
    { label: "Tested", value: latest.tested || 0 },
    { label: "Positive", value: latest.positive || 0 },
    { label: "Linked", value: latest.total_linked || 0 },
    { label: "TX_NEW", value: latest.tx_new || 0 },
  ];
  chakCreateChart(
    "chakHtsFunnel",
    chakDonutChart(htsFunnelData, [{ key: "value", label: "Count" }]),
  );
  // Detail trend
  chakCreateChart(
    "chakHtsDetail",
    chakLineChart(trend, [
      { key: "linkage_pct", label: "% Linked", color: CHAK_COLORS.green },
      { key: "positivity_pct", label: "% Positive", color: CHAK_COLORS.orange },
    ]),
  );
});

// ── HTS Index ──
registerChakRenderer("hts-index-testing", "hts-index", function (el, data) {
  const trend = data.trend || [];
  const latest = trend[trend.length - 1] || {};
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-users"></i> HTS Index Testing</h2><p>Index testing cascade: tested, positive, linked, TX_NEW</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Tested</div><div class="chak-kpi-value blue">${chakFmt(chakSum(trend, "tested"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Positive</div><div class="chak-kpi-value pink">${chakFmt(chakSum(trend, "positive"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg Positivity</div><div class="chak-kpi-value orange">${chakAvg(trend, "positivity_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg Linkage</div><div class="chak-kpi-value green">${chakAvg(trend, "linkage_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_NEW (Total)</div><div class="chak-kpi-value teal">${chakFmt(chakSum(trend, "tx_new"))}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("Tested vs Positive (Combo)", "chakIndexCombo")}
            ${chakChartCard("Positive → Linked → TX_NEW", "chakIndexCascade")}
            ${chakChartCard("Index Testing Cascade", "chakIndexTrend", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tested", "positive", "positivity_pct", "linked_within", "linked_outside", "total_linked", "linkage_pct", "tx_new"], ["Month", "Tested", "Positive", "% Pos", "Linked In", "Linked Out", "Total Linked", "% Linked", "TX_NEW"])}
    `;
  el.setAttribute("data-chak-slug", "hts-index-testing");
  _chakSetData("hts-index-testing", data);
  // Combo chart (using builder)
  chakCreateChart(
    "chakIndexCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "tested", label: "Tested", color: CHAK_COLORS.blue + "80" }],
      [
        {
          key: "positivity_pct",
          label: "% Positive",
          color: CHAK_COLORS.orange,
        },
      ],
    ),
  );
  // Cascade bars
  chakCreateChart(
    "chakIndexCascade",
    chakBarChart(trend, [
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
      { key: "total_linked", label: "Total Linked", color: CHAK_COLORS.green },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
    ]),
  );
  // Trend line
  chakCreateChart(
    "chakIndexTrend",
    chakLineChart(trend, [
      { key: "tested", label: "Tested", color: CHAK_COLORS.blue },
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
      { key: "total_linked", label: "Linked", color: CHAK_COLORS.green },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
    ]),
  );
});

// ── SNS Cascade ──
registerChakRenderer("sns-cascade", "sns-cascade", function (el, data) {
  const trend = data.trend || [];
  const latest = trend[trend.length - 1] || {};
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-share-nodes"></i> SNS Cascade</h2><p>Social Network Strategy: contacts elicited, tested, positive, linked</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">SNS Positive (Total)</div><div class="chak-kpi-value pink">${chakFmt(chakSum(trend, "sns_pos"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Linked</div><div class="chak-kpi-value green">${chakFmt(chakSum(trend, "linked"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_NEW (Total)</div><div class="chak-kpi-value teal">${chakFmt(chakSum(trend, "tx_new"))}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("SNS Cascade Trend", "chakSnsTrend")}
            ${chakChartCard("SNS → Linked → TX_NEW", "chakSnsBar")}
            ${chakChartCard("SNS Cascade Detail", "chakSnsDetail", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "sns_pos", "linked", "tx_new"], ["Month", "SNS Positive", "Linked", "TX_NEW"])}
    `;
  el.setAttribute("data-chak-slug", "sns-cascade");
  _chakSetData("sns-cascade", data);
  chakCreateChart(
    "chakSnsTrend",
    chakLineChart(trend, [
      { key: "sns_pos", label: "SNS Positive", color: CHAK_COLORS.pink },
      { key: "linked", label: "Linked", color: CHAK_COLORS.green },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
    ]),
  );
  chakCreateChart(
    "chakSnsBar",
    chakBarChart(trend, [
      { key: "sns_pos", label: "SNS Positive", color: CHAK_COLORS.pink },
      { key: "linked", label: "Linked", color: CHAK_COLORS.green },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
    ]),
  );
  chakCreateChart(
    "chakSnsDetail",
    chakLineChart(trend, [
      { key: "sns_pos", label: "SNS Positive", color: CHAK_COLORS.pink },
      { key: "linked", label: "Linked", color: CHAK_COLORS.green },
    ]),
  );
});

// ── Care & Treatment ──
registerChakRenderer("care-treatment", "care-treatment", function (el, data) {
  const trend = data.trend || [];
  const latest = trend[trend.length - 1] || {};
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-heart-pulse"></i> Care & Treatment</h2><p>ART treatment cascade: TX_CURR, TX_NEW, TX_ML (IIT), TX_RTT</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Latest TX_CURR</div><div class="chak-kpi-value blue">${chakFmt(chakLast(trend, "tx_curr"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Latest TX_NEW</div><div class="chak-kpi-value green">${chakFmt(chakLast(trend, "tx_new"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">IIT (Latest)</div><div class="chak-kpi-value red">${chakFmt(chakLast(trend, "tx_ml"))}</div><div class="chak-kpi-sub">${chakLast(trend, "iit_pct")}% of TX_CURR</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Return to Care</div><div class="chak-kpi-value purple">${chakFmt(chakLast(trend, "tx_rtt"))}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("TX_CURR + IIT% (Combo)", "chakCtCombo")}
            ${chakChartCard("TX_NEW vs TX_RTT", "chakCtNewRtt")}
            ${chakChartCard("Treatment Cascade", "chakCtCascade")}
            ${chakChartCard("IIT Rate (%)", "chakCtIit")}
            ${chakChartCard("Care & Treatment Trend", "chakCtTrend", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tx_curr", "tx_new", "tx_ml", "iit_pct", "tx_rtt"], ["Month", "TX_CURR", "TX_NEW", "IIT", "% IIT", "TX_RTT"])}
    `;
  el.setAttribute("data-chak-slug", "care-treatment");
  _chakSetData("care-treatment", data);
  // Combo: TX_CURR bars + IIT% line (using combo builder)
  chakCreateChart(
    "chakCtCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "tx_curr", label: "TX_CURR", color: CHAK_COLORS.blue + "80" }],
      [{ key: "iit_pct", label: "% IIT", color: CHAK_COLORS.red }],
    ),
  );
  chakCreateChart(
    "chakCtNewRtt",
    chakBarChart(trend, [
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.green },
      { key: "tx_rtt", label: "TX_RTT", color: CHAK_COLORS.purple },
    ]),
  );
  // Funnel: Treatment Cascade (from PBIX)
  var cascadeLatest = [
    { label: "TX_CURR", value: chakLast(trend, "tx_curr") },
    { label: "TX_NEW", value: chakLast(trend, "tx_new") },
    { label: "IIT", value: chakLast(trend, "tx_ml") },
    { label: "RTT", value: chakLast(trend, "tx_rtt") },
  ];
  if (
    cascadeLatest.some(function (d) {
      return d.value > 0;
    })
  ) {
    chakCreateChart(
      "chakCtCascade",
      chakFunnelChart(cascadeLatest, [{ key: "value", label: "Count" }]),
    );
  } else {
    chakCreateChart(
      "chakCtCascade",
      chakLineChart(trend, [
        { key: "tx_curr", label: "TX_CURR", color: CHAK_COLORS.blue },
        { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.green },
        { key: "tx_rtt", label: "TX_RTT", color: CHAK_COLORS.purple },
      ]),
    );
  }
  chakCreateChart(
    "chakCtIit",
    chakBarChart(trend, [
      { key: "iit_pct", label: "% IIT", color: CHAK_COLORS.red },
    ]),
  );
  chakCreateChart(
    "chakCtTrend",
    chakLineChart(trend, [
      { key: "tx_ml", label: "TX_ML (IIT)", color: CHAK_COLORS.red },
      { key: "tx_rtt", label: "TX_RTT", color: CHAK_COLORS.purple },
    ]),
  );
});

// ── CD4/TPT ──
registerChakRenderer("cd4-tpt-uptake", "cd4-tpt", function (el, data) {
  const trend = data.trend || [];
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-flask"></i> CD4 & TPT Uptake</h2><p>CD4 testing at ART initiation and TPT coverage</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">% CD4<200 at start</div><div class="chak-kpi-value red">${chakAvg(trend, "pct_cd4_less200")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">CD4 Uptake</div><div class="chak-kpi-value blue">${chakAvg(trend, "cd4_uptake_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TPT Uptake</div><div class="chak-kpi-value green">${chakAvg(trend, "tpt_uptake_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">RTT with CD4<200</div><div class="chak-kpi-value orange">${chakFmt(chakLast(trend, "rtt_cd4_less200"))}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("CD4 Distribution (Latest)", "chakCd4Pie")}
            ${chakChartCard("CD4 & TPT Uptake %", "chakCd4Uptake")}
            ${chakChartCard("CD4 Counts (Bar)", "chakCd4Counts")}
            ${chakChartCard("RTT CD4<200", "chakRttBar")}
            ${chakChartCard("CD4 Trend", "chakCd4Trend", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "cd4_less200", "cd4_more200", "cd4_unknown", "cd4_uptake_pct", "tpt", "tpt_uptake_pct", "rtt_cd4_less200"], ["Month", "CD4<200", "CD4>=200", "Unknown", "CD4 Uptake", "TPT", "TPT Uptake", "RTT<200"])}
    `;
  el.setAttribute("data-chak-slug", "cd4-tpt-uptake");
  _chakSetData("cd4-tpt-uptake", data);
  const latest = trend[trend.length - 1] || {};
  // CD4 Latest distribution (using donut builder)
  var cd4PieData = [
    { label: "CD4 <200", value: latest.cd4_less200 || 0 },
    { label: "CD4 >=200", value: latest.cd4_more200 || 0 },
    { label: "CD4 Unknown", value: latest.cd4_unknown || 0 },
  ];
  chakCreateChart(
    "chakCd4Pie",
    chakDonutChart(cd4PieData, [{ key: "value", label: "CD4" }]),
  );
  chakCreateChart(
    "chakCd4Uptake",
    chakLineChart(trend, [
      { key: "cd4_uptake_pct", label: "CD4 Uptake %", color: CHAK_COLORS.blue },
      {
        key: "tpt_uptake_pct",
        label: "TPT Uptake %",
        color: CHAK_COLORS.green,
      },
    ]),
  );
  // CD4 distribution 100% stacked (latest period showed proportion)
  var cd4Distro = [
    { label: "CD4 <200", value: chakLast(trend, "cd4_less200") },
    { label: "CD4 >=200", value: chakLast(trend, "cd4_more200") },
    { label: "Unknown", value: chakLast(trend, "cd4_unknown") },
  ];
  if (
    cd4Distro.some(function (d) {
      return d.value > 0;
    })
  ) {
    chakCreateChart(
      "chakCd4Counts",
      chakDonutChart(cd4Distro, [{ key: "value", label: "CD4" }]),
    );
  } else {
    chakCreateChart(
      "chakCd4Counts",
      chakBarChart(trend, [
        { key: "cd4_less200", label: "CD4<200", color: CHAK_COLORS.red },
        { key: "cd4_more200", label: "CD4>=200", color: CHAK_COLORS.green },
        { key: "cd4_unknown", label: "Unknown", color: CHAK_COLORS.orange },
      ]),
    );
  }
  chakCreateChart(
    "chakRttBar",
    chakBarChart(trend, [
      {
        key: "rtt_cd4_less200",
        label: "RTT CD4<200",
        color: CHAK_COLORS.orange,
      },
    ]),
  );
  chakCreateChart(
    "chakCd4Trend",
    chakLineChart(trend, [
      { key: "cd4_less200", label: "CD4<200", color: CHAK_COLORS.red },
      {
        key: "rtt_cd4_less200",
        label: "RTT CD4<200",
        color: CHAK_COLORS.orange,
      },
    ]),
  );
});

// ── VL Cascade ──
registerChakRenderer("vl-cascade", "vl-cascade", function (el, data) {
  const trend = data.trend || [];
  const latest = trend[trend.length - 1] || {};
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-chart-line"></i> Viral Load Cascade</h2><p>VL monitoring: eligible, tested (D), suppressed (N), uptake & suppression rates</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">% VL Uptake</div><div class="chak-kpi-value green">${chakLast(trend, "vl_uptake_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">% VL Suppression</div><div class="chak-kpi-value teal">${chakLast(trend, "vl_suppression_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_CURR</div><div class="chak-kpi-value blue">${chakFmt(chakLast(trend, "tx_curr"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">VL Eligible</div><div class="chak-kpi-value purple">${chakFmt(chakLast(trend, "pvls_eligible"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">VL Done</div><div class="chak-kpi-value orange">${chakFmt(chakLast(trend, "pvls_done"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">VL Suppressed</div><div class="chak-kpi-value green">${chakFmt(chakLast(trend, "pvls_suppressed"))}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("VL Cascade (Bar)", "chakVlBar")}
            ${chakChartCard("Uptake vs Suppression", "chakVlPct")}
            ${chakChartCard("VL Counts (Area)", "chakVlArea")}
            ${chakChartCard("VL Cascade Donut", "chakVlDonut")}
            ${chakChartCard("VL Monthly Trend", "chakVlTrend", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "pvls_eligible", "pvls_done", "pvls_suppressed", "vl_uptake_pct", "vl_suppression_pct"], ["Month", "Eligible", "Done", "Suppressed", "% Uptake", "% Suppressed"])}
    `;
  el.setAttribute("data-chak-slug", "vl-cascade");
  _chakSetData("vl-cascade", data);
  // Latest cascade bar
  chakCreateChart("chakVlBar", {
    type: "bar",
    data: {
      labels: ["Eligible", "Done", "Suppressed"],
      datasets: [
        {
          data: [
            latest.pvls_eligible || 0,
            latest.pvls_done || 0,
            latest.pvls_suppressed || 0,
          ],
          backgroundColor: [
            CHAK_COLORS.purple,
            CHAK_COLORS.orange,
            CHAK_COLORS.green,
          ],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
  // Uptake vs suppression line
  chakCreateChart(
    "chakVlPct",
    chakLineChart(trend, [
      { key: "vl_uptake_pct", label: "% VL Uptake", color: CHAK_COLORS.green },
      {
        key: "vl_suppression_pct",
        label: "% VL Suppression",
        color: CHAK_COLORS.teal,
      },
    ]),
  );
  // Area chart for counts
  chakCreateChart("chakVlArea", {
    type: "line",
    data: {
      labels: trend.map((r) => r.label),
      datasets: [
        {
          label: "Eligible",
          data: trend.map((r) => r.pvls_eligible || 0),
          borderColor: CHAK_COLORS.purple,
          backgroundColor: CHAK_COLORS.purple + "40",
          fill: true,
          tension: 0.3,
        },
        {
          label: "Done",
          data: trend.map((r) => r.pvls_done || 0),
          borderColor: CHAK_COLORS.orange,
          backgroundColor: CHAK_COLORS.orange + "40",
          fill: true,
          tension: 0.3,
        },
        {
          label: "Suppressed",
          data: trend.map((r) => r.pvls_suppressed || 0),
          borderColor: CHAK_COLORS.green,
          backgroundColor: CHAK_COLORS.green + "40",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: { y: { beginAtZero: true } },
    },
  });
  // Latest donut (using builder)
  var vlDonutData = [
    {
      label: "Not Done",
      value: Math.max(0, (latest.pvls_eligible || 0) - (latest.pvls_done || 0)),
    },
    { label: "Suppressed", value: latest.pvls_suppressed || 0 },
    {
      label: "Not Suppressed",
      value: Math.max(
        0,
        (latest.pvls_done || 0) - (latest.pvls_suppressed || 0),
      ),
    },
  ];
  chakCreateChart(
    "chakVlDonut",
    chakDonutChart(vlDonutData, [{ key: "value", label: "VL" }]),
  );
  // Trend with combo: VL Done/Suppressed bars + % line
  chakCreateChart(
    "chakVlTrend",
    chakLineClusteredColumnComboChart(
      trend,
      [
        {
          key: "pvls_eligible",
          label: "Eligible",
          color: CHAK_COLORS.purple + "80",
        },
        { key: "pvls_done", label: "Done", color: CHAK_COLORS.orange + "80" },
        {
          key: "pvls_suppressed",
          label: "Suppressed",
          color: CHAK_COLORS.green + "80",
        },
      ],
      [
        {
          key: "vl_suppression_pct",
          label: "% Suppression",
          color: CHAK_COLORS.teal,
        },
      ],
    ),
  );
});

// ── PMTCT ──
registerChakRenderer("pmtct", "pmtct", function (el, data) {
  const trend = data.trend || [];
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-baby"></i> PMTCT</h2><p>Prevention of Mother-to-Child Transmission: ANC cascade</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Known Pos at ANC1</div><div class="chak-kpi-value blue">${chakFmt(chakLast(trend, "anc1_known_pos"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">New Pos at ANC1</div><div class="chak-kpi-value pink">${chakFmt(chakLast(trend, "anc1_new_pos"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Started ART</div><div class="chak-kpi-value green">${chakFmt(chakLast(trend, "started_art"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">PMTCT Uptake</div><div class="chak-kpi-value purple">${chakLast(trend, "pmtct_uptake_pct")}%</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("PMTCT Cascade", "chakPmtctCascade")}
            ${chakChartCard("PMTCT Trend", "chakPmtctTrend")}
    </div>`;
  el.setAttribute("data-chak-slug", "pmtct");
  _chakSetData("pmtct", data);
  // Combo: Total HIV+ bars + % Uptake line
  chakCreateChart(
    "chakPmtctCascade",
    chakLineClusteredColumnComboChart(
      trend,
      [
        {
          key: "total_pos",
          label: "HIV+ at ANC1",
          color: CHAK_COLORS.pink + "80",
        },
        {
          key: "started_art",
          label: "Started ART",
          color: CHAK_COLORS.green + "80",
        },
      ],
      [
        {
          key: "pmtct_uptake_pct",
          label: "% PMTCT Uptake",
          color: CHAK_COLORS.purple,
        },
      ],
    ),
  );
  chakCreateChart(
    "chakPmtctTrend",
    chakBarChart(trend, [
      {
        key: "pmtct_uptake_pct",
        label: "% PMTCT Uptake",
        color: CHAK_COLORS.purple,
      },
    ]),
  );
});

// ── TB ──
registerChakRenderer("tb", "tb", function (el, data) {
  const trend = data.trend || [];
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-lungs"></i> TB/HIV</h2><p>TB screening, diagnosis, and ART among TB patients</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">TB Screened</div><div class="chak-kpi-value blue">${chakFmt(chakSum(trend, "tb_screened"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TB Positive</div><div class="chak-kpi-value red">${chakFmt(chakSum(trend, "tb_pos"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TB Positivity</div><div class="chak-kpi-value orange">${chakAvg(trend, "tb_positivity_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">On ART Among TB</div><div class="chak-kpi-value green">${chakAvg(trend, "tb_art_uptake_pct")}%</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("TB Cascade", "chakTbCascade")}
            ${chakChartCard("TB on ART Uptake", "chakTbArt")}
    </div>`;
  el.setAttribute("data-chak-slug", "tb");
  _chakSetData("tb", data);
  // Combo: cascade bars + % positivity line
  chakCreateChart(
    "chakTbCascade",
    chakLineClusteredColumnComboChart(
      trend,
      [
        {
          key: "tb_screened",
          label: "Screened",
          color: CHAK_COLORS.blue + "80",
        },
        { key: "tb_pos", label: "TB+", color: CHAK_COLORS.red + "80" },
        { key: "tb_on_art", label: "On ART", color: CHAK_COLORS.green + "80" },
      ],
      [{ key: "tb_positivity_pct", label: "% TB+", color: CHAK_COLORS.orange }],
    ),
  );
  chakCreateChart(
    "chakTbArt",
    chakLineChart(trend, [
      { key: "tb_art_uptake_pct", label: "% on ART", color: CHAK_COLORS.green },
      { key: "tb_positivity_pct", label: "% TB+", color: CHAK_COLORS.orange },
    ]),
  );
});

// ── Post Rape ──
registerChakRenderer("post_rape", "post-rape", function (el, data) {
  const trend = data.trend || [];
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-hand"></i> POST RESP (Post-Rape Care)</h2><p>Post-rape care services: physical/emotional, sexual violence</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Physical/Emotional</div><div class="chak-kpi-value orange">${chakFmt(chakSum(trend, "physical_emotional"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Sexual Violence</div><div class="chak-kpi-value pink">${chakFmt(chakSum(trend, "sexual_violence"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total</div><div class="chak-kpi-value purple">${chakFmt(chakSum(trend, "total"))}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("POST RESP Trend", "chakPostRapeTrend", "full")}
    </div>`;
  el.setAttribute("data-chak-slug", "post_rape");
  _chakSetData("post_rape", data);
  chakCreateChart(
    "chakPostRapeTrend",
    chakLineChart(trend, [
      {
        key: "physical_emotional",
        label: "Physical/Emotional",
        color: CHAK_COLORS.orange,
      },
      {
        key: "sexual_violence",
        label: "Sexual Violence",
        color: CHAK_COLORS.pink,
      },
      { key: "total", label: "Total", color: CHAK_COLORS.purple },
    ]),
  );
});

// ── CACX ──
registerChakRenderer("cacx", "cacx", function (el, data) {
  const trend = data.trend || [];
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-ribbon"></i> CACX (Cervical Cancer Screening)</h2><p>Cervical cancer screening, positivity, and treatment cascade</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Screened</div><div class="chak-kpi-value blue">${chakFmt(chakSum(trend, "screened"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Positive</div><div class="chak-kpi-value pink">${chakFmt(chakSum(trend, "positive"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Treated</div><div class="chak-kpi-value green">${chakFmt(chakSum(trend, "treated"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg Positivity</div><div class="chak-kpi-value orange">${chakAvg(trend, "positivity_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg Treatment Rate</div><div class="chak-kpi-value purple">${chakAvg(trend, "treatment_pct")}%</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("CACX Cascade", "chakCacxCascade")}
            ${chakChartCard("% Positivity & Treatment", "chakCacxPct")}
    </div>`;
  el.setAttribute("data-chak-slug", "cacx");
  _chakSetData("cacx", data);
  chakCreateChart(
    "chakCacxCascade",
    chakLineChart(trend, [
      { key: "screened", label: "Screened", color: CHAK_COLORS.blue },
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
      { key: "treated", label: "Treated", color: CHAK_COLORS.green },
    ]),
  );
  chakCreateChart(
    "chakCacxPct",
    chakLineChart(trend, [
      { key: "positivity_pct", label: "% Positive", color: CHAK_COLORS.orange },
      { key: "treatment_pct", label: "% Treated", color: CHAK_COLORS.purple },
    ]),
  );
});

// ── IIT Quarterly ──
registerChakRenderer("iit-quarterly", "iit-quarterly", function (el, data) {
  const trend = data.trend || [];
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-triangle-exclamation"></i> IIT Quarterly</h2><p>Interruption in Treatment: Patients lost to follow-up vs TX_CURR</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg IIT Rate</div><div class="chak-kpi-value red">${chakAvg(trend, "iit_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total IIT</div><div class="chak-kpi-value orange">${chakFmt(chakSum(trend, "tx_ml"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Latest TX_CURR</div><div class="chak-kpi-value blue">${chakFmt(chakLast(trend, "tx_curr"))}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("IIT Count + % (Combo)", "chakIitCombo")}
            ${chakChartCard("IIT % Bar", "chakIitBar")}
            ${chakChartCard("IIT vs TX_CURR", "chakIitTrend", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tx_curr", "tx_ml", "iit_pct"], ["Month", "TX_CURR", "IIT", "% IIT"])}
    `;
  el.setAttribute("data-chak-slug", "iit-quarterly");
  _chakSetData("iit-quarterly", data);
  // Combo: IIT count bar + % line (using builder)
  chakCreateChart(
    "chakIitCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "tx_ml", label: "TX_ML (IIT)", color: CHAK_COLORS.red + "80" }],
      [{ key: "iit_pct", label: "% IIT", color: CHAK_COLORS.orange }],
    ),
  );
  chakCreateChart(
    "chakIitBar",
    chakBarChart(trend, [
      { key: "iit_pct", label: "% IIT", color: CHAK_COLORS.red },
    ]),
  );
  chakCreateChart(
    "chakIitTrend",
    chakLineChart(trend, [
      { key: "tx_ml", label: "TX_ML (IIT)", color: CHAK_COLORS.red },
      {
        key: "iit_pct",
        label: "% IIT",
        color: CHAK_COLORS.orange,
        yAxisID: "y1",
      },
    ]),
  );
});

// ── HTS Summary ──
registerChakRenderer("hts-summary", "hts-summary", function (el, data) {
  const trend = data.trend || [];
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-microscope"></i> HTS Summary</h2><p>HIV Testing Services high-level summary with TX_NEW</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Tested</div><div class="chak-kpi-value blue">${chakFmt(chakSum(trend, "tested"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Positive</div><div class="chak-kpi-value pink">${chakFmt(chakSum(trend, "positive"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Positivity Rate</div><div class="chak-kpi-value orange">${chakAvg(trend, "positivity_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_NEW (Total)</div><div class="chak-kpi-value teal">${chakFmt(chakSum(trend, "tx_new"))}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("Tested + TX_NEW (Combo)", "chakHtsSumCombo")}
            ${chakChartCard("Positive → TX_NEW", "chakHtsSumBars")}
            ${chakChartCard("HTS Monthly", "chakHtsSummaryTrend", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tested", "positive", "positivity_pct", "tx_new"], ["Month", "Tested", "Positive", "% Positive", "TX_NEW"])}
    `;
  el.setAttribute("data-chak-slug", "hts-summary");
  _chakSetData("hts-summary", data);
  chakCreateChart(
    "chakHtsSumCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "tested", label: "Tested", color: CHAK_COLORS.blue + "80" }],
      [
        {
          key: "positivity_pct",
          label: "% Positive",
          color: CHAK_COLORS.orange,
        },
      ],
    ),
  );
  chakCreateChart(
    "chakHtsSumBars",
    chakBarChart(trend, [
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
    ]),
  );
  chakCreateChart(
    "chakHtsSummaryTrend",
    chakLineChart(trend, [
      { key: "tested", label: "Tested", color: CHAK_COLORS.blue },
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
    ]),
  );
});

// ── Testing Modality ──
registerChakRenderer(
  "testing-modality",
  "testing-modality",
  function (el, data) {
    const trend = data.trend || [];
    el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-layer-group"></i> Testing per Modality</h2><p>Testing by entry point: tested, positive, yield, and TX_NEW</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Tested</div><div class="chak-kpi-value blue">${chakFmt(chakSum(trend, "tested"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Positive</div><div class="chak-kpi-value pink">${chakFmt(chakSum(trend, "positive"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg Yield</div><div class="chak-kpi-value orange">${chakAvg(trend, "yield_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_NEW (Total)</div><div class="chak-kpi-value teal">${chakFmt(chakSum(trend, "tx_new"))}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("Tested + Yield (Combo)", "chakModCombo")}
            ${chakChartCard("Positive → TX_NEW", "chakModBars")}
            ${chakChartCard("Testing by Modality", "chakModalityTrend", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tested", "positive", "yield_pct", "tx_new"], ["Month", "Tested", "Positive", "Yield %", "TX_NEW"])}
    `;
    el.setAttribute("data-chak-slug", "testing-modality");
    _chakSetData("testing-modality", data);
    chakCreateChart(
      "chakModCombo",
      chakLineClusteredColumnComboChart(
        trend,
        [{ key: "tested", label: "Tested", color: CHAK_COLORS.blue + "80" }],
        [{ key: "yield_pct", label: "Yield %", color: CHAK_COLORS.orange }],
      ),
    );
    chakCreateChart(
      "chakModBars",
      chakBarChart(trend, [
        { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
        { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
      ]),
    );
    chakCreateChart(
      "chakModalityTrend",
      chakLineChart(trend, [
        { key: "tested", label: "Tested", color: CHAK_COLORS.blue },
        { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
        {
          key: "yield_pct",
          label: "Yield %",
          color: CHAK_COLORS.orange,
          yAxisID: "y1",
        },
      ]),
    );
  },
);

// ── Linkage (HTS Linkage page from PBIX) ──
registerChakRenderer("linkage", "linkage", function (el, data) {
  const trend = data.trend || [];
  const cascade = data.cascade || {};
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-link"></i> Linkage</h2><p>HTS linkage cascade: tested → positive → linked → on treatment</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Tested</div><div class="chak-kpi-value blue">${chakFmt(chakSum(trend, "tested"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Positive</div><div class="chak-kpi-value pink">${chakFmt(chakSum(trend, "positive"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg Linkage Rate</div><div class="chak-kpi-value green">${chakAvg(trend, "linkage_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total TX_NEW</div><div class="chak-kpi-value teal">${chakFmt(chakSum(trend, "tx_new"))}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("Linkage Cascade (Funnel)", "chakLinkCascade")}
            ${chakChartCard("Linked Within/Outside", "chakLinkBreakdown")}
            ${chakChartCard("Linkage Rate Over Time", "chakLinkTrend", "full")}
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("Tested → TX_NEW (Combo)", "chakLinkCombo", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tested", "positive", "total_linked", "linkage_pct", "tx_new"], ["Month", "Tested", "Positive", "Linked", "Linkage %", "TX_NEW"])}
    `;
  el.setAttribute("data-chak-slug", "linkage");
  _chakSetData("linkage", data);

  // Cascade funnel chart (horizontal bar acting as funnel)
  if (cascade.categories && cascade.categories.length) {
    var cascadeData = cascade.categories.map(function (c, i) {
      return { label: c, value: (cascade.values || [])[i] || 0 };
    });
    chakCreateChart(
      "chakLinkCascade",
      chakFunnelChart(cascadeData, [{ key: "value", label: "Count" }]),
    );
  }

  // Linked within vs outside (100% stacked)
  chakCreateChart(
    "chakLinkBreakdown",
    chak100PctStackedBarChart(trend, [
      { key: "linked_within", label: "Linked Within", color: "#16a34a" },
      { key: "linked_outside", label: "Linked Outside", color: "#ea580c" },
      { key: "tx_new", label: "TX_NEW", color: "#2563eb" },
    ]),
  );

  // Linkage rate over time
  chakCreateChart(
    "chakLinkTrend",
    chakLineChart(trend, [
      { key: "linkage_pct", label: "Linkage %", color: CHAK_COLORS.green },
      {
        key: "tx_new_pct",
        label: "TX_NEW %",
        color: CHAK_COLORS.teal,
        yAxisID: "y1",
      },
    ]),
  );

  // Combo: tested bar + linkage % line
  chakCreateChart(
    "chakLinkCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "tested", label: "Tested", color: CHAK_COLORS.blue + "80" }],
      [{ key: "linkage_pct", label: "Linkage %", color: CHAK_COLORS.green }],
    ),
  );
});

// ═══════════════════════════════════════════════════════════════════
// ── renderChakPage — Fetch data + call renderer ─────────────────
// ═══════════════════════════════════════════════════════════════════
function renderChakPage(container, slug, apiPageId) {
  // Show loading
  container.innerHTML = `
    <div class="flex items-center justify-center py-16 text-slate-500 text-sm gap-2">
      <div class="w-5 h-5 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
      Loading CHAK data…
    </div>
  `;

  const county =
    state.countyFilter !== "all" ? state.countyFilter : "Meru County";
  let url = `/pbix/api/${encodeURIComponent(apiPageId)}?county=${encodeURIComponent(county)}`;
  // Pass subcounty filter if set
  if (state.subCountyFilter && state.subCountyFilter !== "all") {
    url += `&subcounty=${encodeURIComponent(state.subCountyFilter)}`;
  }
  // Pass facility filter if set
  if (state.facilityFilter && state.facilityFilter !== "all") {
    url += `&facility=${encodeURIComponent(state.facilityFilter)}`;
  }
  // Pass period filter if set (default LAST_12_MONTHS)
  url += `&period=${state.periodFilter && state.periodFilter !== "all" ? encodeURIComponent(state.periodFilter) : "LAST_12_MONTHS"}`;

  fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((data) => {
      // Destroy previous Chart.js instances
      destroyChakCharts();
      container.innerHTML = "";

      // Find renderer by slug
      let renderer = CHAK_RENDERERS[slug];
      if (!renderer) {
        // Fallback: search by apiPageId
        const found = Object.values(CHAK_RENDERERS).find(
          (r) => r.apiPageId === apiPageId,
        );
        if (found) renderer = found;
      }

      if (renderer && renderer.renderFn) {
        renderer.renderFn(container, data);
      } else {
        container.innerHTML = `<div class="chak-error-card">No renderer found for: ${escapeHtml(slug)}</div>`;
      }
    })
    .catch((err) => {
      container.innerHTML = `<div class="chak-error-card"><i class="fas fa-exclamation-triangle"></i><br>Failed to load CHAK data: ${escapeHtml(err.message)}</div>`;
    });
}
