import React, { useState, useEffect } from 'react';
import {
  GitFork,
  Zap,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Activity,
  Layers,
  Info,
  Clock,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { fetchRippleAnalysis, triggerSimulationEvent } from '../services/api';

export default function RippleAnalyzerView({ state, onRefresh }) {
  const [selectedResourceId, setSelectedResourceId] = useState("amb-01");
  const [resourceType, setResourceType] = useState("ambulance");
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  const ambulances = state?.ambulances || [];
  const hospitals = state?.hospitals || [];

  const loadAnalysis = async (resId, type) => {
    try {
      setLoading(true);
      const data = await fetchRippleAnalysis(resId, type);
      setAnalysisData(data);
      if (data.nodes && data.nodes.length > 0) {
        setSelectedNode(data.nodes[0]);
      }
    } catch (err) {
      console.error("Failed to fetch ripple analysis", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalysis(selectedResourceId, resourceType);
  }, [selectedResourceId, resourceType]);

  const handleTriggerRealFailure = async () => {
    try {
      setLoading(true);
      if (resourceType === 'ambulance') {
        await triggerSimulationEvent('ambulance-failure', { ambulance_id: selectedResourceId });
      } else {
        await triggerSimulationEvent('hospital-full', { hospital_id: selectedResourceId });
      }
      if (onRefresh) onRefresh();
      await loadAnalysis(selectedResourceId, resourceType);
    } catch (err) {
      console.error("Failed to trigger failure", err);
    } finally {
      setLoading(false);
    }
  };

  // Node position layout calculation for interactive SVG graph
  const nodes = analysisData?.nodes || [];
  const edges = analysisData?.edges || [];

  // Compute clean layout positions: Failure top-center, Incidents middle, Ambulances/Hospitals surrounding
  const nodePositions = {};
  const width = 720;
  const height = 440;

  nodes.forEach((n, idx) => {
    if (n.type === 'failure') {
      nodePositions[n.id] = { x: width * 0.5, y: 70 };
    } else if (n.type === 'incident') {
      const incCount = nodes.filter(x => x.type === 'incident').length;
      const incIdx = nodes.filter(x => x.type === 'incident').indexOf(n);
      const spread = (width - 160) / Math.max(1, incCount);
      nodePositions[n.id] = { x: 120 + incIdx * spread, y: 190 };
    } else if (n.type === 'ambulance') {
      const ambCount = nodes.filter(x => x.type === 'ambulance').length;
      const ambIdx = nodes.filter(x => x.type === 'ambulance').indexOf(n);
      const spread = (width - 140) / Math.max(1, ambCount);
      nodePositions[n.id] = { x: 90 + ambIdx * spread, y: 320 };
    } else if (n.type === 'hospital') {
      nodePositions[n.id] = { x: width * 0.82, y: 220 };
    } else if (n.type === 'zone') {
      const zCount = nodes.filter(x => x.type === 'zone').length;
      const zIdx = nodes.filter(x => x.type === 'zone').indexOf(n);
      nodePositions[n.id] = { x: width * 0.5 + (zIdx - (zCount - 1) / 2) * 160, y: 405 };
    } else {
      nodePositions[n.id] = { x: 100 + (idx * 90) % (width - 150), y: 350 };
    }
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#17324D] via-[#1a3c61] to-[#0F9D91] text-white p-6 rounded-2xl shadow-md border border-slate-700/50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-white/20 text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full backdrop-blur-md">
              SIGNATURE HACKATHON FEATURE
            </span>
            <span className="text-teal-300 text-xs font-semibold">• Multi-Order Shock Propagation</span>
          </div>
          <h1 className="text-2xl font-black mt-1.5 flex items-center space-x-2.5">
            <GitFork className="w-6 h-6 text-teal-300" />
            <span>Emergency Ripple Effect Analyzer</span>
          </h1>
          <p className="text-xs text-slate-200 max-w-2xl mt-1">
            Predicts and visualizes cascading dependencies across the entire smart city emergency response mesh.
            Calculates how a single asset outage propagates 1st and 2nd order disruptions, and computes mathematically
            coordinated reallocations that protect ongoing critical patient commitments.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md flex items-center space-x-2 border border-white/10 text-xs">
            <span className="text-slate-300 font-medium">Test Resource:</span>
            <select
              value={selectedResourceId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedResourceId(val);
                setResourceType(val.startsWith('amb') ? 'ambulance' : 'hospital');
              }}
              className="bg-[#12263a] text-white font-bold rounded-lg px-2.5 py-1.5 border border-teal-500/40 text-xs focus:ring-1 focus:ring-teal-400 outline-none"
            >
              <optgroup label="Ambulances">
                {ambulances.map(a => (
                  <option key={a.id} value={a.id}>{a.code} ({a.type} - {a.status})</option>
                ))}
              </optgroup>
              <optgroup label="Hospitals">
                {hospitals.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          <button
            onClick={handleTriggerRealFailure}
            disabled={loading}
            className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white rounded-xl text-xs font-bold shadow-md shadow-red-900/40 transition flex items-center justify-center space-x-2"
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>Simulate Breakdown</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Interactive Network Graph + Impact Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Graph Canvas */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E3E9EF] shadow-2xs overflow-hidden flex flex-col h-[520px]">
          <div className="p-4 border-b border-[#E3E9EF] flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0F9D91] animate-pulse"></span>
              <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider">
                Live Cascade Topology & Dependency Graph
              </h3>
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Click any node to inspect ripple propagation
            </div>
          </div>

          <div className="flex-1 w-full h-full relative bg-[#0d1d2d] overflow-hidden select-none">
            {/* SVG Interactive Topology Canvas */}
            <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`}>
              <defs>
                <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#DC3545" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#0F9D91" stopOpacity="0.8" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="glow" />
                  <feComposite in="SourceGraphic" in2="glow" operator="over" />
                </filter>
              </defs>

              {/* Render Directed Edges */}
              {edges.map((e, idx) => {
                const s = nodePositions[e.source];
                const t = nodePositions[e.target];
                if (!s || !t) return null;

                const isRecommended = e.relation === 'recommended_alternative';
                const isConflict = e.relation === 'potential_conflict';
                const isDepends = e.relation === 'depends_on';

                const strokeColor = isRecommended
                  ? '#0F9D91'
                  : isConflict
                  ? '#E87532'
                  : isDepends
                  ? '#DC3545'
                  : '#3b82f6';

                return (
                  <g key={`edge-${idx}`}>
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={strokeColor}
                      strokeWidth={isRecommended ? 3.5 : isDepends ? 2.5 : 2}
                      strokeDasharray={isConflict ? '5,5' : isRecommended ? 'none' : e.style === 'pulse' ? '6,4' : 'none'}
                      opacity={isConflict ? 0.6 : 0.9}
                      filter={isRecommended ? 'url(#glow)' : undefined}
                    />
                    {/* Edge Label Pill */}
                    <rect
                      x={(s.x + t.x) / 2 - 45}
                      y={(s.y + t.y) / 2 - 9}
                      width={90}
                      height={18}
                      rx={4}
                      fill="#17324D"
                      stroke={strokeColor}
                      strokeWidth={1}
                      opacity={0.85}
                    />
                    <text
                      x={(s.x + t.x) / 2}
                      y={(s.y + t.y) / 2 + 3}
                      fill="#FFFFFF"
                      fontSize="8.5"
                      fontFamily="sans-serif"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {e.label.slice(0, 15)}
                    </text>
                  </g>
                );
              })}

              {/* Render Nodes */}
              {nodes.map((n) => {
                const pos = nodePositions[n.id] || { x: 100, y: 100 };
                const isFailed = n.status === 'failed';
                const isAffected = n.status === 'affected';
                const isIndirect = n.status === 'indirect_affected';
                const isCandidate = n.status === 'candidate';
                const isStandby = n.status === 'standby';
                const isSelected = selectedNode?.id === n.id;

                const fillColor = isFailed
                  ? '#DC3545'
                  : isAffected
                  ? '#E87532'
                  : isIndirect
                  ? '#E5A52D'
                  : isCandidate
                  ? '#0F9D91'
                  : isStandby
                  ? '#94A3B8'
                  : '#2563A6';

                return (
                  <g
                    key={n.id}
                    onClick={() => setSelectedNode(n)}
                    className="cursor-pointer transition-transform duration-150 hover:scale-105"
                  >
                    {/* Halo ring for selected or failed node */}
                    {(isSelected || isFailed) && (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={28}
                        fill="none"
                        stroke={isFailed ? '#DC3545' : '#0F9D91'}
                        strokeWidth={2}
                        opacity={0.6}
                        className={isFailed ? 'animate-ping' : ''}
                      />
                    )}

                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={20}
                      fill={fillColor}
                      stroke="#FFFFFF"
                      strokeWidth={2.5}
                      filter="url(#glow)"
                    />

                    {/* Node Type Abbreviation inside node */}
                    <text
                      x={pos.x}
                      y={pos.y + 4}
                      fill="#FFFFFF"
                      fontSize="10"
                      fontFamily="sans-serif"
                      fontWeight="900"
                      textAnchor="middle"
                    >
                      {n.type === 'failure' ? '!' : n.type === 'incident' ? 'INC' : n.type === 'ambulance' ? 'AMB' : n.type === 'zone' ? 'GAP' : 'HSP'}
                    </text>

                    {/* Label below node */}
                    <text
                      x={pos.x}
                      y={pos.y + 34}
                      fill="#E3E9EF"
                      fontSize="9.5"
                      fontFamily="sans-serif"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {n.label.slice(0, 18)}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* In-Graph Legend */}
            <div className="absolute bottom-3 left-3 bg-[#17324D]/90 backdrop-blur-md p-2 rounded-lg border border-slate-600 text-[10px] text-slate-200 space-y-1">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#DC3545]"></span>
                <span>Shock / Breakdown</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E87532]"></span>
                <span>Directly Affected</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E5A52D]"></span>
                <span>Protected Active Mission</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0F9D91]"></span>
                <span>Recommended Solution</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Coordinated Action & Impact Summary */}
        <div className="space-y-4 flex flex-col justify-between">
          {/* AI Coordinated Recommendation Card */}
          <div className="bg-gradient-to-br from-teal-900/10 via-white to-blue-50 border-2 border-[#0F9D91] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center space-x-2 text-[#0F9D91] mb-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-wider">
                Optimal Coordinated Recommendation
              </span>
            </div>
            <h4 className="text-sm font-black text-[#17324D]">
              {analysisData?.recommended_action || "Awaiting simulation calculation..."}
            </h4>
            <p className="text-xs text-[#243447] mt-2 font-medium leading-relaxed bg-white/80 p-3 rounded-xl border border-teal-100">
              {analysisData?.action_reasoning || "Analyzing network graph..."}
            </p>
            <div className="mt-3 pt-3 border-t border-teal-100/60 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">ETA Impact:</span>
              <span className="font-bold text-[#0F9D91]">{analysisData?.eta_change_summary || "0 min"}</span>
            </div>
          </div>

          {/* Confirmed vs Potential Impact Breakdown */}
          <div className="bg-white rounded-2xl border border-[#E3E9EF] p-4 shadow-2xs space-y-3 flex-1">
            <h4 className="text-xs font-bold text-[#17324D] uppercase tracking-wider flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span>Multi-Tier Impact Assessment</span>
            </h4>

            {/* Confirmed Direct Impact */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-red-600 flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-red-600"></span>
                <span>Confirmed Direct Impact</span>
              </div>
              {analysisData?.confirmed_impact?.map((c, i) => (
                <div key={i} className="text-xs bg-red-50 text-red-900 p-2 rounded-lg border border-red-200">
                  {c}
                </div>
              ))}
            </div>

            {/* Potential Cascading Impact */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-amber-600 flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                <span>Potential Cascading Risks (Avoided)</span>
              </div>
              {analysisData?.potential_impact?.map((p, i) => (
                <div key={i} className="text-xs bg-amber-50 text-amber-900 p-2 rounded-lg border border-amber-200">
                  {p}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Latency & Reserve Mobilization */}
      {(analysisData?.secondary_latency_impacts?.length > 0 || analysisData?.reserve_mobilization?.length > 0) && (
        <div className="bg-white rounded-2xl border border-[#E3E9EF] p-5 shadow-2xs grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider mb-3 flex items-center space-x-2">
              <Activity className="w-4 h-4 text-amber-500" />
              <span>Secondary Response-Time Impact</span>
            </h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase text-slate-500 text-left">
                  <th className="pb-1.5">{analysisData?.resource_type === 'hospital' ? 'Incident' : 'Zone'}</th>
                  <th className="pb-1.5 text-right">Before</th>
                  <th className="pb-1.5 text-right">After</th>
                  <th className="pb-1.5 text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {analysisData.secondary_latency_impacts.slice(0, 6).map((z) => (
                  <tr key={z.zone_id || z.incident_id} className="border-t border-slate-100">
                    <td className="py-1.5 font-semibold text-slate-700">
                      {z.zone_name || z.incident_id}
                      {z.below_target && <span className="ml-1 text-[9px] font-bold text-red-600">BEYOND {analysisData.response_target_minutes}m</span>}
                      {!z.below_target && z.lost_own_unit && <span className="ml-1 text-[9px] font-bold text-amber-600">NO OWN UNIT</span>}
                    </td>
                    <td className="py-1.5 text-right font-mono">{z.eta_before ?? '∞'}m</td>
                    <td className="py-1.5 text-right font-mono">{z.eta_after ?? '∞'}m</td>
                    <td className={`py-1.5 text-right font-mono font-bold ${(z.delta_minutes ?? 99) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {z.delta_minutes == null ? '∞' : `${z.delta_minutes > 0 ? '+' : ''}${z.delta_minutes}m`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider mb-3 flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-[#0F9D91]" />
              <span>Reserve Mobilization Plan</span>
            </h3>
            {analysisData?.reserve_mobilization?.length > 0 ? (
              <div className="space-y-2">
                {analysisData.reserve_mobilization.map((m) => (
                  <div key={m.gap_zone_id} className="p-3 rounded-xl border border-teal-200 bg-teal-50/40 text-xs">
                    <div className="font-bold text-[#17324D]">
                      {m.reserve_unit} ({m.reserve_type}): {m.donor_zone_name} → {m.gap_zone_name}
                    </div>
                    <div className="text-slate-600 mt-1">
                      Reposition {m.reposition_minutes} min · {m.gap_zone_name} response {m.coverage_eta_before ?? '∞'}m → ~{m.coverage_eta_after}m ·
                      {m.donor_units_left > 0 ? ` donor keeps ${m.donor_units_left} unit(s)` : ' donor left without own unit'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No safe reserve move: every spare unit would uncover a zone of equal or higher risk. Hold positions and pre-alert mutual aid.</p>
            )}
            {analysisData?.computation_ms != null && (
              <p className="text-[10px] text-slate-400 mt-3">Cascade computed in {analysisData.computation_ms} ms</p>
            )}
          </div>
        </div>
      )}

      {/* Evaluated Options & Trade-offs Table */}
      <div className="bg-white rounded-2xl border border-[#E3E9EF] p-5 shadow-2xs">
        <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider mb-3 flex items-center space-x-2">
          <Activity className="w-4 h-4 text-[#2563A6]" />
          <span>Coordinated Options Evaluated by Allocation Engine</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analysisData?.options_evaluated?.map((opt) => (
            <div
              key={opt.option_id}
              className={`p-4 rounded-xl border text-xs ${
                opt.feasible
                  ? 'border-teal-300 bg-teal-50/30'
                  : 'border-red-200 bg-red-50/20'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-[#17324D] text-sm">{opt.title}</span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                  opt.feasible ? 'bg-[#0F9D91] text-white' : 'bg-red-600 text-white'
                }`}>
                  {opt.feasible ? 'Recommended' : 'Rejected'}
                </span>
              </div>
              <p className="text-slate-600 leading-relaxed">{opt.reasoning}</p>
              {opt.eta_minutes && (
                <div className="mt-2 font-mono font-bold text-[#0F9D91]">
                  Estimated Transit Time: {opt.eta_minutes} min
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
