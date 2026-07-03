import { type NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const audioFile = formData.get("file");
  if (!audioFile || typeof audioFile === "string") {
    return Response.json({ error: "No audio file" }, { status: 400 });
  }

  const blob: Blob = audioFile as Blob;
  const arrayBuffer = await blob.arrayBuffer();
  const lang = formData.get("language");
  const initialPrompt = formData.get("initial_prompt");

  try {
    const backend = new FormData();
    backend.append("file", new File([arrayBuffer], "voice.webm", { type: blob.type || "audio/webm" }));
    if (typeof lang === "string") {
      backend.append("language", lang);
    }
    if (typeof initialPrompt === "string" && initialPrompt.trim()) {
      backend.append("initial_prompt", initialPrompt.trim());
    }

    const res = await fetch("http://127.0.0.1:8000/speech-to-text", {
      method: "POST",
      body: backend,
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("[speech-to-text] FastAPI error:", res.status, json);
    }
    return Response.json(json ?? { error: "Invalid backend response" }, {
      status: res.status,
    });
  } catch (e) {
    return Response.json(
      { error: "Backend unreachable", detail: String(e) },
      { status: 502 },
    );
  }
}
