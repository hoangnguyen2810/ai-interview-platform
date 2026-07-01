export async function POST(req: Request) {
  const { message } = await req.json();

  const res = await fetch("http://127.0.0.1:8000/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  return Response.json(await res.json());
}
