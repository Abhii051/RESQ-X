import React, { useState } from 'react';
import {
  Cpu,
  CloudRain,
  Car,
  Activity,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  MapPin,
  Ambulance,
  Building2,
  Zap
} from 'lucide-react';
import { triggerSimulationEvent } from '../services/api';

export default function DigitalTwinView({ state, onRefresh }) {
  const zones = state?.zones || [];
  const [simulating, setSimulating] = useState(false);
  const [selectedZone, setSelectedZone] = useState(zones[0]?.id || "zone-koti");

  const currentZone = zones.find(z => z.id === selectedZone) || zones[0];

  const handleSimulateRainfall = async () => {
    try {
      setSimulating(true);
      await triggerSimulationEvent('heavy-rainfall', { zone_id: selectedZone });
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Rain simulation failed", e);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#2563A6]">
            <Cpu className="w-5 h-5 text-[#2563A6]" />
            <span className="text-xs font-bold uppercase tracking-wider">Smart City Digital Twin Model</span>
          </div>
          <h1 className="text-2xl font-black text-[#17324D] mt-1">Hyderabad Urban Digital Twin</h1>
          <p className="text-xs text-[#68778A]">
            Continuous simulation model integrating historical accident heatmaps, real-time weather inundation, road friction indices, and response coverage ratios across all 8 municipal sectors.
          </p>
        </div>

        <button
          onClick={handleSimulateRainfall}
          disabled={simulating}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-2"
        >
          <CloudRain className="w-4 h-4" />
          <span>Simulate Monsoon Deluge</span>
        </button>
      </div>

      {/* 8 Zones Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {zones.map((zone) => {
          const isHighRisk = zone.risk_score > 60;
          const isSelected = zone.id === selectedZone;

          return (
            <div
              key={zone.id}
              onClick={() => setSelectedZone(zone.id)}
              className={`p-4 rounded-2xl border cursor-pointer transition shadow-2xs hover:shadow-xs flex flex-col justify-between ${
                isSelected
                  ? 'border-[#2563A6] ring-2 ring-blue-100 bg-white'
                  : 'border-[#E3E9EF] bg-white hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-[#17324D]">{zone.name}</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    isHighRisk ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                  }`}>
                    {zone.risk_score} / 100
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 mt-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Active / Hist Incidents:</span>
                    <strong className="text-slate-800">{zone.active_incidents} / {zone.historical_incidents}</strong>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">Standby Ambulances:</span>
                    <strong className={zone.available_ambulances === 0 ? 'text-red-600' : 'text-emerald-700'}>
                      {zone.available_ambulances} units
                    </strong>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">Traffic Disruption:</span>
                    <span className="font-semibold text-slate-700">{zone.traffic_condition} ({zone.traffic_multiplier}x)</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">Weather Condition:</span>
                    <span className="font-semibold text-slate-700">{zone.weather_condition}</span>
                  </div>
                </div>

                {/* Coverage Index Bar */}
                <div className="mt-3 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Response Coverage:</span>
                    <span className="font-mono font-bold text-[#0F9D91]">{zone.coverage_index}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#0F9D91] h-full rounded-full transition-all duration-500"
                      style={{ width: `${zone.coverage_index}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Predicted Demand:</span>
                <span className={`font-bold ${zone.predicted_demand === 'High' ? 'text-red-600' : 'text-slate-800'}`}>
                  {zone.predicted_demand}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Sector Deep-Dive Simulation Inspector */}
      {currentZone && (
        <div className="bg-white p-6 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600">
                Digital Twin Sector Diagnostics
              </span>
              <h3 className="text-lg font-black text-[#17324D]">{currentZone.name}</h3>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Coordinates: {currentZone.lat.toFixed(4)}°N, {currentZone.lng.toFixed(4)}°E
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-slate-400 font-semibold block uppercase text-[10px]">Synthetic Demand Index</span>
              <div className="text-2xl font-black text-[#17324D]">{currentZone.risk_score} <span className="text-xs font-normal text-slate-400">/ 100</span></div>
              <p className="text-slate-500 text-[11px] mt-1">Calculated from historical emergency frequency + live active calls</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-slate-400 font-semibold block uppercase text-[10px]">Transit Multiplier</span>
              <div className="text-2xl font-black text-blue-700">{(currentZone.traffic_multiplier * currentZone.weather_multiplier).toFixed(2)}x</div>
              <p className="text-slate-500 text-[11px] mt-1">Road friction: {currentZone.weather_condition} ({currentZone.weather_multiplier}x)</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-slate-400 font-semibold block uppercase text-[10px]">Standby Fleet Defense</span>
              <div className="text-2xl font-black text-emerald-700">{currentZone.available_ambulances} <span className="text-xs font-normal text-slate-400">Available</span></div>
              <p className="text-slate-500 text-[11px] mt-1">Coverage Index: {currentZone.coverage_index}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
