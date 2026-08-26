// ============================================================
// analytics.js  (extracted from main.js lines 9401-10880)
// analytics renderers (gender/age/yearly/MMD/splits/JTP)
// ============================================================

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

// ============================================================
// analytics.js  (extracted from main.js lines 12326-12552)
// fullscreen + data-table + age-band modals (append)
// ============================================================
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

