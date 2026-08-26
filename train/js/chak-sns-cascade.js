// ============================================================
// chak-sns-cascade.js  (extracted from main.js lines 14861-15034)
// per-page CHAK renderer 14861-15034
// ============================================================
registerChakRenderer("sns-cascade", "sns-cascade", function (el, data) {
  const trend = data.trend || [];
  const latest = trend[trend.length - 1] || {};
  var snsPosSum = chakSum(trend, "sns_pos");
  var linkedSum = chakSum(trend, "linked");
  var txNewSum = chakSum(trend, "tx_new");
  var linkagePct =
    snsPosSum > 0 ? ((linkedSum / snsPosSum) * 100).toFixed(1) : 0;
  var txNewPct = linkedSum > 0 ? ((txNewSum / linkedSum) * 100).toFixed(1) : 0;

  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-share-nodes"></i> SNS Cascade</h2><p>Social Network Strategy: contacts elicited, tested, positive, linked — ${chakFmt(snsPosSum)} positive, ${chakFmt(linkedSum)} linked</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">SNS Positive (Total)</div><div class="chak-kpi-value pink">${chakFmt(snsPosSum)}</div><div class="chak-kpi-sub">Total identified through SNS</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Linked</div><div class="chak-kpi-value green">${chakFmt(linkedSum)}</div><div class="chak-kpi-sub">${linkagePct}% linkage rate</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_NEW (Total)</div><div class="chak-kpi-value teal">${chakFmt(txNewSum)}</div><div class="chak-kpi-sub">${txNewPct}% of linked started ART</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Linkage Rate</div><div class="chak-kpi-value green">${linkagePct}%</div><div class="chak-kpi-sub">SNS Positive → Linked</div></div>
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📈 SNS Cascade Trend", "chakSnsTrend")}
      ${chakChartCard("📊 SNS → Linked → TX_NEW", "chakSnsBar")}
      ${chakChartCard("📊 Monthly SNS Breakdown (Clustered)", "chakSnsClustered")}
      ${chakChartCard("📈 SNS Positive + Linkage% (Combo)", "chakSnsCombo")}
      ${chakChartCard("📋 SNS Cascade Detail", "chakSnsDetail", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "sns_pos", "linked", "tx_new"], ["Month", "SNS Positive", "Linked", "TX_NEW"])}
    `;
  el.setAttribute("data-chak-slug", "sns-cascade");
  _chakSetData("sns-cascade", data);

  // Chart 1: Line trend
  chakCreateChart(
    "chakSnsTrend",
    chakLineChart(trend, [
      { key: "sns_pos", label: "SNS Positive", color: CHAK_COLORS.pink },
      { key: "linked", label: "Linked", color: CHAK_COLORS.green },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
    ]),
  );

  // Chart 2: Bar chart
  chakCreateChart(
    "chakSnsBar",
    chakBarChart(trend, [
      { key: "sns_pos", label: "SNS Positive", color: CHAK_COLORS.pink },
      { key: "linked", label: "Linked", color: CHAK_COLORS.green },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
    ]),
  );

  // Chart 3: Clustered column — monthly breakdown
  chakCreateChart("chakSnsClustered", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "SNS Positive",
          data: trend.map(function (d) {
            return d.sns_pos || 0;
          }),
          backgroundColor: CHAK_COLORS.pink + "80",
          borderRadius: 3,
        },
        {
          label: "Linked",
          data: trend.map(function (d) {
            return d.linked || 0;
          }),
          backgroundColor: CHAK_COLORS.green + "80",
          borderRadius: 3,
        },
        {
          label: "TX_NEW",
          data: trend.map(function (d) {
            return d.tx_new || 0;
          }),
          backgroundColor: CHAK_COLORS.teal + "80",
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

  // Chart 4: Combo — SNS Positive bars + linkage % line
  chakCreateChart("chakSnsCombo", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "SNS Positive",
          data: trend.map(function (d) {
            return d.sns_pos || 0;
          }),
          backgroundColor: CHAK_COLORS.pink + "80",
          borderRadius: 3,
          order: 2,
        },
        {
          label: "Linkage %",
          data: trend.map(function (d) {
            var sp = d.sns_pos || 0;
            return sp > 0 ? (((d.linked || 0) / sp) * 100).toFixed(1) : 0;
          }),
          type: "line",
          borderColor: CHAK_COLORS.green,
          backgroundColor: CHAK_COLORS.green + "20",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: CHAK_COLORS.green,
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
          title: { display: true, text: "Positive" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          max: 100,
          grid: { display: false },
          title: { display: true, text: "Linkage %" },
        },
      },
    },
  });

  // Chart 5: Detail line
  chakCreateChart(
    "chakSnsDetail",
    chakLineChart(trend, [
      { key: "sns_pos", label: "SNS Positive", color: CHAK_COLORS.pink },
      { key: "linked", label: "Linked", color: CHAK_COLORS.green },
    ]),
  );
});

// ── Care & Treatment ──
