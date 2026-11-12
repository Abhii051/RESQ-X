import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  AlertCircle,
  Sliders,
  Building2,
  TrendingUp,
  Zap,
  Scale,
  History,
  Bell,
  RotateCcw,
  RefreshCw,
  ShieldAlert,
  Flame,
  CheckCircle2,
  X
} from 'lucide-react';
import { triggerSimulationEvent } from '../services/api';

export const COMMAND_MODULES = [
  { id: 'command', label: 'Command Centre & Map', icon: LayoutDashboard, badge: 'Main ECC' },
  { id: 'ingestion', label: 'Emergency Intake & AI', icon: AlertCircle, badge: 'Triage' },
  { id: 'allocation', label: 'Resource Allocation', icon: Sliders, badge: 'Optimizer' },
  { id: 'hospitals', label: 'Hospital Network', icon: Building2, badge: 'Beds' },
  { id: 'prediction', label: 'Demand Prediction', icon: TrendingUp, badge: 'Hotspots' },
  { id: 'disruptions', label: 'Disruption & Ripple', icon: Zap, badge: 'Adaptive' },
  { id: 'comparison', label: 'AI vs Traditional', icon: Scale, badge: 'Benchmark' },
  { id: 'audit', label: 'Decision Audit & History', icon: History, badge: 'Audit' },
];

export default function Header({ currentTab, onSelectTab, state, wsStatus, onRefresh }) {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [resetting, setResetting] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleReset = async () => {
    try {
      setResetting(true);
      await triggerSimulationEvent('reset');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Reset failed", err);
    } finally {
      setResetting(false);
    }
  };

  const kpis = state?.kpis || {};
  const decisionLogs = state?.decision_logs || [];
  const criticalLogs = decisionLogs.filter(d => d.severity === 'Critical' || d.severity === 'Warning').slice(0, 8);

  return (
    <header className="bg-white border-b border-[#E3E9EF] shadow-2xs sticky top-0 z-40">
      {/* Top Banner Bar */}
      <div className="h-16 px-4 md:px-6 flex items-center justify-between gap-3 border-b border-slate-100">
        {/* Left: Brand Identity */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0F9D91] to-[#2563A6] flex items-center justify-center shadow-md shadow-teal-900/20">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold tracking-wide text-[#17324D] text-base">RESQ-X</span>
              <span className="text-[10px] bg-[#0F9D91] text-white px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                HYDERABAD ECC
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
              Predictive Emergency Intelligence & Self-Adaptive Response Network
            </p>
          </div>
        </div>

        {/* Center: Live Quick Metrics Ticker */}
        <div className="hidden lg:flex items-center space-x-2 text-xs">
          <div className="flex items-center space-x-1.5 px-3 py-1 bg-red-50 text-red-700 rounded-lg border border-red-200 font-bold">
            <Flame className="w-3.5 h-3.5 text-red-600" />
            <span>{kpis.active_emergencies || 0} Active</span>
            <span className="text-[10px] font-normal text-red-500">({kpis.critical_emergencies || 0} Critical)</span>
          </div>

          <div className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{kpis.available_ambulances || 0}/10 Fleet Ready</span>
          </div>

          <div className="flex items-center space-x-1.5 px-3 py-1 bg-teal-50 text-teal-800 rounded-lg border border-teal-200 font-bold">
            <Building2 className="w-3.5 h-3.5 text-teal-600" />
            <span>{kpis.available_icu_beds || 0} ICU Beds</span>
          </div>
        </div>

        {/* Right: Reset Action, Live Alerts Drawer & Clock */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Live Alerts Bell */}
          <div className="relative">
            <button
              onClick={() => setShowAlerts(!showAlerts)}
              className="relative p-2 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-600 transition"
              title="Live Operations Alerts"
            >
              <Bell className="w-4 h-4" />
              {criticalLogs.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                  {criticalLogs.length}
                </span>
              )}
            </button>

            {/* Alerts Dropdown Drawer */}
            {showAlerts && (
              <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 text-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center space-x-1.5 font-bold text-[#17324D]">
                    <Bell className="w-4 h-4 text-red-600" />
                    <span>Real-time Operational Alerts</span>
                  </div>
                  <button onClick={() => setShowAlerts(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 custom-scrollbar">
                  {criticalLogs.length === 0 ? (
                    <div className="text-center py-4 text-slate-400">No critical alerts pending</div>
                  ) : (
                    criticalLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                          log.severity === 'Critical'
                            ? 'bg-red-50/70 border-red-200 text-red-900'
                            : 'bg-amber-50/70 border-amber-200 text-amber-900'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <strong className="font-bold">{log.decision}</strong>
                          <span className="text-[10px] opacity-75 font-mono">{log.timestamp}</span>
                        </div>
                        <p className="text-[10.5px] opacity-90 leading-relaxed">{log.reason}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Reset Baseline */}
          <button
            onClick={handleReset}
            disabled={resetting}
            className="px-3 py-1.5 rounded-lg border border-slate-300 hover:border-slate-400 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold transition flex items-center space-x-1.5 shadow-2xs"
            title="Restore pristine baseline state"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-slate-500 ${resetting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{resetting ? 'Resetting...' : 'Reset'}</span>
          </button>

          {/* Live Clock */}
          <div className="bg-[#17324D] text-white px-3 py-1.5 rounded-lg text-xs font-mono font-semibold tracking-wider flex items-center space-x-1 shadow-2xs">
            <span>{time}</span>
            <span className="text-[10px] text-teal-300 font-sans font-bold">IST</span>
          </div>

          <button
            onClick={onRefresh}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            title="Sync data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <nav className="h-11 px-4 md:px-6 bg-[#F4F7FA] border-b border-[#E3E9EF] flex items-center space-x-1 overflow-x-auto no-scrollbar">
        {COMMAND_MODULES.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 select-none ${
                isActive
                  ? 'bg-[#17324D] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-teal-300' : 'text-slate-400'}`} />
              <span>{tab.label}</span>

              {tab.badge && (
                <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-extrabold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
