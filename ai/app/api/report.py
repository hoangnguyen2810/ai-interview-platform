"""Generate a structured interview report.

Endpoint: POST /report/generate

Receives candidate context (CV markdown + analysis) and coding analysis
(text already aggregated by the Next.js side from `ai_reviews` table),
then asks the local Ollama model to fill in a fixed 8-section schema.

The schema matches CHAT_PROMPT rule 8:
    - candidate_name
    - position
    - summary
    - strengths
    - weaknesses
    - skill_evaluation
    - improvement_suggestions
    - hiring_conclusion

Output is JSON ONLY (no markdown, no preamble). The Next.js side stores the
parsed object in `interview_reports.content` (JSONB) and snapshot text in
`coding_analysis_snapshot`.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json

from app.core.ollama import chat

router = APIRouter()

REPORT_MODEL = "qwen2.5:3b-instruct"

REPORT_SYSTEM_PROMPT = """Bạn là AI HR chuyên tổng hợp báo cáo phỏng vấn lập trình viên.

Dựa trên:
- Thông tin ứng viên (CV đã upload và phân tích CV trước đó)
- Phân tích kỹ thuật (coding analysis từ AI code review)

Hãy tạo báo cáo bằng tiếng Việt theo ĐÚNG cấu trúc JSON sau (không markdown, không giải thích thêm):

{
  "candidate_name": "<tên ứng viên, hoặc 'Không đề cập' nếu không có>",
  "position": "<vị trí ứng tuyển, hoặc 'Không đề cập'>",
  "summary": "<tóm tắt ngắn gọn 2-4 câu về ứng viên>",
  "strengths": "<3-5 gạch đầu dòng về điểm mạnh>",
  "weaknesses": "<3-5 gạch đầu dòng về điểm yếu>",
  "skill_evaluation": "<đánh giá kỹ năng kỹ thuật dựa trên coding analysis, 3-6 dòng>",
  "improvement_suggestions": "<đề xuất cải thiện, 3-5 gạch đầu dòng>",
  "hiring_conclusion": "<kết luận tuyển dụng: MẠNH / PHÙ HỢP / CÂN NHẮC / KHÔNG PHÙ HỢP + 1-2 câu giải thích>"
}

QUY TẮC:
- Chỉ trả về DUY NHẤT một JSON object hợp lệ, không có markdown, không có giải thích trước/sau.
- Chỉ sử dụng thông tin được cung cấp, không tự suy diễn.
- Nếu thiếu thông tin cho section nào, ghi "Không đề cập".
"""


class ReportRequest(BaseModel):
    cv_filename: str = ""
    cv_analysis: str = ""
    coding_analysis: str = ""
    candidate_name: str = ""
    position: str = ""


def _extract_json_object(raw: str) -> dict | None:
    """Try to parse a JSON object from the model output.

    Models sometimes wrap JSON in ```json ... ``` fences or add stray prose.
    We find the first '{' and the matching '}' and parse that substring.
    """
    if not raw:
        return None

    text = raw.strip()

    # Strip markdown fences if present.
    if text.startswith("```"):
        # remove opening fence (with optional language tag)
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1 :]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass

    # Fallback: locate first '{' and last '}'
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            obj = json.loads(text[start : end + 1])
            if isinstance(obj, dict):
                return obj
        except Exception:
            pass

    return None


def _try_repair_truncated_json(raw: str) -> dict | None:
    """Best-effort repair for Ollama outputs that got cut mid-string/array/object.

    Strategy: scan char-by-char tracking JSON state (in_string, escaped, depth
    of `{` and `[`). When the string ends without proper close, append the
    minimal closing characters so json.loads can succeed. This recovers the
    well-formed prefix that the model produced before the truncation.
    """
    if not raw:
        return None

    text = raw.strip()
    # Drop markdown fences if any.
    if text.startswith("```"):
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1 :]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    start = text.find("{")
    if start == -1:
        return None
    fragment = text[start:]

    out: list[str] = []
    in_string = False
    escape = False
    brace_depth = 0
    bracket_depth = 0
    trailing_comma = False  # last non-space char was ',' — strip if we close here

    for ch in fragment:
        out.append(ch)
        if escape:
            escape = False
            trailing_comma = False
            continue
        if ch == "\\":
            escape = True
            trailing_comma = False
            continue
        if ch == '"':
            in_string = not in_string
            trailing_comma = False
            continue
        if in_string:
            continue
        if ch == "{":
            brace_depth += 1
            trailing_comma = False
        elif ch == "}":
            brace_depth -= 1
            trailing_comma = False
        elif ch == "[":
            bracket_depth += 1
            trailing_comma = False
        elif ch == "]":
            bracket_depth -= 1
            trailing_comma = False
        elif ch == ",":
            trailing_comma = True
        elif not ch.isspace():
            trailing_comma = False

    repaired = "".join(out)
    # Trim trailing comma (and surrounding whitespace) before closing — JSON
    # doesn't allow a trailing comma before `}` or `]`.
    repaired = repaired.rstrip()
    if repaired.endswith(","):
        repaired = repaired[:-1].rstrip()

    # Close any unterminated string first.
    if in_string:
        repaired += '"'

    # Close open arrays then open objects in reverse order.
    repaired += "]" * max(bracket_depth, 0)
    repaired += "}" * max(brace_depth, 0)

    try:
        obj = json.loads(repaired)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass
    return None


@router.post("/report/generate")
def generate_report(req: ReportRequest):
    user_message_parts = []

    if req.candidate_name:
        user_message_parts.append(f"Tên ứng viên: {req.candidate_name}")
    if req.position:
        user_message_parts.append(f"Vị trí ứng tuyển: {req.position}")
    if req.cv_filename:
        user_message_parts.append(f"Tên file CV: {req.cv_filename}")
    if req.cv_analysis:
        user_message_parts.append(
            f"Phân tích CV (từ AI trước đó):\n{req.cv_analysis}"
        )
    if req.coding_analysis:
        user_message_parts.append(
            f"Phân tích coding (tổng hợp từ các bài submit):\n{req.coding_analysis}"
        )

    if not user_message_parts:
        raise HTTPException(
            status_code=400,
            detail="Không có dữ liệu đầu vào (CV hoặc coding analysis) để sinh báo cáo.",
        )

    user_message = "\n\n---\n\n".join(user_message_parts)

    try:
        response = chat(
            model=REPORT_MODEL,
            prompt=REPORT_SYSTEM_PROMPT,
            message=user_message,
        )
        raw = response["message"]["content"]
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi gọi Ollama: {e}",
        )

    parsed = _extract_json_object(raw)
    if not parsed:
        # Last-resort: Ollama sometimes truncates output mid-string when the
        # prompt is large (e.g. nhiều coding reviews ở lần generate thứ 2).
        # We attempt to repair by closing any open string/array/object and
        # re-parsing, instead of failing outright with 502.
        parsed = _try_repair_truncated_json(raw)

    if not parsed:
        # Surface the raw output so Next.js side can store it for debugging.
        raise HTTPException(
            status_code=502,
            detail=f"AI trả về không phải JSON hợp lệ. Raw: {raw[:1000]}",
        )

    # Ensure all 8 keys exist (fill with default text if missing).
    defaults = {
        "candidate_name": "Không đề cập",
        "position": "Không đề cập",
        "summary": "Không đề cập",
        "strengths": "Không đề cập",
        "weaknesses": "Không đề cập",
        "skill_evaluation": "Không đề cập",
        "improvement_suggestions": "Không đề cập",
        "hiring_conclusion": "Không đề cập",
    }
    for key, default in defaults.items():
        if not parsed.get(key):
            parsed[key] = default

    return {
        "success": True,
        "model": REPORT_MODEL,
        "report": parsed,
        "raw": raw,
    }