export async function POST(req: Request) {
  const AI_BACKEND = "http://127.0.0.1:8000";

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const sessionId = formData.get("session_id");

    if (!file || !(file instanceof File)) {
      return Response.json(
        { success: false, detail: "Không tìm thấy file." },
        { status: 400 },
      );
    }

    if (!sessionId || typeof sessionId !== "string") {
      return Response.json(
        { success: false, detail: "Thiếu session_id." },
        { status: 400 },
      );
    }

    // Re-pack into a new FormData to forward to Python backend
    const forwarded = new FormData();
    forwarded.append("file", file, file.name);
    forwarded.append("session_id", sessionId);

    const res = await fetch(`${AI_BACKEND}/cv/upload`, {
      method: "POST",
      body: forwarded,
    });

    const data = await res.json();

    if (!res.ok) {
      return Response.json(data, { status: res.status });
    }

    return Response.json(data);
  } catch (err) {
    return Response.json(
      { success: false, detail: "Không thể kết nối đến AI backend. Đảm bảo server AI đang chạy trên port 8000." },
      { status: 500 },
    );
  }
}
