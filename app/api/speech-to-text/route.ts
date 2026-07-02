import { type NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const audioFile = formData.get("audio");
  if (!audioFile || typeof audioFile === "string") {
    return Response.json({ error: "No audio file" }, { status: 400 });
  }

  // Read as raw Blob to ensure proper serialization when forwarding
  const blob: Blob = audioFile as Blob;
  const arrayBuffer = await blob.arrayBuffer();
  const lang = formData.get("language");

  try {
    const backend = new FormData();
    backend.append("file", new File([arrayBuffer], "voice.webm", { type: blob.type || "audio/webm" }));
    if (typeof lang === "string") {
      backend.append("language", lang);
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
