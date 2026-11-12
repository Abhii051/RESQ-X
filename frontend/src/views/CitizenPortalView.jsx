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
  HeartPulse
} from 'lucide-react';
import { submitEmergencyReport, analyzeTextAI } from '../services/api';

const QUICK_EMERGENCIES = [
  {
    title: "1. Road Accident (Madhapur)",
    desc: "Two cars collided on Hitec City road. Five people injured. One person unconscious with head trauma.",
    category: "road_accident",
    zone: "zone-madhapur",
    injured: 5,
    unconscious: true
  },
  {
    title: "2. Heart Attack (Ameerpet)",
    desc: "Person having acute cardiac arrest, crushing chest pain radiating to left arm. Needs immediate ICU Cath Lab.",
    category: "cardiac_emergency",
    zone: "zone-ameerpet",
    injured: 1,
    unconscious: false
  },
  {
    title: "3. Urban Flooding (Kukatpally)",
    desc: "Severe monsoon waterlogging at Y-Junction underpass. Several commuters trapped in rising floodwaters.",
    category: "trapped",
    zone: "zone-kukatpally",
    injured: 4,
    unconscious: false
  },
  {
    title: "4. Building Fire (Gachibowli)",
    desc: "Commercial building 4th floor structural fire with heavy smoke inhalation and burn injuries.",
    category: "fire",
    zone: "zone-gachibowli",
    injured: 3,
    unconscious: false
  }
];

export default function CitizenPortalView({ state, onRefresh }) {
  const zones = state?.zones || [];
  const incidents = state?.incidents || [];
  const ambulances = state?.ambulances || [];
  const hospitals = state?.hospitals || [];

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("road_accident");
  const [zoneId, setZoneId] = useState("zone-koti");
  const [injuredCount, setInjuredCount] = useState(1);
  const [unconscious, setUnconscious] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeSOS, setActiveSOS] = useState(null);

  // Default to showing the latest incident as active SOS tracking if exists
  useEffect(() => {
    if (!activeSOS && incidents.length > 0) {
      setActiveSOS(incidents[0]);
    }
  }, [incidents]);

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

  // Find assigned assets for active SOS
  const assignedAmb = ambulances.find(a => a.id === activeSOS?.assigned_ambulance_id);
  const assignedHosp = hospitals.find(h => h.id === activeSOS?.assigned_hospital_id);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 text-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full w-fit">
            <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
            <span>Citizen Emergency SOS Portal • Dial 108</span>
          </div>
          <h1 className="text-2xl font-black mt-2">Instant Emergency Assistance</h1>
          <p className="text-xs text-rose-100 max-w-xl mt-1">
            Need urgent medical help in Hyderabad? Submit a report below or tap a quick emergency button.
            Our AI network automatically locates the nearest equipped ALS ambulance and pre-books receiving hospital beds.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 text-center shrink-0">
          <PhoneCall className="w-6 h-6 text-white mx-auto mb-1 animate-bounce" />
          <div className="text-lg font-black font-mono">108 / 112</div>
          <span className="text-[10px] text-rose-200">24/7 Toll-Free Tollway Line</span>
        </div>
      </div>

      {/* Main Grid: SOS Form Left, Live Ambulance Tracker Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Simple Report SOS Card */}
        <div className="bg-white p-6 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-[#17324D] uppercase tracking-wider flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span>Report an Emergency Now</span>
            </h2>
            <span className="text-xs text-slate-400">Step 1 of 1</span>
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Quick Emergency Presets:</label>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_EMERGENCIES.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleQuickPanic(q)}
                  className="p-2 rounded-xl border border-slate-200 hover:border-red-400 hover:bg-red-50/40 text-left transition text-xs"
                >
                  <strong className="block text-[#17324D] font-bold truncate">{q.title}</strong>
                  <span className="text-[10px] text-slate-500">{q.injured} injured</span>
                </button>
              ))}
            </div>
          </div>

          {/* Emergency Description */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              What is happening? Describe symptoms or scene:
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Person collapsed with chest pain, or two-car collision with injured passengers..."
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:border-red-500 focus:ring-1 focus:ring-red-400 outline-none text-[#243447]"
            />
          </div>

          {/* Location & Casualties Row */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-600 font-semibold block mb-1">Sector / Landmark:</label>
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

            <div>
              <label className="text-slate-600 font-semibold block mb-1">Number of Casualties:</label>
              <input
                type="number"
                min={1}
                value={injuredCount}
                onChange={(e) => setInjuredCount(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 font-bold text-red-600 outline-none"
              />
            </div>
          </div>

          {/* Unconscious Toggle */}
          <label className="flex items-center space-x-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={unconscious}
              onChange={(e) => setUnconscious(e.target.checked)}
              className="w-4 h-4 text-red-600 rounded"
            />
            <span className="text-xs font-bold text-red-700">Patient is Unconscious or Not Breathing</span>
          </label>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !description.trim()}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-md shadow-red-900/20 transition flex items-center justify-center space-x-2"
          >
            {submitting ? (
              <span>Dispatching Response Mesh...</span>
            ) : (
              <>
                <HeartPulse className="w-4 h-4 animate-pulse" />
                <span>Request Immediate Emergency Ambulance</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Live Ambulance Tracker (Citizen View) */}
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-[#17324D] uppercase tracking-wider flex items-center space-x-2">
                <Ambulance className="w-4 h-4 text-[#2563A6]" />
                <span>Live Ambulance Dispatch Status</span>
              </h2>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                Active Tracking
              </span>
            </div>

            {activeSOS ? (
              <div className="space-y-4 text-xs">
                {/* Active Incident Title & Severity */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-slate-400">ID: {activeSOS.id?.toUpperCase()}</span>
                    <span className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded uppercase">
                      {activeSOS.severity}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900">{activeSOS.title}</h3>
                  <p className="text-slate-500 text-[11px] mt-0.5">{activeSOS.description}</p>
                </div>

                {/* Assigned Ambulance Card */}
                <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Ambulance className="w-5 h-5 text-blue-700" />
                      <div>
                        <strong className="text-sm font-bold text-blue-900">
                          {assignedAmb?.code || 'Dispatched Life-Support'}
                        </strong>
                        <span className="text-[10px] text-blue-700 block font-medium">
                          {assignedAmb?.type || 'ALS'} (Advanced Life Support)
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Estimated Arrival</span>
                      <strong className="text-lg font-black text-blue-900 font-mono">
                        {assignedAmb?.eta_minutes || 4.2} min
                      </strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-blue-200/60 flex items-center justify-between text-[11px] text-blue-800">
                    <span>On-board: {assignedAmb?.equipment?.slice(0, 2).join(', ') || 'Ventilator, Defibrillator'}</span>
                    <span className="font-bold text-emerald-700">En Route</span>
                  </div>
                </div>

                {/* Destination Hospital Card */}
                <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-5 h-5 text-teal-700" />
                      <div>
                        <strong className="text-xs font-bold text-teal-900">
                          {assignedHosp?.name || 'Pre-Booked Regional Hospital'}
                        </strong>
                        <span className="text-[10px] text-teal-700 block font-medium">
                          Emergency Department Reserved
                        </span>
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-[11px] text-teal-800 pt-1">
                    ICU bed confirmed: {assignedHosp?.icu_available || 3} beds ready for immediate resuscitation.
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                Submit an emergency report on the left to track real-time response.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
