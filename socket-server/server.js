/**
 * NeuralCode Socket.IO Server
 * Runs standalone on port 3001 (separate from Next.js on 3000)
 *
 * Events:
 *  - question:added   {id, title, description, difficulty}
 *  - question:activated {id, title, description, difficulty}
 *
 * HTTP endpoints (for Next.js API to call):
 *  - POST /emit/question-added   {meetingCode, question}
 *  - POST /emit/question-activated {meetingCode, question}
 *  - GET  /health
 */

const { Server } = require("socket.io");
const http = require("http");
const url = require("url");

const PORT = process.env.SOCKET_PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// ─── Create HTTP server + Socket.IO ────────────────────────────────────────────

const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ─── Socket.IO connection handler ──────────────────────────────────────────────

io.on("connection", (socket) => {
  const meetingCode = socket.handshake.query.meetingCode || "";
  console.log(`[Socket.IO] Connected: ${socket.id} | meeting: "${meetingCode}"`);

  if (meetingCode) {
    socket.join(meetingCode);
    console.log(`[Socket.IO] ${socket.id} joined room: ${meetingCode}`);
  }

  socket.on("disconnect", () => {
    console.log(`[Socket.IO] Disconnected: ${socket.id}`);
  });
});

// ─── Emit helpers (called from HTTP endpoints below) ───────────────────────────

function emitQuestionAdded(meetingCode, question) {
  io.to(meetingCode).emit("question:added", question);
  console.log(`[Socket.IO] → question:added | room: ${meetingCode} | q: ${question.title}`);
}

function emitQuestionActivated(meetingCode, question) {
  io.to(meetingCode).emit("question:activated", question);
  console.log(`[Socket.IO] → question:activated | room: ${meetingCode} | q: ${question.title}`);
}

// ─── HTTP endpoint handler ─────────────────────────────────────────────────────

httpServer.on("request", (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method;

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": CLIENT_URL,
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    });
    res.end();
    return;
  }

  // ── POST /emit/question-added ────────────────────────────────────────────────
  if (pathname === "/emit/question-added" && method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { meetingCode, question } = JSON.parse(body);
        if (!meetingCode || !question) {
          res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": CLIENT_URL });
          res.end(JSON.stringify({ error: "missing meetingCode or question" }));
          return;
        }
        emitQuestionAdded(meetingCode, question);
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": CLIENT_URL });
        res.end(JSON.stringify({ success: true }));
      } catch {
        res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": CLIENT_URL });
        res.end(JSON.stringify({ error: "parse error" }));
      }
    });
    return;
  }

  // ── POST /emit/question-activated ────────────────────────────────────────────
  if (pathname === "/emit/question-activated" && method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { meetingCode, question } = JSON.parse(body);
        if (!meetingCode || !question) {
          res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": CLIENT_URL });
          res.end(JSON.stringify({ error: "missing meetingCode or question" }));
          return;
        }
        emitQuestionActivated(meetingCode, question);
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": CLIENT_URL });
        res.end(JSON.stringify({ success: true }));
      } catch {
        res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": CLIENT_URL });
        res.end(JSON.stringify({ error: "parse error" }));
      }
    });
    return;
  }

  // ── GET /health ──────────────────────────────────────────────────────────────
  if (pathname === "/health" && method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": CLIENT_URL });
    res.end(JSON.stringify({ status: "ok", connections: io.engine.clientsCount }));
    return;
  }

  // 404
  res.writeHead(404);
  res.end();
});

// ─── Start ─────────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`[Socket.IO] Server ready on http://localhost:${PORT}`);
  console.log(`[Socket.IO] CORS origin: ${CLIENT_URL}`);
});
