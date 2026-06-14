export default function Security() {
  return (
    <div className="p-6 rounded-xl border border-outline-variant bg-surface-container space-y-4">
      <h3 className="text-lg font-bold">Bảo mật</h3>

      <input
        type="password"
        className="w-full p-3 rounded bg-surface border border-outline-variant"
        placeholder="Current password"
      />

      <input
        type="password"
        className="w-full p-3 rounded bg-surface border border-outline-variant"
        placeholder="New password"
      />

      <input
        type="password"
        className="w-full p-3 rounded bg-surface border border-outline-variant"
        placeholder="Confirm password"
      />

      <button className="w-full py-3 rounded-lg bg-primary-container font-semibold">
        Update Password
      </button>

      <p className="text-xs text-center opacity-60">
        Last changed: Aug 12, 2024
      </p>
    </div>
  );
}
