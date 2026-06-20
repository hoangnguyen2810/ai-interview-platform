import { StreamClient } from "@stream-io/node-sdk";

const client = new StreamClient(
  process.env.NEXT_PUBLIC_STREAM_API_KEY!,
  process.env.STREAM_API_SECRET!,
);

export async function POST(req: Request) {
  const { userId } = await req.json();

  const token = client.generateUserToken({ user_id: userId });

  return Response.json({ token });
}
