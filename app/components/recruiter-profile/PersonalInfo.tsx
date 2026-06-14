export default function PersonalInfo() {
  return (
    <div className="p-6 rounded-xl border border-outline-variant bg-surface-container space-y-4">
      <h3 className="text-lg font-bold">Thông tin cá nhân</h3>

      <div>
        <p className="text-xs opacity-60">Email</p>
        <div className="p-3 bg-surface rounded-lg">nguyen.vana@fpt.com</div>
      </div>

      <div>
        <p className="text-xs opacity-60">Phone</p>
        <div className="p-3 bg-surface rounded-lg">+84 987 654 321</div>
      </div>

      <div>
        <p className="text-xs opacity-60">Bio</p>
        <div className="p-3 bg-surface rounded-lg">
          Senior Tech Recruiter with 8+ years experience...
        </div>
      </div>
    </div>
  );
}
