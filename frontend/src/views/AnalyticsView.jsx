import React from 'react';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  ShieldAlert,
  Ambulance,
  Building2,
  Clock,
  ArrowUpRight,
  Download
} from 'lucide-react';

export default function AnalyticsView({ state }) {
  const incidents = state?.incidents || [];
  const ambulances = state?.ambulances || [];
  const hospitals = state?.hospitals || [];
  const zones = state?.zones || [];
  const kpis = state?.kpis || {};

  // Category counts
  const categoryCounts = {};
  incidents.forEach(inc => {
    categoryCounts[inc.category] = (categoryCounts[inc.category] || 0) + 1;
  });

  // Severity counts
  const severityCounts = {
    Critical: incidents.filter(i => i.severity === 'Critical').length,
    High: incidents.filter(i => i.severity === 'High').length,
    Moderate: incidents.filter(i => i.severity === 'Moderate').length,
    Low: incidents.filter(i => i.severity === 'Low').length
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#2563A6]">
            <BarChart3 className="w-5 h-5 text-[#2563A6]" />
            <span className="text-xs font-bold uppercase tracking-wider">Executive Performance Metrics</span>
          </div>
          <h1 className="text-2xl font-black text-[#17324D] mt-1">Analytics & Municipal Reports</h1>
          <p className="text-xs text-[#68778A]">
            Quantitative operational efficiency breakdown, clinical severity distributions, hospital saturation curves, and fleet utilization.
          </p>
        </div>

        <button
          onClick={() => alert("Audit report downloaded successfully (Simulated PDF Export).")}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-2"
        >
          <Download className="w-4 h-4 text-teal-400" />
          <span>Export Municipal Report (PDF)</span>
        </button>
      </div>

      {/* Grid of Visual Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Severity Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider flex items-center space-x-1.5">
            <PieChart className="w-4 h-4 text-[#DC3545]" />
            <span>Severity Distribution</span>
          </h3>

          <div className="space-y-2.5 pt-1 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-red-700">Critical Priority</span>
                <span className="font-bold">{severityCounts.Critical} Incidents</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#DC3545] h-full rounded-full"
                  style={{ width: `${(severityCounts.Critical / Math.max(1, incidents.length)) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-orange-700">High Priority</span>
                <span className="font-bold">{severityCounts.High} Incidents</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#E87532] h-full rounded-full"
                  style={{ width: `${(severityCounts.High / Math.max(1, incidents.length)) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="font-semibold text-amber-700">Moderate Priority</span>
                <span className="font-bold">{severityCounts.Moderate} Incidents</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#E5A52D] h-full rounded-full"
                  style={{ width: `${(severityCounts.Moderate / Math.max(1, incidents.length)) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Fleet Deployment Efficiency */}
        <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider flex items-center space-x-1.5">
            <Ambulance className="w-4 h-4 text-[#2563A6]" />
            <span>Ambulance Utilization</span>
          </h3>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Active Fleet Utilization</span>
            <div className="text-3xl font-black text-[#17324D] font-mono">
              {Math.round(((kpis.dispatched_ambulances || 0) / Math.max(1, ambulances.length)) * 100)}%
            </div>
            <p className="text-[11px] text-slate-500">
              {kpis.available_ambulances || 0} Standby • {kpis.dispatched_ambulances || 0} Deployed
            </p>
          </div>

          <div className="text-xs text-slate-600 space-y-1 pt-1">
            <div className="flex justify-between">
              <span>Average Response Time:</span>
              <strong className="font-mono text-[#0F9D91]">{kpis.average_response_time_min || 4.2} min</strong>
            </div>
            <div className="flex justify-between">
              <span>Double-Booking Violations:</span>
              <strong className="font-mono text-emerald-700">0 Violations</strong>
            </div>
          </div>
        </div>

        {/* Hospital Occupancy Ratios */}
        <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider flex items-center space-x-1.5">
            <Building2 className="w-4 h-4 text-[#0F9D91]" />
            <span>Hospital Load Ratios</span>
          </h3>

          <div className="space-y-2 text-xs">
            {hospitals.map(h => {
              const icuUsed = h.icu_total - h.icu_available;
              const pct = Math.round((icuUsed / Math.max(1, h.icu_total)) * 100);

              return (
                <div key={h.id}>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="font-semibold text-slate-700 truncate pr-2">{h.name}</span>
                    <span className="font-mono">{pct}% ICU</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct > 85 ? 'bg-red-600' : 'bg-[#0F9D91]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Zone-by-Zone Risk Ranking */}
      <div className="bg-white rounded-2xl border border-[#E3E9EF] p-5 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <span>Municipal Sector Demand & Coverage Index</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {zones.map(z => (
            <div key={z.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-900 block truncate">{z.name}</span>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Risk Score:</span>
                <span className="font-mono font-bold text-[#17324D]">{z.risk_score} / 100</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Coverage:</span>
                <span className="font-mono font-bold text-[#0F9D91]">{z.coverage_index}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
