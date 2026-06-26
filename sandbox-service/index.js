// Sandbox Service - Docker-based code execution
// Production-safe execution engine

import Docker from "dockerode";
import { randomUUID } from "crypto";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { PassThrough } from "stream";

const docker = new Docker({
  socketPath: "//./pipe/docker_engine", // Windows fix
});

const WORK_DIR = "/app";
const TIMEOUT_MS = 10000;

const LANGUAGE_CONFIG = {
  python: {
    image: "python:3.11-alpine",
    filename: "solution.py",
    runCmd: ["python", "/app/solution.py"],
  },

  javascript: {
    image: "node:22-alpine",
    filename: "solution.js",
    runCmd: ["node", "/app/solution.js"],
  },

  java: {
    image: "eclipse-temurin:21-jdk",
    filename: "Solution.java",
    compileCmd: ["javac", "/app/Solution.java"],
    runCmd: ["java", "-cp", "/app", "Solution"],
  },

  cpp: {
    image: "gcc:14",
    filename: "solution.cpp",
    compileCmd: [
      "g++",
      "-std=c++17",
      "/app/solution.cpp",
      "-o",
      "/app/solution",
    ],
    runCmd: ["/app/solution"],
  },
};

export async function executeCode({ code, language, stdin }) {
  const executionId = randomUUID();
  const startTime = Date.now();

  const config = LANGUAGE_CONFIG[language];

  if (!config) {
    return {
      success: false,
      stdout: "",
      stderr: "",
      runtimeMs: 0,
      exitCode: -1,
      error: "Unsupported language",
    };
  }

  const tempDir = join(process.cwd(), "tmp", executionId);
  mkdirSync(tempDir, { recursive: true });

  try {
    const filePath = join(tempDir, config.filename);
    writeFileSync(filePath, code);

    if (stdin) {
      writeFileSync(join(tempDir, "stdin.txt"), stdin);
    }

    const container = await docker.createContainer({
      Image: config.image,

      Cmd: [
        "/bin/sh",
        "-c",
        `
        set -e

        cp -r /app /workspace
        cd /workspace

        ${config.compileCmd ? config.compileCmd.join(" ") + " || exit 1" : ""}

        ${stdin ? `cat stdin.txt | ${config.runCmd.join(" ")}` : config.runCmd.join(" ")}
        `,
      ],

      HostConfig: {
        Binds: [`${tempDir}:/app:rw`],

        Memory: 256 * 1024 * 1024,
        NanoCpus: 500000000,

        NetworkMode: "none",
        AutoRemove: true,

        CapDrop: ["ALL"],
        PidsLimit: 64,
        SecurityOpt: ["no-new-privileges"],
      },

      AttachStdout: true,
      AttachStderr: true,
      Tty: false,

      WorkingDir: WORK_DIR,
    });

    await container.start();

    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();

    const stream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true,
    });

    docker.modem.demuxStream(stream, stdoutStream, stderrStream);

    let stdout = "";
    let stderr = "";

    stdoutStream.on("data", (d) => (stdout += d.toString()));
    stderrStream.on("data", (d) => (stderr += d.toString()));

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS),
    );

    const result = await Promise.race([container.wait(), timeout]);

    const { StatusCode } = result;

    if (StatusCode !== 0) {
      stderr += "\nProcess exited with error";
    }

    return {
      success: StatusCode === 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      runtimeMs: Date.now() - startTime,
      exitCode: StatusCode,
    };
  } catch (err) {
    return {
      success: false,
      stdout: "",
      stderr: err.message,
      runtimeMs: Date.now() - startTime,
      exitCode: -1,
      error: "SYSTEM_ERROR",
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function healthCheck() {
  try {
    await docker.ping();
    return { status: "ok", docker: true };
  } catch {
    return { status: "ok", docker: false };
  }
}
