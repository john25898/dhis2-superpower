// ==========================================================
// CHAP Stawisha — project config (datasets, dashboards, visualizations)
// extracted from core.js CHAK_PROJECTS.chap_stawisha (byte-identical)
// ==========================================================

window.PROJECT_CONFIGS = window.PROJECT_CONFIGS || {};
window.PROJECT_CONFIGS.chap_stawisha = {
  id: "chap_stawisha",
  code: "cs",
  name: "CHAP Stawisha",
  icon: "🌱",
  color: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
  desc: "Community Health and Adolescent Program — HIV care, FHTS, PrEP, TB, Lab, and more.",
  datasets: [
    { id: "HZA5EOq0Hlu", name: "C&T Reports", elements: 617 },
    { id: "oCeMgSmXBtE", name: "FHTS Reports", elements: 727 },
    { id: "TVoCddvXzIN", name: "PrEP Report", elements: 530 },
    { id: "RiTf6N3VUfq", name: "Commodities Reports", elements: 475 },
    { id: "rSNiMlIp2FY", name: "Laboratory Reports", elements: 347 },
    { id: "caJ4S2uo7vK", name: "POST_RESP Report", elements: 179 },
    { id: "xGYwTcfvEH5", name: "TB Reports", elements: 135 },
    { id: "cu4cBIZrdnV", name: "OTZ Report", elements: 118 },
    { id: "xgiBQ2crniA", name: "OVC Report", elements: 0 },
  ],
  dashboards: [
    {
      id: "YcoF4RBMSEJ",
      name: "Chap Stawisha HTS",
      visualizations: [
        { id: "WK14sieajnb", name: "IPD Graph" },
        { id: "GZACoqMmQfM", name: "PNS Graph" },
        { id: "kbQsKaCUB8x", name: "Family Testing Graph" },
        { id: "TCTsasEoMbE", name: "WRA Children Contacts" },
        { id: "wrzPq8CvT2S", name: "Prevention services Graph" },
        { id: "PlHUA5Z4wSi", name: "FHTS - Tested, Pos and Linked" },
      ],
    },
    {
      id: "K85HrESt61m",
      name: "Chap Stawisha Care and Treatment",
      visualizations: [
        { id: "SBJ03MaMPH9", name: "TX_Curr Regimens" },
        { id: "hO3ijJSNo84", name: "TX_Curr" },
        { id: "oafmgURYxFH", name: "TX_Curr vs MMD" },
        { id: "dukFp0VOsyS", name: "TX Gains" },
        { id: "fO2Ct8L0UOB", name: "Hypertension" },
        { id: "OLHFrDG9QlR", name: "Diabetes" },
        { id: "xvfWI1MrXSo", name: "VL Suppression" },
        { id: "LyfH66uSJoM", name: "TX Losses" },
        { id: "bvVA1KXPCgN", name: "TX_New Trend" },
        { id: "ZiHnhDd7ubz", name: "% Suppression by age groups" },
        { id: "sl8NEuWeSPo", name: "TX_Curr Trend" },
        { id: "u6vpiRG382d", name: "VL Coverage" },
        { id: "Spq8yd9m8BJ", name: "MMD Trend" },
      ],
    },
    {
      id: "EOdHXXKsPAg",
      name: "CHAP Stawisha AHD",
      visualizations: [
        { id: "S9urIcWBYrA", name: "TX_New CD4" },
        { id: "Chw3T5JYf9g", name: "AHD IIT CD4" },
        { id: "kZiutIDKJs1", name: "AHD TF CD4" },
        { id: "Sg0gflvgwv2", name: "Crag screens" },
        { id: "o5eawra3BxK", name: "TB screens" },
        { id: "qv6K0Knj5jK", name: "AHD Totals" },
        { id: "RMmXuhp0ypQ", name: "AHD IIT" },
        { id: "mUxz5MaAbqM", name: "Crag Positive" },
        { id: "impeenCtA7a", name: "TB Positive" },
      ],
    },
    {
      id: "meA5kLnL4VF",
      name: "CHAP Stawisha CaCX",
      visualizations: [
        { id: "rDvEtcYGFyc", name: "CaCX Screen due vs Screen done" },
      ],
    },
    {
      id: "KBRAcvrH3At",
      name: "CHAP Stawisha PrEP",
      visualizations: [
        { id: "ZueQ1hho4L9", name: "PrEP_CURR" },
        { id: "rYX3wsMKKmD", name: "PrEP Month 1 Refill" },
        { id: "DZCPuzu0t0w", name: "PrEP Month 3 Refill" },
        { id: "ZFOFBrlSq2f", name: "PrEP New by Population" },
      ],
    },
    {
      id: "P6U6sWbjSOG",
      name: "CHAP Stawisha PMTCT Dashboard",
      visualizations: [
        { id: "Cdn0W5KFgrg", name: "PMTCT_STAT Cascade" },
        { id: "V7kZUsTLWK8", name: "EID 0-8wks" },
        { id: "ivyV1uBvQLY", name: "EID 2-12mnths" },
        { id: "bPkonCDqbb2", name: "VL for Known Positives" },
        { id: "N2tMAnePHhZ", name: "VL for New Positives" },
        { id: "w4cp7XyybRI", name: "Pregnant Women" },
        { id: "ouDmMtQBil6", name: "Breastfeeding Women" },
        { id: "ub3WspEZ1mE", name: "HEI PCR" },
        { id: "KyQQ6qYDUtu", name: "HEI Final Outcomes" },
      ],
    },
  ],
};
