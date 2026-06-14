export default function ProfileStatusCard() {
  return (
    <div className="glass-panel p-6 rounded-2xl">
      <h3 className="font-bold mb-4">Profile Status</h3>

      <div className="space-y-3 text-sm">
        {["Phone", "GitHub", "LinkedIn", "CV"].map((item) => (
          <div key={item} className="flex justify-between">
            <span>{item}</span>
            <span className="text-primary">✔</span>
          </div>
        ))}
      </div>
    </div>
  );
}
