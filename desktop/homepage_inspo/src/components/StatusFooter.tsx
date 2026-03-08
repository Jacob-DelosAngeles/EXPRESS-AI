export default function StatusFooter() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 h-12 bg-[#0F1117] border-t border-slate-800 flex items-center px-6 z-50 text-[11px] text-slate-500 font-medium ml-[220px]">
      <div className="flex-1 flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          <span>MODEL: <span className="text-slate-300">YOLOv8n Loaded (GPU/CUDA)</span></span>
        </div>
        
        <div className="flex items-center gap-3 w-48">
          <span className="shrink-0 uppercase tracking-tighter">LOCAL STORAGE:</span>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full w-[65%]"></div>
          </div>
          <span className="text-slate-300">65%</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
          <span>BACKEND HEALTH: <span className="text-emerald-500">OPTIMAL</span></span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <span className="text-slate-400">FPS: 60.0</span>
        <span className="text-slate-400">CPU: 12%</span>
        <span className="text-slate-400">GPU: 44%</span>
      </div>
    </footer>
  );
}
