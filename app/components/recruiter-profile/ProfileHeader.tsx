export default function ProfileHeader() {
  return (
    <section className="p-6 rounded-xl border border-outline-variant bg-surface-container flex flex-col md:flex-row gap-6">
      <img
        src="https://i.pravatar.cc/150"
        className="w-28 h-28 rounded-xl object-cover"
      />

      <div className="flex-1 space-y-2">
        <h2 className="text-3xl font-bold">Nguyễn Văn A</h2>

        <span className="inline-block px-3 py-1 bg-secondary-container rounded-full text-sm">
          Premium Recruiter
        </span>

        <p className="text-sm opacity-70">FPT Software</p>

        <div className="flex gap-3 mt-4">
          <button className="px-4 py-2 bg-primary-container rounded-lg">
            Edit Profile
          </button>
          <button className="px-4 py-2 border rounded-lg">Public Page</button>
        </div>
      </div>
    </section>
  );
}
