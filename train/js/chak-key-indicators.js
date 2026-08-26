// ============================================================
// chak-key-indicators.js  (extracted from main.js lines 13811-13932)
// per-page CHAK renderer 13811-13932
// ============================================================
registerChakRenderer("key-indicators", "key-indicators", function (el, data) {
  const trend = data.trend || [];
  const latest = trend[trend.length - 1] || {};
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-gauge-high"></i> Key Indicators Drill Down</h2><p>Program performance at a glance: VL, CD4, TPT, HTS, Linkage</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">% VL Uptake</div><div class="chak-kpi-value green">${latest.vl_uptake_pct || 0}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">% VL Suppression</div><div class="chak-kpi-value teal">${latest.vl_suppression_pct || 0}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Positivity Rate</div><div class="chak-kpi-value orange">${latest.positivity_pct || 0}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Linkage Rate</div><div class="chak-kpi-value purple">${latest.linkage_pct || 0}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">CD4 &lt;200</div><div class="chak-kpi-value red">${chakFmt(latest.cd4_less200)}</div><div class="chak-kpi-sub">${latest.cd4_uptake_pct || 0}% CD4 Uptake</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TPT Uptake</div><div class="chak-kpi-value blue">${latest.tpt_uptake_pct || 0}%</div><div class="chak-kpi-sub">${chakFmt(latest.tpt)} clients</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_CURR</div><div class="chak-kpi-value blue">${chakFmt(latest.tx_curr)}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_NEW</div><div class="chak-kpi-value green">${chakFmt(latest.tx_new)}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("VL Cascade %", "chakKiVlCascade")}
            ${chakChartCard("HTS Cascade %", "chakKiHtsCascade")}
            ${chakChartCard("TX_CURR + VL% (Combo)", "chakKiCombo")}
            ${chakChartCard("Latest KPI Radar", "chakKiRadar")}
            ${chakChartCard("Key Indicators Monthly Trend", "chakKiTrend", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tx_curr", "tx_new", "vl_uptake_pct", "vl_suppression_pct", "positivity_pct", "linkage_pct", "cd4_uptake_pct", "tpt_uptake_pct"], ["Month", "TX_CURR", "TX_NEW", "% VL Up", "% VL Supp", "% Pos", "% Link", "% CD4", "% TPT"])}
    `;
  el.setAttribute("data-chak-slug", "key-indicators");
  _chakSetData("key-indicators", data);
  chakCreateChart(
    "chakKiVlCascade",
    chakLineChart(trend, [
      { key: "vl_uptake_pct", label: "% VL Uptake", color: CHAK_COLORS.green },
      {
        key: "vl_suppression_pct",
        label: "% VL Suppression",
        color: CHAK_COLORS.teal,
      },
    ]),
  );
  chakCreateChart(
    "chakKiHtsCascade",
    chakLineChart(trend, [
      { key: "positivity_pct", label: "% Positive", color: CHAK_COLORS.orange },
      { key: "linkage_pct", label: "% Linked", color: CHAK_COLORS.purple },
    ]),
  );
  // Combo: TX_CURR bars + VL Uptake line (using new combo builder)
  chakCreateChart(
    "chakKiCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "tx_curr", label: "TX_CURR", color: CHAK_COLORS.blue + "80" }],
      [
        {
          key: "vl_uptake_pct",
          label: "% VL Uptake",
          color: CHAK_COLORS.green,
        },
      ],
    ),
  );

  // CD4 Distribution Donut (latest period)
  var cd4Data = [
    { label: "CD4 <200", value: latest.cd4_less200 || 0 },
    { label: "CD4 >200", value: latest.cd4_more200 || 0 },
    { label: "CD4 Unk", value: latest.cd4_unknown || 0 },
  ];
  var hasCd4Data = cd4Data.some(function (d) {
    return d.value > 0;
  });
  if (hasCd4Data) {
    // Replace radar with donut (radar is less useful)
    chakCreateChart(
      "chakKiRadar",
      chakDonutChart(cd4Data, [{ key: "value", label: "CD4" }]),
    );
  } else {
    // Keep radar as fallback
    chakCreateChart("chakKiRadar", {
      type: "radar",
      data: {
        labels: [
          "VL Uptake",
          "VL Suppression",
          "Linkage",
          "CD4 Uptake",
          "TPT Uptake",
        ],
        datasets: [
          {
            label: "Latest %",
            data: [
              latest.vl_uptake_pct || 0,
              latest.vl_suppression_pct || 0,
              latest.linkage_pct || 0,
              latest.cd4_uptake_pct || 0,
              latest.tpt_uptake_pct || 0,
            ],
            backgroundColor: CHAK_COLORS.blue + "40",
            borderColor: CHAK_COLORS.blue,
            pointBackgroundColor: CHAK_COLORS.blue,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { r: { beginAtZero: true, max: 100 } },
        plugins: { legend: { display: false } },
      },
    });
  }
  chakCreateChart(
    "chakKiTrend",
    chakLineChart(trend, [
      { key: "tx_curr", label: "TX_CURR", color: CHAK_COLORS.blue },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.green },
      { key: "cd4_less200", label: "CD4<200", color: CHAK_COLORS.red },
    ]),
  );
});

// ── PrEP ──
