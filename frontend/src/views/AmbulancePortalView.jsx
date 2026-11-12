import React, { useState } from 'react';
import {
  Ambulance,
  MapPin,
  Clock,
  BatteryCharging,
  CheckCircle2,
  Navigation,
  Activity,
  Building2,
  AlertTriangle,
  Radio,
  Sliders
} from 'lucide-react';
import { updateAmbulanceStatus } from '../services/api';

export default function AmbulancePortalView({ state, onRefresh }) {
  const ambulances = state?.ambulances || [];
  const incidents = state?.incidents || [];
  const hospitals = state?.hospitals || [];

  const [selectedAmbId, setSelectedAmbId] = useState(ambulances[0]?.id || "amb-01");
  const [updating, setUpdating] = useState(false);

  const currentAmb = ambulances.find(a => a.id === selectedAmbId) || ambulances[0];
  const assignedInc = incidents.find(i => i.id === currentAmb?.assigned_incident_id);
  const targetHosp = hospitals.find(h => h.id === currentAmb?.target_hospital_id);

  const handleUpdateStatus = async (newStatus) => {
    if (!currentAmb) return;
    try {
      setUpdating(true);
      await updateAmbulanceStatus(currentAmb.id, newStatus);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Status update error", e);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Paramedic In-Cab Banner */}
      <div className="bg-[#17324D] text-white p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-slate-700">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-teal-300 uppercase tracking-wider">
            <Radio className="w-4 h-4 text-teal-300 animate-pulse" />
            <span>Mobile Data Terminal (MDT) • Paramedic Console</span>
          </div>
          <h1 className="text-2xl font-black mt-1 flex items-center space-x-2.5">
            <Ambulance className="w-6 h-6 text-blue-400" />
            <span>Vehicle: {currentAmb?.code || 'RESQ-A01'}</span>
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            On-board emergency navigation, clinical patient telemetry, and direct receiving hospital dispatch link.
          </p>
        </div>

        {/* Vehicle Switcher */}
        <div className="bg-[#12263a] p-2 rounded-xl border border-slate-700 flex items-center space-x-2 text-xs">
          <span className="text-slate-400 font-medium">Switch Vehicle:</span>
          <select
            value={selectedAmbId}
            onChange={(e) => setSelectedAmbId(e.target.value)}
            className="bg-[#17324D] text-white font-bold p-1.5 rounded-lg border border-teal-500/40 text-xs outline-none cursor-pointer"
          >
            {ambulances.map(a => (
              <option key={a.id} value={a.id}>{a.code} ({a.type} - {a.status})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Mission Dispatch Card Left, Paramedic Controls Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Mission Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E3E9EF] p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-[#17324D] uppercase tracking-wider flex items-center space-x-2">
              <Navigation className="w-4 h-4 text-blue-600" />
              <span>Current Assigned Emergency Mission</span>
            </h2>

            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              currentAmb?.status === 'Dispatched' ? 'bg-blue-100 text-blue-800' :
              currentAmb?.status === 'Transporting' ? 'bg-purple-100 text-purple-800' :
              currentAmb?.status === 'Available' ? 'bg-emerald-100 text-emerald-800' :
              'bg-slate-200 text-slate-700'
            }`}>
              Status: {currentAmb?.status}
            </span>
          </div>

          {assignedInc ? (
            <div className="space-y-4 text-xs">
              {/* Incident Header Card */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-slate-400">MISSION: {assignedInc.id?.toUpperCase()}</span>
                  <span className="bg-red-600 text-white font-bold text-[10px] px-2 py-0.5 rounded uppercase">
                    {assignedInc.severity} Priority ({assignedInc.priority_score}/100)
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900">{assignedInc.title}</h3>
                <p className="text-slate-600 text-xs mt-1 leading-relaxed">{assignedInc.description}</p>
                <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between text-slate-500 text-[11px]">
                  <span>Sector: <strong>{assignedInc.zone_id}</strong></span>
                  <span>Casualties: <strong className="text-red-600">{assignedInc.injured_count} Injured ({assignedInc.unconscious ? 'Unconscious' : 'Conscious'})</strong></span>
                </div>
              </div>

              {/* Transit & Destination Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200">
                  <span className="text-[10px] uppercase font-bold text-blue-700 block">En-Route ETA</span>
                  <strong className="text-xl font-black text-blue-900 font-mono">
                    {currentAmb?.eta_minutes || 4.5} Minutes
                  </strong>
                  <span className="text-[11px] text-blue-800 block mt-1">Traffic-aware routing active</span>
                </div>

                <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200">
                  <span className="text-[10px] uppercase font-bold text-teal-700 block">Receiving Emergency Facility</span>
                  <strong className="text-xs font-bold text-teal-900 block truncate">
                    {targetHosp?.name || 'Osmania General Hospital'}
                  </strong>
                  <span className="text-[11px] text-teal-800 block mt-1">
                    ICU Pre-Alerted: {targetHosp?.icu_available || 3} beds available
                  </span>
                </div>
              </div>

              {/* Paramedic Status Workflow Actions */}
              <div className="pt-2">
                <span className="text-xs font-bold text-[#17324D] uppercase tracking-wider block mb-2">
                  Update Mission Progress:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => handleUpdateStatus('Dispatched')}
                    disabled={updating}
                    className="p-2.5 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs transition"
                  >
                    1. En Route
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('On Scene')}
                    disabled={updating}
                    className="p-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs transition"
                  >
                    2. On Scene
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('Transporting')}
                    disabled={updating}
                    className="p-2.5 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-xs transition"
                  >
                    3. Transporting
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('Available')}
                    disabled={updating}
                    className="p-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition"
                  >
                    4. Completed
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <strong className="text-sm font-bold text-slate-700 block">Ambulance Is On Standby Ready</strong>
              <p>Vehicle is currently idle in {currentAmb?.zone_id}. Standing by for AI coordinated dispatch.</p>
            </div>
          )}
        </div>

        {/* Right Col: Vehicle Diagnostics & Equipment */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E3E9EF] p-5 shadow-2xs space-y-3 text-xs">
            <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider pb-2 border-b">
              Vehicle Health & Telemetry
            </h3>

            <div className="flex justify-between items-center">
              <span className="text-slate-500">Tier:</span>
              <strong className="text-blue-700 font-bold">{currentAmb?.type}</strong>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500">Fuel / Battery:</span>
              <strong className="font-mono text-emerald-700">{currentAmb?.fuel_pct}%</strong>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500">Base Sector:</span>
              <span className="font-medium text-slate-800">{currentAmb?.zone_id}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500">GPS Coordinates:</span>
              <span className="font-mono text-[11px] text-slate-500">{currentAmb?.lat.toFixed(4)}, {currentAmb?.lng.toFixed(4)}</span>
            </div>

            {/* Equipment Checklist */}
            <div className="pt-3 border-t">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                On-Board Medical Suite Checklist
              </span>
              <div className="space-y-1">
                {currentAmb?.equipment.map((eq, i) => (
                  <div key={i} className="flex items-center space-x-1.5 text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#0F9D91]" />
                    <span>{eq}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
