// ============================================================
// chak-hts-summary.js  (extracted from main.js lines 17259-17382)
// per-page CHAK renderer 17259-17382
// ============================================================
registerChakRenderer("hts-summary", "hts-summary", function (el, data) {
  const trend = data.trend || [];
  var posSum = chakSum(trend, "positive");
  var txNewSum = chakSum(trend, "tx_new");
  var txNewPct = posSum > 0 ? ((txNewSum / posSum) * 100).toFixed(1) : 0;

  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-microscope"></i> HTS Summary</h2><p>HIV Testing Services high-level summary — ${chakFmt(txNewSum)} started ART (${txNewPct}% of positive)</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Tested</div><div class="chak-kpi-value blue">${chakFmt(chakSum(trend, "tested"))}</div><div class="chak-kpi-sub">All testing encounters</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Positive</div><div class="chak-kpi-value pink">${chakFmt(posSum)}</div><div class="chak-kpi-sub">HIV positive diagnoses</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Positivity Rate</div><div class="chak-kpi-value orange">${chakAvg(trend, "positivity_pct")}%</div><div class="chak-kpi-sub">% tested positive</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_NEW (Total)</div><div class="chak-kpi-value teal">${chakFmt(txNewSum)}</div><div class="chak-kpi-sub">${txNewPct}% of positive on ART</div></div>
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 Tested + TX_NEW (Combo)", "chakHtsSumCombo")}
      ${chakChartCard("📊 Positive → TX_NEW Cascade", "chakHtsSumBars")}
      ${chakChartCard("📊 Tested + Positivity % (Combo)", "chakHtsSumCombo2")}
      ${chakChartCard("📈 All HTS Indicators", "chakHtsSummaryTrend", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tested", "positive", "positivity_pct", "tx_new"], ["Month", "Tested", "Positive", "% Positive", "TX_NEW"])}
    `;
  el.setAttribute("data-chak-slug", "hts-summary");
  _chakSetData("hts-summary", data);

  // Chart 1: Combo — Tested bars + TX_NEW line
  chakCreateChart(
    "chakHtsSumCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "tested", label: "Tested", color: CHAK_COLORS.blue + "80" }],
      [
        {
          key: "positivity_pct",
          label: "% Positive",
          color: CHAK_COLORS.orange,
        },
      ],
    ),
  );

  // Chart 2: Cascade bars
  chakCreateChart(
    "chakHtsSumBars",
    chakBarChart(trend, [
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
    ]),
  );

  // Chart 3: Tested bars + % positivity line
  chakCreateChart("chakHtsSumCombo2", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Tested",
          data: trend.map(function (d) {
            return d.tested || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "80",
          borderRadius: 3,
          order: 2,
        },
        {
          label: "% Positive",
          data: trend.map(function (d) {
            return d.positivity_pct || 0;
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
          title: { display: true, text: "Tested" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          max: 100,
          grid: { display: false },
          title: { display: true, text: "% Positive" },
        },
      },
    },
  });

  // Chart 4: Multi-line trend
  chakCreateChart(
    "chakHtsSummaryTrend",
    chakLineChart(trend, [
      { key: "tested", label: "Tested", color: CHAK_COLORS.blue },
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
    ]),
  );
});

// ── Testing Modality ──
