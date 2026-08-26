// ============================================================
// chak-profile.js  (extracted from main.js lines 13774-13810)
// per-page CHAK renderer 13774-13810
// ============================================================
registerChakRenderer("profile", "profile", function (el, data) {
  const trend = data.trend || [];
  const latest = data.latest || {};
  el.innerHTML = `
    <div class="chak-page-info">
      <h2><i class="fas fa-map"></i> Profile — ${data.county}</h2>
      <p>Key indicators overview with facility-level map data</p>
    </div>
    <div class="chak-kpi-grid">
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_CURR (Latest)</div>
        <div class="chak-kpi-value blue">${chakFmt(latest.tx_curr)}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">TX_NEW (Latest)</div>
        <div class="chak-kpi-value green">${chakFmt(latest.tx_new)}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">HTS Tested (Latest)</div>
        <div class="chak-kpi-value purple">${chakFmt(latest.hts_tested)}</div></div>
      <div class="chak-kpi-card"><div class="chak-kpi-label">HTS Positive (Latest)</div>
        <div class="chak-kpi-value pink">${chakFmt(latest.hts_positive)}</div></div>
    </div>
    <div class="chak-chart-grid">
            ${chakChartCard("Monthly Trend — Key Indicators", "chakProfileTrend", "full")}
    </div>
    ${chakRenderTable(trend, ["label", "tx_curr", "tx_new", "hts_tested", "hts_positive"], ["Month", "TX_CURR", "TX_NEW", "HTS Tested", "HTS Positive"])}
  `;
  el.setAttribute("data-chak-slug", "profile");
  _chakSetData("profile", data);
  chakCreateChart(
    "chakProfileTrend",
    chakLineChart(trend, [
      { key: "tx_curr", label: "TX_CURR", color: CHAK_COLORS.blue },
      { key: "tx_new", label: "TX_NEW", color: CHAK_COLORS.green },
      { key: "hts_tested", label: "HTS Tested", color: CHAK_COLORS.purple },
      { key: "hts_positive", label: "HTS Positive", color: CHAK_COLORS.pink },
    ]),
  );
});

// ── Key Indicators ──
