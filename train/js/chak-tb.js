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
      <h2><i class="fas fa-lungs"></i> TB Cascade · Testing → HIV Status Known → ART Integration</h2>
      <p>TB cascade: TB cases with known HIV status → those who are HIV+ → linked to ART</p>
    </div>

    <!-- Row 1: Screening & Diagnosis -->
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❶ TB Cases with Known HIV Status</div>
        <div class="chak-kpi-value blue">${chakFmt(totScreened)}</div>
        <div class="chak-kpi-sub">TB_STAT(Num) — TB cases whose HIV status is known</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❷ TB Positive</div>
        <div class="chak-kpi-value red">${chakFmt(totPos)}</div>
        <div class="chak-kpi-sub">TB cases who are HIV-positive <code>TB_ART(Den)</code></div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❸ Positivity Rate</div>
        <div class="chak-kpi-value orange">${posPct}%</div>
        <div class="chak-kpi-sub">HIV+ among TB cases with known status <code>%TB Pos</code></div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❹ Not Positive</div>
        <div class="chak-kpi-value" style="color:#94a3b8">${chakFmt(notPositive)}</div>
        <div class="chak-kpi-sub">HIV-negative (Known status − HIV+)</div>
      </div>
    </div>

    <!-- Row 2: ART Integration -->
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card" style="border-left:4px solid #ea580c">
        <div class="chak-kpi-label">❺ TB on ART</div>
        <div class="chak-kpi-value purple">${chakFmt(totOnArt)}</div>
        <div class="chak-kpi-sub">HIV+ TB cases on ART (TB_ART(Num))</div>
      </div>
      <div class="chak-kpi-card">
        <div class="chak-kpi-label">❻ ART Uptake</div>
        <div class="chak-kpi-value green">${artPct}%</div>
        <div class="chak-kpi-sub">% HIV+ TB cases on ART (% TB on ART)</div>
      </div>
      <div class="chak-kpi-card" style="border-left:4px solid #dc2626">
        <div class="chak-kpi-label">❼ Not on ART</div>
        <div class="chak-kpi-value" style="color:#dc2626">${chakFmt(notOnArt)}</div>
        <div class="chak-kpi-sub">HIV+ TB cases not on ART (Missed ART)</div>
      </div>
      <div class="chak-kpi-card" style="border-left:4px solid #16a34a">
        <div class="chak-kpi-label">❽ Treatment Gap Closed</div>
        <div class="chak-kpi-value" style="color:#16a34a">${totPos > 0 ? Math.round((totOnArt / totPos) * 100) : 0}%</div>
        <div class="chak-kpi-sub">% of HIV+ TB cases on ART</div>
      </div>
    </div>

    <!-- Cascade Charts (7) — Top: Full horizontal cascade, 4 detail charts + 2 PBIX-style combo charts -->
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakHighchartsCard("📊 TB All-Indicators Cascade — Full Flow (Horizontal)", "chakTbTopCascade", "full")}
      ${chakChartCard("📊 TB Cascade — Known status → HIV+ → On ART", "chakTbCascade1")}
      ${chakChartCard("📊 HIV Status Outcome — Known status · HIV+ · HIV-", "chakTbCascade2")}
      ${chakChartCard("📊 Treatment Gap — HIV+ · On ART · Not on ART", "chakTbCascade3")}
      ${chakChartCard("📊 ART Integration — HIV+ · On ART · Uptake %", "chakTbCascade4")}
      ${chakChartCard("📈 Monthly TB Trend — Known HIV Status + %TB Pos (Combo)", "chakTbTrendCombo")}
      ${chakChartCard("📊 Monthly TB by Outcome (Clustered)", "chakTbMonthly")}
    </div>

    <!-- Cascade Description -->
    <div class="chak-chart-card full" style="margin-top:4px">
      <div class="chak-chart-header"><h3>🔍 How to read this cascade</h3></div>
      <div style="font-size:12px;color:#4b5563;line-height:1.7">
        <p><strong>Step 1 (TB &amp; HIV status):</strong> <code>TB_STAT(Num)</code> — TB cases whose HIV status is known. <code>Positivity Rate</code> (<code>%TB Pos</code>) = HIV+ among those cases.</p>
        <p><strong>Step 2 (HIV status):</strong> <code>TB_ART(Den)</code> = TB cases who are HIV-positive. <code>Not Positive</code> = known status but HIV-negative.</p>
        <p><strong>Step 3 (ART Integration):</strong> <code>TB_ART(Num)</code> = HIV+ TB cases on antiretroviral therapy. <code>Not on ART</code> = the treatment gap (<code>Missed ART</code>).</p>
        <p><strong>Step 4 (Goal):</strong> 100% of HIV+ TB cases on ART. <span style="color:#16a34a;font-weight:600">Target: Gap = 0, ART Uptake = 100%.</span></p>
        <p style="margin-top:6px;color:#6b7280;font-size:11px"><strong>Charts:</strong> ① Full cascade (horizontal, all indicators) · ② Cascade (stepped) · ③ HIV status outcome (Known status, HIV+, HIV-) · ④ Treatment gap (HIV+, On ART, Not on ART) · ⑤ ART integration (HIV+, On ART, Uptake %)</p>
      </div>
    </div>`;

  el.setAttribute("data-chak-slug", "tb");
  _chakSetData("tb", data);

  // ── Chart 1: TB Cascade (Known status → HIV+ → On ART) ──
  chakCreateChart("chakTbCascade1", {
    type: "bar",
    data: {
      labels: ["Known HIV Status", "HIV Positive", "On ART"],
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

  // ── Chart 2: HIV Status Outcome (Known status · HIV+ · HIV-) ──
  chakCreateChart("chakTbCascade2", {
    type: "bar",
    data: {
      labels: ["Known HIV Status", "HIV Positive", "HIV Negative"],
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
                "TB cases with known HIV status (TB_STAT(Num))",
                "TB cases who are HIV-positive (TB_ART(Den))",
                "Known status − HIV+ (negative)",
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

  // ── Chart 3: Treatment Gap (HIV+ · On ART · Not on ART) ──
  chakCreateChart("chakTbCascade3", {
    type: "bar",
    data: {
      labels: ["HIV+ TB Cases", "On ART", "Not on ART"],
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
                "HIV-positive TB cases (TB_ART(Den))",
                "HIV+ TB patients on ART",
                "HIV+ not on ART (missed ART)",
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

  // ── Chart 4: ART Integration (HIV+ · On ART · Uptake %) ──
  // Mixed: bars for counts + line for %
  chakCreateChart("chakTbCascade4", {
    type: "bar",
    data: {
      labels: ["HIV+ TB Cases", "On ART", "ART Uptake"],
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
                "HIV-positive TB cases (TB_ART(Den))",
                "HIV+ TB patients on ART (TB_ART(Num))",
                "ART uptake % among HIV+ TB cases",
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
  const totPresumptive = chakSum(trend, "tb_stat_den");
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
        text: "TB cascade: known HIV status → HIV+ → linked to ART · Flow: Step ❶ → Step ❽",
        style: { fontSize: "11px", color: "#6b7280" },
      },
      xAxis: {
        categories: [
          "❶ Known HIV Status",
          "❷ STAT Den",
          "❸ HIV Positive",
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
            "TB cases with known HIV status (TB_STAT(Num))",
            "TB_STAT denominator (known status universe)",
            "TB cases who are HIV-positive (TB_ART(Den))",
            "Known status − HIV+ (HIV-negative)",
            "HIV+ TB cases on ART (TB_ART(Num))",
            "% of HIV+ TB cases on ART (% TB on ART)",
            "HIV+ not on ART (missed ART — target: 0)",
            "% of HIV+ TB cases on ART (gap closed)",
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

  // ── PBIX-style Combo Chart: Monthly known HIV status + %TB Pos ──
  chakCreateChart("chakTbTrendCombo", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Known HIV Status",
          data: trend.map(function (d) {
            return d.tb_screened || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "80",
          borderRadius: 3,
          order: 2,
        },
        {
          label: "HIV Positive",
          data: trend.map(function (d) {
            return d.tb_pos || 0;
          }),
          backgroundColor: CHAK_COLORS.red + "80",
          borderRadius: 3,
          order: 2,
        },
        {
          label: "%TB Pos",
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
          title: { display: true, text: "%TB Pos" },
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
          label: "Known Status",
          data: trend.map(function (d) {
            return d.tb_screened || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "80",
          borderRadius: 3,
        },
        {
          label: "STAT Den",
          data: trend.map(function (d) {
            return d.tb_stat_den || 0;
          }),
          backgroundColor: CHAK_COLORS.teal + "80",
          borderRadius: 3,
        },
        {
          label: "HIV Positive",
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
