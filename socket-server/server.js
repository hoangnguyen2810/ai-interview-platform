/**
 * NeuralCode Socket.IO Server
 * Runs standalone on port 3001 (separate from Next.js on 3000)
 *
 * Events:
 *  - question:added   {id, title, description, difficulty}
 *  - question:activated {id, title, description, difficulty}
 *  - question:updated  {id, title, description, difficulty}
 *  - question:removed  {questionId}
 *  - code:update       {code, language, cursorLine, cursorColumn}
 *  - submission:added  {submissionId, questionId, language, sourceCode, stdout, stderr, runtimeMs, status, success, createdAt, candidateName, ...}
 *
 * HTTP endpoints (for Next.js API to call):
 *  - POST /emit/question-added   {meetingCode, question}
 *  - POST /emit/question-activated {meetingCode, question}
 *  - POST /emit/code-update      {meetingCode, code, language, ...}
 *  - POST /emit/submission-added {meetingCode, submission}
 *  - GET  /health
 */

const { Server } = require("socket.io");
const http = require("http");
const url = require("url");

const SOCKET_PORT = process.env.SOCKET_PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || `http://localhost:${SOCKET_PORT}`;

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

  // ── code:update — relay code changes to everyone in the room ─────────────────
  socket.on("code:update", (payload) => {
    const mc = payload?.meetingCode || meetingCode;
    if (!mc || !payload?.code) return;
    io.to(mc).emit("code:update", {
      code: payload.code,
      language: payload.language,
      cursorLine: payload.cursorLine,
      cursorColumn: payload.cursorColumn,
    });
    console.log(`[Socket.IO] code:update relay | room: ${mc} | ${payload.code.length} chars`);
  });

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

function emitQuestionUpdated(meetingCode, question) {
  io.to(meetingCode).emit("question:updated", question);
  console.log(`[Socket.IO] → question:updated | room: ${meetingCode} | q: ${question.title}`);
}

function emitQuestionRemoved(meetingCode, questionId) {
  io.to(meetingCode).emit("question:removed", { questionId });
  console.log(`[Socket.IO] → question:removed | room: ${meetingCode} | qid: ${questionId}`);
}

function emitCodeUpdate(meetingCode, payload) {
  io.to(meetingCode).emit("code:update", payload);
  console.log(`[Socket.IO] → code:update | room: ${meetingCode} | ${payload.code.length} chars`);
}

function emitSubmissionAdded(meetingCode, submission) {
  io.to(meetingCode).emit("submission:added", submission);
  console.log(`[Socket.IO] → submission:added | room: ${meetingCode} | sid: ${submission.submissionId}`);
}

// ─── HTTP endpoint handler ─────────────────────────────────────────────────────

httpServer.on("request", (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method;

  // Skip Socket.IO internal requests (polling, upgrade, etc.)
  if (pathname.startsWith("/socket.io/")) return;

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

  // ── POST /emit/question-updated ─────────────────────────────────────────────
  if (pathname === "/emit/question-updated" && method === "POST") {
    handleQuestionUpdated(req, res);
    return;
  }

  // ── POST /emit/question-removed ─────────────────────────────────────────────
  if (pathname === "/emit/question-removed" && method === "POST") {
    handleQuestionRemoved(req, res);
    return;
  }

  // ── POST /emit/code-update ─────────────────────────────────────────────────
  if (pathname === "/emit/code-update" && method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { meetingCode, code, language, cursorLine, cursorColumn } = JSON.parse(body);
        if (!meetingCode || !code) {
          res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": CLIENT_URL });
          res.end(JSON.stringify({ error: "missing meetingCode or code" }));
          return;
        }
        emitCodeUpdate(meetingCode, { code, language, cursorLine, cursorColumn });
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": CLIENT_URL });
        res.end(JSON.stringify({ success: true }));
      } catch {
        res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": CLIENT_URL });
        res.end(JSON.stringify({ error: "parse error" }));
      }
    });
    return;
  }

  // ── POST /emit/submission-added ─────────────────────────────────────────────
  if (pathname === "/emit/submission-added" && method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const { meetingCode, submission } = JSON.parse(body);
        if (!meetingCode || !submission) {
          res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": CLIENT_URL });
          res.end(JSON.stringify({ error: "missing meetingCode or submission" }));
          return;
        }
        emitSubmissionAdded(meetingCode, submission);
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

// ─── question-updated ─────────────────────────────────────────────────────────
function handleQuestionUpdated(req, res) {
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
      emitQuestionUpdated(meetingCode, question);
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": CLIENT_URL });
      res.end(JSON.stringify({ success: true }));
    } catch {
      res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": CLIENT_URL });
      res.end(JSON.stringify({ error: "parse error" }));
    }
  });
}

// ─── question-removed ─────────────────────────────────────────────────────────
function handleQuestionRemoved(req, res) {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    try {
      const { meetingCode, questionId } = JSON.parse(body);
      if (!meetingCode || !questionId) {
        res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": CLIENT_URL });
        res.end(JSON.stringify({ error: "missing meetingCode or questionId" }));
        return;
      }
      emitQuestionRemoved(meetingCode, questionId);
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": CLIENT_URL });
      res.end(JSON.stringify({ success: true }));
    } catch {
      res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": CLIENT_URL });
      res.end(JSON.stringify({ error: "parse error" }));
    }
  });
}

// ─── Start ─────────────────────────────────────────────────────────────────────

httpServer.listen(SOCKET_PORT, () => {
  console.log(`[Socket.IO] Server ready on http://localhost:${SOCKET_PORT}`);
  console.log(`[Socket.IO] CORS origin: ${CLIENT_URL}`);
});
