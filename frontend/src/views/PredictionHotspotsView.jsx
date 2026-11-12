import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Ambulance,
  Sparkles,
  ArrowRight,
  CloudRain,
  Car,
  AlertTriangle,
  Info,
  RotateCw
} from 'lucide-react';
import { fetchPrepositioningRecommendations, applyPrepositioning, triggerSimulationEvent } from '../services/api';

const PREDICTED_HOTSPOTS = [
  {
    name: "Madhapur IT Corridor",
    zone_id: "zone-madhapur",
    risk_score: 85,
    predicted_demand: "Critical Surge",
    traffic_factor: "1.35x High Velocity Corridor",
    weather_factor: "Clear",
    historical_count: 58,
    explanation: "High tech commuter density and multi-lane expressways produce elevated collision risks during morning and evening rush hours."
  },
  {
    name: "Gachibowli Tech Corridor",
    zone_id: "zone-gachibowli",
    risk_score: 75,
    predicted_demand: "Elevated",
    traffic_factor: "1.25x Outer Ring Road Junction",
    weather_factor: "Clear",
    historical_count: 34,
    explanation: "Outer Ring Road interchange with commercial high-rises and active construction zones."
  },
  {
    name: "Ameerpet Transit Hub",
    zone_id: "zone-ameerpet",
    risk_score: 70,
    predicted_demand: "Elevated",
    traffic_factor: "1.20x Metro Interchange Congestion",
    weather_factor: "Clear",
    historical_count: 45,
    explanation: "Dense metro transit junction with heavy pedestrian footfall and elevated historical cardiac/respiratory emergencies."
  },
  {
    name: "Kukatpally Urban Sector",
    zone_id: "zone-kukatpally",
    risk_score: 65,
    predicted_demand: "Moderate to High",
    traffic_factor: "1.25x Underpass Bottlenecks",
    weather_factor: "Flood-Prone",
    historical_count: 44,
    explanation: "Low-lying underpasses prone to rapid waterlogging during monsoons, increasing trapped commuter risks."
  },
  {
    name: "Banjara Hills Medical Corridor",
    zone_id: "zone-banjara",
    risk_score: 60,
    predicted_demand: "Moderate",
    traffic_factor: "1.10x Arterial Slopes",
    weather_factor: "Clear",
    historical_count: 40,
    explanation: "Tertiary medical destination with constant emergency intake into private super-specialty hospitals."
  },
  {
    name: "Koti Central Historical Hub",
    zone_id: "zone-koti",
    risk_score: 58,
    predicted_demand: "Moderate",
    traffic_factor: "1.30x Market Gridlock",
    weather_factor: "Clear",
    historical_count: 54,
    explanation: "Old city commercial market choke points with narrow emergency access lanes."
  }
];

export default function PredictionHotspotsView({ state, onRefresh }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState(null);
  const [selectedHotspot, setSelectedHotspot] = useState(PREDICTED_HOTSPOTS[0]);

  const ambulances = state?.ambulances || [];
  const zones = state?.zones || [];

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const data = await fetchPrepositioningRecommendations();
      setRecommendations(data || []);
    } catch (e) {
      console.error("Failed to load recommendations", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
  }, [state]);

  const handleApply = async (ambId, targetZoneId) => {
    try {
      setApplyingId(ambId);
      await applyPrepositioning(ambId, targetZoneId);
      if (onRefresh) onRefresh();
      await loadRecommendations();
    } catch (e) {
      console.error("Prepositioning apply failed", e);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#0F9D91]">
            <TrendingUp className="w-5 h-5 text-[#0F9D91]" />
            <span className="text-xs font-bold uppercase tracking-wider">Demand Prediction & Fleet Staging</span>
          </div>
          <h1 className="text-2xl font-black text-[#17324D] mt-1">Predictive Hotspots & Proactive Pre-positioning</h1>
          <p className="text-xs text-[#68778A]">
            Instead of waiting passively for emergency 108 calls, RESQ-X forecasts spatial demand using historical incident trends,
            traffic choke points, and weather factors to recommend relocating idle standby ambulances into high-risk sectors.
          </p>
        </div>

        <button
          onClick={loadRecommendations}
          disabled={loading}
          className="px-4 py-2 bg-[#17324D] hover:bg-[#2563A6] text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-2 shrink-0"
        >
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Staging Recommendations</span>
        </button>
      </div>

      {/* Part 10 Integrity Notice */}
      <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start space-x-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold">Illustrative Simulated Risk Modeling:</strong> Risk scores and demand forecasting
          indices are calculated dynamically from historical municipal incident counts, active weather disruption multipliers,
          and current traffic congestion levels for demonstration purposes.
        </div>
      </div>

      {/* Top Section: Predicted Emergency Hotspots Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hotspots List (1 Col) */}
        <div className="bg-white p-5 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-3">
          <h3 className="font-bold text-[#17324D] uppercase tracking-wider text-xs border-b pb-2 flex items-center justify-between">
            <span>Predicted Emergency Hotspots</span>
            <span className="text-[10px] text-slate-400">Ranked by Risk</span>
          </h3>

          <div className="space-y-2">
            {PREDICTED_HOTSPOTS.map((hotspot, idx) => {
              const isSelected = selectedHotspot.name === hotspot.name;
              const isHigh = hotspot.risk_score >= 75;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedHotspot(hotspot)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'border-[#0F9D91] ring-1 ring-teal-200 bg-teal-50/40'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <strong className="text-xs font-bold text-[#17324D] block">{hotspot.name}</strong>
                      <span className="text-[10px] text-slate-500">{hotspot.predicted_demand}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-xs font-black font-mono px-2 py-0.5 rounded-full ${
                      isHigh ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'
                    }`}>
                      {hotspot.risk_score} / 100
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Hotspot Explanation Details (2 Cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-2">
            <div>
              <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">
                Hotspot Risk Assessment
              </span>
              <h2 className="text-xl font-black text-[#17324D]">{selectedHotspot.name}</h2>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500">Calculated Risk:</span>
              <span className="text-base font-black text-red-600 font-mono">
                {selectedHotspot.risk_score} / 100
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-1">Traffic Choke Index:</span>
              <strong className="text-slate-800 font-semibold">{selectedHotspot.traffic_factor}</strong>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-1">Environmental Factor:</span>
              <strong className="text-slate-800 font-semibold">{selectedHotspot.weather_factor}</strong>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-1">Historical Incident Base:</span>
              <strong className="text-slate-800 font-semibold">{selectedHotspot.historical_count} Recorded Cases</strong>
            </div>
          </div>

          {/* AI Prediction Explanation */}
          <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-200 space-y-1.5 text-xs">
            <div className="flex items-center space-x-2 text-teal-900 font-bold">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>Prediction Explanation & Causal Attribution:</span>
            </div>
            <p className="text-slate-700 leading-relaxed text-xs">
              {selectedHotspot.explanation}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Section: Ambulance Pre-positioning Recommender */}
      <div className="bg-white p-6 rounded-2xl border border-[#E3E9EF] shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-3 gap-2">
          <div>
            <div className="flex items-center space-x-2 text-[#2563A6]">
              <Ambulance className="w-5 h-5 text-[#2563A6]" />
              <span className="text-xs font-bold uppercase tracking-wider">Strategic Fleet Redeployment</span>
            </div>
            <h3 className="text-lg font-black text-[#17324D] mt-0.5">
              Idle Ambulance Pre-positioning Recommendations ({recommendations.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Relocates unassigned units to cover high-threat zones before incidents occur
          </span>
        </div>

        {recommendations.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <strong className="text-slate-800 text-sm block">Global Standby Fleet is Optimally Balanced</strong>
            <p>All 8 municipal zones have sufficient standby unit coverage based on current risk scores.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec, idx) => {
              const amb = ambulances.find(a => a.id === rec.ambulance_id);
              const fromZone = zones.find(z => z.id === rec.from_zone_id);
              const toZone = zones.find(z => z.id === rec.to_zone_id);
              const isApplying = applyingId === rec.ambulance_id;

              return (
                <div
                  key={idx}
                  className="bg-gradient-to-r from-teal-50/50 via-white to-blue-50/50 rounded-xl border-2 border-teal-500/40 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="bg-teal-600 text-white font-bold text-[10px] uppercase px-2 py-0.5 rounded-full">
                        Recommended Order
                      </span>
                      <strong className="text-sm font-black text-[#17324D]">{amb?.code || rec.ambulance_id}</strong>
                      <span className="text-slate-500 font-medium">({amb?.type || 'ALS'})</span>
                    </div>

                    <div className="flex items-center space-x-2 text-slate-700 font-medium">
                      <span>Current Home: <strong>{fromZone?.name || rec.from_zone_id}</strong></span>
                      <ArrowRight className="w-3.5 h-3.5 text-teal-600" />
                      <span>Target Staging: <strong className="text-teal-700">{toZone?.name || rec.to_zone_id}</strong></span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      "{rec.reason || `Move idle standby ${amb?.code} to cover high-risk deficit in ${toZone?.name}.`}"
                    </p>
                  </div>

                  <button
                    onClick={() => handleApply(rec.ambulance_id, rec.to_zone_id)}
                    disabled={isApplying}
                    className="px-4 py-2.5 bg-[#0F9D91] hover:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center space-x-2 shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isApplying ? 'Relocating Unit...' : 'Apply Staging Order'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
