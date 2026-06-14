export default function ProfileCompletion() {
  return (
    <div className="p-6 rounded-xl border border-outline-variant bg-surface-container space-y-4">
      <h3 className="font-bold">Hoàn thiện hồ sơ</h3>

      <p className="text-3xl font-bold text-primary">85%</p>

      <div className="h-2 bg-surface rounded-full">
        <div className="h-full w-[85%] bg-primary-container rounded-full" />
      </div>

      <ul className="text-sm space-y-2 opacity-70">
        <li>• Thêm ảnh công ty</li>
        <li>• Liên kết LinkedIn</li>
      </ul>
    </div>
  );
}
