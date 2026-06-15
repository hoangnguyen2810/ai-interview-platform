import { NextResponse } from "next/server";
import { forbidden, getAuthUserFromRequest, unauthorized } from "@/lib/auth";
import { ValidationError, validateCreateInterviewPayload } from "./dto";
import { createInterviewForRecruiter } from "./service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // 1. Auth: chỉ recruiter mới tạo được phòng phỏng vấn
    const auth = getAuthUserFromRequest(req);
    if (!auth) return unauthorized();
    if (auth.role !== "RECRUITER") {
      return forbidden("Chỉ tài khoản Recruiter mới tạo được phòng phỏng vấn");
    }

    // 2. Parse + validate body
    const raw = await req.json().catch(() => null);
    if (raw === null) {
      return NextResponse.json(
        { success: false, message: "Body phải là JSON hợp lệ" },
        { status: 400 },
      );
    }

    let input;
    try {
      input = validateCreateInterviewPayload(raw);
    } catch (e) {
      if (e instanceof ValidationError) {
        return NextResponse.json(
          { success: false, message: e.message, field: e.field },
          { status: 400 },
        );
      }
      throw e;
    }

    // 3. Tạo interview + thêm host trong transaction
    const interview = await createInterviewForRecruiter(auth.id, input);

    return NextResponse.json(
      {
        success: true,
        message: "Tạo phòng phỏng vấn thành công",
        interview,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/interviews ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Lỗi máy chủ",
      },
      { status: 500 },
    );
  }
}
