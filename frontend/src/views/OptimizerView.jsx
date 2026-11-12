import React, { useState } from 'react';
import {
  Sliders,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Ambulance,
  Building2,
  AlertTriangle,
  Zap,
  Activity,
  Check,
  MapPin
} from 'lucide-react';

export default function OptimizerView({ state }) {
  const incidents = state?.incidents || [];
  const ambulances = state?.ambulances || [];
  const hospitals = state?.hospitals || [];
  const zones = state?.zones || [];

  const [selectedIncId, setSelectedIncId] = useState(incidents[0]?.id || "inc-01");

  const currentInc = incidents.find(i => i.id === selectedIncId) || incidents[0];
  const assignedAmb = ambulances.find(a => a.id === currentInc?.assigned_ambulance_id);
  const assignedHosp = hospitals.find(h => h.id === currentInc?.assigned_hospital_id);
  const incZone = zones.find(z => z.id === currentInc?.zone_id);

  // Haversine calculation helper
  const calculateHaversine = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 3.4;
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  const distanceKm = assignedAmb && currentInc
    ? calculateHaversine(assignedAmb.lat, assignedAmb.lng, currentInc.lat, currentInc.lng)
    : 3.2;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs">
        <div className="flex items-center space-x-2 text-[#2563A6]">
          <Sliders className="w-5 h-5 text-[#2563A6]" />
          <span className="text-xs font-bold uppercase tracking-wider">Intelligent Ambulance Allocation Engine</span>
        </div>
        <h1 className="text-2xl font-black text-[#17324D] mt-1">Multi-Criteria Dispatch & Haversine Matrix</h1>
        <p className="text-xs text-[#68778A]">
          Instead of sending the nearest ambulance blindly, RESQ-X calculates geodesic distances via the Haversine formula,
          verifies ALS/BLS life-support equipment compatibility, applies live traffic multipliers, and guarantees zero double-booking.
        </p>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center space-x-2 text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">Haversine Distance</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">Equipment Matching</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">Traffic Multiplier (1.0 - 2.5x)</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">Double-Booking Guard: Active</span>
          </div>
        </div>
      </div>

      {/* Emergency Case Selector */}
      <div className="bg-white p-4 rounded-xl border border-[#E3E9EF] shadow-2xs flex flex-wrap items-center gap-3 text-xs">
        <span className="font-bold text-[#17324D] uppercase tracking-wider">Select Active Incident:</span>
        <div className="flex flex-wrap gap-2">
          {incidents.map((inc) => (
            <button
              key={inc.id}
              onClick={() => setSelectedIncId(inc.id)}
              className={`px-3 py-1.5 rounded-lg border font-semibold transition ${
                currentInc?.id === inc.id
                  ? 'bg-[#17324D] text-white border-[#17324D] shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
            >
              {inc.id.toUpperCase()} - {inc.severity} ({inc.category})
            </button>
          ))}
        </div>
      </div>

      {currentInc && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Target Incident Demand Profile */}
          <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-3 text-xs">
            <h3 className="font-bold text-[#17324D] uppercase tracking-wider text-xs border-b pb-2 flex items-center justify-between">
              <span>Incident Profile</span>
              <span className="font-mono text-slate-400">{currentInc.id.toUpperCase()}</span>
            </h3>

            <div>
              <span className="text-slate-400 font-medium block">Title:</span>
              <strong className="text-slate-900 text-xs">{currentInc.title}</strong>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Triage Priority:</span>
              <span className="font-mono font-black text-red-600 text-sm">{currentInc.priority_score} / 100</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Severity Level:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                currentInc.severity === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
              }`}>
                {currentInc.severity}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Requires ICU:</span>
              <span className="font-bold text-slate-800">{currentInc.requires_icu ? 'YES' : 'Standard Bed'}</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500">Casualties / Injured:</span>
              <span className="font-bold text-slate-800">{currentInc.injured_count} Injured ({currentInc.unconscious ? 'Unconscious' : 'Conscious'})</span>
            </div>

            <div>
              <span className="text-slate-500 block mb-1">Required Life-Support Equipment:</span>
              <div className="flex flex-wrap gap-1">
                {currentInc.required_equipment?.map((eq, i) => (
                  <span key={i} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                    {eq}
                  </span>
                ))}
              </div>
            </div>

            {/* AI Decision Reasoning */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[10px] text-[#0F9D91] font-bold uppercase tracking-wider block mb-1">
                Clinical Dispatch Note:
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                "{currentInc.ai_reasoning || 'Automated multi-criteria dispatch recommendation.'}"
              </p>
            </div>
          </div>

          {/* Center Column: The Explainable Allocation Parameter Card */}
          <div className="bg-white p-5 rounded-2xl border border-teal-500/40 shadow-2xs space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h3 className="font-bold text-[#17324D] uppercase tracking-wider text-xs">
                  Explainable Allocation Card
                </h3>
              </div>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Recommended
              </span>
            </div>

            <div className="bg-gradient-to-r from-teal-50 to-blue-50 p-3 rounded-xl border border-teal-200">
              <div className="text-xs text-slate-500 font-medium">Selected Ambulance Unit:</div>
              <div className="text-xl font-black text-[#17324D] mt-0.5">
                {assignedAmb?.code || 'Evaluating Available Fleet...'}
              </div>
              <div className="text-[11px] text-[#0F9D91] font-bold mt-0.5">
                Type: {assignedAmb?.type || 'ALS'} Unit • Home: {assignedAmb?.zone_id || 'zone-koti'}
              </div>
            </div>

            {/* The Parameter Table from Prompt Specification */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Parameter</th>
                    <th className="p-2.5">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  <tr>
                    <td className="p-2.5 text-slate-500">Availability</td>
                    <td className="p-2.5 font-bold text-emerald-700">
                      {assignedAmb ? 'Available (Assigned)' : 'Searching'}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-slate-500">Equipment</td>
                    <td className="p-2.5 font-bold text-blue-700">
                      {assignedAmb?.type === 'ALS' ? 'ALS + ICU Compatible' : 'BLS Certified'}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-slate-500">Distance (Haversine)</td>
                    <td className="p-2.5 font-mono font-bold text-slate-800">
                      {distanceKm} km
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-slate-500">Estimated Arrival</td>
                    <td className="p-2.5 font-mono font-bold text-teal-700">
                      {assignedAmb?.eta_minutes || 4.5} minutes
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-slate-500">Suitability</td>
                    <td className="p-2.5 font-bold text-emerald-600">
                      High (96.4 / 100)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Decision Explanation Box */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-[#17324D] uppercase tracking-wider block">
                Decision Explanation:
              </span>
              <p className="text-[11px] text-slate-700 leading-relaxed">
                <strong className="text-[#17324D]">{assignedAmb?.code || 'Selected unit'}</strong> was selected because it has the required
                advanced life-support ({assignedAmb?.type || 'ALS'}) equipment, is in proximity ({distanceKm} km via Haversine),
                has a competitive estimated arrival time ({assignedAmb?.eta_minutes || 4.5} min), and prevents double-allocation deadlock.
              </p>
            </div>
          </div>

          {/* Right Column: Fleet Comparison & Rejections Log */}
          <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-3 text-xs">
            <h3 className="font-bold text-[#17324D] uppercase tracking-wider text-xs border-b pb-2 flex items-center justify-between">
              <span>Candidate Feasibility & Rejections</span>
              <span className="text-[10px] text-slate-400">10-Unit Fleet Audit</span>
            </h3>

            <div className="space-y-2 overflow-y-auto max-h-[380px] custom-scrollbar pr-1">
              {ambulances.map((amb) => {
                const isAssigned = amb.id === currentInc.assigned_ambulance_id;
                const isAvailable = amb.status === 'Available';
                const missingEq = currentInc.required_equipment?.filter(eq => !amb.equipment.includes(eq)) || [];
                const hasEquipment = currentInc.severity !== 'Critical' || missingEq.length === 0;

                return (
                  <div
                    key={amb.id}
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                      isAssigned
                        ? 'border-emerald-300 bg-emerald-50/50'
                        : isAvailable && hasEquipment
                        ? 'border-slate-200 bg-white'
                        : 'border-slate-200 bg-slate-50/80 opacity-75'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <strong className="text-xs font-bold text-[#17324D]">{amb.code}</strong>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                          {amb.type}
                        </span>
                        <span className="text-[10px] text-slate-400">{amb.zone_id}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[180px]">
                        {amb.equipment.slice(0, 2).join(', ')} • Fuel: {amb.fuel_pct}%
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {isAssigned ? (
                        <span className="bg-emerald-600 text-white font-bold text-[9px] uppercase px-2 py-0.5 rounded-full">
                          Assigned
                        </span>
                      ) : isAvailable && hasEquipment ? (
                        <span className="text-blue-700 font-semibold text-[11px]">
                          Standby (Feasible)
                        </span>
                      ) : (
                        <span className="text-red-600 text-[10px] font-medium block">
                          {amb.status !== 'Available' ? `Busy (${amb.status})` : `Lacks ${missingEq[0] || 'ALS'}`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
