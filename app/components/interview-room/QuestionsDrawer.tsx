type Props = {
  open: boolean;
  onClose: () => void;
};

function QuestionCard({
  title,
  question,
}: {
  title: string;
  question: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-white/5 border border-white/5">
      <div className="text-cyan-400 text-xs mb-1">{title}</div>

      <p className="text-sm text-white/80">{question}</p>
    </div>
  );
}

export default function QuestionsDrawer({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <>
      {/* overlay */}

      {/* drawer */}

      <QuestionCard title="Question 1" question="Explain BFS and DFS" />
    </>
  );
}
