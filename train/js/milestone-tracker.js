// ============================================================
// milestone-tracker.js  (Milestone Tracker top-level page)
// CHAK Daraka — FAA Monthly Milestone Plan & Payment Schedule
// Backing API: GET /api/milestone/data  (blueprints/milestone.py)
// ============================================================

let _milestoneDataPromise = null;

async function loadMilestoneData() {
  if (!_milestoneDataPromise) {
    _milestoneDataPromise = fetch("/api/milestone/data")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .catch(function (err) {
        _milestoneDataPromise = null;
        throw err;
      });
  }
  return _milestoneDataPromise;
}

// "Month 1: (September 1 - September 30, 2026)" -> "Sep 2026"
function milestoneMonthShort(month) {
  if (!month) return "";
  if (month.isFinalPay) return "Final Pay";
  const m = /\(\s*([A-Za-z]+)\s+\d{1,2}[\s\S]*?(\d{4})/.exec(
    month.period || "",
  );
  if (m) {
    const short3 = String(m[1]).slice(0, 3);
    return (
      short3.charAt(0).toUpperCase() +
      short3.slice(1).toLowerCase() +
      " " +
      m[2]
    );
  }
  return month.key || "";
}

function milestoneMonthLong(month) {
  if (!month) return "";
  if (month.isFinalPay) return "Final Pay — Year 1 Close-Out";
  const m = /\(\s*([\s\S]*?)\)/.exec(month.period || "");
  return m ? m[1] : month.period || month.key || "";
}

function fmtMoney(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return "$" + n.toLocaleString("en-US");
}

function fmtDateIso(value) {
  if (!value) return "—";
  const s = String(value);
  const parts = s.split("-");
  if (parts.length !== 3) return s;
  const y = parts[0];
  const mo = Number(parts[1]);
  const d = Number(parts[2]);
  if (!mo || !d) return s;
  const MONTHS = [
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
  return d + " " + MONTHS[mo - 1] + " " + y;
}

function milestoneTierChip(tier) {
  const t = String(tier || "").trim();
  const map = {
    PM: "bg-slate-100 text-slate-600",
    "Tier 1": "bg-sky-50 text-sky-700",
    "Tier 2": "bg-violet-50 text-violet-700",
  };
  const cls = map[t] || "bg-slate-100 text-slate-500";
  const label = t || "Unassigned";
  return `<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}">${escapeHtml(label)}</span>`;
}

function milestoneAlertChip(alerts) {
  const map = {
    "On Track": "bg-emerald-50 text-emerald-700",
    Watch: "bg-amber-50 text-amber-700",
    "Off Track": "bg-rose-50 text-rose-700",
  };
  const a = String(alerts || "").trim();
  if (!map[a]) return '<span class="text-slate-300">—</span>';
  return `<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[a]}">${escapeHtml(a)}</span>`;
}

function milestonePaymentChip(status) {
  const map = {
    "Fully Paid": "bg-emerald-50 text-emerald-700",
    "Partially Paid": "bg-amber-50 text-amber-700",
    "Not Paid": "bg-rose-50 text-rose-700",
  };
  const s = String(status || "Not Paid");
  const cls = map[s] || "bg-slate-100 text-slate-500";
  return `<span class="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}">${escapeHtml(s)}</span>`;
}

function milestoneVerifiedChip(verified) {
  const v = String(verified || "").trim();
  if (v === "Yes")
    return '<span class="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Yes</span>';
  if (v === "No")
    return '<span class="inline-block rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">No</span>';
  return '<span class="text-slate-300">—</span>';
}

function milestoneEmptyCell() {
  return '<span class="text-slate-300">—</span>';
}

// =====================================================================
// Live KHIS performance helpers (milestone rows carry row.perf when the
// milestone is measured from CHAK DHIS2 MOH 731 data - ids 6,7,8,9,11,14,15,16
// - or, for #21 Commodity Security, from KHIS national commodity-return rates).
// The same baseline is attached to every project month M1–M6; the
// "Monthly Payments - Earned" cell derives the schedule max × unlock %.
// =====================================================================
function msPerformanceCell(perf) {
  if (!perf) return milestoneEmptyCell();
  const pct = Number(perf.pct);
  const unlock = Number(perf.unlock) || 0;
  const pctTxt = Number.isFinite(pct)
    ? Number(pct).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "%"
    : "—";
  const valColor =
    unlock >= 100
      ? "text-emerald-600"
      : unlock > 0
        ? "text-amber-600"
        : "text-rose-500";
  const chipCls =
    unlock >= 100
      ? "bg-emerald-50 text-emerald-700"
      : unlock > 0
        ? "bg-amber-50 text-amber-700"
        : "bg-rose-50 text-rose-700";
  const hint = [
    perf.band,
    "as of " + (perf.asOf || "latest reporting month"),
    perf.formula,
  ]
    .filter(Boolean)
    .join(" · ");
  return `<div class="flex flex-col items-end gap-1" title="${escapeHtml(hint)}">
      <div class="whitespace-nowrap text-[13px] font-bold ${valColor}">${pctTxt}
        <span class="text-[10px] font-medium text-slate-400">of target</span></div>
      <span class="inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold whitespace-nowrap ${chipCls}">Unlock ${unlock}%</span>
      <div class="max-w-[160px] text-right text-[9px] leading-tight text-slate-400">${escapeHtml(perf.actual || "")}</div>
    </div>`;
}

function msEarnedCell(row, isFinalPay) {
  const perf = row && row.perf;
  if (!perf) return milestoneEmptyCell();
  const amt = Number(row.amount) || 0;
  if (!(amt > 0)) return milestoneEmptyCell();
  const unlock = Number(perf.unlock) || 0;
  const earned = Math.round((amt * unlock) / 100);
  const basis = isFinalPay
    ? "Final-pay max"
    : "Schedule max " + fmtMoney(amt) + " × unlock " + unlock + "%";
  const title =
    basis +
    " — unlocked by the CHAK DHIS2 baseline; GOR verification of the month is required before payment.";
  if (unlock <= 0) {
    return `<span class="whitespace-nowrap text-[12px] font-semibold text-rose-500" title="${escapeHtml(title)}">$0</span>`;
  }
  return `<span class="whitespace-nowrap text-[12px] font-semibold text-emerald-600" title="${escapeHtml(title)}">${fmtMoney(earned)}</span>`;
}

function msKhisChipHtml(khis) {
  if (!khis) return "";
  if (khis.status === "ok") {
    return `<span class="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700"
      title="${escapeHtml(khis.note || "")}">📡 KHIS baseline · ${escapeHtml(khis.asOf || "latest month")} · ${Number(khis.matched) || 0} Daraja facilities</span>`;
  }
  if (khis.status === "empty" || khis.status === "error") {
    return `<span class="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700"
      title="${escapeHtml(khis.error || khis.note || "")}">📡 KHIS baseline unavailable</span>`;
  }
  return "";
}

function msKhisNoteHtml(khis) {
  if (!khis || khis.status !== "ok") return "";
  return (
    " The nine DHIS2-measurable milestones (6–9, 11, 14, 15, 16, 21) show a live baseline from the CHAK DHIS2 (MOH 731) " +
    escapeHtml(String(khis.asOf || "latest reporting month")) +
    " month across " +
    (Number(khis.matched) || 0) +
    " of " +
    (Number(khis.total) || 0) +
    " Daraja facilities reporting in ereporting. “Monthly Payments - Earned” = the schedule max × the unlock % the baseline earns — an estimate that GOR verification of each project month replaces with confirmed values. Milestones without a DHIS2 source (DSD, EID, SHA, reporting, records-based items) stay “—” until their record-based verification."
  );
}

// =====================================================================
// Milestone Analytics — 5 visualizations (per-month donuts + M1–M6 trend)
// Donuts always reflect ALL milestones scheduled in the active month —
// the tier / payment filters above apply only to the table below.
// =====================================================================
const MS_HEALTH_ORDER = ["On Track", "Watch", "Off Track", "Not yet assessed"];
const MS_PAY_ORDER = [
  "Fully Paid",
  "Partially Paid",
  "Not Paid",
  "Not yet assessed",
];
const MS_TIER_ORDER = ["PM", "Tier 1", "Tier 2", "Unassigned"];
const MS_SEG_COLORS = {
  "On Track": "#10b981",
  Watch: "#f59e0b",
  "Off Track": "#ef4444",
  "Fully Paid": "#10b981",
  "Partially Paid": "#f59e0b",
  "Not Paid": "#ef4444",
  PM: "#64748b",
  "Tier 1": "#0ea5e9",
  "Tier 2": "#8b5cf6",
  Unassigned: "#94a3b8",
  "Not yet assessed": "#cbd5e1",
};

function msCompactMoney(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n) >= 1e6) return "$" + Number((n / 1e6).toFixed(2)) + "M";
  if (Math.abs(n) >= 1e3) return "$" + Number((n / 1e3).toFixed(1)) + "K";
  return "$" + n.toLocaleString("en-US");
}

function msAnalyticsStats(activeMonth) {
  const rows = activeMonth.rows || [];
  const healthCount = {
    "On Track": 0,
    Watch: 0,
    "Off Track": 0,
    "Not yet assessed": 0,
  };
  const payCount = {
    "Fully Paid": 0,
    "Partially Paid": 0,
    "Not Paid": 0,
    "Not yet assessed": 0,
  };
  const tierCount = { PM: 0, "Tier 1": 0, "Tier 2": 0, Unassigned: 0 };
  const tierAmount = { PM: 0, "Tier 1": 0, "Tier 2": 0, Unassigned: 0 };

  rows.forEach(function (row) {
    const al = String(row.alerts || "").trim();
    if (Object.prototype.hasOwnProperty.call(healthCount, al))
      healthCount[al] += 1;
    else healthCount["Not yet assessed"] += 1;

    const ps = String(row.paymentStatus || "").trim();
    if (Object.prototype.hasOwnProperty.call(payCount, ps)) payCount[ps] += 1;
    else payCount["Not yet assessed"] += 1;

    let tk = String(row.tier || row.milestoneType || "").trim();
    if (tk !== "PM" && tk !== "Tier 1" && tk !== "Tier 2") tk = "Unassigned";
    tierCount[tk] += 1;
    tierAmount[tk] += Number(row.amount) || 0;
  });

  const total = rows.length;
  const fundLabels = ["PM", "Tier 1", "Tier 2"].filter(function (t) {
    return (tierAmount[t] || 0) > 0;
  });
  if (!fundLabels.length) fundLabels.push("Unassigned");
  const fundTotal = fundLabels.reduce(function (s, t) {
    return s + (tierAmount[t] || 0);
  }, 0);

  const color = function (label) {
    return MS_SEG_COLORS[label] || "#94a3b8";
  };

  return {
    isFinalPay: !!activeMonth.isFinalPay,
    total: total,
    assessed: total - (healthCount["Not yet assessed"] || 0),
    settled: total - (payCount["Not yet assessed"] || 0),
    health: {
      labels: MS_HEALTH_ORDER.slice(),
      counts: MS_HEALTH_ORDER.map(function (l) {
        return healthCount[l] || 0;
      }),
      colors: MS_HEALTH_ORDER.map(color),
    },
    pay: {
      labels: MS_PAY_ORDER.slice(),
      counts: MS_PAY_ORDER.map(function (l) {
        return payCount[l] || 0;
      }),
      colors: MS_PAY_ORDER.map(color),
    },
    tier: {
      labels: MS_TIER_ORDER.slice(),
      counts: MS_TIER_ORDER.map(function (l) {
        return tierCount[l] || 0;
      }),
      colors: MS_TIER_ORDER.map(color),
    },
    fund: {
      labels: fundLabels,
      amounts: fundLabels.map(function (t) {
        return tierAmount[t] || 0;
      }),
      colors: fundLabels.map(color),
      total: fundTotal,
    },
  };
}

function msLegendHtml(labels, values, colors, denom, money) {
  const tot = Number(denom) || 0;
  const rows = [];
  labels.forEach(function (label, i) {
    const v = Number(values[i]) || 0;
    if (money ? v <= 0 : !v) return;
    const pct = tot > 0 ? Math.round((v / tot) * 100) : 0;
    const valStr = money ? fmtMoney(v) : v.toLocaleString("en-US");
    rows.push(`<div class="flex items-center justify-between gap-2 text-[11px] leading-5">
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:${colors[i]}"></span>
          <span class="truncate text-slate-600">${escapeHtml(label)}</span>
        </span>
        <span class="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
          <span class="font-semibold text-slate-800">${valStr}</span>
          <span class="w-8 text-right text-slate-400">${pct}%</span>
        </span>
      </div>`);
  });
  return rows.length
    ? rows.join("")
    : '<div class="text-[10px] italic text-slate-400">No data to chart yet.</div>';
}

function msDonutBlock(title, emoji, sub, canvasId, legend) {
  return `<div class="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
    <div class="flex items-center gap-1.5 text-[12px] font-bold text-slate-700">${emoji}<span>${escapeHtml(title)}</span></div>
    <div class="mt-0.5 min-h-[26px] text-[10px] text-slate-400">${escapeHtml(sub)}</div>
    <div class="relative mx-auto mt-1" style="width:150px;height:150px"><canvas id="${canvasId}"></canvas></div>
    <div class="mt-2 space-y-1">${legend}</div>
  </div>`;
}

function msAnalyticsCardHtml(stats, activeKey, activeMonth) {
  const short = milestoneMonthShort(activeMonth);

  const healthSub =
    stats.assessed > 0
      ? stats.assessed + " of " + stats.total + " milestones assessed"
      : "No statuses verified for this month yet";
  const paySub =
    stats.settled > 0
      ? stats.settled + " of " + stats.total + " with a payment status"
      : "No payment statuses recorded yet";

  const note =
    "Donuts include all " +
    stats.total +
    " milestones scheduled for " +
    activeKey +
    " — the tier / payment filters above apply only to the table below.";

  const foot = [
    "Status buckets come from the Milestone Summary2 tracker: only M1 milestones 1–3 carry verified seeds so far, so everything else is shown grey as “Not yet assessed” until its month is verified.",
    stats.isFinalPay
      ? "M6 (Final Pay) has no fixed schedule — its month total is $0 because final-pay amounts are performance-tiered and set at year-end close-out."
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <div class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div class="text-[15px] font-bold text-slate-800">📊 Milestone Analytics</div>
        <span class="inline-block rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-semibold text-sky-700">${escapeHtml(activeKey)} · ${escapeHtml(short)}</span>
      </div>
      <div class="mb-3 text-[11px] text-slate-500">${escapeHtml(note)}</div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        ${msDonutBlock("Milestone Status", "🩺", healthSub, "msHealthDonut", msLegendHtml(stats.health.labels, stats.health.counts, stats.health.colors, stats.total, false))}
        ${msDonutBlock("Payment Status", "💵", paySub, "msPayDonut", msLegendHtml(stats.pay.labels, stats.pay.counts, stats.pay.colors, stats.total, false))}
      </div>
      <div class="mt-2 text-[10px] leading-relaxed text-slate-400">${escapeHtml(foot)}</div>
    </div>`;
}

function msTrendCardHtml(awardTotalNum) {
  const awardStr = fmtMoney(awardTotalNum);
  return `
    <div class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="text-[13px] font-bold text-slate-800">🗓 M1–M6 Schedule &amp; Cumulative Trend</div>
        <span class="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">Award total ${escapeHtml(awardStr)}</span>
      </div>
      <div class="mt-0.5 text-[10px] text-slate-400">Bars = monthly schedule payment · line = cumulative cash to award total.</div>
      <div class="relative mt-2" style="height:230px"><canvas id="msTrendChart"></canvas></div>
    </div>`;
}

function mountMsAnalyticsCharts(stats) {
  if (!window.Chart) return;

  const makeDonut = function (canvasId, labels, values, colors, total, money) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: "#ffffff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (item) {
                const v = Number(item.raw) || 0;
                const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                const val = money ? fmtMoney(v) : v.toLocaleString("en-US");
                return " " + item.label + ": " + val + " (" + pct + "%)";
              },
            },
          },
        },
      },
    });
  };

  makeDonut(
    "msHealthDonut",
    stats.health.labels,
    stats.health.counts,
    stats.health.colors,
    stats.total,
    false,
  );
  makeDonut(
    "msPayDonut",
    stats.pay.labels,
    stats.pay.counts,
    stats.pay.colors,
    stats.total,
    false,
  );
}

function mountMsTrendChart(months, awardTotalNum) {
  if (!window.Chart) return;

  const tCanvas = document.getElementById("msTrendChart");
  if (!tCanvas) return;

  const labels = months.map(function (m) {
    const mk = m.key || "";
    const s = milestoneMonthShort(m);
    return s ? mk + " · " + s : mk;
  });
  const totals = months.map(function (m) {
    return Number(m.total) || 0;
  });
  const cums = months.map(function (m) {
    return Number(m.cumulative) || 0;
  });
  const award = Number(awardTotalNum) || 0;

  new Chart(tCanvas, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          type: "bar",
          label: "Monthly schedule",
          data: totals,
          backgroundColor: "#0ea5e9",
          borderRadius: 4,
          yAxisID: "y",
          order: 2,
        },
        {
          type: "line",
          label: "Cumulative to date",
          data: cums,
          borderColor: "#10b981",
          backgroundColor: "#10b981",
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: "#10b981",
          tension: 0.25,
          fill: false,
          yAxisID: "y1",
          order: 1,
        },
        {
          type: "line",
          label: "Award total",
          data: labels.map(function () {
            return award;
          }),
          borderColor: "#94a3b8",
          borderDash: [5, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          yAxisID: "y1",
          order: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#94a3b8", font: { size: 10 }, maxRotation: 0 },
        },
        y: {
          position: "left",
          beginAtZero: true,
          grid: { color: "#f1f5f9" },
          ticks: {
            color: "#94a3b8",
            font: { size: 10 },
            callback: function (v) {
              return msCompactMoney(v);
            },
          },
          title: {
            display: true,
            text: "Monthly $",
            color: "#94a3b8",
            font: { size: 10 },
          },
        },
        y1: {
          position: "right",
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: {
            color: "#94a3b8",
            font: { size: 10 },
            callback: function (v) {
              return msCompactMoney(v);
            },
          },
          title: {
            display: true,
            text: "Cumulative $",
            color: "#94a3b8",
            font: { size: 10 },
          },
        },
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            font: { size: 10 },
            color: "#64748b",
          },
        },
        tooltip: {
          callbacks: {
            label: function (item) {
              if (item.datasetIndex === 2)
                return "Award total: " + fmtMoney(item.parsed.y);
              const v = Number(item.parsed.y) || 0;
              return (item.dataset.label || "") + ": " + fmtMoney(v);
            },
          },
        },
      },
    },
  });
}

async function renderMilestoneTrackerPage() {
  // Hide the general top filter bar (county, subcounty, facility, period)
  const topFilters = document.getElementById("topFilters");
  if (topFilters) topFilters.classList.add("hidden");

  if (elements.chartRoot) destroyChartsIn(elements.chartRoot);

  let data;
  try {
    data = await loadMilestoneData();
  } catch (err) {
    elements.chartRoot.innerHTML = `<div class="p-10 text-center text-slate-400">
      Failed to load milestone data. Please try again later.
    </div>`;
    return;
  }

  if (!data || !data.ok || !Array.isArray(data.months)) {
    elements.chartRoot.innerHTML = `<div class="p-10 text-center text-slate-400">
      ${data && data.error ? escapeHtml(data.error) : "Milestone data is not available."}
    </div>`;
    return;
  }

  const months = data.months;
  let activeKey = state.milestoneMonth || "M1";
  const isHomeView = activeKey === "home";
  const monthIndex = months.findIndex((m) => m.key === activeKey);
  const activeMonth = monthIndex >= 0 ? months[monthIndex] : months[0];
  if (!isHomeView && monthIndex < 0)
    activeKey = activeMonth ? activeMonth.key : "M1";

  const tierFilter = state.milestoneTier || "all";
  const payFilter = state.milestonePayment || "all";

  // ── Per-month row filter (Tier + Payment Status) ──
  const rows = (activeMonth.rows || []).filter((row) => {
    if (tierFilter !== "all") {
      const tier = String(row.tier || row.milestoneType || "").trim();
      if (tier !== tierFilter) return false;
    }
    if (payFilter !== "all") {
      const status = String(row.paymentStatus || "Not Paid");
      if (status !== payFilter) return false;
    }
    return true;
  });

  // Tier options from the whole workbook (stable list)
  const tierOptions = (data.tiers || ["PM", "Tier 1", "Tier 2"]).filter(
    Boolean,
  );
  const payOptions = ["Fully Paid", "Partially Paid", "Not Paid"];

  const monthTotal = fmtMoney(activeMonth.total);
  const monthCumulative = fmtMoney(activeMonth.cumulative);
  const awardTotal = fmtMoney(data.awardTotal);

  // ── Tab pills: 🏠 Home first, then M1–M6 ──
  const monthPills =
    `
      <button data-ms-month="home" class="px-4 py-1.5 text-[12px] font-semibold rounded-t-lg transition cursor-pointer
        ${isHomeView ? "bg-sky-50 text-sky-700 border-b-2 border-sky-500" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-b-2 border-transparent"}"
        title="Year 1 overview — all milestones across M1–M6">
        🏠 Home
      </button>` +
    months
      .map(function (m) {
        const active = m.key === activeKey;
        return `
      <button data-ms-month="${m.key}" class="px-4 py-1.5 text-[12px] font-semibold rounded-t-lg transition cursor-pointer
        ${active ? "bg-sky-50 text-sky-700 border-b-2 border-sky-500" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-b-2 border-transparent"}"
        title="${escapeHtml(m.period || m.sheet || m.key)}">
        ${escapeHtml(m.key)} · ${escapeHtml(milestoneMonthShort(m))}
      </button>`;
      })
      .join("");

  // ── Home overview rows: dedupe milestone ids across all months ──
  const homeSeen = {};
  months.forEach(function (m) {
    (m.rows || []).forEach(function (r) {
      if (r.id === null || r.id === undefined || r.id === "") return;
      if (!homeSeen[r.id]) homeSeen[r.id] = r;
    });
  });
  const homeRows = Object.keys(homeSeen)
    .map(Number)
    .sort(function (a, b) {
      return a - b;
    })
    .map(function (k) {
      return homeSeen[k];
    });

  const homeTableRows = homeRows
    .map(function (row) {
      const freq = String(row.frequency || "").trim();
      const metaBits = [];
      if (freq) metaBits.push(freq);
      const due = row.requiredDue || row.suggestedDue || "";
      if (due) metaBits.push("Due " + fmtDateIso(due));
      return `<tr class="border-t border-slate-100 hover:bg-sky-50/40 transition">
        <td class="px-3 py-2.5 align-top">
          <div class="text-[11px] font-semibold text-slate-400">#${escapeHtml(String(row.id))}</div>
        </td>
        <td class="px-3 py-2.5 align-top min-w-[240px]">
          <div class="text-[13px] font-semibold text-slate-800 leading-snug">${escapeHtml(row.name || row.masterName || "Milestone " + row.id)}</div>
          <div class="mt-1 flex flex-wrap items-center gap-1">
            ${milestoneTierChip(row.tier || row.milestoneType)}
            ${freq ? `<span class="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">${escapeHtml(freq)}</span>` : ""}
          </div>
          ${metaBits.length ? `<div class="mt-1 text-[10px] font-medium text-slate-400">${escapeHtml(metaBits.join(" · "))}</div>` : ""}
        </td>
        <td class="px-3 py-2.5 text-right text-[13px] font-semibold text-slate-700 whitespace-nowrap">${fmtMoney(row.allocation)}</td>
        <td class="px-3 py-2.5 text-right align-top whitespace-nowrap">${msEarnedCell(row, false)}</td>
        <td class="px-3 py-2.5 text-right text-[12px] text-slate-500 whitespace-nowrap">${milestoneEmptyCell()}</td>
        <td class="px-3 py-2.5 text-right text-[12px] text-slate-500 whitespace-nowrap">${milestoneEmptyCell()}</td>
        <td class="px-3 py-2.5 text-right text-[12px] text-slate-500 whitespace-nowrap">${milestoneEmptyCell()}</td>
      </tr>`;
    })
    .join("");

  const homeEmptyRowHtml = `<tr><td colspan="7" class="px-3 py-8 text-center text-[13px] text-slate-400">
    No milestones found for Year 1.
  </td></tr>`;

  const homeSummaryHtml = `
    <div class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="text-[15px] font-bold text-slate-800">🏠 Home — Year 1 Overview</div>
          <div class="text-xs text-slate-500 mt-0.5">CHAK Daraka FAA plan across M1–M6 · master milestone list, one row per milestone.</div>
          <div class="flex flex-wrap gap-2 mt-2 text-[11px] font-semibold">
            <span class="text-slate-700 bg-slate-50 px-2.5 py-1 rounded-full">${homeRows.length} Milestones</span>
            <span class="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">Award Total: ${awardTotal}</span>
          </div>
        </div>
      </div>
    </div>`;

  const homeTableCardHtml = `
    <div class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="mb-2 text-[13px] font-bold text-slate-800">📋 General Milestone Table</div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[900px] border-collapse">
          <thead>
            <tr class="bg-slate-50">
              <th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">ID</th>
              <th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Milestone</th>
              <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">6-Month Allocation</th>
              <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Monthly Payments - Earned</th>
              <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Monthly Payments - Paid</th>
              <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Monthly Balance</th>
              <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Overall Balance</th>
            </tr>
          </thead>
          <tbody>
            ${homeRows.length ? homeTableRows : homeEmptyRowHtml}
          </tbody>
        </table>
      </div>
      <div class="mt-2 text-[10px] text-slate-400">
        Placeholders (—) are populated after each month is verified.
      </div>
    </div>`;

  const countReal = rows.length;
  const allCount = (activeMonth.rows || []).length;

  // ── Summary2-style table ──
  const tableRows = rows
    .map((row, idx) => {
      const metaBits = [];
      const freq = String(row.frequency || "").trim();
      if (freq) metaBits.push(freq);
      const due =
        row.requiredDue ||
        row.suggestedDue ||
        (activeMonth.isFinalPay ? row.suggestedDue : null) ||
        "";
      if (due) metaBits.push("Due " + fmtDateIso(due));
      if (activeMonth.isFinalPay && row.finalMonth) {
        metaBits.push("Final Pay " + row.finalMonth);
      }

      const status = row.paymentStatus || "Not Paid";

      return `<tr class="border-t border-slate-100 hover:bg-sky-50/40 transition">
        <td class="px-3 py-2.5 align-top">
          <div class="text-[11px] font-semibold text-slate-400">#${escapeHtml(String(row.id))}</div>
        </td>
        <td class="px-3 py-2.5 align-top min-w-[220px]">
          <div class="text-[13px] font-semibold text-slate-800 leading-snug">${escapeHtml(row.name || row.masterName || "Milestone " + row.id)}</div>
          <div class="mt-1 flex flex-wrap items-center gap-1">
            ${milestoneTierChip(row.tier || row.milestoneType)}
            ${freq ? `<span class="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">${escapeHtml(freq)}</span>` : ""}
          </div>
          ${metaBits.length ? `<div class="mt-1 text-[10px] font-medium text-slate-400">${escapeHtml(metaBits.join(" · "))}</div>` : ""}
        </td>
        <td class="px-3 py-2.5 text-right text-[13px] font-semibold text-slate-700 whitespace-nowrap">${fmtMoney(row.allocation)}</td>
        <td class="px-3 py-2.5 text-right align-top">${msPerformanceCell(row.perf)}</td>
        <td class="px-3 py-2.5 text-center whitespace-nowrap">${milestoneAlertChip(row.alerts)}</td>
        <td class="px-3 py-2.5 text-right align-top whitespace-nowrap">${msEarnedCell(row, activeMonth.isFinalPay)}</td>
        <td class="px-3 py-2.5 text-right text-[12px] text-slate-500 whitespace-nowrap">${milestoneEmptyCell()}</td>
        <td class="px-3 py-2.5 text-right text-[12px] text-slate-500 whitespace-nowrap">${milestoneEmptyCell()}</td>
        <td class="px-3 py-2.5 text-center whitespace-nowrap">${milestonePaymentChip(status)}</td>
        <td class="px-3 py-2.5 text-right text-[12px] text-slate-500 whitespace-nowrap">${milestoneEmptyCell()}</td>
        <td class="px-3 py-2.5 text-center whitespace-nowrap">${milestoneVerifiedChip(row.verified)}</td>
      </tr>`;
    })
    .join("");

  const emptyRowsHtml = `<tr><td colspan="11" class="px-3 py-8 text-center text-[13px] text-slate-400">
    No milestones match the selected filters for ${escapeHtml(activeKey)}.
  </td></tr>`;

  const countChip =
    allCount === countReal
      ? `${allCount} milestones`
      : `${countReal} of ${allCount} milestones`;

  // Analytics card (donuts reflect ALL rows of the active month).
  const msStats = msAnalyticsStats(activeMonth);
  const analyticsCardHtml = msAnalyticsCardHtml(
    msStats,
    activeKey,
    activeMonth,
  );

  // M1–M6 trend chart now lives on the 🏠 Home tab.
  const trendCardHtml = msTrendCardHtml(data.awardTotal);
  const homeBodyHtml = homeSummaryHtml + homeTableCardHtml + trendCardHtml;

  elements.chartRoot.innerHTML = `
    <div class="space-y-5">
      <!-- Header -->
      <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-center gap-2 mb-1">
          <div class="text-lg font-bold text-slate-800">🎯 Milestone Tracker</div>
          <span class="text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">${escapeHtml(data.title ? "CHAK Daraka Project" : "")} Year 1</span>
        </div>
        <div class="text-xs text-slate-500 mb-3">CHAK Daraka — FAA Monthly Milestone Plan &amp; Payment Schedule · ${escapeHtml(data.workbook || "")}</div>
        <div class="flex flex-wrap gap-2 text-[11px] font-semibold">
          <span class="text-slate-600 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">Award Total: <span class="text-slate-800">${awardTotal}</span></span>
          <span class="text-slate-600 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">Tiers: ${escapeHtml((data.tiers || []).join(" · "))}</span>
          <span class="text-slate-500 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">Read-only · tracking update coming with sign-in</span>
          ${msKhisChipHtml(data.khis)}
        </div>
      </div>

      <!-- Month pills -->
      <div class="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div class="flex flex-wrap gap-1 border-b border-slate-200 pb-1">
          ${monthPills}
        </div>
      </div>

      ${
        isHomeView
          ? homeBodyHtml
          : `
      <!-- Active month summary + filters -->
      <div class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="text-[15px] font-bold text-slate-800">${escapeHtml(activeKey)} — ${escapeHtml(milestoneMonthShort(activeMonth))}</div>
            <div class="text-xs text-slate-500 mt-0.5">${escapeHtml(milestoneMonthLong(activeMonth))}</div>
            <div class="flex flex-wrap gap-2 mt-2 text-[11px] font-semibold">
              <span class="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">Schedule Payment: ${monthTotal}</span>
              <span class="text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full">Cumulative to Date: ${monthCumulative}</span>
              <span class="text-slate-600 bg-slate-50 px-2.5 py-1 rounded-full">${countChip}</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-3 items-end">
            <div>
              <label class="mb-1 block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Milestone Tier</label>
              <select id="milestoneTierFilter" class="w-full min-w-[150px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200">
                <option value="all">All Tiers</option>
                ${tierOptions.map((t) => `<option value="${escapeHtml(t)}" ${tierFilter === t ? "selected" : ""}>${escapeHtml(t)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="mb-1 block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Payment Status</label>
              <select id="milestonePayFilter" class="w-full min-w-[160px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200">
                <option value="all">All Statuses</option>
                ${payOptions.map((p) => `<option value="${escapeHtml(p)}" ${payFilter === p ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Milestone Analytics -->
      ${analyticsCardHtml}

      <!-- Table -->
      <div class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1120px] border-collapse">
            <thead>
              <tr class="bg-slate-50">
                <th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">ID</th>
                <th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Milestone</th>
                <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">6-Month Allocation</th>
                <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Performance</th>
                <th class="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">Alerts</th>
                <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Monthly Payments - Earned</th>
                <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Monthly Payments - Paid</th>
                <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Monthly Balance</th>
                <th class="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">Payment Status</th>
                <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Overall Balance</th>
                <th class="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">Verified</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? tableRows : emptyRowsHtml}
            </tbody>
          </table>
        </div>
        <div class="mt-2 text-[10px] text-slate-400">
          Source: ${escapeHtml(activeMonth.sheet || "")} · Milestone Summary columns follow the
          "Milestones Summary2" tracker layout. Placeholders (—) are populated after each month is verified.${msKhisNoteHtml(data.khis)}
        </div>
      </div>
      `
      }
    </div>
  `;

  // ── Bind month pills ──
  elements.chartRoot
    .querySelectorAll("[data-ms-month]")
    .forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.milestoneMonth = btn.getAttribute("data-ms-month");
        renderMilestoneTrackerPage();
      });
    });

  // ── Bind filters ──
  const tierEl = document.getElementById("milestoneTierFilter");
  if (tierEl)
    tierEl.addEventListener("change", function () {
      state.milestoneTier = tierEl.value;
      renderMilestoneTrackerPage();
    });
  const payEl = document.getElementById("milestonePayFilter");
  if (payEl)
    payEl.addEventListener("change", function () {
      state.milestonePayment = payEl.value;
      renderMilestoneTrackerPage();
    });

  // ── Mount charts (after DOM is in place) ──
  if (isHomeView) mountMsTrendChart(months, data.awardTotal);
  else mountMsAnalyticsCharts(msStats);
}
