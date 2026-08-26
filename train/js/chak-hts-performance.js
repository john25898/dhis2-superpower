// ============================================================
// chak-hts-performance.js  (extracted from main.js lines 14221-14667)
// per-page CHAK renderer 14221-14667
// ============================================================
registerChakRenderer("hts-performance", "hts-performance", function (el, data) {
  const trend = data.trend || [];
  const modalityTrend = data.modality_trend || [];
  const kitsTrend = data.kits_trend || [];
  const latest = trend[trend.length - 1] || {};
  const linkedWithinTotal = chakSum(trend, "linked_within");
  const linkedOutsideTotal = chakSum(trend, "linked_outside");
  const totalLinkedTotal = linkedWithinTotal + linkedOutsideTotal;
  const linkedInPct =
    totalLinkedTotal > 0
      ? ((linkedWithinTotal / totalLinkedTotal) * 100).toFixed(1)
      : 0;

  // Modality display names & colors
  const MODALITY_KEYS = [
    "vct",
    "tb_clinic",
    "pitc_emergency",
    "pitc_inpatient",
    "pitc_pediatric",
    "sti_clinic",
    "malnutrition",
    "other_pitc",
  ];
  const MODALITY_LABELS = {
    vct: "VCT",
    tb_clinic: "TB Clinic",
    pitc_emergency: "PITC Emergency",
    pitc_inpatient: "PITC Inpatient",
    pitc_pediatric: "PITC Pediatric",
    sti_clinic: "STI Clinic",
    malnutrition: "Malnutrition",
    other_pitc: "Other PITC",
  };
  const MODALITY_COLORS = [
    "#2563eb",
    "#16a34a",
    "#dc2626",
    "#ea580c",
    "#9333ea",
    "#0891b2",
    "#ca8a04",
    "#6b7280",
  ];

  el.innerHTML = `
    <div class="chak-page-info"><h2><i class="fas fa-vial"></i> HTS Performance</h2><p>HIV Testing Services: tested, positive, linkage, yield, and TX_NEW</p></div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Tested</div><div class="chak-kpi-value blue">${chakFmt(chakSum(trend, "tested"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Total Positive</div><div class="chak-kpi-value pink">${chakFmt(chakSum(trend, "positive"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Positivity Rate</div><div class="chak-kpi-value orange">${chakAvg(trend, "positivity_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Linkage Rate</div><div class="chak-kpi-value green">${chakAvg(trend, "linkage_pct")}%</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_NEW (Total)</div><div class="chak-kpi-value teal">${chakFmt(chakSum(trend, "tx_new"))}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">Linked Within %</div><div class="chak-kpi-value" style="color:#16a34a">${linkedInPct}%</div><div class="chak-kpi-sub">${chakFmt(linkedWithinTotal)} of ${chakFmt(totalLinkedTotal)} linked</div></div>
    </div>

    <!-- ═══ PBIX-Style Charts ═══ -->
    <div class="chak-section-title"><i class="fas fa-table-cells-large"></i> PBIX-Style Analysis</div>
    <div class="chak-chart-grid">
      ${chakChartCard("📊 Modality Testing (Stacked)", "chakModalityStacked")}
      ${chakChartCard("📊 Test Kits Distributed", "chakKitsDistributed")}
      ${chakChartCard("📊 Cascade: Positive + TX_NEW + Linkage %", "chakPbixCascade")}
      ${chakChartCard("📊 Directly Assisted vs Unassisted", "chakAssistedChart")}
    </div>

    <!-- ═══ Existing Grid 1 ═══ -->
    <div class="chak-section-title"><i class="fas fa-chart-line"></i> Performance Overview</div>
    <div class="chak-chart-grid">
      ${chakChartCard("Tested + Positivity % (Combo)", "chakHtsCombo")}
      ${chakChartCard("Positive → Linked → TX_NEW", "chakHtsCascade")}
      ${chakChartCard("Linkage Breakdown", "chakHtsLinkage")}
      ${chakChartCard("Latest Funnel", "chakHtsFunnel")}
      ${chakChartCard("HTS Performance Detail", "chakHtsDetail", "full")}
    </div>

    <!-- ═══ Existing Grid 2 ═══ -->
    <div class="chak-section-title"><i class="fas fa-chart-mixed"></i> Advanced Analysis</div>
    <div class="chak-chart-grid" style="grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">
      ${chakChartCard("📊 Linkage Mix — Within vs Outside (100% Stacked)", "chakHtsStackedLinkage")}
      ${chakChartCard("📊 Positive + Linkage % (Combo)", "chakHtsPosLinkCombo")}
      ${chakChartCard("📊 Tested + TX_NEW (Clustered Combo)", "chakHtsTestTxCombo")}
      ${chakChartCard("📊 Linkage Within Rate % (100% Stacked)", "chakHtsLnkStacked")}
      ${chakChartCard("📈 All HTS Metrics (Clustered Column)", "chakHtsClustered", "full")}
    </div>

    ${chakRenderTable(trend, ["label", "tested", "positive", "positivity_pct", "linked_within", "linked_outside", "total_linked", "linkage_pct", "tx_new"], ["Month", "Tested", "Positive", "% Pos", "Linked In", "Linked Out", "Total Linked", "% Linked", "TX_NEW"])}
  `;
  el.setAttribute("data-chak-slug", "hts-performance");
  _chakSetData("hts-performance", data);

  // ── PBIX-STYLE CHART 1: Modality Testing (Stacked Bar) ──
  if (modalityTrend.length > 0) {
    chakCreateChart("chakModalityStacked", {
      type: "bar",
      data: {
        labels: modalityTrend.map(function (d) {
          return d.label;
        }),
        datasets: MODALITY_KEYS.map(function (key, i) {
          return {
            label: MODALITY_LABELS[key],
            data: modalityTrend.map(function (d) {
              return d[key] || 0;
            }),
            backgroundColor: MODALITY_COLORS[i] + "cc",
            borderColor: MODALITY_COLORS[i],
            borderWidth: 0,
            borderRadius: 0,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 12, padding: 10, font: { size: 10 } },
          },
          tooltip: { mode: "index", intersect: false },
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, grid: { color: "#f0f0f0" } },
        },
      },
    });
  }

  // ── PBIX-STYLE CHART 2: Test Kits Distributed ──
  if (kitsTrend.length > 0) {
    chakCreateChart("chakKitsDistributed", {
      type: "bar",
      data: {
        labels: kitsTrend.map(function (d) {
          return d.label;
        }),
        datasets: [
          {
            label: "Directly Assisted",
            data: kitsTrend.map(function (d) {
              return d.directly_assisted || 0;
            }),
            backgroundColor: CHAK_COLORS.blue + "80",
            borderRadius: 3,
          },
          {
            label: "Unassisted",
            data: kitsTrend.map(function (d) {
              return d.unassisted || 0;
            }),
            backgroundColor: CHAK_COLORS.orange + "80",
            borderRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } },
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: "#f0f0f0" } },
        },
      },
    });
  }

  // ── PBIX-STYLE CHART 3: Cascade Combo (Positive+TX_NEW bars + Linkage% line) ──
  if (trend.length > 0) {
    chakCreateChart(
      "chakPbixCascade",
      chakLineClusteredColumnComboChart(
        trend,
        [
          {
            key: "positive",
            label: "Positive",
            color: CHAK_COLORS.pink + "80",
          },
          { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal + "80" },
        ],
        [{ key: "linkage_pct", label: "Linkage %", color: CHAK_COLORS.green }],
      ),
    );
  }

  // ── PBIX-STYLE CHART 4: Assisted vs Unassisted Summary ──
  if (kitsTrend.length > 0) {
    var totalAssisted = kitsTrend.reduce(function (a, d) {
      return a + (d.directly_assisted || 0);
    }, 0);
    var totalUnassisted = kitsTrend.reduce(function (a, d) {
      return a + (d.unassisted || 0);
    }, 0);
    chakCreateChart("chakAssistedChart", {
      type: "bar",
      data: {
        labels: ["Kits Distributed"],
        datasets: [
          {
            label: "Directly Assisted",
            data: [totalAssisted],
            backgroundColor: CHAK_COLORS.blue + "cc",
            borderRadius: 4,
          },
          {
            label: "Unassisted",
            data: [totalUnassisted],
            backgroundColor: CHAK_COLORS.orange + "cc",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } },
        },
        scales: {
          x: { beginAtZero: true, grid: { color: "#f0f0f0" } },
          y: { grid: { display: false } },
        },
      },
    });
  }

  // ── EXISTING CHART: Tested + Positivity % (Combo) ──
  chakCreateChart(
    "chakHtsCombo",
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

  // ── EXISTING CHART: Positive → Linked → TX_NEW ──
  chakCreateChart(
    "chakHtsCascade",
    chakBarChart(trend, [
      { key: "positive", label: "Positive", color: CHAK_COLORS.pink },
      { key: "total_linked", label: "Total Linked", color: CHAK_COLORS.green },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal },
    ]),
  );

  // ── EXISTING CHART: Linkage Breakdown ──
  chakCreateChart(
    "chakHtsLinkage",
    chakBarChart(trend, [
      {
        key: "linked_within",
        label: "Linked Within",
        color: CHAK_COLORS.green,
      },
      {
        key: "linked_outside",
        label: "Linked Outside",
        color: CHAK_COLORS.orange,
      },
    ]),
  );

  // ── EXISTING CHART: Latest Funnel ──
  var htsFunnelData = [
    { label: "Tested", value: latest.tested || 0 },
    { label: "Positive", value: latest.positive || 0 },
    { label: "Linked", value: latest.total_linked || 0 },
    { label: "TX_NEW", value: latest.tx_new || 0 },
  ];
  chakCreateChart(
    "chakHtsFunnel",
    chakDonutChart(htsFunnelData, [{ key: "value", label: "Count" }]),
  );

  // ── EXISTING CHART: HTS Performance Detail ──
  chakCreateChart(
    "chakHtsDetail",
    chakLineChart(trend, [
      { key: "linkage_pct", label: "% Linked", color: CHAK_COLORS.green },
      { key: "positivity_pct", label: "% Positive", color: CHAK_COLORS.orange },
    ]),
  );

  // ── EXISTING CHART: 100% Stacked — Linked Within vs Outside ──
  chakCreateChart(
    "chakHtsStackedLinkage",
    chak100PctStackedColumnChart(trend, [
      {
        key: "linked_within",
        label: "Linked Within",
        color: CHAK_COLORS.green + "cc",
      },
      {
        key: "linked_outside",
        label: "Linked Outside",
        color: CHAK_COLORS.orange + "cc",
      },
    ]),
  );

  // ── EXISTING CHART: Positive + Linkage % (Combo) ──
  chakCreateChart(
    "chakHtsPosLinkCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "positive", label: "Positive", color: CHAK_COLORS.pink + "80" }],
      [{ key: "linkage_pct", label: "% Linked", color: CHAK_COLORS.green }],
    ),
  );

  // ── EXISTING CHART: Tested + TX_NEW (Clustered Combo) ──
  chakCreateChart(
    "chakHtsTestTxCombo",
    chakLineClusteredColumnComboChart(
      trend,
      [{ key: "tested", label: "Tested", color: CHAK_COLORS.blue + "80" }],
      [{ key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.teal }],
    ),
  );

  // ── EXISTING CHART: Linkage Within Rate % (100% Stacked) ──
  chakCreateChart("chakHtsLnkStacked", {
    type: "bar",
    data: {
      labels: trend.map(function (d) {
        return d.label;
      }),
      datasets: [
        {
          label: "Linked Within",
          data: trend.map(function (d) {
            var t = (d.linked_within || 0) + (d.linked_outside || 0);
            return t > 0 ? (((d.linked_within || 0) / t) * 100).toFixed(1) : 0;
          }),
          backgroundColor: CHAK_COLORS.green + "cc",
        },
        {
          label: "Linked Outside",
          data: trend.map(function (d) {
            var t = (d.linked_within || 0) + (d.linked_outside || 0);
            return t > 0 ? (((d.linked_outside || 0) / t) * 100).toFixed(1) : 0;
          }),
          backgroundColor: CHAK_COLORS.orange + "cc",
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
          beginAtZero: true,
          grid: { color: "#f0f0f0" },
          title: { display: true, text: "% of Linked" },
        },
      },
    },
  });

  // ── EXISTING CHART: All HTS Metrics (Clustered Column) ──
  chakCreateChart("chakHtsClustered", {
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
            return d.total_linked || 0;
          }),
          backgroundColor: CHAK_COLORS.green + "60",
          borderRadius: 3,
        },
        {
          label: "TX_NEW",
          data: trend.map(function (d) {
            return d.tx_new || 0;
          }),
          backgroundColor: CHAK_COLORS.teal + "60",
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

// ── HTS Index ──
