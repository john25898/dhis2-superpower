// ============================================================
// chak-cd4-tpt.js  (extracted from main.js lines 15203-15337)
// per-page CHAK renderer 15203-15337
// ============================================================
registerChakRenderer("cd4-tpt-uptake", "cd4-tpt", function (el, data) {
  const trend = data.trend || [];
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-flask"></i> CD4 & TPT Uptake</h2><p>CD4 testing at ART initiation and TPT coverage</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">% CD4<200 at start</div><div class="chak-kpi-value red">${chakAvg(trend, "pct_cd4_less200")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">CD4 Uptake</div><div class="chak-kpi-value blue">${chakAvg(trend, "cd4_uptake_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TPT Uptake</div><div class="chak-kpi-value green">${chakAvg(trend, "tpt_uptake_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">RTT with CD4<200</div><div class="chak-kpi-value orange">${chakFmt(chakLast(trend, "rtt_cd4_less200"))}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("CD4 Distribution (Latest)", "chakCd4Pie")}
            ${chakChartCard("CD4 & TPT Uptake %", "chakCd4Uptake")}
            ${chakChartCard("CD4 Counts (Bar)", "chakCd4Counts")}
            ${chakChartCard("RTT CD4<200", "chakRttBar")}
            ${chakChartCard("CD4 Trend", "chakCd4Trend", "full")}
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 CD4 + TPT (Combo)", "chakCd4ExtraCombo")}
      ${chakChartCard("📊 CD4 100% Stacked", "chakCd4Stacked")}
    </div>
    ${chakRenderTable(trend, ["label", "cd4_less200", "cd4_more200", "cd4_unknown", "cd4_uptake_pct", "tpt", "tpt_uptake_pct", "rtt_cd4_less200"], ["Month", "CD4<200", "CD4>=200", "Unknown", "CD4 Uptake", "TPT", "TPT Uptake", "RTT<200"])}
    `;
  el.setAttribute("data-chak-slug", "cd4-tpt-uptake");
  _chakSetData("cd4-tpt-uptake", data);
  const latest = trend[trend.length - 1] || {};
  // CD4 Latest distribution (using donut builder)
  var cd4PieData = [
    { label: "CD4 <200", value: latest.cd4_less200 || 0 },
    { label: "CD4 >=200", value: latest.cd4_more200 || 0 },
    { label: "CD4 Unknown", value: latest.cd4_unknown || 0 },
  ];
  chakCreateChart(
    "chakCd4Pie",
    chakDonutChart(cd4PieData, [{ key: "value", label: "CD4" }]),
  );
  chakCreateChart(
    "chakCd4Uptake",
    chakLineChart(trend, [
      { key: "cd4_uptake_pct", label: "CD4 Uptake %", color: CHAK_COLORS.blue },
      {
        key: "tpt_uptake_pct",
        label: "TPT Uptake %",
        color: CHAK_COLORS.green,
      },
    ]),
  );
  // CD4 distribution 100% stacked (latest period showed proportion)
  var cd4Distro = [
    { label: "CD4 <200", value: chakLast(trend, "cd4_less200") },
    { label: "CD4 >=200", value: chakLast(trend, "cd4_more200") },
    { label: "Unknown", value: chakLast(trend, "cd4_unknown") },
  ];
  if (
    cd4Distro.some(function (d) {
      return d.value > 0;
    })
  ) {
    chakCreateChart(
      "chakCd4Counts",
      chakDonutChart(cd4Distro, [{ key: "value", label: "CD4" }]),
    );
  } else {
    chakCreateChart(
      "chakCd4Counts",
      chakBarChart(trend, [
        { key: "cd4_less200", label: "CD4<200", color: CHAK_COLORS.red },
        { key: "cd4_more200", label: "CD4>=200", color: CHAK_COLORS.green },
        { key: "cd4_unknown", label: "Unknown", color: CHAK_COLORS.orange },
      ]),
    );
  }
  chakCreateChart(
    "chakRttBar",
    chakBarChart(trend, [
      {
        key: "rtt_cd4_less200",
        label: "RTT CD4<200",
        color: CHAK_COLORS.orange,
      },
    ]),
  );
  chakCreateChart(
    "chakCd4Trend",
    chakLineChart(trend, [
      { key: "cd4_less200", label: "CD4<200", color: CHAK_COLORS.red },
      {
        key: "rtt_cd4_less200",
        label: "RTT CD4<200",
        color: CHAK_COLORS.orange,
      },
    ]),
  );
  // ── PBIX-style: CD4 combo — bars + TPT uptake line ──
  chakCreateChart(
    "chakCd4ExtraCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [
        { key: "cd4_less200", label: "CD4<200", color: CHAK_COLORS.red + "80" },
        {
          key: "cd4_more200",
          label: "CD4>=200",
          color: CHAK_COLORS.green + "80",
        },
      ],
      [
        {
          key: "tpt_uptake_pct",
          label: "TPT Uptake %",
          color: CHAK_COLORS.blue,
        },
      ],
    ),
  );
  // ── PBIX-style: 100% Stacked — CD4 categories per period ──
  chakCreateChart(
    "chakCd4Stacked",
    chak100PctStackedColumnChart(trend, [
      { key: "cd4_less200", label: "CD4<200", color: CHAK_COLORS.red + "cc" },
      {
        key: "cd4_more200",
        label: "CD4>=200",
        color: CHAK_COLORS.green + "cc",
      },
      {
        key: "cd4_unknown",
        label: "Unknown",
        color: CHAK_COLORS.orange + "60",
      },
    ]),
  );
});

// ── VL Cascade ──
