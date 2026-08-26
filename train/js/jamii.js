// ============================================================
// jamii.js  (extracted from main.js lines 10881-12325)
// Jamii Tekelezi page
// ============================================================
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

