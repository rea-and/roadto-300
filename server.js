const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 9000);
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

const DEFAULT_STATE = {
  days: {},
  challengeStart: isoToday(),
  updatedAt: new Date().toISOString(),
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

    if (url.pathname === "/api/state") {
      await handleStateApi(req, res);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    await serveStatic(url.pathname, res, req.method);
  } catch (err) {
    console.error("Unhandled server error:", err);
    sendJson(res, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, HOST, async () => {
  await ensureStateFile();
  console.log(`RoadTo-300 server running at http://${HOST}:${PORT}`);
});

async function handleStateApi(req, res) {
  if (req.method === "GET") {
    const state = await readState();
    sendJson(res, 200, state);
    return;
  }

  if (req.method === "PUT") {
    const body = await readRequestBody(req);
    const parsed = safeParseJson(body);
    if (!parsed || typeof parsed !== "object") {
      sendJson(res, 400, { error: "Invalid JSON payload" });
      return;
    }

    const merged = {
      ...DEFAULT_STATE,
      ...parsed,
      days: parsed.days && typeof parsed.days === "object" ? parsed.days : {},
      challengeStart:
        typeof parsed.challengeStart === "string" && parsed.challengeStart
          ? parsed.challengeStart
          : firstTrackedDay(parsed.days) || isoToday(),
      updatedAt: new Date().toISOString(),
    };

    await writeState(merged);
    sendJson(res, 200, { ok: true, updatedAt: merged.updatedAt });
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
}

async function serveStatic(pathname, res, method) {
  let requestPath = pathname === "/" ? "/index.html" : pathname;
  requestPath = decodeURIComponent(requestPath);

  const normalizedPath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const safeRelativePath = normalizedPath.replace(/^[/\\]+/, "");
  const absolutePath = path.join(ROOT_DIR, safeRelativePath);
  if (!absolutePath.startsWith(ROOT_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const file = await fs.readFile(absolutePath);
    const ext = path.extname(absolutePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    if (method === "GET") {
      res.end(file);
      return;
    }
    res.end();
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
}

async function ensureStateFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STATE_FILE);
  } catch {
    await writeState(DEFAULT_STATE);
  }
}

async function readState() {
  await ensureStateFile();
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = safeParseJson(raw);
    if (parsed && typeof parsed === "object" && parsed.days) {
      return parsed;
    }
    return DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

async function writeState(state) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmpPath = `${STATE_FILE}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await fs.rename(tmpPath, STATE_FILE);
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  res.end(body);
}

function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}

function isoToday() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function firstTrackedDay(daysMap) {
  if (!daysMap || typeof daysMap !== "object") {
    return null;
  }
  const keys = Object.keys(daysMap).sort();
  return keys[0] || null;
}
