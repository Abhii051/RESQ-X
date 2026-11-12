import React, { useState } from 'react';
import {
  FlaskConical,
  Zap,
  Activity,
  CloudRain,
  Flame,
  RotateCcw,
  CheckCircle2,
  Terminal,
  Clock
} from 'lucide-react';
import { triggerSimulationEvent } from '../services/api';

const SIM_ACTIONS = [
  { id: 'ambulance-failure', label: 'Ambulance Breakdown', icon: Zap, color: 'text-red-500', desc: 'Triggers engine failure on RESQ-A01. Engine reallocates idle standby without disrupting active cardiac missions.' },
  { id: 'hospital-full', label: 'Hospital ICU Saturation', icon: Activity, color: 'text-amber-500', desc: 'Saturates Care Hospital ICU capacity (0 beds), triggering proactive patient diversions.' },
  { id: 'heavy-rainfall', label: 'Severe Monsoon Inundation', icon: CloudRain, color: 'text-blue-500', desc: 'Waterlogging increases transit times across Banjara and Koti corridors by 1.45x.' },
  { id: 'new-cardiac', label: 'Critical Cardiac Surge', icon: Flame, color: 'text-rose-500', desc: 'Injects high-threat cardiac arrest in Gachibowli requiring immediate ALS/Cath Lab pairing.' },
  { id: 'reset', label: 'Reset Demonstration State', icon: RotateCcw, color: 'text-slate-600', desc: 'Restores the 10 ambulances, 5 hospitals, and 3 initial demonstration cases.' }
];

export default function SimulationCentreView({ state, onRefresh }) {
  const [activeLog, setActiveLog] = useState(null);
  const [runningAction, setRunningAction] = useState(null);

  const decisionLogs = state?.decision_logs || [];

  const handleAction = async (actionId) => {
    try {
      setRunningAction(actionId);
      const res = await triggerSimulationEvent(actionId);
      setActiveLog(res);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Simulation failed", e);
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#2563A6]">
            <FlaskConical className="w-5 h-5 text-[#2563A6]" />
            <span className="text-xs font-bold uppercase tracking-wider">Dynamic Crisis Simulator</span>
          </div>
          <h1 className="text-2xl font-black text-[#17324D] mt-1">Simulation Control Lab</h1>
          <p className="text-xs text-[#68778A]">
            Trigger urban shocks to demonstrate RESQ-X's dynamic reallocation, early warnings, and cascading ripple prevention in real time.
          </p>
        </div>

        <button
          onClick={() => handleAction('reset')}
          disabled={runningAction !== null}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
        >
          <RotateCcw className="w-4 h-4 text-slate-300" />
          <span>Reset Demonstration State</span>
        </button>
      </div>

      {/* Grid: 5 Clean Trigger Cards Left, Real-time Output Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shock Triggers */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider mb-2">
            Click to Trigger Crisis Shock
          </h3>

          <div className="space-y-3">
            {SIM_ACTIONS.map((action) => {
              const Icon = action.icon;
              const isRunning = runningAction === action.id;

              return (
                <div
                  key={action.id}
                  className="bg-white p-4 rounded-xl border border-[#E3E9EF] shadow-2xs hover:shadow-xs transition flex items-center justify-between gap-3"
                >
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 shrink-0">
                      <Icon className={`w-5 h-5 ${action.color}`} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#17324D]">{action.label}</h4>
                      <p className="text-[11px] text-[#68778A] mt-0.5 leading-relaxed">{action.desc}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAction(action.id)}
                    disabled={isRunning}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold text-white shrink-0 shadow-xs transition ${
                      action.id === 'reset'
                        ? 'bg-slate-700 hover:bg-slate-800'
                        : 'bg-[#17324D] hover:bg-[#2563A6]'
                    }`}
                  >
                    {isRunning ? 'Running...' : 'Trigger'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Simulation Response Terminal */}
        <div className="bg-[#12263a] rounded-2xl border border-slate-700 p-5 text-white flex flex-col justify-between shadow-md h-[440px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-teal-400" />
                <span className="text-xs font-mono font-bold text-teal-400 uppercase tracking-wider">
                  Live Network Telemetry Stream
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">ONLINE</span>
            </div>

            <div className="mt-3 overflow-y-auto max-h-72 custom-scrollbar pr-1 font-mono text-xs space-y-2.5">
              {activeLog ? (
                <div className="space-y-2 animate-in fade-in duration-150">
                  <div className="text-emerald-400 font-bold">
                    ✓ EVENT: {activeLog.event} ({activeLog.timestamp})
                  </div>
                  {activeLog.reallocation_decision && (
                    <div className="text-teal-200 bg-slate-800/90 p-3 rounded-lg border border-teal-500/30">
                      {activeLog.reallocation_decision}
                    </div>
                  )}
                  {activeLog.updated_etas?.length > 0 && (
                    <div className="text-blue-300 bg-slate-800/90 p-3 rounded-lg border border-blue-500/30">
                      Updated ETAs: {activeLog.updated_etas.map(u => `${u.ambulance} -> ${u.new_eta}m`).join(', ')}
                    </div>
                  )}
                  {activeLog.diverted_incidents?.length > 0 && (
                    <div className="text-amber-300 bg-slate-800/90 p-3 rounded-lg border border-amber-500/30">
                      Diverted: {activeLog.diverted_incidents.map(d => `${d.incident_id} to ${d.to_hospital}`).join(', ')}
                    </div>
                  )}
                  {activeLog.message && (
                    <div className="text-slate-300 p-2 bg-slate-800/50 rounded">{activeLog.message}</div>
                  )}
                </div>
              ) : (
                <div className="text-slate-500 py-16 text-center text-xs">
                  Click any trigger on the left to observe live network state recalculations.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-700 text-[10px] text-slate-400 flex justify-between font-mono">
            <span>State synchronized across all connected clients</span>
            <span>Real-time WebSocket</span>
          </div>
        </div>
      </div>

      {/* Decision Audit Trail */}
      <div className="bg-white rounded-2xl border border-[#E3E9EF] p-5 shadow-2xs space-y-3">
        <span className="text-xs font-bold text-[#17324D] uppercase tracking-wider flex items-center space-x-2">
          <Clock className="w-4 h-4 text-[#2563A6]" />
          <span>Chronological Decision Trail ({decisionLogs.length} Records)</span>
        </span>

        <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
          {decisionLogs.slice(0, 5).map((log) => (
            <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#17324D]">{log.decision}</span>
                <span className="font-mono text-slate-400 text-[10px]">{log.timestamp}</span>
              </div>
              <p className="text-slate-600 mt-1 text-[11px] leading-relaxed">{log.reason}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
