// ============================================================
// chak-tb.js  (extracted from main.js lines 16078-16635)
// per-page CHAK renderer 16078-16635
// ============================================================
registerChakRenderer("tb", "tb", function (el, data) {
  const trend = data.trend || [];

  // ── Preserved existing content (hidden from UI, not removed) ──
  const existingHtml = `
    <div style="display:none" aria-hidden="true">
      <div class="chak-page-info"><h2><i class="fas fa-lungs"></i> TB/HIV</h2><p>TB screening, diagnosis, and ART among TB patients</p></div>
      <div class="chak-kpi-grid">
        <div class="chak-kpi-card"><div class="chak-kpi-label">TB Screened</div><div class="chak-kpi-value blue">${chakFmt(chakSum(trend, "tb_screened"))}</div></div>
        <div class="chak-kpi-card"><div class="chak-kpi-label">TB Positive</div><div class="chak-kpi-value red">${chakFmt(chakSum(trend, "tb_pos"))}</div></div>
        <div class="chak-kpi-card"><div class="chak-kpi-label">TB Positivity</div><div class="chak-kpi-value orange">${chakAvg(trend, "tb_positivity_pct")}%</div></div>
        <div class="chak-kpi-card"><div class="chak-kpi-label">On ART Among TB</div><div class="chak-kpi-value green">${chakAvg(trend, "tb_art_uptake_pct")}%</div></div>
      </div>
      <div class="chak-chart-grid">
              ${chakChartCard("TB Cascade", "chakTbCascade")}
              ${chakChartCard("TB on ART Uptake", "chakTbArt")}
      </div>
    </div>`;

  // Compute dynamic KPIs
  const totScreened = chakSum(trend, "tb_screened");
  const totPos = chakSum(trend, "tb_pos");
  const totOnArt = chakSum(trend, "tb_on_art");
  const notPositive = Math.max(0, totScreened - totPos);
  const notOnArt = Math.max(0, totPos - totOnArt);
  const posPct = chakAvg(trend, "tb_positivity_pct");
  const artPct = chakAvg(trend, "tb_art_uptake_pct");

  el.innerHTML =
    existingHtml +
    `
    <div class="chak-page-info" style="margin-top:0">
      <h2><i class="fas fa-lungs"></i> TB Cascade · Screening → Diagnosis → ART Integration</h2>
      <p>TB screening-to-treatment cascade: Everyone screened → confirmed TB+ → linked to ART</p>
    </div>

    <!-- Row 1: Screening & Diagnosis -->
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❶ TB Screened</div>
        <div class="chak-kpi-value blue">${chakFmt(totScreened)}</div>
        <div class="chak-kpi-sub">Total TB screening encounters (universe)</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❷ TB Positive</div>
        <div class="chak-kpi-value red">${chakFmt(totPos)}</div>
        <div class="chak-kpi-sub">Confirmed bacteriologically positive</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❸ Positivity Rate</div>
        <div class="chak-kpi-value orange">${posPct}%</div>
        <div class="chak-kpi-sub">% of screened that tested positive</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❹ Not Positive</div>
        <div class="chak-kpi-value" style="color:#94a3b8">${chakFmt(notPositive)}</div>
        <div class="chak-kpi-sub">Screened but negative (Screened − Positive)</div>
      </div>
    </div>

    <!-- Row 2: ART Integration -->
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card" style="border-left:4px solid #ea580c">
        <div class="chak-kpi-label">❺ TB on ART</div>
        <div class="chak-kpi-value purple">${chakFmt(totOnArt)}</div>
        <div class="chak-kpi-sub">TB patients on ART (treatment integration)</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❻ ART Uptake</div>
        <div class="chak-kpi-value green">${artPct}%</div>
        <div class="chak-kpi-sub">% of TB+ patients on ART</div>
      </div>
      <div class="chak-kpi-card" style="border-left:4px solid #dc2626">
        <div class="chak-kpi-label">❼ Not on ART</div>
        <div class="chak-kpi-value" style="color:#dc2626">${chakFmt(notOnArt)}</div>
        <div class="chak-kpi-sub">TB+ not on ART (gap − <strong>target: 0</strong>)</div>
      </div>
      <div class="chak-kpi-card" style="border-left:4px solid #16a34a">
        <div class="chak-kpi-label">❽ Treatment Gap Closed</div>
        <div class="chak-kpi-value" style="color:#16a34a">${totPos > 0 ? Math.round((totOnArt / totPos) * 100) : 0}%</div>
        <div class="chak-kpi-sub">% of TB+ on ART (on ART ÷ Positive)</div>
      </div>
    </div>

    <!-- Cascade Charts (7) — Top: Full horizontal cascade, 4 detail charts + 2 PBIX-style combo charts -->
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakHighchartsCard("📊 TB All-Indicators Cascade — Full Flow (Horizontal)", "chakTbTopCascade", "full")}
      ${chakChartCard("📊 TB Cascade — Screened → TB+ → On ART", "chakTbCascade1")}
      ${chakChartCard("📊 Screening Outcome — Screened · Positive · Not Positive", "chakTbCascade2")}
      ${chakChartCard("📊 Treatment Gap — TB+ · On ART · Not on ART", "chakTbCascade3")}
      ${chakChartCard("📊 ART Integration — TB+ · On ART · Uptake %", "chakTbCascade4")}
      ${chakChartCard("📈 Monthly TB Trend — Screened + % Positivity (Combo)", "chakTbTrendCombo")}
      ${chakChartCard("📊 Monthly TB by Outcome (Clustered)", "chakTbMonthly")}
    </div>

    <!-- Cascade Description -->
    <div class="chak-chart-card full" style="margin-top:4px">
      <div class="chak-chart-header"><h3>🔍 How to read this cascade</h3></div>
      <div style="font-size:12px;color:#4b5563;line-height:1.7">
        <p><strong>Step 1 (Screening):</strong> <code>TB Screened</code> — All patients screened for TB (universe). <code>Positivity Rate</code> = % who test positive.</p>
        <p><strong>Step 2 (Diagnosis):</strong> <code>TB Positive</code> = confirmed bacteriologically. <code>Not Positive</code> = screened but negative.</p>
        <p><strong>Step 3 (ART Integration):</strong> <code>TB on ART</code> = TB+ patients on antiretroviral therapy. <code>Not on ART</code> = the treatment gap.</p>
        <p><strong>Step 4 (Goal):</strong> 100% of TB+ patients on ART. <span style="color:#16a34a;font-weight:600">Target: Gap = 0, ART Uptake = 100%.</span></p>
        <p style="margin-top:6px;color:#6b7280;font-size:11px"><strong>Charts:</strong> ① Full cascade (horizontal, all indicators) · ② Cascade (stepped) · ③ Screening outcome (Screened, Positive, Not Positive) · ④ Treatment gap (TB+, On ART, Not on ART) · ⑤ ART integration (TB+, On ART, Uptake %)</p>
      </div>
    </div>`;

  el.setAttribute("data-chak-slug", "tb");
  _chakSetData("tb", data);

  // ── Chart 1: TB Cascade (Screened → TB+ → On ART) ──
  chakCreateChart("chakTbCascade1", {
    type: "bar",
    data: {
      labels: ["TB Screened", "TB Positive", "On ART"],
      datasets: [
        {
          label: "Patients",
          data: [totScreened, totPos, totOnArt],
          backgroundColor: ["#2563eb", "#dc2626", "#9333ea"],
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
                "Total TB screening encounters",
                "Confirmed TB positive",
                "TB patients on ART",
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

  // ── Chart 2: Screening Outcome (Screened · Positive · Not Positive) ──
  chakCreateChart("chakTbCascade2", {
    type: "bar",
    data: {
      labels: ["TB Screened", "TB Positive", "Not Positive"],
      datasets: [
        {
          label: "Patients",
          data: [totScreened, totPos, notPositive],
          backgroundColor: ["#2563eb", "#dc2626", "#94a3b8"],
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
                "Total TB screening encounters",
                "Confirmed TB positive",
                "Screened − Positive (negative)",
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

  // ── Chart 3: Treatment Gap (TB+ · On ART · Not on ART) ──
  chakCreateChart("chakTbCascade3", {
    type: "bar",
    data: {
      labels: ["TB Positive", "On ART", "Not on ART"],
      datasets: [
        {
          label: "Patients",
          data: [totPos, totOnArt, notOnArt],
          backgroundColor: ["#ea580c", "#9333ea", "#dc2626"],
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
                "Confirmed TB positive (total)",
                "TB patients on ART",
                "TB+ not on ART (gap)",
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

  // ── Chart 4: ART Integration (TB+ · On ART · Uptake %) ──
  // Mixed: bars for counts + line for %
  chakCreateChart("chakTbCascade4", {
    type: "bar",
    data: {
      labels: ["TB Positive", "On ART", "ART Uptake"],
      datasets: [
        {
          label: "Patients",
          data: [
            totPos,
            totOnArt,
            totPos > 0 ? Math.round((totOnArt / totPos) * 100) : 0,
          ],
          backgroundColor: ["#ea580c", "#16a34a", "#0891b2"],
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
                "Confirmed TB positive (total)",
                "TB patients on ART",
                "ART uptake % among TB+",
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
          title: { display: true, text: "Patients / %" },
        },
      },
    },
  });

  // ── TOP CASCADE: Horizontal bar showing ALL 8 TB indicators ──
  const totPresumptive = chakSum(trend, "tb_presumptive");
  setTimeout(function () {
    const topEl = document.getElementById("chakTbTopCascade");
    if (!topEl) return;

    Highcharts.chart("chakTbTopCascade", {
      chart: { type: "bar", height: 380 },
      title: {
        text: "TB Cascade — All Indicators (Horizontal)",
        style: { fontSize: "14px", fontWeight: "bold" },
      },
      subtitle: {
        text: "TB screening-to-treatment cascade · Flow: Step ❶ → Step ❽",
        style: { fontSize: "11px", color: "#6b7280" },
      },
      xAxis: {
        categories: [
          "❶ TB Screened",
          "❷ TB Presumptive",
          "❸ TB Positive",
          "❹ Not Positive",
          "❺ TB on ART",
          "❻ ART Uptake %",
          "❼ Not on ART",
          "❽ Gap Closed %",
        ],
        labels: { style: { fontSize: "11px", fontWeight: "bold" } },
        title: {
          text: "Cascade Step",
          style: { fontSize: "11px", color: "#4b5563" },
        },
      },
      yAxis: {
        title: {
          text: "Patients / Percentage",
          style: { fontSize: "11px", color: "#4b5563" },
        },
        min: 0,
        gridLineColor: "#f0f0f0",
      },
      tooltip: {
        shared: true,
        formatter: function () {
          const descs = [
            "Total TB screening encounters (universe)",
            "TB presumptive cases identified",
            "Confirmed TB bacteriologically positive",
            "Screened but negative (Screened − Positive)",
            "TB patients on ART (treatment integration)",
            "% of TB+ patients on ART",
            "TB+ not on ART (gap — target: 0)",
            "% of TB+ on ART (on ART ÷ Positive)",
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
              if (this.y === 0) return "—";
              return [5, 7].includes(this.point.index)
                ? this.y + "%"
                : Highcharts.numberFormat(this.y, 0);
            },
            style: { fontSize: "10px", fontWeight: "bold" },
          },
        },
      },
      legend: { enabled: false },
      colors: [
        "#2563eb",
        "#0d9488",
        "#dc2626",
        "#94a3b8",
        "#9333ea",
        "#16a34a",
        "#dc2626",
        "#16a34a",
      ],
      series: [
        {
          name: "Patients",
          data: [
            totScreened,
            totPresumptive,
            totPos,
            notPositive,
            totOnArt,
            artPct,
            notOnArt,
            totPos > 0 ? Math.round((totOnArt / totPos) * 100) : 0,
          ],
        },
      ],
    });
  }, 100);

  // ── PBIX-style Combo Chart: Monthly TB Screened + % Positivity ──
  chakCreateChart("chakTbTrendCombo", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "TB Screened",
          data: trend.map(function (d) {
            return d.tb_screened || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "80",
          borderRadius: 3,
          order: 2,
        },
        {
          label: "TB Positive",
          data: trend.map(function (d) {
            return d.tb_pos || 0;
          }),
          backgroundColor: CHAK_COLORS.red + "80",
          borderRadius: 3,
          order: 2,
        },
        {
          label: "% Positivity",
          data: trend.map(function (d) {
            return d.tb_positivity_pct || 0;
          }),
          type: "line",
          borderColor: CHAK_COLORS.orange,
          backgroundColor: CHAK_COLORS.orange + "20",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: CHAK_COLORS.orange,
          yAxisID: "y1",
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          position: "left",
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "Patients" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          max: 100,
          grid: { display: false },
          title: { display: true, text: "% Positivity" },
        },
      },
    },
  });

  // ── PBIX-style Clustered Column: Monthly TB breakdown ──
  chakCreateChart("chakTbMonthly", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Screened",
          data: trend.map(function (d) {
            return d.tb_screened || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "80",
          borderRadius: 3,
        },
        {
          label: "Presumptive",
          data: trend.map(function (d) {
            return d.tb_presumptive || 0;
          }),
          backgroundColor: CHAK_COLORS.teal + "80",
          borderRadius: 3,
        },
        {
          label: "Positive",
          data: trend.map(function (d) {
            return d.tb_pos || 0;
          }),
          backgroundColor: CHAK_COLORS.red + "80",
          borderRadius: 3,
        },
        {
          label: "On ART",
          data: trend.map(function (d) {
            return d.tb_on_art || 0;
          }),
          backgroundColor: CHAK_COLORS.purple + "80",
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: { boxWidth: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
      },
    },
  });
});

// ── Post Rape ──
