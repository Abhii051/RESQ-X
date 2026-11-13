import React, { useState, useEffect } from 'react';
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Sparkles,
  Info,
  TrendingUp
} from 'lucide-react';
import { fetchDispatchComparison } from '../services/api';

// Each row: label, field, unit, and whether lower is better
const METRICS = [
  { key: 'critical_time_to_right_care_min', label: 'Critical patients: time to right care', unit: 'min', lower: true, headline: true },
  { key: 'time_to_right_care_min', label: 'All patients: time to right care', unit: 'min', lower: true },
  { key: 'avg_response_time_min', label: 'First vehicle on scene', unit: 'min', lower: true },
  { key: 'icu_admission_time_min', label: 'ICU patients: call to ICU bed', unit: 'min', lower: true },
  { key: 'equipment_mismatches', label: 'Basic van sent to life-support case', unit: '', lower: true },
  { key: 'bed_mismatch_rate_pct', label: 'Hospital mismatch (wrong bed/specialty)', unit: '%', lower: true },
  { key: 'blackout_zone_exposure_pct', label: 'Zones with no unit within 8 min', unit: '%', lower: true },
  { key: 'fleet_utilization_pct', label: 'Fleet utilisation', unit: '%', lower: null }
];

const LOADS = [
  { id: 'light', label: 'Light' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'peak', label: 'Peak' },
  { id: 'surge', label: 'Surge' }
];

function fmt(v, unit) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${v}${unit === '%' ? '%' : unit ? ` ${unit}` : ''}`;
}

export default function ComparisonView({ state }) {
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState('stress');
  const [load, setLoad] = useState('peak');

  const loadComparison = async (sc = scenario, ld = load) => {
    try {
      setLoading(true);
      const data = await fetchDispatchComparison(sc, ld);
      setComparison(data);
    } catch (e) {
      console.error("Comparison failed", e);
    } finally {
      setLoading(false);
    }
  };

  // Reload when the scenario or demand level changes
  useEffect(() => {
    loadComparison(scenario, load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, load]);

  // Live mode also follows dashboard state; the seeded simulation doesn't need to
  useEffect(() => {
    if (scenario === 'live') loadComparison('live', load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const trad = comparison?.traditional_greedy;
  const resqx = comparison?.resqx_coordinated;
  const imp = comparison?.improvements;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#2563A6]">
            <Scale className="w-5 h-5 text-[#2563A6]" />
            <span className="text-xs font-bold uppercase tracking-wider">Algorithmic Benchmark</span>
          </div>
          <h1 className="text-2xl font-black text-[#17324D] mt-1">AI vs Traditional Dispatch Comparison</h1>
          <p className="text-xs text-[#68778A]">
            Same calls, same fleet, same hospitals: legacy nearest-vehicle CAD vs RESQ-X coordinated dispatch,
            measured by when the right level of care actually reaches the patient.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-bold">
            {[['stress', 'Rush-hour simulation'], ['live', 'Live dashboard']].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setScenario(id)}
                className={`px-3 py-2 ${scenario === id ? 'bg-[#17324D] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => loadComparison()}
            disabled={loading}
            className="px-4 py-2 bg-[#17324D] hover:bg-[#2563A6] text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-2"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-Run Benchmark</span>
          </button>
        </div>
      </div>

      {/* Scenario + load selector */}
      <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex items-start space-x-2">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold">Scenario:</strong> {comparison?.scenario_description || 'Loading…'}
            {comparison?.consistency && <span className="ml-1">· {comparison.consistency}.</span>}
          </div>
        </div>
        {scenario === 'stress' && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] uppercase font-bold text-blue-700 mr-1">Demand</span>
            {LOADS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLoad(l.id)}
                className={`px-2.5 py-1 rounded-lg font-bold ${load === l.id ? 'bg-blue-700 text-white' : 'bg-white text-blue-800 border border-blue-200'}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Headline */}
      {imp && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-[#0F9D91] to-[#17324D] text-white p-5 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-teal-200">Critical care reaches patient</span>
            <div className="text-3xl font-black mt-1">
              {imp.critical_right_care_faster_pct > 0 ? `${imp.critical_right_care_faster_pct}% sooner` : 'No change'}
            </div>
            <div className="text-xs text-teal-100 mt-1">
              {trad?.critical_time_to_right_care_min} → {resqx?.critical_time_to_right_care_min} min
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF]">
            <span className="text-[10px] uppercase font-bold text-slate-500">Hospital mismatch rate</span>
            <div className="text-3xl font-black text-[#17324D] mt-1">
              {trad?.bed_mismatch_rate_pct}% → {resqx?.bed_mismatch_rate_pct}%
            </div>
            <div className="text-xs text-slate-500 mt-1">{trad?.secondary_transfers} second transfers avoided</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF]">
            <span className="text-[10px] uppercase font-bold text-slate-500">Wrong vehicle for life-support case</span>
            <div className="text-3xl font-black text-[#17324D] mt-1">
              {trad?.equipment_mismatches} → {resqx?.equipment_mismatches}
            </div>
            <div className="text-xs text-slate-500 mt-1">BLS vans sent to cardiac arrest, stroke, unconscious</div>
          </div>
        </div>
      )}

      {/* Side-by-side metric table */}
      <div className="bg-white rounded-2xl border border-[#E3E9EF] p-5 shadow-2xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
              <th className="pb-2">Metric</th>
              <th className="pb-2 text-right">Traditional CAD<br /><span className="normal-case font-normal">nearest unit + nearest hospital</span></th>
              <th className="pb-2 text-right text-[#0F9D91]">RESQ-X<br /><span className="normal-case font-normal">triage + optimizer + capacity</span></th>
              <th className="pb-2 text-right">Difference</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => {
              const a = trad?.[m.key];
              const b = resqx?.[m.key];
              const diff = typeof a === 'number' && typeof b === 'number' ? Math.round((b - a) * 10) / 10 : null;
              const better = m.lower === null || diff === null || diff === 0 ? null : (m.lower ? diff < 0 : diff > 0);
              return (
                <tr key={m.key} className={`border-t border-slate-100 ${m.headline ? 'bg-teal-50/40 font-bold' : ''}`}>
                  <td className="py-2.5 text-slate-700">{m.label}</td>
                  <td className="py-2.5 text-right font-mono text-slate-800">{fmt(a, m.unit)}</td>
                  <td className="py-2.5 text-right font-mono text-[#0F9D91] font-bold">{fmt(b, m.unit)}</td>
                  <td className={`py-2.5 text-right font-mono font-bold ${better === true ? 'text-emerald-600' : better === false ? 'text-amber-600' : 'text-slate-400'}`}>
                    {diff === null ? '—' : `${diff > 0 ? '+' : ''}${diff}${m.unit === '%' ? ' pts' : m.unit ? ` ${m.unit}` : ''}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Load sweep */}
      {scenario === 'stress' && comparison?.load_sweep && (
        <div className="bg-white rounded-2xl border border-[#E3E9EF] p-5 shadow-2xs">
          <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider mb-3 flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-[#2563A6]" />
            <span>How the advantage scales with city demand</span>
          </h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase text-slate-500">
                <th className="pb-2">Demand level</th>
                <th className="pb-2 text-right">Critical right care (trad → RESQ-X)</th>
                <th className="pb-2 text-right">Faster</th>
                <th className="pb-2 text-right">First vehicle (trad → RESQ-X)</th>
                <th className="pb-2 text-right">Hospital mismatch</th>
              </tr>
            </thead>
            <tbody>
              {comparison.load_sweep.map((l) => (
                <tr key={l.id} className={`border-t border-slate-100 ${l.id === comparison.headline_load ? 'bg-blue-50/50 font-bold' : ''}`}>
                  <td className="py-2">{l.label}</td>
                  <td className="py-2 text-right font-mono">{l.traditional_critical_right_care_min} → {l.resqx_critical_right_care_min} min</td>
                  <td className="py-2 text-right font-mono text-emerald-600 font-bold">{l.critical_right_care_faster_pct}%</td>
                  <td className="py-2 text-right font-mono">{l.traditional_first_arrival_min} → {l.resqx_first_arrival_min} min</td>
                  <td className="py-2 text-right font-mono">{l.traditional_bed_mismatch_pct}% → {l.resqx_bed_mismatch_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Key Findings */}
      <div className="bg-white rounded-2xl border border-[#E3E9EF] p-5 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-[#0F9D91]" />
          <span>Calculated Findings</span>
        </h3>

        <div className="space-y-2">
          {comparison?.key_findings?.map((finding, idx) => {
            const isTradeoff = finding.startsWith('Trade-off');
            return (
              <div key={idx} className={`p-3 rounded-xl border text-xs flex items-start space-x-2.5 ${isTradeoff ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-[#243447]'}`}>
                {isTradeoff
                  ? <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  : <CheckCircle2 className="w-4 h-4 text-[#0F9D91] shrink-0 mt-0.5" />}
                <span className="font-medium leading-relaxed">{finding}</span>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-slate-500 pt-2 border-t border-slate-100 leading-relaxed italic">
          <strong className="not-italic">Methodology:</strong> {comparison?.explanation}
        </p>
      </div>
    </div>
  );
}
