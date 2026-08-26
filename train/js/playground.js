// ============================================================
// playground.js  (extracted from main.js lines 4045-4479)
// domain section 4045-4479
// ============================================================
function renderProjectSelection() {
  // Static projects (non-CHAK)
  var staticProjects = [
    {
      id: "jamii_tekelezi",
      name: "Jamii Tekelezi",
      desc: "Comprehensive HIV/AIDS program dashboard — Testing, Treatment, PrEP, PMTCT, TB, and more.",
      icon: "📊",
      color: "bg-sky-50 border-sky-200 hover:bg-sky-100",
    },
  ];

  // Build CHAK project cards from config
  var chakCards = Object.keys(CHAK_PROJECTS).map(function (key) {
    var p = CHAK_PROJECTS[key];
    return {
      id: p.id,
      name: p.name,
      desc: p.desc,
      icon: p.icon,
      color: p.color,
      isChak: true,
    };
  });

  var allProjects = staticProjects.concat(chakCards);

  elements.chartRoot.innerHTML =
    '<div class="space-y-6">' +
    '<div class="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">' +
    '<div class="flex items-center gap-3 mb-5">' +
    '<div class="text-2xl">📋</div>' +
    "<div>" +
    '<h2 class="text-lg font-bold text-slate-800">Select a Project</h2>' +
    '<p class="text-xs text-slate-500">Choose a project to view its dashboards, datasets, and reports.</p>' +
    "</div>" +
    "</div>" +
    '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">' +
    allProjects
      .map(function (p) {
        return (
          '<button data-project="' +
          escapeHtml(p.id) +
          '" class="flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition ' +
          p.color +
          '">' +
          '<div class="text-3xl shrink-0">' +
          p.icon +
          "</div>" +
          '<div class="min-w-0">' +
          '<div class="text-[14px] font-bold text-slate-800">' +
          escapeHtml(p.name) +
          "</div>" +
          '<div class="text-[12px] text-slate-500 mt-0.5 leading-snug">' +
          escapeHtml(p.desc) +
          "</div>" +
          "</div>" +
          "</button>"
        );
      })
      .join("") +
    "</div>" +
    "</div>" +
    "</div>";

  elements.chartRoot.querySelectorAll("[data-project]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var projectId = btn.getAttribute("data-project") || "";

      // Jamii Tekelezi — existing behavior
      if (projectId === "jamii_tekelezi") {
        state.activeProject = "jamii_tekelezi";
        if (elements.projectFilter)
          elements.projectFilter.value = "jamii-tekelezi";
        state.activePage = "overview";
        state.activeDatasetId = "";
        setPageHash("overview");
        renderCurrentView();
        return;
      }

      // CHAK project — check if it's a known CHAK project
      var chakProj = CHAK_PROJECT_IDS[projectId];
      if (chakProj) {
        state.activeProject = projectId;
        state.activeDatasetId = "";
        state.activePage = "overview";
        if (elements.projectFilter) elements.projectFilter.value = projectId;
        setPageHash("overview");
        renderCurrentView();
      }
    });
  });
}

function renderPlaygroundPage() {
  const existingPrompt =
    document.getElementById("playgroundPrompt")?.value || "";

  if (state.playgroundChart) {
    state.playgroundChart.destroy();
    state.playgroundChart = null;
  }

  elements.chartRoot.innerHTML = `
    <div class="space-y-6">
      <section class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div class="text-2xl font-bold text-slate-800">Playground</div>
            <div class="mt-1 max-w-2xl text-sm text-slate-500">Get any report or visual with just a prompt.</div>
          </div>
          <div class="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">
            <span class="h-2 w-2 rounded-full bg-sky-500"></span> Groq-powered AI query interface
          </div>
        </div>
      </section>

      <section class="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-sky-50 p-5 shadow-sm">
        <div class="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <div class="text-sm font-semibold text-slate-700">Ask a question</div>
            <p class="mt-1 text-xs text-slate-500">Finance mode reuses the project-performance dataset; DHIS2 mode sends the prompt through the main Groq SQL route.</p>
            <textarea id="playgroundPrompt" class="mt-4 min-h-[130px] w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:bg-white" placeholder="Example: Show me the actual vs target for Jamii Tekelezi or visualize TX CURR for May">${escapeHtml(existingPrompt)}</textarea>
            <div class="mt-3 flex flex-wrap gap-2">
              <button type="button" data-playground-mode="finance" class="rounded-full border px-3 py-2 text-xs font-semibold transition ${state.playgroundMode === "finance" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}">Finance reports</button>
              <button type="button" data-playground-mode="dhis2" class="rounded-full border px-3 py-2 text-xs font-semibold transition ${state.playgroundMode === "dhis2" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}">DHIS2 reports</button>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <button type="button" data-playground-example="Show me the actual vs target for Jamii Tekelezi" class="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-100">Finance example</button>
              <button type="button" data-playground-example="Visualize TX CURR for May" class="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-100">TX_CURR example</button>
              <button type="button" data-playground-example="Give me TB for May" class="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-100">TB example</button>
            </div>
            <div class="mt-4 flex items-center gap-3">
              <button id="playgroundSubmit" class="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700">Generate report</button>
              <span id="playgroundStatus" class="text-xs text-slate-500">Ready.</span>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <div class="text-sm font-semibold text-slate-700">How it works</div>
            <ul class="mt-3 space-y-2 text-sm text-slate-600">
              <li>• Finance mode reuses the same project-performance data the finance analysis tab uses.</li>
              <li>• DHIS2 mode uses the existing Groq-backed SQL chat route.</li>
              <li>• Results render as cards, charts, and a table when data is returned.</li>
            </ul>
          </div>
        </div>
      </section>

      <section class="space-y-4">
        <div id="playgroundSummaryCards" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"></div>
        <div id="playgroundChartWrap" class="hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="text-sm font-semibold text-slate-700 mb-3">Visual</div>
          <div class="h-[320px]"><canvas id="playgroundChartCanvas"></canvas></div>
        </div>
        <div id="playgroundAnswer" class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-700">
          Ask a prompt to generate a report or visual.
        </div>
      </section>
    </div>
  `;

  const promptInput = document.getElementById("playgroundPrompt");
  const submitButton = document.getElementById("playgroundSubmit");
  const status = document.getElementById("playgroundStatus");

  document.querySelectorAll("[data-playground-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.playgroundMode =
        button.getAttribute("data-playground-mode") || "finance";
      renderPlaygroundPage();
      const nextInput = document.getElementById("playgroundPrompt");
      if (nextInput && promptInput) nextInput.value = promptInput.value;
    });
  });

  document.querySelectorAll("[data-playground-example]").forEach((button) => {
    button.addEventListener("click", () => {
      if (promptInput)
        promptInput.value =
          button.getAttribute("data-playground-example") || "";
    });
  });

  const submitPlaygroundPrompt = async () => {
    const question = (promptInput && promptInput.value.trim()) || "";
    if (!question) {
      if (status) status.textContent = "Enter a prompt first.";
      return;
    }

    if (status) status.textContent = "Generating…";
    if (submitButton) submitButton.disabled = true;

    try {
      const requestBody = {
        question,
        chart_id:
          state.playgroundMode === "finance"
            ? "playground-finance"
            : "playground-dhis2",
        active_page:
          state.playgroundMode === "finance"
            ? "financial_analysis"
            : "overview",
        active_tab: state.playgroundMode === "finance" ? "overview" : "",
      };

      if (state.playgroundMode === "finance") {
        const chartData = await loadPlaygroundFinanceChartData();
        if (chartData) {
          requestBody.chart_data = chartData;
        }
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "The assistant could not process that request.",
        );
      }

      renderPlaygroundResponse(result);
      if (status) status.textContent = result.summary || "Completed.";
    } catch (error) {
      renderPlaygroundError(
        error.message || "Network error while contacting the AI assistant.",
      );
      if (status) status.textContent = "Failed.";
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  };

  if (submitButton) {
    submitButton.addEventListener("click", submitPlaygroundPrompt);
  }
  if (promptInput) {
    promptInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.ctrlKey) {
        submitPlaygroundPrompt();
      }
    });
  }
}

async function loadPlaygroundFinanceChartData() {
  if (state.playgroundFinanceData) return state.playgroundFinanceData;

  const response = await fetch("/api/project-portfolio");
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "Failed to load finance data");

  const projects = (data.portfolio && data.portfolio.projects) || [];
  const labels = projects.map((project) => project.project || "Project");
  const budget = projects.map((project) =>
    Number(project.total_annual_budget || 0),
  );
  const expenditure = projects.map((project) =>
    Number(project.cumulative_expenditure || 0),
  );
  const onTrack = projects.map((project) =>
    project.overall_rag === "On Track" ? 1 : 0,
  );

  state.playgroundFinanceData = {
    labels,
    datasets: [
      { label: "Annual Budget", data: budget },
      { label: "Cumulative Expenditure", data: expenditure },
      { label: "On Track Projects", data: onTrack },
    ],
  };

  return state.playgroundFinanceData;
}

function renderPlaygroundResponse(payload) {
  const summaryCards = document.getElementById("playgroundSummaryCards");
  const answer = document.getElementById("playgroundAnswer");
  const chartWrap = document.getElementById("playgroundChartWrap");
  const chartCanvas = document.getElementById("playgroundChartCanvas");

  if (!summaryCards || !answer) return;

  summaryCards.innerHTML = `
    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Rows returned</div>
      <div class="mt-2 text-2xl font-bold text-slate-800">${Number(payload.row_count || 0).toLocaleString()}</div>
    </div>
    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Source</div>
      <div class="mt-2 text-2xl font-bold text-slate-800">${escapeHtml(payload.source || "ai")}</div>
    </div>
    <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2 xl:col-span-2">
      <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">SQL</div>
      <div class="mt-2 break-words text-xs text-slate-600">${escapeHtml(payload.sql || "")}</div>
    </div>
  `;

  answer.innerHTML =
    payload.answer_html ||
    `<p>${escapeHtml(payload.summary || "No answer returned.")}</p>`;

  if (chartWrap && chartCanvas) {
    const chartSpec = buildPlaygroundChartSpec(
      payload.rows || [],
      payload.columns || [],
    );
    if (chartSpec) {
      chartWrap.classList.remove("hidden");
      if (state.playgroundChart) {
        state.playgroundChart.destroy();
      }
      state.playgroundChart = new Chart(chartCanvas, chartSpec);
    } else {
      chartWrap.classList.add("hidden");
      if (state.playgroundChart) {
        state.playgroundChart.destroy();
        state.playgroundChart = null;
      }
    }
  }
}

function renderPlaygroundError(message) {
  const summaryCards = document.getElementById("playgroundSummaryCards");
  const answer = document.getElementById("playgroundAnswer");
  const chartWrap = document.getElementById("playgroundChartWrap");

  if (summaryCards) summaryCards.innerHTML = "";
  if (chartWrap) chartWrap.classList.add("hidden");
  if (state.playgroundChart) {
    state.playgroundChart.destroy();
    state.playgroundChart = null;
  }
  if (answer) {
    answer.innerHTML = `<div class="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">${escapeHtml(message)}</div>`;
  }
}

function buildPlaygroundChartSpec(rows, columns) {
  if (
    !Array.isArray(rows) ||
    !rows.length ||
    !Array.isArray(columns) ||
    !columns.length
  ) {
    return null;
  }

  const firstRow = rows[0] || {};
  const numericColumns = columns.filter(
    (column) => typeof firstRow[column] === "number",
  );
  const textColumns = columns.filter(
    (column) => typeof firstRow[column] === "string",
  );
  const labelColumn = textColumns[0] || columns[0];

  if (!numericColumns.length) {
    return null;
  }

  const labels = rows.slice(0, 12).map((row) => String(row[labelColumn] ?? ""));
  const datasets = numericColumns.slice(0, 3).map((column, index) => ({
    label: column,
    data: rows.slice(0, 12).map((row) => Number(row[column]) || 0),
    backgroundColor: ["#0ea5e9", "#10b981", "#8b5cf6"][index] || "#64748b",
    borderRadius: 6,
  }));

  if (!labels.length || !datasets.length) {
    return null;
  }

  return {
    type: datasets.length > 1 ? "bar" : "line",
    data: {
      labels,
      datasets: datasets.map((dataset) => ({
        ...dataset,
        fill: datasets.length === 1,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
      },
      scales: {
        x: { ticks: { maxRotation: 0, font: { size: 10 } } },
        y: { beginAtZero: true },
      },
    },
  };
}

// ── Human Resource Page ──
function renderHumanResourcePage() {
  elements.chartRoot.innerHTML = `
    <div class="space-y-6">
      <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <div class="text-5xl mb-4">👥</div>
          <h2 class="text-xl font-bold text-slate-800 mb-2">Human Resource</h2>
          <p class="text-sm text-slate-500 max-w-md">Staff management, payroll, and human resource analytics.</p>
        </div>
      </div>
    </div>
  `;
}

// ── CBSL Page ──
function renderCbslPage() {
  elements.chartRoot.innerHTML = `
    <div class="space-y-6">
      <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <div class="text-5xl mb-4">🏛️</div>
          <h2 class="text-xl font-bold text-slate-800 mb-2">CBSL — Community Based Social & Livelihood</h2>
          <p class="text-sm text-slate-500 max-w-md">Community-based social programs and livelihood initiatives.</p>
        </div>
      </div>
    </div>
  `;
}
