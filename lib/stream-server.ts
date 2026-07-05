// Server-side helper dùng @stream-io/node-sdk để query recordings từ
// GetStream khi cần thiết (fallback cho webhook hoặc event payload rỗng).
//
// Lý do tồn tại: SDK GetStream không đảm bảo event `call.recording_ready`
// gửi kèm URL/file metadata xuống client (đặc biệt với composite recording).
// Webhook cũng cần được recruiter cấu hình thủ công trên Stream Dashboard.
// Để chắc chắn file recording hiển thị trong DB, server chủ động gọi
// `call.listRecordings()` và INSERT vào bảng `recordings` của mình.
//
// CHỈ import file này từ server-side code (route handlers / server actions).

import {
  StreamClient,
  StreamVideoClient,
  type CallRecording,
} from "@stream-io/node-sdk";

let _client: StreamVideoClient | null = null;

function getApiKey(): string {
  const k = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  if (!k) {
    throw new Error("NEXT_PUBLIC_STREAM_API_KEY chưa được cấu hình");
  }
  return k;
}

function getSecret(): string {
  const s = process.env.STREAM_API_SECRET;
  if (!s) {
    throw new Error("STREAM_API_SECRET chưa được cấu hình");
  }
  return s;
}

/**
 * Trả về singleton StreamVideoClient (server-side).
 * Lưu ý: KHÔNG truyền user/token vì ta chỉ dùng server SDK để gọi
 * các endpoint quản trị (listRecordings, getCall, …) với API secret.
 */
export function getStreamServerClient(): StreamVideoClient {
  if (_client) return _client;
  const stream = new StreamClient(getApiKey(), getSecret());
  _client = stream.video;
  return _client;
}

/**
 * Lấy danh sách recordings của 1 call từ GetStream.
 *
 * Trả về mảng rỗng nếu call chưa có recording hoặc bị lỗi — không throw ra ngoài
 * để caller có thể tự quyết định fallback.
 */
export async function listCallRecordings(
  callType: string,
  callId: string,
): Promise<CallRecording[]> {
  try {
    const client = getStreamServerClient();
    const call = client.call(callType, callId);
    const res = await call.listRecordings();

    // StreamResponse<T> = T & { metadata } — không có `.data`
    const recordings = (res as unknown as { recordings?: CallRecording[] })
      .recordings;

    if (!recordings || !Array.isArray(recordings)) return [];
    return recordings.filter(
      (r) => r && typeof r.url === "string" && r.url.length > 0,
    );
  } catch (err) {
    console.warn(
      `[stream-server] listRecordings failed for ${callType}:${callId}:`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}