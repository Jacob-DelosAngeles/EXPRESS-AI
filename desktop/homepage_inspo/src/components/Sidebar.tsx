import { LayoutDashboard, BarChart3, Upload, FileText, Settings } from 'lucide-react';

export default function Sidebar() {
  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, active: true },
    { name: 'Analytics', icon: BarChart3 },
    { name: 'Upload', icon: Upload },
    { name: 'Reports', icon: FileText },
    { name: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col border-r border-slate-800 bg-[#0F1117] h-full">
      <div className="p-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
            E
          </div>
          <span className="text-lg font-bold tracking-tight text-white">Express AI</span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => (
          <a
            key={item.name}
            href="#"
            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors group ${
              item.active
                ? 'bg-blue-600/10 text-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.name}
          </a>
        ))}
      </nav>

      <div className="p-4 mt-auto border-t border-slate-800">
        <div className="flex flex-col gap-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Local Session</div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">desktop@local</span>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">v2.1.0</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
