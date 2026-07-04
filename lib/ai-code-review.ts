// Barrel module: re-exports the split AI modules.
// New code should import directly from:
//   - lib/ai-analyzer         → analyzeExecutionMode
//   - lib/ai-reviewer         → reviewCode
//   - lib/ai-test-suggestions → suggestTestCases
//
// This file exists for backwards-compatibility with existing imports of
// `analyzeCode` / `generateTestCases`. They are kept as thin shims.

export {
  analyzeExecutionMode,
  type ExecutionMode,
  type ExecutionModeAnalysis,
  type AnalyzeModeInput,
} from "./ai-analyzer";

export {
  reviewCode,
  type CodeReview,
  type CorrectnessVerdict,
  type ReviewInput,
} from "./ai-reviewer";

export {
  suggestTestCases,
  type ProposedTestCase,
  type SuggestTestsInput,
} from "./ai-test-suggestions";

import { analyzeExecutionMode } from "./ai-analyzer";
import { reviewCode } from "./ai-reviewer";
import { suggestTestCases } from "./ai-test-suggestions";

/**
 * @deprecated Use `reviewCode` from "./ai-reviewer" instead.
 */
export async function analyzeCode(input: {
  problem: string;
  language: string;
  sourceCode: string;
  executionStatus: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}) {
  return reviewCode(input);
}

/**
 * @deprecated Use `suggestTestCases` from "./ai-test-suggestions" instead.
 */
export async function generateTestCases(input: {
  problem: string;
  language: string;
  sourceCode: string;
  count?: number;
}) {
  return suggestTestCases(input);
}

// Side-effect imports to keep the analyzer wired even when only this barrel
// is imported. (No-op at runtime — the symbols are already exported above.)
void analyzeExecutionMode;
void reviewCode;
void suggestTestCases;