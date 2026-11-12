import React, { useState } from 'react';
import {
  Building2,
  Ambulance,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Minus,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { updateHospitalCapacity } from '../services/api';

export default function HospitalPortalView({ state, onRefresh }) {
  const hospitals = state?.hospitals || [];
  const incidents = state?.incidents || [];
  const ambulances = state?.ambulances || [];

  const [selectedHospId, setSelectedHospId] = useState(hospitals[0]?.id || "hosp-01");
  const [updating, setUpdating] = useState(false);

  const currentHosp = hospitals.find(h => h.id === selectedHospId) || hospitals[0];

  // Inbound patients assigned to this hospital
  const incomingIncidents = incidents.filter(
    i => i.assigned_hospital_id === currentHosp?.id && i.status !== 'Resolved'
  );

  const handleAdjustBed = async (type, delta) => {
    if (!currentHosp) return;
    try {
      setUpdating(true);
      const updates = {};
      if (type === 'icu') {
        updates.icu_available = Math.max(0, Math.min(currentHosp.icu_total, currentHosp.icu_available + delta));
      } else {
        updates.general_available = Math.max(0, Math.min(currentHosp.general_total, currentHosp.general_available + delta));
      }
      await updateHospitalCapacity(currentHosp.id, updates);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Bed update error", e);
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleStatus = async (status) => {
    if (!currentHosp) return;
    try {
      setUpdating(true);
      await updateHospitalCapacity(currentHosp.id, { operational_status: status });
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Status update error", e);
    } finally {
      setUpdating(false);
    }
  };

  const icuPct = currentHosp
    ? Math.round(((currentHosp.icu_total - currentHosp.icu_available) / Math.max(1, currentHosp.icu_total)) * 100)
    : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Hospital ER Banner */}
      <div className="bg-gradient-to-r from-[#0F9D91] via-teal-700 to-[#17324D] text-white p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-teal-200 uppercase tracking-wider">
            <Activity className="w-4 h-4 text-teal-200" />
            <span>Emergency Department (ED) & Resuscitation Reception Console</span>
          </div>
          <h1 className="text-2xl font-black mt-1 flex items-center space-x-2.5">
            <Building2 className="w-6 h-6 text-teal-200" />
            <span>{currentHosp?.name || 'Osmania General Hospital'}</span>
          </h1>
          <p className="text-xs text-teal-100 mt-0.5">
            Real-time inbound patient queue, live ICU bed saturation, and automated zero-capacity diversion gates.
          </p>
        </div>

        {/* Hospital Switcher */}
        <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/20 flex items-center space-x-2 text-xs">
          <span className="text-teal-100 font-medium">Select Hospital:</span>
          <select
            value={selectedHospId}
            onChange={(e) => setSelectedHospId(e.target.value)}
            className="bg-[#17324D] text-white font-bold p-1.5 rounded-lg border border-teal-300/40 text-xs outline-none cursor-pointer"
          >
            {hospitals.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Incoming Ambulances Left, Bed Controls Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Inbound Ambulances Pipeline */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E3E9EF] p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-[#17324D] uppercase tracking-wider flex items-center space-x-2">
              <Ambulance className="w-4 h-4 text-blue-600" />
              <span>Incoming Patients Pipeline ({incomingIncidents.length} En-Route)</span>
            </h2>
            <span className="text-xs text-slate-400">Pre-Alert Notification</span>
          </div>

          {incomingIncidents.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <strong className="text-sm font-bold text-slate-700 block">No Inbound Patients at this moment</strong>
              <p>ER receiving bays and triage team on standby.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incomingIncidents.map((inc) => {
                const amb = ambulances.find(a => a.id === inc.assigned_ambulance_id);
                const isCritical = inc.severity === 'Critical';

                return (
                  <div
                    key={inc.id}
                    className={`p-4 rounded-xl border text-xs space-y-2 ${
                      isCritical ? 'border-red-200 bg-red-50/20' : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          isCritical ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {inc.severity}
                        </span>
                        <strong className="text-sm font-bold text-[#17324D]">{inc.title}</strong>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Arrival ETA</span>
                        <strong className="font-mono text-sm text-blue-800">
                          ~{amb?.eta_minutes || 4.2} min
                        </strong>
                      </div>
                    </div>

                    <p className="text-slate-600 leading-relaxed text-[11px]">{inc.description}</p>

                    <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-500">
                      <div>
                        <span>Transporting Unit: <strong className="text-blue-700">{amb?.code || 'ALS-01'}</strong> ({amb?.type})</span>
                        <span className="mx-2">•</span>
                        <span>Clinical Reception: <strong className={inc.requires_icu ? 'text-red-600' : 'text-slate-800'}>
                          {inc.requires_icu ? 'Mandatory ICU Bed' : 'General Bay'}
                        </strong></span>
                      </div>

                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Bay Pre-Notified
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Live Bed Capacity & Diversion Gate */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E3E9EF] p-5 shadow-2xs space-y-4 text-xs">
            <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider pb-2 border-b">
              Hospital Capacity Controls
            </h3>

            {/* ICU Beds Gauge & Adjust */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">Available ICU Resuscitation:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  <strong className={currentHosp?.icu_available === 0 ? 'text-red-600' : 'text-[#0F9D91]'}>
                    {currentHosp?.icu_available}
                  </strong> / {currentHosp?.icu_total} Beds
                </span>
              </div>

              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    currentHosp?.icu_available === 0 ? 'bg-red-600' : icuPct > 75 ? 'bg-amber-500' : 'bg-[#0F9D91]'
                  }`}
                  style={{ width: `${icuPct}%` }}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  onClick={() => handleAdjustBed('icu', -1)}
                  disabled={updating || currentHosp?.icu_available <= 0}
                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded text-xs font-bold disabled:opacity-40"
                >
                  -1 Bed
                </button>
                <button
                  onClick={() => handleAdjustBed('icu', 1)}
                  disabled={updating || currentHosp?.icu_available >= currentHosp?.icu_total}
                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded text-xs font-bold disabled:opacity-40"
                >
                  +1 Bed
                </button>
              </div>
            </div>

            {/* General Beds Adjust */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">General Emergency Beds:</span>
                <span className="font-mono font-bold text-slate-900">
                  {currentHosp?.general_available} / {currentHosp?.general_total} Beds
                </span>
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  onClick={() => handleAdjustBed('gen', -2)}
                  disabled={updating || currentHosp?.general_available <= 0}
                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded text-xs font-bold disabled:opacity-40"
                >
                  -2 Beds
                </button>
                <button
                  onClick={() => handleAdjustBed('gen', 2)}
                  disabled={updating || currentHosp?.general_available >= currentHosp?.general_total}
                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded text-xs font-bold disabled:opacity-40"
                >
                  +2 Beds
                </button>
              </div>
            </div>

            {/* Diversion Gate */}
            <div className="pt-2">
              <span className="font-bold text-slate-700 block mb-1.5">Diversion Gate:</span>
              <select
                value={currentHosp?.operational_status}
                disabled={updating}
                onChange={(e) => handleToggleStatus(e.target.value)}
                className={`w-full p-2 rounded-xl border font-bold text-xs outline-none cursor-pointer ${
                  currentHosp?.operational_status === 'Operational'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-red-50 text-red-800 border-red-300'
                }`}
              >
                <option value="Operational">Operational (Accepting All Admissions)</option>
                <option value="Constrained">Constrained (Priority Triage Only)</option>
                <option value="Diverting">Diverting (Zero Admissions Allowed)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
