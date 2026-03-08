export default function Header() {
  return (
    <header className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Good morning, Desktop User 👋</h1>
        <p className="text-slate-400 text-sm">Review your local processing jobs and system telemetry.</p>
      </div>
      <div className="flex gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-[11px] font-bold text-green-500 uppercase">Backend Running</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-full">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SQLite · Local Storage</span>
        </div>
      </div>
    </header>
  );
}
