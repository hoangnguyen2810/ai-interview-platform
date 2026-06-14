export default function AccountInfo() {
  return (
    <div className="p-6 rounded-xl border border-outline-variant bg-surface-container space-y-4">
      <h3 className="text-lg font-bold">Tài khoản</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-xs opacity-60">Role</p>
          <p>Recruiter</p>
        </div>

        <div>
          <p className="text-xs opacity-60">Joined</p>
          <p>15/03/2023</p>
        </div>

        <div>
          <p className="text-xs opacity-60">Last login</p>
          <p>Today 09:42</p>
        </div>
      </div>
    </div>
  );
}
