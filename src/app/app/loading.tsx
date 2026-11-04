export default function AppLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="skeleton h-3 w-40" />
        <div className="skeleton h-7 w-64" />
        <div className="skeleton h-3 w-52" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="skeleton h-64 w-full rounded-3xl" />
          <div className="skeleton h-72 w-full rounded-3xl" />
        </div>
        <div className="space-y-5">
          <div className="skeleton h-52 w-full rounded-3xl" />
          <div className="skeleton h-56 w-full rounded-3xl" />
        </div>
      </div>
      <div className="skeleton h-48 w-full rounded-3xl" />
      <p className="text-center text-[11px] text-slate-400">Memuat dompet poin Master…</p>
    </div>
  );
}
