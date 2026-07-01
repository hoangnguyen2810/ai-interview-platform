export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const res = await fetch(`http://127.0.0.1:8000/sessions/${id}`, {
    method: "DELETE",
  });
  return Response.json(await res.json(), { status: res.status });
}