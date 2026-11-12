import React from 'react';
import {
  LayoutDashboard,
  AlertCircle,
  GitFork,
  Scale,
  FlaskConical,
  ShieldAlert
} from 'lucide-react';

const CORE_NAV = [
  { id: 'dashboard', label: 'Command Centre', icon: LayoutDashboard },
  { id: 'report', label: 'Report Emergency', icon: AlertCircle },
  { id: 'ripple', label: 'Ripple Analyzer', icon: GitFork, badge: 'Signature' },
  { id: 'comparison', label: 'AI vs Traditional', icon: Scale },
  { id: 'simulation', label: 'Simulation Lab', icon: FlaskConical },
];

export default function Sidebar({ currentTab, onSelectTab, state }) {
  const activeCount = state?.kpis?.active_emergencies || 0;
  const criticalCount = state?.kpis?.critical_emergencies || 0;

  return (
    <aside className="w-60 bg-[#17324D] text-slate-100 flex flex-col h-screen select-none border-r border-[#243447]/40 shadow-lg shrink-0 z-20">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-700/60 bg-[#12263a] flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0F9D91] to-[#2563A6] flex items-center justify-center shadow-md shadow-teal-900/30 shrink-0">
          <ShieldAlert className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-1.5">
            <span className="font-extrabold tracking-wide text-white text-base">RESQ-X</span>
            <span className="text-[10px] bg-[#0F9D91] text-white px-1.5 py-0.2 rounded font-bold uppercase">
              AI
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Smart City Emergency Mesh</p>
        </div>
      </div>

      {/* Clean Status Pill */}
      <div className="px-4 py-3">
        <div className="bg-[#1a3854] rounded-xl p-3 border border-blue-900/30 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0F9D91] animate-pulse"></span>
            <span className="font-semibold text-slate-200">Hyderabad</span>
          </div>
          <div className="flex items-center space-x-1.5">
            {criticalCount > 0 && (
              <span className="bg-[#DC3545] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {criticalCount} Critical
              </span>
            )}
            <span className="bg-[#2563A6] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {activeCount} Active
            </span>
          </div>
        </div>
      </div>

      {/* Streamlined Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {CORE_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const isSignature = item.id === 'ripple';

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all text-left ${
                isActive
                  ? isSignature
                    ? 'bg-gradient-to-r from-[#0F9D91] to-[#2563A6] text-white shadow-md'
                    : 'bg-[#2563A6] text-white shadow-sm'
                  : isSignature
                  ? 'text-teal-300 hover:bg-[#1a3854] hover:text-white'
                  : 'text-slate-300 hover:bg-[#1a3854] hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-white' : isSignature ? 'text-[#0F9D91]' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[#0F9D91]/20 text-teal-300 border border-teal-500/30'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 bg-[#112335] border-t border-slate-700/60 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Telemetry Active</span>
        </div>
        <span className="font-mono text-[10px] text-slate-500">v2.4</span>
      </div>
    </aside>
  );
}
