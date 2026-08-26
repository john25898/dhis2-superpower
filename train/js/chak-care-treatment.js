// ============================================================
// chak-care-treatment.js  (extracted from main.js lines 15035-15202)
// per-page CHAK renderer 15035-15202
// ============================================================
registerChakRenderer("care-treatment", "care-treatment", function (el, data) {
  const trend = data.trend || [];
  const latest = trend[trend.length - 1] || {};
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-heart-pulse"></i> Care & Treatment</h2><p>ART treatment cascade: TX_CURR, TX_NEW, TX_ML (IIT), TX_RTT</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Latest TX_CURR</div><div class="chak-kpi-value blue">${chakFmt(chakLast(trend, "tx_curr"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Latest TX_NEW</div><div class="chak-kpi-value green">${chakFmt(chakLast(trend, "tx_new"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">IIT (Latest)</div><div class="chak-kpi-value red">${chakFmt(chakLast(trend, "tx_ml"))}</div><div class="chak-kpi-sub">${chakLast(trend, "iit_pct")}% of TX_CURR</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Return to Care</div><div class="chak-kpi-value purple">${chakFmt(chakLast(trend, "tx_rtt"))}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("TX_CURR + IIT% (Combo)", "chakCtCombo")}
            ${chakChartCard("TX_NEW vs TX_RTT", "chakCtNewRtt")}
            ${chakChartCard("Treatment Cascade", "chakCtCascade")}
            ${chakChartCard("IIT Rate (%)", "chakCtIit")}
            ${chakChartCard("Care & Treatment Trend", "chakCtTrend", "full")}
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 Donut: Latest ART Status", "chakCtDonut")}
      ${chakChartCard("📊 Stacked Combo: TX_CURR + TX_NEW", "chakCtStackedCombo")}
      ${chakChartCard("📊 TX_NEW vs IIT (100% Stacked)", "chakCt100NewIit")}
      ${chakChartCard("📊 RTT + IIT Detail", "chakCtRttIit", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tx_curr", "tx_new", "tx_ml", "iit_pct", "tx_rtt"], ["Month", "TX_CURR", "TX_NEW", "IIT", "% IIT", "TX_RTT"])}
    `;
  el.setAttribute("data-chak-slug", "care-treatment");
  _chakSetData("care-treatment", data);
  // Combo: TX_CURR bars + IIT% line (using combo builder)
  chakCreateChart(
    "chakCtCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "tx_curr", label: "TX_CURR", color: CHAK_COLORS.blue + "80" }],
      [{ key: "iit_pct", label: "% IIT", color: CHAK_COLORS.red }],
    ),
  );
  chakCreateChart(
    "chakCtNewRtt",
    chakBarChart(trend, [
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.green },
      { key: "tx_rtt", label: "TX_RTT", color: CHAK_COLORS.purple },
    ]),
  );
  // Funnel: Treatment Cascade (from PBIX)
  var cascadeLatest = [
    { label: "TX_CURR", value: chakLast(trend, "tx_curr") },
    { label: "TX_NEW", value: chakLast(trend, "tx_new") },
    { label: "IIT", value: chakLast(trend, "tx_ml") },
    { label: "RTT", value: chakLast(trend, "tx_rtt") },
  ];
  if (
    cascadeLatest.some(function (d) {
      return d.value > 0;
    })
  ) {
    chakCreateChart(
      "chakCtCascade",
      chakFunnelChart(cascadeLatest, [{ key: "value", label: "Count" }]),
    );
  } else {
    chakCreateChart(
      "chakCtCascade",
      chakLineChart(trend, [
        { key: "tx_curr", label: "TX_CURR", color: CHAK_COLORS.blue },
        { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.green },
        { key: "tx_rtt", label: "TX_RTT", color: CHAK_COLORS.purple },
      ]),
    );
  }
  chakCreateChart(
    "chakCtIit",
    chakBarChart(trend, [
      { key: "iit_pct", label: "% IIT", color: CHAK_COLORS.red },
    ]),
  );
  chakCreateChart(
    "chakCtTrend",
    chakLineChart(trend, [
      { key: "tx_ml", label: "TX_ML (IIT)", color: CHAK_COLORS.red },
      { key: "tx_rtt", label: "TX_RTT", color: CHAK_COLORS.purple },
    ]),
  );
  // ── PBIX-style: Donut chart — Latest ART Status ──
  var ctDonutData = [
    { label: "TX_CURR", value: latest.tx_curr || 0 },
    { label: "TX_NEW", value: latest.tx_new || 0 },
    { label: "IIT (ML)", value: latest.tx_ml || 0 },
    { label: "TX_RTT", value: latest.tx_rtt || 0 },
  ];
  if (
    ctDonutData.some(function (d) {
      return d.value > 0;
    })
  ) {
    chakCreateChart(
      "chakCtDonut",
      chakDonutChart(ctDonutData, [{ key: "value", label: "Count" }]),
    );
  }
  // ── PBIX-style: Stacked Combo — TX_CURR stacked bars + TX_NEW line ──
  chakCreateChart(
    "chakCtStackedCombo",
    chakLineStackedColumnComboChart(
      trend,
      [
        { key: "tx_curr", label: "TX_CURR", color: CHAK_COLORS.blue + "80" },
        { key: "tx_ml", label: "IIT", color: CHAK_COLORS.red + "60" },
      ],
      [{ key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.green }],
    ),
  );
  // ── PBIX-style: 100% Stacked — TX_NEW vs IIT proportion ──
  chakCreateChart(
    "chakCt100NewIit",
    chak100PctStackedColumnChart(trend, [
      {
        key: "tx_new",
        label: "TX_NEW (New on ART)",
        color: CHAK_COLORS.green + "cc",
      },
      { key: "tx_ml", label: "IIT (Lost)", color: CHAK_COLORS.red + "cc" },
    ]),
  );
  // ── PBIX-style: TX_RTT vs IIT clustered detail ──
  chakCreateChart("chakCtRttIit", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "TX_ML (IIT)",
          data: trend.map(function (d) {
            return d.tx_ml || 0;
          }),
          backgroundColor: CHAK_COLORS.red + "60",
          borderRadius: 3,
        },
        {
          label: "TX_RTT (RTT)",
          data: trend.map(function (d) {
            return d.tx_rtt || 0;
          }),
          backgroundColor: CHAK_COLORS.purple + "60",
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

// ── CD4/TPT ──
