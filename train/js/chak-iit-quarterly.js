// ============================================================
// chak-iit-quarterly.js  (extracted from main.js lines 17105-17258)
// per-page CHAK renderer 17105-17258
// ============================================================
registerChakRenderer("iit-quarterly", "iit-quarterly", function (el, data) {
  const trend = data.trend || [];
  var iitPctAvg = chakAvg(trend, "iit_pct");
  var totIit = chakSum(trend, "tx_ml");
  var latestTxCurr = chakLast(trend, "tx_curr");
  var latestIit = chakLast(trend, "tx_ml");
  var latestIitPct = chakLast(trend, "iit_pct");

  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-triangle-exclamation"></i> IIT Quarterly</h2><p>Interruption in Treatment: Patients lost to follow-up vs TX_CURR — Avg ${iitPctAvg}% IIT rate</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card" style="border-left:4px solid #dc2626"><div class="chak-kpi-label">Avg IIT Rate</div><div class="chak-kpi-value red">${iitPctAvg}%</div><div class="chak-kpi-sub">Average over period</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total IIT (Lost)</div><div class="chak-kpi-value orange">${chakFmt(totIit)}</div><div class="chak-kpi-sub">Cumulative lost to follow-up</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Latest TX_CURR</div><div class="chak-kpi-value blue">${chakFmt(latestTxCurr)}</div><div class="chak-kpi-sub">Currently on ART</div></div>
      <div class="chak-kpi-card" style="border-left:4px solid #dc2626"><div class="chak-kpi-label">Latest IIT</div><div class="chak-kpi-value red">${chakFmt(latestIit)}</div><div class="chak-kpi-sub">${latestIitPct}% of TX_CURR</div></div>
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 IIT Count + % (Combo)", "chakIitCombo")}
      ${chakChartCard("📊 IIT % Rate by Period", "chakIitBar")}
      ${chakChartCard("📊 IIT vs TX_CURR (Dual Axis)", "chakIitDual")}
      ${chakChartCard("📈 IIT Trend", "chakIitTrend", "full")}
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 TX_CURR vs IIT (100% Stacked)", "chakIit100Stacked")}
      ${chakChartCard("🍩 Latest ART Status", "chakIitDonut")}
    </div>
    ${chakRenderTable(trend, ["label", "tx_curr", "tx_ml", "iit_pct"], ["Month", "TX_CURR", "IIT", "% IIT"])}
    `;
  el.setAttribute("data-chak-slug", "iit-quarterly");
  _chakSetData("iit-quarterly", data);

  // Chart 1: Combo — IIT count bar + % line
  chakCreateChart(
    "chakIitCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "tx_ml", label: "TX_ML (IIT)", color: CHAK_COLORS.red + "80" }],
      [{ key: "iit_pct", label: "% IIT", color: CHAK_COLORS.orange }],
    ),
  );

  // Chart 2: IIT % bar
  chakCreateChart(
    "chakIitBar",
    chakBarChart(trend, [
      { key: "iit_pct", label: "% IIT", color: CHAK_COLORS.red },
    ]),
  );

  // Chart 3: Dual axis — TX_CURR bars + IIT count line
  chakCreateChart("chakIitDual", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "TX_CURR",
          data: trend.map(function (d) {
            return d.tx_curr || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "60",
          borderRadius: 3,
          order: 2,
        },
        {
          label: "IIT Count",
          data: trend.map(function (d) {
            return d.tx_ml || 0;
          }),
          type: "line",
          borderColor: CHAK_COLORS.red,
          backgroundColor: CHAK_COLORS.red + "20",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: CHAK_COLORS.red,
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
          title: { display: true, text: "TX_CURR" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          grid: { display: false },
          title: { display: true, text: "IIT Count" },
        },
      },
    },
  });

  // Chart 4: Line trend
  chakCreateChart(
    "chakIitTrend",
    chakLineChart(trend, [
      { key: "tx_ml", label: "TX_ML (IIT)", color: CHAK_COLORS.red },
      {
        key: "iit_pct",
        label: "% IIT",
        color: CHAK_COLORS.orange,
        yAxisID: "y1",
      },
    ]),
  );
  // ── PBIX-style: 100% Stacked — TX_CURR vs IIT ──
  chakCreateChart(
    "chakIit100Stacked",
    chak100PctStackedColumnChart(trend, [
      { key: "tx_ml", label: "IIT (Lost)", color: CHAK_COLORS.red + "cc" },
      {
        key: "tx_curr",
        label: "TX_CURR (Active)",
        color: CHAK_COLORS.blue + "cc",
      },
    ]),
  );
  // ── PBIX-style: Donut — Latest ART status (Active vs IIT) ──
  var iitLatest = trend[trend.length - 1] || {};
  var iitDonutData = [
    { label: "TX_CURR (Active)", value: iitLatest.tx_curr || 0 },
    { label: "IIT (Lost)", value: iitLatest.tx_ml || 0 },
  ];
  if (
    iitDonutData.some(function (d) {
      return d.value > 0;
    })
  ) {
    chakCreateChart(
      "chakIitDonut",
      chakDonutChart(iitDonutData, [{ key: "value", label: "Count" }]),
    );
  }
});

// ── HTS Summary ──
