// ============================================================
// milestone-tracker.js  (Milestone Tracker top-level page)
// CHAK Daraka — FAA Monthly Milestone Plan & Payment Schedule
// Backing API: GET /api/milestone/data  (blueprints/milestone.py)
// ============================================================

// The payload is a live snapshot of CHAK DHIS2, so it must NOT be cached for
// the lifetime of the page.  The tracker used to hold whatever it fetched on
// first load, so a month-tab switch (or navigating away and back) kept
// rendering stale numbers and a fresh deploy never appeared until the user
// hard-reloaded.  Mirror the server's 300 s payload cache instead, then
// transparently revalidate on the next entry into the tracker.
const _MILESTONE_CLIENT_TTL_MS = 5 * 60 * 1000;
let _milestonePayload = null;
let _milestonePayloadAt = 0;
let _milestoneInFlight = null;

// dashboard.js reuses the same #chart shell for every view, and on the Home
// view it nests `#homepageRoot` *inside* it.  So the cold-build placeholder
// must only ever be painted while the Milestone Tracker itself is on screen:
// painting it unconditionally wiped out #homepageRoot, and the Home dashboard
// then rendered into a detached node, leaving the placeholder stranded.
function _milestoneViewActive() {
  return (
    typeof state !== "undefined" &&
    !!state &&
    state.activePage === "milestone_tracker"
  );
}

function _milestoneNoticeVisible() {
  return !!(
    elements.chartRoot && elements.chartRoot.querySelector("[data-ms-warming]")
  );
}

// Friendly placeholder shown while the server builds a cold payload.
function milestoneWarmingNotice() {
  if (!elements.chartRoot) return;
  elements.chartRoot.innerHTML = `<div data-ms-warming="1" class="p-10 text-center text-slate-400">
    <div class="inline-flex items-center gap-3">
      <span class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500"></span>
      <span>Preparing milestone data from CHAK DHIS2…</span>
    </div>
    <div class="mt-2 text-[11px] text-slate-400">This only happens on the first load after a restart.</div>
  </div>`;
}

async function _fetchMilestoneData() {
  const started = Date.now();
  // The server answers 202 {warming:true} while a cold build runs instead of
  // holding the request open for minutes.  Poll until the real payload lands
  // (bounded so a permanently broken build cannot spin forever).
  const maxWaitMs = 15 * 60 * 1000;
  for (;;) {
    const r = await fetch("/api/milestone/data", { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    if (data && data.warming) {
      // Re-paint only when the tracker is on screen and the placeholder is not
      // already showing (covers navigating away and back mid-build).
      if (_milestoneViewActive() && !_milestoneNoticeVisible()) {
        milestoneWarmingNotice();
      }
      if (Date.now() - started > maxWaitMs) {
        throw new Error("milestone data is taking too long to prepare");
      }
      const wait = Math.max(1, Number(data.retryAfter) || 5) * 1000;
      await new Promise(function (res) {
        setTimeout(res, wait);
      });
      continue;
    }
    return data;
  }
}

async function loadMilestoneData() {
  const isFresh =
    _milestonePayload &&
    Date.now() - _milestonePayloadAt < _MILESTONE_CLIENT_TTL_MS;
  if (isFresh) return _milestonePayload;

  // Coalesce every caller that arrives mid-refresh onto a single request.
  if (!_milestoneInFlight) {
    _milestoneInFlight = _fetchMilestoneData()
      .then(function (data) {
        _milestonePayload = data;
        _milestonePayloadAt = Date.now();
        return data;
      })
      .catch(function (err) {
        // Never blank a page that already has a payload: a failed refresh
        // keeps the last good snapshot and retries on the next entry.
        if (_milestonePayload) return _milestonePayload;
        throw err;
      })
      .finally(function () {
        _milestoneInFlight = null;
      });
  }
  return _milestoneInFlight;
}

// "Month 1: (September 1 - September 30, 2026)" -> "Sep 2026"
function milestoneMonthShort(month) {
  if (!month) return "";
  // The Baseline tab is a snapshot of the latest reported month, so its
  // calendar month is the month that reading came from — not the project
  // month its rows were copied from (they share M1's September sheet).
  if (month.isBaseline) return month.perfAsOf || "Baseline";
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
  if (month.isBaseline)
    return (
      "Frozen baseline pinned to " +
      (month.perfAsOf || "a fixed month") +
      " (MILESTONE_BASELINE_PERIOD). It does not advance when a new month " +
      "starts reporting — each project-month tab scores the same schedule " +
      "against its own month."
    );
  if (month.isFinalPay) return "Final Pay — Year 1 Close-Out";
  const m = /\(\s*([\s\S]*?)\)/.exec(month.period || "");
  return m ? m[1] : month.period || month.key || "";
}

// Tab-pill label. The Baseline tab is pinned to a fixed month, so its pill
// names that month rather than the project month its rows were copied from;
// a month carrying its own `label` (e.g. "M1 Sep") shows that label, so the
// two M1-flavoured tabs can never be confused.
function milestonePillText(month) {
  if (!month) return "";
  if (month.isBaseline)
    return "Baseline" + (month.perfAsOf ? " · " + month.perfAsOf : "");
  const label = month.label || month.key || "";
  const short = milestoneMonthShort(month);
  return short ? label + " · " + short : label;
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

function milestoneAlertChip(alerts, source) {
  const map = {
    "On Track": "bg-emerald-50 text-emerald-700",
    Watch: "bg-amber-50 text-amber-700",
    "Off Track": "bg-rose-50 text-rose-700",
  };
  const a = String(alerts || "").trim();
  if (!map[a]) return '<span class="text-slate-300">—</span>';
  // A banded alert is derived from a live measurement (the CHAK DHIS2
  // baseline, or the NDWH upload log for #22), not read from the Milestone
  // Summary2 tracker seed, so say so in the tooltip rather than passing it
  // off as a GOR-verified status.
  const src = String(source || "");
  const fromBaseline = src === "baseline";
  const fromDwapi = src === "dwapi";
  const title = fromDwapi
    ? "Estimated from the NDWH UJTP DWAPI reporting-coverage reading — ≥95% reporting is On Track, 80–94% is Watch, below 80% is Off Track. GOR verification of this project month replaces it with a confirmed status."
    : fromBaseline
      ? "Estimated from the live CHAK DHIS2 baseline — a full unlock is On Track, a partial unlock is Watch, no unlock is Off Track. GOR verification of this project month replaces it with a confirmed status."
      : "Status from the Milestone Summary2 tracker.";
  const dot =
    fromBaseline || fromDwapi
      ? '<span class="ml-1 text-[8px] opacity-60">•</span>'
      : "";
  return `<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[a]}" title="${escapeHtml(title)}">${escapeHtml(a)}${dot}</span>`;
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
// milestone is measured from CHAK DHIS2 - ids 6,7,8,9,10,11,14,15,16
// - or, for #21 Commodity Security, from KHIS national commodity-return rates).
// A metric that cannot be measured yet simply has no row.perf and renders the
// empty cell; #10 (DSD enrolment) is one of these until CHAK starts reporting
// the DSD-model disaggregation.
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
  const fromDwapi = String(row.alertsSource || "") === "dwapi";
  const title =
    basis +
    (fromDwapi
      ? " — unlocked by the NDWH UJTP DWAPI reporting-coverage reading; GOR verification of the month is required before payment."
      : " — unlocked by the CHAK DHIS2 baseline; GOR verification of the month is required before payment.");
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
  // The month this tab covers has not started reporting yet. Saying so is
  // better than banding nineteen milestones Off Track against zeros.
  if (khis.status === "pending") {
    return `<span class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500"
      title="${escapeHtml(khis.note || "")}">📡 Awaiting ${escapeHtml(khis.pendingFor || "the month")} returns</span>`;
  }
  if (khis.status === "empty" || khis.status === "error") {
    return `<span class="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700"
      title="${escapeHtml(khis.error || khis.note || "")}">📡 KHIS baseline unavailable</span>`;
  }
  return "";
}

// ---------------------------------------------------------------------
// Milestone 22 — Digital Health Systems & Electronic Reporting Coverage.
// Sourced from the NDWH's own UJTP DWAPI upload workbook (a per-facility
// submission log), NOT CHAK DHIS2, and scored on the Baseline tab only:
// the workbook is the snapshot for the month the baseline is pinned to.
// ---------------------------------------------------------------------
function msDwapiChipHtml(dwapi) {
  if (!dwapi) return "";
  if (dwapi.status === "ok") {
    const pct = Number(dwapi.pct);
    const cls =
      pct >= 95
        ? "border-emerald-100 bg-emerald-50 text-emerald-700"
        : pct >= 80
          ? "border-amber-100 bg-amber-50 text-amber-700"
          : "border-rose-100 bg-rose-50 text-rose-700";
    const pctTxt = Number.isFinite(pct)
      ? Number(pct).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "%"
      : "—";
    return `<span class="rounded-full border ${cls} px-2.5 py-1 text-[11px] font-semibold"
      title="${escapeHtml(dwapi.note || "")}">🗄️ NDWH reporting coverage · ${escapeHtml(String(Number(dwapi.reporting) || 0))} of ${escapeHtml(String(Number(dwapi.expected) || 0))} facilities · ${escapeHtml(pctTxt)}</span>`;
  }
  if (dwapi.status === "empty" || dwapi.status === "error") {
    return `<span class="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700"
      title="${escapeHtml(dwapi.error || dwapi.note || "")}">🗄️ NDWH coverage unavailable</span>`;
  }
  return "";
}

function msDwapiNoteHtml(dwapi) {
  if (!dwapi || dwapi.status !== "ok") return "";
  const dockets = (dwapi.dockets || [])
    .map((d) => `${d.docket} ${d.pct}%`)
    .join(" · ");
  const month = dwapi.latestMonthHuman
    ? escapeHtml(String(dwapi.latestMonthHuman))
    : "the workbook's newest submission month";
  return (
    " #22 Digital Health Systems &amp; Electronic Reporting Coverage is measured from the National Data Warehouse's own " +
    "UJTP DWAPI upload log rather than CHAK DHIS2: " +
    escapeHtml(String(Number(dwapi.reporting) || 0)) +
    " of " +
    escapeHtml(String(Number(dwapi.expected) || 0)) +
    " expected HIV facilities submitted an upload in " +
    month +
    " (" +
    escapeHtml(String(Number(dwapi.pct) || 0)) +
    "%" +
    (dockets ? " — docket coverage that month: " + escapeHtml(dockets) : "") +
    "), so it bands at " +
    escapeHtml(String(Number(dwapi.unlock) || 0)) +
    "% unlock. " +
    escapeHtml(
      Number(dwapi.neverCount) > 0
        ? "The " +
            Number(dwapi.neverCount) +
            " facilities that have never submitted are listed in the panel."
        : "Every expected facility has submitted at some point.",
    ) +
    (Number(dwapi.lapsedCount) > 0
      ? " A further " +
        escapeHtml(String(Number(dwapi.lapsedCount))) +
        " submitted in an earlier month but not in " +
        month +
        "."
      : "") +
    " It is scored on the Baseline tab, because the workbook whose stamps read " +
    month +
    " is the reporting snapshot NDWH issued for the month the baseline is pinned to."
  );
}

function msKhisNoteHtml(khis) {
  if (!khis) return "";
  if (khis.status === "pending") {
    return (
      " This tab follows its own project month: " +
      escapeHtml(khis.note || "") +
      " Use the Baseline tab for the live read of the latest reported month."
    );
  }
  if (khis.status !== "ok") return "";
  return (
    " The nine DHIS2-measurable milestones (6–9, 11, 14, 15, 16, 21) show a live baseline from the CHAK DHIS2 (MOH 731) " +
    escapeHtml(String(khis.asOf || "latest reporting month")) +
    " month across " +
    (Number(khis.matched) || 0) +
    " of " +
    (Number(khis.total) || 0) +
    " Daraja facilities reporting in ereporting. “Monthly Payments - Earned” = the schedule max × the unlock % the baseline earns — an estimate that GOR verification of each project month replaces with confirmed values. Their Alerts chip is banded from the same baseline: a full unlock is On Track, a partial unlock is Watch, and no unlock is Off Track (marked with · to distinguish it from a verified tracker status). Milestones without a DHIS2 source (DSD, EID, SHA, reporting, records-based items) stay “—” until their record-based verification — #22 Electronic Reporting is the exception, scored on the Baseline tab from the NDWH upload log instead."
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
  // The Baseline tab has no project month of its own — its pill names the
  // latest reported month instead of the sheet its rows were copied from.
  const tabLabel = milestonePillText(activeMonth) || activeKey;

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
    tabLabel +
    " — the tier / payment filters above apply only to the table below.";

  const foot = [
    "Status buckets use the Milestone Summary2 tracker vocabulary. M1 milestones 1–3 carry a verified tracker seed; milestones with a live CHAK DHIS2 baseline (6–9, 11, 14, 15, 16, 21) are banded from that baseline and marked with a · pending GOR verification. Everything else stays grey as “Not yet assessed” until its month is verified.",
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
        <span class="inline-block rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-semibold text-sky-700">${escapeHtml(tabLabel)}</span>
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

  // The Baseline tab is a snapshot of the latest reported month, not a
  // seventh project month — plotting it would duplicate M1's bar and shift
  // the cumulative line off the award total.
  const schedMonths = (months || []).filter(function (m) {
    return m && !m.isBaseline;
  });
  if (!schedMonths.length) return;

  const labels = schedMonths.map(function (m) {
    const mk = m.label || m.key || "";
    const s = milestoneMonthShort(m);
    return s ? mk + " · " + s : mk;
  });
  const totals = schedMonths.map(function (m) {
    return Number(m.total) || 0;
  });
  const cums = schedMonths.map(function (m) {
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

// ============================================================
// ⋮  "View data" — the per-facility breakdown behind a milestone
// ------------------------------------------------------------
// A milestone's PERFORMANCE cell says the project scored 18% of target.
// It can never say WHICH facility supplied the inputs that produced that
// number.  The ⋮ menu opens a facility × input grid (all 259 Daraja sites,
// zeroes included) so a milestone can be reconciled site by site.
//
// Two deliberate design choices:
//   * The grid is fetched LAZILY, on first open, and cached per
//     (milestone, month).  259 rows × up to 9 inputs is far too much to
//     ride along on every payload build, and most visits never open it.
//   * The button lives INSIDE the existing "#id" cell rather than in a new
//     column, so the header, the 10-column layout and colspan="10" empty
//     state all stay exactly as they are.
// ============================================================
const _msFacilityCache = {}; // "mid:period" -> server response
const _msFacilityInFlight = {}; // "mid:period" -> Promise (de-dupes clicks)

function msRowMenuButton(row) {
  if (!row) return "";
  const mid = escapeHtml(String(row.id));
  return `<button data-ms-rowmenu="${mid}" title="More options"
    aria-label="More options for milestone ${mid}"
    class="rounded-md px-1.5 -my-1 text-base font-bold leading-none text-slate-300 transition hover:bg-sky-50 hover:text-sky-600 cursor-pointer">&#8942;</button>`;
}

// A single floating menu, created once and repositioned per click.  Keeping
// it outside the table means a re-render (month switch, filter change) can
// never leave an orphaned dropdown behind.
function _msCloseRowMenu() {
  const menu = document.getElementById("msRowMenu");
  if (menu) menu.remove();
}

function _msOpenRowMenu(btn, row, month) {
  _msCloseRowMenu();
  const rect = btn.getBoundingClientRect();
  const menu = document.createElement("div");
  menu.id = "msRowMenu";
  menu.className =
    "fixed z-[9999] min-w-[190px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl";
  // Flip above the button when there is no room below it.
  const below = rect.bottom + 6;
  const style =
    below + 120 > window.innerHeight
      ? `bottom:${window.innerHeight - rect.top + 6}px;left:${Math.min(rect.left, window.innerWidth - 200)}px;`
      : `top:${below}px;left:${Math.min(rect.left, window.innerWidth - 200)}px;`;
  menu.setAttribute("style", style);
  menu.innerHTML = `<button data-ms-rowaction="data"
      class="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-700 cursor-pointer">
      <span class="text-slate-400">&#128202;</span> View data
    </button>`;
  document.body.appendChild(menu);
  menu
    .querySelector("[data-ms-rowaction]")
    .addEventListener("click", function () {
      _msCloseRowMenu();
      openMsFacilityPanel(row, month);
    });
  // The opening click is stopped from bubbling, so this listener only ever
  // sees the NEXT document click — i.e. "clicked somewhere else: dismiss".
  document.addEventListener("click", _msCloseRowMenu, { once: true });
}

function _msFacilityModal() {
  let host = document.getElementById("msFacilityModal");
  if (host) return host;
  host = document.createElement("div");
  host.id = "msFacilityModal";
  host.className = "fixed inset-0 z-[9998] hidden";
  host.innerHTML = `
    <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" data-ms-fclose="1"></div>
    <div class="absolute inset-0 flex items-center justify-center p-2 sm:p-5">
      <div class="relative flex max-h-full w-full max-w-[1280px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div class="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3">
          <div class="min-w-0">
            <div id="msFacilityTitle" class="truncate text-[15px] font-bold text-slate-800"></div>
            <div id="msFacilitySub" class="mt-0.5 text-[11px] text-slate-500"></div>
          </div>
          <button data-ms-fclose="1" title="Close"
            class="shrink-0 rounded-lg px-2.5 py-0.5 text-2xl leading-none text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 cursor-pointer">&times;</button>
        </div>
        <div id="msFacilityNote" class="hidden border-b border-amber-100 bg-amber-50 px-5 py-2 text-[11px] leading-relaxed text-amber-800"></div>
        <div id="msFacilityBody" class="flex-1 overflow-auto"></div>
      </div>
    </div>`;
  document.body.appendChild(host);
  host.addEventListener("click", function (ev) {
    if (ev.target.closest("[data-ms-fclose]")) host.classList.add("hidden");
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") {
      host.classList.add("hidden");
      _msCloseRowMenu();
    }
  });
  return host;
}

function _msPanelShell(title, sub, bodyHtml) {
  const host = _msFacilityModal();
  document.getElementById("msFacilityTitle").textContent = title;
  document.getElementById("msFacilitySub").innerHTML = sub || "";
  const note = document.getElementById("msFacilityNote");
  note.classList.add("hidden");
  document.getElementById("msFacilityBody").innerHTML = bodyHtml;
  host.classList.remove("hidden");
  return host;
}

async function openMsFacilityPanel(row, month) {
  const mid = String(row.id);
  const title =
    "#" + mid + " · " + (row.name || row.masterName || "Milestone " + mid);
  const spinner = `<div class="flex items-center gap-3 p-12 text-slate-400">
      <span class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500"></span>
      <span class="text-[13px]">Reading facility-level data from CHAK DHIS2&hellip;</span>
    </div>`;
  _msPanelShell(title, "", spinner);

  // #22 is sourced from the DWAPI upload workbook, not DHIS2, and its
  // coverage object already carries the facility lists — no round trip.
  // It is only attached to the Baseline tab's row, so fall back to the
  // payload-level copy for the tabs that share the same coverage figure.
  const cov =
    (row.perf && row.perf.coverage) ||
    (String(row.id) === "22" && _milestonePayload && _milestonePayload.dwapi);
  if (cov) {
    _msRenderDwapiPanel(cov);
    return;
  }

  const key = mid + ":" + (month || "");
  const body = () => document.getElementById("msFacilityBody");
  try {
    let data = _msFacilityCache[key];
    if (!data) {
      if (!_msFacilityInFlight[key]) {
        const url =
          "/api/milestone/facility-data?milestone=" +
          encodeURIComponent(mid) +
          (month ? "&month=" + encodeURIComponent(month) : "");
        _msFacilityInFlight[key] = fetch(url, { cache: "no-store" })
          .then(function (r) {
            return r.json();
          })
          .then(function (j) {
            delete _msFacilityInFlight[key];
            return j;
          })
          .catch(function (err) {
            delete _msFacilityInFlight[key];
            throw err;
          });
      }
      data = await _msFacilityInFlight[key];
      if (data && data.ok) _msFacilityCache[key] = data;
    }
    _msRenderFacilityPanel(data, title);
  } catch (err) {
    _msPanelShell(
      title,
      "",
      `<div class="p-10 text-center text-[13px] text-rose-500">
         Could not load facility data: ${escapeHtml(err.message || String(err))}
       </div>`,
    );
    void body;
  }
}

function _msRenderFacilityPanel(data, title) {
  if (!data || !data.ok) {
    _msPanelShell(
      title,
      "",
      `<div class="p-10 text-center text-[13px] text-slate-500">
         ${escapeHtml((data && data.error) || "No facility-level data is available for this milestone.")}
       </div>`,
    );
    return;
  }

  const cols = data.columns || [];
  const facs = data.facilities || [];
  const totals = data.totals || [];
  const sub =
    `<span class="font-semibold text-slate-700">${escapeHtml(data.periodHuman || "")}</span>` +
    ` &middot; <span class="font-semibold text-slate-700">${data.reportingCount || 0}</span> of ${data.censusCount || facs.length} census facilities reported` +
    ` &middot; ${escapeHtml(data.source || "")}` +
    ` <span class="text-slate-400">&middot; generated ${escapeHtml(data.generated || "")}</span>`;

  if (!facs.length || !cols.length) {
    _msPanelShell(
      title,
      sub,
      `<div class="p-10 text-center text-[13px] text-slate-500">No inputs were reported for this milestone in ${escapeHtml(data.periodHuman || "this month")}.</div>`,
    );
    return;
  }

  // Grouped header: milestones whose inputs are category-option combos
  // (DSD models, TPT statuses) get a spanning label above their columns,
  // so "Community ART Group" reads as a DSD model rather than a bare word.
  const groups = [];
  cols.forEach(function (c) {
    const g = c.group || "";
    if (groups.length && groups[groups.length - 1].label === g)
      groups[groups.length - 1].span += 1;
    else groups.push({ label: g, span: 1 });
  });
  const hasGroups = groups.some(function (g) {
    return g.label;
  });
  // The first four columns (Facility/MFL/County/Sub-county) belong to no
  // group, so the spanning row must start with an equal-width blank cell —
  // without it every group label slides left by four columns.
  const groupRow = hasGroups
    ? `<tr><th colspan="4" class="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-2 py-1"></th>${groups
        .map(function (g) {
          return `<th colspan="${g.span}" class="sticky top-0 z-10 border-b border-l border-slate-200 bg-slate-100 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">${escapeHtml(g.label)}</th>`;
        })
        .join("")}</tr>`
    : "";

  // The second header row sticks immediately below the group row (24 px
  // tall) when the caller has groups, and at the very top otherwise.
  const headTop = hasGroups ? "top-[24px]" : "top-0";
  const num = function (v) {
    const n = Number(v) || 0;
    return n ? n.toLocaleString() : "0";
  };

  const head = `<thead class="text-[10px] uppercase tracking-wide text-slate-500">
      ${groupRow}
      <tr>
        <th class="sticky ${headTop} z-10 border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-left font-bold">Facility</th>
        <th class="sticky ${headTop} z-10 border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-left font-bold">MFL</th>
        <th class="sticky ${headTop} z-10 border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-left font-bold">County</th>
        <th class="sticky ${headTop} z-10 border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-left font-bold">Sub-county</th>
        ${cols
          .map(function (c) {
            return `<th class="sticky ${headTop} z-10 border-b border-l border-slate-200 bg-slate-50 px-2 py-1.5 text-right font-bold normal-case text-slate-600" title="${escapeHtml(c.label)}">${escapeHtml(c.label.length > 26 ? c.label.slice(0, 25) + "…" : c.label)}</th>`;
          })
          .join("")}
      </tr>
    </thead>`;

  const body = facs
    .map(function (f) {
      const zero = !f.values.some(function (v) {
        return Number(v);
      });
      return `<tr class="border-t border-slate-100 ${zero ? "text-slate-300" : "text-slate-700"} hover:bg-sky-50/50">
        <td class="px-2 py-1.5 text-[12px] font-medium">${escapeHtml(f.name)}</td>
        <td class="px-2 py-1.5 text-[11px] text-slate-400">${escapeHtml(f.mfl)}</td>
        <td class="px-2 py-1.5 text-[11px] text-slate-400">${escapeHtml(f.county)}</td>
        <td class="px-2 py-1.5 text-[11px] text-slate-400">${escapeHtml(f.subcounty)}</td>
        ${f.values
          .map(function (v) {
            const n = Number(v) || 0;
            return `<td class="border-l border-slate-100 px-2 py-1.5 text-right text-[12px] tabular-nums ${n ? "font-semibold text-slate-800" : "text-slate-300"}">${num(v)}</td>`;
          })
          .join("")}
      </tr>`;
    })
    .join("");

  const foot = `<tfoot class="sticky bottom-0 bg-slate-800 text-white">
      <tr>
        <td colspan="4" class="px-2 py-2 text-[11px] font-bold uppercase tracking-wide">Project total (${facs.length} facilities)</td>
        ${totals
          .map(function (t) {
            return `<td class="border-l border-slate-700 px-2 py-2 text-right text-[12px] font-bold tabular-nums">${num(t)}</td>`;
          })
          .join("")}
      </tr>
    </tfoot>`;

  _msPanelShell(
    title,
    sub,
    `<div class="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
       <span class="text-[13px] text-slate-400">&#128269;</span>
       <input id="msFacilitySearch" type="search" autocomplete="off"
         placeholder="Search facility, MFL, county or sub-county&hellip;"
         class="w-full max-w-xs rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] text-slate-700 outline-none focus:border-sky-400 focus:bg-white" />
       <button id="msFacilityClear"
         class="hidden rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-500 transition hover:bg-slate-100 cursor-pointer">Clear</button>
       <span id="msFacilityCount" class="ml-auto text-[11px] tabular-nums text-slate-400"></span>
     </div>
     <div id="msFacilityGrid" class="overflow-auto" style="max-height:70vh">
       <table class="w-full border-collapse">${head}<tbody id="msFacilityRows">${body}</tbody>${foot}</table>
     </div>
     <div id="msFacilityEmpty" class="hidden p-10 text-center text-[13px] text-slate-400">
       No facility matches that search.
     </div>`,
  );

  _msWireFacilitySearch();

  const note = document.getElementById("msFacilityNote");
  if (data.note) {
    note.textContent = data.note;
    note.classList.remove("hidden");
  }
}

// Filter box for the per-facility grid.  Matching is done against the four
// descriptor cells only (facility / MFL / county / sub-county) — running it
// over the whole row would let a typed "0" match every facility that reported
// a zero anywhere in the milestone's columns.
function _msWireFacilitySearch() {
  const input = document.getElementById("msFacilitySearch");
  const rowsHost = document.getElementById("msFacilityRows");
  const counter = document.getElementById("msFacilityCount");
  const clearBtn = document.getElementById("msFacilityClear");
  const emptyMsg = document.getElementById("msFacilityEmpty");
  const grid = document.getElementById("msFacilityGrid");
  if (!input || !rowsHost || !counter) return;

  const rows = Array.prototype.slice.call(rowsHost.querySelectorAll("tr"));
  rows.forEach(function (tr) {
    const descriptor = Array.prototype.slice
      .call(tr.cells, 0, 4)
      .map(function (td) {
        return td.textContent;
      })
      .join(" ");
    tr.setAttribute("data-ms-hay", descriptor.toLowerCase());
  });
  const total = rows.length;

  const apply = function () {
    const q = (input.value || "").trim().toLowerCase();
    let shown = 0;
    for (let i = 0; i < rows.length; i++) {
      const hit = !q || rows[i].getAttribute("data-ms-hay").indexOf(q) !== -1;
      // style.display rather than the `hidden` class: the rows already carry
      // Tailwind display/hover utilities and an inline style cannot lose a
      // specificity race with the CDN's generated order.
      rows[i].style.display = hit ? "" : "none";
      if (hit) shown++;
    }
    counter.textContent = q
      ? shown + " of " + total + " facilities"
      : total + " facilities";
    if (clearBtn) clearBtn.classList.toggle("hidden", !q);
    if (emptyMsg) emptyMsg.classList.toggle("hidden", shown !== 0);
    if (grid) grid.classList.toggle("hidden", shown === 0);
  };

  input.addEventListener("input", apply);
  input.addEventListener("keydown", function (ev) {
    // Escape clears the filter first; only a second Escape (empty box) should
    // reach the modal's document-level handler and close the panel.
    if (ev.key === "Escape" && input.value) {
      ev.stopPropagation();
      input.value = "";
      apply();
    }
  });
  if (clearBtn)
    clearBtn.addEventListener("click", function () {
      input.value = "";
      apply();
      input.focus();
    });
  apply();
  input.focus();
}

// #22's drill-down is the DWAPI upload log, which the payload already
// carries: which dockets were expected, which facilities have never
// uploaded and which have lapsed.
function _msRenderDwapiPanel(cov) {
  const dockets = (cov.dockets || [])
    .map(function (d) {
      const hit = Number(d.reporting) || 0;
      const exp = Number(d.expected) || 0;
      return `<span class="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">${escapeHtml(String(d.docket || "—"))} <span class="text-sky-500">${hit}/${exp} &middot; ${d.pct != null ? d.pct + "%" : "—"}</span></span>`;
    })
    .join(" ");
  const sub =
    `<span class="font-semibold text-slate-700">${escapeHtml(cov.asOf || cov.latestMonthHuman || "latest upload")}</span>` +
    ` &middot; <span class="font-semibold text-slate-700">${cov.reporting || 0}</span> of ${cov.expected || 0} facilities uploaded` +
    (cov.pct != null
      ? ` &middot; <span class="font-semibold text-slate-700">${cov.pct}%</span>`
      : "") +
    ` &middot; ${escapeHtml(cov.source || "")}`;
  // This panel is a coverage GAP list, not a value grid: the roster tells
  // us who *should* upload, so the useful detail is who didn't.
  const facilityList = function (label, items, total, tone) {
    const arr = items || [];
    const count = total || arr.length;
    const shown = arr
      .map(function (f) {
        const bits = [f.mfl, f.county].filter(Boolean).join(" · ");
        return `<div class="flex flex-wrap items-baseline gap-2 border-b border-slate-100 py-1.5 last:border-0">
          <span class="text-[12px] font-medium text-slate-700">${escapeHtml(f.name || "(unnamed)")}</span>
          <span class="text-[11px] text-slate-400">${escapeHtml(bits)}</span>
        </div>`;
      })
      .join("");
    const more =
      count > arr.length
        ? `<div class="pt-2 text-[11px] italic text-slate-400">… and ${count - arr.length} more</div>`
        : "";
    return `<div class="border-t border-slate-100 px-5 py-3">
      <div class="text-[11px] font-bold uppercase tracking-wide ${tone}">${escapeHtml(label)} · ${count}</div>
      <div class="mt-1">${
        arr.length
          ? shown + more
          : '<span class="text-[11px] text-slate-400">None</span>'
      }</div>
    </div>`;
  };
  _msPanelShell(
    "#22 · Digital Health Systems & Electronic Reporting Coverage",
    sub,
    `<div class="px-5 py-3">
       <div class="text-[11px] font-bold uppercase tracking-wide text-slate-500">Coverage by docket</div>
       <div class="mt-1.5 flex flex-wrap gap-1.5">${dockets || '<span class="text-[11px] text-slate-400">None reported</span>'}</div>
     </div>
     ${facilityList("Never uploaded", cov.never, cov.neverCount, "text-rose-600")}
     ${facilityList("Lapsed — uploaded before, silent in the newest window", cov.lapsed, cov.lapsedCount, "text-amber-600")}`,
  );
}

async function renderMilestoneTrackerPage() {
  // Hide the general top filter bar (county, subcounty, facility, period)
  const topFilters = document.getElementById("topFilters");
  if (topFilters) topFilters.classList.add("hidden");

  if (elements.chartRoot) destroyChartsIn(elements.chartRoot);

  // Paint the cold-build placeholder straight away so the tab responds
  // instantly even while loadMilestoneData() is still polling a 202.  When the
  // payload is already cached this resolves in the same microtask batch, so no
  // flash reaches the screen.
  if (!_milestoneNoticeVisible()) milestoneWarmingNotice();

  let data;
  try {
    data = await loadMilestoneData();
  } catch (err) {
    if (!_milestoneViewActive()) return;
    elements.chartRoot.innerHTML = `<div class="p-10 text-center text-slate-400">
      Failed to load milestone data. Please try again later.
    </div>`;
    return;
  }

  // A cold build can take a while, and the user may have navigated away in the
  // meantime; never write this page over whatever view is now showing.
  if (!_milestoneViewActive()) return;

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

  // Each project month carries its OWN baseline reading — the Baseline tab
  // is pinned to a fixed reporting month, M1 to the month its sheet covers —
  // so every chip, note and card on this page must read the active tab's
  // `khis`, falling back to the workbook-wide one for older payloads.
  const activeKhis = (activeMonth && activeMonth.khis) || data.khis;

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
        ${escapeHtml(milestonePillText(m))}
      </button>`;
      })
      .join("");

  // ── Home overview rows: dedupe milestone ids across all months ──
  // The Baseline tab is listed first and is the frozen snapshot of the
  // latest reported month, so first-seen-wins already yields the right row
  // for every id. The extra guard keeps that true if the month order ever
  // changes: a row carrying a live baseline never loses to one that does not
  // (the M1 tab posts the same ids with no baseline until its own month
  // starts reporting).
  const homeSeen = {};
  months.forEach(function (m) {
    (m.rows || []).forEach(function (r) {
      if (r.id === null || r.id === undefined || r.id === "") return;
      const prev = homeSeen[r.id];
      if (!prev) {
        homeSeen[r.id] = r;
      } else if (!prev.perf && r.perf) {
        homeSeen[r.id] = r;
      }
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
        <td class="px-3 py-2.5 text-right text-[13px] font-semibold text-slate-700 whitespace-nowrap" title="Six-month allocation in the Milestones_DataEntry master registry">${fmtMoney(row.allocation)}</td>
        <td class="px-3 py-2.5 text-right text-[13px] font-semibold text-slate-600 whitespace-nowrap" title="Max monthly payment on the earliest schedule carrying this milestone; later months may differ">${fmtMoney(row.amount)}</td>
        <td class="px-3 py-2.5 text-center whitespace-nowrap">${milestoneAlertChip(row.alerts, row.alertsSource)}</td>
        <td class="px-3 py-2.5 text-right align-top whitespace-nowrap">${msEarnedCell(row, false)}</td>
        <td class="px-3 py-2.5 text-right text-[12px] text-slate-500 whitespace-nowrap">${milestoneEmptyCell()}</td>
        <td class="px-3 py-2.5 text-right text-[12px] text-slate-500 whitespace-nowrap">${milestoneEmptyCell()}</td>
        <td class="px-3 py-2.5 text-right text-[12px] text-slate-500 whitespace-nowrap">${milestoneEmptyCell()}</td>
      </tr>`;
    })
    .join("");

  const homeEmptyRowHtml = `<tr><td colspan="9" class="px-3 py-8 text-center text-[13px] text-slate-400">
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
        <table class="w-full min-w-[1120px] border-collapse">
          <thead>
            <tr class="bg-slate-50">
              <th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">ID</th>
              <th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Milestone</th>
              <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">6-Month Allocation</th>
              <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Monthly Allocation</th>
              <th class="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">Alerts</th>
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
          <div class="flex items-start gap-1">
            <div class="text-[11px] font-semibold text-slate-400">#${escapeHtml(String(row.id))}</div>
            ${msRowMenuButton(row)}
          </div>
        </td>
        <td class="px-3 py-2.5 align-top min-w-[220px]">
          <div class="text-[13px] font-semibold text-slate-800 leading-snug">${escapeHtml(row.name || row.masterName || "Milestone " + row.id)}</div>
          <div class="mt-1 flex flex-wrap items-center gap-1">
            ${milestoneTierChip(row.tier || row.milestoneType)}
            ${freq ? `<span class="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">${escapeHtml(freq)}</span>` : ""}
          </div>
          ${metaBits.length ? `<div class="mt-1 text-[10px] font-medium text-slate-400">${escapeHtml(metaBits.join(" · "))}</div>` : ""}
        </td>
        <td class="px-3 py-2.5 text-right text-[13px] font-semibold text-slate-700 whitespace-nowrap" title="${activeMonth.isFinalPay ? "Max annual payment for this milestone — the final-pay sheet carries the annual figure" : "Max monthly payment for this milestone on " + (activeMonth.sheet || activeMonth.key) + "'s schedule"}">${fmtMoney(row.amount)}</td>
        <td class="px-3 py-2.5 text-right align-top">${msPerformanceCell(row.perf)}</td>
        <td class="px-3 py-2.5 text-center whitespace-nowrap">${milestoneAlertChip(row.alerts, row.alertsSource)}</td>
        <td class="px-3 py-2.5 text-right align-top whitespace-nowrap">${msEarnedCell(row, activeMonth.isFinalPay)}</td>
        <td class="px-3 py-2.5 text-right text-[12px] text-slate-500 whitespace-nowrap">${milestoneEmptyCell()}</td>
        <td class="px-3 py-2.5 text-right text-[12px] text-slate-500 whitespace-nowrap">${milestoneEmptyCell()}</td>
        <td class="px-3 py-2.5 text-center whitespace-nowrap">${milestonePaymentChip(status)}</td>
        <td class="px-3 py-2.5 text-center whitespace-nowrap">${milestoneVerifiedChip(row.verified)}</td>
      </tr>`;
    })
    .join("");

  const emptyRowsHtml = `<tr><td colspan="10" class="px-3 py-8 text-center text-[13px] text-slate-400">
    No milestones match the selected filters for ${escapeHtml(activeMonth.label || activeMonth.key || "")}.
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
          ${msKhisChipHtml(activeKhis)}
          ${msDwapiChipHtml(activeMonth && activeMonth.dwapi)}
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
            <div class="text-[15px] font-bold text-slate-800">${escapeHtml(activeMonth.label || activeMonth.key || "")} — ${escapeHtml(milestoneMonthShort(activeMonth))}</div>
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
          <table class="w-full min-w-[1080px] border-collapse">
            <thead>
              <tr class="bg-slate-50">
                <th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">ID</th>
                <th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Milestone</th>
                <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">${activeMonth.isFinalPay ? "Annual Allocation" : "Monthly Allocation"}</th>
                <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Performance</th>
                <th class="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">Alerts</th>
                <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Monthly Payments - Earned</th>
                <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Monthly Payments - Paid</th>
                <th class="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">Monthly Balance</th>
                <th class="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">Payment Status</th>
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
          "Milestones Summary2" tracker layout. The 6-Month Allocation and Overall Balance
          columns live on the 🏠 Home tab (they are plan-level figures, identical on every
          month), so this per-month table stays focused on the month being read.
          Placeholders (—) are populated after each month is verified.${msKhisNoteHtml(activeKhis)}${msDwapiNoteHtml(activeMonth && activeMonth.dwapi)}
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

  // ── Bind the ⋮ "View data" menus ──
  // The table is re-rendered wholesale on every tab/filter change, so the
  // listeners are re-attached here alongside the month pills.  The menu and
  // the panel themselves live on document.body and therefore survive it.
  const rowById = {};
  (activeMonth.rows || []).forEach(function (r) {
    rowById[String(r.id)] = r;
  });
  elements.chartRoot
    .querySelectorAll("[data-ms-rowmenu]")
    .forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        const row = rowById[btn.getAttribute("data-ms-rowmenu")];
        if (!row) return;
        _msOpenRowMenu(btn, row, activeMonth.periodYm || "");
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
