import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Building2,
  Ambulance,
  MapPin,
  Clock,
  PhoneCall,
  Check,
  ChevronLeft,
  Activity,
  HeartPulse,
  AlertTriangle,
  Radio,
  CheckCircle2
} from 'lucide-react';
import { playSuccessChime } from '../utils/soundEffects';

const HOSPITAL_INBOUND_STEPS = [
  { id: 'dispatched', label: '108 Dispatched', desc: 'Ambulance En Route' },
  { id: 'at_scene', label: 'On Scene', desc: 'Stabilizing Patient' },
  { id: 'transporting', label: 'Inbound to ER', desc: 'Siren Active' },
  { id: 'trauma_bay', label: 'Trauma Bay Prepped', desc: 'Cath Lab Ready' },
  { id: 'arrival', label: 'Arrival & Triage', desc: 'Immediate Handover' }
];

export default function HospitalTrackingModal({
  hospital,
  incident,
  ambulance,
  zones = [],
  onClose,
  onPrepareBed
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const ambMarkerRef = useRef(null);
  const hospMarkerRef = useRef(null);
  const citizenMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const animationFrameRef = useRef(null);

  const incidentZone = zones.find(z => z.id === incident?.zone_id);

  // Hospital coordinates
  const hospLat = hospital?.lat || 17.3730;
  const hospLng = hospital?.lng || 78.4746;

  // Ambulance starting position (heading toward hospital)
  const citizenLat = incident?.lat || incidentZone?.lat || 17.4482;
  const citizenLng = incident?.lng || incidentZone?.lng || 78.3915;

  const startLat = citizenLat;
  const startLng = citizenLng;
  const [ambPos, setAmbPos] = useState({ lat: startLat, lng: startLng });

  const [etaRemainingSeconds, setEtaRemainingSeconds] = useState(() => {
    const mins = ambulance?.eta_minutes || 5.8;
    return Math.round(mins * 60);
  });

  useEffect(() => {
    playSuccessChime();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setEtaRemainingSeconds(prev => (prev > 15 ? prev - 1 : prev));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Map initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const midLat = (startLat + hospLat) / 2;
    const midLng = (startLng + hospLng) / 2;

    const map = L.map(mapContainerRef.current, {
      center: [midLat, midLng],
      zoom: 12,
      zoomControl: true,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      subdomains: ['a', 'b', 'c']
    }).addTo(map);

    // 1. Hospital Marker (Destination)
    const hospIcon = L.divIcon({
      className: 'hospital-marker',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 46px; height: 46px;">
          <div style="position: absolute; width: 46px; height: 46px; border-radius: 50%; background: rgba(15, 157, 145, 0.4); animation: pulse 2s infinite;"></div>
          <div style="position: absolute; width: 36px; height: 36px; border-radius: 10px; background: #0F9D91; border: 3px solid #FFFFFF; box-shadow: 0 4px 14px rgba(15,157,145,0.6); display: flex; align-items: center; justify-content: center; color: white;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 18h12"></path>
              <path d="M6 14h12"></path>
              <path d="M6 10h12"></path>
              <path d="M6 6h12"></path>
            </svg>
          </div>
        </div>
      `,
      iconSize: [46, 46],
      iconAnchor: [23, 23]
    });

    hospMarkerRef.current = L.marker([hospLat, hospLng], { icon: hospIcon })
      .addTo(map)
      .bindPopup(`<b>${hospital?.name || 'Your Emergency Room'}</b><br/>Trauma Reception Ready`);

    // 2. Incident Site Marker
    const citizenIcon = L.divIcon({
      className: 'incident-site-marker',
      html: `
        <div style="width: 28px; height: 28px; border-radius: 50%; background: #EF4444; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    citizenMarkerRef.current = L.marker([citizenLat, citizenLng], { icon: citizenIcon })
      .addTo(map)
      .bindPopup(`<b>Incident Origin</b><br/>${incident?.title || 'Emergency Site'}`);

    // 3. Ambulance Marker (Inbound to Hospital)
    const ambIcon = L.divIcon({
      className: 'live-ambulance-marker',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 46px; height: 46px;">
          <div style="position: absolute; width: 46px; height: 46px; border-radius: 50%; background: rgba(37, 99, 166, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: #2563A6; border: 3px solid #FFFFFF; box-shadow: 0 4px 14px rgba(37,99,166,0.6); display: flex; align-items: center; justify-content: center; color: white;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10 17h4V5H2v12h3"></path>
              <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"></path>
              <circle cx="7.5" cy="17.5" r="2.5"></circle>
              <circle cx="17.5" cy="17.5" r="2.5"></circle>
            </svg>
          </div>
        </div>
      `,
      iconSize: [46, 46],
      iconAnchor: [23, 23]
    });

    ambMarkerRef.current = L.marker([startLat, startLng], { icon: ambIcon })
      .addTo(map)
      .bindPopup(`<b>Inbound: ${ambulance?.code || 'RESQ-A01'}</b><br/>Transferring Critical Patient`);

    // 4. Inbound Route Polyline
    routePolylineRef.current = L.polyline(
      [
        [startLat, startLng],
        [(startLat + hospLat) / 2 - 0.003, (startLng + hospLng) / 2 + 0.004],
        [hospLat, hospLng]
      ],
      {
        color: '#0F9D91',
        weight: 5,
        opacity: 0.85,
        dashArray: '10, 10',
        lineCap: 'round'
      }
    ).addTo(map);

    const group = L.featureGroup([
      hospMarkerRef.current,
      citizenMarkerRef.current,
      ambMarkerRef.current
    ]);
    map.fitBounds(group.getBounds().pad(0.25));

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Smooth movement animation toward the hospital
  useEffect(() => {
    let progress = 0;
    const p1 = { lat: startLat, lng: startLng };
    const p2 = { lat: (startLat + hospLat) / 2 - 0.003, lng: (startLng + hospLng) / 2 + 0.004 };
    const p3 = { lat: hospLat, lng: hospLng };

    const getBezierPoint = (t) => {
      const lat = (1 - t) * (1 - t) * p1.lat + 2 * (1 - t) * t * p2.lat + t * t * p3.lat;
      const lng = (1 - t) * (1 - t) * p1.lng + 2 * (1 - t) * t * p2.lng + t * t * p3.lng;
      return { lat, lng };
    };

    let lastTimestamp = performance.now();

    const animate = (timestamp) => {
      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      progress = Math.min(0.90, progress + (delta * 0.012));
      const nextPos = getBezierPoint(progress);
      setAmbPos(nextPos);

      if (ambMarkerRef.current) {
        ambMarkerRef.current.setLatLng([nextPos.lat, nextPos.lng]);
      }

      if (routePolylineRef.current) {
        routePolylineRef.current.setLatLngs([
          [nextPos.lat, nextPos.lng],
          [(nextPos.lat + hospLat) / 2 - 0.0015, (nextPos.lng + hospLng) / 2 + 0.002],
          [hospLat, hospLng]
        ]);
      }

      if (progress < 0.90) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [hospLat, hospLng]);

  const etaDisplayMinutes = Math.floor(etaRemainingSeconds / 60);
  const etaDisplaySeconds = etaRemainingSeconds % 60;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex flex-col justify-between overflow-y-auto p-3 md:p-6 animate-in fade-in duration-200">
      <div className="max-w-6xl w-full mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col flex-1">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0F9D91] via-[#17324D] to-[#2563A6] text-white p-4 md:p-6 flex flex-wrap items-center justify-between gap-4 border-b border-teal-900/50">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center space-x-1 text-xs font-bold"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                <h2 className="text-base md:text-xl font-black tracking-tight">
                  Hospital ER Inbound Telemetry: Ambulance Tracking
                </h2>
                <span className="bg-teal-500 text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                  INCOMING PATIENT
                </span>
              </div>
              <p className="text-xs text-teal-100 mt-0.5">
                Receiving Hospital: <strong className="text-white">{hospital?.name || 'Emergency Room'}</strong> • 
                Inbound Unit: <strong className="text-white">{ambulance?.code || 'RESQ-A01'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-2 text-right">
              <span className="text-[10px] uppercase font-bold text-teal-200 block">Inbound ETA to ER</span>
              <div className="text-2xl font-black font-mono tracking-tight text-white flex items-baseline justify-end space-x-1">
                <span>{etaDisplayMinutes}:{etaDisplaySeconds < 10 ? `0${etaDisplaySeconds}` : etaDisplaySeconds}</span>
                <span className="text-xs font-sans text-teal-300 font-bold">MIN</span>
              </div>
            </div>

            <button
              onClick={() => alert(`Direct Patch to Paramedic In-Cabin Radio (${ambulance?.code || '108 Paramedic'})...`)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-extrabold rounded-2xl shadow-lg transition flex items-center space-x-2"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span>Radio In-Cabin</span>
            </button>
          </div>
        </div>

        {/* Milestone Steps */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 md:px-8">
          <div className="grid grid-cols-5 gap-2">
            {HOSPITAL_INBOUND_STEPS.map((step, idx) => {
              const isDone = idx <= 2;
              const isCurrent = idx === 2; // Inbound

              return (
                <div key={step.id} className="flex flex-col items-center text-center space-y-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      isCurrent
                        ? 'bg-teal-600 text-white ring-4 ring-teal-200 shadow-md scale-110'
                        : isDone
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {isDone && !isCurrent ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`text-[11px] font-extrabold leading-tight ${
                    isCurrent ? 'text-teal-800' : isDone ? 'text-slate-800' : 'text-slate-400'
                  }`}>
                    {step.label}
                  </span>
                  <span className="text-[9px] text-slate-500 hidden sm:block leading-none">
                    {step.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Body: Map + Trauma Bay Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-[460px]">
          
          {/* Map (7 cols) */}
          <div className="lg:col-span-7 relative min-h-[360px] lg:min-h-full border-b lg:border-b-0 lg:border-r border-slate-200">
            <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

            <div className="absolute bottom-4 left-4 z-40 bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-slate-200 text-xs space-y-1.5 pointer-events-auto max-w-xs">
              <span className="font-extrabold text-[#17324D] text-[11px] uppercase tracking-wider block">Live Inbound Telemetry</span>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-blue-600 ring-2 ring-blue-200 animate-ping"></span>
                  <span className="font-bold text-slate-700">Ambulance {ambulance?.code} (En Route to Hospital)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-[#0F9D91]"></span>
                  <span className="font-bold text-slate-700">{hospital?.name || 'Hospital ER Admission Desk'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Info Cards (5 cols) */}
          <div className="lg:col-span-5 p-5 md:p-6 space-y-4 overflow-y-auto bg-slate-50/50 flex flex-col justify-between">
            <div className="space-y-4">
              
              {/* Advance Patient Clinical Telemetry */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-extrabold text-[#17324D] uppercase tracking-wider flex items-center space-x-1.5">
                    <HeartPulse className="w-4 h-4 text-red-600" />
                    <span>Advance Patient Vitals</span>
                  </span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    incident?.severity === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {incident?.severity || 'Critical'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="font-bold text-slate-900 text-[13px]">{incident?.title || 'Incoming Trauma Case'}</p>
                  <p className="text-[11.5px] leading-relaxed text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    "{incident?.description || 'Critical trauma patient in transit with active vitals monitoring.'}"
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-red-50 p-2 rounded-xl border border-red-100">
                      <span className="text-red-500 block text-[9.5px] uppercase font-bold">ICU Bed Needed</span>
                      <strong className="text-red-800 font-bold">{incident?.requires_icu ? 'YES - Reserve Bay' : 'General Bed'}</strong>
                    </div>
                    <div className="bg-teal-50 p-2 rounded-xl border border-teal-100">
                      <span className="text-teal-600 block text-[9.5px] uppercase font-bold">Current ICU Available</span>
                      <strong className="text-teal-900 font-bold">{hospital?.icu_available || 3} / {hospital?.icu_total || 20}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Inbound Ambulance Details */}
              <div className="bg-blue-50/80 border border-blue-200 p-4 rounded-2xl shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold">
                      <Ambulance className="w-4 h-4" />
                    </div>
                    <div>
                      <strong className="text-xs font-black text-blue-950 block">
                        Ambulance {ambulance?.code || 'RESQ-A01'} ({ambulance?.type || 'ALS'})
                      </strong>
                      <span className="text-[10px] text-blue-700 font-medium">
                        Driver: {ambulance?.driver_name || 'Paramedic Staff'} • ALS Certified
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                    Siren Active
                  </span>
                </div>

                <p className="text-[11px] text-blue-800">
                  On-board equipment: <strong>{ambulance?.equipment?.slice(0, 3).join(', ') || 'Ventilator, Defibrillator, Trauma Suite'}</strong>.
                </p>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  if (onPrepareBed) onPrepareBed();
                  alert('Trauma Bay & Cath Lab Team Flagged as READY for Patient Handover');
                }}
                className="flex-1 py-3 bg-[#0F9D91] hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Trauma Bay Prepped</span>
              </button>
              <button
                onClick={onClose}
                className="py-3 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
