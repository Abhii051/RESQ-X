import React, { useState } from 'react';
import {
  FlaskConical,
  Zap,
  Activity,
  CloudRain,
  Flame,
  RotateCcw,
  GitFork,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import RippleAnalyzerView from './RippleAnalyzerView';
import { triggerSimulationEvent } from '../services/api';

const SHOCK_ACTIONS = [
  {
    id: 'ambulance-failure',
    label: '1. Ambulance Breakdown',
    icon: Zap,
    color: 'text-red-500',
    desc: 'Triggers sudden engine breakdown on RESQ-A01. Evaluates ripple effects and dynamically reallocates idle backup without disrupting ongoing critical cardiac transports.'
  },
  {
    id: 'hospital-full',
    label: '2. Hospital ICU Saturation',
    icon: Activity,
    color: 'text-amber-500',
    desc: 'Saturates Care Hospital ICU (0 available beds). Automatically activates patient diversion protocols to reroute ambulances to NIMS or Continental.'
  },
  {
    id: 'heavy-rainfall',
    label: '3. Monsoon Weather Disruption',
    icon: CloudRain,
    color: 'text-blue-500',
    desc: 'Simulates heavy urban waterlogging across Kukatpally and Banjara corridors. Increases travel multipliers by 1.45x - 1.85x and recalculates active transit ETAs.'
  },
  {
    id: 'new-cardiac',
    label: '4. Critical Cardiac Surge Arrival',
    icon: Flame,
    color: 'text-rose-500',
    desc: 'Injects high-threat acute cardiac arrest into the network. Tests severity-based triage prioritizing this critical emergency ahead of routine non-urgent transfers.'
  }
];

export default function DisruptionRippleView({ state, onRefresh }) {
  const [runningAction, setRunningAction] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const handleAction = async (actionId) => {
    try {
      setRunningAction(actionId);
      const res = await triggerSimulationEvent(actionId);
      setLastResult(res);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Simulation trigger failed", e);
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Shock Triggers Control Bar */}
      <div className="p-6 max-w-7xl mx-auto space-y-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-[#DC3545]">
              <FlaskConical className="w-5 h-5 text-[#DC3545]" />
              <span className="text-xs font-bold uppercase tracking-wider">Disruption & Chaos Engineering</span>
            </div>
            <h1 className="text-2xl font-black text-[#17324D] mt-1">Crisis Shock Simulator & Dynamic Reallocation</h1>
            <p className="text-xs text-[#68778A]">
              Test how RESQ-X self-adapts when resources suddenly fail. Click any disruption shock below to observe real-time ripple analysis,
              automatic replanning, and explainable decision logs.
            </p>
          </div>

          <button
            onClick={() => handleAction('reset')}
            disabled={runningAction !== null}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-2 shrink-0"
          >
            <RotateCcw className="w-4 h-4 text-slate-300" />
            <span>Reset Demo Baseline State</span>
          </button>
        </div>

        {/* 4 Interactive Shock Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SHOCK_ACTIONS.map((action) => {
            const Icon = action.icon;
            const isRunning = runningAction === action.id;

            return (
              <div
                key={action.id}
                className="bg-white p-4 rounded-2xl border border-[#E3E9EF] shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <Icon className={`w-5 h-5 ${action.color}`} />
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Shock Trigger</span>
                  </div>
                  <h4 className="text-xs font-bold text-[#17324D]">{action.label}</h4>
                  <p className="text-[11px] text-[#68778A] mt-1 leading-relaxed">{action.desc}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleAction(action.id)}
                    disabled={isRunning}
                    className="w-full py-2 bg-[#17324D] hover:bg-[#2563A6] disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center justify-center space-x-1.5"
                  >
                    <span>{isRunning ? 'Executing Shock...' : 'Trigger Shock'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Shock Execution Feedback Banner */}
        {lastResult && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold text-sm text-emerald-950">
                Disruption Event Processed: {lastResult.event || 'CRISIS_EVENT_TRIGGERED'}
              </strong>
              <p className="text-xs text-emerald-800">
                Network recomputed allocations. View the cascading ripple analysis graph and updated transit routes below.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Signature Ripple Effect Analyzer Graph & Cascading Details */}
      <RippleAnalyzerView state={state} onRefresh={onRefresh} />
    </div>
  );
}
