// ============================================================
// chak-pmtct.js  (extracted from main.js lines 15526-16077)
// per-page CHAK renderer 15526-16077
// ============================================================
registerChakRenderer("pmtct", "pmtct", function (el, data) {
  const trend = data.trend || [];
  const pmtctKp = chakSum(trend, "anc1_known_pos");
  const pmtctNewPos = chakSum(trend, "anc1_new_pos");
  const pmtctTotalPos = chakSum(trend, "total_pos");
  const pmtctStartedArt = chakSum(trend, "started_art");

  // ── Preserved existing content (hidden from UI, not removed) ──
  const existingHtml = `
    <div style="display:none" aria-hidden="true">
      <div class="chak-page-info"><h2><i class="fas fa-baby"></i> PMTCT</h2><p>Prevention of Mother-to-Child Transmission: ANC cascade</p></div>
      <div class="chak-kpi-grid">
        <div class="chak-kpi-card"><div class="chak-kpi-label">Known Pos at ANC1</div><div class="chak-kpi-value blue">${chakFmt(chakLast(trend, "anc1_known_pos"))}</div></div>
        <div class="chak-kpi-card"><div class="chak-kpi-label">New Pos at ANC1</div><div class="chak-kpi-value pink">${chakFmt(chakLast(trend, "anc1_new_pos"))}</div></div>
        <div class="chak-kpi-card"><div class="chak-kpi-label">Started ART</div><div class="chak-kpi-value green">${chakFmt(chakLast(trend, "started_art"))}</div></div>
        <div class="chak-kpi-card"><div class="chak-kpi-label">PMTCT Uptake</div><div class="chak-kpi-value purple">${chakLast(trend, "pmtct_uptake_pct")}%</div></div>
      </div>
      <div class="chak-chart-grid">
              ${chakChartCard("PMTCT Cascade", "chakPmtctCascade")}
              ${chakChartCard("PMTCT Trend", "chakPmtctTrend")}
      </div>
    </div>`;

  // ── New PMTCT Cascade UI ──
  el.innerHTML =
    existingHtml +
    `
    <div class="chak-page-info" style="margin-top:0">
      <h2><i class="fas fa-baby"></i> PMTCT Cascade · Jamii Tekelezi</h2>
      <p>Prevention of Mother-to-Child Transmission: Entry-to-Treatment cascade — 1st ANC → Tested → Positive → Total on ART</p>
    </div>

    <!-- Step 1–2: Baseline & Testing -->
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❶ 1st ANC Attendances</div>
        <div class="chak-kpi-value blue">0</div>
        <div class="chak-kpi-sub">Total ANC 1 visits (universe of pregnant women)</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❷ KP (Known Positive at Entry)</div>
        <div class="chak-kpi-value pink">${chakFmt(pmtctKp)}</div>
        <div class="chak-kpi-sub">Known HIV+ before this ANC visit</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❸ Tested for HIV at ANC</div>
        <div class="chak-kpi-value teal">0</div>
        <div class="chak-kpi-sub">Unknown status women who accepted testing</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❹ New Pos (Newly Tested +)</div>
        <div class="chak-kpi-value red">${chakFmt(pmtctNewPos)}</div>
        <div class="chak-kpi-sub">Newly diagnosed HIV+ during this visit</div>
      </div>
    </div>

    <!-- Step 3–5: Burden & Treatment -->
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card" style="border-left:4px solid #ea580c">
        <div class="chak-kpi-label">❺ Total HIV Positive Pregnant</div>
        <div class="chak-kpi-value orange">${chakFmt(pmtctTotalPos)}</div>
        <div class="chak-kpi-sub">KP + New Pos = <strong>${chakFmt(pmtctTotalPos)}</strong> (total burden)</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❻ Already on ART</div>
        <div class="chak-kpi-value purple">0</div>
        <div class="chak-kpi-sub">Known positives already on treatment</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❼ ART New (Newly Initiated)</div>
        <div class="chak-kpi-value" style="color:#0891b2">${chakFmt(pmtctStartedArt)}</div>
        <div class="chak-kpi-sub">Newly started ART this visit</div>
      </div>
      <div class="chak-kpi-card" style="border-left:4px solid #16a34a">
        <div class="chak-kpi-label">❽ Total on Maternal ART</div>
        <div class="chak-kpi-value green">${chakFmt(pmtctStartedArt)}</div>
        <div class="chak-kpi-sub">Already ART + ART New = <strong>${chakFmt(pmtctStartedArt)}</strong> ← GOAL</div>
      </div>
    </div>

    <!-- Cascade Charts (7) — Top: Full horizontal cascade, 4 detail charts + donut + 100% stacked -->
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakHighchartsCard("📊 PMTCT All-Indicators Cascade — Full Flow (Horizontal)", "chakPmtctTopCascade", "full")}
      ${chakChartCard("📊 PMTCT Cascade — 1st ANC → Tested → Positive → Total on ART", "chakPmtctCascade1")}
      ${chakChartCard("📊 ANC Testing Coverage — 1st ANC · Tested · Not Tested", "chakPmtctCascade2")}
      ${chakChartCard("📊 HIV Positive Breakdown — Total Positive · KP · New Pos", "chakPmtctCascade3")}
      ${chakChartCard("📊 ART Uptake — Total on ART · Already ART · ART New", "chakPmtctCascade4")}
      ${chakChartCard("🍩 HIV+ Composition — Known Pos vs New Pos (Donut)", "chakPmtctDonut")}
      ${chakChartCard("📊 ART Coverage Distribution (100% Stacked Bar)", "chakPmtctStacked")}
    </div>

    <!-- Cascade Description -->
    <div class="chak-chart-card full" style="margin-top:4px">
      <div class="chak-chart-header"><h3>🔍 How to read this cascade</h3></div>
      <div style="font-size:12px;color:#4b5563;line-height:1.7">
        <p><strong>Step 1 (Baseline):</strong> <code>1st ANC</code> — All pregnant women attending first ANC visit. <code>KP</code> = known HIV+ at entry.</p>
        <p><strong>Step 2 (Testing):</strong> <code>Tested</code> = women tested for HIV. <code>New Pos</code> = newly diagnosed positive.</p>
        <p><strong>Step 3 (Burden):</strong> <code>Positive</code> = <code>KP</code> + <code>New Pos</code> — total HIV+ pregnant women.</p>
        <p><strong>Step 4 (Treatment):</strong> <code>Already ART</code> + <code>ART New</code> = women on ART.</p>
        <p><strong>Step 5 (Goal):</strong> <code>ART Uptake</code> = <code>Already ART</code> + <code>ART New</code>. <span style="color:#16a34a;font-weight:600">Target: 100% of Positive = on ART.</span></p>
        <p style="margin-top:6px;color:#6b7280;font-size:11px"><strong>Charts:</strong> ① Full cascade (horizontal, all indicators) · ② Cascade (stepped) · ③ Testing coverage (1st ANC, Tested, Not Tested) · ④ Positive breakdown (Total, KP, New Pos) · ⑤ ART uptake (Total, Already, New)</p>
        <p style="margin-top:4px;color:#ea580c;font-weight:500">ℹ️ ❶ 1st ANC, ❸ Tested, ❻ Already ART show 0 — awaiting additional DHIS data fields. All other values are wired from available data.</p>
      </div>
    </div>`;

  el.setAttribute("data-chak-slug", "pmtct");
  _chakSetData("pmtct", data);

  // ── Chart 1: PMTCT Cascade (1st ANC → Tested → Positive → Total on ART) ──
  chakCreateChart("chakPmtctCascade1", {
    type: "bar",
    data: {
      labels: ["1st ANC", "Tested", "Positive (KP+New)", "Total on ART"],
      datasets: [
        {
          label: "Patients",
          data: [0, 0, pmtctTotalPos, pmtctStartedArt],
          backgroundColor: ["#2563eb", "#0d9488", "#ea580c", "#16a34a"],
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const labels = [
                "Total ANC 1 visits (universe)",
                "Tested for HIV at ANC",
                "KP + New Pos (total HIV+)",
                "Already ART + ART New (goal)",
              ];
              return (
                (ctx.raw || 0).toLocaleString() +
                " — " +
                (labels[ctx.dataIndex] || "")
              );
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: "bold", size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Patients" },
        },
      },
    },
  });

  // ── Chart 2: ANC Testing Coverage (1st ANC · Tested · Not Tested) ──
  chakCreateChart("chakPmtctCascade2", {
    type: "bar",
    data: {
      labels: ["1st ANC", "Tested", "Not Tested"],
      datasets: [
        {
          label: "Patients",
          data: [0, 0, 0],
          backgroundColor: ["#2563eb", "#0d9488", "#94a3b8"],
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const labels = [
                "Total ANC 1 visits",
                "Tested for HIV at ANC",
                "1st ANC − Tested (not tested)",
              ];
              return (
                (ctx.raw || 0).toLocaleString() +
                " — " +
                (labels[ctx.dataIndex] || "")
              );
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: "bold", size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Patients" },
        },
      },
    },
  });

  // ── Chart 3: HIV Positive Breakdown (Total Positive · KP · New Pos) ──
  chakCreateChart("chakPmtctCascade3", {
    type: "bar",
    data: {
      labels: ["Total Positive", "KP (Known Pos)", "New Pos"],
      datasets: [
        {
          label: "Patients",
          data: [pmtctTotalPos, pmtctKp, pmtctNewPos],
          backgroundColor: ["#ea580c", "#db2777", "#dc2626"],
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const labels = [
                "KP + New Pos (total HIV+ burden)",
                "Known HIV+ before ANC visit",
                "Newly diagnosed HIV+ at this visit",
              ];
              return (
                (ctx.raw || 0).toLocaleString() +
                " — " +
                (labels[ctx.dataIndex] || "")
              );
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: "bold", size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Patients" },
        },
      },
    },
  });

  // ── Chart 4: ART Uptake (Total on ART · Already ART · ART New) ──
  chakCreateChart("chakPmtctCascade4", {
    type: "bar",
    data: {
      labels: ["Total on ART", "Already ART", "ART New"],
      datasets: [
        {
          label: "Patients",
          data: [pmtctStartedArt, 0, pmtctStartedArt],
          backgroundColor: ["#16a34a", "#9333ea", "#0891b2"],
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const labels = [
                "Already ART + ART New (treatment goal)",
                "Known positives already on ART",
                "Newly initiated on ART",
              ];
              return (
                (ctx.raw || 0).toLocaleString() +
                " — " +
                (labels[ctx.dataIndex] || "")
              );
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: "bold", size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Patients" },
        },
      },
    },
  });

  // ── TOP CASCADE: Horizontal bar showing ALL 8 indicators ──
  setTimeout(function () {
    const topEl = document.getElementById("chakPmtctTopCascade");
    if (!topEl) return;
    // Compute cascade values
    const anc1 = 0; // 1st ANC — not yet in DHIS data
    const knownPos = pmtctKp;
    const tested = 0; // Tested — not yet in DHIS data
    const newPos = pmtctNewPos;
    const totalPos = pmtctTotalPos;
    const alreadyArt = 0; // Already ART — not yet in DHIS data
    const artNew = pmtctStartedArt;
    const totalArt = pmtctStartedArt; // Total on ART = Already ART + ART New

    Highcharts.chart("chakPmtctTopCascade", {
      chart: { type: "bar", height: 380 },
      title: {
        text: "PMTCT Cascade — All Indicators (Horizontal)",
        style: { fontSize: "14px", fontWeight: "bold" },
      },
      subtitle: {
        text: "Antenatal HIV cascade from entry to treatment · Flow: Step ❶ → Step ❽",
        style: { fontSize: "11px", color: "#6b7280" },
      },
      xAxis: {
        categories: [
          "❶ 1st ANC",
          "❷ KP at Entry",
          "❸ Tested",
          "❹ New Positive",
          "❺ Total Positive",
          "❻ Already on ART",
          "❼ ART New",
          "❽ Total on ART",
        ],
        labels: { style: { fontSize: "11px", fontWeight: "bold" } },
        title: {
          text: "Cascade Step",
          style: { fontSize: "11px", color: "#4b5563" },
        },
      },
      yAxis: {
        title: {
          text: "Patients (Count)",
          style: { fontSize: "11px", color: "#4b5563" },
        },
        min: 0,
        gridLineColor: "#f0f0f0",
      },
      tooltip: {
        shared: true,
        formatter: function () {
          const descs = [
            "Total ANC 1 visits (universe)",
            "Known HIV+ before this ANC visit",
            "Unknown status women who accepted testing",
            "Newly diagnosed HIV+ during this visit",
            "KP + New Pos (total HIV+ burden)",
            "Known positives already on treatment",
            "Newly started ART this visit",
            "Already ART + ART New (goal)",
          ];
          const pt = this.points?.[0];
          if (!pt) return "";
          const i = pt.point.index;
          return (
            "<b>" +
            pt.category +
            "</b><br/>" +
            (pt.y || 0).toLocaleString() +
            " — " +
            (descs[i] || "")
          );
        },
      },
      plotOptions: {
        series: {
          groupPadding: 0.08,
          borderRadius: 3,
          dataLabels: {
            enabled: true,
            formatter: function () {
              return this.y > 0 ? Highcharts.numberFormat(this.y, 0) : "—";
            },
            style: { fontSize: "10px", fontWeight: "bold" },
          },
        },
      },
      legend: { enabled: false },
      colors: [
        "#2563eb",
        "#db2777",
        "#0d9488",
        "#dc2626",
        "#ea580c",
        "#9333ea",
        "#0891b2",
        "#16a34a",
      ],
      series: [
        {
          name: "Patients",
          data: [
            anc1,
            knownPos,
            tested,
            newPos,
            totalPos,
            alreadyArt,
            artNew,
            totalArt,
          ],
        },
      ],
    });
  }, 100);

  // ── PBIX-style Chart: Donut — HIV+ Composition (Known Pos vs New Pos) ──
  chakCreateChart("chakPmtctDonut", {
    type: "doughnut",
    data: {
      labels: ["Known Positive (KP at Entry)", "New Positive (Tested at ANC)"],
      datasets: [
        {
          data: [pmtctKp, pmtctNewPos],
          backgroundColor: ["#db2777", "#ea580c"],
          borderWidth: 2,
          borderColor: "#fff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "55%",
      plugins: {
        legend: {
          position: "right",
          labels: {
            boxWidth: 14,
            padding: 12,
            font: { size: 12, weight: "bold" },
          },
        },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const total = ctx.dataset.data.reduce(function (a, b) {
                return a + b;
              }, 0);
              const pct =
                total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
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
  });

  // ── PBIX-style Chart: 100% Stacked Bar — ART Coverage Distribution ──
  const pmtctStackedLabels = [
    "KP (Known +)",
    "New Positive",
    "Total HIV+",
    "Started ART",
    "Not on ART",
  ];
  const pmtctNotOnArt = Math.max(0, pmtctTotalPos - pmtctStartedArt);
  const pmtctStackedData = [
    pmtctKp,
    pmtctNewPos,
    pmtctTotalPos,
    pmtctStartedArt,
    pmtctNotOnArt,
  ];
  const maxVal = Math.max(...pmtctStackedData, 1);
  chakCreateChart("chakPmtctStacked", {
    type: "bar",
    data: {
      labels: pmtctStackedLabels,
      datasets: [
        {
          label: "% of Max",
          data: pmtctStackedData.map(function (v) {
            return ((v / maxVal) * 100).toFixed(1);
          }),
          backgroundColor: [
            "#db2777",
            "#ea580c",
            "#9333ea",
            "#16a34a",
            "#dc2626",
          ],
          borderRadius: 3,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          min: 0,
          max: 100,
          title: { display: true, text: "% of Maximum Value" },
          grid: { color: "#f0f0f0" },
        },
        y: {
          grid: { display: false },
          ticks: { font: { weight: "bold", size: 10 } },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const raw = pmtctStackedData[ctx.dataIndex];
              return (
                (raw || 0).toLocaleString() +
                " patients (" +
                ctx.parsed.x.toFixed(1) +
                "%)"
              );
            },
          },
        },
      },
    },
  });
});

// ── TB ──
// ── TB ──
