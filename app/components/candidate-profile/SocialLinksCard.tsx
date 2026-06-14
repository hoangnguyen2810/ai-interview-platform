export default function SocialLinksCard() {
  const data = {
    github_url: "https://github.com/user",
    linkedin_url: "https://linkedin.com/in/user",
  };

  return (
    <div className="glass-panel rounded-2xl p-6">
      <h3 className="font-bold mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">link</span>
        Profiles
      </h3>

      <div className="flex flex-col gap-3">
        <a
          className="flex justify-between p-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest transition"
          href={data.github_url}
        >
          <span>GitHub</span>
          <span className="text-primary text-sm">github.com/user</span>
        </a>

        <a
          className="flex justify-between p-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest transition"
          href={data.linkedin_url}
        >
          <span>LinkedIn</span>
          <span className="text-primary text-sm">linkedin.com</span>
        </a>
      </div>
    </div>
  );
}
