import { useRecording, type RecordingStatus } from "./RecordingContext";

interface HeaderProps {
  title?: string;
  meetingCode?: string;
  role?: "candidate" | "recruiter";
  enableRecording?: boolean;
}

export default function Header({
  title,
  meetingCode,
  role,
  enableRecording = false,
}: HeaderProps) {
  const { status } = useRecording();

  return (
    <header className="w-full flex items-center justify-between z-10">
      {/* Logo */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-cyan-400 rounded-[8px] flex items-center justify-center">
          <svg
            className="h-5 w-5 text-[#051424]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M13 10V3L4 14h7v7l9-11h-7z"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <span className="font-bold text-xl tracking-tight">
          <span className="text-cyan-400">CodePilot AI</span>
        </span>
      </div>

      {/* Meeting info */}
      <div className="bg-[#2c3a4c]/30 px-3 py-1 rounded-full text-xs font-medium text-gray-400 border border-white/5">
        {meetingCode ?? "INTERVIEW_ID: NS-992"}
        {title ? ` • ${title}` : ""}
        {role ? ` • ${role.toUpperCase()}` : ""}
      </div>

      {/* Recording status */}
      <div className="min-w-[180px] flex justify-end">
        {enableRecording && <RecordingIndicator status={status} />}
      </div>
    </header>
  );
}

function RecordingIndicator({ status }: { status: RecordingStatus }) {
  let label = "";
  let className =
    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium";

  switch (status) {
    case "recording":
      label = "Đang ghi hình";
      className += " border-red-500/40 bg-red-500/10 text-red-300";
      break;

    case "starting":
      label = "Đang bật ghi hình...";
      className += " border-amber-500/40 bg-amber-500/10 text-amber-300";
      break;

    case "stopping":
      label = "Đang dừng ghi hình...";
      className += " border-amber-500/40 bg-amber-500/10 text-amber-300";
      break;

    case "stopped":
      label = "Đã dừng ghi hình";
      className += " border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
      break;

    case "error":
      label = "Lỗi ghi hình";
      className += " border-red-500/40 bg-red-500/10 text-red-300";
      break;

    case "idle":
    default:
      return null;
  }

  return (
    <div className={className} title={label} aria-live="polite">
      <span
        className={
          status === "recording"
            ? "material-symbols-outlined text-[14px] animate-pulse"
            : "material-symbols-outlined text-[14px]"
        }
      >
        fiber_manual_record
      </span>

      <span>{label}</span>
    </div>
  );
}
