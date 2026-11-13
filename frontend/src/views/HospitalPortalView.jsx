import React, { useState, useEffect } from 'react';
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
  PhoneCall,
  User,
  LogOut,
  Lock
} from 'lucide-react';
import { updateHospitalCapacity, triggerSimulationEvent } from '../services/api';
import { useAuth } from '../context/AuthContext';
import RoleAuthGate from '../components/RoleAuthGate';

export default function HospitalPortalView({ state, onRefresh }) {
  const { user, isAuthenticated, logout } = useAuth();
  const isHospital = isAuthenticated && user?.role === 'hospital';

  const hospitals = state?.hospitals || [];
  const incidents = state?.incidents || [];
  const ambulances = state?.ambulances || [];

  const [selectedHospId, setSelectedHospId] = useState(user?.entity_id || hospitals[0]?.id || "hosp-01");
  const [updating, setUpdating] = useState(false);
  const [acceptedCases, setAcceptedCases] = useState({});

  useEffect(() => {
    if (user?.entity_id) {
      setSelectedHospId(user.entity_id);
    }
  }, [user]);

  // If not authenticated as hospital, render Hospital Authentication Gate
  if (!isHospital) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <RoleAuthGate
          targetRole="hospital"
          title="Hospital Emergency & Trauma Center Portal"
          subtitle="Authenticate using your hospital medical officer credentials to monitor live bed inventory, receive advance ambulance telemetry, and triage incoming trauma cases."
          icon={Building2}
        />
      </div>
    );
  }

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

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Verified Medical Facility Identity Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-[#17324D] to-slate-900 text-white p-4 md:p-5 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-md border border-purple-800/40">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center font-bold text-purple-300 shadow-inner">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-base tracking-tight">{user.name}</span>
              <span className="text-[10px] bg-purple-500/30 text-purple-200 border border-purple-400/30 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                {user.metadata?.trauma_certification || 'Level 1 Trauma'} • {currentHosp.name}
              </span>
            </div>
            <div className="text-[11px] text-purple-200/80 flex flex-wrap gap-x-3.5 gap-y-1 mt-1 font-medium">
              <span>Medical Officer: <strong className="text-white">{user.metadata?.medical_officer || 'Chief of ER'}</strong></span>
              <span>Zone: <strong className="text-white">{user.metadata?.zone_location || currentHosp.zone_id}</strong></span>
              <span>Direct Hotline: <strong className="text-white font-mono">{user.phone || '+91 040-24600121'}</strong></span>
              <span className="flex items-center space-x-1 text-emerald-400">
                <Lock className="w-3 h-3" />
                <span>Console Authenticated & Locked</span>
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 self-start md:self-center border border-white/15"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out / Switch Center</span>
        </button>
      </div>

      {/* Hospital Banner & Facility Switcher */}
      <div className="bg-[#17324D] text-white p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-slate-700">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-teal-300 uppercase tracking-wider">
            <Building2 className="w-4 h-4 text-teal-300" />
            <span>Emergency Department (ED) & ICU Capacity Management</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black mt-1">
            {currentHosp?.name} — {currentHosp?.trauma_level === 1 ? 'Trauma Center Level 1' : 'Level 2 Trauma Hub'}
          </h1>
          <p className="text-xs text-slate-300">
            Zone: {currentHosp?.zone_id || 'Koti Central'} • Status: {currentHosp?.operational_status} • Cath Lab: Ready
          </p>
        </div>

        {/* Facility Switcher */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-300 font-bold hidden sm:inline">Medical Facility:</span>
          <select
            value={selectedHospId}
            onChange={(e) => setSelectedHospId(e.target.value)}
            className="bg-slate-800 text-white border border-slate-600 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-hidden"
          >
            {hospitals.map((hosp) => (
              <option key={hosp.id} value={hosp.id}>
                {hosp.name} (ICU: {hosp.icu_available}/{hosp.icu_total})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Left = Bed Controls, Right = Incoming Ambulance Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (6 Cols): Live Bed Inventory & Saturation Crisis */}
        <div className="lg:col-span-6 space-y-5">
          {/* Real-time ICU & General Bed Controls (Feature 1) */}
          <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-xs font-extrabold text-[#17324D] uppercase tracking-wider block">
                  Live Bed Capacity Registry
                </span>
                <span className="text-[11px] text-slate-500">
                  Instant telemetry broadcast across entire Hyderabad 108 network
                </span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                currentHosp?.icu_available === 0 ? 'bg-red-100 text-red-800 animate-pulse' :
                currentHosp?.icu_available <= 2 ? 'bg-amber-100 text-amber-800' :
                'bg-emerald-100 text-emerald-800'
              }`}>
                {currentHosp?.icu_available === 0 ? 'ICU Saturation (0 Beds)' : `${currentHosp?.icu_available} ICU Available`}
              </span>
            </div>

            {/* Bed Adjustment Counters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* ICU Beds Card */}
              <div className="p-4 rounded-xl border border-red-200 bg-red-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-950">Intensive Care (ICU)</span>
                  <span className="text-[10px] text-red-600 font-bold uppercase">Critical Life Support</span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl font-black text-red-900 font-mono">
                      {currentHosp?.icu_available}
                    </span>
                    <span className="text-xs text-slate-500 font-bold"> / {currentHosp?.icu_total} Total</span>
                  </div>
                  <span className="text-xs font-bold text-red-700 font-mono">{icuPct}% Occupied</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-red-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600 transition-all duration-300"
                    style={{ width: `${Math.min(100, icuPct)}%` }}
                  />
                </div>

                {/* +1 / -1 Buttons */}
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    onClick={() => handleAdjustBed('icu', -1)}
                    disabled={updating || currentHosp?.icu_available <= 0}
                    className="flex-1 py-1.5 bg-white border border-red-300 hover:bg-red-100 text-red-800 font-bold rounded-lg text-xs flex items-center justify-center space-x-1 transition disabled:opacity-40"
                  >
                    <Minus className="w-3.5 h-3.5" />
                    <span>Admit Patient (-1)</span>
                  </button>
                  <button
                    onClick={() => handleAdjustBed('icu', 1)}
                    disabled={updating || currentHosp?.icu_available >= currentHosp?.icu_total}
                    className="flex-1 py-1.5 bg-white border border-red-300 hover:bg-red-100 text-red-800 font-bold rounded-lg text-xs flex items-center justify-center space-x-1 transition disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Discharge (+1)</span>
                  </button>
                </div>
              </div>

              {/* General Beds Card */}
              <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-950">General Inpatient Ward</span>
                  <span className="text-[10px] text-teal-600 font-bold uppercase">Standard Care</span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl font-black text-teal-900 font-mono">
                      {currentHosp?.general_available}
                    </span>
                    <span className="text-xs text-slate-500 font-bold"> / {currentHosp?.general_total} Total</span>
                  </div>
                  <span className="text-xs font-bold text-teal-700 font-mono">
                    {Math.round(((currentHosp?.general_total - currentHosp?.general_available) / Math.max(1, currentHosp?.general_total)) * 100)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-teal-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0F9D91] transition-all duration-300"
                    style={{
                      width: `${Math.round(((currentHosp?.general_total - currentHosp?.general_available) / Math.max(1, currentHosp?.general_total)) * 100)}%`
                    }}
                  />
                </div>

                {/* +1 / -1 Buttons */}
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    onClick={() => handleAdjustBed('general', -1)}
                    disabled={updating || currentHosp?.general_available <= 0}
                    className="flex-1 py-1.5 bg-white border border-teal-300 hover:bg-teal-100 text-teal-800 font-bold rounded-lg text-xs flex items-center justify-center space-x-1 transition disabled:opacity-40"
                  >
                    <Minus className="w-3.5 h-3.5" />
                    <span>Admit Patient (-1)</span>
                  </button>
                  <button
                    onClick={() => handleAdjustBed('general', 1)}
                    disabled={updating || currentHosp?.general_available >= currentHosp?.general_total}
                    className="flex-1 py-1.5 bg-white border border-teal-300 hover:bg-teal-100 text-teal-800 font-bold rounded-lg text-xs flex items-center justify-center space-x-1 transition disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Discharge (+1)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Operational Status Toggles */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Facility Operational Status:</span>
              <div className="flex space-x-1.5">
                {["Operational", "Full Capacity", "Diverting"].map((st) => (
                  <button
                    key={st}
                    onClick={() => handleToggleStatus(st)}
                    disabled={updating}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition ${
                      currentHosp?.operational_status === st
                        ? 'bg-[#17324D] text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ICU Saturation Crisis Trigger (Problem Statement 10 Shock Test) */}
          <div className="bg-red-50 p-5 rounded-2xl border border-red-200 shadow-2xs space-y-3">
            <div className="flex items-center space-x-2 text-red-800">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider">
                ICU Saturation Crisis Shock Test
              </h3>
            </div>
            <p className="text-[11px] text-red-700 leading-relaxed">
              Instantly simulate 0 available ICU beds at this hospital. The RESQ-X dynamic rerouting engine will divert all inbound ambulances to secondary trauma centers before they reach this facility.
            </p>

            <button
              onClick={handleDeclareSaturation}
              disabled={updating || currentHosp?.icu_available === 0}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <ShieldAlert className="w-4 h-4 text-amber-300" />
              <span>Declare 0 ICU Beds Available (1-Click Shock)</span>
            </button>
          </div>

          {/* Specialist Readiness Panel */}
          <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-3 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-bold text-[#17324D] uppercase tracking-wider flex items-center space-x-1.5">
                <Stethoscope className="w-4 h-4 text-purple-600" />
                <span>On-Duty Clinical Specialties & Readiness</span>
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 font-bold px-2 py-0.5 rounded">
                All On Call
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11.5px]">
              {[
                { name: "Trauma Surgery", status: "Active", doctor: "Dr. Venkat Rao" },
                { name: "Interventional Cardiology", status: "Ready", doctor: "Dr. K. Srinivas" },
                { name: "Neurology & Stroke", status: "Active", doctor: "Dr. P. Sunitha" },
                { name: "Orthopedic Emergency", status: "Ready", doctor: "Dr. M. Farooq" },
              ].map((s, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <strong className="text-slate-800">{s.name}</strong>
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                      {s.status}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">{s.doctor}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (6 Cols): Incoming Ambulance Pipeline & Patient Reception */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <Ambulance className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-extrabold text-[#17324D] text-sm">
                    Inbound Ambulance Pipeline
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Real-time clinical ETA and triage pre-notifications
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full font-mono">
                {incomingIncidents.length} Inbound
              </span>
            </div>

            {/* Inbound Patients List */}
            {incomingIncidents.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p>No inbound emergency patients currently dispatched to {currentHosp.name}.</p>
                <p className="text-[11px] text-slate-400">
                  New emergency dispatches from the Citizen Portal will automatically appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {incomingIncidents.map((inc) => {
                  const assignedAmb = ambulances.find(a => a.id === inc.assigned_ambulance_id);
                  const isAccepted = acceptedCases[inc.id] === 'accepted';
                  const isDiverted = acceptedCases[inc.id] === 'diverted';

                  return (
                    <div
                      key={inc.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <strong className="text-xs font-bold text-[#17324D]">{inc.title}</strong>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                              inc.severity === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                            }`}>
                              {inc.severity}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 block mt-0.5 font-mono">
                            Vehicle: {assignedAmb?.code || 'ALS Unit'} • ETA: ~{assignedAmb?.eta_minutes || 4.2} mins
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                          <span className="text-xs font-bold text-blue-700">{inc.status}</span>
                        </div>
                      </div>

                      {/* Clinical requirements summary */}
                      <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                        {inc.ai_reasoning || inc.description}
                      </p>

                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-[11px] text-slate-600">
                          {inc.requires_icu ? '🚨 ICU Bed Reserved' : 'Standard Trauma Bed'}
                        </span>

                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleCaseAction(inc.id, 'diverted')}
                            disabled={isDiverted}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border transition ${
                              isDiverted
                                ? 'bg-red-600 text-white border-red-700'
                                : 'bg-white border-slate-300 text-red-700 hover:bg-red-50'
                            }`}
                          >
                            {isDiverted ? 'Diverted' : 'Divert Case'}
                          </button>
                          <button
                            onClick={() => handleCaseAction(inc.id, 'accepted')}
                            disabled={isAccepted}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border transition ${
                              isAccepted
                                ? 'bg-emerald-600 text-white border-emerald-700'
                                : 'bg-[#17324D] text-white border-[#17324D] hover:bg-[#204569]'
                            }`}
                          >
                            {isAccepted ? 'Case Accepted' : 'Accept Case'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
