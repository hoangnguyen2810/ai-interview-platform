type EvaluationStatus = "Strong Hire" | "Hire" | "Reject";

type Evaluation = {
  name: string;
  score: number;
  status: EvaluationStatus;
};

const STATUS_STYLES: Record<EvaluationStatus, string> = {
  "Strong Hire": "bg-primary-fixed/20 text-primary-fixed border-primary-fixed/30",
  Hire: "bg-secondary/20 text-secondary border-secondary/30",
  Reject: "bg-error/20 text-error border-error/30",
};

const SCORE_COLORS: Record<EvaluationStatus, string> = {
  "Strong Hire": "text-primary-fixed",
  Hire: "text-secondary",
  Reject: "text-error",
};

const BAR_COLORS: Record<EvaluationStatus, string> = {
  "Strong Hire": "bg-primary-fixed-dim",
  Hire: "bg-secondary",
  Reject: "bg-error",
};

const EVALUATIONS: Evaluation[] = [
  { name: "Phạm Hải Nam", score: 92, status: "Strong Hire" },
  { name: "Trần Bảo Khánh", score: 78, status: "Hire" },
  { name: "Vũ Đức Duy", score: 45, status: "Reject" },
];

export function RecentEvaluations() {
  return (
    <div className="pt-8">
      <h2 className="font-headline-lg text-headline-lg mb-6">
        Đánh giá gần đây
      </h2>
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-high">
              <th className="px-6 py-4 font-label-sm text-label-sm text-on-surface-variant uppercase">
                Ứng viên
              </th>
              <th className="px-6 py-4 font-label-sm text-label-sm text-on-surface-variant uppercase">
                Neural Score
              </th>
              <th className="px-6 py-4 font-label-sm text-label-sm text-on-surface-variant uppercase">
                Trạng thái
              </th>
              <th className="px-6 py-4 font-label-sm text-label-sm text-on-surface-variant uppercase">
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {EVALUATIONS.map((evaluation) => (
              <tr
                key={evaluation.name}
                className="hover:bg-surface-container transition-colors"
              >
                <td className="px-6 py-4 font-bold">{evaluation.name}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-code-md text-code-md ${SCORE_COLORS[evaluation.status]}`}
                    >
                      {evaluation.score}/100
                    </span>
                    <div className="w-20 h-1.5 bg-surface-variant rounded-full overflow-hidden">
                      <div
                        className={`h-full ${BAR_COLORS[evaluation.status]}`}
                        style={{ width: `${evaluation.score}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border ${STATUS_STYLES[evaluation.status]}`}
                  >
                    {evaluation.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    type="button"
                    aria-label={`Xem chi tiết đánh giá của ${evaluation.name}`}
                    className="material-symbols-outlined text-on-surface-variant hover:text-on-surface"
                  >
                    description
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
