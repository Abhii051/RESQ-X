import React, { useState } from 'react';
import {
  Building2,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Minus,
  Sliders,
  ShieldAlert
} from 'lucide-react';
import { updateHospitalCapacity } from '../services/api';

export default function HospitalView({ state, onRefresh }) {
  const hospitals = state?.hospitals || [];
  const [updatingId, setUpdatingId] = useState(null);

  const handleAdjustBed = async (hospId, type, delta) => {
    const hosp = hospitals.find(h => h.id === hospId);
    if (!hosp) return;

    try {
      setUpdatingId(hospId);
      const updates = {};
      if (type === 'icu') {
        updates.icu_available = Math.max(0, Math.min(hosp.icu_total, hosp.icu_available + delta));
      } else {
        updates.general_available = Math.max(0, Math.min(hosp.general_total, hosp.general_available + delta));
      }

      await updateHospitalCapacity(hospId, updates);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Bed update failed", e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleStatus = async (hospId, status) => {
    try {
      setUpdatingId(hospId);
      await updateHospitalCapacity(hospId, { operational_status: status });
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Status update failed", e);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#0F9D91]">
            <Building2 className="w-5 h-5 text-[#0F9D91]" />
            <span className="text-xs font-bold uppercase tracking-wider">Clinical Facility Mesh</span>
          </div>
          <h1 className="text-2xl font-black text-[#17324D] mt-1">Hospital Capacity & Divert Control</h1>
          <p className="text-xs text-[#68778A]">
            Real-time emergency department bed availability, ICU saturation telemetry, specialty departments, and diversion gates.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-semibold bg-teal-50 text-teal-900 border border-teal-200 px-3 py-2 rounded-xl">
          <span>Total ICU Available:</span>
          <strong className="text-[#0F9D91] text-sm">
            {hospitals.reduce((acc, h) => acc + h.icu_available, 0)} / {hospitals.reduce((acc, h) => acc + h.icu_total, 0)}
          </strong>
        </div>
      </div>

      {/* Hospitals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {hospitals.map((hosp) => {
          const icuPct = Math.round(((hosp.icu_total - hosp.icu_available) / Math.max(1, hosp.icu_total)) * 100);
          const isCriticalRisk = hosp.overload_risk === 'Critical' || hosp.icu_available === 0;

          return (
            <div
              key={hosp.id}
              className={`bg-white rounded-2xl border p-5 shadow-2xs flex flex-col justify-between transition hover:shadow-xs ${
                isCriticalRisk ? 'border-red-300 ring-1 ring-red-200' : 'border-[#E3E9EF]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#17324D]">{hosp.name}</h3>
                    <span className="text-[11px] text-slate-400 font-medium">{hosp.zone_id}</span>
                  </div>

                  {/* Overload Risk Badge */}
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    isCriticalRisk
                      ? 'bg-red-600 text-white'
                      : hosp.overload_risk === 'High'
                      ? 'bg-orange-500 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}>
                    {hosp.overload_risk} Risk
                  </span>
                </div>

                {/* ICU Beds Interactive Bar */}
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-[#17324D]">ICU Resuscitation Beds:</span>
                    <span className="font-mono font-bold text-slate-800">
                      <strong className={hosp.icu_available === 0 ? 'text-red-600' : 'text-[#0F9D91]'}>
                        {hosp.icu_available}
                      </strong> / {hosp.icu_total} Avail
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCriticalRisk ? 'bg-red-600' : icuPct > 75 ? 'bg-amber-500' : 'bg-[#0F9D91]'
                      }`}
                      style={{ width: `${icuPct}%` }}
                    />
                  </div>

                  {/* Quick Adjust Buttons */}
                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      onClick={() => handleAdjustBed(hosp.id, 'icu', -1)}
                      disabled={updatingId === hosp.id || hosp.icu_available <= 0}
                      className="px-2 py-0.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded text-xs font-bold disabled:opacity-40"
                    >
                      -1 Bed
                    </button>
                    <button
                      onClick={() => handleAdjustBed(hosp.id, 'icu', 1)}
                      disabled={updatingId === hosp.id || hosp.icu_available >= hosp.icu_total}
                      className="px-2 py-0.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded text-xs font-bold disabled:opacity-40"
                    >
                      +1 Bed
                    </button>
                  </div>
                </div>

                {/* General Beds */}
                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">General Emergency Beds:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {hosp.general_available} / {hosp.general_total} Avail
                    </span>
                  </div>
                  {/* Quick Adjust Buttons */}
                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      onClick={() => handleAdjustBed(hosp.id, 'gen', -2)}
                      disabled={updatingId === hosp.id || hosp.general_available <= 0}
                      className="px-2 py-0.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded text-xs font-bold disabled:opacity-40"
                    >
                      -2 Beds
                    </button>
                    <button
                      onClick={() => handleAdjustBed(hosp.id, 'gen', 2)}
                      disabled={updatingId === hosp.id || hosp.general_available >= hosp.general_total}
                      className="px-2 py-0.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded text-xs font-bold disabled:opacity-40"
                    >
                      +2 Beds
                    </button>
                  </div>
                </div>

                {/* Specialties */}
                <div className="mt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Specialized Medical Capabilities
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {hosp.specialties.map((spec, i) => (
                      <span key={i} className="text-[10px] bg-teal-50 text-teal-800 px-2 py-0.5 rounded border border-teal-200 font-medium">
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Status Toggle Gate */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Diversion Gate:</span>
                <select
                  value={hosp.operational_status}
                  disabled={updatingId === hosp.id}
                  onChange={(e) => handleToggleStatus(hosp.id, e.target.value)}
                  className={`font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer ${
                    hosp.operational_status === 'Operational'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-red-50 text-red-800 border-red-300'
                  }`}
                >
                  <option value="Operational">Operational</option>
                  <option value="Constrained">Constrained</option>
                  <option value="Diverting">Diverting (Locked)</option>
                  <option value="Offline">Offline</option>
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
