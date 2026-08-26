// ============================================================
// chak-core.js  (extracted from main.js lines 12553-13773)
// CHAK renderer infra + registry + helpers
// ============================================================
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
// ============================================================
// chak-core.js  (extracted from main.js lines 17583-17644)
// renderChakPage dispatcher (append)
// ============================================================
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

