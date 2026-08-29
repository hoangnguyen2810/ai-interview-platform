// Sandbox Service - HTTP Server for Code Execution
// Provides REST API for running code in Docker containers

const { executeCode, healthCheck } = require("./index.js");
const http = require("http");
const url = require("url");

const PORT = process.env.SANDBOX_PORT || 3002;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const ALLOWED_LANGUAGES = ["python", "javascript", "java", "cpp"];
const { attachWs } = require("./wsServer.js");

// ─── CORS ───────────────────────────────────────────────────────────────────────

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", CLIENT_URL);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

// ─── Health endpoint ─────────────────────────────────────────────────────────

async function handleHealth(req, res) {
  setCors(res);
  const health = await healthCheck();
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(health));
}

// ─── Execute endpoint ─────────────────────────────────────────────────────────

async function handleExecute(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    try {
      const payload = JSON.parse(body);

      if (!payload.code || typeof payload.code !== "string") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing or invalid 'code' field" }));
        return;
      }

      if (!payload.language || !ALLOWED_LANGUAGES.includes(payload.language)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: `Invalid language. Allowed: ${ALLOWED_LANGUAGES.join(", ")}`,
          }),
        );
        return;
      }

      const result = await executeCode({
        code: payload.code,
        language: payload.language,
        stdin: payload.stdin || "",
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error("[Sandbox] Execute error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Execution failed",
          details: err.message,
        }),
      );
    }
  });
}

// ─── Router ───────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // Health check
  if (pathname === "/health") {
    return handleHealth(req, res);
  }

  // Execute code
  if (pathname === "/execute") {
    return handleExecute(req, res);
  }

  // Not found
  setCors(res);
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`[Sandbox] Service ready on http://localhost:${PORT}`);
  console.log(`[Sandbox] Allowed languages: ${ALLOWED_LANGUAGES.join(", ")}`);
});

attachWs(server);
console.log(`[Sandbox] WebSocket ready on ws://localhost:${PORT}/ws/execute`);

module.exports = { server };
