// wsServer.js
// WebSocket gateway cho live coding tương tác — path: /ws/execute

const { WebSocketServer } = require("ws");
const {
  createSession,
  writeToSession,
  resizeSession,
  killSession,
  stopStatsPolling,
  getExecStats,
} = require("./interactiveSession.js");

const CLIENT_ORIGIN = process.env.CLIENT_URL || "http://localhost:3000";
const MARKER_PREFIX = "__SBX_EXIT__:";
const EXIT_MARKER_REGEX = /__SBX_EXIT__:(-?\d+)\s*/;

function pendingMarkerPrefixLen(str) {
  const maxLen = Math.min(str.length, MARKER_PREFIX.length - 1);
  for (let len = maxLen; len > 0; len--) {
    if (str.slice(-len) === MARKER_PREFIX.slice(0, len)) return len;
  }
  return 0;
}

function attachWs(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/execute" });

  wss.on("connection", (ws, req) => {
    if (req.headers.origin && req.headers.origin !== CLIENT_ORIGIN) {
      ws.close(4003, "Forbidden origin");
      return;
    }

    const { searchParams } = new URL(req.url, "http://localhost");
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      ws.close(4000, "Missing sessionId");
      return;
    }

    let initialized = false;
    let pending = "";

    ws.on("message", async (raw) => {
      let parsed;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (parsed.type === "init") {
        if (initialized) return;
        initialized = true;

        try {
          const entry = await createSession({
            sessionId,
            code: parsed.code,
            language: parsed.language,
          });

          entry.stream.on("data", (chunk) => {
            pending += chunk.toString("utf8");

            const match = pending.match(EXIT_MARKER_REGEX);
            if (match) {
              const before = pending.slice(0, match.index);
              if (before && ws.readyState === ws.OPEN) {
                ws.send(Buffer.from(before, "utf8"));
              }

              stopStatsPolling(sessionId);
              const stats = getExecStats(sessionId);
              const runtimeMs = stats?.execStartedAt
                ? Date.now() - stats.execStartedAt
                : null;
              const memoryKb = stats?.peakMemoryBytes
                ? Math.round(stats.peakMemoryBytes / 1024)
                : null;

              console.log(
                "[ws] exit detected, stdin captured:",
                JSON.stringify(stats?.stdin),
              );

              if (ws.readyState === ws.OPEN) {
                ws.send(
                  JSON.stringify({
                    type: "exit",
                    code: parseInt(match[1], 10),
                    runtimeMs,
                    memoryKb,
                    stdin: stats?.stdin ?? "",
                  }),
                );
              }

              const after = pending.slice(match.index + match[0].length);
              if (after && ws.readyState === ws.OPEN) {
                ws.send(Buffer.from(after, "utf8"));
              }
              pending = "";
              return;
            }

            const holdLen = pendingMarkerPrefixLen(pending);
            const safeToSend = pending.slice(0, pending.length - holdLen);
            if (safeToSend && ws.readyState === ws.OPEN) {
              ws.send(Buffer.from(safeToSend, "utf8"));
            }
            pending = pending.slice(pending.length - holdLen);
          });

          entry.stream.on("error", () => {
            if (ws.readyState === ws.OPEN) ws.close();
          });
        } catch (e) {
          ws.send(JSON.stringify({ type: "error", message: e.message }));
          ws.close();
        }
        return;
      }

      if (!initialized) return;

      if (parsed.type === "input") {
        writeToSession(sessionId, parsed.data);
      } else if (parsed.type === "resize") {
        resizeSession(sessionId, parsed.cols, parsed.rows);
      }
    });

    ws.on("close", () => {
      killSession(sessionId);
    });

    ws.on("error", () => {
      killSession(sessionId);
    });
  });
}

module.exports = { attachWs };
