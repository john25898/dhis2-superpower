// ============================================================
// chak-prep.js  (extracted from main.js lines 13933-14220)
// per-page CHAK renderer 13933-14220
// ============================================================
registerChakRenderer("prep_page", "prep", function (el, data) {
  const trend = data.trend || [];
  var typologyLatest = trend[trend.length - 1] || {};
  var pbfwTotal = chakSum(trend, "prep_new_pbfw");
  var pregTotal = chakSum(trend, "prep_new_preg");
  var newTotal = chakSum(trend, "prep_new");

  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-shield"></i> PrEP Cascade</h2><p>PrEP screening, new initiations, current users, and typology breakdown</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">PrEP New (Cumulative)</div><div class="chak-kpi-value green">${chakFmt(newTotal)}</div><div class="chak-kpi-sub">Total new initiations</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">PrEP Current (Latest)</div><div class="chak-kpi-value blue">${chakFmt(chakLast(trend, "prep_curr"))}</div><div class="chak-kpi-sub">Active users (latest month)</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">PrEP Screened</div><div class="chak-kpi-value purple">${chakFmt(chakSum(trend, "prep_screened"))}</div><div class="chak-kpi-sub">Total screened for PrEP</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg % Uptake</div><div class="chak-kpi-value orange">${chakAvg(trend, "prep_uptake_pct")}%</div><div class="chak-kpi-sub">Screened → Initiated</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">PBFW New (Cumulative)</div><div class="chak-kpi-value" style="color:#db2777">${chakFmt(pbfwTotal)}</div><div class="chak-kpi-sub">${newTotal > 0 ? ((pbfwTotal / newTotal) * 100).toFixed(1) : 0}% of new</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Pregnant New (Cumulative)</div><div class="chak-kpi-value" style="color:#0d9488">${chakFmt(pregTotal)}</div><div class="chak-kpi-sub">${newTotal > 0 ? ((pregTotal / newTotal) * 100).toFixed(1) : 0}% of new</div></div>
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 PrEP Trend — New + Current (Combo)", "chakPrepTrend")}
      ${chakChartCard("🍩 PrEP New by Typology (Latest)", "chakPrepTypology")}
      ${chakChartCard("📊 PrEP Cascade — Screened · New · Current", "chakPrepCascade")}
      ${chakChartCard("📊 Typology Trend — PBFW vs Pregnant", "chakPrepTypologyTrend")}
      ${chakChartCard("📊 Typology % Over Time (100% Stacked)", "chakPrepStacked")}
      ${chakChartCard("📈 Screened + % Uptake (Combo)", "chakPrepScreenedCombo")}
      ${chakChartCard("📋 Detailed Monthly Data", "chakPrepDetail", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "prep_new", "prep_curr", "prep_screened", "prep_new_pbfw", "prep_new_preg", "prep_uptake_pct"], ["Month", "New", "Current", "Screened", "PBFW", "Pregnant", "% Uptake"])}`;
  el.setAttribute("data-chak-slug", "prep_page");
  _chakSetData("prep_page", data);

  // Chart 1: Combo — New bars + Current bars + % Uptake line
  chakCreateChart(
    "chakPrepTrend",
    chakLineClusteredColumnComboChart(
      trend,
      [
        { key: "prep_new", label: "PrEP New", color: CHAK_COLORS.green + "80" },
        {
          key: "prep_curr",
          label: "PrEP Current",
          color: CHAK_COLORS.blue + "80",
        },
      ],
      [
        {
          key: "prep_uptake_pct",
          label: "% Uptake",
          color: CHAK_COLORS.orange,
        },
      ],
    ),
  );

  // Chart 2: Typology donut (latest period)
  var typologyData = [
    { label: "PBFW", value: typologyLatest.prep_new_pbfw || 0 },
    { label: "Pregnant", value: typologyLatest.prep_new_preg || 0 },
  ];
  chakCreateChart(
    "chakPrepTypology",
    chakDonutChart(typologyData, [{ key: "value", label: "Type" }]),
  );

  // Chart 3: Cascade — Screened vs New vs Current (clustered)
  chakCreateChart("chakPrepCascade", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Screened",
          data: trend.map(function (d) {
            return d.prep_screened || 0;
          }),
          backgroundColor: CHAK_COLORS.purple + "80",
          borderRadius: 3,
        },
        {
          label: "PrEP New",
          data: trend.map(function (d) {
            return d.prep_new || 0;
          }),
          backgroundColor: CHAK_COLORS.green + "80",
          borderRadius: 3,
        },
        {
          label: "PrEP Current",
          data: trend.map(function (d) {
            return d.prep_curr || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "80",
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

  // Chart 4: Typology trend — PBFW vs Pregnant (clustered)
  chakCreateChart("chakPrepTypologyTrend", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "PBFW",
          data: trend.map(function (d) {
            return d.prep_new_pbfw || 0;
          }),
          backgroundColor: CHAK_COLORS.pink + "80",
          borderRadius: 3,
        },
        {
          label: "Pregnant",
          data: trend.map(function (d) {
            return d.prep_new_preg || 0;
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

  // Chart 5: 100% stacked bar — PBFW vs Pregnant proportions over time
  chakCreateChart("chakPrepStacked", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "PBFW",
          data: trend.map(function (d) {
            var t = (d.prep_new_pbfw || 0) + (d.prep_new_preg || 0);
            return t > 0 ? (((d.prep_new_pbfw || 0) / t) * 100).toFixed(1) : 0;
          }),
          backgroundColor: CHAK_COLORS.pink + "cc",
        },
        {
          label: "Pregnant",
          data: trend.map(function (d) {
            var t = (d.prep_new_pbfw || 0) + (d.prep_new_preg || 0);
            return t > 0 ? (((d.prep_new_preg || 0) / t) * 100).toFixed(1) : 0;
          }),
          backgroundColor: CHAK_COLORS.teal + "cc",
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
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return ctx.dataset.label + ": " + ctx.parsed.y.toFixed(1) + "%";
            },
          },
        },
      },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          max: 100,
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "% of New Initiations" },
        },
      },
    },
  });

  // Chart 6: Combo — Screened bars + % Uptake line
  chakCreateChart("chakPrepScreenedCombo", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Screened",
          data: trend.map(function (d) {
            return d.prep_screened || 0;
          }),
          backgroundColor: CHAK_COLORS.purple + "80",
          borderRadius: 3,
          order: 2,
        },
        {
          label: "% Uptake",
          data: trend.map(function (d) {
            return d.prep_uptake_pct || 0;
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
          title: { display: true, text: "Screened" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          max: 100,
          grid: { display: false },
          title: { display: true, text: "% Uptake" },
        },
      },
    },
  });

  // Chart 7: Multi-line detail
  chakCreateChart(
    "chakPrepDetail",
    chakLineChart(trend, [
      { key: "prep_screened", label: "Screened", color: CHAK_COLORS.orange },
      { key: "prep_new", label: "New", color: CHAK_COLORS.green },
      {
        key: "prep_uptake_pct",
        label: "% Uptake",
        color: CHAK_COLORS.teal,
        yAxisID: "y1",
      },
    ]),
  );
});

// ── HTS Performance ──
