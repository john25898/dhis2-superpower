// ============================================================
// chak-post-rape.js  (extracted from main.js lines 16636-16885)
// per-page CHAK renderer 16636-16885
// ============================================================
registerChakRenderer("post_rape", "post-rape", function (el, data) {
  const trend = data.trend || [];
  const peSum = chakSum(trend, "physical_emotional");
  const svSum = chakSum(trend, "sexual_violence");
  const totSum = chakSum(trend, "total");
  const pePct = totSum > 0 ? ((peSum / totSum) * 100).toFixed(1) : 0;
  const svPct = totSum > 0 ? ((svSum / totSum) * 100).toFixed(1) : 0;

  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-hand"></i> POST RESP (Post-Rape Care)</h2><p>Post-rape care services: physical/emotional, sexual violence — ${chakFmt(totSum)} total cases</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Physical/Emotional</div><div class="chak-kpi-value orange">${chakFmt(peSum)}</div><div class="chak-kpi-sub">${pePct}% of total</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Sexual Violence</div><div class="chak-kpi-value pink">${chakFmt(svSum)}</div><div class="chak-kpi-sub">${svPct}% of total</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Cases</div><div class="chak-kpi-value purple">${chakFmt(totSum)}</div><div class="chak-kpi-sub">Combined total</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">SV % of Total</div><div class="chak-kpi-value" style="color:#db2777">${svPct}%</div><div class="chak-kpi-sub">Sexual violence share</div></div>
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📈 POST RESP Trend — Monthly Cases", "chakPostRapeTrend")}
      ${chakChartCard("📊 Violence Type Breakdown — PE vs SV", "chakPostRapeBreakdown")}
      ${chakChartCard("📈 Cases with % SV Share (Combo)", "chakPostRapeCombo")}
      ${chakChartCard("📊 Monthly Cases by Type (Stacked Column)", "chakPostRapeStacked")}
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 PE vs SV (100% Stacked)", "chakPostRape100Stacked")}
      ${chakChartCard("🍩 Latest Violence Distribution", "chakPostRapeDonut")}
      ${chakChartCard("📊 Physical/Emotional + SV% (Combo)", "chakPostRapeExtraCombo", "full")}
    </div>`;
  el.setAttribute("data-chak-slug", "post_rape");
  _chakSetData("post_rape", data);

  // Chart 1: Line Trend
  chakCreateChart(
    "chakPostRapeTrend",
    chakLineChart(trend, [
      {
        key: "physical_emotional",
        label: "Physical/Emotional",
        color: CHAK_COLORS.orange,
      },
      {
        key: "sexual_violence",
        label: "Sexual Violence",
        color: CHAK_COLORS.pink,
      },
      { key: "total", label: "Total", color: CHAK_COLORS.purple },
    ]),
  );

  // Chart 2: Clustered column — PE vs SV per period
  chakCreateChart("chakPostRapeBreakdown", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Physical/Emotional",
          data: trend.map(function (d) {
            return d.physical_emotional || 0;
          }),
          backgroundColor: CHAK_COLORS.orange + "cc",
          borderRadius: 3,
        },
        {
          label: "Sexual Violence",
          data: trend.map(function (d) {
            return d.sexual_violence || 0;
          }),
          backgroundColor: CHAK_COLORS.pink + "cc",
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

  // Chart 3: Combo — Total bar + SV % line
  chakCreateChart("chakPostRapeCombo", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Total Cases",
          data: trend.map(function (d) {
            return d.total || 0;
          }),
          backgroundColor: CHAK_COLORS.purple + "80",
          borderRadius: 3,
          order: 2,
        },
        {
          label: "SV % Share",
          data: trend.map(function (d) {
            var t = d.total || 0;
            return t > 0
              ? (((d.sexual_violence || 0) / t) * 100).toFixed(1)
              : 0;
          }),
          type: "line",
          borderColor: CHAK_COLORS.pink,
          backgroundColor: CHAK_COLORS.pink + "20",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: CHAK_COLORS.pink,
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
          title: { display: true, text: "Cases" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          max: 100,
          grid: { display: false },
          title: { display: true, text: "SV %" },
        },
      },
    },
  });

  // Chart 4: Stacked column — PE + SV per period
  chakCreateChart("chakPostRapeStacked", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Physical/Emotional",
          data: trend.map(function (d) {
            return d.physical_emotional || 0;
          }),
          backgroundColor: CHAK_COLORS.orange + "cc",
        },
        {
          label: "Sexual Violence",
          data: trend.map(function (d) {
            return d.sexual_violence || 0;
          }),
          backgroundColor: CHAK_COLORS.pink + "cc",
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
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, grid: { color: "#f0f0f0" } },
      },
    },
  });
  // ── PBIX-style: 100% Stacked — PE vs SV ──
  chakCreateChart(
    "chakPostRape100Stacked",
    chak100PctStackedColumnChart(trend, [
      {
        key: "physical_emotional",
        label: "Physical/Emotional",
        color: CHAK_COLORS.orange + "cc",
      },
      {
        key: "sexual_violence",
        label: "Sexual Violence",
        color: CHAK_COLORS.pink + "cc",
      },
    ]),
  );
  // ── PBIX-style: Donut — Latest distribution ──
  var prLatest = trend[trend.length - 1] || {};
  var prDonutData = [
    { label: "Physical/Emotional", value: prLatest.physical_emotional || 0 },
    { label: "Sexual Violence", value: prLatest.sexual_violence || 0 },
  ];
  if (
    prDonutData.some(function (d) {
      return d.value > 0;
    })
  ) {
    chakCreateChart(
      "chakPostRapeDonut",
      chakDonutChart(prDonutData, [{ key: "value", label: "Count" }]),
    );
  }
  // ── PBIX-style: PE bars + SV% line (combo) ──
  chakCreateChart(
    "chakPostRapeExtraCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [
        {
          key: "physical_emotional",
          label: "Physical/Emotional",
          color: CHAK_COLORS.orange + "80",
        },
      ],
      [
        {
          key: "sexual_violence",
          label: "Sexual Violence",
          color: CHAK_COLORS.pink,
        },
      ],
    ),
  );
});

// ── CACX ──
