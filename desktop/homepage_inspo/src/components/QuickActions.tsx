import { LayoutDashboard, BarChart3, FileText, Settings } from 'lucide-react';

export default function QuickActions() {
  const actions = [
    { name: 'Dashboard', desc: 'Global view', icon: LayoutDashboard, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { name: 'Analytics', desc: 'Trends & stats', icon: BarChart3, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { name: 'Reports', desc: 'Export PDF/CSV', icon: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { name: 'Settings', desc: 'System config', icon: Settings, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  return (
    <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      {actions.map((action) => (
        <div key={action.name} className="glass-card p-5 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer group">
          <div className={`w-12 h-12 ${action.bg} rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
            <action.icon className={`w-6 h-6 ${action.color}`} />
          </div>
          <h3 className="font-semibold text-white">{action.name}</h3>
          <p className="text-xs text-slate-500 mt-1">{action.desc}</p>
        </div>
      ))}
    </section>
  );
}
