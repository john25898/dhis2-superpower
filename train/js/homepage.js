// ============================================================
// homepage.js  (extracted from main.js lines 5977-7557)
// domain section 5977-7557
// ============================================================
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
    { threshold: 0.05, rootMargin: "0px 0px 0px 0px" },
  );
  document
    .querySelectorAll(".hp-fade-in, .hp-slide-left, .hp-slide-right")
    .forEach((el) => {
      // Immediately reveal if already in viewport
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight + 50 && rect.bottom > -50) {
        el.classList.add("visible");
      } else {
        _hpObserver.observe(el);
      }
    });
  // Reveal hero content immediately (always visible on load)
  document.querySelectorAll(".hp-hero .hp-fade-in").forEach((el) => {
    el.classList.add("visible");
  });

  // ── Scroll cue: fade out when user scrolls down ──
  const scrollCue = document.querySelector(".hp-scroll-cue");
  if (scrollCue) {
    const onScroll = () => {
      if (window.scrollY > 80) scrollCue.classList.add("faded");
      else scrollCue.classList.remove("faded");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
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
  chap_stawisha: {
    border: "#10b981",
    bg: "#ecfdf5",
    accent: "#059669",
    gradient: "from-emerald-500 to-green-600",
  },
  gf_mnch: {
    border: "#f43f5e",
    bg: "#fff1f2",
    accent: "#e11d48",
    gradient: "from-rose-500 to-pink-600",
  },
  eye_health: {
    border: "#a855f7",
    bg: "#faf5ff",
    accent: "#9333ea",
    gradient: "from-purple-500 to-fuchsia-600",
  },
  impact: {
    border: "#f97316",
    bg: "#fff7ed",
    accent: "#ea580c",
    gradient: "from-orange-500 to-amber-600",
  },
  gitlab: {
    border: "#6366f1",
    bg: "#eef2ff",
    accent: "#4f46e5",
    gradient: "from-indigo-500 to-blue-600",
  },
  bftw_rmncah: {
    border: "#f59e0b",
    bg: "#fffbeb",
    accent: "#d97706",
    gradient: "from-amber-500 to-yellow-600",
  },
  eis: {
    border: "#06b6d4",
    bg: "#ecfeff",
    accent: "#0891b2",
    gradient: "from-cyan-500 to-teal-600",
  },
  cdic_icare: {
    border: "#64748b",
    bg: "#f8fafc",
    accent: "#475569",
    gradient: "from-slate-500 to-slate-700",
  },
  internship: {
    border: "#ec4899",
    bg: "#fdf2f8",
    accent: "#db2777",
    gradient: "from-pink-500 to-rose-600",
  },
  pep: {
    border: "#84cc16",
    bg: "#f7fee7",
    accent: "#65a30d",
    gradient: "from-lime-500 to-green-600",
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
  let portfolioData = {};
  let narrativesData = {};
  try {
    const [facResp, projResp, portResp, narrResp] = await Promise.all([
      fetch("/api/khis/facility-locations"),
      fetch("/api/projects/facility-mapping"),
      fetch("/api/project-portfolio"),
      fetch("/api/project-portfolio/narratives"),
    ]);
    const facJson = await facResp.json();
    const projJson = await projResp.json();
    const portJson = await portResp.json();
    const narrJson = await narrResp.json();
    if (facJson.ok) facilityData = facJson.facilities || {};
    if (projJson.ok) projectData = projJson.projects || {};
    if (portJson.ok) portfolioData = portJson.projects || {};
    if (narrJson.ok) narrativesData = narrJson.narratives || {};
  } catch (e) {
    root.innerHTML = `<div class="text-red-500 text-sm py-8 text-center">Failed to load project data: ${escapeHtml(e.message)}</div>`;
    return;
  }

  // ── Helper: get indicators for a project slug from portfolio data ──
  function _getProjectIndicators(slug) {
    const portfolioSlug = slug.replace(/_/g, "-");
    const proj = portfolioData[portfolioSlug] || {};
    return (proj.section_b && proj.section_b.indicators) || [];
  }

  // ── Helper: get narrative data for a project slug ──
  function _getProjectNarrative(slug) {
    const portfolioSlug = slug.replace(/_/g, "-");
    return narrativesData[portfolioSlug] || null;
  }

  // ── Helper: compute indicator summary stats for a project ──
  function _computeIndStats(indicators) {
    if (!indicators.length) return null;
    const total = indicators.length;
    const onTrack = indicators.filter((i) => i.rag === "On Track").length;
    const watch = indicators.filter((i) => i.rag === "Watch").length;
    const offTrack = indicators.filter((i) => i.rag === "Off Track").length;
    const avgAchievement =
      indicators.reduce((s, i) => s + _parsePct(i.achievement_pct), 0) / total;
    return { total, onTrack, watch, offTrack, avgAchievement };
  }

  // ── Helper: parse achievement percentage (may be number, "85.0%", null, etc.) ──
  function _parsePct(val) {
    if (val === null || val === undefined || val === "N/A" || val === "")
      return 0;
    if (typeof val === "number") return Math.min(val, 100);
    const str = String(val).replace(/[^0-9.\-]/g, "");
    const n = parseFloat(str);
    return isNaN(n) ? 0 : Math.min(n, 100);
  }

  // ── Real indicator names (replaces "Tracer Indicator N" across all projects) ──
  // Comes from key-indicators API (HIV indicators)
  const _REAL_INDICATOR_NAMES = [
    "HTS Positive",
    "Linkage",
    "% VL Suppression",
    "% VL Uptake",
    "%IIT",
    "TX_NEW",
    "TPT",
    "TPT Uptake",
  ];

  function _getIndicatorDisplayName(indicatorName) {
    const match = indicatorName.match(/Tracer Indicator (\d+)/i);
    if (!match) return indicatorName;
    const idx = parseInt(match[1], 10) - 1;
    return _REAL_INDICATOR_NAMES[idx] || indicatorName;
  }

  // ── Helper: render Key Achievements card (top of JT section) ──
  function _renderKeyAchievements(slug) {
    const narrative = _getProjectNarrative(slug);
    if (!narrative?.key_achievements) return "";
    return `
      <div class="relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-md transition-shadow duration-200">
        <div class="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-emerald-400 to-emerald-500"></div>
        <div class="p-4 pl-5">
          <div class="flex items-center gap-2.5 mb-3">
            <div class="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-sm flex-shrink-0 ring-1 ring-emerald-200/50">🏆</div>
            <span class="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Key Achievements</span>
            <span class="text-[10px] font-medium text-emerald-400 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 ml-auto">${escapeHtml(narrative?.reporting_month || "")}</span>
          </div>
          <p class="text-sm text-slate-600 leading-relaxed">${escapeHtml(narrative.key_achievements)}</p>
        </div>
      </div>`;
  }

  // ── Helper: render Programme Manager's Narrative (bottom) ──
  function _renderNarrative(slug) {
    const narrative = _getProjectNarrative(slug);
    if (!narrative?.narrative) return "";
    return `
      <div class="relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group hover:shadow-md transition-shadow duration-200">
        <div class="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-sky-400 to-sky-500"></div>
        <div class="p-4 pl-5">
          <div class="flex items-center gap-2.5 mb-3">
            <div class="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sm flex-shrink-0 ring-1 ring-sky-200/50">📝</div>
            <span class="text-xs font-semibold text-sky-700 uppercase tracking-wider">Programme Manager's Narrative</span>
          </div>
          <div class="hp-narrative-container">
            <p class="text-sm text-slate-600 leading-relaxed hp-narrative-text">${escapeHtml(narrative.narrative)}</p>
            ${
              narrative.narrative && narrative.narrative.length > 250
                ? `<button class="hp-narrative-toggle mt-2 text-xs font-medium text-sky-600 hover:text-sky-700 transition-colors" onclick="this.previousElementSibling.classList.toggle('hp-narrative-expanded');this.textContent=this.previousElementSibling.classList.contains('hp-narrative-expanded')?'Show less ↑':'Read more →'">Read more →</button>`
                : ""
            }
          </div>
        </div>
      </div>`;
  }

  // ── Helper: render indicator donut charts (beside the map) ──
  function _renderIndicatorDonuts(slug) {
    const indicators = _getProjectIndicators(slug);
    if (!indicators.length) return "";
    const indStats = _computeIndStats(indicators);
    const avgPct = indStats ? indStats.avgAchievement : 0;

    const donuts = indicators
      .map((ind) => {
        const pct = _parsePct(ind.achievement_pct);
        const r = 28;
        const circumference = 2 * Math.PI * r;
        const offset = circumference - (pct / 100) * circumference;
        const color = pct >= 90 ? "#10b981" : pct >= 75 ? "#f59e0b" : "#ef4444";
        return `
        <div class="hp-donut-item flex items-center gap-3 bg-white rounded-lg border border-slate-100 p-2.5 hover:shadow-sm hover:border-slate-200 transition-all">
          <div class="flex-shrink-0 relative" style="width:68px;height:68px;">
            <svg width="68" height="68" viewBox="0 0 68 68">
              <circle cx="34" cy="34" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="6"/>
              <circle cx="34" cy="34" r="${r}" fill="none" stroke="${color}" stroke-width="6"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${offset}"
                stroke-linecap="round"
                transform="rotate(-90 34 34)"
                style="transition: stroke-dashoffset 1s ease"/>
            </svg>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-[10px] font-bold" style="color:${color}">${pct.toFixed(0)}%</span>
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-[11px] font-medium text-slate-700 leading-tight truncate">${escapeHtml(_getIndicatorDisplayName(ind.indicator))}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">
              T: <span class="font-medium text-slate-500">${fmtNum(ind.annual_target)}</span>
              &middot; A: <span class="font-medium text-slate-500">${fmtNum(ind.actual_cumulative)}</span>
            </div>
            <span class="inline-block mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
              pct >= 90
                ? "bg-emerald-50 text-emerald-600"
                : pct >= 75
                  ? "bg-amber-50 text-amber-600"
                  : "bg-red-50 text-red-600"
            }">${ind.rag || "—"}</span>
          </div>
        </div>`;
      })
      .join("");

    return `
      <div class="hp-donut-panel">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-slate-700">📊 Performance Summary</span>
            <span class="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">${indStats.total} indicators</span>
          </div>
          <div class="flex items-center gap-2 text-[10px]">
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span> ${indStats.onTrack}</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> ${indStats.watch}</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-400 inline-block"></span> ${indStats.offTrack}</span>
          </div>
        </div>
        <div class="space-y-2 max-h-[360px] overflow-y-auto pr-1 hp-donut-scroll">
          ${donuts}
        </div>
      </div>`;
  }

  // ── Wrapper: full performance panel for carousel detail ──
  function _renderProjectPerformanceSection(slug) {
    const ach = _renderKeyAchievements(slug);
    const donuts = _renderIndicatorDonuts(slug);
    const narr = _renderNarrative(slug);
    if (!ach && !donuts && !narr) return "";
    return `<div class="hp-perf-section space-y-4">${ach}${donuts}${narr}</div>`;
  }

  const projectIds = Object.keys(projectData);
  const jamiiIdx = projectIds.indexOf("jamii_tekelezi");
  if (jamiiIdx > 0) {
    projectIds.splice(jamiiIdx, 1);
    projectIds.unshift("jamii_tekelezi");
  }
  if (!projectIds.length) {
    root.innerHTML = `<div class="text-slate-500 text-sm py-8 text-center">No projects found.</div>`;
    return;
  }

  const mhuFacilityIds = new Set();
  try {
    const mhuResp = await fetch("/api/mhu/config");
    const mhuConfig = await mhuResp.json();
    if (mhuConfig.facilities)
      Object.keys(mhuConfig.facilities).forEach((id) => mhuFacilityIds.add(id));
  } catch (_) {}

  // ── Compute overall stats ──
  const allCounties = new Set();
  projectIds.forEach((pid) => {
    const proj = projectData[pid] || {};
    (proj.counties || []).forEach((c) => allCounties.add(c));
  });
  // Confirmed CHAK MHU total (from the 586-row CONFIRMED MFL codes workbook)
  const CONFIRMED_MHU_TOTAL = 586;

  // ── Build HTML ──
  let html = '<div class="hp-scroll-cue"></div>';
  html += '<div class="space-y-6">';

  // ═══════════════════════════════════
  // HERO SECTION (keep the same)
  // ═══════════════════════════════════
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
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8 hp-fade-in hp-stagger-1">
          <div class="text-center cursor-pointer hp-mhu-stat" data-mhu-list="all" title="View the full MHU list" role="button"><div class="hp-hero-count" id="hero-count-mhus">0</div><div class="hp-hero-label">🏥 MHUs</div></div>
          <div class="text-center"><div class="hp-hero-count" id="hero-count-counties">0</div><div class="hp-hero-label">🗺️ Counties</div></div>
          <div class="text-center"><div class="hp-hero-count" id="hero-count-projects">0</div><div class="hp-hero-label">📋 Projects</div></div>
        </div>
        <div class="flex flex-wrap gap-2 mt-6 hp-fade-in hp-stagger-2">
          <span class="inline-flex items-center gap-1.5 text-xs bg-white/15 text-white/90 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">📊 Last 12 months</span>
          <span class="inline-flex items-center gap-1.5 text-xs bg-white/15 text-white/90 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">📍 Kenya-wide coverage</span>
          <span class="inline-flex items-center gap-1.5 text-xs bg-white/15 text-white/90 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">🔬 KHIS Integration</span>
          <span class="inline-flex items-center gap-1.5 text-xs bg-white/15 text-white/90 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">📱 MOH 717 · MOH 740</span>
        </div>
        <div class="flex flex-wrap gap-2.5 mt-5 hp-fade-in hp-stagger-3">
          <button type="button" class="hp-hero-mhu-btn" data-mhu-list="all">📋 View MHUs</button>
          <button type="button" class="hp-hero-mhu-btn" data-mhu-csv="all">⬇️ Download CSV</button>
        </div>
      </div>
    </div>`;

  // ═══════════════════════════════════
  // TAB BAR: Projects | Counties
  // ═══════════════════════════════════
  html += `
    <div class="flex gap-0 border-b border-slate-200 hp-fade-in hp-stagger-4">
      <button id="hp-tab-projects" class="hp-tab-btn active" data-mode="projects">📋 Projects</button>
      <button id="hp-tab-counties" class="hp-tab-btn" data-mode="counties">🗺️ Counties</button>
    </div>
    <div id="hp-content" class="space-y-5">`;

  // ═══════════════════════════════════
  // PROJECTS VIEW — Featured + Carousel
  // ═══════════════════════════════════
  html += `<div id="hp-projects-view"><div class="space-y-5">`;

  // Separate featured projects (JT, Stawisha) from carousel projects
  const featuredPids = ["jamii_tekelezi", "chap_stawisha"];
  const carouselPids = projectIds.filter((pid) => !featuredPids.includes(pid));

  // ── Featured Project Rows ──
  for (const pid of featuredPids) {
    const proj = projectData[pid] || {};
    if (!proj.name) continue;
    const mhuCount = proj.mhu_count || 0;
    const projCounties = proj.counties || [];
    const projName = proj.name || pid;
    const projIcon = proj.icon || "📋";
    const projDesc = proj.description || "";
    const mapId = `map-${pid}`;
    const col = _projColor(pid);
    const accentColor = col.border;
    const iconBg = col.bg;

    html += `
      <div class="hp-featured-card hp-slide-left hp-stagger-4" style="--accent:${accentColor};">
        <!-- Featured top: icon + info + actions -->
        <div class="hp-featured-top">
          <div class="hp-featured-icon" style="background:${iconBg};color:${accentColor};">${projIcon}</div>
          <div class="hp-featured-info">
            <div class="hp-featured-name">${escapeHtml(projName)}</div>
            <div class="hp-featured-desc">${escapeHtml(projDesc)}</div>
          </div>
          <div class="hp-featured-actions">
            <span class="hp-featured-badge">⭐ Featured</span>
            <div class="hp-view-project-btn" data-project="${pid}" style="display:inline-flex;align-items:center;gap:3px;font-size:0.8rem;font-weight:600;color:${accentColor};cursor:pointer;padding:6px 14px;border-radius:8px;transition:background 0.2s;" onmouseover="this.style.background='${iconBg}'" onmouseout="this.style.background='transparent'">View →</div>
            <div class="hp-expand-btn open" data-target="body-${pid}"><span class="hp-expand-icon open">▼</span></div>
          </div>
        </div>

        <!-- Stats row (green gradient KPI cards) -->
        <div class="grid grid-cols-2 gap-3 mt-5">
          <div class="hp-stat-card hp-mhu-stat" data-mhu-list="${pid}" title="View MHU list" style="cursor:pointer;background:linear-gradient(180deg, #8fc4a0 0%, #e0e5d5 100%)"><div class="hp-stat-icon">🏥</div><div class="hp-stat-number">${mhuCount.toLocaleString()}</div><div class="hp-stat-label">MHUs</div></div>
          <div class="hp-stat-card" style="background:linear-gradient(180deg, #8fc4a0 0%, #e0e5d5 100%)"><div class="hp-stat-icon">🗺️</div><div class="hp-stat-number">${projCounties.length.toLocaleString()}</div><div class="hp-stat-label">Counties</div></div>
        </div>
        <div class="flex flex-wrap gap-2 mt-3">
          <button type="button" class="hp-card-mhu-btn" data-mhu-list="${pid}" style="color:${accentColor};border-color:${accentColor};background:${iconBg};">📋 View MHUs</button>
          <button type="button" class="hp-card-mhu-btn" data-mhu-csv="${pid}" style="color:${accentColor};border-color:${accentColor};">⬇️ CSV</button>
        </div>

        <!-- Expandable body: open by default -->
        <div id="body-${pid}" class="hp-card-body open">
          <div class="border-t border-slate-100 pt-4 mt-4">
            ${_renderKeyAchievements(pid)}
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
              <div class="hp-map-col">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xs font-semibold text-slate-600">🗺️ Facility Coverage</span>
                </div>
                <div id="${mapId}" class="hp-card-map"></div>
                <div class="hp-map-filters" id="${mapId}-filters">
                  <button class="hp-map-filter-btn active" data-map="${mapId}" data-mode="mhu">🏥 MHUs</button>
                  <button class="hp-map-filter-btn" data-map="${mapId}" data-mode="county">🗺️ Counties</button>
                  <button class="hp-map-filter-btn" data-map="${mapId}" data-mode="facility">📍 Facilities</button>
                </div>
              </div>
              <div class="hp-donut-col">
                ${_renderIndicatorDonuts(pid)}
              </div>
            </div>
            ${_renderNarrative(pid)}
        </div>
        ${
          pid === "jamii_tekelezi"
            ? `
        <div id="key-indicators-root" class="rounded-2xl border border-purple-200 bg-white p-5 shadow-sm hp-slide-right hp-stagger-4 mt-5">
          <div class="flex items-center gap-2 mb-4">
            <span class="text-lg">📊</span>
            <span class="font-semibold text-sm text-slate-800">Key Indicators Drill Down</span>
            <span class="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Facility-level summary</span>
          </div>
          <div id="ki-loading" class="text-xs text-slate-400 py-6 text-center">Loading key indicators…</div>
          <div id="ki-cards" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 hidden"></div>
          <div id="ki-error" class="text-xs text-red-500 hidden"></div>
        </div>`
            : ""
        }
      </div>`;
  }

  // ── Key Indicators are now rendered inside Jamii Tekelezi card body ──

  // ── Carousel: Other Projects (auto-scrolling conveyor belt) ──
  if (carouselPids.length) {
    html += `
    <div class="hp-carousel-wrapper hp-slide-right hp-stagger-5">
      <div class="hp-carousel-header">
        <span class="hp-carousel-title">📋 Other Projects <span class="text-xs font-normal text-slate-400">(${carouselPids.length} projects)</span></span>
        <div class="hp-carousel-controls">
          <button class="hp-carousel-btn" id="carousel-prev" title="Scroll left">‹</button>
          <button class="hp-carousel-btn" id="carousel-next" title="Scroll right">›</button>
        </div>
      </div>
      <div class="hp-carousel-viewport">
        <div class="hp-carousel-track" id="carousel-track">`;

    // Build carousel card set
    function _renderCarouselCard(pid, proj) {
      const cMhuCount = proj.mhu_count || 0;
      const cCounties = proj.counties || [];
      const cName = proj.name || pid;
      const cIcon = proj.icon || "📋";
      const cDesc = proj.description || "";
      const cCol = _projColor(pid);
      // Performance mini badge
      const cIndicators = _getProjectIndicators(pid);
      const cIndStats = _computeIndStats(cIndicators);
      let perfBadge = "";
      if (cIndStats) {
        const pct = cIndStats.avgAchievement;
        const pctCls =
          pct >= 90
            ? "bg-emerald-100 text-emerald-700"
            : pct >= 75
              ? "bg-amber-100 text-amber-700"
              : "bg-red-100 text-red-700";
        perfBadge = `<div class="hp-carousel-perf-badge ${pctCls}">📊 ${pct.toFixed(0)}%</div>`;
      }
      return `
        <div class="hp-carousel-card" style="--accent:${cCol.border};" data-project="${pid}">
          <div class="hp-carousel-card-top">
            <div class="hp-carousel-card-icon" style="background:${cCol.bg};color:${cCol.border};">${cIcon}</div>
            <div class="hp-carousel-card-name">${escapeHtml(cName)}</div>
            ${perfBadge}
          </div>
          <div class="hp-carousel-card-desc">${escapeHtml(cDesc)}</div>
          <div class="hp-carousel-card-stats">
            <div class="hp-carousel-stat cursor-pointer hp-mhu-stat" data-mhu-list="${pid}" title="View MHU list"><div class="hp-carousel-stat-num">${cMhuCount.toLocaleString()}</div><div class="hp-carousel-stat-label">MHUs</div></div>
            <div class="hp-carousel-stat"><div class="hp-carousel-stat-num">${cCounties.length.toLocaleString()}</div><div class="hp-carousel-stat-label">Counties</div></div>
          </div>
          <div class="hp-carousel-card-mhu-actions">
            <button type="button" class="hp-carousel-card-mhu-btn" data-mhu-list="${pid}">🏥 MHUs</button>
            <button type="button" class="hp-carousel-card-mhu-csv" data-mhu-csv="${pid}">⬇️ CSV</button>
          </div>
          <button class="hp-carousel-card-action" data-project="${pid}" style="background:${cCol.border};">View Project →</button>
          <button class="hp-carousel-card-perf-btn" data-project="${pid}" style="border-color:${cCol.border};color:${cCol.border};">📈 Performance</button>
        </div>`;
    }

    // First set
    for (const pid of carouselPids) {
      const proj = projectData[pid] || {};
      html += _renderCarouselCard(pid, proj);
    }
    // Duplicate set for seamless infinite scroll
    for (const pid of carouselPids) {
      const proj = projectData[pid] || {};
      html += _renderCarouselCard(pid, proj);
    }

    html += `
        </div>
      </div>
      <!-- Carousel detail panel -->
      <div id="carousel-detail-panel" class="hidden"></div>
    </div>`;
  }

  html += `</div></div>`; // close carousel track/wrapper, projects-view

  // ── Counties View (hidden by default, shown via tab) ──
  html += `<div id="hp-counties-view" class="hidden"><div class="space-y-5">
    <div class="flex items-center gap-2 mb-2">
      <span class="text-lg">🗺️</span>
      <span class="font-semibold text-sm text-slate-800">County Coverage</span>
      <span class="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">${allCounties.size} counties</span>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">`;
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
      <div class="hp-county-card hp-slide-left hp-stagger-${(ci % 5) + 1}">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-50 to-blue-100 border border-sky-200 flex items-center justify-center text-lg shrink-0">🗺️</div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm text-slate-800">${escapeHtml(county)}</div>
            <div class="text-[11px] text-slate-400">${projs.length} project${projs.length !== 1 ? "s" : ""} · ${countyMhus.toLocaleString()} MHUs</div>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5 mt-3">${projs.map((p) => `<span class="inline-flex items-center gap-1 text-[11px] bg-slate-50 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200 hover:border-sky-300 hover:bg-sky-50 transition">${p.icon} ${escapeHtml(p.name)}</span>`).join("")}</div>
      </div>`;
  });
  html += `</div></div></div>`; // close counties grid, counties-view, hp-content
  html += `</div>`; // close homepageRoot
  root.innerHTML = html;

  // ── Animate hero counters ──
  animateCounter(
    document.getElementById("hero-count-mhus"),
    CONFIRMED_MHU_TOTAL,
    "",
  );
  animateCounter(
    document.getElementById("hero-count-counties"),
    allCounties.size,
    "",
  );
  animateCounter(
    document.getElementById("hero-count-projects"),
    projectIds.length,
    "",
  );

  // ── Initialize maps ──
  initProjectMaps(projectData, mhuFacilityIds);

  // ── Map filter button clicks ──
  document.querySelectorAll(".hp-map-filter-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const mapId = this.dataset.map;
      const mode = this.dataset.mode;
      if (!mapId || !mode) return;
      // Update active state
      const parent = this.closest(".hp-map-filters");
      if (parent) {
        parent
          .querySelectorAll(".hp-map-filter-btn")
          .forEach((b) => b.classList.remove("active"));
      }
      this.classList.add("active");
      // Update map entry mode
      const entry = _projectMaps[mapId];
      if (entry) {
        entry.currentMode = mode;
        updateProjectMapMarkerLayer(mapId, mode);
      }
    });
  });

  // ── Collapsible card toggle (expand button) ──
  document.querySelectorAll(".hp-expand-btn").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      const targetId = this.dataset.target;
      const body = document.getElementById(targetId);
      const icon = this.querySelector(".hp-expand-icon");
      if (!body) return;
      const isOpen = body.classList.contains("open");
      body.classList.toggle("open");
      if (icon) icon.classList.toggle("open");
      // Trigger map resize
      if (!isOpen) {
        const mapEl = body.querySelector(".hp-card-map");
        if (mapEl) {
          const mapId = mapEl.id;
          const entry = _projectMaps[mapId];
          if (entry && entry.map)
            setTimeout(() => entry.map.invalidateSize(), 400);
        }
      }
    });
  });

  // ── Carousel Prev/Next Buttons ──
  const carouselTrack = document.getElementById("carousel-track");
  const prevBtn = document.getElementById("carousel-prev");
  const nextBtn = document.getElementById("carousel-next");
  if (carouselTrack && (prevBtn || nextBtn)) {
    const scrollAmount = 306; // card width (290) + gap (16)
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        carouselTrack.style.animation = "none";
        carouselTrack.scrollBy({ left: -scrollAmount, behavior: "smooth" });
        // Resume animation after scroll
        setTimeout(() => {
          carouselTrack.style.animation = "";
        }, 800);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        carouselTrack.style.animation = "none";
        carouselTrack.scrollBy({ left: scrollAmount, behavior: "smooth" });
        setTimeout(() => {
          carouselTrack.style.animation = "";
        }, 800);
      });
    }
  }

  // ── Tab toggle (Projects / Counties) ──
  document.querySelectorAll(".hp-tab-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const mode = this.dataset.mode;
      const isCounties = mode === "counties";
      document
        .querySelectorAll(".hp-tab-btn")
        .forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      const pv = document.getElementById("hp-projects-view");
      const cv = document.getElementById("hp-counties-view");
      if (pv) pv.classList.toggle("hidden", isCounties);
      if (cv) cv.classList.toggle("hidden", !isCounties);
      if (!isCounties) {
        setTimeout(() => {
          Object.values(_projectMaps).forEach((entry) => {
            if (entry.map) entry.map.invalidateSize();
          });
        }, 300);
      }
    });
  });

  // ── Homepage Project Navigation ──
  document
    .querySelectorAll(
      ".hp-view-project-btn, .hp-carousel-card-action, .hp-carousel-card",
    )
    .forEach((el) => {
      el.addEventListener("click", function (e) {
        if (
          e.target.closest(".hp-expand-btn") ||
          e.target.closest(".hp-carousel-btn")
        )
          return;
        const pid =
          this.dataset.project ||
          (this.closest
            ? this.closest("[data-project]")?.dataset.project
            : null);
        if (!pid) return;
        if (pid === "jamii_tekelezi") {
          state.activeProject = "jamii_tekelezi";
          if (elements.projectFilter)
            elements.projectFilter.value = "jamii-tekelezi";
          state.activePage = "overview";
          setPageHash("overview");
          renderCurrentView();
        } else {
          // Map homepage project id → CHAK project id and open its overview
          const homeToChak = {
            gf_mnch: "gates_foundation",
            eye_health: "acsp_optical",
            gitlab: "gitlab_vision",
            pep: "prep_tool",
          };
          const chakId = homeToChak[pid] || pid;
          if (CHAK_PROJECT_IDS[chakId]) {
            state.activeProject = chakId;
            state.activeDatasetId = "";
            state.activePage = "overview";
            if (elements.projectFilter) elements.projectFilter.value = chakId;
            setPageHash("overview");
            renderCurrentView();
          } else {
            state.activeProject = "";
            state.activePage = "profile";
            setPageHash("profile");
            renderCurrentView();
          }
        }
      });
    });

  // ── Fade-in + chip animations ──
  observeHpFadeIns();
  setTimeout(animateCardChips, 300);

  // ── Carousel Performance Detail Panel ──
  function _showCarouselDetail(slug) {
    const panel = document.getElementById("carousel-detail-panel");
    if (!panel) return;

    // Toggle off if same project clicked
    const isVisible = !panel.classList.contains("hidden");
    const currentSlug = panel.dataset.slug;
    if (isVisible && currentSlug === slug) {
      panel.classList.add("hidden");
      panel.innerHTML = "";
      panel.dataset.slug = "";
      // Remove highlight from all carousel cards
      document
        .querySelectorAll(".hp-carousel-card")
        .forEach((c) => c.classList.remove("selected"));
      return;
    }

    // Remove highlight from all, highlight selected
    document
      .querySelectorAll(".hp-carousel-card")
      .forEach((c) => c.classList.remove("selected"));
    document
      .querySelectorAll(`.hp-carousel-card[data-project="${slug}"]`)
      .forEach((c) => c.classList.add("selected"));

    const perfHtml = _renderProjectPerformanceSection(slug);
    if (!perfHtml) {
      panel.innerHTML = `<div class="p-8 text-center text-sm text-slate-400">No performance data available for this project.</div>`;
    } else {
      panel.innerHTML = perfHtml;
    }
    panel.dataset.slug = slug;
    panel.classList.remove("hidden");
  }

  document.querySelectorAll(".hp-carousel-card-perf-btn").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      const slug = this.dataset.project;
      if (slug) _showCarouselDetail(slug);
    });
  });

  // ── MHU list modal / CSV download buttons ──
  document.querySelectorAll("[data-mhu-list]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const pid = el.dataset.mhuList;
      const label =
        pid === "all" ? "All CHAK MHUs" : projectData[pid]?.name || pid;
      openMhuListModal(pid, label);
    });
  });
  document.querySelectorAll("[data-mhu-csv]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      downloadMhuCsv(el.dataset.mhuCsv);
    });
  });

  // ── Load key indicators ──
  loadKeyIndicators();
}

// ── MHU list modal + CSV download ────────────────────────────────────
function _csvCell(val) {
  const s = String(val ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function _downloadCsv(filename, rows, columns) {
  const header = columns.map((c) => _csvCell(c.label)).join(",");
  const body = rows
    .map((r) => columns.map((c) => _csvCell(r[c.key])).join(","))
    .join("\r\n");
  // BOM so Excel opens UTF-8 names correctly
  const csv = "\ufeff" + header + "\r\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadMhuCsv(projectId) {
  fetch(`/api/projects/mhus?project=${encodeURIComponent(projectId)}`)
    .then((r) => r.json())
    .then((d) => {
      if (!d.ok) throw new Error("API error");
      const rows = d.rows || [];
      const slug = projectId === "all" ? "all_mhus" : projectId;
      const columns =
        projectId === "all"
          ? [
              { key: "no", label: "No." },
              { key: "mfl", label: "MFL Code" },
              { key: "name", label: "Facility Name" },
              { key: "county", label: "County" },
              { key: "subcounty", label: "Sub County" },
              { key: "category", label: "Category" },
              { key: "region", label: "Region" },
            ]
          : [
              { key: "no", label: "No." },
              { key: "mfl", label: "MFL Code" },
              { key: "name", label: "Facility Name" },
              { key: "county", label: "County" },
              { key: "subcounty", label: "Sub County" },
              { key: "category", label: "Category" },
            ];
      _downloadCsv(`chak_mhus_${slug}_${rows.length}.csv`, rows, columns);
    })
    .catch((e) => alert("Failed to download CSV: " + e.message));
}

function openMhuListModal(projectId, title) {
  const modal = document.createElement("div");
  modal.className =
    "mhu-modal fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm";
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-[95vw] max-w-5xl max-h-[92vh] flex flex-col">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div>
          <div class="text-lg font-bold text-slate-800">🏥 ${escapeHtml(title)}</div>
          <div class="text-xs text-slate-400"><span id="mhuModalCount">…</span> MHUs</div>
        </div>
        <div class="flex items-center gap-2">
          <button id="mhuModalCsv" type="button" class="mhu-btn mhu-btn-primary">⬇️ Download CSV</button>
          <button id="mhuModalClose" type="button" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-400">&times;</button>
        </div>
      </div>
      <div class="px-6 py-3 border-b border-slate-100">
        <input id="mhuModalSearch" type="text" placeholder="Search facility name, MFL code, county, sub county…" class="w-full md:w-96 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-200" />
      </div>
      <div class="flex-1 overflow-auto p-4">
        <div id="mhuModalLoading" class="text-sm text-slate-400 py-10 text-center">Loading MHU list…</div>
        <div id="mhuModalBody" class="hidden">
          <table class="w-full border-collapse text-sm">
            <thead class="sticky top-0 bg-slate-50"><tr class="border-b border-slate-200">
              <th class="px-3 py-2 text-left text-xs font-semibold text-slate-500">No.</th>
              <th class="px-3 py-2 text-left text-xs font-semibold text-slate-500">MFL Code</th>
              <th class="px-3 py-2 text-left text-xs font-semibold text-slate-500">Facility Name</th>
              <th class="px-3 py-2 text-left text-xs font-semibold text-slate-500">County</th>
              <th class="px-3 py-2 text-left text-xs font-semibold text-slate-500">Sub County</th>
              <th class="px-3 py-2 text-left text-xs font-semibold text-slate-500">Category</th>
              <th class="px-3 py-2 text-left text-xs font-semibold text-slate-500 ${projectId === "all" ? "" : "hidden"}">Region</th>
            </tr></thead>
            <tbody id="mhuModalRows"></tbody>
          </table>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  let allRows = [];
  const tbody = modal.querySelector("#mhuModalRows");
  const countEl = modal.querySelector("#mhuModalCount");
  const loadingEl = modal.querySelector("#mhuModalLoading");
  const bodyEl = modal.querySelector("#mhuModalBody");
  const regionCol = projectId === "all";

  const renderRows = (rows) => {
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="px-3 py-8 text-center text-sm text-slate-400">No matching MHUs.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map(
        (r) => `<tr class="border-b border-slate-100 hover:bg-sky-50/50">
          <td class="px-3 py-1.5 text-xs text-slate-400">${escapeHtml(r.no ?? "")}</td>
          <td class="px-3 py-1.5 font-mono text-xs font-semibold text-slate-600">${escapeHtml(r.mfl)}</td>
          <td class="px-3 py-1.5 font-medium text-slate-800">${escapeHtml(r.name)}</td>
          <td class="px-3 py-1.5 text-slate-600">${escapeHtml(r.county)}</td>
          <td class="px-3 py-1.5 text-slate-600">${escapeHtml(r.subcounty || "")}</td>
          <td class="px-3 py-1.5 text-xs"><span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full whitespace-nowrap">${escapeHtml(r.category || "")}</span></td>
          <td class="px-3 py-1.5 text-slate-600 ${regionCol ? "" : "hidden"}">${escapeHtml(r.region || "")}</td>
        </tr>`,
      )
      .join("");
  };

  modal.querySelector("#mhuModalSearch").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) return renderRows(allRows);
    const filtered = allRows.filter((r) =>
      [r.name, r.mfl, r.county, r.subcounty, r.category, r.region]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
    renderRows(filtered);
  });

  modal
    .querySelector("#mhuModalClose")
    .addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") {
      modal.remove();
      document.removeEventListener("keydown", esc);
    }
  });

  modal
    .querySelector("#mhuModalCsv")
    .addEventListener("click", () => downloadMhuCsv(projectId));

  fetch(`/api/projects/mhus?project=${encodeURIComponent(projectId)}`)
    .then((r) => r.json())
    .then((d) => {
      if (!d.ok) throw new Error(d.error || "API error");
      allRows = d.rows || [];
      countEl.textContent = allRows.length;
      loadingEl.classList.add("hidden");
      bodyEl.classList.remove("hidden");
      renderRows(allRows);
    })
    .catch((e) => {
      loadingEl.textContent = "Failed to load MHU list: " + e.message;
    });
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
  // Destroy any existing maps before re-initializing
  Object.keys(_projectMaps).forEach((key) => {
    try {
      _projectMaps[key].map.remove();
    } catch (_) {}
    delete _projectMaps[key];
  });

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
      noWrap: true,
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

