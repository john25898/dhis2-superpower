// ============================================================
// project-performance.js  (extracted from main.js lines 17645-19672)
// domain section 17645-19672
// ============================================================
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
    "jamii-tekelezi": "Jamii Tekelezi (JTP)",
    "chap-stawisha": "CHAP Stawisha",
    eis: "EIS",
    "gf-mnch": "Gates Foundation MNCH",
    "bftw-rmncah": "BFTW RMNCAH",
    pep: "PEP",
    impact: "IMPACT Project",
    "eye-health": "Eye Health (ACSP)",
    "cdic-icare": "CDIC / iCARE",
    internship: "Internship Program",
    gitlab: "GitLab",
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

// ═════════════════════════════════════════════════════════════════════
// CHAK Project UI – Overview & Dataset Detail
// ═════════════════════════════════════════════════════════════════════

function getActiveChakSubproject() {
  var proj = getActiveChakProject();
  if (!proj || !proj.subprojects || !proj.subprojects.length) return null;
  var spId = state.activeChakSubproject;
  var found = (proj.subprojects || []).find(function (s) {
    return s.id === spId;
  });
  if (!found) found = proj.subprojects[0];
  return found;
}

function findChakDatasetInProject(proj, dsId) {
  var found = (proj.datasets || []).find(function (d) {
    return d.id === dsId;
  });
  if (found) return found;
  var sps = proj.subprojects || [];
  for (var i = 0; i < sps.length; i++) {
    found = (sps[i].datasets || []).find(function (d) {
      return d.id === dsId;
    });
    if (found) return found;
  }
  return null;
}

function findChakDashboardInProject(proj, dbId) {
  var found = (proj.dashboards || []).find(function (d) {
    return (typeof d === "string" ? d : d.id) === dbId;
  });
  if (found) return found;
  var sps = proj.subprojects || [];
  for (var i = 0; i < sps.length; i++) {
    found = (sps[i].dashboards || []).find(function (d) {
      return (typeof d === "string" ? d : d.id) === dbId;
    });
    if (found) return found;
  }
  return null;
}

