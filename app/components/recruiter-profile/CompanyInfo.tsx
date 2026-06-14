export default function CompanyInfo() {
  return (
    <div className="p-6 rounded-xl border border-outline-variant bg-surface-container space-y-4">
      <h3 className="text-lg font-bold">Công ty</h3>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-white rounded-lg" />
        <div>
          <p className="font-semibold">FPT Software</p>
          <p className="text-xs opacity-60">IT Services</p>
        </div>
      </div>

      <p className="text-sm opacity-70">
        Global software outsourcing company based in Vietnam...
      </p>

      <a className="text-primary underline" href="#">
        www.fptsoftware.com
      </a>
    </div>
  );
}
