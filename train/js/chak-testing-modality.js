// ============================================================
// chak-testing-modality.js  (extracted from main.js lines 17383-17509)
// per-page CHAK renderer 17383-17509
// ============================================================
registerChakRenderer(
  "testing-modality",
  "testing-modality",
  function (el, data) {
    const trend = data.trend || [];
    var posSum = chakSum(trend, "positive");
    var txNewSum = chakSum(trend, "tx_new");
    var testedSum = chakSum(trend, "tested");
    var yieldAvg = chakAvg(trend, "yield_pct");
    el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-layer-group"></i> Testing per Modality</h2><p>Testing by entry point: ${chakFmt(testedSum)} tested, ${chakFmt(posSum)} positive (${yieldAvg}% yield)</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Tested</div><div class="chak-kpi-value blue">${chakFmt(testedSum)}</div><div class="chak-kpi-sub">All modalities</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Positive</div><div class="chak-kpi-value pink">${chakFmt(posSum)}</div><div class="chak-kpi-sub">HIV positive diagnoses</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg Yield</div><div class="chak-kpi-value orange">${yieldAvg}%</div><div class="chak-kpi-sub">% positive of tested</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_NEW (Total)</div><div class="chak-kpi-value teal">${chakFmt(txNewSum)}</div><div class="chak-kpi-sub">Started ART</div></div>
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 Tested + Yield (Combo)", "chakModCombo")}
      ${chakChartCard("📊 Positive → TX_NEW Cascade", "chakModBars")}
      ${chakChartCard("📊 Tested by Modality + Yield %", "chakModDual")}
      ${chakChartCard("📈 Trend: Tested, Positive, Yield", "chakModalityTrend", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tested", "positive", "yield_pct", "tx_new"], ["Month", "Tested", "Positive", "Yield %", "TX_NEW"])}
    `;
    el.setAttribute("data-chak-slug", "testing-modality");
    _chakSetData("testing-modality", data);

    // Chart 1: Combo - Tested bars + Yield % line
    chakCreateChart(
      "chakModCombo",
      chakLineClusteredColumnComboChart(
        trend,
        [{ key: "tested", label: "Tested", color: CHAK_COLORS.blue + "80" }],
        [{ key: "yield_pct", label: "Yield %", color: CHAK_COLORS.orange }],
      ),
    );

    // Chart 2: Cascade bars
    chakCreateChart(
      "chakModBars",
      chakBarChart(trend, [
        { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
        { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
      ]),
    );

    // Chart 3: Dual axis - Tested + Yield % combo (full control)
    chakCreateChart("chakModDual", {
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
            backgroundColor: CHAK_COLORS.blue + "60",
            borderRadius: 3,
            order: 2,
          },
          {
            label: "Yield %",
            data: trend.map(function (d) {
              return d.yield_pct || 0;
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
            title: { display: true, text: "Yield %" },
          },
        },
      },
    });

    // Chart 4: Multi-line trend
    chakCreateChart(
      "chakModalityTrend",
      chakLineChart(trend, [
        { key: "tested", label: "Tested", color: CHAK_COLORS.blue },
        { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
        {
          key: "yield_pct",
          label: "Yield %",
          color: CHAK_COLORS.orange,
          yAxisID: "y1",
        },
      ]),
    );
  },
);

// ── Linkage (HTS Linkage page from PBIX) ──
