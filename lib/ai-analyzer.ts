// Code Analyzer — talks to Ollama (qwen2.5-coder:3b) and classifies how the
// candidate's source code accepts input. This module ONLY classifies; it
// never reviews the algorithm and never runs the program.
//
// The four possible modes:
//   - "stdin":     program reads stdin (input(), sys.stdin, scanner.next, ...)
//   - "hardcoded": program returns a fixed value with no input handling
//   - "function":  only a function/class is defined; no top-level driver
//   - "unknown":   cannot reliably determine how to feed input
//
// The downstream `code-review` route uses `executionMode === "stdin"` as the
// gate that allows auto-running generated test cases. Anything else is
// surfaced to the recruiter as a manual review item.

import { Ollama } from "ollama";

const MODEL = process.env.AI_REVIEW_MODEL || "qwen2.5-coder:3b";
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";

const ollama = new Ollama({ host: OLLAMA_HOST });

export type ExecutionMode = "stdin" | "hardcoded" | "function" | "unknown";

const VALID_MODES: readonly ExecutionMode[] = [
  "stdin",
  "hardcoded",
  "function",
  "unknown",
];

export interface ExecutionModeAnalysis {
  executionMode: ExecutionMode;
  confidence: number; // 0..1
  reason: string;
  entryPoint: string;
  usesHardcodedValues: boolean;
}

const ANALYZER_SYSTEM_PROMPT = `Bạn là một analyzer chuyên phân loại cách chương trình nhận input.

Nhiệm vụ: đọc source code ứng viên và xác định chương trình nhận dữ liệu đầu vào như thế nào. Trả về DUY NHẤT một object JSON hợp lệ, không markdown, không giải thích thêm.

Phân loại:
- "stdin":     chương trình đọc stdin (input(), sys.stdin.read, Scanner, std::cin, readline, ...) và in kết quả ra stdout.
- "hardcoded": chương trình không đọc input, trả về giá trị cố định / dữ liệu mẫu.
- "function":  chỉ định nghĩa function/class, KHÔNG có top-level driver để chạy thử qua stdin/stdout.
- "unknown":   không đủ thông tin để xác định (ví dụ file quá ngắn, dùng framework khó đoán, ...).

Quy tắc:
- "confidence" là số 0..1 phản ánh mức độ chắc chắn.
- "entryPoint" là mô tả ngắn (1 câu) cách chương trình chạy (vd: "main() đọc 2 số từ stdin", "định nghĩa class Solution không có driver").
- "usesHardcodedValues" là true nếu có vẻ chương trình trả về giá trị cố định không phụ thuộc input.
- "reason" giải thích ngắn vì sao phân loại như vậy.

Schema JSON bắt buộc:
{
  "executionMode": "stdin" | "hardcoded" | "function" | "unknown",
  "confidence": number 0..1,
  "reason": "string",
  "entryPoint": "string",
  "usesHardcodedValues": boolean
}
  
QUAN TRỌNG: Nội dung text bên trong "reason" và "entryPoint" PHẢI viết bằng
TIẾNG VIỆT, kể cả khi code/đề bài đầu vào là tiếng Anh. Chỉ tên hàm, tên biến,
từ khóa kỹ thuật (input(), stdin, Scanner...) được giữ nguyên tiếng Anh.`;

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

async function ollamaChat({
  system,
  user,
}: OllamaChatOptions): Promise<string> {
  const res = await ollama.chat({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    stream: false,
    options: {
      temperature: 0.1,
      num_predict: 600,
    },
  });
  return res.message?.content ?? "";
}

export interface AnalyzeModeInput {
  problem: string;
  language: string;
  sourceCode: string;
}

function clampConfidence(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}

function normalizeMode(value: unknown): ExecutionMode {
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if ((VALID_MODES as readonly string[]).includes(v)) {
      return v as ExecutionMode;
    }
  }
  return "unknown";
}

export async function analyzeExecutionMode(
  input: AnalyzeModeInput,
): Promise<ExecutionModeAnalysis> {
  const userPayload = `ĐỀ BÀI (tham khảo, để biết input/output kỳ vọng):
${input.problem}

NGÔN NGỮ: ${input.language}

SOURCE CODE ỨNG VIÊN:
\`\`\`${input.language}
${input.sourceCode}
\`\`\`

Hãy phân tích và trả về JSON.`;

  let raw: string;
  try {
    raw = await ollamaChat({
      system: ANALYZER_SYSTEM_PROMPT,
      user: userPayload,
    });
  } catch (e) {
    return {
      executionMode: "unknown",
      confidence: 0,
      reason: `Analyzer không khả dụng: ${e instanceof Error ? e.message : String(e)}`,
      entryPoint: "",
      usesHardcodedValues: false,
    };
  }

  const parsed = extractJsonObject(
    raw,
  ) as Partial<ExecutionModeAnalysis> | null;

  if (!parsed || typeof parsed !== "object") {
    return {
      executionMode: "unknown",
      confidence: 0,
      reason:
        "AI analyzer không trả về JSON hợp lệ. Cần recruiter tự đánh giá.",
      entryPoint: "",
      usesHardcodedValues: false,
    };
  }

  return {
    executionMode: normalizeMode(parsed.executionMode),
    confidence: clampConfidence(parsed.confidence),
    reason: String(parsed.reason ?? "").slice(0, 1000),
    entryPoint: String(parsed.entryPoint ?? "").slice(0, 500),
    usesHardcodedValues: parsed.usesHardcodedValues === true,
  };
}
