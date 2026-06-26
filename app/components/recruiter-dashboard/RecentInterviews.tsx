type InterviewStatus = "Completed";

type Interview = {
  title: string;
  candidate: string;
  time: string;
  status: InterviewStatus;
};

const STATUS_STYLES: Record<InterviewStatus, string> = {
  Completed: "bg-secondary/20 text-secondary border-secondary/30",
};
const STATUS_LABELS: Record<InterviewStatus, string> = {
  Completed: "Hoàn thành",
};

const INTERVIEWS: Interview[] = [
  {
    title: "Frontend Developer",
    candidate: "Phạm Hải Nam",
    time: "09:00 - 10:00",
    status: "Completed",
  },
  {
    title: "Backend Developer",
    candidate: "Trần Bảo Khánh",
    time: "13:30 - 14:30",
    status: "Completed",
  },
  {
    title: "UI/UX Designer",
    candidate: "Vũ Đức Duy",
    time: "15:00 - 16:00",
    status: "Completed",
  },
];

export function RecentInterviews() {
  return (
    <div className="pt-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-headline-lg text-headline-lg">Phỏng vấn gần đây</h2>

        <button className="text-sm font-medium text-primary-fixed hover:opacity-80 transition">
          Xem tất cả
        </button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-outline-variant">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-container-high border-b border-outline-variant">
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Vị trí
              </th>

              <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Thời gian
              </th>

              <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Trạng thái
              </th>

              <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Hành động
              </th>
            </tr>
          </thead>

          <tbody>
            {INTERVIEWS.map((interview) => (
              <tr
                key={`${interview.title}-${interview.candidate}`}
                className="border-b border-outline-variant/50 hover:bg-surface-container-high transition-all duration-200"
              >
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-fixed/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary-fixed text-lg">
                        work
                      </span>
                    </div>

                    <div>
                      <p className="font-semibold text-on-surface">
                        {interview.title}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-5 text-center">
                  <span className="font-medium">{interview.time}</span>
                </td>

                <td className="px-6 py-5 text-center">
                  <span
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${
                      STATUS_STYLES[interview.status]
                    }`}
                  >
                    {STATUS_LABELS[interview.status]}
                  </span>
                </td>

                <td className="px-6 py-5">
                  <div className="flex justify-center">
                    <button
                      type="button"
                      className="w-9 h-9 rounded-full bg-surface-container-high hover:bg-primary-fixed/10 flex items-center justify-center transition"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        more_horiz
                      </span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
