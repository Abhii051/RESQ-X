import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  BrainCircuit,
  MapPin,
  Users,
  CheckCircle2,
  Activity,
  Ambulance,
  Building2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { submitEmergencyReport, analyzeTextAI } from '../services/api';

const QUICK_TEMPLATES = [
  {
    title: "1. Road Accident (Madhapur)",
    category: "road_accident",
    desc: "Two cars collided on Hitec City road near Madhapur. Five people injured. One person unconscious with severe head trauma.",
    zone: "zone-madhapur",
    affected: 5,
    injured: 5,
    unconscious: true
  },
  {
    title: "2. Heart Attack (Ameerpet)",
    category: "cardiac_emergency",
    desc: "Elderly male having acute chest pain radiating to left arm and shortness of breath in Ameerpet transit hub.",
    zone: "zone-ameerpet",
    affected: 1,
    injured: 1,
    unconscious: false
  },
  {
    title: "3. Urban Flooding (Kukatpally)",
    category: "urban_flooding",
    desc: "Severe monsoon waterlogging at Y-Junction underpass in Kukatpally. Several commuters trapped in rising floodwaters.",
    zone: "zone-kukatpally",
    affected: 4,
    injured: 4,
    unconscious: false
  },
  {
    title: "4. Building Fire (Gachibowli)",
    category: "fire",
    desc: "Commercial building 4th floor structural fire in Gachibowli Tech Corridor with smoke inhalation and burn injuries.",
    zone: "zone-gachibowli",
    affected: 3,
    injured: 3,
    unconscious: false
  }
];

export default function ReportingView({ state, onRefresh, onSelectTab }) {
  const zones = state?.zones || [];

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("road_accident");
  const [zoneId, setZoneId] = useState("zone-koti");
  const [affectedCount, setAffectedCount] = useState(1);
  const [injuredCount, setInjuredCount] = useState(1);
  const [unconscious, setUnconscious] = useState(false);
  const [contactName, setContactName] = useState("Control Dispatcher");
  const [contactPhone, setContactPhone] = useState("+91 040-23456789");

  const [aiPreview, setAiPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);

  // Debounced live AI triage preview while user types
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
          affected_count: Number(affectedCount),
          injured_count: Number(injuredCount),
          unconscious
        });
        setAiPreview(preview);
      } catch (e) {
        console.error("Preview error", e);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [description, category, affectedCount, injuredCount, unconscious]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;

    try {
      setSubmitting(true);
      const res = await submitEmergencyReport({
        description,
        category,
        zone_id: zoneId,
        affected_count: Number(affectedCount),
        injured_count: Number(injuredCount),
        unconscious,
        contact_name: contactName,
        contact_phone: contactPhone
      });

      setSubmissionResult(res);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Submission failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  const applyTemplate = (tpl) => {
    setDescription(tpl.desc);
    setCategory(tpl.category);
    setZoneId(tpl.zone);
    setAffectedCount(tpl.affected);
    setInjuredCount(tpl.injured);
    setUnconscious(tpl.unconscious);
    setSubmissionResult(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs">
        <div className="flex items-center space-x-2 text-[#2563A6]">
          <AlertCircle className="w-5 h-5 text-[#DC3545]" />
          <span className="text-xs font-bold uppercase tracking-wider">Emergency Intake & Automated Triage</span>
        </div>
        <h1 className="text-2xl font-black text-[#17324D] mt-1">Submit Incident Report</h1>
        <p className="text-xs text-[#68778A]">
          Direct reporting terminal for 108/911 operators. Automated AI triage extracts severity, urgency, and equipment
          needs, instantly executing coordinated multi-criteria dispatch.
        </p>

        {/* Quick Demo Templates Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Quick Hackathon Scenarios:</span>
          {QUICK_TEMPLATES.map((t, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyTemplate(t)}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
            >
              {t.title}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Form Left, Real-time AI Triage Preview Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Column (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E3E9EF] p-6 shadow-2xs">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Description Field */}
            <div>
              <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1.5">
                Emergency Description (Natural Language Input)
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Two cars collided near Koti. Five people injured. One person unconscious."
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:border-[#2563A6] focus:ring-1 focus:ring-[#2563A6] outline-none text-[#243447]"
              />
            </div>

            {/* Category & Zone Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1.5">
                  Emergency Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-[#243447] outline-none"
                >
                  <option value="road_accident">Road Accident / Collision</option>
                  <option value="cardiac_emergency">Cardiac Emergency / Chest Pain</option>
                  <option value="medical_emergency">General Medical Emergency</option>
                  <option value="fire">Fire / Structural Inundation</option>
                  <option value="urban_flooding">Urban Flooding / Waterlogging</option>
                  <option value="natural_disaster">Natural Disaster / Collapse</option>
                  <option value="other">Other High Priority Incident</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1.5">
                  City Zone / Location
                </label>
                <select
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-[#243447] outline-none"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} (Risk: {z.risk_score})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Casualties & Triage Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1.5">
                  Affected People
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={affectedCount}
                  onChange={(e) => setAffectedCount(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1.5">
                  Injured Casualties
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={injuredCount}
                  onChange={(e) => setInjuredCount(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 outline-none font-semibold text-red-600"
                />
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex items-center space-x-2 p-2.5 border rounded-xl cursor-pointer select-none bg-slate-50 border-slate-300">
                  <input
                    type="checkbox"
                    checked={unconscious}
                    onChange={(e) => setUnconscious(e.target.checked)}
                    className="w-4 h-4 text-red-600 rounded focus:ring-0"
                  />
                  <span className="text-xs font-bold text-red-700">Unconscious Patient</span>
                </label>
              </div>
            </div>

            {/* Operator Contact Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1.5">
                  Operator / Caller Name
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#17324D] uppercase tracking-wider mb-1.5">
                  Contact Line
                </label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 outline-none font-mono"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={submitting || !description.trim()}
                className="w-full py-3 bg-[#DC3545] hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-md shadow-red-900/30 transition flex items-center justify-center space-x-2"
              >
                {submitting ? (
                  <span>Executing AI Triage & Dispatch...</span>
                ) : (
                  <>
                    <Activity className="w-4 h-4" />
                    <span>Deploy Emergency Response Mesh</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* AI Real-time Triage Preview Column (1 Col) */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-[#17324D] to-[#1e3c5a] text-white p-5 rounded-2xl shadow-xs border border-slate-700">
            <div className="flex items-center space-x-2 text-teal-300 mb-2">
              <BrainCircuit className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-wider">Live AI Triage Analysis</span>
            </div>

            {aiPreview ? (
              <div className="space-y-3 mt-3 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-700">
                  <span className="text-slate-300">Calculated Severity:</span>
                  <span className={`font-black px-2 py-0.5 rounded ${
                    aiPreview.severity === 'Critical' ? 'bg-[#DC3545] text-white' : 'bg-[#E87532] text-white'
                  }`}>
                    {aiPreview.severity}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-slate-700">
                  <span className="text-slate-300">Priority Score:</span>
                  <span className="font-mono font-black text-amber-300 text-sm">{aiPreview.priority_score} / 100</span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-slate-700">
                  <span className="text-slate-300">Recommended Vehicle:</span>
                  <span className="font-bold text-teal-200">{aiPreview.recommended_ambulance_type} Unit</span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-slate-700">
                  <span className="text-slate-300">ICU Bed Required:</span>
                  <span className={`font-bold ${aiPreview.requires_icu ? 'text-red-400' : 'text-emerald-400'}`}>
                    {aiPreview.requires_icu ? 'YES (Immediate)' : 'No (General Ward)'}
                  </span>
                </div>

                <div className="py-1.5">
                  <span className="text-slate-300 block mb-1">Equipment Needed:</span>
                  <div className="flex flex-wrap gap-1">
                    {aiPreview.required_equipment?.map((eq, i) => (
                      <span key={i} className="text-[10px] bg-slate-800 text-slate-200 px-2 py-0.5 rounded border border-slate-700">
                        {eq}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700/80">
                  <span className="text-[10px] text-teal-300 font-bold uppercase tracking-wider block mb-1">
                    Clinical Reasoning:
                  </span>
                  <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-800/60 p-2.5 rounded-lg border border-slate-700">
                    "{aiPreview.reasoning}"
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                Type an incident description to view live AI triage classification.
              </div>
            )}
          </div>

          {/* Submission Success Confirmation Card */}
          {submissionResult && (
            <div className="bg-emerald-50 border-2 border-emerald-500 p-5 rounded-2xl shadow-sm text-xs animate-in fade-in duration-300">
              <div className="flex items-center space-x-2 text-emerald-800 font-black text-sm mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Incident Dispatched Successfully</span>
              </div>
              <div className="space-y-1.5 text-slate-700">
                <div className="flex justify-between">
                  <span>Incident ID:</span>
                  <strong className="font-mono text-emerald-900">{submissionResult.incident_id}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Assigned Ambulance:</span>
                  <strong className="text-blue-700">{submissionResult.assigned_ambulance || "Pending Queue"}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Destination Hospital:</span>
                  <strong className="text-teal-700">{submissionResult.assigned_hospital || "Mutual Aid Required"}</strong>
                </div>
              </div>

              <button
                onClick={() => onSelectTab('dashboard')}
                className="mt-3 w-full py-2 bg-emerald-600 text-white rounded-lg font-bold flex items-center justify-center space-x-1"
              >
                <span>View on Command Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
