import React, { useState, useEffect } from 'react';
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
  Sliders,
  Send,
  Zap,
  ArrowRight,
  ShieldAlert,
  Flame,
  Check,
  User,
  LogOut,
  Lock
} from 'lucide-react';
import { updateAmbulanceStatus, triggerSimulationEvent, fetchRadioMessages, sendRadioMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import RoleAuthGate from '../components/RoleAuthGate';

const TURN_BY_TURN_STEPS = [
  "Proceed south on Outer Ring Road toward Cyber Towers (1.2 km)",
  "Take Exit 4 onto Hitec City Main Road (450 m)",
  "Turn left at Mindspace Junction onto Madhapur Expressway (800 m)",
  "Arrive at Incident Location on left (Traffic congestion alert: +1.2 min)"
];

export default function AmbulancePortalView({ state, onRefresh }) {
  const { user, isAuthenticated, logout } = useAuth();
  const isAmbulance = isAuthenticated && user?.role === 'ambulance';

  const ambulances = state?.ambulances || [];
  const incidents = state?.incidents || [];
  const hospitals = state?.hospitals || [];

  const [selectedAmbId, setSelectedAmbId] = useState(user?.entity_id || ambulances[0]?.id || "amb-01");
  const [updating, setUpdating] = useState(false);
  const [radioMsg, setRadioMsg] = useState("");
  const [radioHistory, setRadioHistory] = useState([]);
  const [equipmentChecks, setEquipmentChecks] = useState({
    oxygen: true,
    defibrillator: true,
    ventilator: true,
    traumaKit: true,
    spineBoard: true
  });

  // Keep selectedAmbId synced to authenticated user entity
  useEffect(() => {
    if (user?.entity_id) {
      setSelectedAmbId(user.entity_id);
    }
  }, [user]);

  // Load radio messages from SQLite DB
  const loadRadio = async () => {
    try {
      const msgs = await fetchRadioMessages(selectedAmbId);
      if (msgs && msgs.length > 0) {
        setRadioHistory(msgs);
      } else {
        setRadioHistory([
          { sender: "Municipal Dispatch", message: "Priority dispatch confirmed. Trauma Level 1 reception pre-notified.", timestamp: "10:31 AM" },
          { sender: user?.name || "RESQ-A01", message: "Unit en route. Siren active. ETA 4.2 mins.", timestamp: "10:32 AM" }
        ]);
      }
    } catch (e) {
      // Fallback
    }
  };

  useEffect(() => {
    if (isAmbulance) {
      loadRadio();
    }
  }, [selectedAmbId, isAmbulance]);

  // If not authenticated as ambulance, render Ambulance Authentication Gate
  if (!isAmbulance) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <RoleAuthGate
          targetRole="ambulance"
          title="Ambulance Paramedic MDT Terminal"
          subtitle="Authenticate using your paramedic badge ID and fleet call sign to access turn-by-turn navigation, patient telemetry, and dispatch radio."
          icon={Ambulance}
        />
      </div>
    );
  }

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

  const handleBreakdownAlert = async () => {
    if (!currentAmb) return;
    try {
      setUpdating(true);
      await triggerSimulationEvent('ambulance-failure', { ambulance_id: currentAmb.id });
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Breakdown alert failed", e);
    } finally {
      setUpdating(false);
    }
  };

  const handleSendRadio = async (e) => {
    e.preventDefault();
    if (!radioMsg.trim()) return;
    const text = radioMsg.trim();
    setRadioMsg("");

    try {
      const res = await sendRadioMessage({
        message: text,
        channel: 'CH-1 (Emergency Tactical)',
        ambulance_id: currentAmb.id
      });
      if (res?.message) {
        setRadioHistory(prev => [...prev, res.message]);
      }
    } catch (err) {
      setRadioHistory(prev => [
        ...prev,
        { sender: user.name, message: text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
    }
  };

  const toggleEquipment = (key) => {
    setEquipmentChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Verified Paramedic Crew Identity Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-[#17324D] to-slate-900 text-white p-4 md:p-5 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-md border border-blue-800/40">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center font-bold text-blue-300 shadow-inner">
            <Ambulance className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-base tracking-tight">{user.name}</span>
              <span className="text-[10px] bg-blue-500/30 text-blue-200 border border-blue-400/30 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                {user.metadata?.ambulance_type || 'ALS'} Life-Support • {user.metadata?.badge_number || 'EMR-HYD'}
              </span>
            </div>
            <div className="text-[11px] text-blue-200/80 flex flex-wrap gap-x-3.5 gap-y-1 mt-1 font-medium">
              <span>Paramedic: <strong className="text-white">{user.metadata?.paramedic_name || 'Dr. On Duty'}</strong></span>
              <span>Pilot: <strong className="text-white">{user.metadata?.driver_name || 'Driver In Cab'}</strong></span>
              <span>Assigned Unit: <strong className="text-white font-mono">{currentAmb.code}</strong></span>
              <span className="flex items-center space-x-1 text-emerald-400">
                <Lock className="w-3 h-3" />
                <span>MDT Session Locked to Vehicle</span>
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 self-start md:self-center border border-white/15"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>End Shift / Sign Out</span>
        </button>
      </div>

      {/* MDT Terminal Control Bar */}
      <div className="bg-[#17324D] text-white p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-slate-700">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-teal-300 uppercase tracking-wider">
            <Radio className="w-4 h-4 text-teal-300 animate-pulse" />
            <span>Mobile Data Terminal (MDT) In-Cab Telematics</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black mt-1">
            Unit {currentAmb?.code} — {currentAmb?.type} Response Console
          </h1>
          <p className="text-xs text-slate-300">
            Base Station: {currentAmb?.base_zone_id || 'Koti Central'} • Speed: ~38 km/h • Fuel & Battery: 94%
          </p>
        </div>

        {/* Vehicle Switcher (Fleet Paramedic Selection) */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-300 font-bold hidden sm:inline">Fleet Call Sign:</span>
          <select
            value={selectedAmbId}
            onChange={(e) => setSelectedAmbId(e.target.value)}
            className="bg-slate-800 text-white border border-slate-600 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-hidden"
          >
            {ambulances.map((amb) => (
              <option key={amb.id} value={amb.id}>
                {amb.code} ({amb.type}) — {amb.status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main 2-Column MDT Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 Cols): Active Mission, Navigation & Stepper */}
        <div className="lg:col-span-7 space-y-5">
          {/* Availability Status Bar (Feature 2) */}
          <div className="bg-white p-4 rounded-2xl border border-[#E3E9EF] shadow-2xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-600">Unit Operational State:</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                currentAmb?.status === 'Available' ? 'bg-emerald-100 text-emerald-800' :
                currentAmb?.status === 'Dispatched' ? 'bg-blue-100 text-blue-800' :
                currentAmb?.status === 'Unavailable' ? 'bg-red-100 text-red-800' :
                'bg-amber-100 text-amber-800'
              }`}>
                {currentAmb?.status}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleUpdateStatus('Available')}
                disabled={updating || currentAmb?.status === 'Available'}
                className="px-3 py-1 text-xs font-bold rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
              >
                Available
              </button>
              <button
                onClick={() => handleUpdateStatus('Dispatched')}
                disabled={updating || currentAmb?.status === 'Dispatched'}
                className="px-3 py-1 text-xs font-bold rounded-lg border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100 disabled:opacity-40"
              >
                Busy
              </button>
              <button
                onClick={() => handleUpdateStatus('Unavailable')}
                disabled={updating || currentAmb?.status === 'Unavailable'}
                className="px-3 py-1 text-xs font-bold rounded-lg border border-red-300 bg-red-50 text-red-800 hover:bg-red-100 disabled:opacity-40"
              >
                Offline
              </button>
            </div>
          </div>

          {/* Assigned Emergency Incident (Features 3 & 4) */}
          {assignedInc ? (
            <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center space-x-2">
                  <Flame className="w-5 h-5 text-red-600 animate-pulse" />
                  <h3 className="font-extrabold text-[#17324D] text-sm">
                    Active Mission: {assignedInc.title}
                  </h3>
                </div>
                <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full uppercase">
                  {assignedInc.severity} Priority
                </span>
              </div>

              {/* Patient Clinical Profile */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-700">
                  <span className="font-bold">Clinical Requirements & Triage Note:</span>
                  <span className="font-mono text-[10px] text-slate-500">Target ETA: {currentAmb?.eta_minutes || 4.2}m</span>
                </div>
                <p className="text-[11.5px] text-slate-600 leading-relaxed">
                  {assignedInc.description || assignedInc.ai_reasoning}
                </p>
                <div className="flex flex-wrap gap-2 pt-1 text-[10.5px]">
                  <span className="bg-red-50 text-red-800 px-2 py-0.5 rounded font-bold">
                    Patients: {assignedInc.affected_count || 1}
                  </span>
                  <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded font-bold">
                    ICU Pre-allocation: {assignedInc.requires_icu ? 'Required' : 'Standard Bed'}
                  </span>
                  <span className="bg-teal-50 text-teal-800 px-2 py-0.5 rounded font-bold">
                    Equipment: {assignedInc.required_equipment?.join(', ') || 'Ventilator'}
                  </span>
                </div>
              </div>

              {/* Mission Progress Stepper (Feature 11) */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold text-slate-700 block">Mission Step & Action</span>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "1. En Route", status: "Dispatched" },
                    { label: "2. At Scene", status: "On Scene" },
                    { label: "3. Picked Up", status: "Transporting" },
                    { label: "4. Reached Hosp", status: "Available" }
                  ].map((step, idx) => {
                    const isActive = currentAmb.status === step.status;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleUpdateStatus(step.status)}
                        disabled={updating}
                        className={`p-2.5 rounded-xl text-xs font-bold text-center border transition flex flex-col items-center justify-center space-y-1 ${
                          isActive
                            ? 'bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-200'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{step.label}</span>
                        {isActive && <span className="text-[9px] bg-white/20 px-1.5 py-0.2 rounded">ACTIVE</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-2xl border border-[#E3E9EF] shadow-2xs text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Dispatched Incident Currently Assigned</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Unit {currentAmb.code} is on standby in {currentAmb.base_zone_id || 'Koti'}. Central Command CAD engine will automatically assign the next prioritized mission.
              </p>
            </div>
          )}

          {/* Turn-by-Turn Dynamic Navigation (Features 5, 6, 7, 9, 10) */}
          <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-extrabold text-[#17324D] uppercase tracking-wider flex items-center space-x-1.5">
                <Navigation className="w-4 h-4 text-blue-600" />
                <span>Tactical Turn-by-Turn Navigation</span>
              </span>
              <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-bold px-2 py-0.5 rounded">
                Dynamic Traffic Rerouting
              </span>
            </div>

            <div className="space-y-2">
              {TURN_BY_TURN_STEPS.map((step, idx) => (
                <div key={idx} className="flex items-start space-x-3 text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <span className="text-slate-700 leading-relaxed">{step}</span>
                </div>
              ))}
            </div>

            {/* Hospital Destination Details (Features 9 & 10) */}
            {targetHosp && (
              <div className="mt-3 p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2.5">
                  <Building2 className="w-5 h-5 text-teal-700" />
                  <div>
                    <strong className="text-teal-950 font-bold block">{targetHosp.name}</strong>
                    <span className="text-[10px] text-teal-700">
                      Destination ER • {targetHosp.icu_available} ICU Beds Reserved
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Hospital ETA</span>
                  <strong className="text-sm font-black text-teal-900 font-mono">6.5 min</strong>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 Cols): Chaos Trigger, Radio & Equipment Status */}
        <div className="lg:col-span-5 space-y-5">
          {/* Breakdown Alert Button (Feature 13 - Problem Statement Crisis Trigger) */}
          <div className="bg-red-50 p-5 rounded-2xl border border-red-200 shadow-2xs space-y-3">
            <div className="flex items-center space-x-2 text-red-800">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <h3 className="font-extrabold text-xs uppercase tracking-wider">
                Ambulance Breakdown Crisis Alert
              </h3>
            </div>
            <p className="text-[11px] text-red-700 leading-relaxed">
              Report mechanical failure, flat tire, or engine breakdown. The central ripple engine will instantly reassign pending patients to the next best vehicle.
            </p>

            <button
              onClick={handleBreakdownAlert}
              disabled={updating || currentAmb.status === 'Unavailable'}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Report Vehicle Breakdown Alert (1-Click)</span>
            </button>
          </div>

          {/* 2-Way Dispatch Radio Channel with SQLite Persistence (Feature 12) */}
          <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-3 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-bold text-[#17324D] uppercase tracking-wider flex items-center space-x-1.5">
                <Radio className="w-4 h-4 text-teal-600" />
                <span>Tactical Radio Channel (CH-1)</span>
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded font-mono">
                SQLite Encrypted
              </span>
            </div>

            {/* Radio Log Stream */}
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
              {radioHistory.map((item, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <strong className="text-[#17324D] font-bold">{item.sender}</strong>
                    <span className="text-slate-400 font-mono">{item.timestamp || item.time}</span>
                  </div>
                  <p className="text-[11px] text-slate-700 leading-relaxed">{item.message || item.text}</p>
                </div>
              ))}
            </div>

            {/* Radio Input */}
            <form onSubmit={handleSendRadio} className="flex space-x-2 pt-1">
              <input
                type="text"
                value={radioMsg}
                onChange={(e) => setRadioMsg(e.target.value)}
                placeholder="Transmit message to Central CAD Dispatch..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden"
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-[#17324D] text-white rounded-xl hover:bg-[#204569] transition font-bold"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* On-Board Medical Equipment Checklist (Feature 14) */}
          <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-3 text-xs">
            <h3 className="font-bold text-[#17324D] uppercase tracking-wider border-b pb-2 flex items-center justify-between">
              <span>On-Board Medical Equipment Checklist</span>
              <span className="text-[10px] text-teal-700 font-bold">5 Certified</span>
            </h3>

            <div className="space-y-2">
              {[
                { key: 'oxygen', label: 'Medical Oxygen Cylinder (100% full)' },
                { key: 'defibrillator', label: 'Automated External Defibrillator (AED)' },
                { key: 'ventilator', label: 'Transport Ventilator & Bag-Valve-Mask' },
                { key: 'traumaKit', label: 'Advanced Trauma First-Aid Dressings' },
                { key: 'spineBoard', label: 'Rigid Spine Board & Cervical Collar' }
              ].map((item) => (
                <div
                  key={item.key}
                  onClick={() => toggleEquipment(item.key)}
                  className="flex items-center justify-between p-2 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition select-none"
                >
                  <span className="text-slate-700 text-xs">{item.label}</span>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${
                    equipmentChecks[item.key] ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                  }`}>
                    {equipmentChecks[item.key] && <Check className="w-3.5 h-3.5" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
