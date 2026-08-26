// ============================================================
// overviews.js  (extracted from main.js lines 7558-9400)
// domain section 7558-9400
// ============================================================
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
