// streamRecordingService
// ----------------------

import { listCallRecordings as listCallRecordingsRaw } from "@/lib/stream-server";

export interface StreamRecording {
  url: string;
  filename: string | null;
  duration: number;
  recording_type: string | null;
  created_at: Date | null;
}

/**
 * Lấy danh sách recordings của 1 call từ GetStream.
 *
 * @param callCid - GetStream call cid, định dạng "<callType>:<callId>".
 *   Ví dụ: "default:NC-23G6KRA3", "audio_room:meeting-abc-123".
 *
 * @returns Mảng `StreamRecording` đã được chuẩn hoá về 5 field spec yêu cầu.
 *   Trả `[]` nếu call chưa có recording, hoặc `callCid` không hợp lệ,
 *   hoặc GetStream API lỗi (error được log, KHÔNG throw để caller xử lý).
 *
 * Lưu ý: KHÔNG idempotent ở service layer — việc chống trùng khi lưu DB
 * do route handler lo (dùng ON CONFLICT DO NOTHING).
 */
export async function getCallRecordings(
  callCid: string,
): Promise<StreamRecording[]> {
  const { callType, callId } = parseCallCid(callCid);
  if (!callType || !callId) return [];

  // listCallRecordingsRaw ở lib/stream-server.ts đã là wrapper server-side
  // dùng @stream-io/node-sdk. Nó đã handle error và trả [] nếu fail.
  const rawRecordings = await listCallRecordingsRaw(callType, callId);

  return rawRecordings
    .map((r): StreamRecording | null => {
      // url là field bắt buộc — nếu thiếu thì bỏ qua (Stream không cho
      // playback nếu không có URL).
      if (!r.url || typeof r.url !== "string") return null;

      // CallRecording (@stream-io/node-sdk) có `start_time` / `end_time`
      // kiểu Date, không có sẵn `duration` và `created_at`.
      //   - duration: tính từ start_time → end_time.
      //   - created_at: = start_time (thời điểm file bắt đầu được tạo trên GetStream).
      const startTime = toDate(r.start_time);
      const endTime = toDate(r.end_time);
      const durationSec =
        startTime && endTime
          ? Math.max(
              0,
              Math.round((endTime.getTime() - startTime.getTime()) / 1000),
            )
          : 0;

      return {
        url: r.url,
        filename: r.filename ?? null,
        duration: durationSec,
        recording_type: r.recording_type ?? null,
        created_at: startTime,
      };
    })
    .filter((r): r is StreamRecording => r !== null);
}

/**
 * Chuẩn hoá giá trị Date | string | number sang Date, hoặc null nếu invalid.
 */
function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Parse callCid dạng "type:id" thành { callType, callId }.
 * Nếu input không có dấu ":" → assume callType="default" (quy ước của
 * app này — xem lib/streamClient.ts).
 */
function parseCallCid(callCid: string): {
  callType: string;
  callId: string;
} {
  if (!callCid || typeof callCid !== "string") {
    return { callType: "", callId: "" };
  }
  const idx = callCid.indexOf(":");
  if (idx < 0) {
    return { callType: "default", callId: callCid };
  }
  const callType = callCid.slice(0, idx);
  const callId = callCid.slice(idx + 1);
  return { callType, callId };
}
