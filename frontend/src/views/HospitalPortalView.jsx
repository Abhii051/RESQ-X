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
  ArrowRight,
  HeartPulse,
  Users,
  Stethoscope,
  XCircle,
  BarChart3,
  PhoneCall
} from 'lucide-react';
import { updateHospitalCapacity, triggerSimulationEvent } from '../services/api';

export default function HospitalPortalView({ state, onRefresh }) {
  const hospitals = state?.hospitals || [];
  const incidents = state?.incidents || [];
  const ambulances = state?.ambulances || [];

  const [selectedHospId, setSelectedHospId] = useState(hospitals[0]?.id || "hosp-01");
  const [updating, setUpdating] = useState(false);
  const [acceptedCases, setAcceptedCases] = useState({});

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

  const handleDeclareSaturation = async () => {
    if (!currentHosp) return;
    try {
      setUpdating(true);
      await triggerSimulationEvent('hospital-full', { hospital_id: currentHosp.id });
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Saturation declaration failed", e);
    } finally {
      setUpdating(false);
    }
  };

  const handleCaseAction = (incId, action) => {
    setAcceptedCases(prev => ({ ...prev, [incId]: action }));
  };

  const icuPct = currentHosp
    ? Math.round(((currentHosp.icu_total - currentHosp.icu_available) / Math.max(1, currentHosp.icu_total)) * 100)
    : 0;

  const isSaturated = currentHosp?.icu_available === 0 || currentHosp?.operational_status === 'Constrained';

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
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
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
              isSaturated ? 'bg-red-600 text-white' : 'bg-white/20 text-teal-100'
            }`}>
              {isSaturated ? 'ICU Saturation Alert' : 'Operational Readiness'}
            </span>
          </h1>
          <p className="text-xs text-teal-100 mt-0.5">
            Real-time inbound ambulance pipeline, ICU resuscitation bed telemetry, on-duty specialist verification, and diversion gates.
          </p>
        </div>

        {/* Hospital Switcher */}
        <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/20 flex items-center space-x-2 text-xs shrink-0">
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

      {/* Main Grid: Incoming Pipeline Left (2 Cols), Capacity & Specialists Right (1 Col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Inbound Patients & Inflow Pipeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-[#E3E9EF] p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Ambulance className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-bold text-[#17324D] uppercase tracking-wider">
                  Inbound Patients & Emergency Pipeline ({incomingIncidents.length})
                </h2>
              </div>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2.5 py-0.5 rounded-full">
                Pre-Alert Reception Active
              </span>
            </div>

            {incomingIncidents.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <strong className="text-sm font-bold text-slate-700 block">No Inbound Emergency Transfers</strong>
                <p>All incoming cases for {currentHosp?.name} are currently settled or dispatched to other facilities.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {incomingIncidents.map((inc) => {
                  const amb = ambulances.find(a => a.id === inc.assigned_ambulance_id);
                  const caseDecision = acceptedCases[inc.id];

                  return (
                    <div
                      key={inc.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition space-y-3 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200/60 pb-2">
                        <div className="flex items-center space-x-2">
                          <span className="bg-red-600 text-white font-bold text-[10px] px-2 py-0.5 rounded uppercase">
                            {inc.severity} Priority
                          </span>
                          <strong className="text-sm font-bold text-[#17324D]">{inc.title}</strong>
                        </div>

                        <div className="flex items-center space-x-2 text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-blue-600" />
                          <span>ETA: <strong className="font-mono text-blue-700">{amb?.eta_minutes || 4.2} mins</strong></span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600">
                        <div>Unit: <strong className="text-blue-800">{amb?.code || 'Dispatched ALS'}</strong> ({amb?.type})</div>
                        <div>Casualties: <strong className="text-red-700">{inc.injured_count} Injured ({inc.unconscious ? 'Unconscious' : 'Conscious'})</strong></div>
                        <div>Required Bay: <strong className="text-teal-800">{inc.requires_icu ? 'Cardiac/Trauma ICU' : 'General ER'}</strong></div>
                      </div>

                      <p className="text-[11px] text-slate-500 italic bg-white p-2 rounded-lg border border-slate-200">
                        "{inc.description}"
                      </p>

                      {/* Accept or Divert Buttons (Feature 9) */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                        <span className="text-[10px] text-slate-400 font-medium">ED Reception Decision:</span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleCaseAction(inc.id, 'accepted')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                              caseDecision === 'accepted'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{caseDecision === 'accepted' ? 'Case Accepted' : 'Accept Case'}</span>
                          </button>

                          <button
                            onClick={() => handleCaseAction(inc.id, 'diverted')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                              caseDecision === 'diverted'
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>{caseDecision === 'diverted' ? 'Divert Initiated' : 'Divert Patient'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Emergency Saturation Chaos Simulation Trigger (Feature 11) */}
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Hospital Capacity Exhaustion Simulation</span>
              </div>
              <h4 className="text-sm font-black text-amber-950 mt-0.5">Declare ICU Saturation (0 Beds Available)</h4>
              <p className="text-[11px] text-amber-900 mt-0.5">
                Simulate critical bed depletion at {currentHosp?.name}. The RESQ-X network will immediately trigger
                automated hospital diversion, protecting incoming cardiac patients and rerouting to nearby facilities.
              </p>
            </div>

            <button
              onClick={handleDeclareSaturation}
              disabled={updating || currentHosp?.icu_available === 0}
              className="px-5 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-md shadow-amber-900/20 transition flex items-center space-x-2 shrink-0"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Declare 0 ICU Beds (Divert)</span>
            </button>
          </div>
        </div>

        {/* Right Col: Live Bed Capacity Adjusters & Specialist Readiness */}
        <div className="space-y-6">
          {/* Bed & ICU Capacity Controls (Features 3, 4, 10) */}
          <div className="bg-white rounded-2xl border border-[#E3E9EF] p-5 shadow-2xs space-y-4 text-xs">
            <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider pb-2 border-b flex items-center justify-between">
              <span>Live Emergency Bed Controls</span>
              <span className="text-[10px] text-slate-400">Interactive Adjusters</span>
            </h3>

            {/* ICU Beds Adjuster */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800 text-xs">ICU Resuscitation Beds:</span>
                <span className={`font-mono font-black text-sm ${currentHosp?.icu_available === 0 ? 'text-red-600' : 'text-[#0F9D91]'}`}>
                  {currentHosp?.icu_available} / {currentHosp?.icu_total}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    currentHosp?.icu_available === 0 ? 'bg-red-600' : currentHosp?.icu_available <= 2 ? 'bg-orange-500' : 'bg-[#0F9D91]'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, (currentHosp?.icu_available / Math.max(1, currentHosp?.icu_total)) * 100))}%` }}
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => handleAdjustBed('icu', -1)}
                  disabled={updating || currentHosp?.icu_available <= 0}
                  className="flex-1 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 rounded-lg font-bold text-slate-700 flex items-center justify-center space-x-1"
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>-1 ICU</span>
                </button>
                <button
                  onClick={() => handleAdjustBed('icu', 1)}
                  disabled={updating || currentHosp?.icu_available >= currentHosp?.icu_total}
                  className="flex-1 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 rounded-lg font-bold text-slate-700 flex items-center justify-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+1 ICU</span>
                </button>
              </div>
            </div>

            {/* General Ward Beds Adjuster */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800 text-xs">General Emergency Beds:</span>
                <span className="font-mono font-black text-sm text-blue-700">
                  {currentHosp?.general_available} / {currentHosp?.general_total}
                </span>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={() => handleAdjustBed('general', -2)}
                  disabled={updating || currentHosp?.general_available <= 0}
                  className="flex-1 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 rounded-lg font-bold text-slate-700 flex items-center justify-center space-x-1"
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>-2 Beds</span>
                </button>
                <button
                  onClick={() => handleAdjustBed('general', 2)}
                  disabled={updating || currentHosp?.general_available >= currentHosp?.general_total}
                  className="flex-1 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 rounded-lg font-bold text-slate-700 flex items-center justify-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+2 Beds</span>
                </button>
              </div>
            </div>

            {/* Diversion Gate Switcher */}
            <div className="pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Hospital Operational Status Gateway:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleToggleStatus('Operational')}
                  disabled={updating}
                  className={`p-2 rounded-xl border text-xs font-bold transition ${
                    currentHosp?.operational_status === 'Operational'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Operational
                </button>

                <button
                  onClick={() => handleToggleStatus('Constrained')}
                  disabled={updating}
                  className={`p-2 rounded-xl border text-xs font-bold transition ${
                    currentHosp?.operational_status === 'Constrained'
                      ? 'bg-red-600 text-white border-red-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Constrained / Divert
                </button>
              </div>
            </div>
          </div>

          {/* Specialist Availability (Feature 6) */}
          <div className="bg-white rounded-2xl border border-[#E3E9EF] p-5 shadow-2xs space-y-3 text-xs">
            <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider pb-2 border-b flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Stethoscope className="w-4 h-4 text-teal-600" />
                <span>Specialist On-Duty Readiness</span>
              </span>
              <span className="text-[10px] text-emerald-600 font-bold">Active Shift</span>
            </h3>

            <div className="space-y-2 text-slate-700">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span>Trauma Level 1 Surgery Team</span>
                <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded-full">On Standby</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span>Interventional Cardiologist</span>
                <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded-full">In Cath Lab</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span>Critical Care Anesthesiologist</span>
                <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded-full">Available</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span>Emergency Pediatrician</span>
                <span className="bg-emerald-100 text-emerald-800 font-bold text-[10px] px-2 py-0.5 rounded-full">Available</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
