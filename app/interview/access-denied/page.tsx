export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#051424] text-white">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Không có quyền truy cập</h1>
        <p className="text-gray-400">
          Bạn không phải ứng viên hoặc người phỏng vấn của cuộc phỏng vấn này.
        </p>
      </div>
    </div>
  );
}
