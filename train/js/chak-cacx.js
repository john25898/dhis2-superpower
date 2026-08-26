// ============================================================
// chak-cacx.js  (extracted from main.js lines 16886-17104)
// per-page CHAK renderer 16886-17104
// ============================================================
registerChakRenderer("cacx", "cacx", function (el, data) {
  const trend = data.trend || [];
  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-ribbon"></i> CACX (Cervical Cancer Screening)</h2><p>Cervical cancer screening, positivity, and treatment cascade</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Screened</div><div class="chak-kpi-value blue">${chakFmt(chakSum(trend, "screened"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Positive</div><div class="chak-kpi-value pink">${chakFmt(chakSum(trend, "positive"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Treated</div><div class="chak-kpi-value green">${chakFmt(chakSum(trend, "treated"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg Positivity</div><div class="chak-kpi-value orange">${chakAvg(trend, "positivity_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Avg Treatment Rate</div><div class="chak-kpi-value purple">${chakAvg(trend, "treatment_pct")}%</div></div>
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📈 CACX Cascade — Screened · Positive · Treated", "chakCacxCascade")}
      ${chakChartCard("📊 % Positivity & Treatment Rate", "chakCacxPct")}
      ${chakChartCard("📊 Monthly Screening by Outcome (Clustered)", "chakCacxMonthly")}
      ${chakChartCard("📈 Screening with % Positivity (Combo)", "chakCacxCombo")}
      ${chakChartCard("📋 Detailed Monthly CACX Data", "chakCacxDetail", "full")}
    </div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 Pos vs Treated (100% Stacked)", "chakCacx100Stacked")}
      ${chakChartCard("🍩 Latest CACX Distribution", "chakCacxDonut")}
      ${chakChartCard("📊 Positive + % Treated (Combo)", "chakCacxPosTreatCombo")}
    </div>`;
  el.setAttribute("data-chak-slug", "cacx");
  _chakSetData("cacx", data);

  // Chart 1: Line — Cascade
  chakCreateChart(
    "chakCacxCascade",
    chakLineChart(trend, [
      { key: "screened", label: "Screened", color: CHAK_COLORS.blue },
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
      { key: "treated", label: "Treated", color: CHAK_COLORS.green },
    ]),
  );

  // Chart 2: Line — % rates
  chakCreateChart(
    "chakCacxPct",
    chakLineChart(trend, [
      { key: "positivity_pct", label: "% Positive", color: CHAK_COLORS.orange },
      { key: "treatment_pct", label: "% Treated", color: CHAK_COLORS.purple },
    ]),
  );

  // Chart 3: Clustered column — Monthly breakdown
  chakCreateChart("chakCacxMonthly", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Screened",
          data: trend.map(function (d) {
            return d.screened || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "cc",
          borderRadius: 3,
        },
        {
          label: "Positive",
          data: trend.map(function (d) {
            return d.positive || 0;
          }),
          backgroundColor: CHAK_COLORS.pink + "cc",
          borderRadius: 3,
        },
        {
          label: "Treated",
          data: trend.map(function (d) {
            return d.treated || 0;
          }),
          backgroundColor: CHAK_COLORS.green + "cc",
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

  // Chart 4: Combo — Screened bars + % Positivity line
  chakCreateChart("chakCacxCombo", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Screened",
          data: trend.map(function (d) {
            return d.screened || 0;
          }),
          backgroundColor: CHAK_COLORS.blue + "80",
          borderRadius: 3,
          order: 2,
        },
        {
          label: "% Positive",
          data: trend.map(function (d) {
            return d.positivity_pct || 0;
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
          title: { display: true, text: "% Positive" },
        },
      },
    },
  });

  // Chart 5: Monthly data table (full-width)
  setTimeout(function () {
    var tblEl = document.getElementById("chakCacxDetail");
    if (!tblEl) return;
    var html =
      '<div style="overflow-x:auto;max-height:400px;overflow-y:auto"><table class="chak-data-table" style="width:100%;font-size:11px"><thead><tr><th>Month</th><th>Screened</th><th>Positive</th><th>Treated</th><th>% Positive</th><th>% Treated</th></tr></thead><tbody>';
    trend.forEach(function (r) {
      html +=
        "<tr><td>" +
        (r.label || "") +
        "</td><td>" +
        chakFmt(r.screened || 0) +
        "</td><td>" +
        chakFmt(r.positive || 0) +
        "</td><td>" +
        chakFmt(r.treated || 0) +
        "</td><td>" +
        (r.positivity_pct || 0).toFixed(1) +
        "%</td><td>" +
        (r.treatment_pct || 0).toFixed(1) +
        "%</td></tr>";
    });
    html += "</tbody></table></div>";
    tblEl.innerHTML = html;
  }, 50);
  // ── PBIX-style: 100% Stacked — Positive vs Treated proportions ──
  chakCreateChart(
    "chakCacx100Stacked",
    chak100PctStackedColumnChart(trend, [
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink + "cc" },
      { key: "treated", label: "Treated", color: CHAK_COLORS.green + "cc" },
    ]),
  );
  // ── PBIX-style: Donut — Latest CACX distribution ──
  var cacxLatest = trend[trend.length - 1] || {};
  var cacxDonutData = [
    { label: "Screened", value: cacxLatest.screened || 0 },
    { label: "Positive", value: cacxLatest.positive || 0 },
    { label: "Treated", value: cacxLatest.treated || 0 },
  ];
  if (
    cacxDonutData.some(function (d) {
      return d.value > 0;
    })
  ) {
    chakCreateChart(
      "chakCacxDonut",
      chakDonutChart(cacxDonutData, [{ key: "value", label: "Count" }]),
    );
  }
  // ── PBIX-style: Positive bars + Treatment% line (combo) ──
  chakCreateChart(
    "chakCacxPosTreatCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "positive", label: "Positive", color: CHAK_COLORS.pink + "80" }],
      [{ key: "treatment_pct", label: "% Treated", color: CHAK_COLORS.purple }],
    ),
  );
});

// ── IIT Quarterly ──
