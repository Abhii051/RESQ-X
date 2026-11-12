import React, { useState } from 'react';
import LiveMap from '../components/LiveMap';
import { Layers, MapPin, Ambulance, Building2, AlertTriangle, CloudRain, Car } from 'lucide-react';

export default function MapView({ state, onSelectIncident, onSelectAmbulance, onSelectHospital }) {
  const [selectedZone, setSelectedZone] = useState('all');

  const zones = state?.zones || [];
  const incidents = state?.incidents || [];
  const ambulances = state?.ambulances || [];
  const hospitals = state?.hospitals || [];

  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col space-y-4 max-w-7xl mx-auto">
      {/* Top Map Header & Controls */}
      <div className="bg-white p-4 rounded-xl border border-[#E3E9EF] shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0F9D91] animate-pulse"></span>
            <h1 className="text-lg font-black text-[#17324D]">Hyderabad Live Emergency GIS Network</h1>
          </div>
          <p className="text-xs text-[#68778A]">
            Real-time geospatial tracking across 8 predefined municipal sectors, 5 regional hospitals, and 10 ALS/BLS ambulances.
          </p>
        </div>

        {/* Quick Sector Selector & Counts */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-slate-500 font-medium">Zone Filter:</span>
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="bg-transparent font-bold text-[#17324D] outline-none cursor-pointer"
            >
              <option value="all">All 8 Sectors</option>
              {zones.map(z => (
                <option key={z.id} value={z.id}>{z.name} (Risk: {z.risk_score})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 bg-blue-50 text-blue-900 px-3 py-1.5 rounded-lg border border-blue-200 font-bold">
            <Ambulance className="w-4 h-4 text-blue-600" />
            <span>{ambulances.length} Ambulances</span>
          </div>

          <div className="flex items-center space-x-2 bg-teal-50 text-teal-900 px-3 py-1.5 rounded-lg border border-teal-200 font-bold">
            <Building2 className="w-4 h-4 text-teal-600" />
            <span>{hospitals.length} Hospitals</span>
          </div>
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div className="flex-1 rounded-2xl overflow-hidden border border-[#E3E9EF] shadow-md relative">
        <LiveMap
          state={state}
          onSelectIncident={onSelectIncident}
          onSelectAmbulance={onSelectAmbulance}
          onSelectHospital={onSelectHospital}
        />
      </div>
    </div>
  );
}
