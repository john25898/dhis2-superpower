// ==========================================================
// Gates Foundation MNCH — project config (datasets, dashboards, visualizations)
// extracted from core.js CHAK_PROJECTS.gates_foundation (byte-identical)
// ==========================================================

window.PROJECT_CONFIGS = window.PROJECT_CONFIGS || {};
window.PROJECT_CONFIGS.gates_foundation = {
  id: "gates_foundation",
  code: "gf",
  name: "Gates Foundation MNCH",
  icon: "💉",
  color: "bg-rose-50 border-rose-200 hover:bg-rose-100",
  desc: "Gates Foundation — Maternal, Newborn & Child Health (MNCH) service delivery and commodity monitoring.",
  datasets: [
    { id: "g3hrJMXsRHD", name: "Service Delivery", elements: 240 },
    { id: "KLipwKfzvir", name: "Monthly Report", elements: 240 },
    { id: "k6Vi8VxJuue", name: "Commodity Report", elements: 77 },
  ],
  dashboards: [
    {
      id: "WxPPfMc1lV1",
      name: "GF - RMNCH Dashboard",
      visualizations: [
        { id: "HBXJTWJ7Klt", name: "GF - ANC Clients" },
        { id: "zGFVZohMuWO", name: "Iron/Folic" },
        { id: "SidkJaoOzLf", name: "Deliveries" },
        { id: "YARTtPVeBZm", name: "Uterotonics" },
        { id: "UBPdoZ6lj6C", name: "Maternal Complications" },
        { id: "iir7qvfzy7o", name: "Maternal Deaths" },
        { id: "F0vQuLxncrJ", name: "Neonatal Deaths" },
        { id: "YAExTmrN15O", name: "PNC" },
      ],
    },
  ],
};
