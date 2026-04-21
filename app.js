const STORAGE_KEY = "roadto300.daily.v1";
const STORAGE_BACKUP_KEY = "roadto300.daily.v1.backup";
const LEGACY_STORAGE_KEYS = ["trainiq.daily.v2", "trainiq.daily.v1"];
const CHALLENGE_DAYS = 90;
const CHALLENGE_TARGET_POINTS = 300;
const MAX_DAILY_POINTS = 5;

const trackerDefs = [
  {
    key: "gym",
    type: "numeric",
    weight: 25,
    targetId: "gymTarget",
    doneId: "gymDone",
    barId: "gymBar",
    textId: "gymText",
    label: "Gym",
  },
  {
    key: "strain",
    type: "numeric",
    weight: 25,
    targetId: "strainTarget",
    doneId: "strainDone",
    barId: "strainBar",
    textId: "strainText",
    label: "Strain",
  },
  {
    key: "carbFree",
    type: "numeric",
    weight: 25,
    targetId: "carbTarget",
    doneId: "carbDone",
    barId: "carbBar",
    textId: "carbText",
    label: "Carb-Free Meals",
  },
  {
    key: "supplements",
    type: "binary",
    weight: 25,
    takenId: "suppTaken",
    barId: "suppBar",
    textId: "suppText",
    label: "Supplements",
  },
];

const entryDate = document.getElementById("entryDate");
const scorePill = document.getElementById("scorePill");
const resetDayBtn = document.getElementById("resetDay");
const bestStreakEl = document.getElementById("bestStreak");
const currentStreakEl = document.getElementById("currentStreak");
const perfectDaysEl = document.getElementById("perfectDays");
const dailyBreakdownEl = document.getElementById("dailyBreakdown");
const weeklyListEl = document.getElementById("weeklyList");
const weekAvgEl = document.getElementById("weekAvg");
const weekPerfectEl = document.getElementById("weekPerfect");
const challengePointsEl = document.getElementById("challengePoints");
const daysLeftEl = document.getElementById("daysLeft");
const paceTextEl = document.getElementById("paceText");

const defaultData = {
  gym: { target: 1, done: 0 },
  strain: { target: 14, done: 0 },
  carbFree: { target: 3, done: 0 },
  supplements: { taken: false },
};

const state = loadState();
entryDate.value = todayISO();
hydrateDate();
bindEvents();
persistState();
updateUI();

function bindEvents() {
  entryDate.addEventListener("change", () => {
    hydrateDate();
    updateUI();
  });

  resetDayBtn.addEventListener("click", () => {
    if (!confirm(`Reset all values for ${entryDate.value}?`)) {
      return;
    }
    state.days[entryDate.value] = structuredClone(defaultData);
    persistState();
    hydrateDate();
    updateUI();
  });

  trackerDefs.forEach((def) => {
    if (def.type === "numeric") {
      const targetInput = document.getElementById(def.targetId);
      const doneInput = document.getElementById(def.doneId);
      [targetInput, doneInput].forEach((input) => {
        input.addEventListener("input", () => {
          syncToState();
          updateUI();
        });
      });
    }

    if (def.type === "binary") {
      document.getElementById(def.takenId).addEventListener("change", () => {
        syncToState();
        updateUI();
      });
    }
  });

  window.addEventListener("beforeunload", persistState);
  window.addEventListener("pagehide", persistState);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      persistState();
    }
  });
}

function hydrateDate() {
  const day = normalizeDay(state.days[entryDate.value] || structuredClone(defaultData));
  trackerDefs.forEach((def) => {
    const entry = day[def.key];
    if (def.type === "numeric") {
      document.getElementById(def.targetId).value = entry.target;
      document.getElementById(def.doneId).value = entry.done;
    }
    if (def.type === "binary") {
      document.getElementById(def.takenId).checked = !!entry.taken;
    }
  });
}

function syncToState() {
  const day = structuredClone(defaultData);

  trackerDefs.forEach((def) => {
    if (def.type === "numeric") {
      const target = asPositiveInt(document.getElementById(def.targetId).value, 1, 1);
      const done = asPositiveInt(document.getElementById(def.doneId).value, 0, 0);
      day[def.key] = { target, done };
      document.getElementById(def.targetId).value = target;
      document.getElementById(def.doneId).value = done;
    }

    if (def.type === "binary") {
      day[def.key] = { taken: document.getElementById(def.takenId).checked };
    }
  });

  state.days[entryDate.value] = day;
  persistState();
}

function updateUI() {
  const current = normalizeDay(state.days[entryDate.value] || structuredClone(defaultData));
  const totalScore = getDayPoints(current);

  trackerDefs.forEach((def) => {
    const item = current[def.key];
    const ratio = getTrackerRatio(def, item);
    const pct = Math.round(ratio * 100);

    document.getElementById(def.barId).style.width = `${pct}%`;
    document.getElementById(def.textId).textContent = getTrackerText(def, item);

    const card = document.querySelector(`[data-key="${def.key}"]`);
    card.classList.toggle("is-complete", ratio >= 1);
  });

  scorePill.textContent = `Today: ${totalScore.toFixed(2)} / ${MAX_DAILY_POINTS} points`;

  if (totalScore === MAX_DAILY_POINTS) {
    launchSparks();
  }

  const streak = computeStreaks();
  bestStreakEl.textContent = `${streak.best} days`;
  currentStreakEl.textContent = `${streak.current} days`;
  perfectDaysEl.textContent = String(streak.perfectDays);

  renderDailyBreakdown(current);
  renderWeeklyProgress(entryDate.value);
  renderChallengeProgress(entryDate.value);
}

function renderDailyBreakdown(dayData) {
  const rows = trackerDefs
    .map((def) => {
      const ratio = getTrackerRatio(def, dayData[def.key]);
      const pct = Math.round(ratio * 100);
      return `<div class="daily-row"><span>${def.label}</span><strong>${pct}%</strong><div class="mini-bar"><span style="width:${pct}%"></span></div></div>`;
    })
    .join("");

  dailyBreakdownEl.innerHTML = rows;
}

function renderWeeklyProgress(baseDate) {
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const dateKey = shiftDate(baseDate, -i);
    const dayData = normalizeDay(state.days[dateKey] || structuredClone(defaultData));
    const points = getDayPoints(dayData);
    days.push({ dateKey, points, perfect: points === MAX_DAILY_POINTS });
  }

  const avg = days.reduce((sum, day) => sum + day.points, 0) / days.length;
  const perfectCount = days.filter((day) => day.perfect).length;
  weekAvgEl.textContent = `Weekly avg: ${avg.toFixed(2)} / ${MAX_DAILY_POINTS}`;
  weekPerfectEl.textContent = `Perfect days: ${perfectCount} / 7`;

  weeklyListEl.innerHTML = days
    .map((day) => {
      const label = formatShortDate(day.dateKey);
      const width = Math.round((day.points / MAX_DAILY_POINTS) * 100);
      return `<div class="week-row"><span>${label}</span><strong>${day.points.toFixed(2)}</strong><div class="mini-bar"><span style="width:${width}%"></span></div></div>`;
    })
    .join("");
}

function renderChallengeProgress(referenceDate) {
  const start = state.challengeStart;
  const end = shiftDate(start, CHALLENGE_DAYS - 1);
  const ref = clampDate(referenceDate, start, end);
  const elapsed = Math.min(CHALLENGE_DAYS, daysBetween(start, ref) + 1);
  const left = CHALLENGE_DAYS - elapsed;

  let total = 0;
  for (let i = 0; i < elapsed; i += 1) {
    const dateKey = shiftDate(start, i);
    const dayData = normalizeDay(state.days[dateKey] || structuredClone(defaultData));
    total += getDayPoints(dayData);
  }

  const remaining = Math.max(0, CHALLENGE_TARGET_POINTS - total);
  const neededPerDay = left > 0 ? remaining / left : remaining;

  challengePointsEl.textContent = `${total.toFixed(2)} / ${CHALLENGE_TARGET_POINTS}`;
  daysLeftEl.textContent = String(left);
  paceTextEl.textContent = `${neededPerDay.toFixed(2)}/day`;
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

function getTrackerText(def, item) {
  if (def.type === "binary") {
    return item.taken ? "Taken" : "Not taken";
  }

  return `${item.done} / ${item.target}`;
}

function computeStreaks() {
  const dayKeys = Object.keys(state.days).sort();
  let best = 0;
  let current = 0;
  let run = 0;
  let perfectDays = 0;

  for (let i = 0; i < dayKeys.length; i += 1) {
    const dateKey = dayKeys[i];
    const isPerfect = isPerfectDay(normalizeDay(state.days[dateKey]));

    if (isPerfect) {
      perfectDays += 1;
      if (i === 0 || daysBetween(dayKeys[i - 1], dateKey) === 1) {
        run += 1;
      } else {
        run = 1;
      }
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  const sorted = dayKeys.slice().sort().reverse();
  for (let i = 0; i < sorted.length; i += 1) {
    const key = sorted[i];
    if (!isPerfectDay(normalizeDay(state.days[key]))) {
      break;
    }
    if (i === 0 || daysBetween(sorted[i], sorted[i - 1]) === 1) {
      current += 1;
    } else {
      break;
    }
  }

  return { best, current, perfectDays };
}

function isPerfectDay(dayData) {
  return getDayPoints(dayData) === MAX_DAILY_POINTS;
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
        target: asPositiveInt(source.target, day[def.key].target, 1),
        done: asPositiveInt(source.done, day[def.key].done, 0),
      };
    }

    if (def.type === "binary") {
      const legacyTaken = Number(source.done) >= Number(source.target || 1);
      day[def.key] = { taken: Boolean(source.taken ?? legacyTaken) };
    }
  });

  return day;
}

function daysBetween(dateA, dateB) {
  const a = new Date(`${dateA}T00:00:00Z`);
  const b = new Date(`${dateB}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

function clampDate(dateKey, minDate, maxDate) {
  if (dateKey < minDate) {
    return minDate;
  }
  if (dateKey > maxDate) {
    return maxDate;
  }
  return dateKey;
}

function shiftDate(dateKey, deltaDays) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

function formatShortDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function asPositiveInt(value, fallback, minValue) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(parsed, minValue);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function todayISO() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function loadState() {
  const candidates = [STORAGE_KEY, STORAGE_BACKUP_KEY, ...LEGACY_STORAGE_KEYS];
  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object" && parsed.days) {
        return {
          days: parsed.days,
          challengeStart: parsed.challengeStart || firstTrackedDay(parsed.days) || todayISO(),
        };
      }
    } catch (err) {
      console.error(`Could not load saved tracker state from ${key}`, err);
    }
  }

  return {
    days: { [todayISO()]: structuredClone(defaultData) },
    challengeStart: todayISO(),
  };
}

function persistState() {
  const snapshot = JSON.stringify({
    ...state,
    updatedAt: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEY, snapshot);
  localStorage.setItem(STORAGE_BACKUP_KEY, snapshot);
}

function firstTrackedDay(daysMap) {
  if (!daysMap || typeof daysMap !== "object") {
    return null;
  }
  const keys = Object.keys(daysMap).sort();
  return keys[0] || null;
}

let sparkLock = false;
function launchSparks() {
  if (sparkLock) {
    return;
  }
  sparkLock = true;

  const canvas = document.getElementById("sparkCanvas");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const pieces = Array.from({ length: 70 }, () => ({
    x: width * 0.5,
    y: height * 0.25,
    vx: (Math.random() - 0.5) * 9,
    vy: Math.random() * 4 + 2,
    size: Math.random() * 6 + 3,
    color: ["#8affc1", "#6ae5ff", "#ffc63d", "#ff4da8"][Math.floor(Math.random() * 4)],
    rot: Math.random() * Math.PI,
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, width, height);
    pieces.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.rot += 0.12;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    frame += 1;
    if (frame < 58) {
      requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, width, height);
      sparkLock = false;
    }
  }

  requestAnimationFrame(draw);
}
