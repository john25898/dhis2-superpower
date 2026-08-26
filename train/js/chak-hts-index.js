// ============================================================
// chak-hts-index.js  (extracted from main.js lines 14668-14860)
// per-page CHAK renderer 14668-14860
// ============================================================
registerChakRenderer("hts-index-testing", "hts-index", function (el, data) {
  const trend = data.trend || [];
  var testedSum = chakSum(trend, "tested");
  var posSum = chakSum(trend, "positive");
  var linkedSum = chakSum(trend, "linked");
  var yieldPct = testedSum > 0 ? ((posSum / testedSum) * 100).toFixed(1) : 0;
  var linkageRate = posSum > 0 ? ((linkedSum / posSum) * 100).toFixed(1) : 0;
  var linkageGap = posSum > 0 ? posSum - linkedSum : 0;

  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-users"></i> HTS Index Testing</h2><p>Index testing cascade: ${chakFmt(testedSum)} tested → ${chakFmt(posSum)} positive (${yieldPct}%) → ${chakFmt(linkedSum)} linked (${linkageRate}%)</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Tested</div><div class="chak-kpi-value blue">${chakFmt(testedSum)}</div><div class="chak-kpi-sub">Index clients tested</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Positive</div><div class="chak-kpi-value pink">${chakFmt(posSum)}</div><div class="chak-kpi-sub">${yieldPct}% yield</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Linked</div><div class="chak-kpi-value green">${chakFmt(linkedSum)}</div><div class="chak-kpi-sub">${linkageRate}% linkage rate</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Linkage Gap</div><div class="chak-kpi-value" style="color:#dc2626">${chakFmt(linkageGap)}</div><div class="chak-kpi-sub">Positive not yet linked</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg Yield</div><div class="chak-kpi-value orange">${yieldPct}%</div><div class="chak-kpi-sub">Yield rate (Avg)</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg Linkage</div><div class="chak-kpi-value green">${linkageRate}%</div><div class="chak-kpi-sub">Linkage rate (Avg)</div></div>
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 Tested + % Positive (Combo)", "chakIndexCombo")}
      ${chakChartCard("📊 Positive → Linked Cascade", "chakIndexCascade")}
      ${chakChartCard("📊 Monthly Testing Breakdown", "chakIndexClustered")}
      ${chakChartCard("📈 Trend: % Positive & % Linked", "chakIndexTrend", "full")}
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 Positive + Linkage % (Combo)", "chakIndexPosLinkCombo")}
      ${chakChartCard("📊 Tested vs Positive (100% Stacked)", "chakIndexStackedYield")}
      ${chakChartCard("📊 Tested + Linked (Clustered)", "chakIndexTestLinked")}
      ${chakChartCard("📊 Yield & Linkage Detail", "chakIndexDetail", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tested", "positive", "positivity_pct", "linked", "linkage_pct"], ["Month", "Tested", "Positive", "% Positive", "Linked", "% Linked"])}
    `;
  el.setAttribute("data-chak-slug", "hts-index-testing");
  _chakSetData("hts-index-testing", data);

  // Chart 1: Combo - Tested bars + % positive line
  chakCreateChart(
    "chakIndexCombo",
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
    "chakIndexCascade",
    chakBarChart(trend, [
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
      { key: "linked", label: "Linked", color: CHAK_COLORS.green },
    ]),
  );

  // Chart 3: Clustered monthly breakdown
  chakCreateChart("chakIndexClustered", {
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
        },
        {
          label: "Positive",
          data: trend.map(function (d) {
            return d.positive || 0;
          }),
          backgroundColor: CHAK_COLORS.pink + "60",
          borderRadius: 3,
        },
        {
          label: "Linked",
          data: trend.map(function (d) {
            return d.linked || 0;
          }),
          backgroundColor: CHAK_COLORS.green + "60",
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

  // Chart 4: Dual-line trend
  chakCreateChart(
    "chakIndexTrend",
    chakLineChart(trend, [
      { key: "positivity_pct", label: "% Positive", color: CHAK_COLORS.orange },
      { key: "linkage_pct", label: "% Linked", color: CHAK_COLORS.green },
    ]),
  );

  // ── PBIX-style: Positive bars + Linkage% line (combo) ──
  chakCreateChart(
    "chakIndexPosLinkCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "positive", label: "Positive", color: CHAK_COLORS.pink + "80" }],
      [{ key: "linkage_pct", label: "% Linked", color: CHAK_COLORS.green }],
    ),
  );

  // ── PBIX-style: 100% Stacked — Tested vs Positive (showing yield %) ──
  chakCreateChart(
    "chakIndexStackedYield",
    chak100PctStackedColumnChart(trend, [
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink + "cc" },
      { key: "tested", label: "Not Positive", color: CHAK_COLORS.blue + "40" },
    ]),
  );

  // ── PBIX-style: Tested + Linked clustered columns ──
  chakCreateChart("chakIndexTestLinked", {
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
        },
        {
          label: "Linked",
          data: trend.map(function (d) {
            return d.linked || 0;
          }),
          backgroundColor: CHAK_COLORS.green + "60",
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

  // ── Detail multi-line ──
  chakCreateChart(
    "chakIndexDetail",
    chakLineChart(trend, [
      { key: "tested", label: "Tested", color: CHAK_COLORS.blue },
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
      { key: "linked", label: "Linked", color: CHAK_COLORS.green },
    ]),
  );
});

// ── SNS Cascade ──
