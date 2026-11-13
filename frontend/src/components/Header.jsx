import React, { useState, useEffect } from 'react';
import {
  Users,
  Ambulance,
  Building2,
  LayoutDashboard,
  Bell,
  RotateCcw,
  RefreshCw,
  ShieldAlert,
  Flame,
  X,
  Database,
  Cloud,
  User,
  LogOut,
  ChevronDown,
  UserCheck,
  Check,
  ShieldCheck,
  Key
} from 'lucide-react';
import { triggerSimulationEvent } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SupabaseModal from './SupabaseModal';

export const ROLE_DASHBOARDS = [
  { id: 'citizen', label: 'Citizen Dashboard (SOS)', icon: Users, badge: 'Public 108', roleKey: 'citizen' },
  { id: 'ambulance', label: 'Ambulance MDT', icon: Ambulance, badge: 'Paramedic', roleKey: 'ambulance' },
  { id: 'hospital', label: 'Hospital ER & ICU', icon: Building2, badge: 'Facility', roleKey: 'hospital' },
  { id: 'command', label: 'Command Centre (Brain)', icon: LayoutDashboard, badge: 'Master ECC', roleKey: 'command' },
];

export default function Header({ currentTab, onSelectTab, state, wsStatus, onRefresh }) {
  const { user, isAuthenticated, logout, quickLogin, demoUsers, dbStats } = useAuth();
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [resetting, setResetting] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showDbPopover, setShowDbPopover] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);

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

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'citizen': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'ambulance': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'hospital': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'command': return 'bg-amber-50 text-amber-800 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

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
                HYDERABAD
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
              Intelligent Emergency Response Network • Problem Statement 10
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

        {/* Right: User Profile, Alerts & Clock */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* User Session Profile Button */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition shadow-2xs ${
                isAuthenticated
                  ? getRoleBadgeColor(user?.role)
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span className="truncate max-w-[120px]">
                {isAuthenticated ? user?.name : 'Guest Mode'}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {/* User Drawer / Persona Switcher */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 text-xs space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <div className="font-bold text-[#17324D] text-sm">
                      {isAuthenticated ? user?.name : 'Authentication Terminal'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {isAuthenticated ? `Role: ${user?.role?.toUpperCase()}` : 'Select a persona to sign in'}
                    </div>
                  </div>
                  <button onClick={() => setShowUserMenu(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {isAuthenticated && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Username:</span>
                      <span className="font-mono font-bold text-slate-800">{user?.username}</span>
                    </div>
                    {user?.entity_id && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Entity ID:</span>
                        <span className="font-mono font-bold text-[#2563A6]">{user?.entity_id}</span>
                      </div>
                    )}
                    {user?.metadata?.blood_group && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Blood Group:</span>
                        <span className="font-bold text-red-600">{user?.metadata?.blood_group}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 text-[10px]">
                      <span className="text-slate-400">Database:</span>
                      <span className="text-emerald-700 font-bold flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Supabase Cloud Sync</span>
                      </span>
                    </div>
                    <button
                      onClick={() => { logout(); setShowUserMenu(false); }}
                      className="w-full mt-2 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold rounded-lg text-xs flex items-center justify-center space-x-1.5 transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out Session</span>
                    </button>
                  </div>
                )}

                {/* 1-Click Fast Persona Switcher */}
                <div className="space-y-2">
                  <div className="text-[11px] font-extrabold text-[#17324D] uppercase tracking-wider flex items-center space-x-1">
                    <UserCheck className="w-3.5 h-3.5 text-[#0F9D91]" />
                    <span>Quick Switch Persona (1-Click)</span>
                  </div>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                    {/* Citizen */}
                    <button
                      onClick={() => {
                        const cit = demoUsers.find(u => u.username === 'citizen_rahul');
                        if (cit) quickLogin(cit);
                        onSelectTab('citizen');
                        setShowUserMenu(false);
                      }}
                      className="w-full p-2 text-left bg-teal-50/50 hover:bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between text-[11px] transition"
                    >
                      <div>
                        <div className="font-bold text-teal-900">Rahul Sharma (Citizen SOS)</div>
                        <div className="text-[10px] text-teal-700 font-mono">Blood: O+ • Madhapur</div>
                      </div>
                      <span className="text-[9px] bg-teal-600 text-white font-bold px-1.5 py-0.5 rounded">CITIZEN</span>
                    </button>

                    {/* Paramedic */}
                    <button
                      onClick={() => {
                        const amb = demoUsers.find(u => u.username === 'paramedic_a01');
                        if (amb) quickLogin(amb);
                        onSelectTab('ambulance');
                        setShowUserMenu(false);
                      }}
                      className="w-full p-2 text-left bg-blue-50/50 hover:bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-[11px] transition"
                    >
                      <div>
                        <div className="font-bold text-blue-900">Unit RESQ-A01 (Paramedic)</div>
                        <div className="text-[10px] text-blue-700 font-mono">Dr. Anita Desai • ALS Unit</div>
                      </div>
                      <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded">AMBULANCE</span>
                    </button>

                    {/* Hospital */}
                    <button
                      onClick={() => {
                        const hosp = demoUsers.find(u => u.username === 'hosp_osmania');
                        if (hosp) quickLogin(hosp);
                        onSelectTab('hospital');
                        setShowUserMenu(false);
                      }}
                      className="w-full p-2 text-left bg-purple-50/50 hover:bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between text-[11px] transition"
                    >
                      <div>
                        <div className="font-bold text-purple-900">Osmania ER Desk (Hospital)</div>
                        <div className="text-[10px] text-purple-700 font-mono">Dr. Venkat Rao • Trauma L1</div>
                      </div>
                      <span className="text-[9px] bg-purple-600 text-white font-bold px-1.5 py-0.5 rounded">HOSPITAL</span>
                    </button>

                    {/* Command */}
                    <button
                      onClick={() => {
                        const cmd = demoUsers.find(u => u.username === 'command_admin');
                        if (cmd) quickLogin(cmd);
                        onSelectTab('command');
                        setShowUserMenu(false);
                      }}
                      className="w-full p-2 text-left bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl flex items-center justify-between text-[11px] transition"
                    >
                      <div>
                        <div className="font-bold text-[#17324D]">Director Rao (Command ECC)</div>
                        <div className="text-[10px] text-slate-600 font-mono">Level 5 Master Clearance</div>
                      </div>
                      <span className="text-[9px] bg-[#17324D] text-white font-bold px-1.5 py-0.5 rounded">COMMAND</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

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
            title="Restore pristine baseline demonstration state"
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
            title="Sync live telemetry data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Primary Role Navigation Tabs */}
      <nav className="h-12 px-4 md:px-6 bg-[#F4F7FA] border-b border-[#E3E9EF] flex items-center space-x-2 overflow-x-auto no-scrollbar">
        {ROLE_DASHBOARDS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          const isUserRole = user?.role === tab.roleKey;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 select-none ${
                isActive
                  ? 'bg-gradient-to-r from-[#17324D] to-[#2563A6] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-teal-300' : 'text-slate-400'}`} />
              <span>{tab.label}</span>

              {tab.badge && (
                <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-extrabold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.badge}
                </span>
              )}

              {/* Verified active role indicator badge */}
              {isUserRole && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-200" title="Authenticated Persona" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Supabase Cloud Connection & Configuration Modal */}
      <SupabaseModal
        isOpen={showSupabaseModal}
        onClose={() => setShowSupabaseModal(false)}
        onConfigSaved={onRefresh}
      />
    </header>
  );
}
