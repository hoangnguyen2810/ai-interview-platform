export async function POST() {
  const res = await fetch("http://127.0.0.1:8000/sessions", {
    method: "POST",
  });
  return Response.json(await res.json(), { status: res.status });
}
