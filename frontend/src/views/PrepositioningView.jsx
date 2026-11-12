import React, { useState, useEffect } from 'react';
import {
  Navigation,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Ambulance,
  TrendingUp,
  Activity,
  Sparkles,
  Zap
} from 'lucide-react';
import { fetchPrepositioningRecommendations, applyPrepositioning } from '../services/api';

export default function PrepositioningView({ state, onRefresh }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState(null);

  const ambulances = state?.ambulances || [];
  const zones = state?.zones || [];

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const data = await fetchPrepositioningRecommendations();
      setRecommendations(data);
    } catch (e) {
      console.error("Failed to load recommendations", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
  }, [state]);

  const handleApply = async (ambId, targetZoneId) => {
    try {
      setApplyingId(ambId);
      await applyPrepositioning(ambId, targetZoneId);
      if (onRefresh) onRefresh();
      await loadRecommendations();
    } catch (e) {
      console.error("Apply failed", e);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs">
        <div className="flex items-center space-x-2 text-[#0F9D91]">
          <Navigation className="w-5 h-5 text-[#0F9D91]" />
          <span className="text-xs font-bold uppercase tracking-wider">Proactive Fleet Staging</span>
        </div>
        <h1 className="text-2xl font-black text-[#17324D] mt-1">Smart Ambulance Pre-positioning</h1>
        <p className="text-xs text-[#68778A]">
          Unlike legacy CAD systems that wait passively for 911 calls, RESQ-X continuously evaluates municipal coverage
          deficits and recommends relocating idle standby units into high-threat corridors before emergencies strike.
        </p>
      </div>

      {/* Recommendations Cards */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-[#0F9D91]" />
          <span>Active Redeployment Recommendations ({recommendations.length})</span>
        </h3>

        {recommendations.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <strong className="text-sm font-bold text-slate-800 block mb-1">Fleet Distribution Is Globally Balanced</strong>
            No coverage deficits or idle fleet surpluses currently require redeployment across the 8 zones.
          </div>
        ) : (
          recommendations.map((rec, idx) => {
            const amb = ambulances.find(a => a.id === rec.ambulance_id);
            const fromZone = zones.find(z => z.id === rec.from_zone_id);
            const toZone = zones.find(z => z.id === rec.to_zone_id);

            return (
              <div
                key={idx}
                className="bg-white rounded-2xl border-2 border-teal-500/40 p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="bg-teal-100 text-teal-800 font-bold text-[10px] uppercase px-2.5 py-0.5 rounded-full">
                      Strategic Movement
                    </span>
                    <strong className="text-sm font-black text-[#17324D]">{amb?.code || rec.ambulance_id}</strong>
                    <span className="text-xs text-slate-400 font-medium">({amb?.type || 'ALS'})</span>
                  </div>

                  <p className="text-xs text-[#243447] font-medium leading-relaxed">
                    {rec.reason}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                    <div className="flex items-center space-x-1.5 text-slate-600">
                      <span>Origin:</span>
                      <strong className="text-slate-800">{fromZone?.name || rec.from_zone_id}</strong>
                    </div>

                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />

                    <div className="flex items-center space-x-1.5 text-slate-600">
                      <span>Destination:</span>
                      <strong className="text-blue-700">{toZone?.name || rec.to_zone_id}</strong>
                    </div>

                    <div className="h-3 w-px bg-slate-300"></div>

                    <div className="flex items-center space-x-2">
                      <span className="text-slate-500">Coverage Gain:</span>
                      <span className="font-mono font-bold text-slate-500">{rec.expected_coverage_before}%</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-mono font-bold text-[#0F9D91]">+{rec.expected_coverage_after}%</span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  <button
                    onClick={() => handleApply(rec.ambulance_id, rec.to_zone_id)}
                    disabled={applyingId === rec.ambulance_id}
                    className="px-5 py-2.5 bg-[#0F9D91] hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-900/30 transition flex items-center space-x-2"
                  >
                    {applyingId === rec.ambulance_id ? (
                      <span>Repositioning...</span>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-teal-200" />
                        <span>Apply Recommendation</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Current Fleet Deployment Matrix */}
      <div className="bg-white rounded-2xl border border-[#E3E9EF] p-5 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider mb-2">
          Current Standby Ambulance Spatial Distribution
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {zones.map((z) => {
            const zAmbs = ambulances.filter(a => a.zone_id === z.id && a.status === 'Available');

            return (
              <div key={z.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-900 block truncate">{z.name}</span>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Standby Fleet:</span>
                  <strong className={`font-mono ${zAmbs.length === 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                    {zAmbs.length} Units
                  </strong>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Demand Index: <strong>{z.risk_score}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
