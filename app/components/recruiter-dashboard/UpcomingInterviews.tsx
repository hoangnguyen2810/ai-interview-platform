import Image from "next/image";

type Interview = {
  name: string;
  role: string;
  stack: string;
  time: string;
  status: "Đang chờ" | "Sắp tới";
  avatar: string;
  borderClass: string;
  ctaPrimary: boolean;
  ctaLabel: string;
};

const INTERVIEWS: Interview[] = [
  {
    name: "Nguyễn Minh Tuấn",
    role: "Senior React Developer",
    stack: "React, Node.js",
    time: "14:00 - 15:30",
    status: "Đang chờ",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCe9hqlJMbpq36Sa6erMcNO7LkYfAi0Gb_BWD5XpqEG1aCkklxospWsO-tb4UAdrj2DH36iUqQVLlCFY8ii7JJ5BreUe8zhLTBXitXLQINRXFS8AnyvcFs04AS7m_agbyzLo3krXD2jVXsVKaSRa-L9ebK5AlMTqnbZEAq-VAkodpUzbsvnxcewKCaWzqBmO4ud-JuJLSN3M-iO6uS39PCIEXjd58R60VOkctMY_Zurqu5m2BhGB8VJ3HbCphjBIiCuKmjh-1u4Lko",
    borderClass: "border-primary-fixed",
    ctaPrimary: true,
    ctaLabel: "Vào phòng",
  },
  {
    name: "Lê Thị Thanh Huyền",
    role: "UI/UX Designer",
    stack: "Figma, Framer",
    time: "16:30 - 17:30",
    status: "Sắp tới",
    avatar:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA8WBt9dsvtcwHu5x72EAo9ZeoTca5b8sHtSeCdmj-qehGWZPcjx25jbmN2jYDBUim5D0mKy9VmI87gxwPKfeMja8ny1TEmfy1iC-Vum3Z5Nd7OkrQVqgYH3nTYnakduQz42aD44MVt4lhd0c1u6ZFkCOEHec9CN91y2oP1let9zfh-kFdMCKBTn-YbaWTqv2t-cA97UeJL_mwOO1gRHHS1yo6o7pcLWESSumtQV7OlcbXapaJoSk4Bg3ldLnfvo7gB1wm2Syntwqo",
    borderClass: "border-outline-variant",
    ctaPrimary: false,
    ctaLabel: "Chi tiết",
  },
];

export function UpcomingInterviews() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-headline-lg text-headline-lg">
          Lịch phỏng vấn hôm nay
        </h2>
        <span className="text-primary-fixed text-sm font-label-sm underline cursor-pointer">
          Xem tất cả
        </span>
      </div>
      <div className="space-y-4">
        {INTERVIEWS.map((interview) => (
          <div
            key={interview.name}
            className="glass-card p-5 rounded-2xl flex items-center justify-between group hover:bg-surface-container-high transition-all"
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-full border-2 ${interview.borderClass} p-0.5`}
              >
                <Image
                  alt={`Ảnh đại diện của ${interview.name}`}
                  className="w-full h-full rounded-full object-cover"
                  src={interview.avatar}
                  width={48}
                  height={48}
                />
              </div>
              <div>
                <h4 className="font-bold text-on-surface">{interview.name}</h4>
                <p className="text-sm text-on-surface-variant">
                  {interview.role} • {interview.stack}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-right">
                <div
                  className={
                    interview.status === "Đang chờ"
                      ? "font-code-md text-code-md text-primary-fixed"
                      : "font-code-md text-code-md text-on-surface-variant"
                  }
                >
                  {interview.time}
                </div>
                <div className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                  {interview.status}
                </div>
              </div>
              <button
                type="button"
                className={
                  interview.ctaPrimary
                    ? "bg-primary-fixed text-on-primary-fixed px-6 py-2 rounded-lg font-bold text-sm hover:scale-105 transition-transform active:scale-95"
                    : "border border-outline-variant text-on-surface px-6 py-2 rounded-lg font-bold text-sm hover:bg-surface-container-highest transition-all"
                }
              >
                {interview.ctaLabel}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
