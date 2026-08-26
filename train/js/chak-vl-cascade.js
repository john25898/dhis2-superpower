// ============================================================
// chak-vl-cascade.js  (extracted from main.js lines 15338-15525)
// per-page CHAK renderer 15338-15525
// ============================================================
registerChakRenderer("vl-cascade", "vl-cascade", function (el, data) {
  const trend = data.trend || [];
  const latest = trend[trend.length - 1] || {};
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-chart-line"></i> Viral Load Cascade</h2><p>VL monitoring: eligible, tested (D), suppressed (N), uptake & suppression rates</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">% VL Uptake</div><div class="chak-kpi-value green">${chakLast(trend, "vl_uptake_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">% VL Suppression</div><div class="chak-kpi-value teal">${chakLast(trend, "vl_suppression_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_CURR</div><div class="chak-kpi-value blue">${chakFmt(chakLast(trend, "tx_curr"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">VL Eligible</div><div class="chak-kpi-value purple">${chakFmt(chakLast(trend, "pvls_eligible"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">VL Done</div><div class="chak-kpi-value orange">${chakFmt(chakLast(trend, "pvls_done"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">VL Suppressed</div><div class="chak-kpi-value green">${chakFmt(chakLast(trend, "pvls_suppressed"))}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("VL Cascade (Bar)", "chakVlBar")}
            ${chakChartCard("Uptake vs Suppression", "chakVlPct")}
            ${chakChartCard("VL Counts (Area)", "chakVlArea")}
            ${chakChartCard("VL Cascade Donut", "chakVlDonut")}
            ${chakChartCard("VL Monthly Trend", "chakVlTrend", "full")}
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 VL Done vs Suppressed (100%)", "chakVl100Stacked")}
      ${chakChartCard("📊 Eligible + % Suppression (Combo)", "chakVlEligCombo")}
    </div>
    ${chakRenderTable(trend, ["label", "pvls_eligible", "pvls_done", "pvls_suppressed", "vl_uptake_pct", "vl_suppression_pct"], ["Month", "Eligible", "Done", "Suppressed", "% Uptake", "% Suppressed"])}
    `;
  el.setAttribute("data-chak-slug", "vl-cascade");
  _chakSetData("vl-cascade", data);
  // Latest cascade bar
  chakCreateChart("chakVlBar", {
    type: "bar",
    data: {
      labels: ["Eligible", "Done", "Suppressed"],
      datasets: [
        {
          data: [
            latest.pvls_eligible || 0,
            latest.pvls_done || 0,
            latest.pvls_suppressed || 0,
          ],
          backgroundColor: [
            CHAK_COLORS.purple,
            CHAK_COLORS.orange,
            CHAK_COLORS.green,
          ],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
  // Uptake vs suppression line
  chakCreateChart(
    "chakVlPct",
    chakLineChart(trend, [
      { key: "vl_uptake_pct", label: "% VL Uptake", color: CHAK_COLORS.green },
      {
        key: "vl_suppression_pct",
        label: "% VL Suppression",
        color: CHAK_COLORS.teal,
      },
    ]),
  );
  // Area chart for counts
  chakCreateChart("chakVlArea", {
    type: "line",
    data: {
      labels: trend.map((r) => r.label),
      datasets: [
        {
          label: "Eligible",
          data: trend.map((r) => r.pvls_eligible || 0),
          borderColor: CHAK_COLORS.purple,
          backgroundColor: CHAK_COLORS.purple + "40",
          fill: true,
          tension: 0.3,
        },
        {
          label: "Done",
          data: trend.map((r) => r.pvls_done || 0),
          borderColor: CHAK_COLORS.orange,
          backgroundColor: CHAK_COLORS.orange + "40",
          fill: true,
          tension: 0.3,
        },
        {
          label: "Suppressed",
          data: trend.map((r) => r.pvls_suppressed || 0),
          borderColor: CHAK_COLORS.green,
          backgroundColor: CHAK_COLORS.green + "40",
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
      scales: { y: { beginAtZero: true } },
    },
  });
  // Latest donut (using builder)
  var vlDonutData = [
    {
      label: "Not Done",
      value: Math.max(0, (latest.pvls_eligible || 0) - (latest.pvls_done || 0)),
    },
    { label: "Suppressed", value: latest.pvls_suppressed || 0 },
    {
      label: "Not Suppressed",
      value: Math.max(
        0,
        (latest.pvls_done || 0) - (latest.pvls_suppressed || 0),
      ),
    },
  ];
  chakCreateChart(
    "chakVlDonut",
    chakDonutChart(vlDonutData, [{ key: "value", label: "VL" }]),
  );
  // Trend with combo: VL Done/Suppressed bars + % line
  chakCreateChart(
    "chakVlTrend",
    chakLineClusteredColumnComboChart(
      trend,
      [
        {
          key: "pvls_eligible",
          label: "Eligible",
          color: CHAK_COLORS.purple + "80",
        },
        { key: "pvls_done", label: "Done", color: CHAK_COLORS.orange + "80" },
        {
          key: "pvls_suppressed",
          label: "Suppressed",
          color: CHAK_COLORS.green + "80",
        },
      ],
      [
        {
          key: "vl_suppression_pct",
          label: "% Suppression",
          color: CHAK_COLORS.teal,
        },
      ],
    ),
  );
  // ── PBIX-style: 100% Stacked — VL cascade proportions ──
  chakCreateChart(
    "chakVl100Stacked",
    chak100PctStackedColumnChart(trend, [
      { key: "pvls_done", label: "Done", color: CHAK_COLORS.orange + "cc" },
      {
        key: "pvls_suppressed",
        label: "Suppressed",
        color: CHAK_COLORS.green + "cc",
      },
    ]),
  );
  // ── PBIX-style: Eligible bars + Suppression% line (combo) ──
  chakCreateChart(
    "chakVlEligCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [
        {
          key: "pvls_eligible",
          label: "Eligible",
          color: CHAK_COLORS.purple + "80",
        },
      ],
      [
        {
          key: "vl_suppression_pct",
          label: "% Suppression",
          color: CHAK_COLORS.teal,
        },
      ],
    ),
  );
});

// ── PMTCT ──
