import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Ambulance,
  MapPin,
  Clock,
  Navigation,
  PhoneCall,
  Check,
  ChevronLeft,
  Building2,
  Activity,
  AlertTriangle,
  User,
  Radio,
  ShieldCheck
} from 'lucide-react';
import { playSuccessChime } from '../utils/soundEffects';

const AMBULANCE_STEPS = [
  { id: 'dispatched', label: 'Dispatched', desc: 'Alert Received' },
  { id: 'en_route', label: 'En Route', desc: 'Navigating to Citizen' },
  { id: 'at_scene', label: 'At Scene', desc: 'Patient Contact' },
  { id: 'stabilizing', label: 'Stabilizing', desc: 'On-site Care' },
  { id: 'transporting', label: 'Transporting', desc: 'Heading to ER' },
  { id: 'handover', label: 'Handover', desc: 'Hospital Transfer' }
];

export default function AmbulanceTrackingModal({
  ambulance,
  incident,
  hospital,
  zones = [],
  onClose,
  onUpdateStatus
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const ambMarkerRef = useRef(null);
  const citizenMarkerRef = useRef(null);
  const hospMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);
  const animationFrameRef = useRef(null);

  const incidentZone = zones.find(z => z.id === incident?.zone_id);

  // Citizen coordinates
  const citizenLat = incident?.lat || incidentZone?.lat || 17.4482;
  const citizenLng = incident?.lng || incidentZone?.lng || 78.3915;

  // Hospital coordinates
  const hospLat = hospital?.lat || 17.3730;
  const hospLng = hospital?.lng || 78.4746;

  // Initial ambulance location
  const startLat = ambulance?.lat || citizenLat - 0.022;
  const startLng = ambulance?.lng || citizenLng + 0.025;
  const [ambPos, setAmbPos] = useState({ lat: startLat, lng: startLng });

  const [etaRemainingSeconds, setEtaRemainingSeconds] = useState(() => {
    const mins = ambulance?.eta_minutes || 4.2;
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

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const midLat = (startLat + citizenLat) / 2;
    const midLng = (startLng + citizenLng) / 2;

    const map = L.map(mapContainerRef.current, {
      center: [midLat, midLng],
      zoom: 13,
      zoomControl: true,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      subdomains: ['a', 'b', 'c']
    }).addTo(map);

    // 1. Citizen Marker (Destination)
    const citizenIcon = L.divIcon({
      className: 'citizen-sos-marker',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
          <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: rgba(239, 68, 68, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: #EF4444; border: 3px solid #FFFFFF; box-shadow: 0 4px 14px rgba(239,68,68,0.5); display: flex; align-items: center; justify-content: center; color: white;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    citizenMarkerRef.current = L.marker([citizenLat, citizenLng], { icon: citizenIcon })
      .addTo(map)
      .bindPopup(`<b>Citizen Patient: ${incident?.citizen_name || 'Caller'}</b><br/>${incident?.title || 'Emergency'}`);

    // 2. Hospital Marker
    if (hospital) {
      const hospIcon = L.divIcon({
        className: 'hospital-marker',
        html: `
          <div style="width: 36px; height: 36px; border-radius: 10px; background: #0F9D91; border: 2.5px solid #FFFFFF; box-shadow: 0 4px 10px rgba(15,157,145,0.4); display: flex; align-items: center; justify-content: center; color: white;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 18h12"></path>
              <path d="M6 14h12"></path>
              <path d="M6 10h12"></path>
              <path d="M6 6h12"></path>
            </svg>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      hospMarkerRef.current = L.marker([hospLat, hospLng], { icon: hospIcon })
        .addTo(map)
        .bindPopup(`<b>Destination Hospital</b><br/>${hospital.name}`);
    }

    // 3. Ambulance Marker (Moving Unit)
    const ambIcon = L.divIcon({
      className: 'live-ambulance-marker',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 46px; height: 46px;">
          <div style="position: absolute; width: 46px; height: 46px; border-radius: 50%; background: rgba(37, 99, 166, 0.35); animation: pulse 2s infinite;"></div>
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
      .bindPopup(`<b>Your Unit: ${ambulance?.code || 'RESQ-A01'}</b><br/>Speed: 42 km/h`);

    // 4. Route Polyline from Ambulance to Citizen
    routePolylineRef.current = L.polyline(
      [
        [startLat, startLng],
        [(startLat + citizenLat) / 2 + 0.002, (startLng + citizenLng) / 2 - 0.003],
        [citizenLat, citizenLng]
      ],
      {
        color: '#2563A6',
        weight: 5,
        opacity: 0.85,
        dashArray: '10, 10',
        lineCap: 'round'
      }
    ).addTo(map);

    const group = L.featureGroup([
      citizenMarkerRef.current,
      ambMarkerRef.current,
      ...(hospMarkerRef.current ? [hospMarkerRef.current] : [])
    ]);
    map.fitBounds(group.getBounds().pad(0.25));

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Smooth continuous movement animation toward citizen
  useEffect(() => {
    let progress = 0;
    const p1 = { lat: startLat, lng: startLng };
    const p2 = { lat: (startLat + citizenLat) / 2 + 0.002, lng: (startLng + citizenLng) / 2 - 0.003 };
    const p3 = { lat: citizenLat, lng: citizenLng };

    const getBezierPoint = (t) => {
      const lat = (1 - t) * (1 - t) * p1.lat + 2 * (1 - t) * t * p2.lat + t * t * p3.lat;
      const lng = (1 - t) * (1 - t) * p1.lng + 2 * (1 - t) * t * p2.lng + t * t * p3.lng;
      return { lat, lng };
    };

    let lastTimestamp = performance.now();

    const animate = (timestamp) => {
      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      progress = Math.min(0.92, progress + (delta * 0.015));
      const nextPos = getBezierPoint(progress);
      setAmbPos(nextPos);

      if (ambMarkerRef.current) {
        ambMarkerRef.current.setLatLng([nextPos.lat, nextPos.lng]);
      }

      if (routePolylineRef.current) {
        routePolylineRef.current.setLatLngs([
          [nextPos.lat, nextPos.lng],
          [(nextPos.lat + citizenLat) / 2 + 0.001, (nextPos.lng + citizenLng) / 2 - 0.0015],
          [citizenLat, citizenLng]
        ]);
      }

      if (progress < 0.92) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [citizenLat, citizenLng]);

  const etaDisplayMinutes = Math.floor(etaRemainingSeconds / 60);
  const etaDisplaySeconds = etaRemainingSeconds % 60;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex flex-col justify-between overflow-y-auto p-3 md:p-6 animate-in fade-in duration-200">
      <div className="max-w-6xl w-full mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col flex-1">
        
        {/* Top Header Bar */}
        <div className="bg-gradient-to-r from-[#17324D] via-[#1E4369] to-[#2563A6] text-white p-4 md:p-6 flex flex-wrap items-center justify-between gap-4 border-b border-blue-900/50">
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
                  MDT Tactical Navigation: En Route to Citizen
                </h2>
                <span className="bg-blue-500 text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                  ACTIVE RUN
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Unit: <strong className="text-white">{ambulance?.code || 'RESQ-A01'}</strong> • 
                Patient: <strong className="text-white">{incident?.citizen_name || 'Caller'}</strong> • 
                Target ER: <strong className="text-white">{hospital?.name || 'Hospital'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-2 text-right">
              <span className="text-[10px] uppercase font-bold text-teal-200 block">ETA to Citizen</span>
              <div className="text-2xl font-black font-mono tracking-tight text-white flex items-baseline justify-end space-x-1">
                <span>{etaDisplayMinutes}:{etaDisplaySeconds < 10 ? `0${etaDisplaySeconds}` : etaDisplaySeconds}</span>
                <span className="text-xs font-sans text-teal-300 font-bold">MIN</span>
              </div>
            </div>

            <button
              onClick={() => alert(`Calling Citizen Emergency Contact (${incident?.citizen_name || 'Patient'})...`)}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-extrabold rounded-2xl shadow-lg transition flex items-center space-x-2"
            >
              <PhoneCall className="w-4 h-4 animate-bounce" />
              <span>Call Citizen</span>
            </button>
          </div>
        </div>

        {/* Milestone Stepper */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 md:px-8">
          <div className="grid grid-cols-6 gap-2">
            {AMBULANCE_STEPS.map((step, idx) => {
              const isDone = idx <= 1; // En route
              const isCurrent = idx === 1;

              return (
                <div key={step.id} className="flex flex-col items-center text-center space-y-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      isCurrent
                        ? 'bg-blue-600 text-white ring-4 ring-blue-200 shadow-md scale-110'
                        : isDone
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {isDone && !isCurrent ? <Check className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span className={`text-[11px] font-extrabold leading-tight ${
                    isCurrent ? 'text-blue-700' : isDone ? 'text-slate-800' : 'text-slate-400'
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

        {/* Main Body: Map + Patient Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-[460px]">
          
          {/* Map (7 cols) */}
          <div className="lg:col-span-7 relative min-h-[360px] lg:min-h-full border-b lg:border-b-0 lg:border-r border-slate-200">
            <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

            <div className="absolute bottom-4 left-4 z-40 bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-slate-200 text-xs space-y-1.5 pointer-events-auto max-w-xs">
              <span className="font-extrabold text-[#17324D] text-[11px] uppercase tracking-wider block">Telemetry Tracking</span>
              <div className="space-y-1 text-[11px]">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 ring-2 ring-red-200 animate-ping"></span>
                  <span className="font-bold text-slate-700">Citizen SOS Location ({citizenLat.toFixed(4)}, {citizenLng.toFixed(4)})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-blue-600 ring-2 ring-blue-200"></span>
                  <span className="font-bold text-slate-700">Ambulance {ambulance?.code} (Moving)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Info Cards (5 cols) */}
          <div className="lg:col-span-5 p-5 md:p-6 space-y-4 overflow-y-auto bg-slate-50/50 flex flex-col justify-between">
            <div className="space-y-4">
              
              {/* Patient Live Profile */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-extrabold text-[#17324D] uppercase tracking-wider flex items-center space-x-1.5">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>Citizen Patient Profile</span>
                  </span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    incident?.severity === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {incident?.severity || 'Critical'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="font-bold text-slate-900 text-[13px]">{incident?.title || 'Emergency Incident'}</p>
                  <p className="text-[11.5px] leading-relaxed text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    "{incident?.description || 'Immediate emergency medical response requested.'}"
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-red-50 p-2 rounded-xl border border-red-100">
                      <span className="text-red-500 block text-[9.5px] uppercase font-bold">Unconscious?</span>
                      <strong className="text-red-800 font-bold">{incident?.unconscious ? 'YES (Critical)' : 'NO'}</strong>
                    </div>
                    <div className="bg-blue-50 p-2 rounded-xl border border-blue-100">
                      <span className="text-blue-500 block text-[9.5px] uppercase font-bold">Priority Triage</span>
                      <strong className="text-blue-900 font-bold">{incident?.priority_score || 88}/100</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Destination Hospital Pre-Alert */}
              <div className="bg-teal-50/80 border border-teal-200 p-4 rounded-2xl shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-[#0F9D91] text-white flex items-center justify-center font-bold">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <strong className="text-xs font-black text-teal-950 block">
                        {hospital?.name || 'Osmania General Hospital'}
                      </strong>
                      <span className="text-[10px] text-teal-700 font-medium">
                        Trauma Level 1 • ER Admission Desk Pre-Alerted
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-teal-200/60 text-teal-900 px-2 py-0.5 rounded-md">
                    ICU Ready
                  </span>
                </div>

                <p className="text-[11px] text-teal-800">
                  Confirmed capacity: <strong>{hospital?.icu_available || 3} ICU beds available</strong>.
                </p>
              </div>
            </div>

            {/* Quick Status Buttons */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  if (onUpdateStatus) onUpdateStatus('On Scene');
                  alert('Status updated to: On Scene');
                }}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Mark Arrived at Scene</span>
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
