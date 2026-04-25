const STORAGE_KEY = "roadto300.daily.v1";
const STORAGE_BACKUP_KEY = "roadto300.daily.v1.backup";
const LEGACY_STORAGE_KEYS = ["trainiq.daily.v2", "trainiq.daily.v1"];
const API_STATE_ENDPOINT = getStateEndpoint();
const MAX_DAILY_POINTS = 5;

const trackerDefs = [
  { key: "gym", type: "numeric", weight: 35, label: "Gym", color: "#6ae5ff" },
  { key: "strain", type: "numeric", weight: 16.25, allowDecimal: true, label: "Strain", color: "#ffc63d" },
  { key: "carbFree", type: "numeric", weight: 16.25, label: "Carb-Free", color: "#ff7b37" },
  {
    key: "supplements",
    type: "binary",
    weight: 16.25,
    label: "Supplements",
    color: "#8affc1",
    binaryOnText: "Taken",
    binaryOffText: "Not taken",
  },
  {
    key: "fasting",
    type: "binary",
    weight: 16.25,
    label: "Fasting",
    color: "#a49dff",
    binaryOnText: "Done",
    binaryOffText: "Not done",
  },
];

const defaultData = {
  gym: { target: 1, done: 0 },
  strain: { target: 15, done: 0 },
  carbFree: { target: 3, done: 0 },
  supplements: { taken: false },
  fasting: { taken: false },
  weightKg: null,
};

const totalTrendCanvas = document.getElementById("totalTrendCanvas");
const bucketTrendCanvas = document.getElementById("bucketTrendCanvas");
const weightTrendCanvas = document.getElementById("weightTrendCanvas");
const totalLegend = document.getElementById("totalLegend");
const bucketLegend = document.getElementById("bucketLegend");
const weightLegend = document.getElementById("weightLegend");
const logMeta = document.getElementById("logMeta");
const logTableBody = document.getElementById("logTableBody");
const backendStatusEl = document.getElementById("backendStatusProgress");

let logRows = [];

renderLegends();
bootstrap();

window.addEventListener("resize", () => {
  renderCharts(logRows);
});

async function bootstrap() {
  const state = await loadState();
  logRows = buildRows(state.days);
  renderTable(logRows);
  renderCharts(logRows);
}

function buildRows(daysMap) {
  const dayKeys = Object.keys(daysMap || {}).sort();
  return dayKeys.map((dateKey) => {
    const day = normalizeDay(daysMap[dateKey]);
    const total = getDayPoints(day);
    const bucket = {};

    trackerDefs.forEach((def) => {
      const ratio = getTrackerRatio(def, day[def.key]);
      bucket[def.key] = {
        ratio,
        pct: Math.round(ratio * 100),
        text: getBucketText(def, day[def.key], ratio),
      };
    });

    return { dateKey, total, bucket, weightKg: day.weightKg };
  });
}

function renderTable(rows) {
  if (!rows.length) {
    logMeta.textContent = "No tracked days yet.";
    logTableBody.innerHTML = `<tr><td colspan="8" class="muted">Start logging in the tracker to see your progress here.</td></tr>`;
    return;
  }

  const totalPoints = rows.reduce((sum, row) => sum + row.total, 0);
  const avg = totalPoints / rows.length;
  logMeta.textContent = `${rows.length} day${rows.length === 1 ? "" : "s"} logged. Avg ${avg.toFixed(2)} / ${MAX_DAILY_POINTS} points.`;

  logTableBody.innerHTML = rows
    .map((row) => {
      return `<tr>
        <td>${formatLongDate(row.dateKey)}</td>
        <td>${row.total.toFixed(2)}</td>
        <td>${row.bucket.gym.text}</td>
        <td>${row.bucket.strain.text}</td>
        <td>${row.bucket.carbFree.text}</td>
        <td>${row.bucket.supplements.text}</td>
        <td>${row.bucket.fasting.text}</td>
        <td>${formatWeight(row.weightKg)}</td>
      </tr>`;
    })
    .join("");
}

function renderCharts(rows) {
  if (!rows.length) {
    drawNoData(totalTrendCanvas);
    drawNoData(bucketTrendCanvas);
    drawNoData(weightTrendCanvas);
    return;
  }

  const labels = rows.map((row) => row.dateKey);
  const totalDataset = [
    {
      label: "Total Score",
      color: "#ff4da8",
      values: rows.map((row) => row.total),
    },
  ];

  drawLineChart(totalTrendCanvas, labels, totalDataset, 0, MAX_DAILY_POINTS);

  const bucketDatasets = trackerDefs.map((def) => ({
    label: def.label,
    color: def.color,
    values: rows.map((row) => row.bucket[def.key].pct),
  }));

  drawLineChart(bucketTrendCanvas, labels, bucketDatasets, 0, 100);

  const weightRows = rows.filter((row) => row.weightKg !== null);
  if (!weightRows.length) {
    drawNoData(weightTrendCanvas);
    return;
  }

  const weightLabels = weightRows.map((row) => row.dateKey);
  const weightValues = weightRows.map((row) => row.weightKg);
  const minWeight = Math.min(...weightValues);
  const maxWeight = Math.max(...weightValues);
  const pad = Math.max(1, (maxWeight - minWeight) * 0.2);
  const minY = Math.max(0, minWeight - pad);
  const maxY = maxWeight + pad;

  drawLineChart(
    weightTrendCanvas,
    weightLabels,
    [{ label: "Weight (kg)", color: "#ffd166", values: weightValues }],
    minY,
    maxY
  );
}

function drawNoData(canvas) {
  const { ctx, width, height } = prepareCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "700 16px Nunito";
  ctx.textAlign = "center";
  ctx.fillText("No data yet", width / 2, height / 2);
}

function drawLineChart(canvas, labels, datasets, minY, maxY) {
  const { ctx, width, height } = prepareCanvas(canvas);
  ctx.clearRect(0, 0, width, height);

  const pad = { top: 18, right: 18, bottom: 26, left: 38 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const ySteps = 4;
  const xCount = labels.length;

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= ySteps; i += 1) {
    const y = pad.top + (chartH / ySteps) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "700 10px Nunito";
  ctx.textAlign = "right";
  for (let i = 0; i <= ySteps; i += 1) {
    const y = pad.top + (chartH / ySteps) * i;
    const value = maxY - ((maxY - minY) * i) / ySteps;
    ctx.fillText(value.toFixed(0), pad.left - 6, y + 3);
  }

  datasets.forEach((dataset) => {
    ctx.strokeStyle = dataset.color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();

    dataset.values.forEach((value, idx) => {
      const x = pad.left + (xCount <= 1 ? chartW / 2 : (idx / (xCount - 1)) * chartW);
      const ratio = (value - minY) / (maxY - minY || 1);
      const y = pad.top + chartH - ratio * chartH;

      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  });

  const tickIndexes = [0, Math.floor((xCount - 1) / 2), xCount - 1].filter(
    (value, idx, arr) => arr.indexOf(value) === idx
  );
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "700 10px Nunito";
  ctx.textAlign = "center";
  tickIndexes.forEach((idx) => {
    const x = pad.left + (xCount <= 1 ? chartW / 2 : (idx / (xCount - 1)) * chartW);
    ctx.fillText(formatAxisDate(labels[idx]), x, height - 8);
  });
}

function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(220, Math.floor(rect.height));
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

function renderLegends() {
  totalLegend.innerHTML = `<span class="legend-chip"><span class="legend-dot" style="background:#ff4da8"></span>Total Score (0-5)</span>`;
  bucketLegend.innerHTML = trackerDefs
    .map(
      (def) =>
        `<span class="legend-chip"><span class="legend-dot" style="background:${def.color}"></span>${def.label}</span>`
    )
    .join("");
  weightLegend.innerHTML = `<span class="legend-chip"><span class="legend-dot" style="background:#ffd166"></span>Weight (kg)</span>`;
}

function getBucketText(def, item, ratio) {
  if (def.type === "binary") {
    const onText = def.binaryOnText || "Done";
    const offText = def.binaryOffText || "Not done";
    return item.taken ? `${onText} (100%)` : `${offText} (0%)`;
  }
  return `${formatNumericInput(def, item.done)}/${formatNumericInput(def, item.target)} (${Math.round(ratio * 100)}%)`;
}

function getDayPoints(dayData) {
  const weightedPercent = trackerDefs.reduce((sum, def) => {
    const ratio = getTrackerRatio(def, dayData[def.key]);
    return sum + ratio * def.weight;
  }, 0);
  const points = (weightedPercent / 100) * MAX_DAILY_POINTS;
  return Math.round(points * 100) / 100;
}

function getTrackerRatio(def, item) {
  if (def.type === "binary") {
    return item.taken ? 1 : 0;
  }
  const safeTarget = Math.max(item.target, 1);
  return clamp(item.done / safeTarget, 0, 1);
}

function normalizeDay(dayData) {
  const day = structuredClone(defaultData);
  if (!dayData || typeof dayData !== "object") {
    return day;
  }

  trackerDefs.forEach((def) => {
    const source = dayData[def.key] || {};
    if (def.type === "numeric") {
      day[def.key] = {
        target: parseNumericInput(def, source.target, day[def.key].target, 1),
        done: parseNumericInput(def, source.done, day[def.key].done, 0),
      };
    }

    if (def.type === "binary") {
      const legacyTaken = Number(source.done) >= Number(source.target || 1);
      day[def.key] = { taken: Boolean(source.taken ?? legacyTaken) };
    }
  });

  day.weightKg = parseWeightKg(dayData.weightKg);

  return day;
}

async function loadState() {
  try {
    const response = await fetch(API_STATE_ENDPOINT, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Backend load failed with status ${response.status}`);
    }
    const parsed = await response.json();
    if (parsed && typeof parsed === "object" && parsed.days) {
      setBackendStatus("");
      return parsed;
    }
  } catch (err) {
    console.warn("Could not load backend state, trying localStorage fallback.", err);
    setBackendStatus(
      "Cannot connect to backend. This page may not show shared cross-device progress until backend is reachable."
    );
  }

  const localState = loadLegacyLocalState();
  if (localState) {
    return localState;
  }

  return { days: {} };
}

function loadLegacyLocalState() {
  const candidates = [STORAGE_KEY, STORAGE_BACKUP_KEY, ...LEGACY_STORAGE_KEYS];
  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object" && parsed.days) {
        return parsed;
      }
    } catch (err) {
      console.error(`Could not load saved tracker state from ${key}`, err);
    }
  }
  return null;
}

function formatLongDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", weekday: "short" });
}

function formatAxisDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function asPositiveInt(value, fallback, minValue) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(parsed, minValue);
}

function asPositiveNumber(value, fallback, minValue, decimals = 1) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  const safe = Math.max(parsed, minValue);
  const factor = 10 ** decimals;
  return Math.round(safe * factor) / factor;
}

function parseNumericInput(def, value, fallback, minValue) {
  if (def.allowDecimal) {
    return asPositiveNumber(value, fallback, minValue, 1);
  }
  return asPositiveInt(value, fallback, minValue);
}

function formatNumericInput(def, value) {
  if (def.allowDecimal) {
    return Number(value).toFixed(1);
  }
  return String(value);
}

function parseWeightKg(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  const clamped = Math.min(parsed, 120);
  return Math.round(clamped * 10) / 10;
}

function formatWeight(value) {
  if (value === null || value === undefined) {
    return "-";
  }
  return value.toFixed(1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setBackendStatus(message) {
  if (!backendStatusEl) {
    return;
  }
  const text = (message || "").trim();
  if (!text) {
    backendStatusEl.hidden = true;
    backendStatusEl.textContent = "";
    return;
  }
  backendStatusEl.textContent = text;
  backendStatusEl.hidden = false;
}

function getStateEndpoint() {
  const { origin, pathname } = window.location;

  let basePath;
  if (pathname.endsWith("/")) {
    basePath = pathname;
  } else if (pathname.endsWith(".html")) {
    basePath = pathname.slice(0, pathname.lastIndexOf("/") + 1);
  } else {
    basePath = `${pathname}/`;
  }

  return `${origin}${basePath}api/state`;
}
