// ============================================================
// dashboard.js  (extracted from main.js lines 4480-5402)
// domain section 4480-5402
// ============================================================

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
    if (isChakProject()) {
      // CHAK project overview — show datasets grid, summary, dashboards
      hidePageContext();
      elements.chartRoot.innerHTML =
        '<div id="chakProjectRoot" class="space-y-6"></div>';
      renderChakProjectOverview();
      return;
    }
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

  // ── CHAK Dataset Detail Page ──
  if (pageId === "chak_dataset" && state.activeDatasetId) {
    hidePageContext();
    renderChakDatasetDetail();
    return;
  }

  // ── CHAK Dashboard Detail Page ──
  if (pageId === "chak_dashboard" && state.activeDashboardId) {
    hidePageContext();
    renderChakDashboardDetail();
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

