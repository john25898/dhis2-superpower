// ============================================================
// daraja.js  (extracted from main.js lines 10881-12325)
// Daraja page
// ============================================================

// County the Daraja project opens on. Kept in step with DEFAULT_COUNTY in
// train/services/ou_resolver.py — the server uses it as the fallback when a
// request arrives without a usable county.
const DEFAULT_DARAJA_COUNTY = "Meru County";

async function renderDarajaPage(container, activeSlug) {
  syncDarajaDefaultCounty();
  if (activeSlug === "overview") {
    renderDarajaOverview(container);
  } else if (activeSlug === "tx-curr-analytics") {
    renderDarajaTxCurrAnalytics(container);
  } else if (activeSlug === "programme-highlights") {
    renderDarajaProgrammeHighlights(container);
  } else if (activeSlug === "workload-mhu") {
    renderDarajaWorkloadPage(container);
  } else {
    container.innerHTML = `<div class="text-center py-12 text-sm text-slate-500">Select a view above.</div>`;
  }
}

// Reset the global top-bar period picker back to its default ("Period", i.e.
// the app's pinned window ending July 2026). Called when the user switches a
// Daraja view back to a trend-range chip or after a picked month has no data.
function resetTopPeriodFilterUI() {
  state.periodFilter = "all";
  const label = document.getElementById("periodLabel");
  const input = document.getElementById("periodFilter");
  if (label) {
    label.textContent = "Period";
    label.style.color = "#64748b";
  }
  if (input) input.value = "";
}

// Period to use for single-month snapshot pages. Defaults to the current
// calendar month (the endpoint returns the latest month that actually has
// reports within the window) unless the user actively picked a month in the
// top period picker — then that month is honoured.
function jtSnapshotMonthYm() {
  const f = state.periodFilter;
  if (f && f !== "all" && /^\d{4}-\d{2}$/.test(f)) return f.replace("-", "");
  return currentYmParam();
}

// `pe` value for the snapshot pages: the explicitly picked month, or a short
// trailing window so the endpoint can resolve the latest month that actually
// has reports.
function jtSnapshotPeriodParam() {
  const f = state.periodFilter;
  if (f && f !== "all" && /^\d{4}-\d{2}$/.test(f)) return f.replace("-", "");
  return buildMonthRangeParam(currentYmParam(), 3);
}

// Newest month label present in a `/api/homepage/summary` payload.
function jtSummaryLatestLabel(d) {
  const trends = [d.tx_curr_trend, d.tx_new_trend, d.hts_trend];
  for (const t of trends) {
    const last = (t || []).slice(-1)[0];
    if (last && last.label) return last.label;
  }
  return perYmShortLabel(jtSnapshotMonthYm());
}

// County scope parameter for every Daraja API call.
//
// "All Counties" is a REAL scope, not shorthand for Meru: the server expands
// `county=all` to the whole Daraja roster — all 15 counties, all 259
// facilities. The top bar defaults to Meru County (see DEFAULT_COUNTY on the
// server) so the first paint stays cheap; picking "All Counties" widens it.
function darajaCountyParam() {
  return selectedCountyParam();
}

// The Daraja views open on Meru, so the top-bar county dropdown has to say so.
// Previously the dropdown read "All Counties" while every Daraja endpoint was
// silently narrowed to Meru, which made the page look like it was showing
// whole-project numbers. This runs on each Daraja render but only ever applies
// the default while the user has not chosen a county for themselves, so an
// explicit "All Counties" or named county always wins.
function syncDarajaDefaultCounty() {
  if (state.countyFilterTouched) return;
  if (state.countyFilter && state.countyFilter !== "all") return;

  state.countyFilter = DEFAULT_DARAJA_COUNTY;
  state.subCountyFilter = "all";
  state.facilityFilter = "all";

  const countyEl = document.getElementById("countyFilter");
  const subEl = document.getElementById("subCountyFilter");
  const facEl = document.getElementById("facilityFilter");
  if (countyEl) countyEl.value = DEFAULT_DARAJA_COUNTY;
  if (subEl) subEl.value = "all";
  if (facEl) facEl.value = "all";

  // Rebuild the sub-county / facility lists for the county we just selected.
  if (typeof populateFilterOptions === "function") populateFilterOptions();
  if (countyEl) countyEl.value = DEFAULT_DARAJA_COUNTY;
  if (subEl) subEl.value = "all";
  if (facEl) facEl.value = "all";
}

async function renderDarajaProgrammeHighlights(container) {
  container.innerHTML = `
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="text-xs font-semibold text-slate-700 mb-3">📊 Programme highlights · <span id="darajaHighlightsPeriod">${perYmShortLabel(jtSnapshotMonthYm())}</span></div>
      <div class="flex items-center justify-center py-10 text-sm text-slate-500" id="darajaHighlightsLoading">Loading snapshot…</div>
    </div>
  `;

  const county = darajaCountyParam();
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
  const url = `/api/homepage/summary?county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=${jtSnapshotPeriodParam()}`;

  try {
    const resp = await fetch(url);
    const d = await resp.json();
    if (d.error) throw new Error(d.error);
    const periodEl = document.getElementById("darajaHighlightsPeriod");
    if (periodEl) periodEl.textContent = jtSummaryLatestLabel(d);
    const latest = d.latest || {};
    const txCurr = Number(latest.tx_curr || 0);
    const txNew = Number(latest.tx_new || 0);
    const tested = Number(latest.hts_tested || 0);
    const positivity = Number(latest.positivity_rate || 0);
    const serviceContinuity = txCurr > 0 ? (txNew / txCurr) * 100 : 0;
    const htsMomentum = txCurr > 0 ? (tested / txCurr) * 100 : 0;

    const loadingEl = document.getElementById("darajaHighlightsLoading");
    if (!loadingEl || !container.contains(loadingEl)) return; // superseded render
    loadingEl.outerHTML = `
      <div class="space-y-4">
        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Care continuity</div>
            <div class="mt-2 text-2xl font-bold text-slate-800">${serviceContinuity.toFixed(1)}%</div>
            <div class="mt-1 text-[11px] text-slate-500">New initiations relative to the active caseload.</div>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">HTS momentum</div>
            <div class="mt-2 text-2xl font-bold text-slate-800">${htsMomentum.toFixed(1)}%</div>
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

async function renderDarajaWorkloadPage(container) {
  container.innerHTML = `
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="text-xs font-semibold text-slate-700 mb-3">🚐 Workload & MHU focus · <span id="darajaWorkloadPeriod">${perYmShortLabel(jtSnapshotMonthYm())}</span></div>
      <div class="flex items-center justify-center py-10 text-sm text-slate-500" id="darajaWorkloadLoading">Loading workload view…</div>
    </div>
  `;

  const county = darajaCountyParam();
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
  const url = `/api/homepage/summary?county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=${jtSnapshotPeriodParam()}`;

  try {
    const resp = await fetch(url);
    const d = await resp.json();
    if (d.error) throw new Error(d.error);
    const periodEl = document.getElementById("darajaWorkloadPeriod");
    if (periodEl) periodEl.textContent = jtSummaryLatestLabel(d);
    const latest = d.latest || {};
    const txCurr = Number(latest.tx_curr || 0);
    const txNew = Number(latest.tx_new || 0);
    const tested = Number(latest.hts_tested || 0);
    const positivity = Number(latest.positivity_rate || 0);
    const workloadIndex = tested > 0 ? txCurr / tested : 0;
    const servicePressure = txCurr > 0 ? (txNew / txCurr) * 1000 : 0;
    // The progress bar needs a 0-100 scale; 10 new starts per 1,000 is full.
    const servicePressureBar = Math.min(100, servicePressure * 10);

    const loadingEl = document.getElementById("darajaWorkloadLoading");
    if (!loadingEl || !container.contains(loadingEl)) return; // superseded render
    loadingEl.outerHTML = `
      <div class="space-y-4">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div class="text-sm font-semibold text-slate-700">Service workload summary</div>
          <div class="mt-3 grid gap-3 md:grid-cols-3">
            <div class="rounded-xl border border-slate-200 bg-white p-3">
              <div class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Caseload per test</div>
              <div class="mt-2 text-2xl font-bold text-slate-800">${workloadIndex.toFixed(1)}&times;</div>
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
              <div class="flex items-center justify-between text-[12px] font-semibold text-slate-700"><span>New starts per 1,000 in care</span><span>${servicePressure.toFixed(1)}</span></div>
              <div class="mt-2 h-2 w-full rounded-full bg-slate-200"><div class="h-2 rounded-full bg-orange-500" style="width:${servicePressureBar}%"></div></div>
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

async function renderDarajaOverview(container) {
  syncDarajaDefaultCounty();
  // Old charts from a previous overview render still live inside this
  // container — free them before replacing the DOM.
  destroyChartsIn(container);

  // A one-shot notice (e.g. "that month has no data yet") survives the fallback
  // re-render through dataset and is removed once shown.
  const darajaNotice = container.dataset.darajaNotice || "";
  if (darajaNotice) delete container.dataset.darajaNotice;

  container.innerHTML = `
    <div class="flex items-center justify-center py-16 text-slate-500 text-sm gap-2">
      <div class="w-5 h-5 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
      Loading Daraja overview…
    </div>
  `;

  // Trend-range toggle: charts show the selected window (default last 6
  // months ending July 2026); KPI cards still show the latest month.
  if (!container.dataset.ovRangeBound) {
    container.dataset.ovRangeBound = "1";
    container.addEventListener("click", (ev) => {
      const btn =
        ev.target && ev.target.closest
          ? ev.target.closest("[data-daraja-range]")
          : null;
      if (!btn) return;
      const n = Number(btn.getAttribute("data-daraja-range")) || 6;
      // Clicking a chip after picking a top-bar month switches back to the
      // pinned trend window, so always clear the month first.
      const hadMonth = !!(state.periodFilter && state.periodFilter !== "all");
      if (hadMonth) resetTopPeriodFilterUI();
      if (!hadMonth && n === rangeMonthsOf(state.darajaRangeMonths)) return;
      state.darajaRangeMonths = n;
      renderDarajaOverview(container);
    });
  }

  const rangeMonths = rangeMonthsOf(state.darajaRangeMonths); // default 6
  const county = darajaCountyParam();
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
  // If the user picked a single month in the top period filter, respect it;
  // otherwise send an explicit month list ending at the current calendar
  // month. The endpoint simply omits months that have no reports yet, so the
  // KPI cards land on the latest month CHAK has actually reported rather than
  // a hard-coded month that goes stale.
  const selectedPeriod =
    state.periodFilter && state.periodFilter !== "all"
      ? state.periodFilter
      : buildMonthRangeParam(currentYmParam(), rangeMonths);
  const monthPicked = !!(state.periodFilter && state.periodFilter !== "all");
  const pickedYm = monthPicked
    ? String(state.periodFilter).replace("-", "")
    : "";

  try {
    const [
      summaryResp,
      vlResp,
      linkageResp,
      prepResp,
      pnsResp,
      currGenderResp,
      newGenderResp,
    ] = await Promise.all([
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
      // PNS index offered/accepted lives in its own payload — the
      // hts_linkage payload only carries linked_within / linked_outside /
      // total_tested.
      fetch(
        `/api/hiv-testing/dhis-live?type=partner_notification&county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=${encodeURIComponent(selectedPeriod)}`,
      ),
      // Sex splits come from the shared 30 age x sex category option combos
      // of the Jamii + CHAP Stawisha TX_CURR / TX_NEW data elements.
      fetch(
        `/api/hiv-treatment/tx-curr-gender-split?county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=${encodeURIComponent(selectedPeriod)}`,
      ),
      fetch(
        `/api/hiv-treatment/tx-new-gender-split?county=${encodeURIComponent(county)}${scParam}${facParam}${projParam}&period=${encodeURIComponent(selectedPeriod)}`,
      ),
    ]);

    const [
      summaryJson,
      vlJson,
      linkageJson,
      prepJson,
      pnsJson,
      currGenderJson,
      newGenderJson,
    ] = await Promise.all([
      summaryResp.json(),
      vlResp.json(),
      linkageResp.json(),
      prepResp.json(),
      pnsResp.json(),
      currGenderResp.json(),
      newGenderResp.json(),
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

    // A picked month with no reports at all (e.g. a future month) returns empty
    // arrays plus an empty `latest` object. Instead of showing a wall of zeros,
    // fall back to the pinned window and explain why.
    const emptyForPickedMonth =
      monthPicked &&
      !txCurrTrend.length &&
      !txNewTrend.length &&
      !htsTrend.length &&
      (!latest || Object.keys(latest).length === 0);

    if (emptyForPickedMonth) {
      const msg = `No KHIS reporting is available for <b>${perYmShortLabel(
        pickedYm,
      )}</b> yet &mdash; a month&rsquo;s reports usually appear after the month closes. Showing the latest available data instead.`;
      resetTopPeriodFilterUI();
      state.darajaRangeMonths = 6;
      container.dataset.darajaNotice = msg;
      renderDarajaOverview(container);
      return;
    }

    const latestVl = (vlJson.trend || []).slice(-1)[0] || {};
    const latestLinkage = (linkageJson.trend || []).slice(-1)[0] || {};
    const latestPrep = (prepJson.trend || []).slice(-1)[0] || {};
    const latestPns = (pnsJson.trend || []).slice(-1)[0] || {};

    const txCurrCategories = txCurrTrend.map((p) => p.label);
    const txNewCategories = txNewTrend.map((p) => p.label);
    const htsCategories = htsTrend.map((p) => p.label);

    const txCurrValues = txCurrTrend.map((p) => p.value);
    const txNewValues = txNewTrend.map((p) => p.value);
    const htsTestedValues = htsTrend.map((p) => p.tested);
    const htsPositiveValues = htsTrend.map((p) => p.positive);
    const htsPositivityValues = htsTrend.map((p) => p.positivity_rate);

    // Month the KPI cards represent: the newest month present in the payload.
    const latestPeriodLabel =
      (txCurrTrend.slice(-1)[0] || {}).label ||
      (txNewTrend.slice(-1)[0] || {}).label ||
      (htsTrend.slice(-1)[0] || {}).label ||
      "no reports";

    const latestTxCurr = Number(latest.tx_curr || 0);
    const latestTxNew = Number(latest.tx_new || 0);
    const latestTested = Number(latest.hts_tested || 0);
    const latestPositive = Number(latest.hts_positive || 0);
    const latestPositivity = Number(latest.positivity_rate || 0);
    const vlUptake = Number(latestVl.vl_uptake || 0);
    // Partner-notification services (PNS), not ART linkage: index_offered /
    // index_accepted come from the `partner_notification` spec.
    const linkageAccepted = Number(latestPns.index_accepted || 0);
    const linkageOffered = Number(latestPns.index_offered || 0);
    const linkageDeclined = Math.max(0, linkageOffered - linkageAccepted);
    // True ART linkage = (linked within + linked outside) ÷ HTS positives.
    const linkageLinked =
      Number(latestLinkage.linked_within || 0) +
      Number(latestLinkage.linked_outside || 0);
    const prepCurr = Number(latestPrep.prep_curr || 0);
    // These used to be Math.round(x * 100) percentages, which collapsed to a
    // flat 0% (90 ÷ 22,851 rounds to zero) or clamped to 100% (22,851 ÷ 3,328).
    // Express them at the resolution where they actually carry information.
    const serviceContinuity =
      latestTxCurr > 0 ? (latestTxNew / latestTxCurr) * 100 : 0;
    const htsMomentum =
      latestTxCurr > 0 ? (latestTested / latestTxCurr) * 100 : 0;
    // Clients in care per test conducted this month (a workload ratio, not a %).
    const workloadIndex = latestTested > 0 ? latestTxCurr / latestTested : 0;
    // New initiations per 1,000 clients in care — readable next to positivity.
    const servicePressure =
      latestTxCurr > 0 ? (latestTxNew / latestTxCurr) * 1000 : 0;
    const vlRemaining = Math.max(0, 100 - vlUptake);

    container.innerHTML = `
      <div class="space-y-6">
        ${
          darajaNotice
            ? `<div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">${darajaNotice}</div>`
            : ""
        }
        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div class="text-2xl font-bold text-slate-800">Daraja overview</div>
              <div class="text-sm text-slate-500">A consolidated landing page that brings HIV Treatment and HIV Testing overview sections together with programme highlights and MHU workload signals.</div>
            </div>
            <div class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
              <span class="h-2 w-2 rounded-full bg-sky-500"></span> Master overview
            </div>
          </div>

          <div class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2">
            <div>
              <div class="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">Trend range</div>
              <div class="text-[10px] text-slate-400">KPI cards show <b>${latestPeriodLabel}</b> (latest reported month); charts cover the selected window</div>
            </div>
            <div class="inline-flex gap-0.5 rounded-full bg-white p-0.5 shadow-sm">
              ${[3, 6, 12]
                .map(
                  (n) =>
                    `<button data-daraja-range="${n}" class="rounded-full px-3.5 py-1 text-[11px] font-semibold transition ${
                      rangeMonths === n
                        ? "bg-sky-500 text-white shadow"
                        : "text-slate-500 hover:text-slate-800"
                    }">${n}M</button>`,
                )
                .join("")}
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
                <canvas id="darajaTreatmentCurrentLine"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:220px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Month-on-month change</div>
                <canvas id="darajaTreatmentCurrentBar"></canvas>
              </div>
            </div>
            <div class="grid gap-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Sex distribution</div>
                <canvas id="darajaTreatmentCurrentDonut"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Retention gauge</div>
                <canvas id="darajaTreatmentCurrentGauge"></canvas>
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
                <canvas id="darajaTreatmentNewLine"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:220px">
                <div class="text-sm font-semibold text-slate-700 mb-2">New starts volume</div>
                <canvas id="darajaTreatmentNewBar"></canvas>
              </div>
            </div>
            <div class="grid gap-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Sex share</div>
                <canvas id="darajaTreatmentNewDonut"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">ART uptake among positives</div>
                <canvas id="darajaTreatmentNewGauge"></canvas>
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
                <canvas id="darajaTreatmentVlLine"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:220px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Uptake vs remaining</div>
                <canvas id="darajaTreatmentVlBar"></canvas>
              </div>
            </div>
            <div class="grid gap-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">VL coverage split</div>
                <canvas id="darajaTreatmentVlDonut"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Coverage gauge</div>
                <canvas id="darajaTreatmentVlGauge"></canvas>
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
                <canvas id="darajaTestingUptakeLine"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:220px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Tested vs positive</div>
                <canvas id="darajaTestingUptakeBar"></canvas>
              </div>
            </div>
            <div class="grid gap-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Positivity split</div>
                <canvas id="darajaTestingUptakeDonut"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Momentum gauge</div>
                <canvas id="darajaTestingUptakeGauge"></canvas>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div class="text-base font-semibold text-slate-800">Linkage & partner notification</div>
              <div class="text-sm text-slate-500">Partner-notification (index) cascade — notified, accepted, declined — alongside an ART-linkage completeness gauge.</div>
            </div>
            <button data-tab="hiv_testing" class="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100">Open Linkage</button>
          </div>
          <div class="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div class="space-y-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:260px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Index notification acceptance trend</div>
                <canvas id="darajaTestingLinkageLine"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:220px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Offered vs accepted</div>
                <canvas id="darajaTestingLinkageBar"></canvas>
              </div>
            </div>
            <div class="grid gap-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Acceptance split</div>
                <canvas id="darajaTestingLinkageDonut"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">ART linkage completeness (linked \u00f7 positives)</div>
                <canvas id="darajaTestingLinkageGauge"></canvas>
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
                <canvas id="darajaTestingPrepLine"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:220px">
                <div class="text-sm font-semibold text-slate-700 mb-2">PrEP new versus current</div>
                <canvas id="darajaTestingPrepBar"></canvas>
              </div>
            </div>
            <div class="grid gap-4">
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">Client split</div>
                <canvas id="darajaTestingPrepDonut"></canvas>
              </div>
              <div class="rounded-2xl border border-slate-100 bg-slate-50 p-4" style="height:160px">
                <div class="text-sm font-semibold text-slate-700 mb-2">PrEP coverage gauge</div>
                <canvas id="darajaTestingPrepGauge"></canvas>
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
            <button data-tab="daraja" class="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Refresh overview</button>
          </div>

          <div class="mt-4 grid gap-4 lg:grid-cols-3">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Continuity</div>
              <div class="mt-2 text-3xl font-bold text-slate-900">${serviceContinuity.toFixed(1)}%</div>
              <div class="mt-1 text-xs text-slate-600">New starts as a share of the active caseload</div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">HTS momentum</div>
              <div class="mt-2 text-3xl font-bold text-slate-900">${htsMomentum.toFixed(1)}%</div>
              <div class="mt-1 text-xs text-slate-600">Testing volume compared to treatment pool</div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Caseload per test</div>
              <div class="mt-2 text-3xl font-bold text-slate-900">${workloadIndex.toFixed(1)}&times;</div>
              <div class="mt-1 text-xs text-slate-600">Clients in care for every test conducted</div>
            </div>
          </div>

          <div class="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div class="text-sm font-semibold text-slate-700">Workload pressure</div>
              <div class="mt-3" style="height:220px"><canvas id="darajaWorkloadPressureChart"></canvas></div>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div class="text-sm font-semibold text-slate-700">Service readiness</div>
              <div class="mt-3" style="height:220px"><canvas id="darajaWorkloadDonut"></canvas></div>
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
        if (tab === "daraja") {
          state.activePage = "daraja";
          setPageHash("daraja", "overview");
          renderCurrentView();
          return;
        }
        state.activePage = tab;
        setPageHash(tab);
        renderCurrentView();
      });
    });

    if (window.Chart) {
      // Sex splits: `/api/homepage/summary` returns only {period,label,value}
      // per trend point, so the male/female donuts are fed from the shared
      // 30 age x sex COC space via the tx-curr / tx-new gender-split routes.
      const currSplitTrend = currGenderJson.trend || [];
      const newSplitTrend = newGenderJson.trend || [];
      const lastCurrLabel = String(
        (txCurrTrend.slice(-1)[0] || {}).label || "",
      );
      const lastNewLabel = String((txNewTrend.slice(-1)[0] || {}).label || "");
      const currSplitLast =
        currSplitTrend.find((p) => String(p.label) === lastCurrLabel) ||
        currSplitTrend.slice(-1)[0] ||
        currGenderJson ||
        {};
      const newSplitLast =
        newSplitTrend.find((p) => String(p.label) === lastNewLabel) ||
        newSplitTrend.slice(-1)[0] ||
        newGenderJson ||
        {};

      const currentTrend = (txCurrTrend || []).map((p) => Number(p.value) || 0);
      const currentMale = [Number(currSplitLast.male) || 0];
      const currentFemale = [Number(currSplitLast.female) || 0];
      const currentChange = currentTrend.map((value, index) =>
        index === 0 ? 0 : value - currentTrend[index - 1],
      );
      // Gauges live on a 0-100 dial. A raw new-starts share (90 ÷ 22,851 =
      // 0.4%) is accurate but invisible there, so the TX_CURR dial shows the
      // complementary retention figure (share of the caseload carried over).
      const currentGaugeValue = Number(latestTxCurr)
        ? Math.max(0, 100 - (latestTxNew / latestTxCurr) * 100)
        : 0;

      const newTrend = (txNewTrend || []).map((p) => Number(p.value) || 0);
      const newMale = [Number(newSplitLast.male) || 0];
      const newFemale = [Number(newSplitLast.female) || 0];
      const newChange = newTrend.map((value, index) =>
        index === 0 ? 0 : value - newTrend[index - 1],
      );
      // ART uptake among HTS positives: of everyone who tested positive in
      // the latest month, what share was newly started on treatment.
      const newGaugeValue = Number(latestPositive)
        ? Math.min(100, (latestTxNew / latestPositive) * 100)
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

      // Partner-notification services (PNS): index_offered / index_accepted
      // come from the `partner_notification` spec. The hts_linkage payload
      // only carries linked_within / linked_outside / total_tested, which is
      // why these three charts used to render all zeros.
      const pnsTrend = pnsJson.trend || [];
      const linkageCategories = (linkageJson.trend || []).map((p) => p.label);
      const linkageAcceptedTrend = linkageCategories.map((lbl, i) => {
        const row =
          pnsTrend.find((p) => String(p.label) === String(lbl)) ||
          pnsTrend[i] ||
          {};
        return Number(row.index_accepted) || 0;
      });
      const linkageOfferedTrend = linkageCategories.map((lbl, i) => {
        const row =
          pnsTrend.find((p) => String(p.label) === String(lbl)) ||
          pnsTrend[i] ||
          {};
        return Number(row.index_offered) || 0;
      });
      // Linkage gauge = ART linkage completeness for the latest month:
      // (linked within + linked outside) / HTS positives.
      const linkageGaugeValue = Number(latestPositive)
        ? Math.min(100, Math.round((linkageLinked / latestPositive) * 100))
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
        "darajaTreatmentCurrentLine",
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

      const currentBarCtx = document.getElementById(
        "darajaTreatmentCurrentBar",
      );
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
        "darajaTreatmentCurrentDonut",
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

      drawGauge("darajaTreatmentCurrentGauge", currentGaugeValue, "#7c3aed");

      const newLineCtx = document.getElementById("darajaTreatmentNewLine");
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

      const newBarCtx = document.getElementById("darajaTreatmentNewBar");
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

      const newDonutCtx = document.getElementById("darajaTreatmentNewDonut");
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

      drawGauge("darajaTreatmentNewGauge", newGaugeValue, "#0f766e");

      const vlLineCtx = document.getElementById("darajaTreatmentVlLine");
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

      const vlBarCtx = document.getElementById("darajaTreatmentVlBar");
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

      const vlDonutCtx = document.getElementById("darajaTreatmentVlDonut");
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

      drawGauge("darajaTreatmentVlGauge", vlGaugeValue, "#16a34a");

      const testingUptakeLineCtx = document.getElementById(
        "darajaTestingUptakeLine",
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
        "darajaTestingUptakeBar",
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
        "darajaTestingUptakeDonut",
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

      drawGauge("darajaTestingUptakeGauge", htsUptakeGauge, "#0891b2");

      const testingLinkageLineCtx = document.getElementById(
        "darajaTestingLinkageLine",
      );
      if (testingLinkageLineCtx) {
        new Chart(testingLinkageLineCtx, {
          type: "line",
          data: {
            labels: linkageCategories,
            datasets: [
              {
                label: "Index accepted",
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
        "darajaTestingLinkageBar",
      );
      if (testingLinkageBarCtx) {
        new Chart(testingLinkageBarCtx, {
          type: "bar",
          data: {
            labels: linkageCategories,
            datasets: [
              {
                label: "Notified",
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
        "darajaTestingLinkageDonut",
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

      drawGauge("darajaTestingLinkageGauge", linkageGaugeValue, "#2563eb");

      const testingPrepLineCtx = document.getElementById(
        "darajaTestingPrepLine",
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

      const testingPrepBarCtx = document.getElementById("darajaTestingPrepBar");
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
        "darajaTestingPrepDonut",
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

      drawGauge("darajaTestingPrepGauge", prepSplitGauge, "#16a34a");

      const workloadPressureCtx = document.getElementById(
        "darajaWorkloadPressureChart",
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
                label: "New starts per 1,000 in care",
                data: htsCategories.map(() =>
                  Number(servicePressure.toFixed(1)),
                ),
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
              y: { beginAtZero: true, ticks: { callback: (v) => v } },
            },
          },
        });
      }

      const workloadDonutCtx = document.getElementById("darajaWorkloadDonut");
      if (workloadDonutCtx) {
        new Chart(workloadDonutCtx, {
          type: "doughnut",
          data: {
            labels: ["New starts this month", "Continuing in care"],
            datasets: [
              {
                data: [latestTxNew, Math.max(0, latestTxCurr - latestTxNew)],
                backgroundColor: ["#14b8a6", "#e2e8f0"],
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
                    `${ctx.label}: ${Number(ctx.parsed).toLocaleString()}`,
                },
              },
            },
          },
        });
      }
    }
  } catch (err) {
    container.innerHTML = `<div class="rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
      <div class="text-red-500 text-sm">⚠️ Error loading Daraja overview: ${escapeHtml(err.message)}</div>
    </div>`;
  }
}

async function renderDarajaTxCurrAnalytics(container) {
  container.innerHTML = `
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="text-xs font-semibold text-slate-700 mb-1">💊 TX_CURR Analytics</div>
      <div class="text-[10px] text-slate-400 mb-3">Detailed TX_CURR analysis views powered by live DHIS2 data</div>
      <div class="flex flex-wrap gap-1.5 mb-3" id="daraja-analytics-tabs">
        <button class="dhis-analytics-btn active" data-view="trend">📈 Trend</button>
        <button class="dhis-analytics-btn" data-view="gender">👫 Gender</button>
        <button class="dhis-analytics-btn" data-view="age">👶 Age</button>
        <button class="dhis-analytics-btn" data-view="yearly">📅 Yearly</button>
        <button class="dhis-analytics-btn" data-view="mmd">💊 MMD</button>
        <button class="dhis-analytics-btn" data-view="mom">📊 MoM</button>
      </div>
      <div id="daraja-analytics-container" class="min-h-[150px]">
        <div class="flex items-center justify-center py-10 text-slate-400 text-xs">Select a view above</div>
      </div>
    </div>
  `;

  const tabsEl = document.getElementById("daraja-analytics-tabs");
  const analyticsContainer = document.getElementById(
    "daraja-analytics-container",
  );
  if (!tabsEl || !analyticsContainer) return;

  const locationParams = new URLSearchParams();
  locationParams.set("county", darajaCountyParam());
  if (state.subCountyFilter !== "all")
    locationParams.set("subcounty", state.subCountyFilter);
  if (state.facilityFilter !== "all")
    locationParams.set("facility", state.facilityFilter);
  // Anchor the reporting window the same way the Overview does; without it
  // every route silently fell back to its own LAST_12_MONTHS default.
  locationParams.set("period", buildMonthRangeParam(currentYmParam(), 12));

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
      renderDarajaTrendView(analyticsContainer, locationParams.toString());
    } else {
      // Each tab must point at the endpoint that actually carries that
      // dimension. `tx-curr-gender`, `tx-curr-age` and `tx-curr-mmd` all
      // returned the *undifferentiated* TX_CURR monthly total, so the Gender,
      // Age and MMD tabs were each redrawing the same number.
      const endpointMap = {
        gender: "/api/hiv-treatment/tx-curr-gender-split",
        age: "/api/hiv-treatment/tx-curr-age-split",
        yearly: "/api/hiv-treatment/tx-curr-yearly",
        mmd: "/api/hiv-treatment/daraja-regimens",
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
              renderDarajaGenderSplit(analyticsContainer, d);
              break;
            case "age":
              renderDarajaAgeSplit(analyticsContainer, d);
              break;
            case "yearly":
              renderYearlyAnalytics(analyticsContainer, d);
              break;
            case "mmd":
              renderDarajaRegimens(analyticsContainer, d);
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

async function renderDarajaTrendView(container, params) {
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

// ── Daraja-local analytics renderers ───────────────────────────────
// The shared renderers in `js/analytics.js` expect a flat {label: value}
// map, which is why the Gender/Age/MMD tabs were fed an undifferentiated
// TX_CURR total. These three consume the real dimension payloads instead.

const DARAJA_ANALYTICS_COLORS = {
  male: "#1B7F96",
  female: "#8B5FBF",
  primary: "#0F3D5C",
  accent: "#20B2AA",
};

// Male vs Female TX_CURR — payload from /api/hiv-treatment/tx-curr-gender-split
// {male, female, total, latest_period, trend:[{label, male, female}]}
function renderDarajaGenderSplit(container, d) {
  const trend = d.trend || [];
  if (!trend.length) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400">No gender data available for this location.</div>`;
    return;
  }

  const labels = trend.map((p) => p.label);
  const males = trend.map((p) => Number(p.male) || 0);
  const females = trend.map((p) => Number(p.female) || 0);
  const last = trend[trend.length - 1];
  const male = Number(last.male) || 0;
  const female = Number(last.female) || 0;
  const total = male + female;
  const femalePct = total ? ((female / total) * 100).toFixed(1) : "0";

  container.innerHTML = `
    <div class="space-y-4">
      <div>
        <h3 class="text-sm font-semibold text-slate-900 mb-1">👫 TX_CURR by sex</h3>
        <div class="text-[10px] text-slate-400 mb-3">Latest reported month: <b>${escapeHtml(d.latest_period || last.label || "")}</b></div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div class="bg-white border border-slate-200 rounded-lg p-3">
            <div class="text-xs text-slate-500 mb-1">Total (latest)</div>
            <div class="text-2xl font-bold text-slate-900">${total.toLocaleString()}</div>
          </div>
          <div class="bg-white border border-slate-200 rounded-lg p-3">
            <div class="text-xs text-slate-500 mb-1">Male</div>
            <div class="text-2xl font-bold text-sky-700">${male.toLocaleString()}</div>
          </div>
          <div class="bg-white border border-slate-200 rounded-lg p-3">
            <div class="text-xs text-slate-500 mb-1">Female</div>
            <div class="text-2xl font-bold text-violet-700">${female.toLocaleString()}</div>
          </div>
          <div class="bg-white border border-slate-200 rounded-lg p-3">
            <div class="text-xs text-slate-500 mb-1">% Female</div>
            <div class="text-2xl font-bold text-slate-900">${femalePct}%</div>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-4">
          <div class="text-xs font-semibold text-slate-600 mb-1">Male / female composition by month</div>
          <div style="height:300px"><canvas id="darajaGenderSplitTrend"></canvas></div>
        </div>
        <div class="bg-white border border-slate-200 rounded-lg p-4">
          <div class="text-xs font-semibold text-slate-600 mb-1">Latest month</div>
          <div style="height:300px"><canvas id="darajaGenderSplitDonut"></canvas></div>
        </div>
      </div>
    </div>
  `;

  if (!window.Chart) return;
  const trendCtx = document.getElementById("darajaGenderSplitTrend");
  if (trendCtx) {
    new Chart(trendCtx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Female",
            data: females,
            backgroundColor: DARAJA_ANALYTICS_COLORS.female,
            stack: "txc",
          },
          {
            label: "Male",
            data: males,
            backgroundColor: DARAJA_ANALYTICS_COLORS.male,
            stack: "txc",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 12, font: { size: 10 } },
          },
        },
        scales: {
          x: {
            stacked: true,
            ticks: { font: { size: 9 }, maxRotation: -45 },
            grid: { display: false },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { font: { size: 10 } },
            grid: { color: "rgba(0,0,0,0.05)" },
          },
        },
      },
    });
  }

  const donutCtx = document.getElementById("darajaGenderSplitDonut");
  if (donutCtx) {
    new Chart(donutCtx, {
      type: "doughnut",
      data: {
        labels: ["Male", "Female"],
        datasets: [
          {
            data: [male, female],
            backgroundColor: [
              DARAJA_ANALYTICS_COLORS.male,
              DARAJA_ANALYTICS_COLORS.female,
            ],
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 12, font: { size: 10 } },
          },
        },
      },
    });
  }
}

// Age-band TX_CURR — payload from /api/hiv-treatment/tx-curr-age-split
// {age_data:[{age, value}], latest_period, trend:[{label, value}]}
function renderDarajaAgeSplit(container, d) {
  const bands = (d.age_data || []).filter((b) => b && b.age != null);
  if (!bands.length) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400">No age data available for this location.</div>`;
    return;
  }

  const labels = bands.map((b) => String(b.age));
  const values = bands.map((b) => Number(b.value) || 0);
  const total = values.reduce((s, v) => s + v, 0);
  const peakIdx = values.indexOf(Math.max(...values));

  const palette = [
    "#0F3D5C",
    "#14556F",
    "#1B7F96",
    "#20B2AA",
    "#2CC0A8",
    "#48BB78",
    "#7BC67E",
    "#F59E0B",
    "#E08B2B",
    "#DC3545",
    "#C0455A",
    "#8B5FBF",
    "#9D7BD8",
    "#6B7280",
    "#374151",
  ];

  container.innerHTML = `
    <div class="space-y-4">
      <div>
        <h3 class="text-sm font-semibold text-slate-900 mb-1">👶 TX_CURR by age band</h3>
        <div class="text-[10px] text-slate-400 mb-3">Latest reported month: <b>${escapeHtml(d.latest_period || "")}</b> · 15 DHIS2 COC age bands</div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="bg-white border border-slate-200 rounded-lg p-3">
            <div class="text-xs text-slate-500 mb-1">Total across bands</div>
            <div class="text-2xl font-bold text-slate-900">${total.toLocaleString()}</div>
          </div>
          <div class="bg-white border border-slate-200 rounded-lg p-3">
            <div class="text-xs text-slate-500 mb-1">Largest band</div>
            <div class="text-2xl font-bold text-slate-900">${escapeHtml(labels[peakIdx])}</div>
            <div class="text-xs text-slate-500">${values[peakIdx].toLocaleString()} patients</div>
          </div>
          <div class="bg-white border border-slate-200 rounded-lg p-3">
            <div class="text-xs text-slate-500 mb-1">Bands reported</div>
            <div class="text-2xl font-bold text-slate-900">${values.filter((v) => v > 0).length} / ${labels.length}</div>
          </div>
        </div>
      </div>
      <div class="bg-white border border-slate-200 rounded-lg p-4">
        <div class="text-xs font-semibold text-slate-600 mb-1">Patients per age band</div>
        <div style="height:360px"><canvas id="darajaAgeSplitChart"></canvas></div>
      </div>
      <div class="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-4 py-3 text-left font-semibold text-slate-900">Age band</th>
              <th class="px-4 py-3 text-right font-semibold text-slate-900">Patients</th>
              <th class="px-4 py-3 text-right font-semibold text-slate-900">% Share</th>
            </tr>
          </thead>
          <tbody>
            ${bands
              .map((b) => {
                const v = Number(b.value) || 0;
                const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0.0";
                return `<tr class="border-b border-slate-200 hover:bg-slate-50">
                  <td class="px-4 py-3 font-semibold text-slate-900">${escapeHtml(String(b.age))}</td>
                  <td class="px-4 py-3 text-right text-slate-700">${v.toLocaleString()}</td>
                  <td class="px-4 py-3 text-right text-slate-700">${pct}%</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (!window.Chart) return;
  const ctx = document.getElementById("darajaAgeSplitChart");
  if (ctx) {
    new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Patients",
            data: values,
            backgroundColor: values.map((_, i) => palette[i % palette.length]),
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
            ticks: { font: { size: 10 }, maxRotation: -45 },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { font: { size: 10 } },
            grid: { color: "rgba(0,0,0,0.05)" },
          },
        },
      },
    });
  }
}

// ART regimen mix — payload from /api/hiv-treatment/daraja-regimens
// {regimens:[{id, label, value}], total, latest_period}
function renderDarajaRegimens(container, d) {
  const all = d.regimens || [];
  const rows = all
    .map((r) => ({ label: String(r.label || ""), value: Number(r.value) || 0 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  if (!rows.length) {
    container.innerHTML = `<div class="text-center py-6 text-xs text-slate-400">No regimen data reported for this location.</div>`;
    return;
  }

  const labels = rows.map((r) => r.label);
  const values = rows.map((r) => r.value);
  const total = values.reduce((s, v) => s + v, 0);
  const dtg = rows
    .filter((r) => r.label.toLowerCase().includes("dtg"))
    .reduce((s, r) => s + r.value, 0);
  const dtgPct = total ? ((dtg / total) * 100).toFixed(1) : "0";

  const palette = [
    "#0F3D5C",
    "#1B7F96",
    "#20B2AA",
    "#48BB78",
    "#F59E0B",
    "#8B5BFB",
    "#DC3545",
    "#6B7280",
  ];

  container.innerHTML = `
    <div class="space-y-4">
      <div>
        <h3 class="text-sm font-semibold text-slate-900 mb-1">💊 ART regimen mix</h3>
        <div class="text-[10px] text-slate-400 mb-3">Latest reported month: <b>${escapeHtml(d.latest_period || "")}</b> · CHAK Stawisha TX_CURR regimen elements</div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="bg-white border border-slate-200 rounded-lg p-3">
            <div class="text-xs text-slate-500 mb-1">Total on a reported regimen</div>
            <div class="text-2xl font-bold text-slate-900">${total.toLocaleString()}</div>
          </div>
          <div class="bg-white border border-slate-200 rounded-lg p-3">
            <div class="text-xs text-slate-500 mb-1">On DTG</div>
            <div class="text-2xl font-bold text-emerald-700">${dtg.toLocaleString()}</div>
            <div class="text-xs text-slate-500">${dtgPct}% of reported</div>
          </div>
          <div class="bg-white border border-slate-200 rounded-lg p-3">
            <div class="text-xs text-slate-500 mb-1">Regimens with data</div>
            <div class="text-2xl font-bold text-slate-900">${rows.length} / ${all.length}</div>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-4">
          <div class="text-xs font-semibold text-slate-600 mb-1">Patients per regimen</div>
          <div style="height:340px"><canvas id="darajaRegimenBar"></canvas></div>
        </div>
        <div class="bg-white border border-slate-200 rounded-lg p-4">
          <div class="text-xs font-semibold text-slate-600 mb-1">Share of reported total</div>
          <div style="height:340px"><canvas id="darajaRegimenDonut"></canvas></div>
        </div>
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
            ${rows
              .map((r) => {
                const pct =
                  total > 0 ? ((r.value / total) * 100).toFixed(1) : "0.0";
                return `<tr class="border-b border-slate-200 hover:bg-slate-50">
                  <td class="px-4 py-3 text-slate-700">${escapeHtml(r.label)}</td>
                  <td class="px-4 py-3 text-right font-semibold text-slate-900">${r.value.toLocaleString()}</td>
                  <td class="px-4 py-3 text-right text-slate-700">${pct}%</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (!window.Chart) return;
  const barCtx = document.getElementById("darajaRegimenBar");
  if (barCtx) {
    new Chart(barCtx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Patients",
            data: values,
            backgroundColor: values.map((_, i) => palette[i % palette.length]),
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
            ticks: { font: { size: 10 } },
            grid: { color: "rgba(0,0,0,0.05)" },
          },
          y: { ticks: { font: { size: 10 } }, grid: { display: false } },
        },
      },
    });
  }

  const donutCtx = document.getElementById("darajaRegimenDonut");
  if (donutCtx) {
    new Chart(donutCtx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: values.map((_, i) => palette[i % palette.length]),
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "58%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 10, font: { size: 9 } },
          },
        },
      },
    });
  }
}
