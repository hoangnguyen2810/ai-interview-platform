// AI Code Review service
// Talks to Ollama (qwen2.5-coder:3b) and returns JSON-shaped analysis + test cases.
// This module ONLY generates text — it never compiles or executes code.
// Compilation and execution are delegated to the Docker sandbox.

import { Ollama } from "ollama";

const MODEL = process.env.AI_REVIEW_MODEL || "qwen2.5-coder:3b";
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";

const ollama = new Ollama({ host: OLLAMA_HOST });

export interface ProposedTestCase {
  input: string;
  expected_output: string;
  description: string;
  edge_case_type: string; // "empty" | "large" | "negative" | "duplicate" | "overflow" | ...
}

export interface CodeAnalysis {
  correctness: string; // PASS / PARTIAL / FAIL — empty when no execution to base it on
  algorithm: string; // free-form evaluation of approach
  time_complexity: string; // e.g. "O(n)"
  space_complexity: string; // e.g. "O(1)"
  overall_score: number; // 0–10
  correctness_score: number; // 0–10
  algorithm_score: number; // 0–10
  strengths: string;
  weaknesses: string;
  hint: string; // blank string when none
}

const ANALYSIS_SYSTEM_PROMPT = `Bạn là một reviewer code chuyên nghiệp cho các buổi phỏng vấn lập trình.
Nhiệm vụ: phân tích source code mà ứng viên đã nộp, so sánh với đề bài và kết quả thực thi (nếu có),
rồi trả về đánh giá dưới dạng JSON hợp lệ, không có markdown, không có chữ thừa.

Quy tắc:
- Chỉ trả về DUY NHẤT một object JSON, không giải thích trước/sau.
- Nếu ứng viên bị TIMEOUT/RUNTIME_ERROR/COMPILE_ERROR, "correctness_score" và "overall_score" nên phản ánh điều đó.
- "hint" phải là gợi ý ngắn gọn (1-3 câu) chỉ hướng giải quyết, KHÔNG đưa code đầy đủ.
- Nếu code đã tối ưu, để "hint" rỗng.
- "strengths" và "weaknesses" mỗi cái 1-3 gạch đầu dòng, ngăn cách bằng dấu chấm phẩy ";".
- "time_complexity" và "space_complexity" dùng Big-O, ví dụ "O(n)", "O(n log n)", "O(1)".

Schema JSON bắt buộc:
{
  "correctness": "PASS" | "PARTIAL" | "FAIL",
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

const TEST_CASES_SYSTEM_PROMPT = `Bạn là một kỹ sư kiểm thử chuyên nghiệp.
Nhiệm vụ: đọc đề bài + source code ứng viên và sinh ra các test case BIÊN (edge cases) để stress-test.
CHỈ sinh test, KHÔNG sửa code. Trả về DUY NHẤT một object JSON, không markdown.

Lưu ý:
- "input" là stdin sẽ được pipe vào chương trình (theo định dạng chuẩn của đề bài).
- "expected_output" là stdout kỳ vọng.
- "description" mô tả ngắn test case.
- "edge_case_type" một trong: "empty" | "single" | "large" | "negative" | "duplicate" | "overflow" | "boundary" | "random".
- Sinh tối đa 5 test case. Mỗi test phải thực sự khả thi với input/output được.
- Nếu đề bài không rõ định dạng I/O (ví dụ bài leetcode dùng class), hãy bọc code trong một hàm main() đọc stdin
  và in ra kết quả — chỉ sinh test case khi bạn chắc chắn format đúng.

Schema JSON bắt buộc:
{
  "test_cases": [
    {
      "input": "string",
      "expected_output": "string",
      "description": "string",
      "edge_case_type": "empty|single|large|negative|duplicate|overflow|boundary|random"
    }
  ]
}`;

function extractJsonObject(text: string): unknown | null {
  // Strip common markdown fences and find the first {...} block.
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to locate the first JSON object/array substring.
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
  signal?: AbortSignal;
}

async function ollamaChat({ system, user, signal }: OllamaChatOptions): Promise<string> {
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

  if (signal?.aborted) throw new Error("Aborted");
  return res.message?.content ?? "";
}

export interface AnalyzeInput {
  problem: string; // coding_questions.description
  language: string; // python | javascript | java | cpp
  sourceCode: string;
  executionStatus: string; // PENDING | SUCCESS | RUNTIME_ERROR | ...
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export async function analyzeCode(input: AnalyzeInput): Promise<CodeAnalysis> {
  const userPayload = `ĐỀ BÀI:\n${input.problem}\n\nNGÔN NGỮ: ${input.language}\n\nSOURCE CODE ỨNG VIÊN:\n\`\`\`${input.language}\n${input.sourceCode}\n\`\`\`\n\nKẾT QUẢ THỰC THI (Docker sandbox):\n- status: ${input.executionStatus}\n- exit_code: ${input.exitCode}\n- stdout: ${input.stdout || "(trống)"}\n- stderr: ${input.stderr || "(trống)"}\n\nHãy phân tích và trả về JSON.`;

  const raw = await ollamaChat({ system: ANALYSIS_SYSTEM_PROMPT, user: userPayload });
  const parsed = extractJsonObject(raw) as Partial<CodeAnalysis> | null;

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
    correctness: String(parsed.correctness ?? "PARTIAL"),
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

export async function generateTestCases(input: {
  problem: string;
  language: string;
  sourceCode: string;
}): Promise<ProposedTestCase[]> {
  const userPayload = `ĐỀ BÀI:\n${input.problem}\n\nNGÔN NGỮ: ${input.language}\n\nSOURCE CODE ỨNG VIÊN (để bạn tham khảo cách nó đọc input/in output):\n\`\`\`${input.language}\n${input.sourceCode}\n\`\`\`\n\nSinh test case biên (không được quá 5 test). Trả về JSON.`;

  const raw = await ollamaChat({ system: TEST_CASES_SYSTEM_PROMPT, user: userPayload });
  const parsed = extractJsonObject(raw) as { test_cases?: ProposedTestCase[] } | null;

  if (!parsed || !Array.isArray(parsed.test_cases)) return [];

  return parsed.test_cases
    .filter(
      (t) =>
        t &&
        typeof t.input === "string" &&
        typeof t.expected_output === "string",
    )
    .slice(0, 5)
    .map((t) => ({
      input: String(t.input),
      expected_output: String(t.expected_output),
      description: String(t.description ?? "").slice(0, 200),
      edge_case_type: String(t.edge_case_type ?? "random").slice(0, 50),
    }));
}

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.max(0, Math.min(10, Math.round(n * 100) / 100));
}
