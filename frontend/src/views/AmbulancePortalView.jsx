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
  Sliders,
  Send,
  Zap,
  ArrowRight,
  ShieldAlert,
  Flame,
  Check
} from 'lucide-react';
import { updateAmbulanceStatus, triggerSimulationEvent } from '../services/api';

const TURN_BY_TURN_STEPS = [
  "Proceed south on Outer Ring Road toward Cyber Towers (1.2 km)",
  "Take Exit 4 onto Hitec City Main Road (450 m)",
  "Turn left at Mindspace Junction onto Madhapur Expressway (800 m)",
  "Arrive at Incident Location on left (Traffic congestion alert: +1.2 min)"
];

export default function AmbulancePortalView({ state, onRefresh }) {
  const ambulances = state?.ambulances || [];
  const incidents = state?.incidents || [];
  const hospitals = state?.hospitals || [];

  const [selectedAmbId, setSelectedAmbId] = useState(ambulances[0]?.id || "amb-01");
  const [updating, setUpdating] = useState(false);
  const [radioMsg, setRadioMsg] = useState("");
  const [radioHistory, setRadioHistory] = useState([
    { sender: "Dispatcher", text: "Priority dispatch confirmed. Trauma Level 1 reception pre-notified.", time: "10:31 AM" },
    { sender: "RESQ-A01", text: "Unit en route. Siren active. ETA 4.2 mins.", time: "10:32 AM" }
  ]);
  const [equipmentChecks, setEquipmentChecks] = useState({
    oxygen: true,
    defibrillator: true,
    ventilator: true,
    traumaKit: true,
    spineBoard: true
  });

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

  const handleSendRadio = (e) => {
    e.preventDefault();
    if (!radioMsg.trim()) return;
    setRadioHistory(prev => [
      ...prev,
      { sender: currentAmb?.code || 'Ambulance', text: radioMsg, time: new Date().toLocaleTimeString() }
    ]);
    setRadioMsg("");
  };

  const toggleEquipment = (key) => {
    setEquipmentChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* MDT Terminal Banner */}
      <div className="bg-[#17324D] text-white p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-slate-700">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-teal-300 uppercase tracking-wider">
            <Radio className="w-4 h-4 text-teal-300 animate-pulse" />
            <span>Paramedic Mobile Data Terminal (MDT) • In-Cab Telemetry</span>
          </div>
          <h1 className="text-2xl font-black mt-1 flex items-center space-x-2.5">
            <Ambulance className="w-6 h-6 text-blue-400" />
            <span>Unit: {currentAmb?.code || 'RESQ-A01'}</span>
            <span className="text-xs bg-blue-600/80 px-2.5 py-0.5 rounded-full font-bold">
              {currentAmb?.type || 'ALS'} Unit
            </span>
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Real-time CAD mission receiver, patient medical vitals, turn-by-turn navigation, and breakdown alerts.
          </p>
        </div>

        {/* Switch Ambulance Vehicle & Availability Toggle */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
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

          {/* Quick Availability Status Pill */}
          <div className="flex items-center space-x-1 bg-[#12263a] p-1.5 rounded-xl border border-slate-700 text-xs font-bold">
            <button
              onClick={() => handleUpdateStatus('Available')}
              className={`px-3 py-1 rounded-lg transition ${
                currentAmb?.status === 'Available' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Available
            </button>
            <button
              onClick={() => handleUpdateStatus('Dispatched')}
              className={`px-3 py-1 rounded-lg transition ${
                currentAmb?.status === 'Dispatched' || currentAmb?.status === 'Transporting' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Busy
            </button>
            <button
              onClick={() => handleUpdateStatus('Unavailable')}
              className={`px-3 py-1 rounded-lg transition ${
                currentAmb?.status === 'Unavailable' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Offline
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Mission Navigation Left, Status Stepper & Comm Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Assigned Mission & Live Navigation */}
        <div className="lg:col-span-2 space-y-6">
          {/* Assigned Mission Card */}
          <div className="bg-white rounded-2xl border border-[#E3E9EF] p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-[#17324D] uppercase tracking-wider flex items-center space-x-2">
                <Navigation className="w-4 h-4 text-blue-600" />
                <span>Current Assigned Emergency Mission</span>
              </h2>

              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                currentAmb?.status === 'Dispatched' ? 'bg-blue-100 text-blue-800' :
                currentAmb?.status === 'On Scene' ? 'bg-amber-100 text-amber-800' :
                currentAmb?.status === 'Transporting' ? 'bg-purple-100 text-purple-800' :
                currentAmb?.status === 'Available' ? 'bg-emerald-100 text-emerald-800' :
                'bg-slate-200 text-slate-700'
              }`}>
                Mission Stage: {currentAmb?.status}
              </span>
            </div>

            {assignedInc ? (
              <div className="space-y-4 text-xs">
                {/* Incident Information */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-slate-400 text-[10px]">INCIDENT REF: {assignedInc.id?.toUpperCase()}</span>
                    <span className="bg-red-600 text-white font-bold text-[10px] px-2 py-0.5 rounded uppercase">
                      {assignedInc.severity} Priority ({assignedInc.priority_score}/100)
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900">{assignedInc.title}</h3>
                  <p className="text-slate-600 text-xs leading-relaxed">{assignedInc.description}</p>

                  <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-slate-500 text-[11px]">
                    <span>Location: <strong className="text-slate-800">{assignedInc.zone_id}</strong></span>
                    <span>Casualties: <strong className="text-red-600">{assignedInc.injured_count} Injured ({assignedInc.unconscious ? 'Unconscious' : 'Conscious'})</strong></span>
                    <span>ICU Needed: <strong className="text-red-700">{assignedInc.requires_icu ? 'YES' : 'No'}</strong></span>
                  </div>
                </div>

                {/* Turn-by-Turn Dynamic Route Navigation (Feature 5 & 6) */}
                <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-blue-900 font-bold">
                      <Navigation className="w-4 h-4 text-blue-700" />
                      <span>Dynamic Turn-by-Turn GPS Route Guidance</span>
                    </div>
                    <span className="text-[10px] bg-blue-200 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                      ETA: {currentAmb?.eta_minutes || 4.2} mins
                    </span>
                  </div>

                  <div className="space-y-1.5 pl-2 border-l-2 border-blue-400 text-[11px] text-blue-950">
                    {TURN_BY_TURN_STEPS.map((step, idx) => (
                      <div key={idx} className="flex items-start space-x-2 py-0.5">
                        <span className="font-bold text-blue-600 shrink-0">{idx + 1}.</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Destination Hospital Navigation (Feature 9) */}
                <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-200 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0F9D91] text-white flex items-center justify-center font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-teal-700 uppercase font-bold block">Assigned Receiving Facility:</span>
                      <strong className="text-sm font-bold text-teal-950">{targetHosp?.name || 'Osmania General Hospital'}</strong>
                      <span className="text-[10px] text-teal-800 block">Verified ICU Beds: {targetHosp?.icu_available || 3} free</span>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-teal-900 bg-teal-100/70 px-3 py-1.5 rounded-xl border border-teal-300">
                    Trauma Bay 02 Reserved
                  </span>
                </div>

                {/* Paramedic Lifecycle Workflow Actions (Feature 10) */}
                <div className="pt-2">
                  <span className="text-xs font-bold text-[#17324D] uppercase tracking-wider block mb-2">
                    Update Mission Lifecycle Stepper:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      onClick={() => handleUpdateStatus('Dispatched')}
                      disabled={updating}
                      className="p-3 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs transition flex flex-col items-center space-y-1"
                    >
                      <Navigation className="w-4 h-4 text-blue-600" />
                      <span>1. En Route</span>
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('On Scene')}
                      disabled={updating}
                      className="p-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs transition flex flex-col items-center space-y-1"
                    >
                      <MapPin className="w-4 h-4 text-amber-600" />
                      <span>2. At Scene</span>
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('Transporting')}
                      disabled={updating}
                      className="p-3 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-xs transition flex flex-col items-center space-y-1"
                    >
                      <CheckCircle2 className="w-4 h-4 text-purple-600" />
                      <span>3. Picked Up</span>
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('Available')}
                      disabled={updating}
                      className="p-3 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition flex flex-col items-center space-y-1"
                    >
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      <span>4. Completed</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <strong className="text-sm font-bold text-slate-700 block">Ambulance Is On Standby Ready</strong>
                <p>Vehicle is currently staged in {currentAmb?.zone_id}. Standing by for central CAD dispatch assignment.</p>
              </div>
            )}
          </div>

          {/* Breakdown Alert Chaos Simulation Trigger (Feature 12) */}
          <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-red-700 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Vehicle Breakdown & Disruption Reporting</span>
              </div>
              <h4 className="text-sm font-black text-red-950 mt-0.5">Report Ambulance Failure / In-Transit Breakdown</h4>
              <p className="text-[11px] text-red-800 mt-0.5">
                Experiencing engine failure, tire blowout, or mechanical stoppage? Report immediately to trigger
                automatic dynamic reallocation by the Command Centre without abandoning critical patients.
              </p>
            </div>

            <button
              onClick={handleBreakdownAlert}
              disabled={updating || currentAmb?.status === 'Unavailable'}
              className="px-5 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-md shadow-red-900/20 transition flex items-center space-x-2 shrink-0"
            >
              <Zap className="w-4 h-4" />
              <span>Report Breakdown Alert</span>
            </button>
          </div>
        </div>

        {/* Right Col: Radio Telemetry & Equipment Checklist */}
        <div className="space-y-6">
          {/* Equipment Status Checklist (Feature 13) */}
          <div className="bg-white rounded-2xl border border-[#E3E9EF] p-5 shadow-2xs space-y-3 text-xs">
            <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider pb-2 border-b flex items-center justify-between">
              <span>Equipment Readiness Checklist</span>
              <span className="text-[10px] text-emerald-600 font-bold">100% Verified</span>
            </h3>

            <div className="space-y-2">
              <label className="flex items-center justify-between p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <span className="font-semibold text-slate-700">Oxygen Delivery System (Full)</span>
                <input
                  type="checkbox"
                  checked={equipmentChecks.oxygen}
                  onChange={() => toggleEquipment('oxygen')}
                  className="w-4 h-4 text-teal-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <span className="font-semibold text-slate-700">Automated Defibrillator / AED</span>
                <input
                  type="checkbox"
                  checked={equipmentChecks.defibrillator}
                  onChange={() => toggleEquipment('defibrillator')}
                  className="w-4 h-4 text-teal-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <span className="font-semibold text-slate-700">Transport Ventilator</span>
                <input
                  type="checkbox"
                  checked={equipmentChecks.ventilator}
                  onChange={() => toggleEquipment('ventilator')}
                  className="w-4 h-4 text-teal-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <span className="font-semibold text-slate-700">Polytrauma First-Aid Kit</span>
                <input
                  type="checkbox"
                  checked={equipmentChecks.traumaKit}
                  onChange={() => toggleEquipment('traumaKit')}
                  className="w-4 h-4 text-teal-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <span className="font-semibold text-slate-700">Spine Board & Immobilization Splints</span>
                <input
                  type="checkbox"
                  checked={equipmentChecks.spineBoard}
                  onChange={() => toggleEquipment('spineBoard')}
                  className="w-4 h-4 text-teal-600 rounded"
                />
              </label>
            </div>
          </div>

          {/* Emergency Communication Radio (Feature 11) */}
          <div className="bg-white rounded-2xl border border-[#E3E9EF] p-5 shadow-2xs space-y-3 text-xs">
            <h3 className="text-xs font-bold text-[#17324D] uppercase tracking-wider pb-2 border-b flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Radio className="w-4 h-4 text-teal-600" />
                <span>Command Centre Radio Channel</span>
              </span>
              <span className="text-[10px] text-teal-600 font-mono">154.250 MHz</span>
            </h3>

            {/* Radio Log Stream */}
            <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar pr-1">
              {radioHistory.map((item, idx) => (
                <div key={idx} className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-0.5">
                  <div className="flex items-center justify-between font-bold text-slate-700">
                    <span>{item.sender}</span>
                    <span className="text-[9px] text-slate-400 font-mono">{item.time}</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>

            {/* Send Radio Input */}
            <form onSubmit={handleSendRadio} className="flex items-center space-x-2 pt-1">
              <input
                type="text"
                value={radioMsg}
                onChange={(e) => setRadioMsg(e.target.value)}
                placeholder="Transmit telemetry message..."
                className="flex-1 p-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-[#2563A6]"
              />
              <button
                type="submit"
                className="p-2 bg-[#17324D] text-white rounded-xl hover:bg-[#2563A6] transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
