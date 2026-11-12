import React, { useState } from 'react';
import {
  Ambulance,
  BatteryCharging,
  MapPin,
  CheckCircle2,
  Clock,
  Radio,
  Sliders,
  AlertCircle
} from 'lucide-react';
import { updateAmbulanceStatus } from '../services/api';

export default function AmbulanceView({ state, onRefresh }) {
  const ambulances = state?.ambulances || [];
  const [updatingId, setUpdatingId] = useState(null);

  const handleStatusChange = async (ambId, newStatus) => {
    try {
      setUpdatingId(ambId);
      await updateAmbulanceStatus(ambId, newStatus);
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
          <div className="flex items-center space-x-2 text-[#2563A6]">
            <Ambulance className="w-5 h-5 text-[#2563A6]" />
            <span className="text-xs font-bold uppercase tracking-wider">Fleet Logistics & Telemetry</span>
          </div>
          <h1 className="text-2xl font-black text-[#17324D] mt-1">Ambulance Fleet Management</h1>
          <p className="text-xs text-[#68778A]">
            Real-time status monitoring, on-board life-support diagnostics, manual status overrides, and simulated GPS coordinates.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
          <span>Active Units: <strong>{ambulances.length}</strong></span>
          <span>•</span>
          <span className="text-[#26976F]">Available: <strong>{ambulances.filter(a => a.status === 'Available').length}</strong></span>
          <span>•</span>
          <span className="text-blue-700">Dispatched: <strong>{ambulances.filter(a => a.status === 'Dispatched').length}</strong></span>
        </div>
      </div>

      {/* Ambulance Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ambulances.map((amb) => {
          const isAvailable = amb.status === 'Available';
          const isDispatched = amb.status === 'Dispatched';
          const isUnavailable = amb.status === 'Unavailable';

          return (
            <div
              key={amb.id}
              className={`p-5 rounded-2xl border transition shadow-2xs hover:shadow-xs flex flex-col justify-between ${
                isUnavailable
                  ? 'border-slate-300 bg-slate-100/60'
                  : isDispatched
                  ? 'border-blue-200 bg-blue-50/20'
                  : 'border-[#E3E9EF] bg-white'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-base font-black text-[#17324D]">{amb.code}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      amb.type === 'MICU' ? 'bg-purple-100 text-purple-800' : amb.type === 'ALS' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {amb.type}
                    </span>
                  </div>

                  {/* Status Dropdown */}
                  <select
                    value={amb.status}
                    disabled={updatingId === amb.id}
                    onChange={(e) => handleStatusChange(amb.id, e.target.value)}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border outline-none cursor-pointer ${
                      isAvailable
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : isDispatched
                        ? 'bg-blue-50 text-blue-800 border-blue-300'
                        : 'bg-slate-200 text-slate-800 border-slate-300'
                    }`}
                  >
                    <option value="Available">Available</option>
                    <option value="Dispatched">Dispatched</option>
                    <option value="On Scene">On Scene</option>
                    <option value="Transporting">Transporting</option>
                    <option value="Unavailable">Unavailable</option>
                  </select>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center space-x-1 text-slate-400">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Zone Base:</span>
                    </span>
                    <span className="font-semibold text-slate-800">{amb.zone_id}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="flex items-center space-x-1 text-slate-400">
                      <BatteryCharging className="w-3.5 h-3.5" />
                      <span>Fuel / Battery:</span>
                    </span>
                    <span className="font-mono font-semibold">{amb.fuel_pct}%</span>
                  </div>

                  {amb.assigned_incident_id && (
                    <div className="flex justify-between items-center bg-blue-50/80 p-2 rounded-lg border border-blue-100 text-[11px] mt-2">
                      <span className="text-blue-900 font-bold">Mission: {amb.assigned_incident_id}</span>
                      <span className="font-mono text-blue-700 font-bold">ETA: {amb.eta_minutes || 4}m</span>
                    </div>
                  )}
                </div>

                {/* Equipment Badges */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    On-Board Medical Suite
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {amb.equipment.map((eq, i) => (
                      <span key={i} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                        {eq}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between font-mono">
                <span>GPS: {amb.lat.toFixed(4)}, {amb.lng.toFixed(4)}</span>
                <span className="text-emerald-600 font-semibold">Simulated Telemetry</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
