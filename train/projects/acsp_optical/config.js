// ==========================================================
// Eye Health (ACSP) — project config (datasets, dashboards, visualizations)
// extracted from core.js CHAK_PROJECTS.acsp_optical (byte-identical)
// ==========================================================

window.PROJECT_CONFIGS = window.PROJECT_CONFIGS || {};
window.PROJECT_CONFIGS.acsp_optical = {
  id: "acsp_optical",
  code: "ao",
  name: "Eye Health (ACSP)",
  icon: "👁️",
  color: "bg-purple-50 border-purple-200 hover:bg-purple-100",
  desc: "Eye Health (ACSP) — Africa Clear Sight Partnership Project — increasing awareness and education on presbyopia, its risk factors, associated impairment, and effects on quality of life; alleviating the effects of near-vision impairment.",
  datasets: [
    { id: "xWm3V8jG6cm", name: "ACSP Monthly Report", elements: 103 },
  ],
  dashboards: [
    {
      id: "eXQKlgUONaR",
      name: "ACSP Dashboard",
      visualizations: [
        { id: "KVxmV8xKRKC", name: "Screened/Issued Glasses" },
        { id: "Q8iuQESMdM0", name: "Screening by age/sex" },
        { id: "VmqJCcT6m0M", name: "Issued Glasses by age/sex" },
        { id: "xF7SF60ZQ95", name: "Issued Glasses by power" },
        { id: "cyK34wo7qXg", name: "Trend of Reading Glasses" },
      ],
    },
  ],
};
