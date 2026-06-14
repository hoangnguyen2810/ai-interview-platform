export default function CVCard() {
  const cv_url = "/cv.pdf";

  return (
    <div className="glass-panel p-6 rounded-2xl">
      <h3 className="font-bold mb-4">CV File</h3>

      <div className="flex items-center justify-between p-4 bg-surface-container-high rounded-xl">
        <span>resume.pdf</span>

        <a href={cv_url} className="text-primary font-bold hover:underline">
          Download
        </a>
      </div>
    </div>
  );
}
