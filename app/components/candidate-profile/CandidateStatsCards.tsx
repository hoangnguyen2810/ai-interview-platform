export default function CandidateStatsCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="glass-panel p-6 rounded-2xl">
        <h3 className="text-sm text-on-surface-variant">Experience</h3>
        <p className="text-3xl font-bold text-primary mt-2">3 Years</p>
      </div>

      <div className="glass-panel p-6 rounded-2xl">
        <h3 className="text-sm text-on-surface-variant">Phone</h3>
        <p className="text-xl font-bold mt-2">+84 912 345 678</p>
      </div>

      <div className="glass-panel p-6 rounded-2xl">
        <h3 className="text-sm text-on-surface-variant">CV Status</h3>
        <p className="text-xl font-bold text-primary mt-2">Uploaded</p>
      </div>
    </div>
  );
}
