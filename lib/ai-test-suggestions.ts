// AI Test Suggestions — generates edge test cases that the recruiter can
// review, edit, and run manually. This module is independent of whether the
// program can be auto-executed; suggestions are always produced so the
// recruiter has a starting point.

import { Ollama } from "ollama";

const MODEL = process.env.AI_REVIEW_MODEL || "qwen2.5-coder:3b";
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";

const ollama = new Ollama({ host: OLLAMA_HOST });

export interface ProposedTestCase {
  input: string;
  expected_output: string;
  description: string;
  edge_case_type: string; // "empty" | "single" | "large" | "negative" | "duplicate" | "overflow" | "boundary" | "random"
}

const TEST_CASES_SYSTEM_PROMPT = `Bạn là một kỹ sư kiểm thử chuyên nghiệp.
Nhiệm vụ: đọc đề bài + source code ứng viên và sinh ra các test case BIÊN (edge cases) mà recruiter có thể tham khảo / chỉnh sửa / chạy thử.
CHỈ sinh test, KHÔNG sửa code. Trả về DUY NHẤT một object JSON, không markdown.

Lưu ý:
- "input" là stdin sẽ được pipe vào chương trình (theo định dạng chuẩn của đề bài).
- "expected_output" là stdout kỳ vọng (recruiter có thể tự điều chỉnh).
- "description" mô tả ngắn test case, đặc biệt nhấn mạnh lý do kiểm tra (vd: "Kiểm tra chương trình có đọc input hay hardcode").
- "edge_case_type" một trong: "empty" | "single" | "large" | "negative" | "duplicate" | "overflow" | "boundary" | "random".
- Sinh tối đa 5 test case. Mỗi test phải thực sự khả thi với input/output được.
- Nếu đề bài không rõ định dạng I/O, hãy vẫn sinh test theo phỏng đoán hợp lý và mô tả rõ trong "description" để recruiter tự chỉnh.

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
      temperature: 0.3,
      num_predict: 1500,
    },
  });
  return res.message?.content ?? "";
}

export interface SuggestTestsInput {
  problem: string;
  language: string;
  sourceCode: string;
  executionMode?: string;
  count?: number; // cap; default 3, max 5
}

export async function suggestTestCases(
  input: SuggestTestsInput,
): Promise<ProposedTestCase[]> {
  const cap = Math.max(1, Math.min(5, input.count ?? 3));
  const userPayload = `ĐỀ BÀI:
${input.problem}

NGÔN NGỮ: ${input.language}

EXECUTION MODE (do analyzer phân loại): ${input.executionMode ?? "unknown"}

SOURCE CODE ỨNG VIÊN (để tham khảo cách nó đọc input / in output):
\`\`\`${input.language}
${input.sourceCode}
\`\`\`

Sinh tối đa ${cap} test case biên. Trả về JSON.`;

  let raw: string;
  try {
    raw = await ollamaChat({
      system: TEST_CASES_SYSTEM_PROMPT,
      user: userPayload,
    });
  } catch (e) {
    console.warn("[ai-test-suggestions] ollamaChat failed:", e);
    return [];
  }

  const parsed = extractJsonObject(raw) as { test_cases?: ProposedTestCase[] } | null;
  if (!parsed || !Array.isArray(parsed.test_cases)) return [];

  return parsed.test_cases
    .filter(
      (t) =>
        t &&
        typeof t.input === "string" &&
        typeof t.expected_output === "string",
    )
    .slice(0, cap)
    .map((t) => ({
      input: String(t.input),
      expected_output: String(t.expected_output),
      description: String(t.description ?? "").slice(0, 200),
      edge_case_type: String(t.edge_case_type ?? "random").slice(0, 50),
    }));
}