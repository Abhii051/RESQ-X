import React, { useState, useEffect, useRef } from 'react';
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
  Check,
  User,
  LogOut,
  Users,
  Radio
} from 'lucide-react';
import { submitEmergencyReport, analyzeTextAI, fetchCitizenIncidents } from '../services/api';
import { useAuth } from '../context/AuthContext';
import RoleAuthGate from '../components/RoleAuthGate';
import { playAlertSound, playSuccessChime, playBlip } from '../utils/soundEffects';
import CitizenTrackingModal from '../components/CitizenTrackingModal';


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
  const { user, isAuthenticated, logout } = useAuth();
  const isCitizen = isAuthenticated && user?.role === 'citizen';

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
  const [showLiveTracking, setShowLiveTracking] = useState(false);
  const [uploadedPhoto, setUploadedPhoto] = useState(null);
  const [aiPreview, setAiPreview] = useState(null);
  const [locationShared, setLocationShared] = useState(false);
  const [citizenDbHistory, setCitizenDbHistory] = useState([]);
  const waveformCanvasRef = useRef(null);

  // Animated Oscilloscope Waveform Visualizer
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let phase = 0;
    let animId;

    const drawWave = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0F9D91';
      ctx.beginPath();

      const width = canvas.width;
      const height = canvas.height;

      for (let x = 0; x < width; x++) {
        const envelope = Math.sin((x / width) * Math.PI);
        const y = (height / 2) +
          (Math.sin((x * 0.05) + phase) * 8 + Math.sin((x * 0.12) - phase * 0.6) * 4) * envelope;

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      phase += 0.12;
      animId = requestAnimationFrame(drawWave);
    };

    drawWave();
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  // Fetch SQLite history for this citizen
  const loadHistory = async () => {
    if (user?.id) {
      try {
        const hist = await fetchCitizenIncidents(user.id);
        setCitizenDbHistory(hist);
      } catch (e) {
        console.error("Failed to load DB history", e);
      }
    }
  };

  useEffect(() => {
    if (isCitizen) {
      loadHistory();
    }
  }, [user, isCitizen, incidents]);

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

  // If not authenticated as citizen, render the dedicated Citizen Authentication Gate
  if (!isCitizen) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <RoleAuthGate
          targetRole="citizen"
          title="Citizen Emergency Portal Access"
          subtitle="Sign in or register your citizen medical profile to report emergencies, broadcast one-touch SOS alerts, and track dispatched 108 ambulances in real time."
          icon={Users}
        />
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!description.trim()) return;

    try {
      setSubmitting(true);
      playAlertSound();
      const res = await submitEmergencyReport({
        description,
        category,
        zone_id: zoneId,
        affected_count: Number(injuredCount),
        injured_count: Number(injuredCount),
        unconscious,
        citizen_id: user?.id,
        citizen_name: user?.name,
        image_data: uploadedPhoto
      });

      setActiveSOS(res.incident);
      setShowLiveTracking(true);
      setDescription("");
      loadHistory();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("SOS submission failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickSOS = async (item) => {
    setDescription(item.desc);
    setCategory(item.category);
    setZoneId(item.zone);
    setInjuredCount(item.injured);
    setUnconscious(item.unconscious);

    try {
      setSubmitting(true);
      playAlertSound();
      const res = await submitEmergencyReport({
        description: item.desc,
        category: item.category,
        zone_id: item.zone,
        affected_count: Number(item.injured),
        injured_count: Number(item.injured),
        unconscious: item.unconscious,
        citizen_id: user?.id,
        citizen_name: user?.name,
        image_data: uploadedPhoto
      });
      setActiveSOS(res.incident);
      setShowLiveTracking(true);
      loadHistory();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Quick SOS failed", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleShareGPS = () => {
    setLocationShared(true);
    setZoneId("zone-madhapur");
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setUploadedPhoto(event.target?.result);
      reader.readAsDataURL(file);
    }
  };

  // Find assigned ambulance and hospital for active SOS
  const assignedAmb = ambulances.find(a => a.id === activeSOS?.assigned_ambulance_id);
  const assignedHosp = hospitals.find(h => h.id === activeSOS?.assigned_hospital_id);

  // Calculate current stage for the 6-stage stepper
  const getStageIndex = (status) => {
    switch (status) {
      case 'Pending': return 0;
      case 'Verified': return 1;
      case 'Dispatched': return 2;
      case 'In Progress': return 3;
      case 'On Scene': return 4;
      case 'Resolved': return 5;
      default: return 2;
    }
  };
  const currentStage = activeSOS ? getStageIndex(activeSOS.status) : 0;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Verified Citizen Profile Banner */}
      <div className="bg-gradient-to-r from-teal-900 to-[#17324D] text-white p-4 md:p-5 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-md border border-teal-700/50">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center font-bold text-teal-300 shadow-inner">
            <User className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-base tracking-tight">{user.name}</span>
              <span className="text-[10px] bg-teal-500/30 text-teal-200 border border-teal-400/40 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Verified Citizen Profile
              </span>
            </div>
            <div className="text-[11px] text-teal-100/80 flex flex-wrap gap-x-3.5 gap-y-1 mt-1 font-medium">
              {user.metadata?.blood_group && (
                <span className="flex items-center space-x-1">
                  <span>Blood:</span>
                  <strong className="text-white bg-red-900/60 px-1.5 py-0.2 rounded font-bold">{user.metadata.blood_group}</strong>
                </span>
              )}
              {user.metadata?.allergies && (
                <span>Allergies: <strong className="text-white">{user.metadata.allergies}</strong></span>
              )}
              {user.phone && (
                <span>Phone: <strong className="text-white font-mono">{user.phone}</strong></span>
              )}
              {user.metadata?.emergency_contact_phone && (
                <span>SOS Contact: <strong className="text-white">{user.metadata.emergency_contact_phone}</strong></span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 self-start md:self-center border border-white/15"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out / Switch</span>
        </button>
      </div>

      {/* Hero SOS Banner (Feature 1) */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider">
            <HeartPulse className="w-4 h-4 text-white animate-pulse" />
            <span>Hyderabad Municipal Citizen 108 Emergency Grid</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            Need Immediate Emergency Assistance?
          </h1>
          <p className="text-xs md:text-sm text-white/90 max-w-xl leading-relaxed">
            Instant AI triage automatically scores severity, selects the closest specialized ambulance, and pre-books critical ICU hospital beds in seconds.
          </p>
        </div>

        <div className="z-10 shrink-0">
          <button
            onClick={() => handleQuickSOS(QUICK_EMERGENCIES[0])}
            disabled={submitting}
            className="w-36 h-36 rounded-full bg-white text-red-600 font-black text-xl shadow-2xl hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center border-4 border-red-200 animate-bounce"
          >
            <PhoneCall className="w-8 h-8 text-red-600 mb-1" />
            <span>{submitting ? 'ALERTING' : 'SOS 108'}</span>
            <span className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">One-Touch</span>
          </button>
        </div>

        {/* Background glow decoration */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Main Grid: Left = Intake & Presets, Right = Live Telemetry & Stepper */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols): Intake Form & Presets */}
        <div className="lg:col-span-5 space-y-5">
          {/* Preset Buttons for Problem Statement Scenarios */}
          <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#17324D] uppercase tracking-wider">
                Instant Presets (Problem Statement 10)
              </span>
              <span className="text-[10px] text-slate-400">1-Click Dispatch</span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {QUICK_EMERGENCIES.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickSOS(item)}
                  disabled={submitting}
                  className="p-3 text-left rounded-xl border border-slate-200 hover:border-red-400 bg-slate-50/70 hover:bg-red-50/40 transition group flex items-start justify-between"
                >
                  <div className="space-y-0.5 pr-2">
                    <strong className="text-xs font-bold text-[#17324D] group-hover:text-red-700 block">
                      {item.title}
                    </strong>
                    <p className="text-[11px] text-slate-500 line-clamp-1">{item.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-red-600 shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          </div>

          {/* Detailed Reporting Form (Features 2, 3, 4, 5) */}
          <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-4">
            <h3 className="font-bold text-[#17324D] uppercase tracking-wider text-xs border-b pb-2 flex items-center justify-between">
              <span>Report an Emergency Incident</span>
              <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-bold">
                AI Powered Intake
              </span>
            </h3>

            {/* Radio Frequency & Live Oscilloscope Audio Intake Bar */}
            <div className="bg-slate-900 text-teal-300 p-3 rounded-xl border border-slate-800 space-y-2 shadow-inner">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="flex items-center space-x-1.5 text-slate-300">
                  <Radio className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
                  <span>EMERGENCY FREQ: <strong className="text-teal-300">154.280 MHz</strong></span>
                </span>
                <span className="flex items-center space-x-1.5 bg-red-950/80 text-red-400 border border-red-800/60 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  <span>LIVE AUDIO INTAKE</span>
                </span>
              </div>
              <canvas
                ref={waveformCanvasRef}
                width={430}
                height={36}
                className="w-full h-9 rounded-lg bg-slate-950/80 border border-slate-800/80 shadow-xs"
              />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0F9D91]"
                >
                  <option value="road_accident">Road Accident (Vehicular / Trauma)</option>
                  <option value="cardiac_emergency">Cardiac Emergency (Heart Attack / Stroke)</option>
                  <option value="urban_flooding">Urban Flooding (Waterlogging / Trapped)</option>
                  <option value="fire">Fire / Structural Smoke Incident</option>
                  <option value="respiratory_distress">Severe Respiratory Failure</option>
                  <option value="neurological_stroke">Acute Neurological Trauma / Seizure</option>
                </select>
              </div>

              {/* Zone / Location */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Incident Location / Zone</label>
                  <button
                    type="button"
                    onClick={handleShareGPS}
                    className="text-[11px] text-[#0F9D91] hover:underline font-bold flex items-center space-x-1"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>{locationShared ? 'GPS Shared (Madhapur)' : 'Share GPS Location'}</span>
                  </button>
                </div>
                <select
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0F9D91]"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} (Risk: {z.risk_score} • Demand: {z.predicted_demand || 'Normal'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Incident Description & Symptoms
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the condition, patient symptoms, hazards, and exact landmark..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#0F9D91]"
                />
              </div>

              {/* Patients & Unconscious Toggle */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Injured Persons</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={injuredCount}
                    onChange={(e) => setInjuredCount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Consciousness</label>
                  <button
                    type="button"
                    onClick={() => setUnconscious(!unconscious)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 border ${
                      unconscious
                        ? 'bg-red-500 text-white border-red-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{unconscious ? '⚠️ Unconscious' : 'Conscious'}</span>
                  </button>
                </div>
              </div>

              {/* Photo Upload (Feature 5) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Attach Scene Photo (Visual Verification)
                </label>
                <div className="relative border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-xl p-3 text-center bg-slate-50/50">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {uploadedPhoto ? (
                    <div className="flex items-center justify-center space-x-2 text-emerald-700 text-xs font-bold">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Photo Attached for AI Verification</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-2 text-slate-500 text-xs">
                      <Camera className="w-4 h-4 text-slate-400" />
                      <span>Drop photo or click to take photo</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Live AI Classification Preview (Feature 6) */}
              {aiPreview && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[#17324D] flex items-center space-x-1">
                      <Activity className="w-3.5 h-3.5 text-blue-600" />
                      <span>Real-time Clinical Triage Preview</span>
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      aiPreview.severity === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {aiPreview.severity} ({aiPreview.priority_score}/100)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{aiPreview.reasoning}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !description.trim()}
                className="w-full py-3 bg-[#17324D] hover:bg-[#204569] text-white font-extrabold text-xs rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <span>{submitting ? 'Classifying & Dispatching...' : 'Submit Emergency Report'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (7 Cols): Live Tracking, Stepper & Emergency Details */}
        <div className="lg:col-span-7 space-y-5">
          {/* Live Incident Status Stepper (Feature 10) */}
          <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Live Status</span>
                <h3 className="font-extrabold text-[#17324D] text-sm">
                  {activeSOS ? activeSOS.title : 'No Active Incident'}
                </h3>
              </div>

              {activeSOS && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowLiveTracking(true)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-xs"
                  >
                    <Ambulance className="w-3.5 h-3.5" />
                    <span>Open Live Map</span>
                  </button>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
                    activeSOS.severity === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {activeSOS.severity} Severity
                  </span>
                </div>
              )}
            </div>

            {/* 6-Stage Stepper Bar */}
            <div className="relative pt-2 pb-4">
              <div className="grid grid-cols-6 gap-1 text-center">
                {STATUS_STEPS.map((step, idx) => {
                  const isDone = idx <= currentStage;
                  const isCurrent = idx === currentStage;

                  return (
                    <div key={step.id} className="space-y-1.5 flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isCurrent
                            ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-md scale-110'
                            : isDone
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isDone && !isCurrent ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <span className={`text-[10px] font-bold block leading-tight ${
                        isCurrent ? 'text-blue-700' : isDone ? 'text-slate-700' : 'text-slate-400'
                      }`}>
                        {step.label.replace(/^\d+\.\s*/, '')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Tracking Information Card */}
            {activeSOS ? (
              <div className="space-y-4 pt-2">
                {/* Clinical Vitals & Reasoning */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="font-bold">Incident Classification & Clinical Triage:</span>
                    <span className="font-mono text-[10px] text-slate-500">ID: {activeSOS.id}</span>
                  </div>
                  <p className="text-[11.5px] text-slate-600 leading-relaxed">
                    {activeSOS.ai_reasoning || "Incident triaged by RESQ-X Clinical NLP engine."}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1 text-[10.5px]">
                    <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded font-bold">
                      Priority Score: {activeSOS.priority_score}/100
                    </span>
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">
                      ICU Required: {activeSOS.requires_icu ? 'YES' : 'NO'}
                    </span>
                    <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-bold">
                      Recommended: {activeSOS.recommended_ambulance_type || 'ALS'} Unit
                    </span>
                  </div>
                </div>

                {/* Assigned Ambulance Card & ETA (Features 7 & 8) */}
                <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
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
                      <div className="w-8 h-8 rounded-xl bg-[#0F9D91] text-white flex items-center justify-center font-bold shadow-xs">
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

          {/* Emergency History from SQLite Database (Feature 12) */}
          <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-3 text-xs">
            <h3 className="font-bold text-[#17324D] uppercase tracking-wider text-xs border-b pb-2 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <History className="w-4 h-4 text-slate-500" />
                <span>Your SQLite Emergency Records History</span>
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold font-mono">
                {citizenDbHistory.length || incidents.length} Saved in DB
              </span>
            </h3>

            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
              {(citizenDbHistory.length > 0 ? citizenDbHistory : incidents).slice(0, 5).map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => {
                    setActiveSOS(inc);
                    setShowLiveTracking(true);
                  }}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                    activeSOS?.id === inc.id ? 'border-teal-400 bg-teal-50/40 shadow-xs' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <strong className="text-slate-900 block text-xs truncate max-w-[240px]">{inc.title}</strong>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Zone: {inc.zone_id} • Reported: {inc.created_at || inc.reported_at?.substring(11, 16) || 'Just now'}
                    </span>
                  </div>
                  <div className="text-right space-y-0.5">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase block ${
                      inc.severity === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {inc.severity}
                    </span>
                    <span className="text-[9px] text-slate-400 block font-mono">{inc.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full-Screen Live Ambulance Tracking Modal */}
      {showLiveTracking && activeSOS && (
        <CitizenTrackingModal
          incident={activeSOS}
          ambulances={ambulances}
          hospitals={hospitals}
          zones={zones}
          onClose={() => setShowLiveTracking(false)}
        />
      )}
    </div>
  );
}
