// Code Reviewer — talks to Ollama (qwen2.5-coder:3b) and returns a structured
// evaluation of the candidate's source code: correctness verdict, algorithm
// notes, complexity, strengths/weaknesses, and a hint.
//
// This module ONLY generates text — it never compiles or executes code.
// Execution and runtime signal (if any) are passed in as `executionStatus` /
// `stdout` / `stderr` so the reviewer can ground its verdict when available.
//
// IMPORTANT: This module is independent of whether the program can be auto-run
// by the sandbox. The downstream route decides whether to factor in sandbox
// pass-rate into `correctnessScore` — the reviewer always returns an honest
// text verdict (PASS / PARTIAL / FAIL / CANNOT_RUN).

import { Ollama } from "ollama";

const MODEL = process.env.AI_REVIEW_MODEL || "qwen2.5-coder:3b";
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";

const ollama = new Ollama({ host: OLLAMA_HOST });

export type CorrectnessVerdict = "PASS" | "PARTIAL" | "FAIL" | "CANNOT_RUN";

const VALID_VERDICTS: readonly CorrectnessVerdict[] = [
  "PASS",
  "PARTIAL",
  "FAIL",
  "CANNOT_RUN",
];

export interface CodeReview {
  correctness: CorrectnessVerdict;
  algorithm: string;
  time_complexity: string;
  space_complexity: string;
  overall_score: number; // 0..10
  correctness_score: number; // 0..10
  algorithm_score: number; // 0..10
  strengths: string;
  weaknesses: string;
  hint: string;
}

const REVIEWER_SYSTEM_PROMPT = `Bạn là một reviewer code chuyên nghiệp cho các buổi phỏng vấn lập trình.
Nhiệm vụ: phân tích source code mà ứng viên đã nộp, so sánh với đề bài và kết quả thực thi (nếu có),
rồi trả về đánh giá dưới dạng JSON hợp lệ, không có markdown, không có chữ thừa.

Quy tắc:
- Chỉ trả về DUY NHẤT một object JSON, không giải thích trước/sau.
- "correctness" là một trong:
    - "PASS"        : thuật toán đúng, code clean, có thể chấp nhận được.
    - "PARTIAL"     : ý tưởng đúng nhưng còn bug / thiếu case biên / tối ưu kém.
    - "FAIL"        : sai hướng / sai thuật toán / không giải quyết được bài.
    - "CANNOT_RUN"  : chương trình có vẻ đúng về thuật toán NHƯNG không xác định được cách chạy thử
                      (hardcode giá trị, chỉ định nghĩa function không có driver, format I/O không rõ).
                      Trong trường hợp này KHÔNG được đánh FAIL vì không có bằng chứng runtime.
- Nếu executionStatus là TIMEOUT/RUNTIME_ERROR/COMPILE_ERROR thì "correctness_score" và "overall_score" phản ánh điều đó.
- "hint" là gợi ý ngắn gọn (1-3 câu) chỉ hướng giải quyết, KHÔNG đưa code đầy đủ. Nếu code đã tối ưu, để "hint" rỗng.
- "strengths" và "weaknesses" mỗi cái 1-3 gạch đầu dòng, ngăn cách bằng dấu chấm phẩy ";".
- "time_complexity" và "space_complexity" dùng Big-O, ví dụ "O(n)", "O(n log n)", "O(1)".

Schema JSON bắt buộc:
{
  "correctness": "PASS" | "PARTIAL" | "FAIL" | "CANNOT_RUN",
  "algorithm": "string",
  "time_complexity": "string",
  "space_complexity": "string",
  "overall_score": number 0-10,
  "correctness_score": number 0-10,
  "algorithm_score": number 0-10,
  "strengths": "string",
  "weaknesses": "string",
  "hint": "string"
}`;

function extractJsonObject(text: string): unknown | null {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

interface OllamaChatOptions {
  system: string;
  user: string;
}

async function ollamaChat({ system, user }: OllamaChatOptions): Promise<string> {
  const res = await ollama.chat({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    stream: false,
    options: {
      temperature: 0.2,
      num_predict: 1500,
    },
  });
  return res.message?.content ?? "";
}

export interface ReviewInput {
  problem: string;
  language: string;
  sourceCode: string;
  executionStatus: string; // PENDING | SUCCESS | RUNTIME_ERROR | ...
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionMode?: string; // "stdin" | "hardcoded" | "function" | "unknown"
}

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.max(0, Math.min(10, Math.round(n * 100) / 100));
}

function normalizeVerdict(value: unknown): CorrectnessVerdict {
  if (typeof value === "string") {
    const v = value.trim().toUpperCase();
    if ((VALID_VERDICTS as readonly string[]).includes(v)) {
      return v as CorrectnessVerdict;
    }
  }
  return "PARTIAL";
}

export async function reviewCode(input: ReviewInput): Promise<CodeReview> {
  const userPayload = `ĐỀ BÀI:
${input.problem}

NGÔN NGỮ: ${input.language}

EXECUTION MODE (do analyzer phân loại): ${input.executionMode ?? "unknown"}

SOURCE CODE ỨNG VIÊN:
\`\`\`${input.language}
${input.sourceCode}
\`\`\`

KẾT QUẢ THỰC THI (Docker sandbox, có thể trống nếu không auto-run được):
- status: ${input.executionStatus}
- exit_code: ${input.exitCode}
- stdout: ${input.stdout || "(trống)"}
- stderr: ${input.stderr || "(trống)"}

Hãy phân tích và trả về JSON.`;

  let raw: string;
  try {
    raw = await ollamaChat({
      system: REVIEWER_SYSTEM_PROMPT,
      user: userPayload,
    });
  } catch (e) {
    return {
      correctness: "PARTIAL",
      algorithm: `AI review không khả dụng: ${e instanceof Error ? e.message : String(e)}`,
      time_complexity: "unknown",
      space_complexity: "unknown",
      overall_score: 0,
      correctness_score: 0,
      algorithm_score: 0,
      strengths: "",
      weaknesses: "AI review không khả dụng.",
      hint: "",
    };
  }

  const parsed = extractJsonObject(raw) as Partial<CodeReview> | null;

  if (!parsed || typeof parsed !== "object") {
    return {
      correctness: "PARTIAL",
      algorithm: raw.slice(0, 500),
      time_complexity: "unknown",
      space_complexity: "unknown",
      overall_score: 5,
      correctness_score: 5,
      algorithm_score: 5,
      strengths: "—",
      weaknesses: "AI không trả về JSON hợp lệ.",
      hint: "",
    };
  }

  return {
    correctness: normalizeVerdict(parsed.correctness),
    algorithm: String(parsed.algorithm ?? "").slice(0, 2000),
    time_complexity: String(parsed.time_complexity ?? "unknown").slice(0, 50),
    space_complexity: String(parsed.space_complexity ?? "unknown").slice(0, 50),
    overall_score: clampScore(parsed.overall_score),
    correctness_score: clampScore(parsed.correctness_score),
    algorithm_score: clampScore(parsed.algorithm_score),
    strengths: String(parsed.strengths ?? "").slice(0, 2000),
    weaknesses: String(parsed.weaknesses ?? "").slice(0, 2000),
    hint: String(parsed.hint ?? "").slice(0, 2000),
  };
}