import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  MapPin,
  Ambulance,
  Building2,
  Clock,
  ShieldCheck,
  CheckCircle2,
  PhoneCall,
  Activity,
  Flame,
  ArrowRight,
  HeartPulse,
  Camera,
  Upload,
  History,
  Bell,
  Compass,
  Check
} from 'lucide-react';
import { submitEmergencyReport, analyzeTextAI } from '../services/api';

const QUICK_EMERGENCIES = [
  {
    title: "1. Road Accident (Madhapur)",
    desc: "Two cars collided on Hitec City road near Madhapur. Five people injured. One person unconscious with severe head trauma.",
    category: "road_accident",
    zone: "zone-madhapur",
    injured: 5,
    unconscious: true
  },
  {
    title: "2. Heart Attack (Ameerpet)",
    desc: "Elderly male having acute chest pain radiating to left arm and shortness of breath in Ameerpet transit hub.",
    category: "cardiac_emergency",
    zone: "zone-ameerpet",
    injured: 1,
    unconscious: false
  },
  {
    title: "3. Urban Flooding (Kukatpally)",
    desc: "Severe monsoon waterlogging at Y-Junction underpass in Kukatpally. Several commuters trapped in rising floodwaters.",
    category: "urban_flooding",
    zone: "zone-kukatpally",
    injured: 4,
    unconscious: false
  },
  {
    title: "4. Building Fire (Gachibowli)",
    desc: "Commercial building 4th floor structural fire in Gachibowli Tech Corridor with smoke inhalation and burn injuries.",
    category: "fire",
    zone: "zone-gachibowli",
    injured: 3,
    unconscious: false
  }
];

const STATUS_STEPS = [
  { id: 'reported', label: '1. Reported' },
  { id: 'verified', label: '2. Verified' },
  { id: 'assigned', label: '3. Assigned' },
  { id: 'en_route', label: '4. En Route' },
  { id: 'arrived', label: '5. At Scene' },
  { id: 'completed', label: '6. Completed' }
];

export default function CitizenPortalView({ state, onRefresh }) {
  const zones = state?.zones || [];
  const incidents = state?.incidents || [];
  const ambulances = state?.ambulances || [];
  const hospitals = state?.hospitals || [];

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("road_accident");
  const [zoneId, setZoneId] = useState("zone-madhapur");
  const [injuredCount, setInjuredCount] = useState(1);
  const [unconscious, setUnconscious] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeSOS, setActiveSOS] = useState(null);
  const [uploadedPhoto, setUploadedPhoto] = useState(null);
  const [aiPreview, setAiPreview] = useState(null);
  const [locationShared, setLocationShared] = useState(false);

  // Default to showing the latest incident as active SOS tracking if exists
  useEffect(() => {
    if (!activeSOS && incidents.length > 0) {
      setActiveSOS(incidents[0]);
    } else if (activeSOS) {
      const updated = incidents.find(i => i.id === activeSOS.id);
      if (updated) setActiveSOS(updated);
    }
  }, [incidents]);

  // Live debounced AI triage preview
  useEffect(() => {
    if (!description.trim()) {
      setAiPreview(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const preview = await analyzeTextAI({
          description,
          category,
          affected_count: Number(injuredCount),
          injured_count: Number(injuredCount),
          unconscious
        });
        setAiPreview(preview);
      } catch (e) {
        console.error("AI Preview Error", e);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [description, category, injuredCount, unconscious]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!description.trim()) return;

    try {
      setSubmitting(true);
      const res = await submitEmergencyReport({
        description,
        category,
        zone_id: zoneId,
        affected_count: Number(injuredCount),
        injured_count: Number(injuredCount),
        unconscious
      });

      setActiveSOS(res.incident);
      setDescription("");
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("SOS submission failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickPanic = (item) => {
    setDescription(item.desc);
    setCategory(item.category);
    setZoneId(item.zone);
    setInjuredCount(item.injured);
    setUnconscious(item.unconscious);
  };

  const handleSimulateGPS = () => {
    setLocationShared(true);
    setZoneId("zone-madhapur");
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedPhoto(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Find assigned assets for active SOS
  const assignedAmb = ambulances.find(a => a.id === activeSOS?.assigned_ambulance_id);
  const assignedHosp = hospitals.find(h => h.id === activeSOS?.assigned_hospital_id);

  // Determine current active step index in the 6-stage lifecycle
  const getStepIndex = () => {
    if (!activeSOS) return 0;
    if (activeSOS.status === 'Resolved' || assignedAmb?.status === 'Available') return 5;
    if (assignedAmb?.status === 'Transporting') return 4;
    if (assignedAmb?.status === 'On Scene') return 4;
    if (assignedAmb?.status === 'Dispatched') return 3;
    if (activeSOS.assigned_ambulance_id) return 2;
    return 1;
  };

  const currentStepIdx = getStepIndex();

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Citizen Emergency Banner */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white p-5 md:p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full w-fit">
            <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
            <span>Citizen Emergency Portal • Hyderabad 108 Emergency Network</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black mt-2">Instant Emergency SOS & Live Tracker</h1>
          <p className="text-xs text-rose-100 max-w-xl mt-1 leading-relaxed">
            Report medical emergencies, collisions, fires, or flooding. The RESQ-X intelligent command network
            classifies triage, dispatches the closest equipped ALS ambulance, and pre-books receiving hospital ICU bays.
          </p>
        </div>

        {/* 1-Click SOS Panic Button */}
        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => {
              setDescription("URGENT MEDICAL EMERGENCY: Immediate life-support ambulance requested at my current location!");
              setCategory("cardiac_emergency");
              setUnconscious(true);
              setInjuredCount(1);
            }}
            className="px-6 py-4 bg-white text-red-600 hover:bg-rose-50 rounded-2xl shadow-lg font-black text-sm uppercase tracking-wider transition transform hover:scale-105 flex items-center space-x-2 border-2 border-white/40"
          >
            <HeartPulse className="w-6 h-6 text-red-600 animate-pulse" />
            <span>ONE-TOUCH SOS</span>
          </button>

          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20 text-center hidden sm:block">
            <PhoneCall className="w-5 h-5 text-white mx-auto mb-1 animate-bounce" />
            <div className="text-base font-black font-mono">108 / 112</div>
            <span className="text-[9px] text-rose-200">Emergency Helpline</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Report Form Left, Live Response Tracker Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Report an Emergency Form */}
        <div className="bg-white p-6 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-[#17324D] uppercase tracking-wider flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span>Report an Emergency Incident</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">Auto AI Triage Enabled</span>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Quick Presets (PS10 Hyderabad Scenarios):</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUICK_EMERGENCIES.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleQuickPanic(q)}
                  className="p-2 rounded-xl border border-slate-200 hover:border-red-400 hover:bg-red-50/50 text-left transition text-xs"
                >
                  <strong className="block text-[#17324D] font-bold truncate text-[11px]">{q.title}</strong>
                  <span className="text-[10px] text-slate-500">{q.injured} casualties</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description Input */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Describe the situation or symptoms:
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Two cars collided on Hitec City road near Madhapur. Five people injured. One unconscious..."
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:border-red-500 focus:ring-1 focus:ring-red-400 outline-none text-[#243447]"
            />
          </div>

          {/* Category & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-600 font-semibold block mb-1">Emergency Category:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 outline-none"
              >
                <option value="road_accident">Road Accident / Collision</option>
                <option value="cardiac_emergency">Cardiac Emergency / Chest Pain</option>
                <option value="urban_flooding">Urban Flooding / Waterlogging</option>
                <option value="fire">Fire / Burns / Smoke</option>
                <option value="medical_emergency">General Medical Emergency</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-600 font-semibold">Location / Sector:</label>
                <button
                  type="button"
                  onClick={handleSimulateGPS}
                  className="text-[10px] text-blue-600 hover:underline font-bold flex items-center space-x-1"
                >
                  <Compass className="w-3 h-3" />
                  <span>{locationShared ? 'GPS Shared' : 'Share GPS'}</span>
                </button>
              </div>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-800 outline-none"
              >
                {zones.map(z => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Casualties & Unconscious Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-600 font-semibold block mb-1">Number of Injured:</label>
              <input
                type="number"
                min={1}
                value={injuredCount}
                onChange={(e) => setInjuredCount(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-red-600 outline-none"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center space-x-2 p-2.5 rounded-xl border border-slate-300 bg-slate-50 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={unconscious}
                  onChange={(e) => setUnconscious(e.target.checked)}
                  className="w-4 h-4 text-red-600 rounded"
                />
                <span className="text-xs font-bold text-red-700">Patient Unconscious</span>
              </label>
            </div>
          </div>

          {/* Upload Photos Dropzone */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Upload Incident Photo (Optional):</label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-3 text-center hover:bg-slate-50 transition cursor-pointer relative">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {uploadedPhoto ? (
                <div className="flex items-center justify-center space-x-3">
                  <img src={uploadedPhoto} alt="Incident" className="w-12 h-12 object-cover rounded-lg border" />
                  <span className="text-xs font-bold text-emerald-700">Photo Attached (Visual AI Triage Ready)</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2 text-xs text-slate-500">
                  <Camera className="w-4 h-4 text-slate-400" />
                  <span>Click or drag photo of accident / symptoms</span>
                </div>
              )}
            </div>
          </div>

          {/* AI Real-time Classification Preview (Feature 6) */}
          {aiPreview && (
            <div className="p-3 bg-gradient-to-r from-slate-900 to-[#17324D] text-white rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-teal-300 font-bold uppercase text-[10px]">AI Emergency Classification:</span>
                <span className="bg-red-600 text-white font-bold text-[10px] px-2 py-0.2 rounded uppercase">
                  {aiPreview.severity} Priority
                </span>
              </div>
              <div className="text-[11px] text-slate-200">
                Equipment: <strong className="text-teal-200">{aiPreview.recommended_ambulance_type} Unit</strong> • Requires ICU: <strong className="text-red-300">{aiPreview.requires_icu ? 'YES' : 'Standard'}</strong>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed italic">
                "{aiPreview.reasoning}"
              </p>
            </div>
          )}

          {/* Submit SOS Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !description.trim()}
            className="w-full py-3 bg-[#DC3545] hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-md shadow-red-900/20 transition flex items-center justify-center space-x-2"
          >
            {submitting ? (
              <span>Connecting to Dispatch Mesh...</span>
            ) : (
              <>
                <HeartPulse className="w-4 h-4 animate-pulse" />
                <span>Submit Emergency & Dispatch Ambulance</span>
              </>
            )}
          </button>
        </div>

        {/* Right Column: Live Ambulance Tracking & Progress */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-[#17324D] uppercase tracking-wider flex items-center space-x-2">
                <Ambulance className="w-4 h-4 text-[#2563A6]" />
                <span>Live Ambulance Tracking & Response</span>
              </h2>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                Live Telemetry Active
              </span>
            </div>

            {/* 6-Stage Emergency Status Stepper (Feature 10) */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Mission Progress Stepper:
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 text-center">
                {STATUS_STEPS.map((step, idx) => {
                  const isDone = idx <= currentStepIdx;
                  const isCurrent = idx === currentStepIdx;

                  return (
                    <div
                      key={step.id}
                      className={`p-2 rounded-xl border text-[10px] font-bold transition ${
                        isCurrent
                          ? 'bg-[#17324D] text-white border-[#17324D] shadow-xs'
                          : isDone
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-center mb-0.5">
                        {isDone ? <Check className="w-3 h-3 text-emerald-600" /> : <Clock className="w-3 h-3 text-slate-400" />}
                      </div>
                      <span className="truncate block">{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {activeSOS ? (
              <div className="space-y-4 text-xs">
                {/* Active Emergency Card */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-slate-400 text-[10px]">CASE REF: {activeSOS.id?.toUpperCase()}</span>
                    <span className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded uppercase">
                      {activeSOS.severity}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-xs">{activeSOS.title}</h3>
                  <p className="text-slate-600 text-[11px] mt-0.5">{activeSOS.description}</p>
                </div>

                {/* Assigned Ambulance Card & ETA (Features 7 & 8) */}
                <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                        <Ambulance className="w-5 h-5" />
                      </div>
                      <div>
                        <strong className="text-sm font-bold text-blue-900 block">
                          {assignedAmb?.code || 'Dispatched ALS Unit'}
                        </strong>
                        <span className="text-[10px] text-blue-700 font-medium">
                          {assignedAmb?.type || 'ALS'} Life-Support • Speed: ~38 km/h
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Estimated Arrival</span>
                      <strong className="text-2xl font-black text-blue-950 font-mono">
                        {assignedAmb?.eta_minutes || 4.2} <span className="text-xs font-sans font-bold">min</span>
                      </strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-blue-200/60 flex items-center justify-between text-[11px] text-blue-800">
                    <span>On-board: {assignedAmb?.equipment?.slice(0, 2).join(', ') || 'Ventilator, Defibrillator'}</span>
                    <span className="font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">
                      Status: {assignedAmb?.status || 'Dispatched'}
                    </span>
                  </div>
                </div>

                {/* Selected Hospital Destination Card (Feature 9) */}
                <div className="p-4 bg-teal-50/70 rounded-xl border border-teal-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#0F9D91] text-white flex items-center justify-center font-bold">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <strong className="text-xs font-bold text-teal-950 block">
                          {assignedHosp?.name || 'Osmania General Hospital'}
                        </strong>
                        <span className="text-[10px] text-teal-700 font-medium">
                          Emergency Department & Cath Lab Pre-Alerted
                        </span>
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-[11px] text-teal-800 pt-1 border-t border-teal-200/50">
                    Confirmed capacity: <strong>{assignedHosp?.icu_available || 3} ICU beds available</strong> ready for immediate trauma reception.
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                Submit an emergency report on the left to track real-time response.
              </div>
            )}
          </div>

          {/* Emergency History (Feature 12) */}
          <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-3 text-xs">
            <h3 className="font-bold text-[#17324D] uppercase tracking-wider text-xs border-b pb-2 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <History className="w-4 h-4 text-slate-500" />
                <span>Recent Reported Incidents History</span>
              </span>
              <span className="text-[10px] text-slate-400">{incidents.length} Records</span>
            </h3>

            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
              {incidents.slice(0, 4).map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => setActiveSOS(inc)}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                    activeSOS?.id === inc.id ? 'border-blue-400 bg-blue-50/40' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div>
                    <strong className="text-slate-900 block text-xs truncate max-w-[200px]">{inc.title}</strong>
                    <span className="text-[10px] text-slate-400">{inc.zone_id} • {inc.created_at}</span>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                    inc.severity === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                  }`}>
                    {inc.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
