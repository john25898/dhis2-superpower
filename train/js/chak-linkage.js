// ============================================================
// chak-linkage.js  (extracted from main.js lines 17510-17582)
// per-page CHAK renderer 17510-17582
// ============================================================
registerChakRenderer("linkage", "linkage", function (el, data) {
  const trend = data.trend || [];
  const cascade = data.cascade || {};
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-link"></i> Linkage</h2><p>HTS linkage cascade: tested → positive → linked → on treatment</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Tested</div><div class="chak-kpi-value blue">${chakFmt(chakSum(trend, "tested"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Positive</div><div class="chak-kpi-value pink">${chakFmt(chakSum(trend, "positive"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg Linkage Rate</div><div class="chak-kpi-value green">${chakAvg(trend, "linkage_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total TX_NEW</div><div class="chak-kpi-value teal">${chakFmt(chakSum(trend, "tx_new"))}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("Linkage Cascade (Funnel)", "chakLinkCascade")}
            ${chakChartCard("Linked Within/Outside", "chakLinkBreakdown")}
            ${chakChartCard("Linkage Rate Over Time", "chakLinkTrend", "full")}
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("Tested → TX_NEW (Combo)", "chakLinkCombo", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tested", "positive", "total_linked", "linkage_pct", "tx_new"], ["Month", "Tested", "Positive", "Linked", "Linkage %", "TX_NEW"])}
    `;
  el.setAttribute("data-chak-slug", "linkage");
  _chakSetData("linkage", data);

  // Cascade funnel chart (horizontal bar acting as funnel)
  if (cascade.categories && cascade.categories.length) {
    var cascadeData = cascade.categories.map(function (c, i) {
      return { label: c, value: (cascade.values || [])[i] || 0 };
    });
    chakCreateChart(
      "chakLinkCascade",
      chakFunnelChart(cascadeData, [{ key: "value", label: "Count" }]),
    );
  }

  // Linked within vs outside (100% stacked)
  chakCreateChart(
    "chakLinkBreakdown",
    chak100PctStackedBarChart(trend, [
      { key: "linked_within", label: "Linked Within", color: "#16a34a" },
      { key: "linked_outside", label: "Linked Outside", color: "#ea580c" },
      { key: "tx_new", label: "TX_NEW", color: "#2563eb" },
    ]),
  );

  // Linkage rate over time
  chakCreateChart(
    "chakLinkTrend",
    chakLineChart(trend, [
      { key: "linkage_pct", label: "Linkage %", color: CHAK_COLORS.green },
      {
        key: "tx_new_pct",
        label: "TX_NEW %",
        color: CHAK_COLORS.teal,
        yAxisID: "y1",
      },
    ]),
  );

  // Combo: tested bar + linkage % line
  chakCreateChart(
    "chakLinkCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "tested", label: "Tested", color: CHAK_COLORS.blue + "80" }],
      [{ key: "linkage_pct", label: "Linkage %", color: CHAK_COLORS.green }],
    ),
  );
});

// ═══════════════════════════════════════════════════════════════════
// ── renderChakPage — Fetch data + call renderer ─────────────────
// ═══════════════════════════════════════════════════════════════════
