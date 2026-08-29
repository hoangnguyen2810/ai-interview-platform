// interactiveSession.js
// Quản lý các Docker container "sống" cho phiên live coding tương tác (pty)

const Docker = require("dockerode");
const { writeFileSync, mkdirSync, rmSync } = require("fs");
const { join } = require("path");

const docker = new Docker({
  socketPath:
    process.platform === "win32"
      ? "//./pipe/docker_engine"
      : "/var/run/docker.sock",
});

const LANGUAGE_CONFIG = {
  python: {
    image: "python:3.11-alpine",
    filename: "solution.py",
    runCmd: "python /app/solution.py",
  },
  javascript: {
    image: "node:22-alpine",
    filename: "solution.js",
    runCmd: "node /app/solution.js",
  },
  java: {
    image: "eclipse-temurin:21-jdk",
    filename: "Solution.java",
    runCmd: "javac /app/Solution.java && java -cp /app Solution",
  },
  cpp: {
    image: "gcc:14",
    filename: "solution.cpp",
    runCmd:
      "g++ -std=c++17 /app/solution.cpp -o /app/solution && /app/solution",
  },
};

const sessions = new Map(); // sessionId -> { container, stream, tempDir, ... }

const IDLE_MS = 5 * 60 * 1000;
const HARD_MS = 30 * 60 * 1000;
const STATS_POLL_MS = 300;

// ─── Docker call queue ─────────────────────────────────────────────────────
// Đảm bảo KHÔNG BAO GIỜ có 2 lệnh Docker (createContainer/attach/kill/remove)
// chạy chồng lấn nhau. Đây là nguyên nhân gây ra lỗi "chạy liên tục thì bị":
// khi bấm Run dồn dập, container cũ đang bị kill/remove (async, chưa xong)
// trong lúc container mới đang được create/attach — trên named pipe Windows,
// 2 request chồng nhau có thể làm response của request này lẫn vào luồng dữ
// liệu của request kia, khiến JSON options bị ghi nhầm vào stdin container mới.
let dockerQueue = Promise.resolve();
function runQueued(fn) {
  const result = dockerQueue.then(fn, fn);
  dockerQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function createSession({ sessionId, code, language }) {
  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    throw new Error("Unsupported language");
  }

  if (sessions.has(sessionId)) {
    throw new Error("Session already exists");
  }

  const tempDir = join(process.cwd(), "tmp", sessionId);
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(join(tempDir, config.filename), code);

  const { container, stream } = await runQueued(async () => {
    const container = await docker.createContainer({
      Image: config.image,
      Cmd: ["/bin/sh"],
      Tty: true,
      OpenStdin: true,
      StdinOnce: false,
      HostConfig: {
        Binds: [`${tempDir}:/app:rw`],
        Memory: 256 * 1024 * 1024,
        NanoCpus: 500000000,
        NetworkMode: "none",
        AutoRemove: false,
        CapDrop: ["ALL"],
        PidsLimit: 64,
        SecurityOpt: ["no-new-privileges"],
      },
      WorkingDir: "/app",
    });

    await container.start();

    const stream = await container.attach({
      stream: true,
      stdin: true,
      stdout: true,
      stderr: true,
      hijack: true,
    });

    return { container, stream };
  });

  const entry = {
    container,
    stream,
    tempDir,
    execStartedAt: null,
    peakMemoryBytes: 0,
    statsPollTimer: null,
  };
  entry.idleTimer = setTimeout(() => killSession(sessionId), IDLE_MS);
  entry.hardTimer = setTimeout(() => killSession(sessionId), HARD_MS);
  sessions.set(sessionId, entry);

  entry.execStartedAt = Date.now();
  entry.statsPollTimer = setInterval(async () => {
    try {
      const statsData = await container.stats({ stream: false });
      const usage = statsData?.memory_stats?.usage || 0;
      if (usage > entry.peakMemoryBytes) entry.peakMemoryBytes = usage;
    } catch {
      // container có thể vừa thoát/bị xoá giữa 2 lần poll — bỏ qua
    }
  }, STATS_POLL_MS);

  // Chạy code — chờ 1 nhịp nhỏ để chắc chắn hijacked socket đã sẵn sàng nhận
  // input trước khi ghi lệnh vào, tránh ghi quá sớm ngay sau khi attach() resolve.
  await new Promise((resolve) => setTimeout(resolve, 50));
  stream.write(`${config.runCmd}; echo "__SBX_EXIT__:$?"\n`);

  return entry;
}

function writeToSession(sessionId, data) {
  const entry = sessions.get(sessionId);
  if (!entry) return false;
  touchActivity(sessionId);
  entry.stream.write(data);
  return true;
}

function resizeSession(sessionId, cols, rows) {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  entry.container.resize({ h: rows, w: cols }).catch(() => {});
}

function touchActivity(sessionId) {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  clearTimeout(entry.idleTimer);
  entry.idleTimer = setTimeout(() => killSession(sessionId), IDLE_MS);
}

function stopStatsPolling(sessionId) {
  const entry = sessions.get(sessionId);
  if (!entry || !entry.statsPollTimer) return;
  clearInterval(entry.statsPollTimer);
  entry.statsPollTimer = null;
}

function getExecStats(sessionId) {
  const entry = sessions.get(sessionId);
  if (!entry) return null;
  return {
    execStartedAt: entry.execStartedAt,
    peakMemoryBytes: entry.peakMemoryBytes,
  };
}

async function killSession(sessionId) {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  sessions.delete(sessionId); // xoá khỏi map ngay để tránh double-kill
  clearTimeout(entry.idleTimer);
  clearTimeout(entry.hardTimer);
  if (entry.statsPollTimer) clearInterval(entry.statsPollTimer);

  await runQueued(async () => {
    try {
      await entry.container.kill();
    } catch {
      // container có thể đã thoát sẵn — bỏ qua
    }
    try {
      await entry.container.remove({ force: true });
    } catch {
      // đã bị xoá trước đó — bỏ qua
    }
  });

  try {
    rmSync(entry.tempDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

module.exports = {
  createSession,
  writeToSession,
  resizeSession,
  killSession,
  stopStatsPolling,
  getExecStats,
  sessions,
};
