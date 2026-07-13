// Client to call the AI report generator running in the Python service
// (ai/app/api/report.py). Used by the Next.js API route only — recruiter UI
// never calls this directly, it goes through /api/interviews/[meetingCode]/report.

export const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL || "http://localhost:8000";
export const REPORT_MODEL = "qwen2.5:3b-instruct";

export interface ReportInput {
  cv_filename?: string;
  cv_analysis?: string;
  coding_analysis?: string;
  candidate_name?: string;
  position?: string;
}

// 8 sections matching CHAT_PROMPT rule 8 / ai/app/api/report.py.
export interface ReportContent {
  candidate_name: string;
  position: string;
  summary: string;
  strengths: string;
  weaknesses: string;
  skill_evaluation: string;
  improvement_suggestions: string;
  hiring_conclusion: string;
}

export interface GeneratedReport {
  model: string;
  report: ReportContent;
  raw: string;
}

export async function generateReportViaAI(
  input: ReportInput,
  timeoutMs = 120_000,
): Promise<GeneratedReport> {
  const res = await fetch(`${AI_SERVICE_URL}/report/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cv_filename: input.cv_filename ?? "",
      cv_analysis: input.cv_analysis ?? "",
      coding_analysis: input.coding_analysis ?? "",
      candidate_name: input.candidate_name ?? "",
      position: input.position ?? "",
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `AI service ${res.status}: ${text.slice(0, 500)}`,
    );
  }

  const data = await res.json();

  if (!data?.success || !data?.report) {
    throw new Error("AI service trả về payload không hợp lệ");
  }

  return {
    model: data.model || REPORT_MODEL,
    report: data.report as ReportContent,
    raw: data.raw ?? "",
  };
}

// Aggregate coding analysis text from ai_reviews rows. Each row contributes
// its score/strengths/weaknesses/feedback so the report prompt has enough signal.
export function aggregateCodingAnalysis(
  reviews: Array<{
    submission_id: string;
    language: string | null;
    score: number | null;
    strengths: string | null;
    weaknesses: string | null;
    feedback: string | null;
  }>,
): string {
  if (!reviews.length) return "";

  const blocks = reviews.map((r, i) => {
    const parts: string[] = [`# Submission ${i + 1}`];
    if (r.language) parts.push(`Ngôn ngữ: ${r.language}`);
    if (r.score !== null && r.score !== undefined) {
      parts.push(`Điểm: ${r.score}/10`);
    }
    if (r.strengths) parts.push(`Điểm mạnh:\n${r.strengths}`);
    if (r.weaknesses) parts.push(`Điểm yếu:\n${r.weaknesses}`);
    if (r.feedback) parts.push(`Phản hồi:\n${r.feedback}`);
    return parts.join("\n");
  });

  return blocks.join("\n\n---\n\n");
}