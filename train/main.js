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

  // Check for project context: #/p/{projectCode}/{page}/{subtab}
  // projectCode: jm = jamii_tekelezi
  const projectMap = { jm: "jamii_tekelezi" };
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
  ]);
  if (!validPages.has(pageId)) return;

  state.activePage = pageId;
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

function setPageHash(pageId, subtabLabel = "") {
  const sub = subtabLabel ? `/${toSlug(subtabLabel)}` : "";
  // Include project context in hash if active
  const projectPrefix = state.activeProject === "jamii_tekelezi" ? "p/jm/" : "";
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

  // Populate project filter with placeholder projects
  if (elements.projectFilter && !elements.projectFilter.dataset.populated) {
    const projects = [
      { value: "all", label: "All Projects" },
      { value: "jamii-tekelezi", label: "Jamii Tekelezi" },
      { value: "chap-stawisha", label: "CHAP Stawisha" },
      { value: "eye-health", label: "Eye Health - ACSP & GitLab" },
      { value: "eis", label: "EIS" },
      { value: "bftw-hss", label: "BFTW HSS" },
      { value: "bftw-rmncah", label: "BFTW RMNCAH" },
      { value: "pep", label: "PEP" },
      { value: "gf-mnch", label: "GF-MNCH" },
      { value: "impact", label: "IMPACT" },
      { value: "cdic-icare", label: "CDIC-iCARE" },
    ];
    renderSelectOptions(elements.projectFilter, "", projects);
    elements.projectFilter.dataset.populated = "true";
  }
}

// ── Health Programmes Page ──
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
        `${MHU_API}?dx=${encodeURIComponent(moh711Dx)}&ou=${encodeURIComponent(ouId)}&pe=LAST_12_MONTHS`,
      );
      if (resp711.ok) {
        const result711 = await resp711.json();
        moh711Data = result711.data || {};
      }
    }

    const resp = await fetch(
      `${MHU_API}?dx=${encodeURIComponent(dxIds)}&ou=${encodeURIComponent(ouId)}&pe=LAST_12_MONTHS`,
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
          <div class="mt-1 text-xs">KHIS returned no records for ${escapeHtml(facilityName)} in the last 12 months</div>
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
          `${MHU_COC_API}?dx=${encodeURIComponent(dxStr)}&co=${encodeURIComponent(cocStr)}&ou=${encodeURIComponent(ouId)}&pe=LAST_12_MONTHS`,
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
          pe: "LAST_12_MONTHS",
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
        pe: "LAST_12_MONTHS",
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

function renderProjectSelection() {
  const projects = [
    {
      id: "jamii_tekelezi",
      name: "Jamii Tekelezi",
      desc: "Comprehensive HIV/AIDS program dashboard — Testing, Treatment, PrEP, PMTCT, TB, and more.",
      icon: "📊",
      color: "bg-sky-50 border-sky-200 hover:bg-sky-100",
    },
    {
      id: "chap_stawisha",
      name: "CHAP Stawisha",
      desc: "Community Health and Adolescent Program — Stawisha initiative.",
      icon: "🌱",
      color: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
    },
    {
      id: "eye_health",
      name: "Eye Health — ACSP & GitLab",
      desc: "Eye Health program — ACSP and GitLab partnership.",
      icon: "👁️",
      color: "bg-purple-50 border-purple-200 hover:bg-purple-100",
    },
    {
      id: "eis",
      name: "EIS",
      desc: "Enhanced Infection Surveillance program.",
      icon: "🔬",
      color: "bg-amber-50 border-amber-200 hover:bg-amber-100",
    },
    {
      id: "bftw_hss",
      name: "BFTW HSS",
      desc: "Bread for the World — Health Systems Strengthening.",
      icon: "🏗️",
      color: "bg-indigo-50 border-indigo-200 hover:bg-indigo-100",
    },
    {
      id: "bftw_rmncah",
      name: "BFTW RMNCAH",
      desc: "Bread for the World — Reproductive, Maternal, Newborn, Child and Adolescent Health.",
      icon: "👶",
      color: "bg-rose-50 border-rose-200 hover:bg-rose-100",
    },
    {
      id: "pep",
      name: "PEP",
      desc: "Post-Exposure Prophylaxis program tracking.",
      icon: "💊",
      color: "bg-cyan-50 border-cyan-200 hover:bg-cyan-100",
    },
    {
      id: "gf_mnch",
      name: "GF-MNCH",
      desc: "Global Fund — Maternal, Newborn and Child Health.",
      icon: "🤱",
      color: "bg-pink-50 border-pink-200 hover:bg-pink-100",
    },
    {
      id: "impact",
      name: "IMPACT",
      desc: "Integrated Monitoring and Program Analysis for Comprehensive Tracking.",
      icon: "🎯",
      color: "bg-orange-50 border-orange-200 hover:bg-orange-100",
    },
    {
      id: "cdic_icare",
      name: "CDIC-iCARE",
      desc: "Comprehensive Data Integration for Community AIDS Response Enhancement.",
      icon: "💻",
      color: "bg-teal-50 border-teal-200 hover:bg-teal-100",
    },
  ];

  elements.chartRoot.innerHTML = `
    <div class="space-y-6">
      <div class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div class="flex items-center gap-3 mb-5">
          <div class="text-2xl">📋</div>
          <div>
            <h2 class="text-lg font-bold text-slate-800">Select a Project</h2>
            <p class="text-xs text-slate-500">Choose a project to view its dashboards and reports.</p>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${projects
            .map(
              (p) => `
            <button data-project="${escapeHtml(p.id)}" class="flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${p.color}">
              <div class="text-3xl shrink-0">${p.icon}</div>
              <div class="min-w-0">
                <div class="text-[14px] font-bold text-slate-800">${escapeHtml(p.name)}</div>
                <div class="text-[12px] text-slate-500 mt-0.5 leading-snug">${escapeHtml(p.desc)}</div>
              </div>
            </button>
          `,
            )
            .join("")}
        </div>
      </div>
    </div>
  `;

  elements.chartRoot.querySelectorAll("[data-project]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const projectId = btn.getAttribute("data-project") || "";
      if (projectId === "jamii_tekelezi") {
        state.activeProject = "jamii_tekelezi";
        if (elements.projectFilter)
          elements.projectFilter.value = "jamii-tekelezi";
        state.activePage = "overview";
        setPageHash("overview");
        renderCurrentView();
      }
    });
  });
}

function renderPlaygroundPage() {
  const existingPrompt =
    document.getElementById("playgroundPrompt")?.value || "";

  if (state.playgroundChart) {
    state.playgroundChart.destroy();
    state.playgroundChart = null;
  }

  elements.chartRoot.innerHTML = `
    <div class="space-y-6">
      <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div class="text-2xl font-bold text-slate-800">Playground</div>
            <div class="mt-1 max-w-2xl text-sm text-slate-500">Get any report or visual with just a prompt.</div>
          </div>
          <div class="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">
            <span class="h-2 w-2 rounded-full bg-sky-500"></span> Groq-powered AI query interface
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-sky-50 p-5 shadow-sm">
        <div class="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <div class="text-sm font-semibold text-slate-700">Ask a question</div>
            <p class="mt-1 text-xs text-slate-500">Finance mode reuses the project-performance dataset; DHIS2 mode sends the prompt through the main Groq SQL route.</p>
            <textarea id="playgroundPrompt" class="mt-4 min-h-[130px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white" placeholder="Example: Show me the actual vs target for Jamii Tekelezi or visualize TX CURR for May">${escapeHtml(existingPrompt)}</textarea>
            <div class="mt-3 flex flex-wrap gap-2">
              <button type="button" data-playground-mode="finance" class="rounded-full border px-3 py-2 text-xs font-semibold transition ${state.playgroundMode === "finance" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}">Finance reports</button>
              <button type="button" data-playground-mode="dhis2" class="rounded-full border px-3 py-2 text-xs font-semibold transition ${state.playgroundMode === "dhis2" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}">DHIS2 reports</button>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <button type="button" data-playground-example="Show me the actual vs target for Jamii Tekelezi" class="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-100">Finance example</button>
              <button type="button" data-playground-example="Visualize TX CURR for May" class="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-100">TX_CURR example</button>
              <button type="button" data-playground-example="Give me TB for May" class="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-100">TB example</button>
            </div>
            <div class="mt-4 flex items-center gap-3">
              <button id="playgroundSubmit" class="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700">Generate report</button>
              <span id="playgroundStatus" class="text-xs text-slate-500">Ready.</span>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <div class="text-sm font-semibold text-slate-700">How it works</div>
            <ul class="mt-3 space-y-2 text-sm text-slate-600">
              <li>• Finance mode reuses the same project-performance data the finance analysis tab uses.</li>
              <li>• DHIS2 mode uses the existing Groq-backed SQL chat route.</li>
              <li>• Results render as cards, charts, and a table when data is returned.</li>
            </ul>
          </div>
        </div>
      </section>

      <section class="space-y-4">
        <div id="playgroundSummaryCards" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"></div>
        <div id="playgroundChartWrap" class="hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="text-sm font-semibold text-slate-700 mb-3">Visual</div>
          <div class="h-[320px]"><canvas id="playgroundChartCanvas"></canvas></div>
        </div>
        <div id="playgroundAnswer" class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-700">
          Ask a prompt to generate a report or visual.
        </div>
      </section>
    </div>
  `;

  const promptInput = document.getElementById("playgroundPrompt");
  const submitButton = document.getElementById("playgroundSubmit");
  const status = document.getElementById("playgroundStatus");

  document.querySelectorAll("[data-playground-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.playgroundMode =
        button.getAttribute("data-playground-mode") || "finance";
      renderPlaygroundPage();
      const nextInput = document.getElementById("playgroundPrompt");
      if (nextInput && promptInput) nextInput.value = promptInput.value;
    });
  });

  document.querySelectorAll("[data-playground-example]").forEach((button) => {
    button.addEventListener("click", () => {
      if (promptInput)
        promptInput.value =
          button.getAttribute("data-playground-example") || "";
    });
  });

  const submitPlaygroundPrompt = async () => {
    const question = (promptInput && promptInput.value.trim()) || "";
    if (!question) {
      if (status) status.textContent = "Enter a prompt first.";
      return;
    }

    if (status) status.textContent = "Generating…";
    if (submitButton) submitButton.disabled = true;

    try {
      const requestBody = {
        question,
        chart_id:
          state.playgroundMode === "finance"
            ? "playground-finance"
            : "playground-dhis2",
        active_page:
          state.playgroundMode === "finance"
            ? "financial_analysis"
            : "overview",
        active_tab: state.playgroundMode === "finance" ? "overview" : "",
      };

      if (state.playgroundMode === "finance") {
        const chartData = await loadPlaygroundFinanceChartData();
        if (chartData) {
          requestBody.chart_data = chartData;
        }
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "The assistant could not process that request.",
        );
      }

      renderPlaygroundResponse(result);
      if (status) status.textContent = result.summary || "Completed.";
    } catch (error) {
      renderPlaygroundError(
        error.message || "Network error while contacting the AI assistant.",
      );
      if (status) status.textContent = "Failed.";
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  };

  if (submitButton) {
    submitButton.addEventListener("click", submitPlaygroundPrompt);
  }
  if (promptInput) {
    promptInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.ctrlKey) {
        submitPlaygroundPrompt();
      }
    });
  }
}

async function loadPlaygroundFinanceChartData() {
  if (state.playgroundFinanceData) return state.playgroundFinanceData;

  const response = await fetch("/api/project-portfolio");
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "Failed to load finance data");

  const projects = (data.portfolio && data.portfolio.projects) || [];
  const labels = projects.map((project) => project.project || "Project");
  const budget = projects.map((project) =>
    Number(project.total_annual_budget || 0),
  );
  const expenditure = projects.map((project) =>
    Number(project.cumulative_expenditure || 0),
  );
  const onTrack = projects.map((project) =>
    project.overall_rag === "On Track" ? 1 : 0,
  );

  state.playgroundFinanceData = {
    labels,
    datasets: [
      { label: "Annual Budget", data: budget },
      { label: "Cumulative Expenditure", data: expenditure },
      { label: "On Track Projects", data: onTrack },
    ],
  };

  return state.playgroundFinanceData;
}

function renderPlaygroundResponse(payload) {
  const summaryCards = document.getElementById("playgroundSummaryCards");
  const answer = document.getElementById("playgroundAnswer");
  const chartWrap = document.getElementById("playgroundChartWrap");
  const chartCanvas = document.getElementById("playgroundChartCanvas");

  if (!summaryCards || !answer) return;

  summaryCards.innerHTML = `
    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Rows returned</div>
      <div class="mt-2 text-2xl font-bold text-slate-800">${Number(payload.row_count || 0).toLocaleString()}</div>
    </div>
    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Source</div>
      <div class="mt-2 text-2xl font-bold text-slate-800">${escapeHtml(payload.source || "ai")}</div>
    </div>
    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2 xl:col-span-2">
      <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">SQL</div>
      <div class="mt-2 break-words text-xs text-slate-600">${escapeHtml(payload.sql || "")}</div>
    </div>
  `;

  answer.innerHTML =
    payload.answer_html ||
    `<p>${escapeHtml(payload.summary || "No answer returned.")}</p>`;

  if (chartWrap && chartCanvas) {
    const chartSpec = buildPlaygroundChartSpec(
      payload.rows || [],
      payload.columns || [],
    );
    if (chartSpec) {
      chartWrap.classList.remove("hidden");
      if (state.playgroundChart) {
        state.playgroundChart.destroy();
      }
      state.playgroundChart = new Chart(chartCanvas, chartSpec);
    } else {
      chartWrap.classList.add("hidden");
      if (state.playgroundChart) {
        state.playgroundChart.destroy();
        state.playgroundChart = null;
      }
    }
  }
}

function renderPlaygroundError(message) {
  const summaryCards = document.getElementById("playgroundSummaryCards");
  const answer = document.getElementById("playgroundAnswer");
  const chartWrap = document.getElementById("playgroundChartWrap");

  if (summaryCards) summaryCards.innerHTML = "";
  if (chartWrap) chartWrap.classList.add("hidden");
  if (state.playgroundChart) {
    state.playgroundChart.destroy();
    state.playgroundChart = null;
  }
  if (answer) {
    answer.innerHTML = `<div class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">${escapeHtml(message)}</div>`;
  }
}

function buildPlaygroundChartSpec(rows, columns) {
  if (
    !Array.isArray(rows) ||
    !rows.length ||
    !Array.isArray(columns) ||
    !columns.length
  ) {
    return null;
  }

  const firstRow = rows[0] || {};
  const numericColumns = columns.filter(
    (column) => typeof firstRow[column] === "number",
  );
  const textColumns = columns.filter(
    (column) => typeof firstRow[column] === "string",
  );
  const labelColumn = textColumns[0] || columns[0];

  if (!numericColumns.length) {
    return null;
  }

  const labels = rows.slice(0, 12).map((row) => String(row[labelColumn] ?? ""));
  const datasets = numericColumns.slice(0, 3).map((column, index) => ({
    label: column,
    data: rows.slice(0, 12).map((row) => Number(row[column]) || 0),
    backgroundColor: ["#0ea5e9", "#10b981", "#8b5cf6"][index] || "#64748b",
    borderRadius: 6,
  }));

  if (!labels.length || !datasets.length) {
    return null;
  }

  return {
    type: datasets.length > 1 ? "bar" : "line",
    data: {
      labels,
      datasets: datasets.map((dataset) => ({
        ...dataset,
        fill: datasets.length === 1,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
      },
      scales: {
        x: { ticks: { maxRotation: 0, font: { size: 10 } } },
        y: { beginAtZero: true },
      },
    },
  };
}

// ── Human Resource Page ──
function renderHumanResourcePage() {
  elements.chartRoot.innerHTML = `
    <div class="space-y-6">
      <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <div class="text-5xl mb-4">👥</div>
          <h2 class="text-xl font-bold text-slate-800 mb-2">Human Resource</h2>
          <p class="text-sm text-slate-500 max-w-md">Staff management, payroll, and human resource analytics.</p>
        </div>
      </div>
    </div>
  `;
}

// ── CBSL Page ──
function renderCbslPage() {
  elements.chartRoot.innerHTML = `
    <div class="space-y-6">
      <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <div class="text-5xl mb-4">🏛️</div>
          <h2 class="text-xl font-bold text-slate-800 mb-2">CBSL — Community Based Social & Livelihood</h2>
          <p class="text-sm text-slate-500 max-w-md">Community-based social programs and livelihood initiatives.</p>
        </div>
      </div>
    </div>
  `;
}

function renderCurrentView() {
  if (!state.rawData.length) {
    return;
  }

  renderPageTabs();
  populateFilterOptions();

  // Show the general top filter bar only on non-home, non-MHU pages
  const topFilters = document.getElementById("topFilters");
  if (topFilters) {
    const isMhuPage =
      state.activePage === "health_programmes" &&
      state.activeSubtabs["health_programmes"] === "mhu";
    const isHomepage =
      state.activePage === "overview" &&
      state.activeProject !== "jamii_tekelezi";
    if (isMhuPage || isHomepage) {
      topFilters.classList.add("hidden");
    } else {
      topFilters.classList.remove("hidden");
    }
  }

  const pageId = state.activePage || "overview";

  if (pageId === "overview") {
    if (state.activeProject !== "jamii_tekelezi") {
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

    // Jamii Tekelezi project home should show the consolidated Jamii overview
    renderPageContext(pageId);
    elements.chartRoot.innerHTML = `<div id="jamiiRoot" class="space-y-6"><div id="jamiiContent" class="space-y-6"></div></div>`;
    const jamiiContainer = document.getElementById("jamiiContent");
    renderJamiiOverview(jamiiContainer);
    return;
  }

  if (pageId === "playground") {
    hidePageContext();
    renderPlaygroundPage();
    return;
  }

  // ── Health Programmes (MHU / Projects) ──
  if (pageId === "health_programmes") {
    renderPageContext(pageId);
    renderHealthProgrammes();
    return;
  }

  // ── Human Resource ──
  if (pageId === "human_resource") {
    renderPageContext(pageId);
    renderHumanResourcePage();
    return;
  }

  // ── CBSL ──
  if (pageId === "cbsl") {
    renderPageContext(pageId);
    renderCbslPage();
    return;
  }

  // Category pages with subtabs
  renderPageContext(pageId);

  // Check if we have a specific subtab to render content for
  const meta = getPageMeta(pageId);
  const subtabs = getSubtabsForPage(pageId);
  const defaultActiveSlug = toSlug(subtabs[0] || "");
  var activeSlug = state.activeSubtabs[pageId] || defaultActiveSlug;
  // If the stored slug is no longer in the filtered subtabs, reset to first
  if (
    !subtabs.some(function (s) {
      return toSlug(s) === activeSlug;
    })
  ) {
    activeSlug = defaultActiveSlug;
    state.activeSubtabs[pageId] = activeSlug;
  }
  if (!state.activeSubtabs[pageId] && defaultActiveSlug) {
    state.activeSubtabs[pageId] = activeSlug;
  }
  const activeLabel = subtabs
    ? subtabs.find(function (s) {
        return toSlug(s) === activeSlug;
      }) || ""
    : "";

  if (activeSlug === "overview") {
    elements.chartRoot.innerHTML = `<div id="categoryContent" class="space-y-6"></div>`;
    const container = document.getElementById("categoryContent");
    if (pageId === "hiv_treatment") {
      renderHivTreatmentOverview(container);
      return;
    }
    if (pageId === "hiv_testing") {
      renderHivTestingOverview(container);
      return;
    }
  }

  // ── HIV Treatment → Unified DHIS2 Live Charts ──
  if (pageId === "hiv_treatment" && SUBTAB_TYPE_MAP[activeSlug]) {
    elements.chartRoot.innerHTML = `<div id="categoryContent" class="space-y-6"></div>`;
    const container = document.getElementById("categoryContent");
    renderDhisLiveChart(container, pageId, activeSlug);
    return;
  }

  // ── HIV Testing → Unified DHIS2 HTS Live Charts ──
  if (pageId === "hiv_testing" && SUBTAB_TYPE_MAP[activeSlug]) {
    // In Jamii Tekelezi, HIV Testing Services Linkage → show global Linkage page
    if (
      state.activeProject === "jamii_tekelezi" &&
      activeSlug === "hiv-testing-services-linkage"
    ) {
      elements.chartRoot.innerHTML =
        '<div id="categoryContent" class="space-y-6"></div>';
      renderChakPage(
        document.getElementById("categoryContent"),
        "linkage",
        "linkage",
      );
      return;
    }
    elements.chartRoot.innerHTML =
      '<div id="categoryContent" class="space-y-6"></div>';
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

  // ── Financial Analysis / Project Performance Dashboard ──
  if (pageId === "financial_analysis") {
    elements.chartRoot.innerHTML = `<div id="projectPerfRoot" class="space-y-6"></div>`;
    const container = document.getElementById("projectPerfRoot");

    // Route to appropriate subtab renderer
    if (!activeSlug || activeSlug === "overview") {
      renderProjectPerformanceDashboard(container);
    } else if (activeSlug === "budget-analysis") {
      renderBudgetAnalysisSubtab(container);
    } else if (activeSlug === "indicator-performance") {
      renderIndicatorPerformanceSubtab(container);
    } else if (activeSlug === "health-summary") {
      renderHealthSummarySubtab(container);
    } else if (activeSlug === "narratives") {
      renderNarrativesSubtab(container);
    } else {
      renderProjectPerformanceDashboard(container);
    }
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
      .map((item) => {
        const val = typeof item === "object" ? item.value : item;
        const display = typeof item === "object" ? item.label : item;
        return `<option value="${escapeHtml(val)}">${escapeHtml(display)}</option>`;
      })
      .join("");
}

function openChat() {
  elements.chatOverlay.classList.remove("hidden");
  elements.chatModal.classList.remove("hidden");
  elements.chatInput.focus();

  // ── Update welcome message based on current page (no AI needed) ──
  updateChatWelcome();

  // ── Highlight the active page's nav button ──
  document.querySelectorAll(".chat-nav-btn").forEach(function (btn) {
    btn.classList.toggle(
      "active",
      btn.getAttribute("data-nav") === state.activePage,
    );
  });
}

function updateChatWelcome() {
  var welcome = document.getElementById("chatWelcome");
  if (!welcome) return;
  var meta = getPageMeta(state.activePage);
  var pageTitle = meta.title || "Home";
  var subtabs = (meta.subtabs || []).length;

  var hints = {
    overview: "📊 Browse the main dashboard KPIs and trends.",
    financial_analysis:
      "💰 Explore budgets, indicator performance, and health summaries by county.",
    health_programmes:
      "🏥 Access program dashboards — select MHU or Projects to drill in.",
    human_resource: "👥 Staff management and human resource analytics.",
    cbsl: "🏛️ Community Based Social & Livelihood programs.",
    hiv_testing: "🔬 Review HIV testing uptake, linkage, and PrEP indicators.",
    hiv_treatment:
      "💊 Track ART initiation, VL suppression, and treatment outcomes.",
    reporting_rates: "📋 Check facility reporting completeness and rates.",
    profile: "🏥 View facility profiles and location hierarchy.",
  };
  var hint =
    hints[state.activePage] || "📈 Ask questions or navigate to a page above.";

  welcome.innerHTML =
    '<div class="text-xs text-sky-600 font-semibold uppercase tracking-wider mb-1">📍 ' +
    escapeHtml(pageTitle) +
    "</div>" +
    '<div class="text-slate-700">' +
    hint +
    ' <span class="text-slate-400">· Use the buttons above to navigate, or type a question below for AI-powered data insights.</span></div>';
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

  // ── Local keyword → page navigation (works without AI/Gemini) ──
  const navKeywords = [
    // HIV Treatment page
    {
      words: ["vl", "viral load", "viral suppression"],
      page: "hiv_treatment",
      subtab: "vl-monitoring",
      label: "VL Monitoring",
    },
    {
      words: ["art", "treatment", "newly started", "new on art"],
      page: "hiv_treatment",
      subtab: "newly-started-on-art",
      label: "Newly Started on ART",
    },
    {
      words: ["tx_curr", "current on art", "currently on art"],
      page: "hiv_treatment",
      subtab: "current-on-art",
      label: "Current on ART",
    },
    {
      words: ["iit", "interruption", "default"],
      page: "hiv_treatment",
      subtab: "iit-quarterly",
      label: "IIT Quarterly",
    },
    {
      words: ["dsd", "differentiated"],
      page: "hiv_treatment",
      subtab: "dsd",
      label: "DSD",
    },
    {
      words: ["adverse", "ae", "side effect"],
      page: "hiv_treatment",
      subtab: "adverse-events-ae",
      label: "Adverse Events",
    },
    { words: ["otz"], page: "hiv_treatment", subtab: "otz", label: "OTZ" },
    { words: ["ovc"], page: "hiv_treatment", subtab: "ovc", label: "OVC" },
    {
      words: ["cd4", "tpt"],
      page: "hiv_treatment",
      subtab: "cd4-tpt-uptake",
      label: "CD4/TPT Uptake",
    },
    {
      words: ["viral load cascade"],
      page: "hiv_treatment",
      subtab: "viral-load-cascade",
      label: "Viral Load Cascade",
    },
    {
      words: ["optimization"],
      page: "hiv_treatment",
      subtab: "art-optimization",
      label: "ART Optimization",
    },
    // HIV Testing page
    {
      words: ["testing", "hts", "hiv test"],
      page: "hiv_testing",
      subtab: "hiv-testing-services-uptake",
      label: "HIV Testing Uptake",
    },
    {
      words: ["linkage", "link"],
      page: "hiv_testing",
      subtab: "hiv-testing-services-linkage",
      label: "HIV Testing Linkage",
    },
    {
      words: ["pns", "partner notification"],
      page: "hiv_testing",
      subtab: "partner-notification-services",
      label: "Partner Notification",
    },
    {
      words: ["prep", "pre-exposure"],
      page: "prep_page",
      subtab: "",
      label: "PrEP",
    },
    {
      words: ["index testing"],
      page: "hiv_testing",
      subtab: "hts-index-testing",
      label: "HTS Index Testing",
    },
    {
      words: ["sns"],
      page: "hiv_testing",
      subtab: "sns-cascade",
      label: "SNS Cascade",
    },
    // Financial page
    {
      words: ["finance", "budget", "financial", "spend", "expenditure"],
      page: "financial_analysis",
      subtab: "overview",
      label: "Financial Analysis",
    },
    {
      words: ["indicator performance"],
      page: "financial_analysis",
      subtab: "indicator-performance",
      label: "Indicator Performance",
    },
    // Reporting page
    {
      words: ["reporting", "completeness"],
      page: "reporting_rates",
      subtab: "overview",
      label: "Reporting Rates",
    },
    // Jamii page — now enters Jamii Tekelezi project context
    {
      words: ["jamii", "tekelezi", "jamii tekelezi"],
      page: "overview",
      subtab: "",
      label: "Jamii Tekelezi Project",
      callback: function () {
        state.activeProject = "jamii_tekelezi";
        if (elements.projectFilter)
          elements.projectFilter.value = "jamii-tekelezi";
      },
    },
    {
      words: ["tx_curr analytics"],
      page: "overview",
      subtab: "",
      label: "TX_CURR Analytics",
      callback: function () {
        state.activeProject = "jamii_tekelezi";
        if (elements.projectFilter)
          elements.projectFilter.value = "jamii-tekelezi";
      },
    },
    // Other pages
    {
      words: ["home", "dashboard", "overview"],
      page: "overview",
      subtab: "",
      label: "Home",
    },
    { words: ["profile"], page: "profile", subtab: "", label: "Profile" },
    {
      words: ["pmtct", "mother to child"],
      page: "pmtct",
      subtab: "",
      label: "PMTCT",
    },
    { words: ["tb", "tuberculosis"], page: "tb", subtab: "", label: "TB" },
    {
      words: ["cacx", "cervical cancer", "cancer"],
      page: "cacx",
      subtab: "",
      label: "CACX",
    },
    {
      words: ["post rape", "rape"],
      page: "post_rape",
      subtab: "",
      label: "Post Rape",
    },
    {
      words: ["facilities", "facility"],
      page: "facilities",
      subtab: "",
      label: "Facilities",
    },
    {
      words: ["indicators"],
      page: "indicators",
      subtab: "",
      label: "Indicators",
    },
    { words: ["resources"], page: "resources", subtab: "", label: "Resources" },
    {
      words: ["service desk"],
      page: "service_desk",
      subtab: "",
      label: "Service Desk",
    },
    {
      words: ["case surveillance", "surveillance"],
      page: "case_surveillance",
      subtab: "",
      label: "Case Surveillance",
    },
  ];

  const normalized = question.toLowerCase().trim();
  let matchedNav = null;
  for (const entry of navKeywords) {
    if (
      entry.words.some(function (w) {
        return normalized === w || normalized.startsWith(w + " ");
      })
    ) {
      matchedNav = entry;
      break;
    }
  }

  if (matchedNav) {
    // Navigate locally — no AI call needed
    state.activePage = matchedNav.page;
    var meta = getPageMeta(matchedNav.page);
    if (matchedNav.subtab) {
      state.activeSubtabs[matchedNav.page] = matchedNav.subtab;
      setPageHash(matchedNav.page, matchedNav.subtab);
    } else if (meta.subtabs && meta.subtabs.length) {
      if (!state.activeSubtabs[matchedNav.page])
        state.activeSubtabs[matchedNav.page] = toSlug(meta.subtabs[0]);
      setPageHash(matchedNav.page, state.activeSubtabs[matchedNav.page]);
    } else {
      setPageHash(matchedNav.page);
    }
    // Execute callback before rendering (e.g., for setting project context)
    if (typeof matchedNav.callback === "function") {
      matchedNav.callback();
    }

    scrollToPageTop();
    renderCurrentView();

    // Show a navigation message in chat
    var navMsg =
      "📌 Navigated to <strong>" +
      escapeHtml(meta.title || matchedNav.page) +
      "</strong>" +
      (matchedNav.label && matchedNav.label !== meta.title
        ? " → <strong>" + escapeHtml(matchedNav.label) + "</strong>"
        : "") +
      ". You can now explore the data there, or ask me a detailed question about what you see!";

    // Remove typing indicator and show nav message
    var tempId = appendTypingIndicator();
    setTimeout(function () {
      removeTypingIndicator(tempId);
      appendMessage("assistant", navMsg, true);
    }, 300);
    return;
  }

  // ── Not a navigation keyword — proceed with AI data insights ──
  const typingId = appendTypingIndicator();

  // Gather current page/chart context for better AI insights
  var chatContext = {
    question: question,
    active_page: state.activePage || "",
    active_tab: state.activeSubtabs
      ? state.activeSubtabs[state.activePage] || ""
      : "",
  };

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chatContext),
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

// ── Homepage Dashboard ──────────────────────────────────────────────
// Kenya bounding box (rough) — use arrays, Leaflet constructed inside init
const _KENYA_BOUNDS_SW = [-4.8, 33.5];
const _KENYA_BOUNDS_NE = [5.0, 42.0];
function _kenyaBounds() {
  return L.latLngBounds(L.latLng(_KENYA_BOUNDS_SW), L.latLng(_KENYA_BOUNDS_NE));
}

let _homepageCountyMode = false;

// ── Animated counter ──
function animateCounter(el, target, suffix) {
  if (!el) return;
  const duration = 1200;
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    // Ease-out cubic
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent =
      Math.round(ease * target).toLocaleString() + (suffix || "");
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── IntersectionObserver for scroll animations ──
let _hpObserver = null;
function observeHpFadeIns() {
  if (_hpObserver) _hpObserver.disconnect();
  _hpObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          _hpObserver.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
  );
  document
    .querySelectorAll(".hp-fade-in")
    .forEach((el) => _hpObserver.observe(el));
  // Fallback: reveal all after 3s in case IntersectionObserver doesn't fire
  setTimeout(() => {
    document.querySelectorAll(".hp-fade-in:not(.visible)").forEach((el) => {
      el.classList.add("visible");
    });
  }, 3000);
}

// ── Animated rolling stat chips on project cards ──
function animateCardChips() {
  document
    .querySelectorAll(".hp-chip-num, .hp-card-num-value")
    .forEach((el) => {
      const target = parseInt(el.dataset.target, 10);
      if (isNaN(target) || target <= 0) {
        el.textContent = target.toLocaleString();
        return;
      }
      const duration = 800;
      const steps = 20;
      let step = 0;
      el.textContent = "0";
      const interval = setInterval(() => {
        step++;
        const p = Math.min(step / steps, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(ease * target).toLocaleString();
        if (p >= 1) {
          clearInterval(interval);
          el.classList.add("shimmer");
          el.textContent = target.toLocaleString();
        }
      }, duration / steps);
    });
}

// ── Project accent colors ──
const _PROJ_COLORS = {
  jamii_tekelezi: {
    border: "#a78bfa",
    bg: "#f5f3ff",
    accent: "#7c3aed",
    gradient: "from-violet-500 to-purple-600",
  },
  default: {
    border: "#0ea5e9",
    bg: "#f0f9ff",
    accent: "#0284c7",
    gradient: "from-sky-500 to-blue-600",
  },
};

function _projColor(pid) {
  return _PROJ_COLORS[pid] || _PROJ_COLORS.default;
}

async function renderHomepageDashboard() {
  const root = document.getElementById("homepageRoot");
  if (!root) return;

  // Fetch project & facility data
  let facilityData = {};
  let projectData = {};
  try {
    const [facResp, projResp] = await Promise.all([
      fetch("/api/khis/facility-locations"),
      fetch("/api/projects/facility-mapping"),
    ]);
    const facJson = await facResp.json();
    const projJson = await projResp.json();
    if (facJson.ok) facilityData = facJson.facilities || {};
    if (projJson.ok) projectData = projJson.projects || {};
  } catch (e) {
    root.innerHTML = `<div class="text-red-500 text-sm py-8 text-center">Failed to load project data: ${escapeHtml(e.message)}</div>`;
    return;
  }

  const projectIds = Object.keys(projectData);
  // Jamii Tekelezi first
  const jamiiIdx = projectIds.indexOf("jamii_tekelezi");
  if (jamiiIdx > 0) {
    projectIds.splice(jamiiIdx, 1);
    projectIds.unshift("jamii_tekelezi");
  }
  if (!projectIds.length) {
    root.innerHTML = `<div class="text-slate-500 text-sm py-8 text-center">No projects found.</div>`;
    return;
  }

  // Build set of MHU facility IDs
  const mhuFacilityIds = new Set();
  try {
    const mhuResp = await fetch("/api/mhu/config");
    const mhuConfig = await mhuResp.json();
    if (mhuConfig.facilities) {
      Object.keys(mhuConfig.facilities).forEach((id) => mhuFacilityIds.add(id));
    }
  } catch (_) {}

  // ── Compute overall stats ──
  const allCounties = new Set();
  let totalFacilities = 0;
  projectIds.forEach((pid) => {
    const proj = projectData[pid] || {};
    (proj.counties || []).forEach((c) => allCounties.add(c));
    totalFacilities += proj.facility_count || 0;
  });
  const totalMhus = projectIds.reduce((s, pid) => {
    const m = projectData[pid]?.mhu_count || 0;
    return s + m;
  }, 0);

  // ── Build HTML ──
  let html = '<div class="space-y-6">';

  // ═══════════════════════════════════════════
  // HERO SECTION
  // ═══════════════════════════════════════════
  html += `
    <div class="hp-hero rounded-3xl p-8 md:p-12 relative">
      <div class="hp-hero-pattern"></div>
      <div class="relative z-10">
        <div class="flex items-center gap-3 mb-2 hp-fade-in">
          <span class="text-4xl">🏥</span>
          <div>
            <h1 class="text-white text-2xl md:text-3xl font-bold tracking-tight">CHAK VISTA Dashboard</h1>
            <p class="text-blue-200 text-sm md:text-base font-medium mt-0.5">Real-time health analytics across Kenya</p>
          </div>
        </div>

        <!-- Hero animated stats -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 hp-fade-in hp-stagger-1">
          <div class="text-center">
            <div class="hp-hero-count" id="hero-count-mhus">0</div>
            <div class="hp-hero-label">🏥 MHUs</div>
          </div>
          <div class="text-center">
            <div class="hp-hero-count" id="hero-count-counties">0</div>
            <div class="hp-hero-label">🗺️ Counties</div>
          </div>
          <div class="text-center">
            <div class="hp-hero-count" id="hero-count-facilities">0</div>
            <div class="hp-hero-label">🏛️ Facilities</div>
          </div>
          <div class="text-center">
            <div class="hp-hero-count" id="hero-count-projects">0</div>
            <div class="hp-hero-label">📋 Projects</div>
          </div>
        </div>

        <!-- Quick insight chips -->
        <div class="flex flex-wrap gap-2 mt-6 hp-fade-in hp-stagger-2">
          <span class="inline-flex items-center gap-1.5 text-xs bg-white/15 text-white/90 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">📊 Last 12 months</span>
          <span class="inline-flex items-center gap-1.5 text-xs bg-white/15 text-white/90 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">📍 Kenya-wide coverage</span>
          <span class="inline-flex items-center gap-1.5 text-xs bg-white/15 text-white/90 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">🔬 KHIS Integration</span>
          <span class="inline-flex items-center gap-1.5 text-xs bg-white/15 text-white/90 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">📱 MOH 717 · MOH 740</span>
        </div>
      </div>
    </div>
  `;

  // ═══════════════════════════════════════════
  // QUICK STATS ROW
  // ═══════════════════════════════════════════
  const qColors = [
    "from-sky-500 to-blue-600",
    "from-emerald-500 to-teal-600",
    "from-violet-500 to-purple-600",
    "from-amber-500 to-orange-600",
  ];
  const qIcons = ["🏥", "🗺️", "🏛️", "📋"];
  const qLabels = ["Total MHUs", "Counties", "Facilities", "Projects"];
  const qVals = [
    totalMhus,
    allCounties.size,
    totalFacilities,
    projectIds.length,
  ];

  html +=
    '<div class="grid grid-cols-2 md:grid-cols-4 gap-3 hp-fade-in hp-stagger-3">';
  qLabels.forEach((label, i) => {
    const c = qColors[i % qColors.length];
    html += `
      <div class="hp-stat-box bg-white border border-slate-200 shadow-sm hover:shadow-md" style="cursor:default;">
        <div class="text-2xl font-extrabold text-slate-800">${qVals[i].toLocaleString()}</div>
        <div class="text-xs text-slate-500 font-medium mt-0.5">${qIcons[i]} ${label}</div>
      </div>`;
  });
  html += "</div>";

  // ═══════════════════════════════════════════
  // TAB BAR: Projects | Counties
  // ═══════════════════════════════════════════
  html += `
    <div class="flex gap-0 border-b border-slate-200 hp-fade-in hp-stagger-4">
      <button id="hp-tab-projects" class="hp-tab-btn-v2 ${!_homepageCountyMode ? "active" : ""}" data-mode="projects">📋 Projects</button>
      <button id="hp-tab-counties" class="hp-tab-btn-v2 ${_homepageCountyMode ? "active" : ""}" data-mode="counties">🗺️ Counties</button>
    </div>
    <div id="hp-content" class="space-y-5">
  `;

  // ═══════════════════════════════════════════
  // PROJECTS VIEW — Collapsible Cards
  // ═══════════════════════════════════════════
  html += `<div id="hp-projects-view" class="${_homepageCountyMode ? "hidden" : ""}"><div class="space-y-4">`;

  let _projIdx = 0;
  for (const pid of projectIds) {
    _projIdx++;
    const proj = projectData[pid] || {};
    const facs = proj.facilities || {};
    const facCount = proj.facility_count || 0;
    const mhuCount = proj.mhu_count || 0;
    const projCounties = proj.counties || [];
    const projName = proj.name || pid;
    const projIcon = proj.icon || "📋";
    const projDesc = proj.description || "";
    const mapId = `map-${pid}`;
    const filterId = `filter-${pid}`;
    const col = _projColor(pid);
    const stagger = Math.min(_projIdx, 5);

    // Per-project hero gradient colors
    const cardGrad =
      pid === "jamii_tekelezi"
        ? "linear-gradient(135deg, #4c1d95 0%, #6d28d9 40%, #a78bfa 100%)"
        : "linear-gradient(135deg, #0a2540 0%, #1a4a7a 40%, #0ea5e9 100%)";
    const cardIconBg =
      pid === "jamii_tekelezi"
        ? "rgba(167,139,250,0.25)"
        : "rgba(14,165,233,0.25)";

    html += `
      <div class="hp-project-card hp-fade-in hp-stagger-${stagger}">
        <!-- Hero-like gradient background -->
        <div class="hp-card-hero-bg" style="background:${cardGrad};">
          <div class="hp-card-pattern"></div>

          <!-- Always-visible hero header -->
          <div class="hp-card-hero" data-target="body-${pid}">
            <!-- Top row: icon + name + expand -->
            <div class="hp-card-top-row">
              <div class="hp-card-icon-wrap" style="background:${cardIconBg};">
                ${projIcon}
              </div>
              <div class="hp-card-name">
                <div class="hp-card-name-main">${escapeHtml(projName)}</div>
                <div class="hp-card-name-sub">${escapeHtml(projDesc)}</div>
              </div>
              <div class="hp-card-expand-btn">▼</div>
            </div>

            <!-- Big hero-style numbers -->
            <div class="hp-card-numbers">
              <div class="hp-card-num-item">
                <div class="hp-card-num-value" data-target="${mhuCount}">0</div>
                <div class="hp-card-num-label">🏥 MHUs</div>
              </div>
              <div class="hp-card-num-item">
                <div class="hp-card-num-value" data-target="${projCounties.length}">0</div>
                <div class="hp-card-num-label">🗺️ Counties</div>
              </div>
              <div class="hp-card-num-item">
                <div class="hp-card-num-value" data-target="${facCount}">0</div>
                <div class="hp-card-num-label">🏛️ Facilities</div>
              </div>
            </div>

            <!-- Glass chips -->
            <div class="hp-card-chips">
              <span class="hp-glass-chip">📊 Last 12 months</span>
              <span class="hp-glass-chip">📍 Kenya-wide</span>
              <span class="hp-glass-chip">🎯 Goal: 85%</span>
            </div>
          </div>

        <!-- Collapsible body: map + filters -->
        <div id="body-${pid}" class="hp-card-body">
          <div class="hp-card-body-inner">
            <div class="flex flex-col lg:flex-row gap-4">
              <!-- Filters sidebar -->
              <div class="w-full lg:w-64 shrink-0 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 p-3 text-xs space-y-2">
                <div class="font-medium text-white/70 text-[10px] uppercase tracking-wide">VL Indicator <span class="text-white/30 font-normal">(select to show county map)</span></div>
                <label class="flex items-center gap-2 text-white cursor-pointer bg-white/10 rounded-lg border border-white/10 px-2 py-1.5 hover:bg-white/20 transition"><input type="radio" name="vl-metric-${pid}" class="vl-metric-radio accent-sky-400" value="tested"> <span class="font-medium">Tested</span></label>
                <label class="flex items-center gap-2 text-white cursor-pointer bg-white/10 rounded-lg border border-white/10 px-2 py-1.5 hover:bg-white/20 transition"><input type="radio" name="vl-metric-${pid}" class="vl-metric-radio accent-rose-400" value="positive"> <span class="font-medium">Positive</span></label>
                <label class="flex items-center gap-2 text-white cursor-pointer bg-white/10 rounded-lg border border-white/10 px-2 py-1.5 hover:bg-white/20 transition"><input type="radio" name="vl-metric-${pid}" class="vl-metric-radio accent-emerald-400" value="suppression"> <span class="font-medium">VL Suppression</span></label>
                <div class="border-t border-white/10 pt-2 space-y-1.5">
                  <div class="font-medium text-white/70 text-[10px] uppercase tracking-wide">Date Range</div>
                  <input type="text" class="w-full rounded-lg bg-white/10 border border-white/10 px-2 py-1.5 text-xs text-white/70" placeholder="Select date range" readonly>
                </div>
                <select class="w-full rounded-lg bg-white/10 border border-white/10 px-2 py-1.5 text-xs text-white/70"><option class="bg-slate-800">Select County (0)</option></select>
                <select class="w-full rounded-lg bg-white/10 border border-white/10 px-2 py-1.5 text-xs text-white/70"><option class="bg-slate-800">Select Sub County (0)</option></select>
                <select class="w-full rounded-lg bg-white/10 border border-white/10 px-2 py-1.5 text-xs text-white/70"><option class="bg-slate-800">Select Facility (0)</option></select>
                <select class="w-full rounded-lg bg-white/10 border border-white/10 px-2 py-1.5 text-xs text-white/70"><option class="bg-slate-800">Select Sex (2)</option></select>
                <select class="w-full rounded-lg bg-white/10 border border-white/10 px-2 py-1.5 text-xs text-white/70"><option class="bg-slate-800">Select Age Category (15)</option></select>
                <select class="w-full rounded-lg bg-white/10 border border-white/10 px-2 py-1.5 text-xs text-white/70"><option class="bg-slate-800">Select Agency (7)</option></select>
                <select class="w-full rounded-lg bg-white/10 border border-white/10 px-2 py-1.5 text-xs text-white/70"><option class="bg-slate-800">Select Partner (37)</option></select>
                <div class="flex gap-2 pt-1">
                  <button class="flex-1 rounded-lg bg-white/20 text-white py-1.5 text-xs font-medium hover:bg-white/30 transition">Filter</button>
                  <button class="flex-1 rounded-lg bg-white/10 border border-white/10 text-white/70 py-1.5 text-xs font-medium hover:bg-white/20 transition">Reset</button>
                </div>
                <div class="flex gap-2 pt-1">
                  <button class="flex-1 rounded-lg bg-white/10 border border-white/10 text-white/70 py-1.5 text-xs font-medium hover:bg-white/20 transition">⬇ Download</button>
                  <button class="flex-1 rounded-lg bg-white/10 border border-white/10 text-white/70 py-1.5 text-xs font-medium hover:bg-white/20 transition">📊 View Data</button>
                </div>
              </div>
              <!-- Map area -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-2">
                  <button id="${filterId}-mhu" class="map-filter-btn text-xs px-3 py-1.5 rounded-full border font-medium transition bg-white/20 text-white border-white/20 hover:bg-white/30" data-project="${pid}" data-mode="mhu" data-map="${mapId}">🏥 MHU</button>
                  <button id="${filterId}-county" class="map-filter-btn text-xs px-3 py-1.5 rounded-full border font-medium transition bg-white/10 text-white/70 border-white/10 hover:bg-white/20" data-project="${pid}" data-mode="county" data-map="${mapId}">🗺️ County</button>
                  <span class="text-[10px] text-white/50 ml-auto"><span class="font-medium" id="${filterId}-count">${facCount}</span> shown</span>
                </div>
                <div id="${mapId}" class="project-map" style="height:380px;width:100%;border-radius:12px;overflow:hidden;position:relative;">
                  <div id="${mapId}-legend" class="map-legend" style="display:none;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // ── Key Indicators Drill down — below JTP card ──
    if (_projIdx === 1) {
      html += `
      <div id="key-indicators-root" class="rounded-2xl border border-purple-200 bg-white p-5 shadow-sm hp-fade-in hp-stagger-${stagger}">
        <div class="flex items-center gap-2 mb-4">
          <span class="text-lg">📊</span>
          <span class="font-semibold text-sm text-slate-800">Key Indicators Drill Down</span>
          <span class="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Facility-level summary</span>
        </div>
        <div id="ki-loading" class="text-xs text-slate-400 py-6 text-center">Loading key indicators…</div>
        <div id="ki-cards" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 hidden"></div>
        <div id="ki-error" class="text-xs text-red-500 hidden"></div>
      </div>`;
    }
  }

  html += `</div></div>`;

  // ═══════════════════════════════════════════
  // COUNTIES VIEW — Enhanced Grid
  // ═══════════════════════════════════════════
  html += `<div id="hp-counties-view" class="${_homepageCountyMode ? "" : "hidden"}"><div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;

  // Build a map of county -> project list
  const countyToProjects = {};
  for (const pid of projectIds) {
    const proj = projectData[pid] || {};
    for (const c of proj.counties || []) {
      if (!countyToProjects[c]) countyToProjects[c] = [];
      countyToProjects[c].push({
        id: pid,
        name: proj.name || pid,
        icon: proj.icon || "📋",
      });
    }
  }

  const sortedCounties = Array.from(allCounties).sort();
  sortedCounties.forEach((county, ci) => {
    const projs = countyToProjects[county] || [];
    const countyMhus = projs.reduce(
      (s, p) => s + (projectData[p.id]?.mhu_count || 0),
      0,
    );
    html += `
      <div class="hp-county-card hp-fade-in hp-stagger-${(ci % 5) + 1}">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-50 to-blue-100 border border-sky-200 flex items-center justify-center text-lg shrink-0">🗺️</div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm text-slate-800">${escapeHtml(county)}</div>
            <div class="text-[11px] text-slate-400">
              ${projs.length} project${projs.length !== 1 ? "s" : ""} · ${countyMhus.toLocaleString()} MHUs
            </div>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5 mt-3">
          ${projs
            .map(
              (p) =>
                `<span class="inline-flex items-center gap-1 text-[11px] bg-slate-50 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200 hover:border-sky-300 hover:bg-sky-50 transition">${p.icon} ${escapeHtml(p.name)}</span>`,
            )
            .join("")}
        </div>
      </div>
    `;
  });

  html += `</div></div>`;
  html += `</div></div>`; // close hp-content, homepageRoot
  root.innerHTML = html;

  // ── Animate hero counters ──
  animateCounter(document.getElementById("hero-count-mhus"), totalMhus, "");
  animateCounter(
    document.getElementById("hero-count-counties"),
    allCounties.size,
    "",
  );
  animateCounter(
    document.getElementById("hero-count-facilities"),
    totalFacilities,
    "",
  );
  animateCounter(
    document.getElementById("hero-count-projects"),
    projectIds.length,
    "",
  );

  // ── Initialize maps ──
  initProjectMaps(projectData, mhuFacilityIds);

  // ── Collapsible card toggle ──
  document.querySelectorAll(".hp-card-hero").forEach((header) => {
    header.addEventListener("click", function () {
      const targetId = this.dataset.target;
      const body = document.getElementById(targetId);
      const icon = this.querySelector(".hp-card-expand-btn");
      if (!body) return;
      const isOpen = body.classList.contains("open");
      if (isOpen) {
        body.classList.remove("open");
        body.style.maxHeight = "0";
        icon.classList.remove("open");
      } else {
        body.classList.add("open");
        body.style.maxHeight = body.scrollHeight + "px";
        icon.classList.add("open");
        // Trigger map resize after expand
        const mapId = targetId.replace("body-", "map-");
        const entry = _projectMaps[mapId];
        if (entry && entry.map) {
          setTimeout(() => entry.map.invalidateSize(), 400);
        }
      }
    });
  });

  // ── Map filter toggle (MHU / County) ──
  document.querySelectorAll(".map-filter-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const projectId = this.dataset.project;
      const mode = this.dataset.mode;
      const mapId = this.dataset.map;
      const entry = _projectMaps[mapId];

      if (mode === "county" && entry) {
        const metricSelected = document.querySelector(
          `input[name="vl-metric-${projectId}"]:checked`,
        );
        if (!metricSelected) {
          entry.currentMode = "county";
          entry.currentMetric = "none";
          document
            .querySelectorAll(`[data-project="${projectId}"].map-filter-btn`)
            .forEach((b) => {
              b.className =
                "map-filter-btn text-xs px-3 py-1 rounded-full border font-medium transition bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200";
            });
          this.className =
            "map-filter-btn text-xs px-3 py-1 rounded-full border font-medium transition bg-sky-500 text-white border-sky-500";
          updateProjectMapMarkerLayer(mapId, "county");
          return;
        }
      }

      document
        .querySelectorAll(`[data-project="${projectId}"].map-filter-btn`)
        .forEach((b) => {
          b.className =
            "map-filter-btn text-xs px-3 py-1 rounded-full border font-medium transition bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200";
        });
      this.className =
        "map-filter-btn text-xs px-3 py-1 rounded-full border font-medium transition bg-sky-500 text-white border-sky-500";
      updateProjectMap(mapId, projectId, mode, projectData, mhuFacilityIds);
    });
  });

  // ── Tab toggle (Projects / Counties) ──
  document.querySelectorAll(".hp-tab-btn-v2").forEach((btn) => {
    btn.addEventListener("click", function () {
      const mode = this.dataset.mode;
      _homepageCountyMode = mode === "counties";

      document.querySelectorAll(".hp-tab-btn-v2").forEach((b) => {
        b.classList.remove("active");
      });
      this.classList.add("active");

      const pv = document.getElementById("hp-projects-view");
      const cv = document.getElementById("hp-counties-view");
      if (pv) pv.classList.toggle("hidden", _homepageCountyMode);
      if (cv) cv.classList.toggle("hidden", !_homepageCountyMode);

      // Trigger map resize for expanded cards
      if (!_homepageCountyMode) {
        setTimeout(() => {
          Object.values(_projectMaps).forEach((entry) => {
            if (entry.map) entry.map.invalidateSize();
          });
        }, 300);
      }
    });
  });

  // ── VL metric radio buttons ──
  document.querySelectorAll(".vl-metric-radio").forEach((radio) => {
    radio.addEventListener("change", function () {
      if (!this.checked) return;
      const metric = this.value;
      const name = this.getAttribute("name");
      const pid = name.replace("vl-metric-", "");
      const mapId = `map-${pid}`;
      const entry = _projectMaps[mapId];
      if (!entry) return;
      entry.currentMetric = metric;
      entry.currentMode = "county";

      const filterId = `filter-${pid}`;
      document
        .querySelectorAll(`[data-project="${pid}"].map-filter-btn`)
        .forEach((b) => {
          b.className =
            "map-filter-btn text-xs px-3 py-1.5 rounded-full border font-medium transition bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200";
        });
      const countyBtn = document.getElementById(`${filterId}-county`);
      if (countyBtn) {
        countyBtn.className =
          "map-filter-btn text-xs px-3 py-1.5 rounded-full border font-medium transition bg-sky-500 text-white border-sky-500";
      }
      updateProjectMapMarkerLayer(mapId, "county");
    });
  });

  // ── Scroll-triggered fade-in animations ──
  observeHpFadeIns();

  // ── Animate stat chips (rolling numbers) ──
  setTimeout(animateCardChips, 300);

  // ── Load key indicators ──
  loadKeyIndicators();
}

// ── Key Indicators Drill Down ──
async function loadKeyIndicators() {
  const loadingEl = document.getElementById("ki-loading");
  const cardsEl = document.getElementById("ki-cards");
  const errorEl = document.getElementById("ki-error");
  if (!loadingEl || !cardsEl || !errorEl) return; // element not on page
  try {
    const resp = await fetch("/api/key-indicators");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    loadingEl.classList.add("hidden");
    cardsEl.classList.remove("hidden");
    const s = data.summary;
    const cardConfig = [
      {
        label: "HTS Positive",
        value: s["HTS Positive"]?.total ?? "—",
        sub: `Avg: ${s["HTS Positive"]?.avg ?? "—"}`,
        color: "rose",
      },
      {
        label: "Linkage",
        value: s["Linkage"]?.avg != null ? s["Linkage"].avg + "%" : "—",
        sub: `Max: ${s["Linkage"]?.max ?? "—"}%`,
        color: "emerald",
      },
      {
        label: "% VL Uptake",
        value: s["% VL Uptake"]?.avg != null ? s["% VL Uptake"].avg + "%" : "—",
        sub: `Max: ${s["% VL Uptake"]?.max ?? "—"}%`,
        color: "blue",
      },
      {
        label: "% VL Suppression",
        value:
          s["% VL Suppression"]?.avg != null
            ? s["% VL Suppression"].avg + "%"
            : "—",
        sub: `Max: ${s["% VL Suppression"]?.max ?? "—"}%`,
        color: "indigo",
      },
      {
        label: "% IIT",
        value: s["%IIT"]?.avg != null ? s["%IIT"].avg + "%" : "—",
        sub: `Max: ${s["%IIT"]?.max ?? "—"}%`,
        color: "amber",
      },
      {
        label: "TX_NEW",
        value: s["TX_NEW"]?.total ?? "—",
        sub: `Avg: ${s["TX_NEW"]?.avg ?? "—"}`,
        color: "teal",
      },
      {
        label: "TX_NEW CD4",
        value: s["TX_NEW CD4"]?.total ?? "—",
        sub: `Avg: ${s["TX_NEW CD4"]?.avg ?? "—"}`,
        color: "cyan",
      },
      {
        label: "CD4 Uptake",
        value: s["CD4 Uptake"]?.avg != null ? s["CD4 Uptake"].avg + "%" : "—",
        sub: `Max: ${s["CD4 Uptake"]?.max ?? "—"}%`,
        color: "violet",
      },
      {
        label: "TPT",
        value: s["TPT"]?.total ?? "—",
        sub: `Avg: ${s["TPT"]?.avg ?? "—"}`,
        color: "orange",
      },
      {
        label: "TPT Uptake",
        value: s["TPT Uptake"]?.avg != null ? s["TPT Uptake"].avg + "%" : "—",
        sub: `Max: ${s["TPT Uptake"]?.max ?? "—"}%`,
        color: "lime",
      },
    ];
    const colorMap = {
      rose: "from-rose-50 to-rose-100 border-rose-200 text-rose-700",
      emerald:
        "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700",
      blue: "from-blue-50 to-blue-100 border-blue-200 text-blue-700",
      indigo: "from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-700",
      amber: "from-amber-50 to-amber-100 border-amber-200 text-amber-700",
      teal: "from-teal-50 to-teal-100 border-teal-200 text-teal-700",
      cyan: "from-cyan-50 to-cyan-100 border-cyan-200 text-cyan-700",
      violet: "from-violet-50 to-violet-100 border-violet-200 text-violet-700",
      orange: "from-orange-50 to-orange-100 border-orange-200 text-orange-700",
      lime: "from-lime-50 to-lime-100 border-lime-200 text-lime-700",
    };
    cardsEl.innerHTML = cardConfig
      .map(
        (c) => `
      <div class="rounded-xl bg-gradient-to-br ${colorMap[c.color] || colorMap.blue} border p-3 text-center shadow-sm">
        <div class="text-[9px] uppercase tracking-wide font-semibold text-slate-500 mb-1">${c.label}</div>
        <div class="text-xl font-bold">${c.value}</div>
        <div class="text-[9px] text-slate-400 mt-0.5">${c.sub}</div>
      </div>
    `,
      )
      .join("");
  } catch (e) {
    loadingEl.classList.add("hidden");
    errorEl.classList.remove("hidden");
    errorEl.textContent = "Failed to load key indicators: " + e.message;
  }
}

// ── Project Map Initialization ──
const _projectMaps = {};
let _kenyaCountyGeoJSON = null; // cached Kenya county boundaries

async function initProjectMaps(projectData, mhuFacilityIds) {
  // Fetch Kenya county boundaries once (for choropleth)
  if (!_kenyaCountyGeoJSON) {
    try {
      const geoResp = await fetch("/api/kenya-counties?_t=" + Date.now());
      if (geoResp.ok) {
        _kenyaCountyGeoJSON = await geoResp.json();
      }
    } catch (_) {}
  }

  for (const pid of Object.keys(projectData)) {
    const mapId = `map-${pid}`;
    const container = document.getElementById(mapId);
    if (!container) continue;

    const proj = projectData[pid] || {};
    const facs = proj.facilities || {};
    const facEntries = Object.entries(facs).filter(([, f]) => f.lat && f.lng);
    const projCounties = proj.counties || [];

    if (!facEntries.length) {
      container.innerHTML = `<div class="flex items-center justify-center h-full text-slate-400 text-xs">No location data</div>`;
      continue;
    }

    const kb = _kenyaBounds();
    const map = L.map(mapId, {
      center: [0.5, 38.0],
      zoom: 6,
      zoomControl: false,
      attributionControl: false,
      maxBounds: kb,
      maxBoundsViscosity: 1.0,
      minZoom: 5,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      minZoom: 5,
      attribution: "© OpenStreetMap",
      bounds: kb,
    }).addTo(map);

    // Fit to Kenya bounds
    map.fitBounds(kb, { padding: [10, 10], maxZoom: 7 });

    // Fix cut map: invalidate size after container is fully rendered
    requestAnimationFrame(() => {
      map.invalidateSize();
    });

    // Build county groups from facility entries
    const countyGroups = {};
    for (const [fid, f] of facEntries) {
      const key = f.county || "unknown";
      if (!countyGroups[key]) countyGroups[key] = [];
      countyGroups[key].push([fid, f]);
    }

    // Store map with facility entries
    _projectMaps[mapId] = {
      map,
      layer: L.layerGroup().addTo(map),
      legendLayer: L.layerGroup().addTo(map),
      facEntries,
      facs,
      mhuIds: mhuFacilityIds,
      currentMode: "mhu",
      currentMetric: "tested",
      countyGroups,
      projCounties,
      projName: proj.name || pid,
      kenyaGeoJSON: _kenyaCountyGeoJSON,
    };

    // Add initial markers (MHU mode)
    updateProjectMapMarkerLayer(mapId, "mhu");
  }
}

function updateProjectMap(mapId, projectId, mode, projectData, mhuFacilityIds) {
  const entry = _projectMaps[mapId];
  if (!entry) return;

  entry.mhuIds = mhuFacilityIds;
  entry.currentMode = mode;

  // Update facEntries from latest project data
  const proj = projectData[projectId] || {};
  entry.facs = proj.facilities || {};
  entry.facEntries = Object.entries(entry.facs).filter(
    ([, f]) => f.lat && f.lng,
  );
  entry.projCounties = proj.counties || [];
  entry.projName = proj.name || projectId;

  // Rebuild county groups
  const countyGroups = {};
  for (const [fid, f] of entry.facEntries) {
    const key = f.county || "unknown";
    if (!countyGroups[key]) countyGroups[key] = [];
    countyGroups[key].push([fid, f]);
  }
  entry.countyGroups = countyGroups;

  // Update count
  const filtered = entry.facEntries.filter(([fid, f]) => true);
  const countEl = document.getElementById(`filter-${projectId}-count`);
  if (countEl) countEl.textContent = filtered.length;

  updateProjectMapMarkerLayer(mapId, mode);
}

function updateProjectMapMarkerLayer(mapId, mode) {
  const entry = _projectMaps[mapId];
  if (!entry) return;

  entry.layer.clearLayers();
  entry.legendLayer.clearLayers();
  const legendEl = document.getElementById(`${mapId}-legend`);
  if (legendEl) legendEl.style.display = "none";

  let filtered = entry.facEntries;
  if (!filtered.length) {
    L.marker([entry.map.getCenter().lat, entry.map.getCenter().lng], {
      icon: L.divIcon({
        className: "",
        html: `<div style="background:#94a3b8;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;">📍</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
    })
      .addTo(entry.layer)
      .bindPopup(
        `<div class="text-xs font-medium">No ${mode} data for this area</div>`,
      );
    return;
  }

  // ── COUNTY MODE: Choropleth by county (polygon fill) ──
  if (mode === "county") {
    const metric = entry.currentMetric || "none";
    const projCounties = entry.projCounties || [];

    if (!entry.kenyaGeoJSON || !projCounties.length) {
      L.marker([entry.map.getCenter().lat, entry.map.getCenter().lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:#94a3b8;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;">🗺️</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      })
        .addTo(entry.layer)
        .bindPopup(
          `<div class="text-xs font-medium">No county boundary data</div>`,
        );
      return;
    }

    // Normalize project county names to match GeoJSON NAME field
    const COUNTY_NAME_MAP = {
      homabay: "Homa Bay",
    };
    const normToOriginal = {}; // normalized -> original (for countyGroups lookup)
    const geojsonToOriginal = {}; // GeoJSON NAME -> original project name
    const projCountyNames = new Set(
      projCounties.map((c) => {
        const stripped = c.replace(/ County$/i, "").trim();
        const lower = stripped.toLowerCase();
        const normalized = COUNTY_NAME_MAP[lower] || stripped;
        normToOriginal[normalized] = c;
        geojsonToOriginal[normalized] = c;
        return normalized;
      }),
    );

    const countyGroups = entry.countyGroups || {};

    // ── Percentage-based color thresholds ──
    // Returns color for a 0-100 percentage value
    function pctColor(pct) {
      if (pct < 20) return "#dc2626"; // red
      if (pct < 40) return "#f97316"; // orange
      if (pct < 60) return "#eab308"; // yellow
      if (pct < 80) return "#84cc16"; // lime
      return "#16a34a"; // green
    }

    const metricLabels = {
      tested: "% Tested",
      positive: "% Positive",
      suppression: "% VL Suppression",
    };
    const DEFAULT_PCT = 45; // neutral fallback

    // Compute percentage values per county
    const metricValues = {};
    let hasMetric = metric !== "none";
    for (const name of projCountyNames) {
      const origName = normToOriginal[name] || name;
      const group = countyGroups[origName];
      const count = group ? group.length : 0;
      // Generate a deterministic pseudo-percentage for demo
      const base = Math.max(1, count) * 4;
      const hash = (name.length * 13 + (name.charCodeAt(0) || 0) * 7) % 31;
      let pct;
      if (metric === "tested") {
        pct = Math.min(95, Math.max(5, base + hash));
      } else if (metric === "positive") {
        pct = Math.min(40, Math.max(1, Math.round(base * 0.3 + hash * 0.5)));
      } else if (metric === "suppression") {
        pct = Math.min(98, Math.max(30, base + hash + 25));
      } else {
        pct = DEFAULT_PCT;
      }
      metricValues[name] = pct;
    }

    // Render county polygons
    const legendMetric = hasMetric ? metric : "none";
    const legendLabel = hasMetric
      ? metricLabels[metric] || metric
      : "Select a VL Indicator";

    // Build legend for percentage thresholds
    _renderPctLegend(mapId, legendLabel);

    const geoLayer = L.geoJSON(entry.kenyaGeoJSON, {
      filter: function (feature) {
        const name = feature.properties.NAME;
        return projCountyNames.has(name);
      },
      style: function (feature) {
        const name = feature.properties.NAME;
        const pct = metricValues[name] || 0;
        const fill = hasMetric ? pctColor(pct) : "#cbd5e1"; // neutral gray when no metric
        return {
          fillColor: fill,
          weight: 2,
          opacity: 1,
          color: "#334155",
          fillOpacity: hasMetric ? 0.85 : 0.5,
          smoothFactor: 0,
        };
      },
      onEachFeature: function (feature, layer) {
        const name = feature.properties.NAME;
        const pct = metricValues[name] || 0;
        const origName = geojsonToOriginal[name] || name;
        const matchedFacs = countyGroups[origName] || [];
        const pctStr = hasMetric ? `${pct}%` : "—";
        const metricName = hasMetric
          ? metricLabels[metric] || metric
          : "No metric";
        layer.bindPopup(`
          <div class="text-xs" style="min-width:140px;">
            <div class="font-semibold text-slate-800 text-sm">${escapeHtml(name)}</div>
            <div class="mt-1 space-y-0.5">
              <div><span class="font-medium">${metricName}:</span> ${pctStr}</div>
            </div>
            <div class="text-slate-400 mt-1">${matchedFacs.length} facilities matched</div>
            ${!hasMetric ? '<div class="text-amber-600 mt-1 font-medium">Select a VL indicator above to see data</div>' : ""}
          </div>
        `);
        // Add county label
        if (
          feature.geometry.type === "Polygon" ||
          feature.geometry.type === "MultiPolygon"
        ) {
          try {
            const center = layer.getBounds().getCenter();
            L.marker([center.lat, center.lng], {
              icon: L.divIcon({
                className: "",
                html: `<div style="background:rgba(255,255,255,0.9);color:#1e293b;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:600;border:1px solid #94a3b8;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.1);">${escapeHtml(name)}</div>`,
                iconSize: [0, 0],
                iconAnchor: [0, 0],
              }),
            }).addTo(entry.layer);
          } catch (_) {}
        }
      },
    }).addTo(entry.layer);

    // Fit bounds to show all project counties
    try {
      const allBounds = [];
      geoLayer.eachLayer(function (l) {
        if (l.getBounds) allBounds.push(l.getBounds());
      });
      if (allBounds.length) {
        const merged = allBounds.reduce(function (a, b) {
          return a.extend(b);
        });
        entry.map.fitBounds(merged, { padding: [20, 20], maxZoom: 7 });
      }
    } catch (_) {}

    // Update count
    const countEl = document.getElementById(
      `filter-${mapId.replace("map-", "")}-count`,
    );
    if (countEl) countEl.textContent = projCountyNames.size + " counties";
    return;
  }

  // ── MHU MODE ──
  const color = "#0891b2";
  const label = "MHU";
  const radius = 7;

  // Group facilities by county to spread markers
  const countyGroups = {};
  for (const [fid, f] of filtered) {
    const key = f.county || "unknown";
    if (!countyGroups[key]) countyGroups[key] = [];
    countyGroups[key].push([fid, f]);
  }

  for (const county of Object.keys(countyGroups)) {
    const group = countyGroups[county];
    const baseLat = group[0][1].lat;
    const baseLng = group[0][1].lng;
    const count = group.length;

    for (let i = 0; i < count; i++) {
      const [fid, f] = group[i];
      // Spread markers in a grid pattern around county center
      const cols = Math.ceil(Math.sqrt(count));
      const row = Math.floor(i / cols);
      const col = i % cols;
      const jitterLat = (row - (cols - 1) / 2) * 0.04;
      const jitterLng = (col - (cols - 1) / 2) * 0.04;

      const marker = L.circleMarker(
        [baseLat + jitterLat, baseLng + jitterLng],
        {
          radius,
          fillColor: color,
          color: "#fff",
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.8,
        },
      ).addTo(entry.layer);

      marker.bindPopup(`
        <div class="text-xs" style="min-width:120px;">
          <div class="font-semibold text-slate-800">${escapeHtml(f.name || "Unknown")}</div>
          <div class="text-slate-500 mt-0.5">${label} · ${escapeHtml(county)}</div>
          <div class="text-slate-400 mt-0.5">${count} locations in county</div>
        </div>
      `);
    }
  }

  // Update count
  const countEl = document.getElementById(
    `filter-${mapId.replace("map-", "")}-count`,
  );
  if (countEl) countEl.textContent = filtered.length;
}

// ── Percentage Legend ──
function _renderPctLegend(mapId, metricLabel) {
  const legendEl = document.getElementById(`${mapId}-legend`);
  if (!legendEl) return;

  const thresholds = [
    { label: "0-20%", color: "#dc2626" },
    { label: "20-40%", color: "#f97316" },
    { label: "40-60%", color: "#eab308" },
    { label: "60-80%", color: "#84cc16" },
    { label: "80-100%", color: "#16a34a" },
  ];

  let html = `<div class="text-[10px] font-semibold text-slate-700 mb-1">${metricLabel}</div><div class="flex flex-col gap-0.5">`;
  for (const t of thresholds) {
    html += `<div class="flex items-center gap-1.5"><div style="background:${t.color};width:16px;height:12px;border:1px solid #94a3b8;border-radius:2px;"></div><span class="text-[9px] text-slate-600">${t.label}</span></div>`;
  }
  html += `</div>`;

  legendEl.innerHTML = html;
  legendEl.style.display = "block";
}

async function renderHivTreatmentOverview(container) {
  const wrapper = document.createElement("div");
  wrapper.className = "space-y-5";
  wrapper.innerHTML = `
    <div class="flex items-center justify-center py-16 text-slate-500 text-sm gap-2">
      <div class="w-5 h-5 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
      Preparing HIV treatment overview…
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
  const selectedPeriod =
    state.periodFilter && state.periodFilter !== "all"
      ? state.periodFilter
      : "LAST_12_MONTHS";

  try {
    const [newResp, currResp, vlResp] = await Promise.all([
      fetch(
        `/api/hiv-treatment/dhis-live?type=tx_new&county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=${encodeURIComponent(selectedPeriod)}`,
      ),
      fetch(
        `/api/hiv-treatment/dhis-live?type=tx_curr&county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=${encodeURIComponent(selectedPeriod)}`,
      ),
      fetch(
        `/api/hiv-treatment/dhis-live?type=vl&county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=${encodeURIComponent(selectedPeriod)}`,
      ),
    ]);

    const [newJson, currJson, vlJson] = await Promise.all([
      newResp.json(),
      currResp.json(),
      vlResp.json(),
    ]);

    if (newJson.error || currJson.error || vlJson.error) {
      throw new Error(newJson.error || currJson.error || vlJson.error);
    }

    const categories = (newJson.trend || []).map((p) => p.label);
    const latestNew = (newJson.trend || []).slice(-1)[0] || {};
    const latestCurr = (currJson.trend || []).slice(-1)[0] || {};
    const latestVl = (vlJson.trend || []).slice(-1)[0] || {};

    const cards = [
      {
        label: "New on ART",
        value: latestNew.total || 0,
        hint: "Latest month starts",
        color: "border-sky-200 bg-sky-50 text-sky-700",
      },
      {
        label: "Current on ART",
        value: latestCurr.total || 0,
        hint: "Latest caseload",
        color: "border-violet-200 bg-violet-50 text-violet-700",
      },
      {
        label: "VL uptake",
        value: `${latestVl.vl_uptake || 0}%`,
        hint: "Latest coverage",
        color: "border-emerald-200 bg-emerald-50 text-emerald-700",
      },
      {
        label: "Trend months",
        value: categories.length,
        hint: "Reporting periods",
        color: "border-amber-200 bg-amber-50 text-amber-700",
      },
    ];

    const quickLinks = [
      { label: "Newly Started on ART", slug: "newly-started-on-art" },
      { label: "Current on ART", slug: "current-on-art" },
      { label: "VL Monitoring", slug: "vl-monitoring" },
      { label: "CD4/TPT Uptake", slug: "cd4-tpt-uptake" },
      { label: "Care & Treatment", slug: "care-treatment" },
      { label: "Treatment Outcomes", slug: "treatment-outcomes" },
    ];

    const currentMalePct = latestCurr.total
      ? Math.round((latestCurr.males / latestCurr.total) * 100)
      : 0;
    const currentFemalePct = latestCurr.total
      ? Math.round((latestCurr.females / latestCurr.total) * 100)
      : 0;
    const newMalePct = latestNew.total
      ? Math.round((latestNew.males / latestNew.total) * 100)
      : 0;
    const newFemalePct = latestNew.total
      ? Math.round((latestNew.females / latestNew.total) * 100)
      : 0;

    wrapper.innerHTML = `
      <div class="space-y-6">
        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div class="text-lg font-bold text-slate-800">HIV Treatment overview</div>
              <div class="text-sm text-slate-500">A long-form landing page that summarizes the key treatment subtab areas with sectioned highlights for each main view.</div>
            </div>
            <div class="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-[11px] font-semibold text-purple-700">
              <span class="h-2 w-2 rounded-full bg-purple-500"></span> Jamii Tekelezi overview
            </div>
          </div>
          <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            ${cards
              .map(
                (card) => `
                <div class="rounded-2xl border ${card.color} p-4">
                  <div class="text-[11px] font-semibold uppercase tracking-[0.2em]">${escapeHtml(card.label)}</div>
                  <div class="mt-2 text-2xl font-bold">${escapeHtml(String(card.value))}</div>
                  <div class="mt-1 text-[11px] opacity-80">${escapeHtml(card.hint)}</div>
                </div>
              `,
              )
              .join("")}
          </div>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="text-base font-semibold text-slate-800">Current on ART</div>
              <div class="text-sm text-slate-500">A snapshot of active caseload with trend, sex share, and continuity signal.</div>
            </div>
            <button data-subtab-link="current-on-art" class="rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 transition hover:bg-purple-100">View Current on ART</button>
          </div>
          <div class="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div class="space-y-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div class="text-sm font-semibold text-slate-700">Latest caseload</div>
                <div class="text-3xl font-bold text-slate-900">${escapeHtml(String(latestCurr.total || 0))}</div>
                <div class="text-xs text-slate-500">Current ART clients in the latest period.</div>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:260px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Monthly caseload trend</div>
                <canvas id="ht-overview-current-line"></canvas>
              </div>
            </div>
            <div class="grid gap-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Sex distribution</div>
                <canvas id="ht-overview-current-donut"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Growth comparison</div>
                <canvas id="ht-overview-current-bar"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Continuity gauge</div>
                <canvas id="ht-overview-current-gauge"></canvas>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="text-base font-semibold text-slate-800">Newly Started on ART</div>
              <div class="text-sm text-slate-500">A quick look at the latest treatment uptake, sex share, and momentum.</div>
            </div>
            <button data-subtab-link="newly-started-on-art" class="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100">View New Starts</button>
          </div>
          <div class="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div class="space-y-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div class="text-sm font-semibold text-slate-700">Latest new ART clients</div>
                <div class="text-3xl font-bold text-slate-900">${escapeHtml(String(latestNew.total || 0))}</div>
                <div class="text-xs text-slate-500">New treatment starts in the latest reporting period.</div>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:260px">
                <div class="text-sm font-semibold text-slate-700 mb-2">New starts trend</div>
                <canvas id="ht-overview-new-line"></canvas>
              </div>
            </div>
            <div class="grid gap-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Sex share</div>
                <canvas id="ht-overview-new-donut"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Month-over-month change</div>
                <canvas id="ht-overview-new-bar"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Uptake gauge</div>
                <canvas id="ht-overview-new-gauge"></canvas>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="text-base font-semibold text-slate-800">VL Monitoring</div>
              <div class="text-sm text-slate-500">A concise view of viral load uptake, coverage, and the latest cascade signal.</div>
            </div>
            <button data-subtab-link="vl-monitoring" class="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">View VL Monitoring</button>
          </div>
          <div class="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div class="space-y-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div class="text-sm font-semibold text-slate-700">Latest VL uptake</div>
                <div class="text-3xl font-bold text-slate-900">${escapeHtml(String(latestVl.vl_uptake || 0))}%</div>
                <div class="text-xs text-slate-500">Viral load coverage in the latest month.</div>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:260px">
                <div class="text-sm font-semibold text-slate-700 mb-2">VL uptake trend</div>
                <canvas id="ht-overview-vl-line"></canvas>
              </div>
            </div>
            <div class="grid gap-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Uptake vs remaining</div>
                <canvas id="ht-overview-vl-bar"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">VL coverage split</div>
                <canvas id="ht-overview-vl-donut"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Coverage gauge</div>
                <canvas id="ht-overview-vl-gauge"></canvas>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
          <div class="text-sm font-semibold text-slate-700">Quick navigation</div>
          <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            ${quickLinks
              .map(
                (item) => `
                <button data-subtab-link="${escapeHtml(item.slug)}" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-100">
                  ${escapeHtml(item.label)}
                </button>
              `,
              )
              .join("")}
          </div>
        </section>
      </div>
    `;

    wrapper.querySelectorAll("[data-subtab-link]").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeSubtabs.hiv_treatment =
          button.getAttribute("data-subtab-link");
        renderCurrentView();
      });
    });

    if (window.Chart) {
      const currentTrend = (currJson.trend || []).map(
        (p) => Number(p.total) || 0,
      );
      const currentMale = (currJson.trend || []).map(
        (p) => Number(p.males) || 0,
      );
      const currentFemale = (currJson.trend || []).map(
        (p) => Number(p.females) || 0,
      );
      const currentChange = currentTrend.map((value, index) =>
        index === 0 ? 0 : value - currentTrend[index - 1],
      );
      const currentGaugeValue = latestCurr.total
        ? Math.min(100, Math.round((latestNew.total / latestCurr.total) * 100))
        : 0;

      const newTrend = (newJson.trend || []).map((p) => Number(p.total) || 0);
      const newMale = (newJson.trend || []).map((p) => Number(p.males) || 0);
      const newFemale = (newJson.trend || []).map(
        (p) => Number(p.females) || 0,
      );
      const newChange = newTrend.map((value, index) =>
        index === 0 ? 0 : value - newTrend[index - 1],
      );
      const newGaugeValue = latestCurr.total
        ? Math.min(100, Math.round((latestNew.total / latestCurr.total) * 100))
        : 0;

      const vlTrend = (vlJson.trend || []).map((p) => Number(p.vl_uptake) || 0);
      const vlRemainingTrend = vlTrend.map((value) => Math.max(0, 100 - value));
      const vlGaugeValue = Number(latestVl.vl_uptake) || 0;

      const drawGauge = (canvasId, value, color) => {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        new Chart(ctx, {
          type: "doughnut",
          data: {
            labels: ["Value", "Remaining"],
            datasets: [
              {
                data: [value, Math.max(0, 100 - value)],
                backgroundColor: [color, "#e2e8f0"],
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "75%",
            circumference: Math.PI,
            rotation: -Math.PI,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.label}: ${ctx.parsed}%`,
                },
              },
            },
          },
        });
      };

      const currentLineCtx = document.getElementById(
        "ht-overview-current-line",
      );
      if (currentLineCtx) {
        new Chart(currentLineCtx, {
          type: "line",
          data: {
            labels: categories,
            datasets: [
              {
                label: "Current on ART",
                data: currentTrend,
                borderColor: "#7c3aed",
                backgroundColor: "rgba(124,58,237,0.12)",
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: "#7c3aed",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { maxRotation: -45, font: { size: 10 } } },
              y: { beginAtZero: true },
            },
          },
        });
      }

      const currentDonutCtx = document.getElementById(
        "ht-overview-current-donut",
      );
      if (currentDonutCtx) {
        new Chart(currentDonutCtx, {
          type: "doughnut",
          data: {
            labels: ["Male", "Female"],
            datasets: [
              {
                data: [
                  currentMale[currentMale.length - 1] || 0,
                  currentFemale[currentFemale.length - 1] || 0,
                ],
                backgroundColor: ["#2563eb", "#ec4899"],
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: {
              legend: { position: "bottom", labels: { boxWidth: 12 } },
              tooltip: {
                callbacks: {
                  label: (ctx) =>
                    `${ctx.label}: ${ctx.parsed.toLocaleString()}`,
                },
              },
            },
          },
        });
      }

      const currentBarCtx = document.getElementById("ht-overview-current-bar");
      if (currentBarCtx) {
        new Chart(currentBarCtx, {
          type: "bar",
          data: {
            labels: categories,
            datasets: [
              {
                label: "Monthly change",
                data: currentChange,
                backgroundColor: currentChange.map((value) =>
                  value >= 0 ? "#4f46e5" : "#dc2626",
                ),
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: {
                grid: { display: false },
                ticks: { maxRotation: -45, font: { size: 10 } },
              },
              y: { beginAtZero: true },
            },
          },
        });
      }

      drawGauge("ht-overview-current-gauge", currentGaugeValue, "#7c3aed");

      const newLineCtx = document.getElementById("ht-overview-new-line");
      if (newLineCtx) {
        new Chart(newLineCtx, {
          type: "line",
          data: {
            labels: categories,
            datasets: [
              {
                label: "New on ART",
                data: newTrend,
                borderColor: "#0f766e",
                backgroundColor: "rgba(6,182,212,0.12)",
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: "#0f766e",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { maxRotation: -45, font: { size: 10 } } },
              y: { beginAtZero: true },
            },
          },
        });
      }

      const newDonutCtx = document.getElementById("ht-overview-new-donut");
      if (newDonutCtx) {
        new Chart(newDonutCtx, {
          type: "doughnut",
          data: {
            labels: ["Male", "Female"],
            datasets: [
              {
                data: [
                  newMale[newMale.length - 1] || 0,
                  newFemale[newFemale.length - 1] || 0,
                ],
                backgroundColor: ["#0f766e", "#7c3aed"],
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: {
              legend: { position: "bottom", labels: { boxWidth: 12 } },
              tooltip: {
                callbacks: {
                  label: (ctx) =>
                    `${ctx.label}: ${ctx.parsed.toLocaleString()}`,
                },
              },
            },
          },
        });
      }

      const newBarCtx = document.getElementById("ht-overview-new-bar");
      if (newBarCtx) {
        new Chart(newBarCtx, {
          type: "bar",
          data: {
            labels: categories,
            datasets: [
              {
                label: "New ART volume",
                data: newTrend,
                backgroundColor: "#2563eb",
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: {
                grid: { display: false },
                ticks: { maxRotation: -45, font: { size: 10 } },
              },
              y: { beginAtZero: true },
            },
          },
        });
      }

      drawGauge("ht-overview-new-gauge", newGaugeValue, "#0f766e");

      const vlLineCtx = document.getElementById("ht-overview-vl-line");
      if (vlLineCtx) {
        new Chart(vlLineCtx, {
          type: "line",
          data: {
            labels: categories,
            datasets: [
              {
                label: "VL uptake",
                data: vlTrend,
                borderColor: "#16a34a",
                backgroundColor: "rgba(16,185,129,0.12)",
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: "#16a34a",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { maxRotation: -45, font: { size: 10 } } },
              y: {
                beginAtZero: true,
                ticks: { callback: (value) => `${value}%` },
              },
            },
          },
        });
      }

      const vlBarCtx = document.getElementById("ht-overview-vl-bar");
      if (vlBarCtx) {
        new Chart(vlBarCtx, {
          type: "bar",
          data: {
            labels: categories,
            datasets: [
              {
                label: "VL uptake",
                data: vlTrend,
                backgroundColor: "#16a34a",
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: {
                grid: { display: false },
                ticks: { maxRotation: -45, font: { size: 10 } },
              },
              y: {
                beginAtZero: true,
                ticks: { callback: (value) => `${value}%` },
              },
            },
          },
        });
      }

      const vlDonutCtx = document.getElementById("ht-overview-vl-donut");
      if (vlDonutCtx) {
        new Chart(vlDonutCtx, {
          type: "doughnut",
          data: {
            labels: ["Uptake", "Remaining"],
            datasets: [
              {
                data: [vlGaugeValue, Math.max(0, 100 - vlGaugeValue)],
                backgroundColor: ["#16a34a", "#d1fae5"],
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: {
              legend: { position: "bottom", labels: { boxWidth: 12 } },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.label}: ${ctx.parsed}%`,
                },
              },
            },
          },
        });
      }

      drawGauge("ht-overview-vl-gauge", vlGaugeValue, "#16a34a");
    }
  } catch (error) {
    wrapper.innerHTML = `<div class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Unable to load the HIV treatment landing page: ${escapeHtml(error.message || "Unknown error")}</div>`;
  }
}

async function renderHivTestingOverview(container) {
  const wrapper = document.createElement("div");
  wrapper.className = "space-y-5";
  wrapper.innerHTML = `
    <div class="flex items-center justify-center py-16 text-slate-500 text-sm gap-2">
      <div class="w-5 h-5 border-2 border-cyan-200 border-t-cyan-600 rounded-full animate-spin"></div>
      Preparing HIV testing overview…
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
  const selectedPeriod =
    state.periodFilter && state.periodFilter !== "all"
      ? state.periodFilter
      : "LAST_12_MONTHS";

  try {
    const [uptakeResp, linkageResp, partnerResp, prepResp] = await Promise.all([
      fetch(
        `/api/hiv-testing/dhis-live?type=hts_uptake&county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=${encodeURIComponent(selectedPeriod)}`,
      ),
      fetch(
        `/api/hiv-testing/dhis-live?type=hts_linkage&county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=${encodeURIComponent(selectedPeriod)}`,
      ),
      fetch(
        `/api/hiv-testing/dhis-live?type=partner_notification&county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=${encodeURIComponent(selectedPeriod)}`,
      ),
      fetch(
        `/api/hiv-testing/dhis-live?type=prep&county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=${encodeURIComponent(selectedPeriod)}`,
      ),
    ]);

    const [uptakeJson, linkageJson, partnerJson, prepJson] = await Promise.all([
      uptakeResp.json(),
      linkageResp.json(),
      partnerResp.json(),
      prepResp.json(),
    ]);

    if (
      uptakeJson.error ||
      linkageJson.error ||
      partnerJson.error ||
      prepJson.error
    ) {
      throw new Error(
        uptakeJson.error ||
          linkageJson.error ||
          partnerJson.error ||
          prepJson.error,
      );
    }

    const categories = (uptakeJson.trend || []).map((p) => p.label);
    const latestUptake = (uptakeJson.trend || []).slice(-1)[0] || {};
    const latestLinkage = (linkageJson.trend || []).slice(-1)[0] || {};
    const latestPartner = (partnerJson.trend || []).slice(-1)[0] || {};
    const latestPrep = (prepJson.trend || []).slice(-1)[0] || {};

    const cards = [
      {
        label: "Tested",
        value: latestUptake.hts_tested || 0,
        hint: "Latest HTS tested",
        color: "border-sky-200 bg-sky-50 text-sky-700",
      },
      {
        label: "Positive",
        value: latestUptake.hts_positive || 0,
        hint: "Latest positives",
        color: "border-rose-200 bg-rose-50 text-rose-700",
      },
      {
        label: "Linkage",
        value: latestLinkage.index_accepted || 0,
        hint: "Accepted linkage",
        color: "border-emerald-200 bg-emerald-50 text-emerald-700",
      },
      {
        label: "PrEP current",
        value: latestPrep.prep_curr || 0,
        hint: "Current PrEP clients",
        color: "border-violet-200 bg-violet-50 text-violet-700",
      },
    ];

    const quickLinks = [
      { label: "HTS Uptake", slug: "hiv-testing-services-uptake" },
      { label: "HTS Linkage", slug: "hiv-testing-services-linkage" },
      { label: "Partner Notification", slug: "partner-notification-services" },
      { label: "PrEP", slug: "prep" },
    ];

    const positivityTrend = (uptakeJson.trend || []).map(
      (p) => p.positivity_rate || 0,
    );
    const testedTrend = (uptakeJson.trend || []).map((p) => p.hts_tested || 0);
    const linkageTrend = (linkageJson.trend || []).map(
      (p) => p.index_accepted || 0,
    );
    const prepTrend = (prepJson.trend || []).map((p) => p.prep_curr || 0);

    wrapper.innerHTML = `
      <div class="space-y-6">
        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div class="text-lg font-bold text-slate-800">HIV Testing overview</div>
              <div class="text-sm text-slate-500">A long-form overview that mirrors the HTS subtab areas with sectioned summaries for uptake, linkage, and PrEP.</div>
            </div>
            <div class="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold text-cyan-700">
              <span class="h-2 w-2 rounded-full bg-cyan-500"></span> Jamii Tekelezi overview
            </div>
          </div>
          <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            ${cards
              .map(
                (card) => `
                <div class="rounded-2xl border ${card.color} p-4">
                  <div class="text-[11px] font-semibold uppercase tracking-[0.2em]">${escapeHtml(card.label)}</div>
                  <div class="mt-2 text-2xl font-bold">${escapeHtml(String(card.value))}</div>
                  <div class="mt-1 text-[11px] opacity-80">${escapeHtml(card.hint)}</div>
                </div>
              `,
              )
              .join("")}
          </div>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="text-base font-semibold text-slate-800">HTS Uptake</div>
              <div class="text-sm text-slate-500">A summary of testing volume, positivity and the major uptake trend for this subtab.</div>
            </div>
            <button data-subtab-link="hiv-testing-services-uptake" class="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100">Enter HTS Uptake</button>
          </div>
          <div class="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div id="hts-overview-uptake-chart" style="height:260px"></div>
            <div class="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div class="text-sm font-semibold text-slate-700">Latest metrics</div>
              <div class="text-3xl font-bold text-slate-900">${escapeHtml(String(latestUptake.hts_tested || 0))}</div>
              <div class="text-sm text-slate-600">Tested this period • ${escapeHtml(String(latestUptake.hts_positive || 0))} positive</div>
              <div class="text-xs text-slate-500">Positivity is ${escapeHtml(String(latestUptake.positivity_rate || 0))}% and drives the HTS performance narrative.</div>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="text-base font-semibold text-slate-800">Linkage & partner notification</div>
              <div class="text-sm text-slate-500">A section previewing the linkage cascade and partner notification performance.</div>
            </div>
            <button data-subtab-link="hiv-testing-services-linkage" class="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100">Open Linkage</button>
          </div>
          <div class="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div id="hts-overview-linkage-chart" style="height:260px"></div>
            <div class="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div class="text-sm font-semibold text-slate-700">Latest linkage</div>
              <div class="text-3xl font-bold text-slate-900">${escapeHtml(String(latestLinkage.index_accepted || 0))}</div>
              <div class="text-sm text-slate-600">Accepted index clients</div>
              <div class="text-xs text-slate-500">This section previews the partner notification cascade and referral follow-up.</div>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="text-base font-semibold text-slate-800">PrEP</div>
              <div class="text-sm text-slate-500">Highlights current PrEP client volume and protective coverage.</div>
            </div>
            <button data-subtab-link="prep" class="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100">Open PrEP</button>
          </div>
          <div class="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div id="hts-overview-prep-chart" style="height:260px"></div>
            <div class="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div class="text-sm font-semibold text-slate-700">Current PrEP clients</div>
              <div class="text-3xl font-bold text-slate-900">${escapeHtml(String(latestPrep.prep_curr || 0))}</div>
              <div class="text-sm text-slate-600">Active PrEP coverage</div>
              <div class="text-xs text-slate-500">This section previews broader prevention services and readiness.</div>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
          <div class="text-sm font-semibold text-slate-700">Quick navigation</div>
          <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            ${quickLinks
              .map(
                (item) => `
                <button data-subtab-link="${escapeHtml(item.slug)}" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-100">
                  ${escapeHtml(item.label)}
                </button>
              `,
              )
              .join("")}
          </div>
        </section>
      </div>
    `;

    wrapper.querySelectorAll("[data-subtab-link]").forEach((button) => {
      button.addEventListener("click", () => {
        const slug = button.getAttribute("data-subtab-link") || "";
        state.activeSubtabs.hiv_treatment = slug;
        setPageHash("hiv_treatment", slug);
        renderCurrentView();
      });
    });

    if (window.Highcharts) {
      Highcharts.chart("hts-overview-uptake-chart", {
        chart: { type: "line", zoomType: "x" },
        title: { text: null },
        xAxis: {
          categories,
          labels: { rotation: -25, style: { fontSize: "9px" } },
        },
        yAxis: [
          { title: { text: "Clients" }, allowDecimals: false },
          {
            title: { text: "% Positive" },
            opposite: true,
            labels: { format: "{value}%" },
          },
        ],
        tooltip: { shared: true },
        series: [
          {
            name: "Tested",
            data: (uptakeJson.trend || []).map((p) => p.hts_tested),
            color: "#0891b2",
          },
          {
            name: "Positive",
            data: (uptakeJson.trend || []).map((p) => p.hts_positive),
            color: "#dc2626",
          },
          {
            name: "% Positive",
            data: (uptakeJson.trend || []).map((p) => p.positivity_rate),
            color: "#7c3aed",
            yAxis: 1,
          },
        ],
        legend: { enabled: true },
        credits: { enabled: false },
      });

      Highcharts.chart("hts-overview-linkage-chart", {
        chart: { type: "column", zoomType: "x" },
        title: { text: null },
        xAxis: {
          categories,
          labels: { rotation: -25, style: { fontSize: "9px" } },
        },
        yAxis: { title: { text: "Clients" }, allowDecimals: false },
        tooltip: { valueSuffix: " clients" },
        series: [
          {
            name: "Offered",
            data: (linkageJson.trend || []).map((p) => p.index_offered),
            color: "#0f766e",
          },
          {
            name: "Accepted",
            data: (linkageJson.trend || []).map((p) => p.index_accepted),
            color: "#2563eb",
          },
          {
            name: "Contacts tested",
            data: (partnerJson.trend || []).map((p) => p.contacts_tested),
            color: "#f59e0b",
          },
        ],
        legend: { enabled: true },
        credits: { enabled: false },
      });

      Highcharts.chart("hts-overview-prep-chart", {
        chart: { type: "line", zoomType: "x" },
        title: { text: null },
        xAxis: {
          categories,
          labels: { rotation: -25, style: { fontSize: "9px" } },
        },
        yAxis: { title: { text: "Clients" }, allowDecimals: false },
        tooltip: { valueSuffix: " clients" },
        series: [
          {
            name: "PrEP new",
            data: (prepJson.trend || []).map((p) => p.prep_new),
            color: "#16a34a",
          },
          {
            name: "PrEP current",
            data: (prepJson.trend || []).map((p) => p.prep_curr),
            color: "#7c3aed",
          },
        ],
        legend: { enabled: true },
        credits: { enabled: false },
      });
    }
  } catch (error) {
    wrapper.innerHTML = `<div class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Unable to load the HIV testing landing page: ${escapeHtml(error.message || "Unknown error")}</div>`;
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
    const projParam =
      state.projectFilter !== "all"
        ? `&project=${encodeURIComponent(state.projectFilter)}`
        : "";
    const resp = await fetch(
      `/api/hiv-treatment/dhis-live?type=${encodeURIComponent(config.type)}&county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=${encodeURIComponent(selectedPeriod)}`,
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
  const projParam =
    state.projectFilter !== "all"
      ? `&project=${encodeURIComponent(state.projectFilter)}`
      : "";
  try {
    const selectedPeriod =
      state.periodFilter && state.periodFilter !== "all"
        ? state.periodFilter
        : "LAST_12_MONTHS";
    const resp = await fetch(
      `/api/hiv-testing/dhis-live?type=${encodeURIComponent(config.type)}&county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=${encodeURIComponent(selectedPeriod)}`,
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
  if (state.projectFilter && state.projectFilter !== "all")
    locationParams.set("project", state.projectFilter);
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
  if (state.projectFilter && state.projectFilter !== "all")
    locationParams.set("project", state.projectFilter);
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
  } else if (activeSlug === "programme-highlights") {
    renderJamiiProgrammeHighlights(container);
  } else if (activeSlug === "workload-mhu") {
    renderJamiiWorkloadPage(container);
  } else {
    container.innerHTML = `<div class="text-center py-12 text-sm text-slate-500">Select a view above.</div>`;
  }
}

async function renderJamiiProgrammeHighlights(container) {
  container.innerHTML = `
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="text-xs font-semibold text-slate-700 mb-3">📊 Programme highlights</div>
      <div class="flex items-center justify-center py-10 text-sm text-slate-500" id="jamiiHighlightsLoading">Loading snapshot…</div>
    </div>
  `;

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
  const url = `/api/homepage/summary?county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=LAST_12_MONTHS`;

  try {
    const resp = await fetch(url);
    const d = await resp.json();
    if (d.error) throw new Error(d.error);
    const latest = d.latest || {};
    const txCurr = Number(latest.tx_curr || 0);
    const txNew = Number(latest.tx_new || 0);
    const tested = Number(latest.hts_tested || 0);
    const positivity = Number(latest.positivity_rate || 0);
    const serviceContinuity =
      txCurr > 0 && txNew > 0 ? Math.round((txNew / txCurr) * 100) : 0;
    const htsMomentum =
      tested > 0 ? Math.round((tested / Math.max(1, txCurr)) * 100) : 0;

    document.getElementById("jamiiHighlightsLoading").outerHTML = `
      <div class="space-y-4">
        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Care continuity</div>
            <div class="mt-2 text-2xl font-bold text-slate-800">${serviceContinuity}%</div>
            <div class="mt-1 text-[11px] text-slate-500">New initiations relative to the active caseload.</div>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">HTS momentum</div>
            <div class="mt-2 text-2xl font-bold text-slate-800">${htsMomentum}%</div>
            <div class="mt-1 text-[11px] text-slate-500">Recent testing volume against the current treatment pool.</div>
          </div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50 to-emerald-50 p-4">
          <div class="text-xs font-semibold text-slate-700">🧭 PBIX-aligned focus areas</div>
          <div class="mt-3 grid gap-3 md:grid-cols-3 text-sm text-slate-600">
            <div class="rounded-xl border border-white/70 bg-white/70 p-3"><div class="font-semibold text-slate-700">TX_CURR</div><div class="mt-1 text-xl font-bold text-slate-800">${txCurr.toLocaleString()}</div></div>
            <div class="rounded-xl border border-white/70 bg-white/70 p-3"><div class="font-semibold text-slate-700">TX_NEW</div><div class="mt-1 text-xl font-bold text-slate-800">${txNew.toLocaleString()}</div></div>
            <div class="rounded-xl border border-white/70 bg-white/70 p-3"><div class="font-semibold text-slate-700">Positivity</div><div class="mt-1 text-xl font-bold text-slate-800">${positivity.toFixed(1)}%</div></div>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-600">Programme highlights could not be loaded: ${escapeHtml(error.message)}</div>`;
  }
}

async function renderJamiiWorkloadPage(container) {
  container.innerHTML = `
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="text-xs font-semibold text-slate-700 mb-3">🚐 Workload & MHU focus</div>
      <div class="flex items-center justify-center py-10 text-sm text-slate-500" id="jamiiWorkloadLoading">Loading workload view…</div>
    </div>
  `;

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
  const url = `/api/homepage/summary?county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=LAST_12_MONTHS`;

  try {
    const resp = await fetch(url);
    const d = await resp.json();
    if (d.error) throw new Error(d.error);
    const latest = d.latest || {};
    const txCurr = Number(latest.tx_curr || 0);
    const txNew = Number(latest.tx_new || 0);
    const tested = Number(latest.hts_tested || 0);
    const positivity = Number(latest.positivity_rate || 0);
    const workloadIndex = Math.max(
      0,
      Math.min(100, Math.round((txCurr / Math.max(1, tested)) * 100)),
    );
    const servicePressure = Math.max(
      0,
      Math.min(100, Math.round((txNew / Math.max(1, txCurr)) * 100)),
    );

    document.getElementById("jamiiWorkloadLoading").outerHTML = `
      <div class="space-y-4">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div class="text-sm font-semibold text-slate-700">Service workload summary</div>
          <div class="mt-3 grid gap-3 md:grid-cols-3">
            <div class="rounded-xl border border-slate-200 bg-white p-3">
              <div class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Caseload pressure</div>
              <div class="mt-2 text-2xl font-bold text-slate-800">${workloadIndex}%</div>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white p-3">
              <div class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">New starts</div>
              <div class="mt-2 text-2xl font-bold text-slate-800">${txNew.toLocaleString()}</div>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white p-3">
              <div class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Yield</div>
              <div class="mt-2 text-2xl font-bold text-slate-800">${positivity.toFixed(1)}%</div>
            </div>
          </div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="text-xs font-semibold text-slate-700">🧪 MHU-style workload notes</div>
          <div class="mt-3 space-y-3 text-sm text-slate-600">
            <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div class="flex items-center justify-between text-[12px] font-semibold text-slate-700"><span>Service pressure</span><span>${servicePressure}%</span></div>
              <div class="mt-2 h-2 w-full rounded-full bg-slate-200"><div class="h-2 rounded-full bg-orange-500" style="width:${servicePressure}%"></div></div>
            </div>
            <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">The workload view now surfaces the same operational signals as the MHU board: active caseload, initiation pace, and routine testing yield.</div>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<div class="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-600">Workload view could not be loaded: ${escapeHtml(error.message)}</div>`;
  }
}

async function renderJamiiOverview(container) {
  container.innerHTML = `
    <div class="flex items-center justify-center py-16 text-slate-500 text-sm gap-2">
      <div class="w-5 h-5 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
      Loading Jamii Tekelezi overview…
    </div>
  `;

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
  const selectedPeriod =
    state.periodFilter && state.periodFilter !== "all"
      ? state.periodFilter
      : "LAST_12_MONTHS";

  try {
    const [summaryResp, vlResp, linkageResp, prepResp] = await Promise.all([
      fetch(
        `/api/homepage/summary?county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=${encodeURIComponent(selectedPeriod)}`,
      ),
      fetch(
        `/api/hiv-treatment/dhis-live?type=vl&county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=${encodeURIComponent(selectedPeriod)}`,
      ),
      fetch(
        `/api/hiv-testing/dhis-live?type=hts_linkage&county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=${encodeURIComponent(selectedPeriod)}`,
      ),
      fetch(
        `/api/hiv-testing/dhis-live?type=prep&county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=${encodeURIComponent(selectedPeriod)}`,
      ),
    ]);

    const [summaryJson, vlJson, linkageJson, prepJson] = await Promise.all([
      summaryResp.json(),
      vlResp.json(),
      linkageResp.json(),
      prepResp.json(),
    ]);

    if (
      summaryJson.error ||
      vlJson.error ||
      linkageJson.error ||
      prepJson.error
    ) {
      throw new Error(
        summaryJson.error ||
          vlJson.error ||
          linkageJson.error ||
          prepJson.error,
      );
    }

    const txCurrTrend = summaryJson.tx_curr_trend || [];
    const txNewTrend = summaryJson.tx_new_trend || [];
    const htsTrend = summaryJson.hts_trend || [];
    const latest = summaryJson.latest || {};
    const latestVl = (vlJson.trend || []).slice(-1)[0] || {};
    const latestLinkage = (linkageJson.trend || []).slice(-1)[0] || {};
    const latestPrep = (prepJson.trend || []).slice(-1)[0] || {};

    const txCurrCategories = txCurrTrend.map((p) => p.label);
    const txNewCategories = txNewTrend.map((p) => p.label);
    const htsCategories = htsTrend.map((p) => p.label);

    const txCurrValues = txCurrTrend.map((p) => p.value);
    const txNewValues = txNewTrend.map((p) => p.value);
    const htsTestedValues = htsTrend.map((p) => p.tested);
    const htsPositiveValues = htsTrend.map((p) => p.positive);
    const htsPositivityValues = htsTrend.map((p) => p.positivity_rate);

    const latestTxCurr = Number(latest.tx_curr || 0);
    const latestTxNew = Number(latest.tx_new || 0);
    const latestTested = Number(latest.hts_tested || 0);
    const latestPositive = Number(latest.hts_positive || 0);
    const latestPositivity = Number(latest.positivity_rate || 0);
    const vlUptake = Number(latestVl.vl_uptake || 0);
    const linkageAccepted = Number(latestLinkage.index_accepted || 0);
    const linkageOffered = Number(latestLinkage.index_offered || 0);
    const linkageDeclined = Math.max(0, linkageOffered - linkageAccepted);
    const prepCurr = Number(latestPrep.prep_curr || 0);
    const serviceContinuity =
      latestTxCurr > 0 ? Math.round((latestTxNew / latestTxCurr) * 100) : 0;
    const htsMomentum =
      latestTxCurr > 0 ? Math.round((latestTested / latestTxCurr) * 100) : 0;
    const workloadIndex =
      latestTested > 0
        ? Math.min(100, Math.round((latestTxCurr / latestTested) * 100))
        : 0;
    const servicePressure =
      latestTxCurr > 0
        ? Math.min(100, Math.round((latestTxNew / latestTxCurr) * 100))
        : 0;
    const vlRemaining = Math.max(0, 100 - vlUptake);

    container.innerHTML = `
      <div class="space-y-6">
        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div class="text-2xl font-bold text-slate-800">Jamii Tekelezi overview</div>
              <div class="text-sm text-slate-500">A consolidated landing page that brings HIV Treatment and HIV Testing overview sections together with programme highlights and MHU workload signals.</div>
            </div>
            <div class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
              <span class="h-2 w-2 rounded-full bg-sky-500"></span> Master overview
            </div>
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">TX_CURR</div>
              <div class="mt-2 text-3xl font-bold text-slate-900">${latestTxCurr.toLocaleString()}</div>
              <div class="mt-1 text-sm text-slate-600">Active clients on treatment</div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">TX_NEW</div>
              <div class="mt-2 text-3xl font-bold text-slate-900">${latestTxNew.toLocaleString()}</div>
              <div class="mt-1 text-sm text-slate-600">New treatment starts</div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">HTS tested</div>
              <div class="mt-2 text-3xl font-bold text-slate-900">${latestTested.toLocaleString()}</div>
              <div class="mt-1 text-sm text-slate-600">Testing volume</div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Positivity</div>
              <div class="mt-2 text-3xl font-bold text-slate-900">${latestPositivity.toFixed(1)}%</div>
              <div class="mt-1 text-sm text-slate-600">Testing yield</div>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="text-base font-semibold text-slate-800">Current on ART</div>
              <div class="text-sm text-slate-500">A treatment section with active caseload trend, gender split, monthly change, and continuity gauge.</div>
            </div>
            <button data-tab="hiv_treatment" class="rounded-full border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 transition hover:bg-purple-100">Open Current on ART</button>
          </div>
          <div class="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div class="space-y-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:260px">
                <div class="text-sm font-semibold text-slate-700 mb-2">TX_CURR trend</div>
                <canvas id="jamiiTreatmentCurrentLine"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:220px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Month-on-month change</div>
                <canvas id="jamiiTreatmentCurrentBar"></canvas>
              </div>
            </div>
            <div class="grid gap-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Sex distribution</div>
                <canvas id="jamiiTreatmentCurrentDonut"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Continuity gauge</div>
                <canvas id="jamiiTreatmentCurrentGauge"></canvas>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="text-base font-semibold text-slate-800">Newly Started on ART</div>
              <div class="text-sm text-slate-500">A treatment intake section with new start trends, gender share, growth volume, and uptake gauge.</div>
            </div>
            <button data-tab="hiv_treatment" class="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100">Open New Starts</button>
          </div>
          <div class="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div class="space-y-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:260px">
                <div class="text-sm font-semibold text-slate-700 mb-2">TX_NEW trend</div>
                <canvas id="jamiiTreatmentNewLine"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:220px">
                <div class="text-sm font-semibold text-slate-700 mb-2">New starts volume</div>
                <canvas id="jamiiTreatmentNewBar"></canvas>
              </div>
            </div>
            <div class="grid gap-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Sex share</div>
                <canvas id="jamiiTreatmentNewDonut"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Uptake gauge</div>
                <canvas id="jamiiTreatmentNewGauge"></canvas>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="text-base font-semibold text-slate-800">VL Monitoring</div>
              <div class="text-sm text-slate-500">A viral load section with coverage trend, headroom, split, and coverage gauge.</div>
            </div>
            <button data-tab="hiv_treatment" class="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">Open VL Monitoring</button>
          </div>
          <div class="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div class="space-y-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:260px">
                <div class="text-sm font-semibold text-slate-700 mb-2">VL uptake trend</div>
                <canvas id="jamiiTreatmentVlLine"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:220px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Uptake vs remaining</div>
                <canvas id="jamiiTreatmentVlBar"></canvas>
              </div>
            </div>
            <div class="grid gap-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">VL coverage split</div>
                <canvas id="jamiiTreatmentVlDonut"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Coverage gauge</div>
                <canvas id="jamiiTreatmentVlGauge"></canvas>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="text-base font-semibold text-slate-800">HTS Uptake</div>
              <div class="text-sm text-slate-500">A testing uptake section with volume trend, positivity split, extraction bar, and momentum gauge.</div>
            </div>
            <button data-tab="hiv_testing" class="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100">Open HTS Uptake</button>
          </div>
          <div class="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div class="space-y-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:260px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Testing volume trend</div>
                <canvas id="jamiiTestingUptakeLine"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:220px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Tested vs positive</div>
                <canvas id="jamiiTestingUptakeBar"></canvas>
              </div>
            </div>
            <div class="grid gap-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Positivity split</div>
                <canvas id="jamiiTestingUptakeDonut"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Momentum gauge</div>
                <canvas id="jamiiTestingUptakeGauge"></canvas>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="text-base font-semibold text-slate-800">Linkage & partner notification</div>
              <div class="text-sm text-slate-500">An index cascade section with acceptance trend, outreach volume, acceptance split, and linkage gauge.</div>
            </div>
            <button data-tab="hiv_testing" class="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100">Open Linkage</button>
          </div>
          <div class="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div class="space-y-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:260px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Linkage acceptance trend</div>
                <canvas id="jamiiTestingLinkageLine"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:220px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Offered vs accepted</div>
                <canvas id="jamiiTestingLinkageBar"></canvas>
              </div>
            </div>
            <div class="grid gap-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Acceptance split</div>
                <canvas id="jamiiTestingLinkageDonut"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Linkage gauge</div>
                <canvas id="jamiiTestingLinkageGauge"></canvas>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="text-base font-semibold text-slate-800">PrEP</div>
              <div class="text-sm text-slate-500">A prevention section with current coverage trend, new uptake, client split, and protection gauge.</div>
            </div>
            <button data-tab="hiv_testing" class="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100">Open PrEP</button>
          </div>
          <div class="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div class="space-y-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:260px">
                <div class="text-sm font-semibold text-slate-700 mb-2">PrEP current trend</div>
                <canvas id="jamiiTestingPrepLine"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:220px">
                <div class="text-sm font-semibold text-slate-700 mb-2">PrEP new versus current</div>
                <canvas id="jamiiTestingPrepBar"></canvas>
              </div>
            </div>
            <div class="grid gap-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Client split</div>
                <canvas id="jamiiTestingPrepDonut"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">PrEP coverage gauge</div>
                <canvas id="jamiiTestingPrepGauge"></canvas>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="text-base font-semibold text-slate-800">Programme highlights</div>
              <div class="text-sm text-slate-500">A quick read on momentum, continuity and the signals that link the treatment and testing workstreams.</div>
            </div>
            <button data-tab="jamii" class="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Refresh overview</button>
          </div>

          <div class="mt-4 grid gap-4 lg:grid-cols-3">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Continuity</div>
              <div class="mt-2 text-3xl font-bold text-slate-900">${serviceContinuity}%</div>
              <div class="mt-1 text-xs text-slate-600">New starts relative to active caseload</div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">HTS momentum</div>
              <div class="mt-2 text-3xl font-bold text-slate-900">${htsMomentum}%</div>
              <div class="mt-1 text-xs text-slate-600">Testing volume compared to treatment pool</div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Workload index</div>
              <div class="mt-2 text-3xl font-bold text-slate-900">${workloadIndex}%</div>
              <div class="mt-1 text-xs text-slate-600">Active caseload versus HTS capacity</div>
            </div>
          </div>

          <div class="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div class="text-sm font-semibold text-slate-700">Workload pressure</div>
              <div class="mt-3" style="height:220px"><canvas id="jamiiWorkloadPressureChart"></canvas></div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div class="text-sm font-semibold text-slate-700">Service readiness</div>
              <div class="mt-3" style="height:220px"><canvas id="jamiiWorkloadDonut"></canvas></div>
            </div>
          </div>
        </section>
      </div>
    `;

    container.querySelectorAll("[data-tab]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const tab = el.getAttribute("data-tab");
        if (!tab) return;
        if (tab === "jamii") {
          state.activePage = "jamii";
          setPageHash("jamii", "overview");
          renderCurrentView();
          return;
        }
        state.activePage = tab;
        setPageHash(tab);
        renderCurrentView();
      });
    });

    if (window.Chart) {
      const currentTrend = (txCurrTrend || []).map((p) => Number(p.value) || 0);
      const currentMale = (txCurrTrend || []).map((p) => Number(p.males) || 0);
      const currentFemale = (txCurrTrend || []).map(
        (p) => Number(p.females) || 0,
      );
      const currentChange = currentTrend.map((value, index) =>
        index === 0 ? 0 : value - currentTrend[index - 1],
      );
      const currentGaugeValue = Number(latestTxCurr)
        ? Math.min(100, Math.round((latestTxNew / latestTxCurr) * 100))
        : 0;

      const newTrend = (txNewTrend || []).map((p) => Number(p.value) || 0);
      const newMale = (txNewTrend || []).map((p) => Number(p.males) || 0);
      const newFemale = (txNewTrend || []).map((p) => Number(p.females) || 0);
      const newChange = newTrend.map((value, index) =>
        index === 0 ? 0 : value - newTrend[index - 1],
      );
      const newGaugeValue = Number(latestTxCurr)
        ? Math.min(100, Math.round((latestTxNew / latestTxCurr) * 100))
        : 0;

      const vlTrend = (vlJson.trend || []).map((p) => Number(p.vl_uptake) || 0);
      const vlRemaining = vlTrend.map((value) => Math.max(0, 100 - value));
      const vlGaugeValue = Number(latestVl.vl_uptake) || 0;

      const htsTestedValues = htsTrend.map((p) => Number(p.tested) || 0);
      const htsPositiveValues = htsTrend.map((p) => Number(p.positive) || 0);
      const htsNegativeValues = htsTrend.map(
        (p) => Math.max(0, Number(p.tested) - Number(p.positive)) || 0,
      );
      const htsUptakeGauge = htsMomentum;

      const linkageCategories = (linkageJson.trend || []).map((p) => p.label);
      const linkageAcceptedTrend = (linkageJson.trend || []).map(
        (p) => Number(p.index_accepted) || 0,
      );
      const linkageOfferedTrend = (linkageJson.trend || []).map(
        (p) => Number(p.index_offered) || 0,
      );
      const linkageGaugeValue = latestLinkage.index_offered
        ? Math.min(
            100,
            Math.round(
              (latestLinkage.index_accepted / latestLinkage.index_offered) *
                100,
            ),
          )
        : 0;

      const prepCategories = (prepJson.trend || []).map((p) => p.label);
      const prepCurrentTrend = (prepJson.trend || []).map(
        (p) => Number(p.prep_curr) || 0,
      );
      const prepNewTrend = (prepJson.trend || []).map(
        (p) => Number(p.prep_new) || 0,
      );
      const prepNew = Number(latestPrep.prep_new || 0);
      const prepSplitGauge =
        prepCurr + prepNew > 0
          ? Math.min(100, Math.round((prepCurr / (prepCurr + prepNew)) * 100))
          : 0;

      function drawGauge(canvasId, value, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        new Chart(canvas, {
          type: "doughnut",
          data: {
            labels: ["Value", "Remaining"],
            datasets: [
              {
                data: [value, Math.max(0, 100 - value)],
                backgroundColor: [color, "#e2e8f0"],
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "75%",
            circumference: Math.PI,
            rotation: -Math.PI,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.label}: ${ctx.parsed}%`,
                },
              },
            },
          },
        });
      }

      const currentLineCtx = document.getElementById(
        "jamiiTreatmentCurrentLine",
      );
      if (currentLineCtx) {
        new Chart(currentLineCtx, {
          type: "line",
          data: {
            labels: txCurrCategories,
            datasets: [
              {
                label: "TX_CURR",
                data: currentTrend,
                borderColor: "#7c3aed",
                backgroundColor: "rgba(124,58,237,0.12)",
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: "#7c3aed",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { maxRotation: -45, font: { size: 10 } } },
              y: { beginAtZero: true },
            },
          },
        });
      }

      const currentBarCtx = document.getElementById("jamiiTreatmentCurrentBar");
      if (currentBarCtx) {
        new Chart(currentBarCtx, {
          type: "bar",
          data: {
            labels: txCurrCategories,
            datasets: [
              {
                label: "Month change",
                data: currentChange,
                backgroundColor: currentChange.map((value) =>
                  value >= 0 ? "#7c3aed" : "#dc2626",
                ),
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: {
                grid: { display: false },
                ticks: { maxRotation: -45, font: { size: 10 } },
              },
              y: { beginAtZero: true },
            },
          },
        });
      }

      const currentDonutCtx = document.getElementById(
        "jamiiTreatmentCurrentDonut",
      );
      if (currentDonutCtx) {
        new Chart(currentDonutCtx, {
          type: "doughnut",
          data: {
            labels: ["Male", "Female"],
            datasets: [
              {
                data: [
                  currentMale[currentMale.length - 1] || 0,
                  currentFemale[currentFemale.length - 1] || 0,
                ],
                backgroundColor: ["#2563eb", "#ec4899"],
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: {
              legend: { position: "bottom", labels: { boxWidth: 12 } },
              tooltip: {
                callbacks: {
                  label: (ctx) =>
                    `${ctx.label}: ${ctx.parsed.toLocaleString()}`,
                },
              },
            },
          },
        });
      }

      drawGauge("jamiiTreatmentCurrentGauge", currentGaugeValue, "#7c3aed");

      const newLineCtx = document.getElementById("jamiiTreatmentNewLine");
      if (newLineCtx) {
        new Chart(newLineCtx, {
          type: "line",
          data: {
            labels: txNewCategories,
            datasets: [
              {
                label: "TX_NEW",
                data: newTrend,
                borderColor: "#2563eb",
                backgroundColor: "rgba(37,99,235,0.12)",
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: "#2563eb",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { maxRotation: -45, font: { size: 10 } } },
              y: { beginAtZero: true },
            },
          },
        });
      }

      const newBarCtx = document.getElementById("jamiiTreatmentNewBar");
      if (newBarCtx) {
        new Chart(newBarCtx, {
          type: "bar",
          data: {
            labels: txNewCategories,
            datasets: [
              {
                label: "TX_NEW",
                data: newTrend,
                backgroundColor: "#2563eb",
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: {
                grid: { display: false },
                ticks: { maxRotation: -45, font: { size: 10 } },
              },
              y: { beginAtZero: true },
            },
          },
        });
      }

      const newDonutCtx = document.getElementById("jamiiTreatmentNewDonut");
      if (newDonutCtx) {
        new Chart(newDonutCtx, {
          type: "doughnut",
          data: {
            labels: ["Male", "Female"],
            datasets: [
              {
                data: [
                  newMale[newMale.length - 1] || 0,
                  newFemale[newFemale.length - 1] || 0,
                ],
                backgroundColor: ["#0f766e", "#7c3aed"],
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: {
              legend: { position: "bottom", labels: { boxWidth: 12 } },
              tooltip: {
                callbacks: {
                  label: (ctx) =>
                    `${ctx.label}: ${ctx.parsed.toLocaleString()}`,
                },
              },
            },
          },
        });
      }

      drawGauge("jamiiTreatmentNewGauge", newGaugeValue, "#0f766e");

      const vlLineCtx = document.getElementById("jamiiTreatmentVlLine");
      if (vlLineCtx) {
        new Chart(vlLineCtx, {
          type: "line",
          data: {
            labels: txCurrCategories,
            datasets: [
              {
                label: "VL uptake",
                data: vlTrend,
                borderColor: "#16a34a",
                backgroundColor: "rgba(16,185,129,0.12)",
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: "#16a34a",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { maxRotation: -45, font: { size: 10 } } },
              y: { beginAtZero: true, ticks: { callback: (v) => `${v}%` } },
            },
          },
        });
      }

      const vlBarCtx = document.getElementById("jamiiTreatmentVlBar");
      if (vlBarCtx) {
        new Chart(vlBarCtx, {
          type: "bar",
          data: {
            labels: txCurrCategories,
            datasets: [
              {
                label: "VL uptake",
                data: vlTrend,
                backgroundColor: "#16a34a",
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: {
                grid: { display: false },
                ticks: { maxRotation: -45, font: { size: 10 } },
              },
              y: { beginAtZero: true, ticks: { callback: (v) => `${v}%` } },
            },
          },
        });
      }

      const vlDonutCtx = document.getElementById("jamiiTreatmentVlDonut");
      if (vlDonutCtx) {
        new Chart(vlDonutCtx, {
          type: "doughnut",
          data: {
            labels: ["Uptake", "Remaining"],
            datasets: [
              {
                data: [vlGaugeValue, Math.max(0, 100 - vlGaugeValue)],
                backgroundColor: ["#16a34a", "#d1fae5"],
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: {
              legend: { position: "bottom", labels: { boxWidth: 12 } },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.label}: ${ctx.parsed}%`,
                },
              },
            },
          },
        });
      }

      drawGauge("jamiiTreatmentVlGauge", vlGaugeValue, "#16a34a");

      const testingUptakeLineCtx = document.getElementById(
        "jamiiTestingUptakeLine",
      );
      if (testingUptakeLineCtx) {
        new Chart(testingUptakeLineCtx, {
          type: "line",
          data: {
            labels: htsCategories,
            datasets: [
              {
                label: "HTS tested",
                data: htsTestedValues,
                borderColor: "#0891b2",
                backgroundColor: "rgba(8,145,178,0.12)",
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: "#0891b2",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { maxRotation: -45, font: { size: 10 } } },
              y: { beginAtZero: true },
            },
          },
        });
      }

      const testingUptakeBarCtx = document.getElementById(
        "jamiiTestingUptakeBar",
      );
      if (testingUptakeBarCtx) {
        new Chart(testingUptakeBarCtx, {
          type: "bar",
          data: {
            labels: htsCategories,
            datasets: [
              {
                label: "HTS positive",
                data: htsPositiveValues,
                backgroundColor: "#dc2626",
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: {
                grid: { display: false },
                ticks: { maxRotation: -45, font: { size: 10 } },
              },
              y: { beginAtZero: true },
            },
          },
        });
      }

      const testingUptakeDonutCtx = document.getElementById(
        "jamiiTestingUptakeDonut",
      );
      if (testingUptakeDonutCtx) {
        new Chart(testingUptakeDonutCtx, {
          type: "doughnut",
          data: {
            labels: ["Positive", "Negative"],
            datasets: [
              {
                data: [
                  latestPositive,
                  Math.max(0, latestTested - latestPositive),
                ],
                backgroundColor: ["#dc2626", "#c7d2fe"],
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: {
              legend: { position: "bottom", labels: { boxWidth: 12 } },
              tooltip: {
                callbacks: {
                  label: (ctx) =>
                    `${ctx.label}: ${ctx.parsed.toLocaleString()}`,
                },
              },
            },
          },
        });
      }

      drawGauge("jamiiTestingUptakeGauge", htsUptakeGauge, "#0891b2");

      const testingLinkageLineCtx = document.getElementById(
        "jamiiTestingLinkageLine",
      );
      if (testingLinkageLineCtx) {
        new Chart(testingLinkageLineCtx, {
          type: "line",
          data: {
            labels: linkageCategories,
            datasets: [
              {
                label: "Accepted",
                data: linkageAcceptedTrend,
                borderColor: "#2563eb",
                backgroundColor: "rgba(37,99,235,0.12)",
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: "#2563eb",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { maxRotation: -45, font: { size: 10 } } },
              y: { beginAtZero: true },
            },
          },
        });
      }

      const testingLinkageBarCtx = document.getElementById(
        "jamiiTestingLinkageBar",
      );
      if (testingLinkageBarCtx) {
        new Chart(testingLinkageBarCtx, {
          type: "bar",
          data: {
            labels: linkageCategories,
            datasets: [
              {
                label: "Offered",
                data: linkageOfferedTrend,
                backgroundColor: "#0f766e",
                borderRadius: 6,
              },
              {
                label: "Accepted",
                data: linkageAcceptedTrend,
                backgroundColor: "#2563eb",
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } },
            scales: {
              x: {
                stacked: true,
                ticks: { maxRotation: -45, font: { size: 10 } },
              },
              y: { beginAtZero: true, stacked: true },
            },
          },
        });
      }

      const testingLinkageDonutCtx = document.getElementById(
        "jamiiTestingLinkageDonut",
      );
      if (testingLinkageDonutCtx) {
        new Chart(testingLinkageDonutCtx, {
          type: "doughnut",
          data: {
            labels: ["Accepted", "Declined"],
            datasets: [
              {
                data: [linkageAccepted, linkageDeclined],
                backgroundColor: ["#2563eb", "#c7d2fe"],
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: {
              legend: { position: "bottom", labels: { boxWidth: 12 } },
              tooltip: {
                callbacks: {
                  label: (ctx) =>
                    `${ctx.label}: ${ctx.parsed.toLocaleString()}`,
                },
              },
            },
          },
        });
      }

      drawGauge("jamiiTestingLinkageGauge", linkageGaugeValue, "#2563eb");

      const testingPrepLineCtx = document.getElementById(
        "jamiiTestingPrepLine",
      );
      if (testingPrepLineCtx) {
        new Chart(testingPrepLineCtx, {
          type: "line",
          data: {
            labels: prepCategories,
            datasets: [
              {
                label: "PrEP current",
                data: prepCurrentTrend,
                borderColor: "#16a34a",
                backgroundColor: "rgba(16,185,129,0.12)",
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: "#16a34a",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { maxRotation: -45, font: { size: 10 } } },
              y: { beginAtZero: true },
            },
          },
        });
      }

      const testingPrepBarCtx = document.getElementById("jamiiTestingPrepBar");
      if (testingPrepBarCtx) {
        new Chart(testingPrepBarCtx, {
          type: "bar",
          data: {
            labels: prepCategories,
            datasets: [
              {
                label: "PrEP current",
                data: prepCurrentTrend,
                backgroundColor: "#16a34a",
                borderRadius: 6,
              },
              {
                label: "PrEP new",
                data: prepNewTrend,
                backgroundColor: "#7c3aed",
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } },
            scales: {
              x: {
                stacked: true,
                ticks: { maxRotation: -45, font: { size: 10 } },
              },
              y: { beginAtZero: true, stacked: true },
            },
          },
        });
      }

      const testingPrepDonutCtx = document.getElementById(
        "jamiiTestingPrepDonut",
      );
      if (testingPrepDonutCtx) {
        new Chart(testingPrepDonutCtx, {
          type: "doughnut",
          data: {
            labels: ["Current", "New"],
            datasets: [
              {
                data: [prepCurr, prepNewTrend[prepNewTrend.length - 1] || 0],
                backgroundColor: ["#16a34a", "#7c3aed"],
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: {
              legend: { position: "bottom", labels: { boxWidth: 12 } },
              tooltip: {
                callbacks: {
                  label: (ctx) =>
                    `${ctx.label}: ${ctx.parsed.toLocaleString()}`,
                },
              },
            },
          },
        });
      }

      drawGauge("jamiiTestingPrepGauge", prepSplitGauge, "#16a34a");

      const workloadPressureCtx = document.getElementById(
        "jamiiWorkloadPressureChart",
      );
      if (workloadPressureCtx) {
        new Chart(workloadPressureCtx, {
          type: "line",
          data: {
            labels: htsCategories,
            datasets: [
              {
                label: "Positivity",
                data: htsPositivityValues,
                borderColor: "#f97316",
                backgroundColor: "rgba(249,115,22,0.14)",
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: "#f97316",
              },
              {
                label: "Service pressure",
                data: htsCategories.map(() => servicePressure),
                borderColor: "#0f766e",
                backgroundColor: "rgba(15,118,110,0.12)",
                fill: false,
                tension: 0.3,
                pointRadius: 2,
                pointBackgroundColor: "#0f766e",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } },
            scales: {
              x: { ticks: { maxRotation: -45, font: { size: 10 } } },
              y: { beginAtZero: true, ticks: { callback: (v) => v + "%" } },
            },
          },
        });
      }

      const workloadDonutCtx = document.getElementById("jamiiWorkloadDonut");
      if (workloadDonutCtx) {
        new Chart(workloadDonutCtx, {
          type: "doughnut",
          data: {
            labels: ["Pressure", "Headroom"],
            datasets: [
              {
                data: [servicePressure, Math.max(0, 100 - servicePressure)],
                backgroundColor: ["#f97316", "#e2e8f0"],
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: {
              legend: { position: "bottom", labels: { boxWidth: 12 } },
              tooltip: {
                callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}%` },
              },
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
    .chak-chart-card.full .chak-chart-container { height: 400px; }
    .chak-chart-container { position:relative; width:100%; height:280px; }
    .chak-page-info { margin-bottom:16px; }
    .chak-page-info h2 { font-size:16px; font-weight:700; color:#1f2937; }
    .chak-page-info p { font-size:12px; color:#6b7280; margin-top:2px; }
    .chak-section-title { font-size:14px; font-weight:700; color:#1f2937; margin:20px 0 10px 0; padding:8px 0 4px 0; border-bottom:2px solid #2563eb; display:flex; align-items:center; gap:8px; }
    .chak-section-title i { color:#2563eb; font-size:16px; }
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

// ── CHAK Highcharts Card (uses <div> instead of <canvas>) ──
function chakHighchartsCard(title, divId, extraClasses) {
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
    divId +
    '" title="AI Assist">' +
    '<svg class="chak-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/>' +
    '<circle cx="12" cy="20" r="2"/>' +
    "</svg>" +
    "</button>" +
    '<button class="chak-action-btn" data-chak-action="data" data-chart="' +
    divId +
    '" title="View Data">' +
    '<svg class="chak-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
    '<line x1="3" y1="9" x2="21" y2="9"/>' +
    '<line x1="9" y1="3" x2="9" y2="21"/>' +
    "</svg>" +
    "</button>" +
    '<button class="chak-action-btn" data-chak-action="download" data-chart="' +
    divId +
    '" title="Download PNG">' +
    '<svg class="chak-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
    '<polyline points="7 10 12 15 17 10"/>' +
    '<line x1="12" y1="15" x2="12" y2="3"/>' +
    "</svg>" +
    "</button>" +
    "</div>" +
    "</div>" +
    '<div class="chak-chart-container"><div id="' +
    divId +
    '"></div></div>' +
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
  var chartMeta = "";
  if (btn) {
    var card = btn.closest(".chak-chart-card");
    if (card) {
      var h3 = card.querySelector("h3");
      if (h3) chartTitle = h3.textContent;
    }
    // Collect filter context
    var county = (elements.countyFilter && elements.countyFilter.value) || "";
    var facility =
      (elements.facilityFilter && elements.facilityFilter.value) || "";
    var project =
      (elements.projectFilter && elements.projectFilter.value) || "";
    var parts = [];
    if (county && county !== "all") parts.push(county);
    if (facility && facility !== "all") parts.push(facility);
    if (project && project !== "all") parts.push(project);
    chartMeta = parts.join(" · ");
  }
  var chartId = canvas ? canvas.id : "";
  var html =
    '<p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Ask about <strong>' +
    escapeHtml(chartTitle || chartId) +
    "</strong>" +
    (chartMeta
      ? ' <span style="color:#94a3b8;">· Filtered: ' +
        escapeHtml(chartMeta) +
        "</span>"
      : "") +
    "</p>" +
    '<textarea id="chakAiInput" class="chak-ai-modal-input" rows="3" placeholder="e.g. What is the trend? Summarize the top values."></textarea>' +
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
          '<div style="display:flex;align-items:center;gap:8px;color:#6b7280;"><div style="width:16px;height:16px;border:2px solid #e0e7ff;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite;"></div> Querying data insights...</div>';
        submit.disabled = true;

        // Build a context-aware question
        var chartContext = chartTitle || chartId || "";
        var filterContext = chartMeta ? " Filters: " + chartMeta : "";
        var fullQuestion =
          "Regarding the chart '" +
          chartContext +
          "'" +
          filterContext +
          ". " +
          q;

        // Collect chart data for AI context
        var chartData = null;
        if (canvas) {
          var chart = chakChartInstances.find(function (c) {
            return c.canvas && c.canvas.id === canvas.id;
          });
          if (
            chart &&
            chart.data &&
            chart.data.labels &&
            chart.data.labels.length
          ) {
            chartData = {
              labels: chart.data.labels,
              datasets: chart.data.datasets.map(function (ds) {
                return { label: ds.label || "", data: ds.data || [] };
              }),
            };
          }
        }

        // Call the real /api/chat backend (Groq + SQL)
        fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: fullQuestion,
            chart_id: chartId,
            chart_data: chartData,
          }),
        })
          .then(function (res) {
            return res.json().then(function (data) {
              return { status: res.status, data: data };
            });
          })
          .then(function (result) {
            if (result.status !== 200 || result.data.error) {
              response.innerHTML =
                '<div style="color:#dc2626;font-size:13px;">' +
                (result.data.error ||
                  "Could not get insights for this chart.") +
                "</div>";
              submit.disabled = false;
              return;
            }
            response.innerHTML =
              '<div style="color:#374151;font-size:13px;line-height:1.6;">' +
              (result.data.answer_html ||
                result.data.summary ||
                "No insights available.") +
              "</div>";
            if (result.data.source) {
              var src = document.createElement("div");
              src.style.cssText =
                "margin-top:8px;font-size:11px;color:#94a3b8;";
              src.textContent = "Source: " + result.data.source;
              response.appendChild(src);
            }
            submit.disabled = false;
          })
          .catch(function () {
            response.innerHTML =
              '<div style="color:#dc2626;font-size:13px;">Network error. Try the main AI Assist chat instead.</div>';
            submit.disabled = false;
          });
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

// ── Chat navigation buttons (independent of AI) ──
document.addEventListener("click", function (e) {
  var btn = e.target.closest(".chat-nav-btn");
  if (!btn) return;
  var pageId = btn.getAttribute("data-nav");
  if (!pageId) return;

  // Navigate to the selected page
  state.activePage = pageId;
  var meta = getPageMeta(pageId);
  if (meta.subtabs && meta.subtabs.length) {
    if (!state.activeSubtabs[pageId])
      state.activeSubtabs[pageId] = toSlug(meta.subtabs[0]);
    setPageHash(pageId, state.activeSubtabs[pageId]);
  } else {
    setPageHash(pageId);
  }
  scrollToPageTop();
  renderCurrentView();

  // Close the chat after navigation
  closeChat();

  // Highlight the active button
  document.querySelectorAll(".chat-nav-btn").forEach(function (b) {
    b.classList.toggle("active", b.getAttribute("data-nav") === pageId);
  });
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
  var typologyLatest = trend[trend.length - 1] || {};
  var pbfwTotal = chakSum(trend, "prep_new_pbfw");
  var pregTotal = chakSum(trend, "prep_new_preg");
  var newTotal = chakSum(trend, "prep_new");

  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-shield"></i> PrEP Cascade</h2><p>PrEP screening, new initiations, current users, and typology breakdown</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">PrEP New (Cumulative)</div><div class="chak-kpi-value green">${chakFmt(newTotal)}</div><div class="chak-kpi-sub">Total new initiations</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">PrEP Current (Latest)</div><div class="chak-kpi-value blue">${chakFmt(chakLast(trend, "prep_curr"))}</div><div class="chak-kpi-sub">Active users (latest month)</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">PrEP Screened</div><div class="chak-kpi-value purple">${chakFmt(chakSum(trend, "prep_screened"))}</div><div class="chak-kpi-sub">Total screened for PrEP</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg % Uptake</div><div class="chak-kpi-value orange">${chakAvg(trend, "prep_uptake_pct")}%</div><div class="chak-kpi-sub">Screened → Initiated</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">PBFW New (Cumulative)</div><div class="chak-kpi-value" style="color:#db2777">${chakFmt(pbfwTotal)}</div><div class="chak-kpi-sub">${newTotal > 0 ? ((pbfwTotal / newTotal) * 100).toFixed(1) : 0}% of new</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Pregnant New (Cumulative)</div><div class="chak-kpi-value" style="color:#0d9488">${chakFmt(pregTotal)}</div><div class="chak-kpi-sub">${newTotal > 0 ? ((pregTotal / newTotal) * 100).toFixed(1) : 0}% of new</div></div>
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 PrEP Trend — New + Current (Combo)", "chakPrepTrend")}
      ${chakChartCard("🍩 PrEP New by Typology (Latest)", "chakPrepTypology")}
      ${chakChartCard("📊 PrEP Cascade — Screened · New · Current", "chakPrepCascade")}
      ${chakChartCard("📊 Typology Trend — PBFW vs Pregnant", "chakPrepTypologyTrend")}
      ${chakChartCard("📊 Typology % Over Time (100% Stacked)", "chakPrepStacked")}
      ${chakChartCard("📈 Screened + % Uptake (Combo)", "chakPrepScreenedCombo")}
      ${chakChartCard("📋 Detailed Monthly Data", "chakPrepDetail", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "prep_new", "prep_curr", "prep_screened", "prep_new_pbfw", "prep_new_preg", "prep_uptake_pct"], ["Month", "New", "Current", "Screened", "PBFW", "Pregnant", "% Uptake"])}`;
  el.setAttribute("data-chak-slug", "prep_page");
  _chakSetData("prep_page", data);

  // Chart 1: Combo — New bars + Current bars + % Uptake line
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

  // Chart 2: Typology donut (latest period)
  var typologyData = [
    { label: "PBFW", value: typologyLatest.prep_new_pbfw || 0 },
    { label: "Pregnant", value: typologyLatest.prep_new_preg || 0 },
  ];
  chakCreateChart(
    "chakPrepTypology",
    chakDonutChart(typologyData, [{ key: "value", label: "Type" }]),
  );

  // Chart 3: Cascade — Screened vs New vs Current (clustered)
  chakCreateChart("chakPrepCascade", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Screened",
          data: trend.map(function (d) {
            return d.prep_screened || 0;
          }),
          backgroundColor: CHAK_COLORS.purple + "80",
          borderRadius: 3,
        },
        {
          label: "PrEP New",
          data: trend.map(function (d) {
            return d.prep_new || 0;
          }),
          backgroundColor: CHAK_COLORS.green + "80",
          borderRadius: 3,
        },
        {
          label: "PrEP Current",
          data: trend.map(function (d) {
            return d.prep_curr || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "80",
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
      },
    },
  });

  // Chart 4: Typology trend — PBFW vs Pregnant (clustered)
  chakCreateChart("chakPrepTypologyTrend", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "PBFW",
          data: trend.map(function (d) {
            return d.prep_new_pbfw || 0;
          }),
          backgroundColor: CHAK_COLORS.pink + "80",
          borderRadius: 3,
        },
        {
          label: "Pregnant",
          data: trend.map(function (d) {
            return d.prep_new_preg || 0;
          }),
          backgroundColor: CHAK_COLORS.teal + "80",
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
      },
    },
  });

  // Chart 5: 100% stacked bar — PBFW vs Pregnant proportions over time
  chakCreateChart("chakPrepStacked", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "PBFW",
          data: trend.map(function (d) {
            var t = (d.prep_new_pbfw || 0) + (d.prep_new_preg || 0);
            return t > 0 ? (((d.prep_new_pbfw || 0) / t) * 100).toFixed(1) : 0;
          }),
          backgroundColor: CHAK_COLORS.pink + "cc",
        },
        {
          label: "Pregnant",
          data: trend.map(function (d) {
            var t = (d.prep_new_pbfw || 0) + (d.prep_new_preg || 0);
            return t > 0 ? (((d.prep_new_preg || 0) / t) * 100).toFixed(1) : 0;
          }),
          backgroundColor: CHAK_COLORS.teal + "cc",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return ctx.dataset.label + ": " + ctx.parsed.y.toFixed(1) + "%";
            },
          },
        },
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          max: 100,
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "% of New Initiations" },
        },
      },
    },
  });

  // Chart 6: Combo — Screened bars + % Uptake line
  chakCreateChart("chakPrepScreenedCombo", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Screened",
          data: trend.map(function (d) {
            return d.prep_screened || 0;
          }),
          backgroundColor: CHAK_COLORS.purple + "80",
          borderRadius: 3,
          order: 2,
        },
        {
          label: "% Uptake",
          data: trend.map(function (d) {
            return d.prep_uptake_pct || 0;
          }),
          type: "line",
          borderColor: CHAK_COLORS.orange,
          backgroundColor: CHAK_COLORS.orange + "20",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: CHAK_COLORS.orange,
          yAxisID: "y1",
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          position: "left",
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Screened" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          max: 100,
          grid: { display: false },
          title: { display: true, text: "% Uptake" },
        },
      },
    },
  });

  // Chart 7: Multi-line detail
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
  const modalityTrend = data.modality_trend || [];
  const kitsTrend = data.kits_trend || [];
  const latest = trend[trend.length - 1] || {};
  const linkedWithinTotal = chakSum(trend, "linked_within");
  const linkedOutsideTotal = chakSum(trend, "linked_outside");
  const totalLinkedTotal = linkedWithinTotal + linkedOutsideTotal;
  const linkedInPct =
    totalLinkedTotal > 0
      ? ((linkedWithinTotal / totalLinkedTotal) * 100).toFixed(1)
      : 0;

  // Modality display names & colors
  const MODALITY_KEYS = [
    "vct",
    "tb_clinic",
    "pitc_emergency",
    "pitc_inpatient",
    "pitc_pediatric",
    "sti_clinic",
    "malnutrition",
    "other_pitc",
  ];
  const MODALITY_LABELS = {
    vct: "VCT",
    tb_clinic: "TB Clinic",
    pitc_emergency: "PITC Emergency",
    pitc_inpatient: "PITC Inpatient",
    pitc_pediatric: "PITC Pediatric",
    sti_clinic: "STI Clinic",
    malnutrition: "Malnutrition",
    other_pitc: "Other PITC",
  };
  const MODALITY_COLORS = [
    "#2563eb",
    "#16a34a",
    "#dc2626",
    "#ea580c",
    "#9333ea",
    "#0891b2",
    "#ca8a04",
    "#6b7280",
  ];

  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-vial"></i> HTS Performance</h2><p>HIV Testing Services: tested, positive, linkage, yield, and TX_NEW</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Tested</div><div class="chak-kpi-value blue">${chakFmt(chakSum(trend, "tested"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Positive</div><div class="chak-kpi-value pink">${chakFmt(chakSum(trend, "positive"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Positivity Rate</div><div class="chak-kpi-value orange">${chakAvg(trend, "positivity_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Linkage Rate</div><div class="chak-kpi-value green">${chakAvg(trend, "linkage_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_NEW (Total)</div><div class="chak-kpi-value teal">${chakFmt(chakSum(trend, "tx_new"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Linked Within %</div><div class="chak-kpi-value" style="color:#16a34a">${linkedInPct}%</div><div class="chak-kpi-sub">${chakFmt(linkedWithinTotal)} of ${chakFmt(totalLinkedTotal)} linked</div></div>
    </div>

    <!-- ═══ PBIX-Style Charts ═══ -->
    <div class="chak-section-title"><i class="fas fa-table-cells-large"></i> PBIX-Style Analysis</div>
    <div class="chak-chart-grid">
      ${chakChartCard("📊 Modality Testing (Stacked)", "chakModalityStacked")}
      ${chakChartCard("📊 Test Kits Distributed", "chakKitsDistributed")}
      ${chakChartCard("📊 Cascade: Positive + TX_NEW + Linkage %", "chakPbixCascade")}
      ${chakChartCard("📊 Directly Assisted vs Unassisted", "chakAssistedChart")}
    </div>

    <!-- ═══ Existing Grid 1 ═══ -->
    <div class="chak-section-title"><i class="fas fa-chart-line"></i> Performance Overview</div>
    <div class="chak-chart-grid">
      ${chakChartCard("Tested + Positivity % (Combo)", "chakHtsCombo")}
      ${chakChartCard("Positive → Linked → TX_NEW", "chakHtsCascade")}
      ${chakChartCard("Linkage Breakdown", "chakHtsLinkage")}
      ${chakChartCard("Latest Funnel", "chakHtsFunnel")}
      ${chakChartCard("HTS Performance Detail", "chakHtsDetail", "full")}
    </div>

    <!-- ═══ Existing Grid 2 ═══ -->
    <div class="chak-section-title"><i class="fas fa-chart-mixed"></i> Advanced Analysis</div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 Linkage Mix — Within vs Outside (100% Stacked)", "chakHtsStackedLinkage")}
      ${chakChartCard("📊 Positive + Linkage % (Combo)", "chakHtsPosLinkCombo")}
      ${chakChartCard("📊 Tested + TX_NEW (Clustered Combo)", "chakHtsTestTxCombo")}
      ${chakChartCard("📊 Linkage Within Rate % (100% Stacked)", "chakHtsLnkStacked")}
      ${chakChartCard("📈 All HTS Metrics (Clustered Column)", "chakHtsClustered", "full")}
    </div>

    ${chakRenderTable(trend, ["label", "tested", "positive", "positivity_pct", "linked_within", "linked_outside", "total_linked", "linkage_pct", "tx_new"], ["Month", "Tested", "Positive", "% Pos", "Linked In", "Linked Out", "Total Linked", "% Linked", "TX_NEW"])}
  `;
  el.setAttribute("data-chak-slug", "hts-performance");
  _chakSetData("hts-performance", data);

  // ── PBIX-STYLE CHART 1: Modality Testing (Stacked Bar) ──
  if (modalityTrend.length > 0) {
    chakCreateChart("chakModalityStacked", {
      type: "bar",
      data: {
        labels: modalityTrend.map(function (d) {
          return d.label;
        }),
        datasets: MODALITY_KEYS.map(function (key, i) {
          return {
            label: MODALITY_LABELS[key],
            data: modalityTrend.map(function (d) {
              return d[key] || 0;
            }),
            backgroundColor: MODALITY_COLORS[i] + "cc",
            borderColor: MODALITY_COLORS[i],
            borderWidth: 0,
            borderRadius: 0,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 12, padding: 10, font: { size: 10 } },
          },
          tooltip: { mode: "index", intersect: false },
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, grid: { color: "#f0f0f0" } },
        },
      },
    });
  }

  // ── PBIX-STYLE CHART 2: Test Kits Distributed ──
  if (kitsTrend.length > 0) {
    chakCreateChart("chakKitsDistributed", {
      type: "bar",
      data: {
        labels: kitsTrend.map(function (d) {
          return d.label;
        }),
        datasets: [
          {
            label: "Directly Assisted",
            data: kitsTrend.map(function (d) {
              return d.directly_assisted || 0;
            }),
            backgroundColor: CHAK_COLORS.blue + "80",
            borderRadius: 3,
          },
          {
            label: "Unassisted",
            data: kitsTrend.map(function (d) {
              return d.unassisted || 0;
            }),
            backgroundColor: CHAK_COLORS.orange + "80",
            borderRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } },
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
        },
      },
    });
  }

  // ── PBIX-STYLE CHART 3: Cascade Combo (Positive+TX_NEW bars + Linkage% line) ──
  if (trend.length > 0) {
    chakCreateChart(
      "chakPbixCascade",
      chakLineClusteredColumnComboChart(
        trend,
        [
          {
            key: "positive",
            label: "Positive",
            color: CHAK_COLORS.pink + "80",
          },
          { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal + "80" },
        ],
        [{ key: "linkage_pct", label: "Linkage %", color: CHAK_COLORS.green }],
      ),
    );
  }

  // ── PBIX-STYLE CHART 4: Assisted vs Unassisted Summary ──
  if (kitsTrend.length > 0) {
    var totalAssisted = kitsTrend.reduce(function (a, d) {
      return a + (d.directly_assisted || 0);
    }, 0);
    var totalUnassisted = kitsTrend.reduce(function (a, d) {
      return a + (d.unassisted || 0);
    }, 0);
    chakCreateChart("chakAssistedChart", {
      type: "bar",
      data: {
        labels: ["Kits Distributed"],
        datasets: [
          {
            label: "Directly Assisted",
            data: [totalAssisted],
            backgroundColor: CHAK_COLORS.blue + "cc",
            borderRadius: 4,
          },
          {
            label: "Unassisted",
            data: [totalUnassisted],
            backgroundColor: CHAK_COLORS.orange + "cc",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } },
        },
        scales: {
          x: { beginAtZero: true, grid: { color: "#f0f0f0" } },
          y: { grid: { display: false } },
        },
      },
    });
  }

  // ── EXISTING CHART: Tested + Positivity % (Combo) ──
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

  // ── EXISTING CHART: Positive → Linked → TX_NEW ──
  chakCreateChart(
    "chakHtsCascade",
    chakBarChart(trend, [
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
      { key: "total_linked", label: "Total Linked", color: CHAK_COLORS.green },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
    ]),
  );

  // ── EXISTING CHART: Linkage Breakdown ──
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

  // ── EXISTING CHART: Latest Funnel ──
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

  // ── EXISTING CHART: HTS Performance Detail ──
  chakCreateChart(
    "chakHtsDetail",
    chakLineChart(trend, [
      { key: "linkage_pct", label: "% Linked", color: CHAK_COLORS.green },
      { key: "positivity_pct", label: "% Positive", color: CHAK_COLORS.orange },
    ]),
  );

  // ── EXISTING CHART: 100% Stacked — Linked Within vs Outside ──
  chakCreateChart(
    "chakHtsStackedLinkage",
    chak100PctStackedColumnChart(trend, [
      {
        key: "linked_within",
        label: "Linked Within",
        color: CHAK_COLORS.green + "cc",
      },
      {
        key: "linked_outside",
        label: "Linked Outside",
        color: CHAK_COLORS.orange + "cc",
      },
    ]),
  );

  // ── EXISTING CHART: Positive + Linkage % (Combo) ──
  chakCreateChart(
    "chakHtsPosLinkCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "positive", label: "Positive", color: CHAK_COLORS.pink + "80" }],
      [{ key: "linkage_pct", label: "% Linked", color: CHAK_COLORS.green }],
    ),
  );

  // ── EXISTING CHART: Tested + TX_NEW (Clustered Combo) ──
  chakCreateChart(
    "chakHtsTestTxCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "tested", label: "Tested", color: CHAK_COLORS.blue + "80" }],
      [{ key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal }],
    ),
  );

  // ── EXISTING CHART: Linkage Within Rate % (100% Stacked) ──
  chakCreateChart("chakHtsLnkStacked", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Linked Within",
          data: trend.map(function (d) {
            var t = (d.linked_within || 0) + (d.linked_outside || 0);
            return t > 0 ? (((d.linked_within || 0) / t) * 100).toFixed(1) : 0;
          }),
          backgroundColor: CHAK_COLORS.green + "cc",
        },
        {
          label: "Linked Outside",
          data: trend.map(function (d) {
            var t = (d.linked_within || 0) + (d.linked_outside || 0);
            return t > 0 ? (((d.linked_outside || 0) / t) * 100).toFixed(1) : 0;
          }),
          backgroundColor: CHAK_COLORS.orange + "cc",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return ctx.dataset.label + ": " + ctx.parsed.y.toFixed(1) + "%";
            },
          },
        },
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          max: 100,
          beginAtZero: true,
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "% of Linked" },
        },
      },
    },
  });

  // ── EXISTING CHART: All HTS Metrics (Clustered Column) ──
  chakCreateChart("chakHtsClustered", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Tested",
          data: trend.map(function (d) {
            return d.tested || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "60",
          borderRadius: 3,
        },
        {
          label: "Positive",
          data: trend.map(function (d) {
            return d.positive || 0;
          }),
          backgroundColor: CHAK_COLORS.pink + "60",
          borderRadius: 3,
        },
        {
          label: "Linked",
          data: trend.map(function (d) {
            return d.total_linked || 0;
          }),
          backgroundColor: CHAK_COLORS.green + "60",
          borderRadius: 3,
        },
        {
          label: "TX_NEW",
          data: trend.map(function (d) {
            return d.tx_new || 0;
          }),
          backgroundColor: CHAK_COLORS.teal + "60",
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
      },
    },
  });
});

// ── HTS Index ──
registerChakRenderer("hts-index-testing", "hts-index", function (el, data) {
  const trend = data.trend || [];
  var testedSum = chakSum(trend, "tested");
  var posSum = chakSum(trend, "positive");
  var linkedSum = chakSum(trend, "linked");
  var yieldPct = testedSum > 0 ? ((posSum / testedSum) * 100).toFixed(1) : 0;
  var linkageRate = posSum > 0 ? ((linkedSum / posSum) * 100).toFixed(1) : 0;
  var linkageGap = posSum > 0 ? posSum - linkedSum : 0;

  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-users"></i> HTS Index Testing</h2><p>Index testing cascade: ${chakFmt(testedSum)} tested → ${chakFmt(posSum)} positive (${yieldPct}%) → ${chakFmt(linkedSum)} linked (${linkageRate}%)</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Tested</div><div class="chak-kpi-value blue">${chakFmt(testedSum)}</div><div class="chak-kpi-sub">Index clients tested</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Positive</div><div class="chak-kpi-value pink">${chakFmt(posSum)}</div><div class="chak-kpi-sub">${yieldPct}% yield</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Linked</div><div class="chak-kpi-value green">${chakFmt(linkedSum)}</div><div class="chak-kpi-sub">${linkageRate}% linkage rate</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Linkage Gap</div><div class="chak-kpi-value" style="color:#dc2626">${chakFmt(linkageGap)}</div><div class="chak-kpi-sub">Positive not yet linked</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg Yield</div><div class="chak-kpi-value orange">${yieldPct}%</div><div class="chak-kpi-sub">Yield rate (Avg)</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg Linkage</div><div class="chak-kpi-value green">${linkageRate}%</div><div class="chak-kpi-sub">Linkage rate (Avg)</div></div>
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 Tested + % Positive (Combo)", "chakIndexCombo")}
      ${chakChartCard("📊 Positive → Linked Cascade", "chakIndexCascade")}
      ${chakChartCard("📊 Monthly Testing Breakdown", "chakIndexClustered")}
      ${chakChartCard("📈 Trend: % Positive & % Linked", "chakIndexTrend", "full")}
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 Positive + Linkage % (Combo)", "chakIndexPosLinkCombo")}
      ${chakChartCard("📊 Tested vs Positive (100% Stacked)", "chakIndexStackedYield")}
      ${chakChartCard("📊 Tested + Linked (Clustered)", "chakIndexTestLinked")}
      ${chakChartCard("📊 Yield & Linkage Detail", "chakIndexDetail", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tested", "positive", "positivity_pct", "linked", "linkage_pct"], ["Month", "Tested", "Positive", "% Positive", "Linked", "% Linked"])}
    `;
  el.setAttribute("data-chak-slug", "hts-index-testing");
  _chakSetData("hts-index-testing", data);

  // Chart 1: Combo - Tested bars + % positive line
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

  // Chart 2: Cascade bars
  chakCreateChart(
    "chakIndexCascade",
    chakBarChart(trend, [
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
      { key: "linked", label: "Linked", color: CHAK_COLORS.green },
    ]),
  );

  // Chart 3: Clustered monthly breakdown
  chakCreateChart("chakIndexClustered", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Tested",
          data: trend.map(function (d) {
            return d.tested || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "60",
          borderRadius: 3,
        },
        {
          label: "Positive",
          data: trend.map(function (d) {
            return d.positive || 0;
          }),
          backgroundColor: CHAK_COLORS.pink + "60",
          borderRadius: 3,
        },
        {
          label: "Linked",
          data: trend.map(function (d) {
            return d.linked || 0;
          }),
          backgroundColor: CHAK_COLORS.green + "60",
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
      },
    },
  });

  // Chart 4: Dual-line trend
  chakCreateChart(
    "chakIndexTrend",
    chakLineChart(trend, [
      { key: "positivity_pct", label: "% Positive", color: CHAK_COLORS.orange },
      { key: "linkage_pct", label: "% Linked", color: CHAK_COLORS.green },
    ]),
  );

  // ── PBIX-style: Positive bars + Linkage% line (combo) ──
  chakCreateChart(
    "chakIndexPosLinkCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "positive", label: "Positive", color: CHAK_COLORS.pink + "80" }],
      [{ key: "linkage_pct", label: "% Linked", color: CHAK_COLORS.green }],
    ),
  );

  // ── PBIX-style: 100% Stacked — Tested vs Positive (showing yield %) ──
  chakCreateChart(
    "chakIndexStackedYield",
    chak100PctStackedColumnChart(trend, [
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink + "cc" },
      { key: "tested", label: "Not Positive", color: CHAK_COLORS.blue + "40" },
    ]),
  );

  // ── PBIX-style: Tested + Linked clustered columns ──
  chakCreateChart("chakIndexTestLinked", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Tested",
          data: trend.map(function (d) {
            return d.tested || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "60",
          borderRadius: 3,
        },
        {
          label: "Linked",
          data: trend.map(function (d) {
            return d.linked || 0;
          }),
          backgroundColor: CHAK_COLORS.green + "60",
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
      },
    },
  });

  // ── Detail multi-line ──
  chakCreateChart(
    "chakIndexDetail",
    chakLineChart(trend, [
      { key: "tested", label: "Tested", color: CHAK_COLORS.blue },
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
      { key: "linked", label: "Linked", color: CHAK_COLORS.green },
    ]),
  );
});

// ── SNS Cascade ──
registerChakRenderer("sns-cascade", "sns-cascade", function (el, data) {
  const trend = data.trend || [];
  const latest = trend[trend.length - 1] || {};
  var snsPosSum = chakSum(trend, "sns_pos");
  var linkedSum = chakSum(trend, "linked");
  var txNewSum = chakSum(trend, "tx_new");
  var linkagePct =
    snsPosSum > 0 ? ((linkedSum / snsPosSum) * 100).toFixed(1) : 0;
  var txNewPct = linkedSum > 0 ? ((txNewSum / linkedSum) * 100).toFixed(1) : 0;

  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-share-nodes"></i> SNS Cascade</h2><p>Social Network Strategy: contacts elicited, tested, positive, linked — ${chakFmt(snsPosSum)} positive, ${chakFmt(linkedSum)} linked</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">SNS Positive (Total)</div><div class="chak-kpi-value pink">${chakFmt(snsPosSum)}</div><div class="chak-kpi-sub">Total identified through SNS</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Linked</div><div class="chak-kpi-value green">${chakFmt(linkedSum)}</div><div class="chak-kpi-sub">${linkagePct}% linkage rate</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_NEW (Total)</div><div class="chak-kpi-value teal">${chakFmt(txNewSum)}</div><div class="chak-kpi-sub">${txNewPct}% of linked started ART</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Linkage Rate</div><div class="chak-kpi-value green">${linkagePct}%</div><div class="chak-kpi-sub">SNS Positive → Linked</div></div>
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📈 SNS Cascade Trend", "chakSnsTrend")}
      ${chakChartCard("📊 SNS → Linked → TX_NEW", "chakSnsBar")}
      ${chakChartCard("📊 Monthly SNS Breakdown (Clustered)", "chakSnsClustered")}
      ${chakChartCard("📈 SNS Positive + Linkage% (Combo)", "chakSnsCombo")}
      ${chakChartCard("📋 SNS Cascade Detail", "chakSnsDetail", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "sns_pos", "linked", "tx_new"], ["Month", "SNS Positive", "Linked", "TX_NEW"])}
    `;
  el.setAttribute("data-chak-slug", "sns-cascade");
  _chakSetData("sns-cascade", data);

  // Chart 1: Line trend
  chakCreateChart(
    "chakSnsTrend",
    chakLineChart(trend, [
      { key: "sns_pos", label: "SNS Positive", color: CHAK_COLORS.pink },
      { key: "linked", label: "Linked", color: CHAK_COLORS.green },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
    ]),
  );

  // Chart 2: Bar chart
  chakCreateChart(
    "chakSnsBar",
    chakBarChart(trend, [
      { key: "sns_pos", label: "SNS Positive", color: CHAK_COLORS.pink },
      { key: "linked", label: "Linked", color: CHAK_COLORS.green },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
    ]),
  );

  // Chart 3: Clustered column — monthly breakdown
  chakCreateChart("chakSnsClustered", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "SNS Positive",
          data: trend.map(function (d) {
            return d.sns_pos || 0;
          }),
          backgroundColor: CHAK_COLORS.pink + "80",
          borderRadius: 3,
        },
        {
          label: "Linked",
          data: trend.map(function (d) {
            return d.linked || 0;
          }),
          backgroundColor: CHAK_COLORS.green + "80",
          borderRadius: 3,
        },
        {
          label: "TX_NEW",
          data: trend.map(function (d) {
            return d.tx_new || 0;
          }),
          backgroundColor: CHAK_COLORS.teal + "80",
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
      },
    },
  });

  // Chart 4: Combo — SNS Positive bars + linkage % line
  chakCreateChart("chakSnsCombo", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "SNS Positive",
          data: trend.map(function (d) {
            return d.sns_pos || 0;
          }),
          backgroundColor: CHAK_COLORS.pink + "80",
          borderRadius: 3,
          order: 2,
        },
        {
          label: "Linkage %",
          data: trend.map(function (d) {
            var sp = d.sns_pos || 0;
            return sp > 0 ? (((d.linked || 0) / sp) * 100).toFixed(1) : 0;
          }),
          type: "line",
          borderColor: CHAK_COLORS.green,
          backgroundColor: CHAK_COLORS.green + "20",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: CHAK_COLORS.green,
          yAxisID: "y1",
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          position: "left",
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Positive" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          max: 100,
          grid: { display: false },
          title: { display: true, text: "Linkage %" },
        },
      },
    },
  });

  // Chart 5: Detail line
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
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 Donut: Latest ART Status", "chakCtDonut")}
      ${chakChartCard("📊 Stacked Combo: TX_CURR + TX_NEW", "chakCtStackedCombo")}
      ${chakChartCard("📊 TX_NEW vs IIT (100% Stacked)", "chakCt100NewIit")}
      ${chakChartCard("📊 RTT + IIT Detail", "chakCtRttIit", "full")}
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
  // ── PBIX-style: Donut chart — Latest ART Status ──
  var ctDonutData = [
    { label: "TX_CURR", value: latest.tx_curr || 0 },
    { label: "TX_NEW", value: latest.tx_new || 0 },
    { label: "IIT (ML)", value: latest.tx_ml || 0 },
    { label: "TX_RTT", value: latest.tx_rtt || 0 },
  ];
  if (
    ctDonutData.some(function (d) {
      return d.value > 0;
    })
  ) {
    chakCreateChart(
      "chakCtDonut",
      chakDonutChart(ctDonutData, [{ key: "value", label: "Count" }]),
    );
  }
  // ── PBIX-style: Stacked Combo — TX_CURR stacked bars + TX_NEW line ──
  chakCreateChart(
    "chakCtStackedCombo",
    chakLineStackedColumnComboChart(
      trend,
      [
        { key: "tx_curr", label: "TX_CURR", color: CHAK_COLORS.blue + "80" },
        { key: "tx_ml", label: "IIT", color: CHAK_COLORS.red + "60" },
      ],
      [{ key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.green }],
    ),
  );
  // ── PBIX-style: 100% Stacked — TX_NEW vs IIT proportion ──
  chakCreateChart(
    "chakCt100NewIit",
    chak100PctStackedColumnChart(trend, [
      {
        key: "tx_new",
        label: "TX_NEW (New on ART)",
        color: CHAK_COLORS.green + "cc",
      },
      { key: "tx_ml", label: "IIT (Lost)", color: CHAK_COLORS.red + "cc" },
    ]),
  );
  // ── PBIX-style: TX_RTT vs IIT clustered detail ──
  chakCreateChart("chakCtRttIit", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "TX_ML (IIT)",
          data: trend.map(function (d) {
            return d.tx_ml || 0;
          }),
          backgroundColor: CHAK_COLORS.red + "60",
          borderRadius: 3,
        },
        {
          label: "TX_RTT (RTT)",
          data: trend.map(function (d) {
            return d.tx_rtt || 0;
          }),
          backgroundColor: CHAK_COLORS.purple + "60",
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
      },
    },
  });
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
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 CD4 + TPT (Combo)", "chakCd4ExtraCombo")}
      ${chakChartCard("📊 CD4 100% Stacked", "chakCd4Stacked")}
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
  // ── PBIX-style: CD4 combo — bars + TPT uptake line ──
  chakCreateChart(
    "chakCd4ExtraCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [
        { key: "cd4_less200", label: "CD4<200", color: CHAK_COLORS.red + "80" },
        {
          key: "cd4_more200",
          label: "CD4>=200",
          color: CHAK_COLORS.green + "80",
        },
      ],
      [
        {
          key: "tpt_uptake_pct",
          label: "TPT Uptake %",
          color: CHAK_COLORS.blue,
        },
      ],
    ),
  );
  // ── PBIX-style: 100% Stacked — CD4 categories per period ──
  chakCreateChart(
    "chakCd4Stacked",
    chak100PctStackedColumnChart(trend, [
      { key: "cd4_less200", label: "CD4<200", color: CHAK_COLORS.red + "cc" },
      {
        key: "cd4_more200",
        label: "CD4>=200",
        color: CHAK_COLORS.green + "cc",
      },
      {
        key: "cd4_unknown",
        label: "Unknown",
        color: CHAK_COLORS.orange + "60",
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
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 VL Done vs Suppressed (100%)", "chakVl100Stacked")}
      ${chakChartCard("📊 Eligible + % Suppression (Combo)", "chakVlEligCombo")}
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
  // ── PBIX-style: 100% Stacked — VL cascade proportions ──
  chakCreateChart(
    "chakVl100Stacked",
    chak100PctStackedColumnChart(trend, [
      { key: "pvls_done", label: "Done", color: CHAK_COLORS.orange + "cc" },
      {
        key: "pvls_suppressed",
        label: "Suppressed",
        color: CHAK_COLORS.green + "cc",
      },
    ]),
  );
  // ── PBIX-style: Eligible bars + Suppression% line (combo) ──
  chakCreateChart(
    "chakVlEligCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [
        {
          key: "pvls_eligible",
          label: "Eligible",
          color: CHAK_COLORS.purple + "80",
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
  const pmtctKp = chakSum(trend, "anc1_known_pos");
  const pmtctNewPos = chakSum(trend, "anc1_new_pos");
  const pmtctTotalPos = chakSum(trend, "total_pos");
  const pmtctStartedArt = chakSum(trend, "started_art");

  // ── Preserved existing content (hidden from UI, not removed) ──
  const existingHtml = `
    <div style="display:none" aria-hidden="true">
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
      </div>
    </div>`;

  // ── New PMTCT Cascade UI ──
  el.innerHTML =
    existingHtml +
    `
    <div class="chak-page-info" style="margin-top:0">
      <h2><i class="fas fa-baby"></i> PMTCT Cascade · Jamii Tekelezi</h2>
      <p>Prevention of Mother-to-Child Transmission: Entry-to-Treatment cascade — 1st ANC → Tested → Positive → Total on ART</p>
    </div>

    <!-- Step 1–2: Baseline & Testing -->
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❶ 1st ANC Attendances</div>
        <div class="chak-kpi-value blue">0</div>
        <div class="chak-kpi-sub">Total ANC 1 visits (universe of pregnant women)</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❷ KP (Known Positive at Entry)</div>
        <div class="chak-kpi-value pink">${chakFmt(pmtctKp)}</div>
        <div class="chak-kpi-sub">Known HIV+ before this ANC visit</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❸ Tested for HIV at ANC</div>
        <div class="chak-kpi-value teal">0</div>
        <div class="chak-kpi-sub">Unknown status women who accepted testing</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❹ New Pos (Newly Tested +)</div>
        <div class="chak-kpi-value red">${chakFmt(pmtctNewPos)}</div>
        <div class="chak-kpi-sub">Newly diagnosed HIV+ during this visit</div>
      </div>
    </div>

    <!-- Step 3–5: Burden & Treatment -->
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card" style="border-left:4px solid #ea580c">
        <div class="chak-kpi-label">❺ Total HIV Positive Pregnant</div>
        <div class="chak-kpi-value orange">${chakFmt(pmtctTotalPos)}</div>
        <div class="chak-kpi-sub">KP + New Pos = <strong>${chakFmt(pmtctTotalPos)}</strong> (total burden)</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❻ Already on ART</div>
        <div class="chak-kpi-value purple">0</div>
        <div class="chak-kpi-sub">Known positives already on treatment</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❼ ART New (Newly Initiated)</div>
        <div class="chak-kpi-value" style="color:#0891b2">${chakFmt(pmtctStartedArt)}</div>
        <div class="chak-kpi-sub">Newly started ART this visit</div>
      </div>
      <div class="chak-kpi-card" style="border-left:4px solid #16a34a">
        <div class="chak-kpi-label">❽ Total on Maternal ART</div>
        <div class="chak-kpi-value green">${chakFmt(pmtctStartedArt)}</div>
        <div class="chak-kpi-sub">Already ART + ART New = <strong>${chakFmt(pmtctStartedArt)}</strong> ← GOAL</div>
      </div>
    </div>

    <!-- Cascade Charts (7) — Top: Full horizontal cascade, 4 detail charts + donut + 100% stacked -->
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakHighchartsCard("📊 PMTCT All-Indicators Cascade — Full Flow (Horizontal)", "chakPmtctTopCascade", "full")}
      ${chakChartCard("📊 PMTCT Cascade — 1st ANC → Tested → Positive → Total on ART", "chakPmtctCascade1")}
      ${chakChartCard("📊 ANC Testing Coverage — 1st ANC · Tested · Not Tested", "chakPmtctCascade2")}
      ${chakChartCard("📊 HIV Positive Breakdown — Total Positive · KP · New Pos", "chakPmtctCascade3")}
      ${chakChartCard("📊 ART Uptake — Total on ART · Already ART · ART New", "chakPmtctCascade4")}
      ${chakChartCard("🍩 HIV+ Composition — Known Pos vs New Pos (Donut)", "chakPmtctDonut")}
      ${chakChartCard("📊 ART Coverage Distribution (100% Stacked Bar)", "chakPmtctStacked")}
    </div>

    <!-- Cascade Description -->
    <div class="chak-chart-card full" style="margin-top:4px">
      <div class="chak-chart-header"><h3>🔍 How to read this cascade</h3></div>
      <div style="font-size:12px;color:#4b5563;line-height:1.7">
        <p><strong>Step 1 (Baseline):</strong> <code>1st ANC</code> — All pregnant women attending first ANC visit. <code>KP</code> = known HIV+ at entry.</p>
        <p><strong>Step 2 (Testing):</strong> <code>Tested</code> = women tested for HIV. <code>New Pos</code> = newly diagnosed positive.</p>
        <p><strong>Step 3 (Burden):</strong> <code>Positive</code> = <code>KP</code> + <code>New Pos</code> — total HIV+ pregnant women.</p>
        <p><strong>Step 4 (Treatment):</strong> <code>Already ART</code> + <code>ART New</code> = women on ART.</p>
        <p><strong>Step 5 (Goal):</strong> <code>ART Uptake</code> = <code>Already ART</code> + <code>ART New</code>. <span style="color:#16a34a;font-weight:600">Target: 100% of Positive = on ART.</span></p>
        <p style="margin-top:6px;color:#6b7280;font-size:11px"><strong>Charts:</strong> ① Full cascade (horizontal, all indicators) · ② Cascade (stepped) · ③ Testing coverage (1st ANC, Tested, Not Tested) · ④ Positive breakdown (Total, KP, New Pos) · ⑤ ART uptake (Total, Already, New)</p>
        <p style="margin-top:4px;color:#ea580c;font-weight:500">ℹ️ ❶ 1st ANC, ❸ Tested, ❻ Already ART show 0 — awaiting additional DHIS data fields. All other values are wired from available data.</p>
      </div>
    </div>`;

  el.setAttribute("data-chak-slug", "pmtct");
  _chakSetData("pmtct", data);

  // ── Chart 1: PMTCT Cascade (1st ANC → Tested → Positive → Total on ART) ──
  chakCreateChart("chakPmtctCascade1", {
    type: "bar",
    data: {
      labels: ["1st ANC", "Tested", "Positive (KP+New)", "Total on ART"],
      datasets: [
        {
          label: "Patients",
          data: [0, 0, pmtctTotalPos, pmtctStartedArt],
          backgroundColor: ["#2563eb", "#0d9488", "#ea580c", "#16a34a"],
          borderRadius: 4,
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
            label: function (ctx) {
              const labels = [
                "Total ANC 1 visits (universe)",
                "Tested for HIV at ANC",
                "KP + New Pos (total HIV+)",
                "Already ART + ART New (goal)",
              ];
              return (
                (ctx.raw || 0).toLocaleString() +
                " — " +
                (labels[ctx.dataIndex] || "")
              );
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: "bold", size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Patients" },
        },
      },
    },
  });

  // ── Chart 2: ANC Testing Coverage (1st ANC · Tested · Not Tested) ──
  chakCreateChart("chakPmtctCascade2", {
    type: "bar",
    data: {
      labels: ["1st ANC", "Tested", "Not Tested"],
      datasets: [
        {
          label: "Patients",
          data: [0, 0, 0],
          backgroundColor: ["#2563eb", "#0d9488", "#94a3b8"],
          borderRadius: 4,
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
            label: function (ctx) {
              const labels = [
                "Total ANC 1 visits",
                "Tested for HIV at ANC",
                "1st ANC − Tested (not tested)",
              ];
              return (
                (ctx.raw || 0).toLocaleString() +
                " — " +
                (labels[ctx.dataIndex] || "")
              );
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: "bold", size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Patients" },
        },
      },
    },
  });

  // ── Chart 3: HIV Positive Breakdown (Total Positive · KP · New Pos) ──
  chakCreateChart("chakPmtctCascade3", {
    type: "bar",
    data: {
      labels: ["Total Positive", "KP (Known Pos)", "New Pos"],
      datasets: [
        {
          label: "Patients",
          data: [pmtctTotalPos, pmtctKp, pmtctNewPos],
          backgroundColor: ["#ea580c", "#db2777", "#dc2626"],
          borderRadius: 4,
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
            label: function (ctx) {
              const labels = [
                "KP + New Pos (total HIV+ burden)",
                "Known HIV+ before ANC visit",
                "Newly diagnosed HIV+ at this visit",
              ];
              return (
                (ctx.raw || 0).toLocaleString() +
                " — " +
                (labels[ctx.dataIndex] || "")
              );
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: "bold", size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Patients" },
        },
      },
    },
  });

  // ── Chart 4: ART Uptake (Total on ART · Already ART · ART New) ──
  chakCreateChart("chakPmtctCascade4", {
    type: "bar",
    data: {
      labels: ["Total on ART", "Already ART", "ART New"],
      datasets: [
        {
          label: "Patients",
          data: [pmtctStartedArt, 0, pmtctStartedArt],
          backgroundColor: ["#16a34a", "#9333ea", "#0891b2"],
          borderRadius: 4,
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
            label: function (ctx) {
              const labels = [
                "Already ART + ART New (treatment goal)",
                "Known positives already on ART",
                "Newly initiated on ART",
              ];
              return (
                (ctx.raw || 0).toLocaleString() +
                " — " +
                (labels[ctx.dataIndex] || "")
              );
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: "bold", size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Patients" },
        },
      },
    },
  });

  // ── TOP CASCADE: Horizontal bar showing ALL 8 indicators ──
  setTimeout(function () {
    const topEl = document.getElementById("chakPmtctTopCascade");
    if (!topEl) return;
    // Compute cascade values
    const anc1 = 0; // 1st ANC — not yet in DHIS data
    const knownPos = pmtctKp;
    const tested = 0; // Tested — not yet in DHIS data
    const newPos = pmtctNewPos;
    const totalPos = pmtctTotalPos;
    const alreadyArt = 0; // Already ART — not yet in DHIS data
    const artNew = pmtctStartedArt;
    const totalArt = pmtctStartedArt; // Total on ART = Already ART + ART New

    Highcharts.chart("chakPmtctTopCascade", {
      chart: { type: "bar", height: 380 },
      title: {
        text: "PMTCT Cascade — All Indicators (Horizontal)",
        style: { fontSize: "14px", fontWeight: "bold" },
      },
      subtitle: {
        text: "Antenatal HIV cascade from entry to treatment · Flow: Step ❶ → Step ❽",
        style: { fontSize: "11px", color: "#6b7280" },
      },
      xAxis: {
        categories: [
          "❶ 1st ANC",
          "❷ KP at Entry",
          "❸ Tested",
          "❹ New Positive",
          "❺ Total Positive",
          "❻ Already on ART",
          "❼ ART New",
          "❽ Total on ART",
        ],
        labels: { style: { fontSize: "11px", fontWeight: "bold" } },
        title: {
          text: "Cascade Step",
          style: { fontSize: "11px", color: "#4b5563" },
        },
      },
      yAxis: {
        title: {
          text: "Patients (Count)",
          style: { fontSize: "11px", color: "#4b5563" },
        },
        min: 0,
        gridLineColor: "#f0f0f0",
      },
      tooltip: {
        shared: true,
        formatter: function () {
          const descs = [
            "Total ANC 1 visits (universe)",
            "Known HIV+ before this ANC visit",
            "Unknown status women who accepted testing",
            "Newly diagnosed HIV+ during this visit",
            "KP + New Pos (total HIV+ burden)",
            "Known positives already on treatment",
            "Newly started ART this visit",
            "Already ART + ART New (goal)",
          ];
          const pt = this.points?.[0];
          if (!pt) return "";
          const i = pt.point.index;
          return (
            "<b>" +
            pt.category +
            "</b><br/>" +
            (pt.y || 0).toLocaleString() +
            " — " +
            (descs[i] || "")
          );
        },
      },
      plotOptions: {
        series: {
          groupPadding: 0.08,
          borderRadius: 3,
          dataLabels: {
            enabled: true,
            formatter: function () {
              return this.y > 0 ? Highcharts.numberFormat(this.y, 0) : "—";
            },
            style: { fontSize: "10px", fontWeight: "bold" },
          },
        },
      },
      legend: { enabled: false },
      colors: [
        "#2563eb",
        "#db2777",
        "#0d9488",
        "#dc2626",
        "#ea580c",
        "#9333ea",
        "#0891b2",
        "#16a34a",
      ],
      series: [
        {
          name: "Patients",
          data: [
            anc1,
            knownPos,
            tested,
            newPos,
            totalPos,
            alreadyArt,
            artNew,
            totalArt,
          ],
        },
      ],
    });
  }, 100);

  // ── PBIX-style Chart: Donut — HIV+ Composition (Known Pos vs New Pos) ──
  chakCreateChart("chakPmtctDonut", {
    type: "doughnut",
    data: {
      labels: ["Known Positive (KP at Entry)", "New Positive (Tested at ANC)"],
      datasets: [
        {
          data: [pmtctKp, pmtctNewPos],
          backgroundColor: ["#db2777", "#ea580c"],
          borderWidth: 2,
          borderColor: "#fff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "55%",
      plugins: {
        legend: {
          position: "right",
          labels: {
            boxWidth: 14,
            padding: 12,
            font: { size: 12, weight: "bold" },
          },
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const total = ctx.dataset.data.reduce(function (a, b) {
                return a + b;
              }, 0);
              const pct =
                total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
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
  });

  // ── PBIX-style Chart: 100% Stacked Bar — ART Coverage Distribution ──
  const pmtctStackedLabels = [
    "KP (Known +)",
    "New Positive",
    "Total HIV+",
    "Started ART",
    "Not on ART",
  ];
  const pmtctNotOnArt = Math.max(0, pmtctTotalPos - pmtctStartedArt);
  const pmtctStackedData = [
    pmtctKp,
    pmtctNewPos,
    pmtctTotalPos,
    pmtctStartedArt,
    pmtctNotOnArt,
  ];
  const maxVal = Math.max(...pmtctStackedData, 1);
  chakCreateChart("chakPmtctStacked", {
    type: "bar",
    data: {
      labels: pmtctStackedLabels,
      datasets: [
        {
          label: "% of Max",
          data: pmtctStackedData.map(function (v) {
            return ((v / maxVal) * 100).toFixed(1);
          }),
          backgroundColor: [
            "#db2777",
            "#ea580c",
            "#9333ea",
            "#16a34a",
            "#dc2626",
          ],
          borderRadius: 3,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          min: 0,
          max: 100,
          title: { display: true, text: "% of Maximum Value" },
          grid: { color: "#f0f0f0" },
        },
        y: {
          grid: { display: false },
          ticks: { font: { weight: "bold", size: 10 } },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const raw = pmtctStackedData[ctx.dataIndex];
              return (
                (raw || 0).toLocaleString() +
                " patients (" +
                ctx.parsed.x.toFixed(1) +
                "%)"
              );
            },
          },
        },
      },
    },
  });
});

// ── TB ──
// ── TB ──
registerChakRenderer("tb", "tb", function (el, data) {
  const trend = data.trend || [];

  // ── Preserved existing content (hidden from UI, not removed) ──
  const existingHtml = `
    <div style="display:none" aria-hidden="true">
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
      </div>
    </div>`;

  // Compute dynamic KPIs
  const totScreened = chakSum(trend, "tb_screened");
  const totPos = chakSum(trend, "tb_pos");
  const totOnArt = chakSum(trend, "tb_on_art");
  const notPositive = Math.max(0, totScreened - totPos);
  const notOnArt = Math.max(0, totPos - totOnArt);
  const posPct = chakAvg(trend, "tb_positivity_pct");
  const artPct = chakAvg(trend, "tb_art_uptake_pct");

  el.innerHTML =
    existingHtml +
    `
    <div class="chak-page-info" style="margin-top:0">
      <h2><i class="fas fa-lungs"></i> TB Cascade · Screening → Diagnosis → ART Integration</h2>
      <p>TB screening-to-treatment cascade: Everyone screened → confirmed TB+ → linked to ART</p>
    </div>

    <!-- Row 1: Screening & Diagnosis -->
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❶ TB Screened</div>
        <div class="chak-kpi-value blue">${chakFmt(totScreened)}</div>
        <div class="chak-kpi-sub">Total TB screening encounters (universe)</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❷ TB Positive</div>
        <div class="chak-kpi-value red">${chakFmt(totPos)}</div>
        <div class="chak-kpi-sub">Confirmed bacteriologically positive</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❸ Positivity Rate</div>
        <div class="chak-kpi-value orange">${posPct}%</div>
        <div class="chak-kpi-sub">% of screened that tested positive</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❹ Not Positive</div>
        <div class="chak-kpi-value" style="color:#94a3b8">${chakFmt(notPositive)}</div>
        <div class="chak-kpi-sub">Screened but negative (Screened − Positive)</div>
      </div>
    </div>

    <!-- Row 2: ART Integration -->
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card" style="border-left:4px solid #ea580c">
        <div class="chak-kpi-label">❺ TB on ART</div>
        <div class="chak-kpi-value purple">${chakFmt(totOnArt)}</div>
        <div class="chak-kpi-sub">TB patients on ART (treatment integration)</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❻ ART Uptake</div>
        <div class="chak-kpi-value green">${artPct}%</div>
        <div class="chak-kpi-sub">% of TB+ patients on ART</div>
      </div>
      <div class="chak-kpi-card" style="border-left:4px solid #dc2626">
        <div class="chak-kpi-label">❼ Not on ART</div>
        <div class="chak-kpi-value" style="color:#dc2626">${chakFmt(notOnArt)}</div>
        <div class="chak-kpi-sub">TB+ not on ART (gap − <strong>target: 0</strong>)</div>
      </div>
      <div class="chak-kpi-card" style="border-left:4px solid #16a34a">
        <div class="chak-kpi-label">❽ Treatment Gap Closed</div>
        <div class="chak-kpi-value" style="color:#16a34a">${totPos > 0 ? Math.round((totOnArt / totPos) * 100) : 0}%</div>
        <div class="chak-kpi-sub">% of TB+ on ART (on ART ÷ Positive)</div>
      </div>
    </div>

    <!-- Cascade Charts (7) — Top: Full horizontal cascade, 4 detail charts + 2 PBIX-style combo charts -->
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakHighchartsCard("📊 TB All-Indicators Cascade — Full Flow (Horizontal)", "chakTbTopCascade", "full")}
      ${chakChartCard("📊 TB Cascade — Screened → TB+ → On ART", "chakTbCascade1")}
      ${chakChartCard("📊 Screening Outcome — Screened · Positive · Not Positive", "chakTbCascade2")}
      ${chakChartCard("📊 Treatment Gap — TB+ · On ART · Not on ART", "chakTbCascade3")}
      ${chakChartCard("📊 ART Integration — TB+ · On ART · Uptake %", "chakTbCascade4")}
      ${chakChartCard("📈 Monthly TB Trend — Screened + % Positivity (Combo)", "chakTbTrendCombo")}
      ${chakChartCard("📊 Monthly TB by Outcome (Clustered)", "chakTbMonthly")}
    </div>

    <!-- Cascade Description -->
    <div class="chak-chart-card full" style="margin-top:4px">
      <div class="chak-chart-header"><h3>🔍 How to read this cascade</h3></div>
      <div style="font-size:12px;color:#4b5563;line-height:1.7">
        <p><strong>Step 1 (Screening):</strong> <code>TB Screened</code> — All patients screened for TB (universe). <code>Positivity Rate</code> = % who test positive.</p>
        <p><strong>Step 2 (Diagnosis):</strong> <code>TB Positive</code> = confirmed bacteriologically. <code>Not Positive</code> = screened but negative.</p>
        <p><strong>Step 3 (ART Integration):</strong> <code>TB on ART</code> = TB+ patients on antiretroviral therapy. <code>Not on ART</code> = the treatment gap.</p>
        <p><strong>Step 4 (Goal):</strong> 100% of TB+ patients on ART. <span style="color:#16a34a;font-weight:600">Target: Gap = 0, ART Uptake = 100%.</span></p>
        <p style="margin-top:6px;color:#6b7280;font-size:11px"><strong>Charts:</strong> ① Full cascade (horizontal, all indicators) · ② Cascade (stepped) · ③ Screening outcome (Screened, Positive, Not Positive) · ④ Treatment gap (TB+, On ART, Not on ART) · ⑤ ART integration (TB+, On ART, Uptake %)</p>
      </div>
    </div>`;

  el.setAttribute("data-chak-slug", "tb");
  _chakSetData("tb", data);

  // ── Chart 1: TB Cascade (Screened → TB+ → On ART) ──
  chakCreateChart("chakTbCascade1", {
    type: "bar",
    data: {
      labels: ["TB Screened", "TB Positive", "On ART"],
      datasets: [
        {
          label: "Patients",
          data: [totScreened, totPos, totOnArt],
          backgroundColor: ["#2563eb", "#dc2626", "#9333ea"],
          borderRadius: 4,
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
            label: function (ctx) {
              const labels = [
                "Total TB screening encounters",
                "Confirmed TB positive",
                "TB patients on ART",
              ];
              return (
                (ctx.raw || 0).toLocaleString() +
                " — " +
                (labels[ctx.dataIndex] || "")
              );
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: "bold", size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Patients" },
        },
      },
    },
  });

  // ── Chart 2: Screening Outcome (Screened · Positive · Not Positive) ──
  chakCreateChart("chakTbCascade2", {
    type: "bar",
    data: {
      labels: ["TB Screened", "TB Positive", "Not Positive"],
      datasets: [
        {
          label: "Patients",
          data: [totScreened, totPos, notPositive],
          backgroundColor: ["#2563eb", "#dc2626", "#94a3b8"],
          borderRadius: 4,
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
            label: function (ctx) {
              const labels = [
                "Total TB screening encounters",
                "Confirmed TB positive",
                "Screened − Positive (negative)",
              ];
              return (
                (ctx.raw || 0).toLocaleString() +
                " — " +
                (labels[ctx.dataIndex] || "")
              );
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: "bold", size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Patients" },
        },
      },
    },
  });

  // ── Chart 3: Treatment Gap (TB+ · On ART · Not on ART) ──
  chakCreateChart("chakTbCascade3", {
    type: "bar",
    data: {
      labels: ["TB Positive", "On ART", "Not on ART"],
      datasets: [
        {
          label: "Patients",
          data: [totPos, totOnArt, notOnArt],
          backgroundColor: ["#ea580c", "#9333ea", "#dc2626"],
          borderRadius: 4,
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
            label: function (ctx) {
              const labels = [
                "Confirmed TB positive (total)",
                "TB patients on ART",
                "TB+ not on ART (gap)",
              ];
              return (
                (ctx.raw || 0).toLocaleString() +
                " — " +
                (labels[ctx.dataIndex] || "")
              );
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: "bold", size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Patients" },
        },
      },
    },
  });

  // ── Chart 4: ART Integration (TB+ · On ART · Uptake %) ──
  // Mixed: bars for counts + line for %
  chakCreateChart("chakTbCascade4", {
    type: "bar",
    data: {
      labels: ["TB Positive", "On ART", "ART Uptake"],
      datasets: [
        {
          label: "Patients",
          data: [
            totPos,
            totOnArt,
            totPos > 0 ? Math.round((totOnArt / totPos) * 100) : 0,
          ],
          backgroundColor: ["#ea580c", "#16a34a", "#0891b2"],
          borderRadius: 4,
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
            label: function (ctx) {
              const labels = [
                "Confirmed TB positive (total)",
                "TB patients on ART",
                "ART uptake % among TB+",
              ];
              return (
                (ctx.raw || 0).toLocaleString() +
                " — " +
                (labels[ctx.dataIndex] || "")
              );
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: "bold", size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Patients / %" },
        },
      },
    },
  });

  // ── TOP CASCADE: Horizontal bar showing ALL 8 TB indicators ──
  const totPresumptive = chakSum(trend, "tb_presumptive");
  setTimeout(function () {
    const topEl = document.getElementById("chakTbTopCascade");
    if (!topEl) return;

    Highcharts.chart("chakTbTopCascade", {
      chart: { type: "bar", height: 380 },
      title: {
        text: "TB Cascade — All Indicators (Horizontal)",
        style: { fontSize: "14px", fontWeight: "bold" },
      },
      subtitle: {
        text: "TB screening-to-treatment cascade · Flow: Step ❶ → Step ❽",
        style: { fontSize: "11px", color: "#6b7280" },
      },
      xAxis: {
        categories: [
          "❶ TB Screened",
          "❷ TB Presumptive",
          "❸ TB Positive",
          "❹ Not Positive",
          "❺ TB on ART",
          "❻ ART Uptake %",
          "❼ Not on ART",
          "❽ Gap Closed %",
        ],
        labels: { style: { fontSize: "11px", fontWeight: "bold" } },
        title: {
          text: "Cascade Step",
          style: { fontSize: "11px", color: "#4b5563" },
        },
      },
      yAxis: {
        title: {
          text: "Patients / Percentage",
          style: { fontSize: "11px", color: "#4b5563" },
        },
        min: 0,
        gridLineColor: "#f0f0f0",
      },
      tooltip: {
        shared: true,
        formatter: function () {
          const descs = [
            "Total TB screening encounters (universe)",
            "TB presumptive cases identified",
            "Confirmed TB bacteriologically positive",
            "Screened but negative (Screened − Positive)",
            "TB patients on ART (treatment integration)",
            "% of TB+ patients on ART",
            "TB+ not on ART (gap — target: 0)",
            "% of TB+ on ART (on ART ÷ Positive)",
          ];
          const pt = this.points?.[0];
          if (!pt) return "";
          const i = pt.point.index;
          return (
            "<b>" +
            pt.category +
            "</b><br/>" +
            (pt.y || 0).toLocaleString() +
            " — " +
            (descs[i] || "")
          );
        },
      },
      plotOptions: {
        series: {
          groupPadding: 0.08,
          borderRadius: 3,
          dataLabels: {
            enabled: true,
            formatter: function () {
              if (this.y === 0) return "—";
              return [5, 7].includes(this.point.index)
                ? this.y + "%"
                : Highcharts.numberFormat(this.y, 0);
            },
            style: { fontSize: "10px", fontWeight: "bold" },
          },
        },
      },
      legend: { enabled: false },
      colors: [
        "#2563eb",
        "#0d9488",
        "#dc2626",
        "#94a3b8",
        "#9333ea",
        "#16a34a",
        "#dc2626",
        "#16a34a",
      ],
      series: [
        {
          name: "Patients",
          data: [
            totScreened,
            totPresumptive,
            totPos,
            notPositive,
            totOnArt,
            artPct,
            notOnArt,
            totPos > 0 ? Math.round((totOnArt / totPos) * 100) : 0,
          ],
        },
      ],
    });
  }, 100);

  // ── PBIX-style Combo Chart: Monthly TB Screened + % Positivity ──
  chakCreateChart("chakTbTrendCombo", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "TB Screened",
          data: trend.map(function (d) {
            return d.tb_screened || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "80",
          borderRadius: 3,
          order: 2,
        },
        {
          label: "TB Positive",
          data: trend.map(function (d) {
            return d.tb_pos || 0;
          }),
          backgroundColor: CHAK_COLORS.red + "80",
          borderRadius: 3,
          order: 2,
        },
        {
          label: "% Positivity",
          data: trend.map(function (d) {
            return d.tb_positivity_pct || 0;
          }),
          type: "line",
          borderColor: CHAK_COLORS.orange,
          backgroundColor: CHAK_COLORS.orange + "20",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: CHAK_COLORS.orange,
          yAxisID: "y1",
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          position: "left",
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Patients" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          max: 100,
          grid: { display: false },
          title: { display: true, text: "% Positivity" },
        },
      },
    },
  });

  // ── PBIX-style Clustered Column: Monthly TB breakdown ──
  chakCreateChart("chakTbMonthly", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Screened",
          data: trend.map(function (d) {
            return d.tb_screened || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "80",
          borderRadius: 3,
        },
        {
          label: "Presumptive",
          data: trend.map(function (d) {
            return d.tb_presumptive || 0;
          }),
          backgroundColor: CHAK_COLORS.teal + "80",
          borderRadius: 3,
        },
        {
          label: "Positive",
          data: trend.map(function (d) {
            return d.tb_pos || 0;
          }),
          backgroundColor: CHAK_COLORS.red + "80",
          borderRadius: 3,
        },
        {
          label: "On ART",
          data: trend.map(function (d) {
            return d.tb_on_art || 0;
          }),
          backgroundColor: CHAK_COLORS.purple + "80",
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
      },
    },
  });
});

// ── Post Rape ──
registerChakRenderer("post_rape", "post-rape", function (el, data) {
  const trend = data.trend || [];
  const peSum = chakSum(trend, "physical_emotional");
  const svSum = chakSum(trend, "sexual_violence");
  const totSum = chakSum(trend, "total");
  const pePct = totSum > 0 ? ((peSum / totSum) * 100).toFixed(1) : 0;
  const svPct = totSum > 0 ? ((svSum / totSum) * 100).toFixed(1) : 0;

  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-hand"></i> POST RESP (Post-Rape Care)</h2><p>Post-rape care services: physical/emotional, sexual violence — ${chakFmt(totSum)} total cases</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Physical/Emotional</div><div class="chak-kpi-value orange">${chakFmt(peSum)}</div><div class="chak-kpi-sub">${pePct}% of total</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Sexual Violence</div><div class="chak-kpi-value pink">${chakFmt(svSum)}</div><div class="chak-kpi-sub">${svPct}% of total</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Cases</div><div class="chak-kpi-value purple">${chakFmt(totSum)}</div><div class="chak-kpi-sub">Combined total</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">SV % of Total</div><div class="chak-kpi-value" style="color:#db2777">${svPct}%</div><div class="chak-kpi-sub">Sexual violence share</div></div>
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📈 POST RESP Trend — Monthly Cases", "chakPostRapeTrend")}
      ${chakChartCard("📊 Violence Type Breakdown — PE vs SV", "chakPostRapeBreakdown")}
      ${chakChartCard("📈 Cases with % SV Share (Combo)", "chakPostRapeCombo")}
      ${chakChartCard("📊 Monthly Cases by Type (Stacked Column)", "chakPostRapeStacked")}
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 PE vs SV (100% Stacked)", "chakPostRape100Stacked")}
      ${chakChartCard("🍩 Latest Violence Distribution", "chakPostRapeDonut")}
      ${chakChartCard("📊 Physical/Emotional + SV% (Combo)", "chakPostRapeExtraCombo", "full")}
    </div>`;
  el.setAttribute("data-chak-slug", "post_rape");
  _chakSetData("post_rape", data);

  // Chart 1: Line Trend
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

  // Chart 2: Clustered column — PE vs SV per period
  chakCreateChart("chakPostRapeBreakdown", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Physical/Emotional",
          data: trend.map(function (d) {
            return d.physical_emotional || 0;
          }),
          backgroundColor: CHAK_COLORS.orange + "cc",
          borderRadius: 3,
        },
        {
          label: "Sexual Violence",
          data: trend.map(function (d) {
            return d.sexual_violence || 0;
          }),
          backgroundColor: CHAK_COLORS.pink + "cc",
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
      },
    },
  });

  // Chart 3: Combo — Total bar + SV % line
  chakCreateChart("chakPostRapeCombo", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Total Cases",
          data: trend.map(function (d) {
            return d.total || 0;
          }),
          backgroundColor: CHAK_COLORS.purple + "80",
          borderRadius: 3,
          order: 2,
        },
        {
          label: "SV % Share",
          data: trend.map(function (d) {
            var t = d.total || 0;
            return t > 0
              ? (((d.sexual_violence || 0) / t) * 100).toFixed(1)
              : 0;
          }),
          type: "line",
          borderColor: CHAK_COLORS.pink,
          backgroundColor: CHAK_COLORS.pink + "20",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: CHAK_COLORS.pink,
          yAxisID: "y1",
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          position: "left",
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Cases" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          max: 100,
          grid: { display: false },
          title: { display: true, text: "SV %" },
        },
      },
    },
  });

  // Chart 4: Stacked column — PE + SV per period
  chakCreateChart("chakPostRapeStacked", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Physical/Emotional",
          data: trend.map(function (d) {
            return d.physical_emotional || 0;
          }),
          backgroundColor: CHAK_COLORS.orange + "cc",
        },
        {
          label: "Sexual Violence",
          data: trend.map(function (d) {
            return d.sexual_violence || 0;
          }),
          backgroundColor: CHAK_COLORS.pink + "cc",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, grid: { color: "#f0f0f0" } },
      },
    },
  });
  // ── PBIX-style: 100% Stacked — PE vs SV ──
  chakCreateChart(
    "chakPostRape100Stacked",
    chak100PctStackedColumnChart(trend, [
      {
        key: "physical_emotional",
        label: "Physical/Emotional",
        color: CHAK_COLORS.orange + "cc",
      },
      {
        key: "sexual_violence",
        label: "Sexual Violence",
        color: CHAK_COLORS.pink + "cc",
      },
    ]),
  );
  // ── PBIX-style: Donut — Latest distribution ──
  var prLatest = trend[trend.length - 1] || {};
  var prDonutData = [
    { label: "Physical/Emotional", value: prLatest.physical_emotional || 0 },
    { label: "Sexual Violence", value: prLatest.sexual_violence || 0 },
  ];
  if (
    prDonutData.some(function (d) {
      return d.value > 0;
    })
  ) {
    chakCreateChart(
      "chakPostRapeDonut",
      chakDonutChart(prDonutData, [{ key: "value", label: "Count" }]),
    );
  }
  // ── PBIX-style: PE bars + SV% line (combo) ──
  chakCreateChart(
    "chakPostRapeExtraCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [
        {
          key: "physical_emotional",
          label: "Physical/Emotional",
          color: CHAK_COLORS.orange + "80",
        },
      ],
      [
        {
          key: "sexual_violence",
          label: "Sexual Violence",
          color: CHAK_COLORS.pink,
        },
      ],
    ),
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
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📈 CACX Cascade — Screened · Positive · Treated", "chakCacxCascade")}
      ${chakChartCard("📊 % Positivity & Treatment Rate", "chakCacxPct")}
      ${chakChartCard("📊 Monthly Screening by Outcome (Clustered)", "chakCacxMonthly")}
      ${chakChartCard("📈 Screening with % Positivity (Combo)", "chakCacxCombo")}
      ${chakChartCard("📋 Detailed Monthly CACX Data", "chakCacxDetail", "full")}
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 Pos vs Treated (100% Stacked)", "chakCacx100Stacked")}
      ${chakChartCard("🍩 Latest CACX Distribution", "chakCacxDonut")}
      ${chakChartCard("📊 Positive + % Treated (Combo)", "chakCacxPosTreatCombo")}
    </div>`;
  el.setAttribute("data-chak-slug", "cacx");
  _chakSetData("cacx", data);

  // Chart 1: Line — Cascade
  chakCreateChart(
    "chakCacxCascade",
    chakLineChart(trend, [
      { key: "screened", label: "Screened", color: CHAK_COLORS.blue },
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
      { key: "treated", label: "Treated", color: CHAK_COLORS.green },
    ]),
  );

  // Chart 2: Line — % rates
  chakCreateChart(
    "chakCacxPct",
    chakLineChart(trend, [
      { key: "positivity_pct", label: "% Positive", color: CHAK_COLORS.orange },
      { key: "treatment_pct", label: "% Treated", color: CHAK_COLORS.purple },
    ]),
  );

  // Chart 3: Clustered column — Monthly breakdown
  chakCreateChart("chakCacxMonthly", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Screened",
          data: trend.map(function (d) {
            return d.screened || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "cc",
          borderRadius: 3,
        },
        {
          label: "Positive",
          data: trend.map(function (d) {
            return d.positive || 0;
          }),
          backgroundColor: CHAK_COLORS.pink + "cc",
          borderRadius: 3,
        },
        {
          label: "Treated",
          data: trend.map(function (d) {
            return d.treated || 0;
          }),
          backgroundColor: CHAK_COLORS.green + "cc",
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
      },
    },
  });

  // Chart 4: Combo — Screened bars + % Positivity line
  chakCreateChart("chakCacxCombo", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Screened",
          data: trend.map(function (d) {
            return d.screened || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "80",
          borderRadius: 3,
          order: 2,
        },
        {
          label: "% Positive",
          data: trend.map(function (d) {
            return d.positivity_pct || 0;
          }),
          type: "line",
          borderColor: CHAK_COLORS.orange,
          backgroundColor: CHAK_COLORS.orange + "20",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: CHAK_COLORS.orange,
          yAxisID: "y1",
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          position: "left",
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Screened" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          max: 100,
          grid: { display: false },
          title: { display: true, text: "% Positive" },
        },
      },
    },
  });

  // Chart 5: Monthly data table (full-width)
  setTimeout(function () {
    var tblEl = document.getElementById("chakCacxDetail");
    if (!tblEl) return;
    var html =
      '<div style="overflow-x:auto;max-height:400px;overflow-y:auto"><table class="chak-data-table" style="width:100%;font-size:11px"><thead><tr><th>Month</th><th>Screened</th><th>Positive</th><th>Treated</th><th>% Positive</th><th>% Treated</th></tr></thead><tbody>';
    trend.forEach(function (r) {
      html +=
        "<tr><td>" +
        (r.label || "") +
        "</td><td>" +
        chakFmt(r.screened || 0) +
        "</td><td>" +
        chakFmt(r.positive || 0) +
        "</td><td>" +
        chakFmt(r.treated || 0) +
        "</td><td>" +
        (r.positivity_pct || 0).toFixed(1) +
        "%</td><td>" +
        (r.treatment_pct || 0).toFixed(1) +
        "%</td></tr>";
    });
    html += "</tbody></table></div>";
    tblEl.innerHTML = html;
  }, 50);
  // ── PBIX-style: 100% Stacked — Positive vs Treated proportions ──
  chakCreateChart(
    "chakCacx100Stacked",
    chak100PctStackedColumnChart(trend, [
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink + "cc" },
      { key: "treated", label: "Treated", color: CHAK_COLORS.green + "cc" },
    ]),
  );
  // ── PBIX-style: Donut — Latest CACX distribution ──
  var cacxLatest = trend[trend.length - 1] || {};
  var cacxDonutData = [
    { label: "Screened", value: cacxLatest.screened || 0 },
    { label: "Positive", value: cacxLatest.positive || 0 },
    { label: "Treated", value: cacxLatest.treated || 0 },
  ];
  if (
    cacxDonutData.some(function (d) {
      return d.value > 0;
    })
  ) {
    chakCreateChart(
      "chakCacxDonut",
      chakDonutChart(cacxDonutData, [{ key: "value", label: "Count" }]),
    );
  }
  // ── PBIX-style: Positive bars + Treatment% line (combo) ──
  chakCreateChart(
    "chakCacxPosTreatCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "positive", label: "Positive", color: CHAK_COLORS.pink + "80" }],
      [{ key: "treatment_pct", label: "% Treated", color: CHAK_COLORS.purple }],
    ),
  );
});

// ── IIT Quarterly ──
registerChakRenderer("iit-quarterly", "iit-quarterly", function (el, data) {
  const trend = data.trend || [];
  var iitPctAvg = chakAvg(trend, "iit_pct");
  var totIit = chakSum(trend, "tx_ml");
  var latestTxCurr = chakLast(trend, "tx_curr");
  var latestIit = chakLast(trend, "tx_ml");
  var latestIitPct = chakLast(trend, "iit_pct");

  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-triangle-exclamation"></i> IIT Quarterly</h2><p>Interruption in Treatment: Patients lost to follow-up vs TX_CURR — Avg ${iitPctAvg}% IIT rate</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card" style="border-left:4px solid #dc2626"><div class="chak-kpi-label">Avg IIT Rate</div><div class="chak-kpi-value red">${iitPctAvg}%</div><div class="chak-kpi-sub">Average over period</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total IIT (Lost)</div><div class="chak-kpi-value orange">${chakFmt(totIit)}</div><div class="chak-kpi-sub">Cumulative lost to follow-up</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Latest TX_CURR</div><div class="chak-kpi-value blue">${chakFmt(latestTxCurr)}</div><div class="chak-kpi-sub">Currently on ART</div></div>
      <div class="chak-kpi-card" style="border-left:4px solid #dc2626"><div class="chak-kpi-label">Latest IIT</div><div class="chak-kpi-value red">${chakFmt(latestIit)}</div><div class="chak-kpi-sub">${latestIitPct}% of TX_CURR</div></div>
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 IIT Count + % (Combo)", "chakIitCombo")}
      ${chakChartCard("📊 IIT % Rate by Period", "chakIitBar")}
      ${chakChartCard("📊 IIT vs TX_CURR (Dual Axis)", "chakIitDual")}
      ${chakChartCard("📈 IIT Trend", "chakIitTrend", "full")}
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 TX_CURR vs IIT (100% Stacked)", "chakIit100Stacked")}
      ${chakChartCard("🍩 Latest ART Status", "chakIitDonut")}
    </div>
    ${chakRenderTable(trend, ["label", "tx_curr", "tx_ml", "iit_pct"], ["Month", "TX_CURR", "IIT", "% IIT"])}
    `;
  el.setAttribute("data-chak-slug", "iit-quarterly");
  _chakSetData("iit-quarterly", data);

  // Chart 1: Combo — IIT count bar + % line
  chakCreateChart(
    "chakIitCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "tx_ml", label: "TX_ML (IIT)", color: CHAK_COLORS.red + "80" }],
      [{ key: "iit_pct", label: "% IIT", color: CHAK_COLORS.orange }],
    ),
  );

  // Chart 2: IIT % bar
  chakCreateChart(
    "chakIitBar",
    chakBarChart(trend, [
      { key: "iit_pct", label: "% IIT", color: CHAK_COLORS.red },
    ]),
  );

  // Chart 3: Dual axis — TX_CURR bars + IIT count line
  chakCreateChart("chakIitDual", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "TX_CURR",
          data: trend.map(function (d) {
            return d.tx_curr || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "60",
          borderRadius: 3,
          order: 2,
        },
        {
          label: "IIT Count",
          data: trend.map(function (d) {
            return d.tx_ml || 0;
          }),
          type: "line",
          borderColor: CHAK_COLORS.red,
          backgroundColor: CHAK_COLORS.red + "20",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: CHAK_COLORS.red,
          yAxisID: "y1",
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          position: "left",
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "TX_CURR" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          grid: { display: false },
          title: { display: true, text: "IIT Count" },
        },
      },
    },
  });

  // Chart 4: Line trend
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
  // ── PBIX-style: 100% Stacked — TX_CURR vs IIT ──
  chakCreateChart(
    "chakIit100Stacked",
    chak100PctStackedColumnChart(trend, [
      { key: "tx_ml", label: "IIT (Lost)", color: CHAK_COLORS.red + "cc" },
      {
        key: "tx_curr",
        label: "TX_CURR (Active)",
        color: CHAK_COLORS.blue + "cc",
      },
    ]),
  );
  // ── PBIX-style: Donut — Latest ART status (Active vs IIT) ──
  var iitLatest = trend[trend.length - 1] || {};
  var iitDonutData = [
    { label: "TX_CURR (Active)", value: iitLatest.tx_curr || 0 },
    { label: "IIT (Lost)", value: iitLatest.tx_ml || 0 },
  ];
  if (
    iitDonutData.some(function (d) {
      return d.value > 0;
    })
  ) {
    chakCreateChart(
      "chakIitDonut",
      chakDonutChart(iitDonutData, [{ key: "value", label: "Count" }]),
    );
  }
});

// ── HTS Summary ──
registerChakRenderer("hts-summary", "hts-summary", function (el, data) {
  const trend = data.trend || [];
  var posSum = chakSum(trend, "positive");
  var txNewSum = chakSum(trend, "tx_new");
  var txNewPct = posSum > 0 ? ((txNewSum / posSum) * 100).toFixed(1) : 0;

  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-microscope"></i> HTS Summary</h2><p>HIV Testing Services high-level summary — ${chakFmt(txNewSum)} started ART (${txNewPct}% of positive)</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Tested</div><div class="chak-kpi-value blue">${chakFmt(chakSum(trend, "tested"))}</div><div class="chak-kpi-sub">All testing encounters</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Positive</div><div class="chak-kpi-value pink">${chakFmt(posSum)}</div><div class="chak-kpi-sub">HIV positive diagnoses</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Positivity Rate</div><div class="chak-kpi-value orange">${chakAvg(trend, "positivity_pct")}%</div><div class="chak-kpi-sub">% tested positive</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_NEW (Total)</div><div class="chak-kpi-value teal">${chakFmt(txNewSum)}</div><div class="chak-kpi-sub">${txNewPct}% of positive on ART</div></div>
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 Tested + TX_NEW (Combo)", "chakHtsSumCombo")}
      ${chakChartCard("📊 Positive → TX_NEW Cascade", "chakHtsSumBars")}
      ${chakChartCard("📊 Tested + Positivity % (Combo)", "chakHtsSumCombo2")}
      ${chakChartCard("📈 All HTS Indicators", "chakHtsSummaryTrend", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tested", "positive", "positivity_pct", "tx_new"], ["Month", "Tested", "Positive", "% Positive", "TX_NEW"])}
    `;
  el.setAttribute("data-chak-slug", "hts-summary");
  _chakSetData("hts-summary", data);

  // Chart 1: Combo — Tested bars + TX_NEW line
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

  // Chart 2: Cascade bars
  chakCreateChart(
    "chakHtsSumBars",
    chakBarChart(trend, [
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
    ]),
  );

  // Chart 3: Tested bars + % positivity line
  chakCreateChart("chakHtsSumCombo2", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Tested",
          data: trend.map(function (d) {
            return d.tested || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "80",
          borderRadius: 3,
          order: 2,
        },
        {
          label: "% Positive",
          data: trend.map(function (d) {
            return d.positivity_pct || 0;
          }),
          type: "line",
          borderColor: CHAK_COLORS.orange,
          backgroundColor: CHAK_COLORS.orange + "20",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: CHAK_COLORS.orange,
          yAxisID: "y1",
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          position: "left",
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Tested" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          max: 100,
          grid: { display: false },
          title: { display: true, text: "% Positive" },
        },
      },
    },
  });

  // Chart 4: Multi-line trend
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
    var posSum = chakSum(trend, "positive");
    var txNewSum = chakSum(trend, "tx_new");
    var testedSum = chakSum(trend, "tested");
    var yieldAvg = chakAvg(trend, "yield_pct");
    el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-layer-group"></i> Testing per Modality</h2><p>Testing by entry point: ${chakFmt(testedSum)} tested, ${chakFmt(posSum)} positive (${yieldAvg}% yield)</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Tested</div><div class="chak-kpi-value blue">${chakFmt(testedSum)}</div><div class="chak-kpi-sub">All modalities</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Positive</div><div class="chak-kpi-value pink">${chakFmt(posSum)}</div><div class="chak-kpi-sub">HIV positive diagnoses</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg Yield</div><div class="chak-kpi-value orange">${yieldAvg}%</div><div class="chak-kpi-sub">% positive of tested</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_NEW (Total)</div><div class="chak-kpi-value teal">${chakFmt(txNewSum)}</div><div class="chak-kpi-sub">Started ART</div></div>
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 Tested + Yield (Combo)", "chakModCombo")}
      ${chakChartCard("📊 Positive → TX_NEW Cascade", "chakModBars")}
      ${chakChartCard("📊 Tested by Modality + Yield %", "chakModDual")}
      ${chakChartCard("📈 Trend: Tested, Positive, Yield", "chakModalityTrend", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tested", "positive", "yield_pct", "tx_new"], ["Month", "Tested", "Positive", "Yield %", "TX_NEW"])}
    `;
    el.setAttribute("data-chak-slug", "testing-modality");
    _chakSetData("testing-modality", data);

    // Chart 1: Combo - Tested bars + Yield % line
    chakCreateChart(
      "chakModCombo",
      chakLineClusteredColumnComboChart(
        trend,
        [{ key: "tested", label: "Tested", color: CHAK_COLORS.blue + "80" }],
        [{ key: "yield_pct", label: "Yield %", color: CHAK_COLORS.orange }],
      ),
    );

    // Chart 2: Cascade bars
    chakCreateChart(
      "chakModBars",
      chakBarChart(trend, [
        { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
        { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
      ]),
    );

    // Chart 3: Dual axis - Tested + Yield % combo (full control)
    chakCreateChart("chakModDual", {
      type: "bar",
      data: {
        labels: trend.map(function (d) {
          return d.label;
        }),
        datasets: [
          {
            label: "Tested",
            data: trend.map(function (d) {
              return d.tested || 0;
            }),
            backgroundColor: CHAK_COLORS.blue + "60",
            borderRadius: 3,
            order: 2,
          },
          {
            label: "Yield %",
            data: trend.map(function (d) {
              return d.yield_pct || 0;
            }),
            type: "line",
            borderColor: CHAK_COLORS.orange,
            backgroundColor: CHAK_COLORS.orange + "20",
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: CHAK_COLORS.orange,
            yAxisID: "y1",
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: { boxWidth: 12, font: { size: 11 } },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            position: "left",
            grid: { color: "#f0f0f0" },
            title: { display: true, text: "Tested" },
          },
          y1: {
            beginAtZero: true,
            position: "right",
            max: 100,
            grid: { display: false },
            title: { display: true, text: "Yield %" },
          },
        },
      },
    });

    // Chart 4: Multi-line trend
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
  const projParam =
    state.projectFilter !== "all"
      ? `&project=${encodeURIComponent(state.projectFilter)}`
      : "";
  let url = `/pbix/api/${encodeURIComponent(apiPageId)}?county=${encodeURIComponent(county)}${projParam}`;
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

// ────────────────────────────────────────────────────────────
// PROJECT PERFORMANCE MONITORING DASHBOARD (from Excel)
// ────────────────────────────────────────────────────────────

const PROJECT_PERF_STYLES = `
  <style>
    .pp-card { @apply rounded-2xl border border-slate-200 bg-white p-5 shadow-sm; }
    .pp-card-header { @apply text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2; }
    .pp-kpi-card { @apply rounded-xl border p-4 flex flex-col items-center justify-center text-center; }
    .pp-kpi-value { @apply text-2xl font-bold mt-1; }
    .pp-kpi-label { @apply text-xs font-medium uppercase tracking-wider text-slate-500; }
    .rag-on-track { color: #16a34a; background: #f0fdf4; border-color: #bbf7d0; }
    .rag-watch { color: #d97706; background: #fffbeb; border-color: #fde68a; }
    .rag-off-track { color: #dc2626; background: #fef2f2; border-color: #fecaca; }
    .rag-na { color: #94a3b8; background: #f8fafc; border-color: #e2e8f0; }
    .pp-table { @apply w-full text-xs; }
    .pp-table th { @apply px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200 bg-slate-50; }
    .pp-table td { @apply px-3 py-2 text-slate-700 border-b border-slate-100; }
    .pp-badge { @apply inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium; }
    .pp-project-btn { @apply cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5; }
    .pp-filter-active { @apply ring-2 ring-sky-500; }
  </style>
`;

// ── Colors ──
const PP_COLORS = {
  green: "#16a34a",
  yellow: "#d97706",
  red: "#dc2626",
  blue: "#2563eb",
  teal: "#0d9488",
  purple: "#7c3aed",
  slate: "#94a3b8",
};

// ── State for project performance ──
let ppState = {
  data: null,
  currentProject: null, // null = portfolio overview
  loading: false,
  error: null,
};

// ── Main entry point ──
async function renderProjectPerformanceDashboard(container) {
  container.innerHTML =
    PROJECT_PERF_STYLES +
    `
    <div id="ppContent" class="space-y-5">
      <div class="flex items-center justify-center py-20 text-slate-400 text-sm gap-2">
        <div class="w-5 h-5 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
        Loading project performance data…
      </div>
    </div>
  `;

  try {
    const resp = await fetch("/api/project-portfolio");
    const data = await resp.json();
    if (!data.ok) {
      throw new Error(data.error || "Failed to load");
    }
    ppState.data = data;
    ppState.currentProject = null;
    renderPortfolioOverview(container);
  } catch (err) {
    ppState.error = err.message;
    container.innerHTML =
      PROJECT_PERF_STYLES +
      `
      <div class="pp-card">
        <div class="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div class="text-4xl">📊</div>
          <p class="text-sm font-medium text-slate-700">Project Performance Data Unavailable</p>
          <p class="text-xs text-slate-400 max-w-md">${escapeHtml(err.message)}. Ensure the Excel file is in the project root directory.</p>
          <button onclick="retryLoadProjectPerformance()" class="px-4 py-2 bg-sky-600 text-white text-xs rounded-lg hover:bg-sky-700 transition-colors">Retry</button>
        </div>
      </div>`;
  }
}

// ── Retry ──
function retryLoadProjectPerformance() {
  const container = document.getElementById("projectPerfRoot");
  if (container) renderProjectPerformanceDashboard(container);
}

// ── Portfolio Overview ──
function renderPortfolioOverview(container) {
  const data = ppState.data;
  if (!data) return;
  const portfolio = data.portfolio || {};
  const projects = portfolio.projects || [];
  const ceo = portfolio.ceo_snapshot || {};

  // ── Top Navigation / Filter Bar ──
  let html = PROJECT_PERF_STYLES;

  // Breadcrumb
  html += `
    <div class="flex items-center gap-2 text-xs text-slate-400 mb-1">
      <span class="font-medium text-slate-600">Project Performance</span>
      <span>›</span>
      <span class="text-sky-600 font-medium">Portfolio Overview</span>
    </div>
  `;

  // ── CEO Snapshot Cards ──
  const totalProj = projects.length;
  const onTrackCount = parseInt(ceo.on_track) || 0;
  const onWatchCount = parseInt(ceo.on_watch) || 0;
  const offTrackCount = parseInt(ceo.off_track) || 0;
  const budgetUtil = ceo.budget_utilisation_pct;

  html += `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="pp-kpi-card rag-on-track border">
        <div class="pp-kpi-label">On Track</div>
        <div class="pp-kpi-value">${onTrackCount}<span class="text-sm font-normal text-slate-400 ml-1">/ ${totalProj}</span></div>
      </div>
      <div class="pp-kpi-card rag-watch border">
        <div class="pp-kpi-label">On Watch</div>
        <div class="pp-kpi-value">${onWatchCount}<span class="text-sm font-normal text-slate-400 ml-1">/ ${totalProj}</span></div>
      </div>
      <div class="pp-kpi-card rag-off-track border">
        <div class="pp-kpi-label">Off Track</div>
        <div class="pp-kpi-value">${offTrackCount}<span class="text-sm font-normal text-slate-400 ml-1">/ ${totalProj}</span></div>
      </div>
      <div class="pp-kpi-card border border-slate-200" style="background:#f0f9ff;">
        <div class="pp-kpi-label">Budget Utilisation</div>
        <div class="pp-kpi-value" style="color:#0369a1;">${budgetUtil !== null && budgetUtil !== undefined ? budgetUtil + "%" : "N/A"}</div>
      </div>
    </div>
  `;

  // ── RAG Distribution Pie + Portfolio Summary ──
  const ragCounts = { "On Track": 0, Watch: 0, "Off Track": 0, "N/A": 0 };
  projects.forEach((p) => {
    const r = p.overall_rag || "N/A";
    if (ragCounts[r] !== undefined) ragCounts[r]++;
    else ragCounts["N/A"]++;
  });

  const totalBudget = portfolio.portfolio_total_annual_budget || 0;
  const totalSpend = portfolio.portfolio_total_expenditure || 0;

  html += `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="pp-card lg:col-span-1">
        <div class="pp-card-header"><i class="fas fa-chart-pie text-slate-400"></i> Portfolio RAG Distribution</div>
        <div id="ppRagPieChart" style="height:220px;"></div>
        <div class="flex justify-center gap-4 mt-2 text-xs">
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full" style="background:${PP_COLORS.green}"></span> On Track (${ragCounts["On Track"]})</span>
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full" style="background:${PP_COLORS.yellow}"></span> Watch (${ragCounts["Watch"]})</span>
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full" style="background:${PP_COLORS.red}"></span> Off Track (${ragCounts["Off Track"]})</span>
        </div>
      </div>
      <div class="pp-card lg:col-span-2">
        <div class="pp-card-header"><i class="fas fa-chart-bar text-slate-400"></i> Portfolio Budget vs Expenditure</div>
        <div id="ppPortfolioBudgetChart" style="height:220px;"></div>
      </div>
    </div>
  `;

  // ── Projects Table ──
  html += `
    <div class="pp-card">
      <div class="pp-card-header"><i class="fas fa-table text-slate-400"></i> All Projects — Portfolio Health</div>
      <div class="overflow-x-auto">
        <table class="pp-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Donor</th>
              <th class="text-right">Annual Budget</th>
              <th class="text-right">Cumulative Expenditure</th>
              <th class="text-right">Variance %</th>
              <th class="text-center">Financial RAG</th>
              <th class="text-center">Technical RAG</th>
              <th class="text-center">Indicators</th>
              <th class="text-center">Overall RAG</th>
            </tr>
          </thead>
          <tbody>
            ${projects
              .map((p) => {
                const varPct = p.budget_variance_pct;
                const varDisplay =
                  varPct !== null && varPct !== undefined && varPct !== "N/A"
                    ? typeof varPct === "number"
                      ? (varPct >= 0 ? "+" : "") +
                        (varPct * 100).toFixed(1) +
                        "%"
                      : varPct
                    : "N/A";
                return `<tr class="pp-project-btn" onclick="selectProjectFromTable('${slugify(p.project)}')" style="cursor:pointer;">
                <td class="font-medium text-sky-700 hover:underline">${escapeHtml(p.project)}</td>
                <td class="text-slate-500">${escapeHtml(p.donor)}</td>
                <td class="text-right font-mono">${fmtCurrency(p.total_annual_budget)}</td>
                <td class="text-right font-mono">${fmtCurrency(p.cumulative_expenditure)}</td>
                <td class="text-right font-mono">${varDisplay}</td>
                <td class="text-center">${ragBadge(p.financial_rag)}</td>
                <td class="text-center">${ragBadge(p.technical_rag)}</td>
                <td class="text-center text-xs text-slate-500">${p.indicators_off_track || "0"}</td>
                <td class="text-center">${ragBadge(p.overall_rag)}</td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="mt-3 text-xs text-slate-400 flex items-center justify-between">
        <span>Portfolio Total: <strong>${fmtCurrency(totalBudget)}</strong> budget · <strong>${fmtCurrency(totalSpend)}</strong> expended</span>
        <span>Click any project row to drill down</span>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // ── Render Charts ──
  renderRagPieChart("ppRagPieChart", ragCounts);
  renderPortfolioBudgetChart("ppPortfolioBudgetChart", projects);
}

// ── RAG Pie Chart (Highcharts) ──
function renderRagPieChart(containerId, counts) {
  const data = [];
  if (counts["On Track"] > 0)
    data.push({
      name: "On Track",
      y: counts["On Track"],
      color: PP_COLORS.green,
    });
  if (counts["Watch"] > 0)
    data.push({ name: "Watch", y: counts["Watch"], color: PP_COLORS.yellow });
  if (counts["Off Track"] > 0)
    data.push({
      name: "Off Track",
      y: counts["Off Track"],
      color: PP_COLORS.red,
    });
  if (counts["N/A"] > 0)
    data.push({ name: "N/A", y: counts["N/A"], color: PP_COLORS.slate });
  if (data.length === 0) return;

  Highcharts.chart(containerId, {
    chart: {
      type: "pie",
      height: 220,
      backgroundColor: "transparent",
      spacing: [5, 5, 5, 5],
    },
    title: { text: null },
    tooltip: {
      pointFormat: "{point.name}: <b>{point.y}</b> ({point.percentage:.0f}%)",
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: "pointer",
        dataLabels: {
          enabled: true,
          format: "<b>{point.name}</b>: {point.y}",
          style: { fontSize: "10px" },
        },
        showInLegend: false,
        size: "90%",
      },
    },
    series: [{ name: "Projects", data: data }],
    credits: { enabled: false },
  });
}

// ── Portfolio Budget Bar Chart (Highcharts) ──
function renderPortfolioBudgetChart(containerId, projects) {
  const categories = projects.map((p) => truncateStr(p.project, 20));
  const budgetData = projects.map((p) => p.total_annual_budget || 0);
  const spendData = projects.map((p) => p.cumulative_expenditure || 0);

  Highcharts.chart(containerId, {
    chart: { type: "bar", height: 220, backgroundColor: "transparent" },
    title: { text: null },
    xAxis: { categories: categories, labels: { style: { fontSize: "9px" } } },
    yAxis: {
      title: { text: null },
      labels: { enabled: false },
      gridLineWidth: 0,
    },
    tooltip: {
      formatter: function () {
        return this.series.name + ": <b>" + fmtCurrencyShort(this.y) + "</b>";
      },
    },
    plotOptions: { bar: { groupPadding: 0.08, borderRadius: 2 } },
    series: [
      { name: "Annual Budget", data: budgetData, color: "#94a3b8" },
      { name: "Cumulative Expenditure", data: spendData, color: "#2563eb" },
    ],
    legend: {
      align: "right",
      verticalAlign: "top",
      layout: "horizontal",
      itemStyle: { fontSize: "10px" },
    },
    credits: { enabled: false },
  });
}

// ── Select project from table ──
function selectProjectFromTable(slug) {
  ppState.currentProject = slug;
  const container = document.getElementById("projectPerfRoot");
  if (container) renderProjectDetail(container, slug);
}

// ── Back to portfolio overview ──
function backToPortfolioOverview() {
  ppState.currentProject = null;
  const container = document.getElementById("projectPerfRoot");
  if (container) renderPortfolioOverview(container);
}

// ── Render Individual Project Detail ──
async function renderProjectDetail(container, slug) {
  container.innerHTML =
    PROJECT_PERF_STYLES +
    `
    <div id="ppContent" class="space-y-5">
      <div class="flex items-center justify-center py-20 text-slate-400 text-sm gap-2">
        <div class="w-5 h-5 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
        Loading project details…
      </div>
    </div>
  `;

  try {
    const [detailResp, chartResp] = await Promise.all([
      fetch(`/api/project-portfolio/${encodeURIComponent(slug)}`),
      fetch(`/api/project-portfolio/${encodeURIComponent(slug)}/chart-data`),
    ]);

    const detail = await detailResp.json();
    const chartData = await chartResp.json();

    if (!detail.ok) throw new Error(detail.error || "Project not found");
    if (!chartData.ok)
      throw new Error(chartData.error || "Chart data not found");

    renderProjectDetailHtml(container, detail.project, chartData);
  } catch (err) {
    container.innerHTML =
      PROJECT_PERF_STYLES +
      `
      <div class="pp-card">
        <div class="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div class="text-4xl">⚠️</div>
          <p class="text-sm font-medium text-slate-700">Error loading project</p>
          <p class="text-xs text-slate-400">${escapeHtml(err.message)}</p>
          <button onclick="backToPortfolioOverview()" class="px-4 py-2 bg-slate-600 text-white text-xs rounded-lg hover:bg-slate-700 transition-colors">Back to Portfolio</button>
        </div>
      </div>`;
  }
}

// ── Render Project Detail HTML ──
function renderProjectDetailHtml(container, project, chartData) {
  const secA = project.section_a || {};
  const secB = project.section_b || {};
  const secC = project.section_c || {};

  const displayName = getProjectDisplayName(project.slug);

  let html = PROJECT_PERF_STYLES;

  // ── Breadcrumb ──
  html += `
    <div class="flex items-center gap-2 text-xs text-slate-400 mb-1">
      <a href="javascript:backToPortfolioOverview()" class="text-sky-600 hover:underline cursor-pointer">Portfolio Overview</a>
      <span>›</span>
      <span class="font-medium text-slate-600">${escapeHtml(displayName)}</span>
    </div>
  `;

  // ── Project Header Cards ──
  const monthsElapsed = project.months_elapsed || 0;
  const totalMonths = project.project_duration_months || 0;
  const progressPct =
    totalMonths > 0 ? Math.round((monthsElapsed / totalMonths) * 100) : 0;

  html += `
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div class="pp-card col-span-2 md:col-span-2">
        <div class="pp-kpi-label text-left">Project</div>
        <div class="text-lg font-bold text-slate-800 mt-1">${escapeHtml(displayName)}</div>
        <div class="text-xs text-slate-500 mt-1">${escapeHtml(project.donor || "")} · ${escapeHtml(project.project_code || "")}</div>
        <div class="text-xs text-slate-400 mt-0.5">${escapeHtml(project.reporting_month || "")}</div>
      </div>
      <div class="pp-kpi-card border rag-${secC.overall_rag === "On Track" ? "on-track" : secC.overall_rag === "Watch" ? "watch" : secC.overall_rag === "Off Track" ? "off-track" : "na"}">
        <div class="pp-kpi-label">Overall RAG</div>
        <div class="pp-kpi-value text-lg">${secC.overall_rag || "N/A"}</div>
      </div>
      <div class="pp-kpi-card border rag-${secC.financial_rag === "On Track" ? "on-track" : secC.financial_rag === "Watch" ? "watch" : secC.financial_rag === "Off Track" ? "off-track" : "na"}">
        <div class="pp-kpi-label">Financial RAG</div>
        <div class="pp-kpi-value text-lg">${secC.financial_rag || "N/A"}</div>
      </div>
      <div class="pp-kpi-card border rag-${secC.technical_rag === "On Track" ? "on-track" : secC.technical_rag === "Watch" ? "watch" : secC.technical_rag === "Off Track" ? "off-track" : "na"}">
        <div class="pp-kpi-label">Technical RAG</div>
        <div class="pp-kpi-value text-lg">${secC.technical_rag || "N/A"}</div>
      </div>
    </div>
  `;

  // ── Section A: Financial Performance ──
  const budgetLines = secA.budget_lines || [];
  const totalBL = secA.total || {};

  html += `
    <div class="pp-card">
      <div class="pp-card-header"><i class="fas fa-coins text-slate-400"></i> SECTION A · Financial Performance — Budget vs Actual (BVA)</div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div class="bg-slate-50 rounded-lg p-3 text-center">
          <div class="text-xs text-slate-500">Total Annual Budget</div>
          <div class="text-lg font-bold text-slate-800">${fmtCurrency(secA.total_annual_budget || 0)}</div>
        </div>
        <div class="bg-slate-50 rounded-lg p-3 text-center">
          <div class="text-xs text-slate-500">Total Cumulative Expenditure</div>
          <div class="text-lg font-bold text-slate-800">${fmtCurrency(secA.total_cumulative_expenditure || 0)}</div>
        </div>
        <div class="bg-slate-50 rounded-lg p-3 text-center">
          <div class="text-xs text-slate-500">Budget Variance</div>
          <div class="text-lg font-bold ${(secA.total_variance_pct || 0) > 0.2 ? "text-red-600" : (secA.total_variance_pct || 0) < -0.2 ? "text-orange-600" : "text-green-600"}">
            ${
              secA.total_variance_pct !== null &&
              secA.total_variance_pct !== undefined
                ? (secA.total_variance_pct >= 0 ? "+" : "") +
                  (secA.total_variance_pct * 100).toFixed(1) +
                  "%"
                : "N/A"
            }
          </div>
        </div>
        <div class="bg-slate-50 rounded-lg p-3 text-center">
          <div class="text-xs text-slate-500">Project Progress</div>
          <div class="text-lg font-bold text-slate-800">${monthsElapsed} / ${totalMonths} mo</div>
          <div class="w-full bg-slate-200 rounded-full h-1.5 mt-1">
            <div class="bg-sky-600 h-1.5 rounded-full" style="width:${progressPct}%"></div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div>
          <div id="ppProjectBudgetChart" style="height:250px;"></div>
        </div>
        <div>
          <div id="ppBudgetRagChart" style="height:250px;"></div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="pp-table">
          <thead>
            <tr>
              <th>Budget Line</th>
              <th class="text-right">Annual Budget</th>
              <th class="text-right">Planned Cumulative</th>
              <th class="text-right">Actual Cumulative</th>
              <th class="text-right">Variance %</th>
              <th class="text-right">Current Month</th>
              <th class="text-right">Avg Monthly Burn</th>
              <th class="text-right">Projected Annual</th>
              <th class="text-center">RAG</th>
            </tr>
          </thead>
          <tbody>
            ${budgetLines
              .map((bl) => {
                const vp = bl.variance_pct;
                const vpDisplay =
                  vp !== null && vp !== undefined && vp !== "N/A"
                    ? typeof vp === "number"
                      ? (vp >= 0 ? "+" : "") + (vp * 100).toFixed(1) + "%"
                      : vp
                    : "N/A";
                return `<tr>
                <td class="font-medium text-slate-700">${escapeHtml(bl.budget_line)}</td>
                <td class="text-right font-mono">${fmtCurrency(bl.annual_budget)}</td>
                <td class="text-right font-mono">${fmtCurrency(bl.planned_cumulative)}</td>
                <td class="text-right font-mono">${fmtCurrency(bl.actual_cumulative)}</td>
                <td class="text-right font-mono">${vpDisplay}</td>
                <td class="text-right font-mono">${fmtCurrency(bl.current_month_expenditure)}</td>
                <td class="text-right font-mono">${fmtCurrency(bl.avg_monthly_burn_rate)}</td>
                <td class="text-right font-mono">${fmtCurrency(bl.projected_annual_expenditure)}</td>
                <td class="text-center">${ragBadge(bl.rag)}</td>
              </tr>`;
              })
              .join("")}
          </tbody>
          <tfoot>
            <tr class="bg-slate-50 font-semibold">
              <td>TOTAL PROJECT BUDGET</td>
              <td class="text-right">${fmtCurrency(totalBL.annual_budget)}</td>
              <td class="text-right">${fmtCurrency(totalBL.planned_cumulative)}</td>
              <td class="text-right">${fmtCurrency(totalBL.actual_cumulative)}</td>
              <td class="text-right">${
                totalBL.variance_pct !== null &&
                totalBL.variance_pct !== undefined
                  ? (totalBL.variance_pct >= 0 ? "+" : "") +
                    (totalBL.variance_pct * 100).toFixed(1) +
                    "%"
                  : "N/A"
              }</td>
              <td class="text-right">${fmtCurrency(totalBL.current_month_expenditure)}</td>
              <td class="text-right">${fmtCurrency(totalBL.avg_monthly_burn_rate)}</td>
              <td class="text-right">${fmtCurrency(totalBL.projected_annual_expenditure)}</td>
              <td class="text-center">${ragBadge(totalBL.rag)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;

  // ── Section B: Technical Indicators ──
  const indicators = secB.indicators || [];
  const offTrackInds = secC.off_track_indicators || "0";

  html += `
    <div class="pp-card">
      <div class="pp-card-header"><i class="fas fa-bullseye text-slate-400"></i> SECTION B · Technical / Donor Indicator Performance</div>
      <div class="flex items-center gap-4 mb-4 text-xs text-slate-500">
        <span>Off-Track Indicators: <strong class="text-red-600">${offTrackInds}</strong></span>
        <span>Technical RAG: ${ragBadge(secC.technical_rag)}</span>
      </div>
      <div id="ppIndicatorChart" style="height:220px;" class="mb-4"></div>
      <div class="overflow-x-auto">
        <table class="pp-table">
          <thead>
            <tr>
              <th>Indicator</th>
              <th>Definition</th>
              <th class="text-right">Annual Target</th>
              <th class="text-right">Planned Cumulative</th>
              <th class="text-right">Actual Cumulative</th>
              <th class="text-right">Achievement %</th>
              <th class="text-center">RAG</th>
            </tr>
          </thead>
          <tbody>
            ${indicators
              .map((ind) => {
                const ach = ind.achievement_pct;
                const achDisplay =
                  ach !== null && ach !== undefined && ach !== "N/A"
                    ? typeof ach === "number"
                      ? (ach * 100).toFixed(1) + "%"
                      : ach
                    : "N/A";
                return `<tr>
                <td class="font-medium">${escapeHtml(ind.indicator)}</td>
                <td class="text-slate-500 max-w-[200px] truncate">${escapeHtml(ind.definition)}</td>
                <td class="text-right font-mono">${fmtNum(ind.annual_target)}</td>
                <td class="text-right font-mono">${fmtNum(ind.planned_cumulative)}</td>
                <td class="text-right font-mono">${fmtNum(ind.actual_cumulative)}</td>
                <td class="text-right font-mono">${achDisplay}</td>
                <td class="text-center">${ragBadge(ind.rag)}</td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // ── Section C: Overall Health ──
  html += `
    <div class="pp-card">
      <div class="pp-card-header"><i class="fas fa-heartbeat text-slate-400"></i> SECTION C · Overall Project Health</div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="pp-kpi-card border rag-${secC.financial_rag === "On Track" ? "on-track" : secC.financial_rag === "Watch" ? "watch" : "off-track"}">
          <div class="pp-kpi-label">Financial RAG</div>
          <div class="pp-kpi-value text-lg">${secC.financial_rag || "N/A"}</div>
          <div class="text-xs text-slate-400 mt-1">Off-Track Lines: ${secC.off_track_budget_lines || "0"}</div>
        </div>
        <div class="pp-kpi-card border rag-${secC.technical_rag === "On Track" ? "on-track" : secC.technical_rag === "Watch" ? "watch" : "off-track"}">
          <div class="pp-kpi-label">Technical RAG</div>
          <div class="pp-kpi-value text-lg">${secC.technical_rag || "N/A"}</div>
          <div class="text-xs text-slate-400 mt-1">Off-Track Indicators: ${offTrackInds}</div>
        </div>
        <div class="pp-kpi-card border rag-${secC.overall_rag === "On Track" ? "on-track" : secC.overall_rag === "Watch" ? "watch" : "off-track"}">
          <div class="pp-kpi-label">Overall Health</div>
          <div class="pp-kpi-value text-lg">${secC.overall_rag || "N/A"}</div>
          <div class="text-xs text-slate-400 mt-1">Worst of Financial & Technical</div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // ── Render Charts ──
  if (chartData) {
    renderProjectBudgetChart("ppProjectBudgetChart", chartData.burn_chart);
    renderBudgetRagDonut("ppBudgetRagChart", chartData.rag_distribution);
    renderIndicatorChart("ppIndicatorChart", chartData.indicator_chart);
  }
}

// ── Project Budget Burn Rate Chart ──
function renderProjectBudgetChart(containerId, burnChart) {
  if (!burnChart || !burnChart.categories || !burnChart.categories.length)
    return;
  const cats = burnChart.categories.map((c) => truncateStr(c, 22));

  Highcharts.chart(containerId, {
    chart: { type: "bar", height: 250, backgroundColor: "transparent" },
    title: {
      text: "Planned vs Actual Cumulative Expenditure",
      style: { fontSize: "11px" },
    },
    xAxis: { categories: cats, labels: { style: { fontSize: "8px" } } },
    yAxis: {
      title: { text: null },
      labels: {
        formatter: function () {
          return fmtCurrencyShort(this.value);
        },
        style: { fontSize: "9px" },
      },
    },
    tooltip: {
      formatter: function () {
        return this.series.name + ": <b>" + fmtCurrencyShort(this.y) + "</b>";
      },
    },
    plotOptions: { bar: { groupPadding: 0.06, borderRadius: 2 } },
    series: [
      {
        name: "Planned Cumulative",
        data: burnChart.planned || [],
        color: "#94a3b8",
      },
      {
        name: "Actual Cumulative",
        data: burnChart.actual || [],
        color: "#2563eb",
      },
    ],
    legend: {
      align: "right",
      verticalAlign: "top",
      layout: "horizontal",
      itemStyle: { fontSize: "10px" },
    },
    credits: { enabled: false },
  });
}

// ── Budget RAG Donut ──
function renderBudgetRagDonut(containerId, ragDist) {
  if (!ragDist) return;
  const data = [];
  if (ragDist["On Track"] > 0)
    data.push({
      name: "On Track",
      y: ragDist["On Track"],
      color: PP_COLORS.green,
    });
  if (ragDist["Watch"] > 0)
    data.push({ name: "Watch", y: ragDist["Watch"], color: PP_COLORS.yellow });
  if (ragDist["Off Track"] > 0)
    data.push({
      name: "Off Track",
      y: ragDist["Off Track"],
      color: PP_COLORS.red,
    });
  if (ragDist["N/A"] > 0)
    data.push({ name: "N/A", y: ragDist["N/A"], color: PP_COLORS.slate });
  if (data.length === 0) return;

  Highcharts.chart(containerId, {
    chart: { type: "pie", height: 250, backgroundColor: "transparent" },
    title: {
      text: "Budget Line RAG Distribution",
      style: { fontSize: "11px" },
    },
    tooltip: { pointFormat: "{point.name}: <b>{point.y}</b> lines" },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: "pointer",
        innerSize: "50%",
        dataLabels: {
          enabled: true,
          format: "<b>{point.name}</b>: {point.y}",
          style: { fontSize: "9px" },
        },
        size: "80%",
      },
    },
    series: [{ name: "Budget Lines", data: data }],
    credits: { enabled: false },
  });
}

// ── Indicator Achievement Chart ──
function renderIndicatorChart(containerId, indChart) {
  if (!indChart || !indChart.categories || !indChart.categories.length) return;
  const cats = indChart.categories.map((c) => truncateStr(c, 20));

  Highcharts.chart(containerId, {
    chart: { type: "bar", height: 220, backgroundColor: "transparent" },
    title: {
      text: "Annual Target vs Actual Cumulative Achievement",
      style: { fontSize: "11px" },
    },
    xAxis: { categories: cats, labels: { style: { fontSize: "8px" } } },
    yAxis: {
      title: { text: null },
      labels: {
        formatter: function () {
          return fmtCurrencyShort(this.value);
        },
        style: { fontSize: "9px" },
      },
    },
    tooltip: {
      formatter: function () {
        return this.series.name + ": <b>" + fmtCurrencyShort(this.y) + "</b>";
      },
    },
    plotOptions: { bar: { groupPadding: 0.06, borderRadius: 2 } },
    series: [
      {
        name: "Annual Target",
        data: indChart.annual_targets || [],
        color: "#94a3b8",
      },
      {
        name: "Actual Cumulative",
        data: indChart.actual_results || [],
        color: "#0d9488",
      },
    ],
    legend: {
      align: "right",
      verticalAlign: "top",
      layout: "horizontal",
      itemStyle: { fontSize: "10px" },
    },
    credits: { enabled: false },
  });
}

// ── Utility Functions ──
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getProjectDisplayName(slug) {
  const names = {
    "jamii-tekelezi": "Jamii Tekelezi",
    "chap-stawisha": "CHAP Stawisha",
    "eye-health": "Eye Health - ACSP & GitLab",
    eis: "EIS",
    "bftw-hss": "BFTW HSS",
    "bftw-rmncah": "BFTW RMNCAH",
    pep: "PEP",
    "gf-mnch": "GF-MNCH",
    impact: "IMPACT",
    "cdic-icare": "CDIC / iCARE",
  };
  return names[slug] || slug;
}

function ragBadge(rag) {
  if (!rag || rag === "N/A" || rag === "")
    return `<span class="pp-badge rag-na border text-slate-400">N/A</span>`;
  const r = rag.toLowerCase();
  if (r === "on track")
    return `<span class="pp-badge" style="background:#dcfce7;color:#16a34a;">● On Track</span>`;
  if (r === "watch")
    return `<span class="pp-badge" style="background:#fef3c7;color:#d97706;">● Watch</span>`;
  if (r === "off track")
    return `<span class="pp-badge" style="background:#fee2e2;color:#dc2626;">● Off Track</span>`;
  return `<span class="pp-badge rag-na border text-slate-400">${escapeHtml(rag)}</span>`;
}

function fmtCurrency(val) {
  if (val === null || val === undefined || val === "N/A") return "N/A";
  const n = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(n)) return "N/A";
  if (n >= 1e9) return "KSh " + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "KSh " + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return "KSh " + (n / 1e3).toFixed(1) + "K";
  return "KSh " + n.toFixed(0);
}

function fmtCurrencyShort(val) {
  if (val === null || val === undefined) return "0";
  const n = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(n)) return "0";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(0);
}

function fmtNum(val) {
  if (val === null || val === undefined || val === "N/A") return "N/A";
  const n = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(n)) return "N/A";
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function truncateStr(str, maxLen) {
  if (!str) return "";
  return str.length > maxLen ? str.substring(0, maxLen) + "…" : str;
}

// ── Budget Analysis Subtab ──
async function renderBudgetAnalysisSubtab(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex items-center justify-center py-20 text-slate-400 text-sm gap-2">
        <div class="w-5 h-5 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
        Loading budget analysis…
      </div>
    </div>
  `;

  try {
    // Fetch with current filters
    const params = new URLSearchParams();
    if (state.countyFilter && state.countyFilter !== "all")
      params.set("county", state.countyFilter);
    if (state.subCountyFilter && state.subCountyFilter !== "all")
      params.set("subcounty", state.subCountyFilter);
    if (state.facilityFilter && state.facilityFilter !== "all")
      params.set("facility", state.facilityFilter);
    if (state.projectFilter && state.projectFilter !== "all")
      params.set("project", state.projectFilter);

    const url = params.toString()
      ? `/api/project-portfolio/filtered?${params.toString()}`
      : "/api/project-portfolio/seed";

    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || "Failed to load");

    const projects = data.projects || {};
    const slugs = Object.keys(projects);
    if (!slugs.length) {
      container.innerHTML = `<div class="p-8 text-center text-slate-400">No budget data available for the selected filters.</div>`;
      return;
    }

    // Build aggregated budget view across all projects
    let allCountyData = {};
    let allSubcountyData = {};
    let allFacilityData = [];

    slugs.forEach((slug) => {
      const proj = projects[slug];
      const counties = proj.geo_breakdown?.counties || proj.counties || {};
      Object.entries(counties).forEach(([cName, cData]) => {
        if (!allCountyData[cName]) {
          allCountyData[cName] = {
            budget: 0,
            expenditure: 0,
            planned: 0,
            facilityCount: 0,
            projectCount: 0,
          };
        }
        allCountyData[cName].budget += cData.allocated_budget || 0;
        allCountyData[cName].expenditure += cData.actual_expenditure || 0;
        allCountyData[cName].planned += cData.planned_expenditure || 0;
        allCountyData[cName].facilityCount += cData.facility_count || 0;
        allCountyData[cName].projectCount += 1;

        Object.entries(cData.subcounties || {}).forEach(([scName, scData]) => {
          if (!allSubcountyData[scName]) {
            allSubcountyData[scName] = {
              budget: 0,
              expenditure: 0,
              planned: 0,
              county: cName,
              facilityCount: 0,
            };
          }
          allSubcountyData[scName].budget += scData.allocated_budget || 0;
          allSubcountyData[scName].expenditure +=
            scData.actual_expenditure || 0;
          allSubcountyData[scName].planned += scData.planned_expenditure || 0;
          allSubcountyData[scName].facilityCount += scData.facility_count || 0;

          (scData.facilities || []).forEach((f) => {
            allFacilityData.push({
              facility_name: f.facility_name,
              allocated_budget: f.allocated_budget || 0,
              actual_expenditure: f.actual_expenditure || 0,
              county: cName,
              subcounty: scName,
            });
          });
        });
      });
    });

    // Render
    const countyNames = Object.keys(allCountyData);
    const selectedCounty =
      state.countyFilter && state.countyFilter !== "all"
        ? state.countyFilter
        : null;
    const selectedSC =
      state.subCountyFilter && state.subCountyFilter !== "all"
        ? state.subCountyFilter
        : null;

    // Determine drill-down level
    let budgetHtml = "";

    if (selectedSC) {
      const scData = allSubcountyData[selectedSC];
      if (scData) {
        const facs = allFacilityData.filter(
          (f) => f.subcounty.toLowerCase() === selectedSC.toLowerCase(),
        );
        budgetHtml = renderFacilityBudgetTable(facs, selectedSC);
      }
    } else if (selectedCounty) {
      const scList = Object.entries(allSubcountyData).filter(
        ([_, v]) => v.county.toLowerCase() === selectedCounty.toLowerCase(),
      );
      budgetHtml = renderSubcountyBudgetTable(scList, selectedCounty);
    } else {
      budgetHtml = renderCountyBudgetTable(countyNames, allCountyData);
    }

    // Build summary
    const totalBudget = Object.values(allCountyData).reduce(
      (s, v) => s + v.budget,
      0,
    );
    const totalExpenditure = Object.values(allCountyData).reduce(
      (s, v) => s + v.expenditure,
      0,
    );
    const totalPlanned = Object.values(allCountyData).reduce(
      (s, v) => s + v.planned,
      0,
    );
    const variancePct =
      totalPlanned > 0
        ? ((totalExpenditure - totalPlanned) / totalPlanned) * 100
        : 0;
    const totalFacilities = Object.values(allCountyData).reduce(
      (s, v) => s + v.facilityCount,
      0,
    );

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Summary cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Budget</div>
            <div class="text-xl font-bold text-slate-800 mt-1">${fmtCurrency(totalBudget)}</div>
          </div>
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Expenditure</div>
            <div class="text-xl font-bold text-slate-800 mt-1">${fmtCurrency(totalExpenditure)}</div>
          </div>
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold">Planned vs Actual</div>
            <div class="text-xl font-bold ${variancePct > 0 ? "text-amber-600" : "text-emerald-600"} mt-1">
              ${variancePct > 0 ? "+" : ""}${variancePct.toFixed(1)}%
            </div>
          </div>
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold">Facilities</div>
            <div class="text-xl font-bold text-slate-800 mt-1">${fmtNum(totalFacilities)}</div>
          </div>
        </div>

        <!-- Filter context banner -->
        <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-200">
          <span class="font-semibold text-slate-700">📍 Showing:</span>
          ${selectedCounty ? `<span class="bg-sky-100 text-sky-700 px-2 py-0.5 rounded">County: ${escapeHtml(selectedCounty)}</span>` : '<span class="text-slate-400">All Counties</span>'}
          ${selectedSC ? `<span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">Subcounty: ${escapeHtml(selectedSC)}</span>` : ""}
          ${state.projectFilter && state.projectFilter !== "all" ? `<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Project: ${escapeHtml(getProjectDisplayName(state.projectFilter))}</span>` : ""}
        </div>

        <!-- Drill-down navigation -->
        <div class="flex items-center gap-2 text-sm">
          <button onclick="resetBudgetDrillDown()" class="text-sky-600 hover:text-sky-800 hover:underline text-xs font-medium ${!selectedCounty && !selectedSC ? "opacity-50 pointer-events-none" : ""}">
            ← All Counties
          </button>
          ${
            selectedCounty
              ? `
            <span class="text-slate-300">/</span>
            <span class="text-slate-700 font-medium">${escapeHtml(selectedCounty)}</span>
          `
              : ""
          }
          ${
            selectedSC
              ? `
            <span class="text-slate-300">/</span>
            <span class="text-slate-500">${escapeHtml(selectedSC)}</span>
          `
              : ""
          }
        </div>

        <!-- Budget bar chart -->
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 class="text-sm font-semibold text-slate-700 mb-3">Budget vs Expenditure by ${selectedSC ? "Facility" : selectedCounty ? "Sub-County" : "County"}</h3>
          <div id="budgetChart" style="height:${Math.max(250, Math.min(500, countyNames.length * 60))}px"></div>
        </div>

        <!-- Detailed breakdown table -->
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm overflow-x-auto">
          <h3 class="text-sm font-semibold text-slate-700 mb-3">Detailed Breakdown</h3>
          ${budgetHtml}
        </div>
      </div>
    `;

    // Render chart based on drill level
    if (selectedSC && selectedCounty) {
      const facs = allFacilityData.filter(
        (f) => f.subcounty.toLowerCase() === selectedSC.toLowerCase(),
      );
      renderBudgetBarChart(
        "budgetChart",
        facs.map((f) => f.facility_name),
        facs.map((f) => f.allocated_budget),
        facs.map((f) => f.actual_expenditure),
      );
    } else if (selectedCounty) {
      const scList = Object.entries(allSubcountyData).filter(
        ([_, v]) => v.county.toLowerCase() === selectedCounty.toLowerCase(),
      );
      renderBudgetBarChart(
        "budgetChart",
        scList.map(([k]) => k),
        scList.map(([_, v]) => v.budget),
        scList.map(([_, v]) => v.expenditure),
      );
    } else {
      const cats = countyNames.map((c) => c.replace(" County", ""));
      renderBudgetBarChart(
        "budgetChart",
        cats,
        countyNames.map((c) => allCountyData[c].budget),
        countyNames.map((c) => allCountyData[c].expenditure),
      );
    }
  } catch (err) {
    container.innerHTML = `
      <div class="p-8 text-center">
        <div class="text-4xl mb-2">📊</div>
        <p class="text-sm font-medium text-slate-700">Budget Analysis Unavailable</p>
        <p class="text-xs text-slate-400 mt-1">${escapeHtml(err.message)}</p>
        <button onclick="renderBudgetAnalysisSubtab(container)" class="mt-3 px-4 py-2 bg-sky-600 text-white text-xs rounded-lg hover:bg-sky-700">Retry</button>
      </div>`;
  }
}

// Helper: reset budget drill-down to county level
function resetBudgetDrillDown() {
  if (elements.countyFilter) {
    elements.countyFilter.value = "all";
    state.countyFilter = "all";
  }
  if (elements.subCountyFilter) {
    elements.subCountyFilter.value = "all";
    state.subCountyFilter = "all";
  }
  if (elements.facilityFilter) {
    elements.facilityFilter.value = "all";
    state.facilityFilter = "all";
  }
  renderCurrentView();
}

function renderBudgetBarChart(
  containerId,
  categories,
  budgetData,
  expenditureData,
) {
  Highcharts.chart(containerId, {
    chart: { type: "bar", backgroundColor: "transparent" },
    title: { text: null },
    xAxis: {
      categories: categories,
      labels: { style: { fontSize: "10px" } },
    },
    yAxis: {
      title: { text: null },
      labels: {
        formatter: function () {
          return fmtCurrencyShort(this.value);
        },
        style: { fontSize: "9px" },
      },
    },
    tooltip: {
      formatter: function () {
        return this.series.name + ": <b>" + fmtCurrency(this.y) + "</b>";
      },
    },
    plotOptions: {
      bar: { groupPadding: 0.08, borderRadius: 3 },
    },
    series: [
      {
        name: "Allocated Budget",
        data: budgetData,
        color: "#0ea5e9",
      },
      {
        name: "Actual Expenditure",
        data: expenditureData,
        color: "#10b981",
      },
    ],
    legend: {
      align: "right",
      verticalAlign: "top",
      layout: "horizontal",
      itemStyle: { fontSize: "10px" },
    },
    credits: { enabled: false },
  });
}

function renderCountyBudgetTable(countyNames, countyData) {
  const rows = countyNames
    .map((c) => {
      const d = countyData[c];
      const utilPct = d.budget > 0 ? (d.expenditure / d.budget) * 100 : 0;
      const rag =
        utilPct > 110 ? "Off Track" : utilPct > 90 ? "Watch" : "On Track";
      return `
      <tr class="hover:bg-slate-50 cursor-pointer" onclick="drillDownCounty('${escapeHtml(c)}')">
        <td class="p-2 text-sm font-medium text-sky-600 hover:underline">${escapeHtml(c)}</td>
        <td class="p-2 text-sm text-right">${fmtCurrency(d.budget)}</td>
        <td class="p-2 text-sm text-right">${fmtCurrency(d.planned)}</td>
        <td class="p-2 text-sm text-right">${fmtCurrency(d.expenditure)}</td>
        <td class="p-2 text-sm text-right">${utilPct.toFixed(1)}%</td>
        <td class="p-2 text-center">${ragBadge(rag)}</td>
        <td class="p-2 text-sm text-right">${fmtNum(d.facilityCount)}</td>
      </tr>
    `;
    })
    .join("");

  return `
    <table class="w-full text-xs">
      <thead>
        <tr class="bg-slate-50 text-slate-500 uppercase tracking-wider">
          <th class="p-2 text-left">County</th>
          <th class="p-2 text-right">Budget</th>
          <th class="p-2 text-right">Planned</th>
          <th class="p-2 text-right">Actual</th>
          <th class="p-2 text-right">Util. %</th>
          <th class="p-2 text-center">Status</th>
          <th class="p-2 text-right">Facilities</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderSubcountyBudgetTable(scList, countyName) {
  const rows = scList
    .map(([scName, d]) => {
      const utilPct = d.budget > 0 ? (d.expenditure / d.budget) * 100 : 0;
      const rag =
        utilPct > 110 ? "Off Track" : utilPct > 90 ? "Watch" : "On Track";
      return `
      <tr class="hover:bg-slate-50 cursor-pointer" onclick="drillDownSubcounty('${escapeHtml(countyName)}', '${escapeHtml(scName)}')">
        <td class="p-2 text-sm font-medium text-indigo-600 hover:underline">${escapeHtml(scName)}</td>
        <td class="p-2 text-sm text-right">${fmtCurrency(d.budget)}</td>
        <td class="p-2 text-sm text-right">${fmtCurrency(d.planned)}</td>
        <td class="p-2 text-sm text-right">${fmtCurrency(d.expenditure)}</td>
        <td class="p-2 text-sm text-right">${utilPct.toFixed(1)}%</td>
        <td class="p-2 text-center">${ragBadge(rag)}</td>
        <td class="p-2 text-sm text-right">${fmtNum(d.facilityCount)}</td>
      </tr>
    `;
    })
    .join("");

  return `
    <p class="text-xs text-slate-400 mb-2">${escapeHtml(countyName)} — Sub-County Breakdown <span class="text-slate-300">(click a row to drill into facilities)</span></p>
    <table class="w-full text-xs">
      <thead>
        <tr class="bg-slate-50 text-slate-500 uppercase tracking-wider">
          <th class="p-2 text-left">Sub-County</th>
          <th class="p-2 text-right">Budget</th>
          <th class="p-2 text-right">Planned</th>
          <th class="p-2 text-right">Actual</th>
          <th class="p-2 text-right">Util. %</th>
          <th class="p-2 text-center">Status</th>
          <th class="p-2 text-right">Facilities</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderFacilityBudgetTable(facs, scName) {
  const rows = facs
    .map((f) => {
      const utilPct =
        f.allocated_budget > 0
          ? (f.actual_expenditure / f.allocated_budget) * 100
          : 0;
      const rag =
        utilPct > 110 ? "Off Track" : utilPct > 90 ? "Watch" : "On Track";
      return `
      <tr class="hover:bg-slate-50">
        <td class="p-2 text-sm text-slate-700">${escapeHtml(f.facility_name)}</td>
        <td class="p-2 text-sm text-right">${fmtCurrency(f.allocated_budget)}</td>
        <td class="p-2 text-sm text-right">${fmtCurrency(f.actual_expenditure)}</td>
        <td class="p-2 text-sm text-right">${utilPct.toFixed(1)}%</td>
        <td class="p-2 text-center">${ragBadge(rag)}</td>
      </tr>
    `;
    })
    .join("");

  return `
    <p class="text-xs text-slate-400 mb-2">${escapeHtml(scName)} — Facility-Level Breakdown</p>
    <table class="w-full text-xs">
      <thead>
        <tr class="bg-slate-50 text-slate-500 uppercase tracking-wider">
          <th class="p-2 text-left">Facility</th>
          <th class="p-2 text-right">Budget</th>
          <th class="p-2 text-right">Actual</th>
          <th class="p-2 text-right">Util. %</th>
          <th class="p-2 text-center">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// Drill-down helper functions
function drillDownCounty(countyName) {
  if (elements.countyFilter) {
    elements.countyFilter.value = countyName;
    state.countyFilter = countyName;
    state.subCountyFilter = "all";
    state.facilityFilter = "all";
  }
  renderCurrentView();
}

function drillDownSubcounty(countyName, scName) {
  if (elements.countyFilter) {
    elements.countyFilter.value = countyName;
    state.countyFilter = countyName;
  }
  if (elements.subCountyFilter) {
    elements.subCountyFilter.value = scName;
    state.subCountyFilter = scName;
    state.facilityFilter = "all";
  }
  renderCurrentView();
}

// ── Indicator Performance Subtab ──
async function renderIndicatorPerformanceSubtab(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex items-center justify-center py-20 text-slate-400 text-sm gap-2">
        <div class="w-5 h-5 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
        Loading indicator performance…
      </div>
    </div>
  `;

  try {
    // Fetch project data for indicator metrics
    const params = new URLSearchParams();
    if (state.countyFilter && state.countyFilter !== "all")
      params.set("county", state.countyFilter);
    if (state.subCountyFilter && state.subCountyFilter !== "all")
      params.set("subcounty", state.subCountyFilter);
    if (state.projectFilter && state.projectFilter !== "all")
      params.set("project", state.projectFilter);

    const url = params.toString()
      ? `/api/project-portfolio/filtered?${params.toString()}`
      : "/api/project-portfolio/seed";

    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || "Failed to load");

    // Fetch base project data for indicator targets
    const portfolioResp = await fetch("/api/project-portfolio");
    const portfolioData = await portfolioResp.json();

    const projects = data.projects || {};
    const slugs = Object.keys(projects);
    if (!slugs.length) {
      container.innerHTML = `<div class="p-8 text-center text-slate-400">No indicator data available for the selected filters.</div>`;
      return;
    }

    // Collect indicator metrics across projects
    let indicators = [];
    slugs.forEach((slug) => {
      const baseProj = portfolioData.projects?.[slug] || {};
      const secB = baseProj.section_b || {};
      const indList = secB.indicators || [];
      indList.forEach((ind) => {
        const target = ind.annual_target || 0;
        const actual = ind.actual_cumulative || 0;
        const achievement =
          target > 0 ? Math.min((actual / target) * 100, 100) : 0;
        const rag =
          achievement >= 90
            ? "On Track"
            : achievement >= 75
              ? "Watch"
              : "Off Track";
        indicators.push({
          slug,
          project: getProjectDisplayName(slug),
          indicator: ind.indicator || ind.name || "Indicator",
          target,
          actual,
          achievement,
          rag,
        });
      });
    });

    // If no indicators from project data, generate synthetic ones
    if (!indicators.length) {
      slugs.forEach((slug) => {
        const proj = projects[slug];
        const counties = proj.geo_breakdown?.counties || proj.counties || {};
        Object.entries(counties).forEach(([cName, cData]) => {
          const totalBudget = cData.allocated_budget || 0;
          const totalExp = cData.actual_expenditure || 0;
          const budgetUtil =
            totalBudget > 0 ? (totalExp / totalBudget) * 100 : 0;

          indicators.push({
            slug,
            project: getProjectDisplayName(slug),
            indicator: "Budget Utilisation Rate",
            target: 100,
            actual: Math.round(budgetUtil),
            achievement: Math.min(budgetUtil, 100),
            rag:
              budgetUtil >= 90 && budgetUtil <= 110
                ? "On Track"
                : budgetUtil >= 75
                  ? "Watch"
                  : "Off Track",
            location: cName,
          });

          indicators.push({
            slug,
            project: getProjectDisplayName(slug),
            indicator: "Beneficiary Reach",
            target: 10000,
            actual: cData.beneficiaries_served || 0,
            achievement: Math.min(
              ((cData.beneficiaries_served || 0) / 10000) * 100,
              100,
            ),
            rag:
              (cData.beneficiaries_served || 0) >= 9000
                ? "On Track"
                : (cData.beneficiaries_served || 0) >= 7500
                  ? "Watch"
                  : "Off Track",
            location: cName,
          });
        });
      });
    }

    // Filter by project if selected
    if (state.projectFilter && state.projectFilter !== "all") {
      indicators = indicators.filter((i) => i.slug === state.projectFilter);
    }

    // Group by indicator for summary
    const indGroups = {};
    indicators.forEach((ind) => {
      const key = ind.indicator;
      if (!indGroups[key])
        indGroups[key] = { values: [], targets: 0, actuals: 0 };
      indGroups[key].values.push(ind);
      indGroups[key].targets += ind.target;
      indGroups[key].actuals += ind.actual;
    });

    const indKeys = Object.keys(indGroups);
    const overallAchievement =
      indicators.length > 0
        ? indicators.reduce((s, i) => s + i.achievement, 0) / indicators.length
        : 0;
    const overallRag =
      overallAchievement >= 90
        ? "On Track"
        : overallAchievement >= 75
          ? "Watch"
          : "Off Track";

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Summary cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold">Overall Achievement</div>
            <div class="text-xl font-bold mt-1">${overallAchievement.toFixed(1)}%</div>
            <div class="mt-1">${ragBadge(overallRag)}</div>
          </div>
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold">Indicators Tracked</div>
            <div class="text-xl font-bold text-slate-800 mt-1">${fmtNum(indicators.length)}</div>
            <div class="text-xs text-slate-400 mt-1">Across ${fmtNum(indKeys.length)} categories</div>
          </div>
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold">On Track Rate</div>
            <div class="text-xl font-bold text-emerald-600 mt-1">
              ${indicators.length > 0 ? ((indicators.filter((i) => i.rag === "On Track").length / indicators.length) * 100).toFixed(0) : 0}%
            </div>
          </div>
        </div>

        <!-- Achievement bar chart -->
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 class="text-sm font-semibold text-slate-700 mb-3">Indicator Achievement by Category</h3>
          <div id="indicatorChart" style="height:${Math.max(200, indKeys.length * 50)}px"></div>
        </div>

        <!-- RAG distribution -->
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 class="text-sm font-semibold text-slate-700 mb-3">RAG Distribution</h3>
          <div id="ragDistributionChart" style="height:200px"></div>
        </div>

        <!-- Indicator detail table -->
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm overflow-x-auto">
          <h3 class="text-sm font-semibold text-slate-700 mb-3">Indicator Details</h3>
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-slate-50 text-slate-500 uppercase tracking-wider">
                <th class="p-2 text-left">Project</th>
                <th class="p-2 text-left">Indicator</th>
                <th class="p-2 text-right">Target</th>
                <th class="p-2 text-right">Actual</th>
                <th class="p-2 text-right">Achievement</th>
                <th class="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              ${indicators
                .map(
                  (ind) => `
                <tr class="hover:bg-slate-50">
                  <td class="p-2 text-sm text-slate-700">${escapeHtml(ind.project)}</td>
                  <td class="p-2 text-sm text-slate-600">${escapeHtml(ind.indicator)}</td>
                  <td class="p-2 text-sm text-right">${fmtNum(ind.target)}</td>
                  <td class="p-2 text-sm text-right">${fmtNum(ind.actual)}</td>
                  <td class="p-2 text-sm text-right font-medium">${ind.achievement.toFixed(1)}%</td>
                  <td class="p-2 text-center">${ragBadge(ind.rag)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Render achievement bar chart
    const indCategories = indKeys;
    const indAchievements = indKeys.map((k) => {
      const g = indGroups[k];
      return g.values.reduce((s, v) => s + v.achievement, 0) / g.values.length;
    });

    Highcharts.chart("indicatorChart", {
      chart: { type: "bar", backgroundColor: "transparent" },
      title: { text: null },
      xAxis: {
        categories: indCategories,
        labels: { style: { fontSize: "9px" } },
      },
      yAxis: {
        title: { text: "Achievement %" },
        max: 100,
        labels: { format: "{value}%" },
      },
      tooltip: {
        formatter: function () {
          return this.key + ": <b>" + this.y.toFixed(1) + "%</b>";
        },
      },
      plotOptions: {
        bar: { borderRadius: 3 },
      },
      series: [
        {
          name: "Achievement %",
          data: indAchievements.map((v) => ({
            y: Math.round(v * 10) / 10,
            color: v >= 90 ? "#10b981" : v >= 75 ? "#f59e0b" : "#ef4444",
          })),
          dataLabels: {
            enabled: true,
            format: "{y}%",
            style: { fontSize: "9px" },
          },
        },
      ],
      legend: { enabled: false },
      credits: { enabled: false },
    });

    // RAG distribution donut
    const onTrack = indicators.filter((i) => i.rag === "On Track").length;
    const watch = indicators.filter((i) => i.rag === "Watch").length;
    const offTrack = indicators.filter((i) => i.rag === "Off Track").length;
    const na = indicators.filter((i) => i.rag === "N/A" || !i.rag).length;

    Highcharts.chart("ragDistributionChart", {
      chart: { type: "pie", backgroundColor: "transparent" },
      title: { text: null },
      tooltip: {
        formatter: function () {
          return (
            this.key +
            ": <b>" +
            this.y +
            "</b> (" +
            this.percentage.toFixed(1) +
            "%)"
          );
        },
      },
      plotOptions: {
        pie: {
          innerSize: "60%",
          dataLabels: {
            enabled: true,
            format: "<b>{point.name}</b>: {point.y}",
            style: { fontSize: "10px" },
          },
        },
      },
      series: [
        {
          data: [
            { name: "On Track", y: onTrack, color: "#10b981" },
            { name: "Watch", y: watch, color: "#f59e0b" },
            { name: "Off Track", y: offTrack, color: "#ef4444" },
            ...(na > 0 ? [{ name: "N/A", y: na, color: "#94a3b8" }] : []),
          ],
        },
      ],
      credits: { enabled: false },
    });
  } catch (err) {
    container.innerHTML = `
      <div class="p-8 text-center">
        <div class="text-4xl mb-2">📈</div>
        <p class="text-sm font-medium text-slate-700">Indicator Performance Unavailable</p>
        <p class="text-xs text-slate-400 mt-1">${escapeHtml(err.message)}</p>
        <button onclick="renderIndicatorPerformanceSubtab(container)" class="mt-3 px-4 py-2 bg-sky-600 text-white text-xs rounded-lg hover:bg-sky-700">Retry</button>
      </div>`;
  }
}

// ── Health Summary Subtab ──
async function renderHealthSummarySubtab(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex items-center justify-center py-20 text-slate-400 text-sm gap-2">
        <div class="w-5 h-5 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
        Loading health summary…
      </div>
    </div>
  `;

  try {
    // Fetch seed data
    const resp = await fetch("/api/project-portfolio/seed");
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || "Failed to load");

    const projects = data.projects || {};
    const slugs = Object.keys(projects);

    if (!slugs.length) {
      container.innerHTML = `<div class="p-8 text-center text-slate-400">No health summary data available.</div>`;
      return;
    }

    // Build RAG summary per county across all projects
    const countyHealth = {};
    slugs.forEach((slug) => {
      const proj = projects[slug];
      if (!proj.counties) return;
      Object.entries(proj.counties).forEach(([cName, cData]) => {
        if (!countyHealth[cName]) {
          countyHealth[cName] = {
            onTrack: 0,
            watch: 0,
            offTrack: 0,
            totalBudget: 0,
            totalExpenditure: 0,
            facilityCount: 0,
            projectCount: 0,
            metrics: [],
          };
        }
        countyHealth[cName].totalBudget += cData.allocated_budget || 0;
        countyHealth[cName].totalExpenditure += cData.actual_expenditure || 0;
        countyHealth[cName].facilityCount += cData.facility_count || 0;
        countyHealth[cName].projectCount += 1;

        const utilPct =
          cData.allocated_budget > 0
            ? (cData.actual_expenditure / cData.allocated_budget) * 100
            : 0;
        const rag =
          utilPct > 110 ? "offTrack" : utilPct > 90 ? "watch" : "onTrack";
        countyHealth[cName].metrics.push({
          project: getProjectDisplayName(slug),
          budgetUtil: utilPct,
          beneficiaries: cData.beneficiaries_served || 0,
          rag,
        });

        if (rag === "onTrack") countyHealth[cName].onTrack += 1;
        else if (rag === "watch") countyHealth[cName].watch += 1;
        else countyHealth[cName].offTrack += 1;
      });
    });

    // Filter by selected filters
    let filteredHealth = Object.entries(countyHealth);
    if (state.countyFilter && state.countyFilter !== "all") {
      filteredHealth = filteredHealth.filter(
        ([k]) => k.toLowerCase() === state.countyFilter.toLowerCase(),
      );
    }
    if (state.projectFilter && state.projectFilter !== "all") {
      filteredHealth = filteredHealth.map(([k, v]) => {
        const filteredMetrics = v.metrics.filter(
          (m) => toSlug(m.project) === state.projectFilter,
        );
        return [k, { ...v, metrics: filteredMetrics }];
      });
      filteredHealth = filteredHealth.filter(([_, v]) => v.metrics.length > 0);
    }

    const totalOnTrack = filteredHealth.reduce((s, [_, v]) => s + v.onTrack, 0);
    const totalWatch = filteredHealth.reduce((s, [_, v]) => s + v.watch, 0);
    const totalOffTrack = filteredHealth.reduce(
      (s, [_, v]) => s + v.offTrack,
      0,
    );
    const totalMetrics = totalOnTrack + totalWatch + totalOffTrack;
    const healthScore =
      totalMetrics > 0
        ? Math.round(((totalOnTrack + totalWatch * 0.5) / totalMetrics) * 100)
        : 0;

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Health Score card -->
        <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-xs text-slate-500 uppercase tracking-wider font-semibold">Portfolio Health Score</div>
              <div class="text-3xl font-bold mt-1 ${healthScore >= 80 ? "text-emerald-600" : healthScore >= 60 ? "text-amber-600" : "text-red-600"}">${healthScore}%</div>
              <div class="text-xs text-slate-400 mt-1">Based on ${fmtNum(totalMetrics)} performance metrics across ${fmtNum(filteredHealth.length)} counties</div>
            </div>
            <div class="flex gap-3">
              <div class="text-center">
                <div class="w-3 h-3 rounded-full bg-emerald-500 mx-auto"></div>
                <div class="text-xs text-slate-500 mt-1">On Track</div>
                <div class="text-sm font-bold text-slate-700">${fmtNum(totalOnTrack)}</div>
              </div>
              <div class="text-center">
                <div class="w-3 h-3 rounded-full bg-amber-500 mx-auto"></div>
                <div class="text-xs text-slate-500 mt-1">Watch</div>
                <div class="text-sm font-bold text-slate-700">${fmtNum(totalWatch)}</div>
              </div>
              <div class="text-center">
                <div class="w-3 h-3 rounded-full bg-red-500 mx-auto"></div>
                <div class="text-xs text-slate-500 mt-1">Off Track</div>
                <div class="text-sm font-bold text-slate-700">${fmtNum(totalOffTrack)}</div>
              </div>
            </div>
          </div>
          <!-- Health score bar -->
          <div class="mt-4 bg-slate-100 rounded-full h-3 overflow-hidden">
            <div class="h-full rounded-full transition-all duration-500" style="width:${healthScore}%;background:${healthScore >= 80 ? "#10b981" : healthScore >= 60 ? "#f59e0b" : "#ef4444"}"></div>
          </div>
        </div>

        <!-- Heatmap grid -->
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h3 class="text-sm font-semibold text-slate-700 mb-3">County Health Heatmap</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            ${filteredHealth
              .map(([cName, v]) => {
                const status =
                  v.offTrack > v.onTrack && v.offTrack > v.watch
                    ? "offTrack"
                    : v.watch > v.onTrack
                      ? "watch"
                      : "onTrack";
                const bgColor =
                  status === "onTrack"
                    ? "bg-emerald-50 border-emerald-200"
                    : status === "watch"
                      ? "bg-amber-50 border-amber-200"
                      : "bg-red-50 border-red-200";
                const textColor =
                  status === "onTrack"
                    ? "text-emerald-700"
                    : status === "watch"
                      ? "text-amber-700"
                      : "text-red-700";
                const badgeColor =
                  status === "onTrack"
                    ? "bg-emerald-500"
                    : status === "watch"
                      ? "bg-amber-500"
                      : "bg-red-500";
                return `
                <div class="rounded-lg border ${bgColor} p-3 ${textColor}">
                  <div class="flex items-center justify-between">
                    <span class="font-semibold text-sm">${escapeHtml(cName.replace(" County", ""))}</span>
                    <span class="w-2.5 h-2.5 rounded-full ${badgeColor}"></span>
                  </div>
                  <div class="mt-2 flex gap-2 text-xs">
                    <span>✅ ${v.onTrack}</span>
                    <span>👀 ${v.watch}</span>
                    <span>❌ ${v.offTrack}</span>
                  </div>
                  <div class="mt-1 text-xs opacity-75">${fmtNum(v.facilityCount)} facilities • ${fmtCurrencyShort(v.totalBudget)}</div>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>

        <!-- Detailed county breakdown -->
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm overflow-x-auto">
          <h3 class="text-sm font-semibold text-slate-700 mb-3">Detailed County Performance</h3>
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-slate-50 text-slate-500 uppercase tracking-wider">
                <th class="p-2 text-left">County</th>
                <th class="p-2 text-right">Budget</th>
                <th class="p-2 text-right">Expenditure</th>
                <th class="p-2 text-right">Util. %</th>
                <th class="p-2 text-center">On Track</th>
                <th class="p-2 text-center">Watch</th>
                <th class="p-2 text-center">Off Track</th>
                <th class="p-2 text-center">Overall</th>
              </tr>
            </thead>
            <tbody>
              ${filteredHealth
                .map(([cName, v]) => {
                  const utilPct =
                    v.totalBudget > 0
                      ? (v.totalExpenditure / v.totalBudget) * 100
                      : 0;
                  const status =
                    v.offTrack > v.onTrack && v.offTrack > v.watch
                      ? "Off Track"
                      : v.watch > v.onTrack
                        ? "Watch"
                        : "On Track";
                  return `
                  <tr class="hover:bg-slate-50">
                    <td class="p-2 text-sm font-medium text-slate-700">${escapeHtml(cName)}</td>
                    <td class="p-2 text-sm text-right">${fmtCurrency(v.totalBudget)}</td>
                    <td class="p-2 text-sm text-right">${fmtCurrency(v.totalExpenditure)}</td>
                    <td class="p-2 text-sm text-right">${utilPct.toFixed(1)}%</td>
                    <td class="p-2 text-center text-emerald-600 font-medium">${v.onTrack}</td>
                    <td class="p-2 text-center text-amber-600 font-medium">${v.watch}</td>
                    <td class="p-2 text-center text-red-600 font-medium">${v.offTrack}</td>
                    <td class="p-2 text-center">${ragBadge(status)}</td>
                  </tr>
                `;
                })
                .join("")}
            </tbody>
          </table>
        </div>

        <!-- Per-project metric breakdown -->
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm overflow-x-auto">
          <h3 class="text-sm font-semibold text-slate-700 mb-3">Project-Level Metrics by County</h3>
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-slate-50 text-slate-500 uppercase tracking-wider">
                <th class="p-2 text-left">County</th>
                <th class="p-2 text-left">Project</th>
                <th class="p-2 text-right">Budget Utilisation</th>
                <th class="p-2 text-right">Beneficiaries</th>
                <th class="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredHealth
                .map(([cName, v]) => {
                  return v.metrics
                    .map(
                      (m) => `
                  <tr class="hover:bg-slate-50">
                    <td class="p-2 text-sm text-slate-600">${escapeHtml(cName.replace(" County", ""))}</td>
                    <td class="p-2 text-sm text-slate-700 font-medium">${escapeHtml(m.project)}</td>
                    <td class="p-2 text-sm text-right">${m.budgetUtil.toFixed(1)}%</td>
                    <td class="p-2 text-sm text-right">${fmtNum(m.beneficiaries)}</td>
                    <td class="p-2 text-center">${ragBadge(m.rag === "onTrack" ? "On Track" : m.rag === "watch" ? "Watch" : "Off Track")}</td>
                  </tr>
                `,
                    )
                    .join("");
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="p-8 text-center">
        <div class="text-4xl mb-2">🏥</div>
        <p class="text-sm font-medium text-slate-700">Health Summary Unavailable</p>
        <p class="text-xs text-slate-400 mt-1">${escapeHtml(err.message)}</p>
        <button onclick="renderHealthSummarySubtab(container)" class="mt-3 px-4 py-2 bg-sky-600 text-white text-xs rounded-lg hover:bg-sky-700">Retry</button>
      </div>`;
  }
}

// ── Narratives Subtab ──
async function renderNarrativesSubtab(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex items-center justify-center py-20 text-slate-400 text-sm gap-2">
        <div class="w-5 h-5 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
        Loading narratives…
      </div>
    </div>
  `;

  try {
    const resp = await fetch("/api/project-portfolio/narratives");
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || "Failed to load");

    let narratives = Object.values(data.narratives || {});

    if (!narratives.length) {
      container.innerHTML = `<div class="p-8 text-center text-slate-400">No narratives available.</div>`;
      return;
    }

    // Filter by project if selected
    if (state.projectFilter && state.projectFilter !== "all") {
      narratives = narratives.filter((n) => n.slug === state.projectFilter);
    }

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Summary -->
        <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold text-slate-700">Programme Manager's Narratives</h2>
              <p class="text-xs text-slate-400 mt-0.5">${fmtNum(narratives.length)} project narrative${narratives.length !== 1 ? "s" : ""} available for the reporting period</p>
            </div>
            ${
              state.projectFilter && state.projectFilter !== "all"
                ? `
              <span class="text-xs bg-sky-100 text-sky-700 px-2 py-1 rounded">Filtered: ${escapeHtml(getProjectDisplayName(state.projectFilter))}</span>
            `
                : ""
            }
          </div>
        </div>

        ${narratives
          .map((n) => {
            const rag = n.overall_rag || "N/A";
            const ragColor =
              rag === "On Track"
                ? "border-l-emerald-500"
                : rag === "Watch"
                  ? "border-l-amber-500"
                  : rag === "Off Track"
                    ? "border-l-red-500"
                    : "border-l-slate-300";

            return `
            <div class="bg-white rounded-xl border border-slate-200 border-l-4 ${ragColor} shadow-sm overflow-hidden">
              <!-- Header -->
              <div class="p-4 pb-3 border-b border-slate-100">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-sm font-bold text-slate-800">${escapeHtml(n.project_name || getProjectDisplayName(n.slug))}</h3>
                    <p class="text-xs text-slate-400 mt-0.5">Reporting Month: ${escapeHtml(n.reporting_month || "N/A")}</p>
                  </div>
                  <div class="flex items-center gap-2">
                    ${ragBadge(rag)}
                  </div>
                </div>
              </div>

              <!-- Key Achievements -->
              <div class="p-4 pb-2">
                <h4 class="text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                  <span>🏆</span> Key Achievements
                </h4>
                <p class="text-sm text-slate-600 mt-1 leading-relaxed">${escapeHtml(n.key_achievements || "No key achievements reported for this period.")}</p>
              </div>

              <!-- Narrative -->
              <div class="px-4 pb-4">
                <h4 class="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <span>📝</span> Programme Manager's Narrative
                </h4>
                <p class="text-sm text-slate-600 mt-1 leading-relaxed">${escapeHtml(n.narrative || "Narrative not yet submitted.")}</p>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="p-8 text-center">
        <div class="text-4xl mb-2">📋</div>
        <p class="text-sm font-medium text-slate-700">Narratives Unavailable</p>
        <p class="text-xs text-slate-400 mt-1">${escapeHtml(err.message)}</p>
        <button onclick="renderNarrativesSubtab(container)" class="mt-3 px-4 py-2 bg-sky-600 text-white text-xs rounded-lg hover:bg-sky-700">Retry</button>
      </div>`;
  }
}
